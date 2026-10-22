const db = require('./db');
const {
  CLASSES, RACES, SKILLS, ABILITY_NAMES, ABILITY_LABELS, XP_THRESHOLDS,
} = require('./dnd-data');
const {
  abilityModifier, formatModifier, hpForLevel, getClassProgression, getArmorClass,
  validatePointBuy25, roll4d6DropLowest, calculatePlayerInitiativeBonus,
} = require('./dnd-rules');

function ensureCampaign(guildId, name = 'Adventure') {
  const stmt = db.prepare(
    `INSERT INTO dnd_campaigns (guild_id, name, active) VALUES (?, ?, 1)
     ON CONFLICT(guild_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP`
  );
  stmt.run(guildId, name);
}

function getCampaign(guildId) {
  return db.prepare('SELECT * FROM dnd_campaigns WHERE guild_id = ?').get(guildId);
}

function getCharacter(guildId, userId) {
  return db.prepare(
    "SELECT * FROM dnd_characters WHERE guild_id = ? AND user_id = ? AND status = 'active'"
  ).get(guildId, userId);
}

function applyRaceModifiers(raceKey, stats) {
  const race = RACES[raceKey];
  if (!race) return { stats, freeBonusStat: null };

  const result = { ...stats };
  for (const [stat, mod] of Object.entries(race.modifiers)) {
    result[stat] += mod;
  }

  return { stats: result, freeBonusStat: race.freeBonus || null };
}

function createCharacter(guildId, userId, name, raceKey, classKey, statMethod, statAssignments, alignment) {
  ensureCampaign(guildId);

  const existing = getCharacter(guildId, userId);
  if (existing) {
    throw new Error('You already have an active character in this server. Use `!dnd retire` first if you want a new one.');
  }

  if (!RACES[raceKey]) {
    throw new Error(`Unknown race: ${raceKey}. Use \`!dnd races\` to see available races.`);
  }
  if (!CLASSES[classKey]) {
    throw new Error(`Unknown class: ${classKey}. Use \`!dnd classes\` to see available classes.`);
  }

  // Validate that all six abilities were provided.
  const missingStats = ABILITY_NAMES.filter((a) => !(a in statAssignments) || Number.isNaN(statAssignments[a]));
  if (missingStats.length > 0) {
    throw new Error(`Missing stats: ${missingStats.join(', ')}`);
  }

  let baseStats = {};
  for (const ability of ABILITY_NAMES) {
    baseStats[ability] = statAssignments[ability];
  }

  if (statMethod === 'point-buy-25') {
    const validation = validatePointBuy25(statAssignments);
    if (!validation.valid) {
      throw new Error(validation.error);
    }
  } else if (statMethod !== '4d6-drop') {
    throw new Error('Invalid stat generation method. Choose `4d6-drop` or `point-buy-25`.');
  }

  // Apply racial modifiers.
  const { stats: finalStats, freeBonusStat } = applyRaceModifiers(raceKey, baseStats);

  // Apply free +2 for human/half-elf if chosen.
  if (freeBonusStat && statAssignments?._freeBonus) {
    finalStats[statAssignments._freeBonus] += 2;
  }

  const conMod = abilityModifier(finalStats.con);
  const cls = CLASSES[classKey];
  const progression = getClassProgression(classKey, 1);
  const maxHp = hpForLevel(1, cls.hitDie, conMod);
  const ac = getArmorClass(abilityModifier(finalStats.dex));
  const skillPoints = progression.caster ? 0 : progression.classSkills.length; // simplified first-level skill points

  const now = new Date().toISOString();
  const transaction = db.transaction(() => {
    const insert = db.prepare(`
      INSERT INTO dnd_characters (
        guild_id, user_id, name, race, class, level, xp, hp, max_hp, ac, alignment,
        str, dex, con, int, wis, cha, bab, fortitude, reflex, will, hit_dice,
        skill_points_remaining
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const charId = insert.run(
      guildId, userId, name, RACES[raceKey].name, CLASSES[classKey].name, 1, 0,
      maxHp, maxHp, ac, alignment || 'True Neutral',
      finalStats.str, finalStats.dex, finalStats.con, finalStats.int, finalStats.wis, finalStats.cha,
      progression.bab, progression.fortitude, progression.reflex, progression.will,
      `d${cls.hitDie}`, skillPoints
    ).lastInsertRowid;

    // Initialize class skills with 0 ranks.
    const skillInsert = db.prepare(
      'INSERT INTO dnd_character_skills (character_id, skill, ranks) VALUES (?, ?, 0)'
    );
    for (const skill of progression.classSkills) {
      skillInsert.run(charId, skill);
    }

    // Add starting gold pouch.
    const invInsert = db.prepare(
      'INSERT INTO dnd_character_inventory (character_id, item, quantity, description) VALUES (?, ?, ?, ?)'
    );
    invInsert.run(charId, 'Gold Pieces (gp)', 0, 'Starting gold pouch');

    return charId;
  });

  const characterId = transaction();
  return getCharacterById(characterId);
}

function getCharacterById(characterId) {
  return db.prepare('SELECT * FROM dnd_characters WHERE id = ?').get(characterId);
}

function getCharacterSkills(characterId) {
  return db.prepare(
    'SELECT skill, ranks FROM dnd_character_skills WHERE character_id = ? ORDER BY skill'
  ).all(characterId);
}

function getCharacterInventory(characterId) {
  return db.prepare(
    'SELECT id, item, quantity, description FROM dnd_character_inventory WHERE character_id = ? ORDER BY item'
  ).all(characterId);
}

function getCharacterSpells(characterId) {
  return db.prepare(
    'SELECT id, name, level, prepared, uses_left FROM dnd_character_spells WHERE character_id = ? ORDER BY level, name'
  ).all(characterId);
}

function formatSheet(character) {
  if (!character) return 'No active character found.';

  const mod = (stat) => abilityModifier(character[stat]);
  const modStr = (stat) => {
    const m = mod(stat);
    return m >= 0 ? `+${m}` : `${m}`;
  };

  let text = `📜 **Character Sheet: ${character.name}**\n`;
  text += `Race: **${character.race}** | Class: **${character.class} ${character.level}**\n`;
  text += `Alignment: ${character.alignment} | XP: ${character.xp.toLocaleString()}\n\n`;

  text += `**Stats**\n`;
  for (const stat of ABILITY_NAMES) {
    text += `${ABILITY_LABELS[stat]}: ${character[stat]} (${modStr(stat)}) `;
  }
  text += `\n\n`;

  text += `**Combat**\n`;
  text += `HP: ${character.hp}/${character.max_hp}\n`;
  text += `AC: ${character.ac}\n`;
  text += `BAB: ${formatModifier(character.bab)}\n`;
  text += `Initiative: ${formatModifier(calculatePlayerInitiativeBonus(character))}\n`;
  text += `Saves: Fort ${formatModifier(character.fortitude)}, Ref ${formatModifier(character.reflex)}, Will ${formatModifier(character.will)}\n`;

  return text;
}

function formatFullSheet(character) {
  let text = formatSheet(character);

  const skills = getCharacterSkills(character.id);
  if (skills.length > 0) {
    text += `\n**Skills**\n`;
    text += skills
      .map((s) => {
        const keyStat = SKILLS[s.skill];
        const total = s.ranks + (keyStat ? abilityModifier(character[keyStat]) : 0);
        return `${s.skill}: ${s.ranks} ${keyStat ? `(${ABILITY_LABELS[keyStat]})` : ''} → ${total >= 0 ? '+' : ''}${total}`;
      })
      .join('\n');
    text += '\n';
  }

  const inventory = getCharacterInventory(character.id);
  if (inventory.length > 0) {
    text += `\n**Inventory**\n`;
    text += inventory.map((i) => `${i.quantity}x ${i.item}${i.description ? ` — ${i.description}` : ''}`).join('\n');
    text += '\n';
  }

  const spells = getCharacterSpells(character.id);
  if (spells.length > 0) {
    text += `\n**Spells**\n`;
    text += spells.map((s) => `${s.name} (level ${s.level})${s.prepared ? ' [prepared]' : ''}${s.uses_left !== null ? ` — ${s.uses_left} left` : ''}`).join('\n');
    text += '\n';
  }

  return text;
}

function addInventoryItem(characterId, item, quantity = 1, description = '') {
  const existing = db.prepare(
    'SELECT id, quantity FROM dnd_character_inventory WHERE character_id = ? AND LOWER(item) = LOWER(?)'
  ).get(characterId, item);

  if (existing) {
    db.prepare('UPDATE dnd_character_inventory SET quantity = ? WHERE id = ?').run(
      existing.quantity + quantity,
      existing.id
    );
    return existing.id;
  }

  return db.prepare(
    'INSERT INTO dnd_character_inventory (character_id, item, quantity, description) VALUES (?, ?, ?, ?)'
  ).run(characterId, item, quantity, description).lastInsertRowid;
}

function removeInventoryItem(characterId, item, quantity = 1) {
  const existing = db.prepare(
    'SELECT id, quantity FROM dnd_character_inventory WHERE character_id = ? AND LOWER(item) = LOWER(?)'
  ).get(characterId, item);

  if (!existing) return false;
  if (existing.quantity <= quantity) {
    db.prepare('DELETE FROM dnd_character_inventory WHERE id = ?').run(existing.id);
  } else {
    db.prepare('UPDATE dnd_character_inventory SET quantity = ? WHERE id = ?').run(
      existing.quantity - quantity,
      existing.id
    );
  }
  return true;
}

function adjustHp(characterId, delta) {
  const character = getCharacterById(characterId);
  if (!character) return null;

  const newHp = Math.min(character.max_hp, Math.max(0, character.hp + delta));
  db.prepare('UPDATE dnd_characters SET hp = ?, updated_at = ? WHERE id = ?').run(
    newHp,
    new Date().toISOString(),
    characterId
  );
  return newHp;
}

function addXp(characterId, amount) {
  const character = getCharacterById(characterId);
  if (!character) return null;

  const newXp = character.xp + amount;
  db.prepare('UPDATE dnd_characters SET xp = ?, updated_at = ? WHERE id = ?').run(
    newXp,
    new Date().toISOString(),
    characterId
  );
  return newXp;
}

function addSpell(characterId, name, level, prepared = false, usesLeft = null) {
  return db.prepare(
    'INSERT INTO dnd_character_spells (character_id, name, level, prepared, uses_left) VALUES (?, ?, ?, ?, ?)'
  ).run(characterId, name, level, prepared ? 1 : 0, usesLeft).lastInsertRowid;
}

function castSpell(characterId, spellName) {
  const spell = db.prepare(
    'SELECT * FROM dnd_character_spells WHERE character_id = ? AND LOWER(name) = LOWER(?)'
  ).get(characterId, spellName);

  if (!spell) return { success: false, error: 'Spell not found.' };
  if (spell.uses_left !== null && spell.uses_left <= 0) {
    return { success: false, error: 'No uses left for this spell.' };
  }

  if (spell.uses_left !== null) {
    db.prepare('UPDATE dnd_character_spells SET uses_left = ? WHERE id = ?').run(
      spell.uses_left - 1,
      spell.id
    );
  }

  return { success: true, spell };
}

function restCharacter(characterId) {
  const character = getCharacterById(characterId);
  if (!character) return null;

  db.transaction(() => {
    db.prepare('UPDATE dnd_characters SET hp = max_hp WHERE id = ?').run(characterId);
    db.prepare('UPDATE dnd_character_spells SET uses_left = (SELECT level FROM dnd_character_spells WHERE id = dnd_character_spells.id) WHERE character_id = ?').run(characterId);
  })();

  return getCharacterById(characterId);
}

function logRoll(guildId, userId, characterId, rollType, formula, diceRolls, total) {
  db.prepare(
    'INSERT INTO dnd_roll_logs (guild_id, user_id, character_id, roll_type, formula, dice_rolls, total) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(guildId, userId, characterId, rollType, formula, JSON.stringify(diceRolls), total);
}

module.exports = {
  ensureCampaign,
  getCampaign,
  getCharacter,
  getCharacterById,
  createCharacter,
  getCharacterSkills,
  getCharacterInventory,
  getCharacterSpells,
  formatSheet,
  formatFullSheet,
  addInventoryItem,
  removeInventoryItem,
  adjustHp,
  addXp,
  addSpell,
  castSpell,
  restCharacter,
  logRoll,
};
