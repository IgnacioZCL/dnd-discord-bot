const {
  RACES, CLASSES, SKILLS, ABILITY_NAMES, ABILITY_LABELS, ALIGNMENTS,
} = require('../lib/dnd-data');
const {
  abilityModifier, formatModifier, d20Roll, formatD20Roll,
  roll4d6DropLowest, validatePointBuy25, calculateSpellDc,
} = require('../lib/dnd-rules');
const {
  getCharacter, createCharacter, formatFullSheet, addInventoryItem,
  removeInventoryItem, adjustHp, addXp, addSpell, castSpell, restCharacter,
  logRoll,
} = require('../lib/dnd-characters');
const db = require('../lib/db');
const {
  getActiveParty, getPartyById, getPartyMembers, createParty, joinParty,
  leaveParty, disbandParty, listParties,
  getActiveEncounter, getEncounterMonsters, startEncounter, getEncounterParticipants,
  getInitiativeOrder, getCurrentActor,
  attackMonster, monsterAttack,
} = require('../lib/dnd-party');
const { getMonster, pickRandomEncounter } = require('../lib/dnd-monsters');

const pendingCreations = new Map();
const DND_CHANNEL_NAME = 'dnd-kirk';

function isDndChannel(message) {
  if (!message.guild) return true; // Allow DMs.
  const channelName = message.channel.name;
  if (channelName !== DND_CHANNEL_NAME) {
    return false;
  }
  return true;
}

function raceListText() {
  return Object.entries(RACES)
    .map(([key, race]) => {
      const mods = Object.entries(race.modifiers || {})
        .map(([stat, mod]) => `${stat.toUpperCase()} ${mod > 0 ? '+' : ''}${mod}`)
        .join(', ');
      const bonus = race.freeBonus ? `, choose any +2` : '';
      return `- \`${key}\`: **${race.name}** — ${mods || 'No modifiers'}${bonus}`;
    })
    .join('\n');
}

function classListText() {
  return Object.entries(CLASSES)
    .map(([key, cls]) => `- \`${key}\`: ${cls.name}`)
    .join('\n');
}

function alignmentListText() {
  return ALIGNMENTS.map((a) => `- \`${a.toLowerCase().replace(/ /g, '-')}\``).join('\n');
}

function parseStatAssignments(args) {
  const assignments = {};
  for (const arg of args) {
    const [stat, value] = arg.split('=');
    if (!stat || value === undefined) continue;
    const key = stat.toLowerCase();
    if (!ABILITY_NAMES.includes(key)) continue;
    assignments[key] = parseInt(value, 10);
  }
  return assignments;
}

function isAdmin(message) {
  return message.member?.permissions?.has('Administrator') || false;
}

async function showHelp(message) {
  const key = `${message.guild.id}-${message.author.id}`;
  const session = pendingCreations.get(key);

  if (session) {
    let text = `🛡️ **Character creation in progress: ${session.name}**\n`;

    switch (session.step) {
      case 'free-bonus':
        text += `You are using ${session.method === '4d6-drop' ? '4d6 drop lowest' : 'point-buy 25'}.\n`;
        text += `As a ${RACES[session.raceKey].name}, pick one ability for your +2 racial bonus.\n`;
        text += `Reply: \`!dnd assign ${ABILITY_NAMES.join('|')}\`.`;
        break;
      case 'assign-4d6':
        text += 'Assign your rolled stats to abilities.\n';
        text += `Rolled values: **${session.rolledStats.join(', ')}**\n`;
        text += 'Use each value exactly once. Example:\n';
        text += '\`!dnd assign str=15 dex=12 con=14 int=10 wis=13 cha=8\`\n\n';
        text += 'Not happy? Switch to point-buy 25 with \`!dnd assign pointbuy\`, or reroll with \`!dnd assign reroll\`.';
        break;
      case 'assign-pointbuy':
        text += 'Assign your stats with point-buy 25 (each score 8-18).\n';
        text += 'Example: \`!dnd assign str=14 dex=12 con=13 int=10 wis=12 cha=8\`\n';
        text += 'Cost table: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=6, 15=8, 16=10, 17=13, 18=16.\n\n';
        text += 'Want to go back to rolling? Use \`!dnd assign reroll\`.';
        break;
      default:
        text += 'Unknown creation step. Try `!dnd help` again or restart with `!dnd create`.';
    }

    await message.channel.send(text);
    return;
  }

  const character = getCharacter(message.guild.id, message.author.id);

  if (!character) {
    let text = '🛡️ **No active character.**\n';
    text += 'Start with: \`!dnd create <name> <race> <class>\`\n';
    text += 'See options with \`!dnd races\` and \`!dnd classes\`.\n\n';
    text += '**Quick example:**\n';
    text += '\`!dnd create Conan human fighter\`\n';
    text += 'Then \`!dnd help\` will guide you through the next step.';
    await message.channel.send(text);
    return;
  }

  let text = `🛡️ **Active character: ${character.name}** (${character.race} ${character.class} ${character.level})\n`;
  text += '**What you can do next:**\n';
  text += '- \`!dnd sheet\` — view your full character sheet\n';
  text += '- \`!dnd roll <str|dex|con|int|wis|cha>\` — ability check\n';
  text += '- \`!dnd attack\` — attack roll\n';
  text += '- \`!dnd save <fort|ref|will>\` — saving throw\n';
  text += '- \`!dnd skill <skill name>\` — skill check (use \`!dnd skills\` to list)\n';
  text += '- \`!dnd hp +5\` / \`!dnd hp -10\` — adjust HP\n';
  text += '- \`!dnd rest\` — recover HP\n';
  text += '- \`!dnd inventory\` / \`!dnd add [qty] <item>\` / \`!dnd remove [qty] <item>\`\n';
  text += '- \`!dnd spells\` / \`!dnd cast <spell>\` / \`!dnd dc <level>\`\n';
  text += '- \`!dnd party create <name>\` / \`!dnd party join <id>\` / \`!dnd party status\`\n';
  text += '- \`!dnd encounter\` / \`!dnd encounter <monster> [count]\` / \`!dnd attack-monster\` / \`!dnd monster-status\`\n';
  text += '- \`!dnd help\` — show this message again';

  await message.channel.send(text);
}

async function startCreate(message, args) {
  const [name, raceKey, classKey] = args;

  if (!name || !raceKey || !classKey) {
    return message.reply(
      '❌ Usage: `!dnd create <name> <race> <class>`\n' +
      'Use `!dnd races` and `!dnd classes` to see options.'
    );
  }

  const existing = getCharacter(message.guild.id, message.author.id);
  if (existing) {
    return message.reply('❌ You already have an active character in this server.');
  }

  if (!RACES[raceKey.toLowerCase()]) {
    return message.reply(`❌ Unknown race \`${raceKey}\`. Use \`!dnd races\`.`);
  }
  if (!CLASSES[classKey.toLowerCase()]) {
    return message.reply(`❌ Unknown class \`${classKey}\`. Use \`!dnd classes\`.`);
  }

  const key = `${message.guild.id}-${message.author.id}`;
  const roll = roll4d6DropLowest();

  pendingCreations.set(key, {
    name,
    raceKey: raceKey.toLowerCase(),
    classKey: classKey.toLowerCase(),
    method: '4d6-drop',
    rolledStats: roll.stats,
    rolls: roll.rolls,
    step: 'free-bonus',
  });

  await message.channel.send(
    `🛡️ Creating **${name}** the ${RACES[raceKey.toLowerCase()].name} ${CLASSES[classKey.toLowerCase()].name}.\n` +
    'Here are your rolled stats.'
  );
  await proceedToFreeBonusOrAssign(message, pendingCreations.get(key));
}

async function handleCreateStep(message, args) {
  const key = `${message.guild.id}-${message.author.id}`;
  const session = pendingCreations.get(key);
  if (!session) return;

  const input = args[0]?.toLowerCase();

  if (session.step === 'free-bonus') {
    const stat = input;
    if (!ABILITY_NAMES.includes(stat)) {
      return message.reply(`❌ Choose one of: ${ABILITY_NAMES.join(', ')}.`);
    }
    session.freeBonusStat = stat;
    pendingCreations.set(key, session);
    await promptAssign(message, session);
    return;
  }

  if (session.step === 'assign-4d6' || session.step === 'assign-pointbuy') {
    // Allow the player to switch to point-buy if they don't like the rolled stats.
    if (input === 'pointbuy' || input === 'point-buy') {
      if (session.method === '4d6-drop') {
        session.method = 'point-buy-25';
        delete session.rolledStats;
        delete session.rolls;
        pendingCreations.set(key, session);
        await promptAssign(message, session);
        return;
      }
      await message.reply('❌ You are already using point-buy.');
      return;
    }

    const assignments = parseStatAssignments(args);
    const missing = ABILITY_NAMES.filter((a) => !(a in assignments) || Number.isNaN(assignments[a]));
    if (missing.length > 0) {
      return message.reply(`❌ Missing or invalid stats: ${missing.join(', ')}`);
    }

    // Validate range 3-18 before racial modifiers.
    const outOfRange = ABILITY_NAMES.filter((a) => assignments[a] < 3 || assignments[a] > 18);
    if (outOfRange.length > 0) {
      return message.reply(`❌ Stats must be between 3 and 18 before racial modifiers: ${outOfRange.join(', ')}.`);
    }

    if (session.method === '4d6-drop') {
      const sortedRolled = [...session.rolledStats].sort((a, b) => a - b);
      const sortedAssigned = ABILITY_NAMES.map((a) => assignments[a]).sort((a, b) => a - b);
      const same = sortedRolled.every((v, i) => v === sortedAssigned[i]);
      if (!same) {
        return message.reply(
          `❌ Assigned values must exactly match the rolled stats: ${session.rolledStats.join(', ')}.`
        );
      }
    }

    if (session.method === 'point-buy-25') {
      const validation = validatePointBuy25(assignments);
      if (!validation.valid) {
        return message.reply(`❌ ${validation.error}`);
      }
    }

    if (session.freeBonusStat) {
      assignments._freeBonus = session.freeBonusStat;
    }

    // Show what will be submitted (with racial adjustments preview).
    const previewStats = { ...assignments };
    const race = RACES[session.raceKey];
    for (const [stat, mod] of Object.entries(race.modifiers || {})) {
      previewStats[stat] = (previewStats[stat] || 0) + mod;
    }
    if (assignments._freeBonus) {
      previewStats[assignments._freeBonus] += 2;
    }

    try {
      console.log(`[dnd assign] user=${message.author.id} method=${session.method} assignments=${JSON.stringify(assignments)}`);
      const character = createCharacter(
        message.guild.id,
        message.author.id,
        session.name,
        session.raceKey,
        session.classKey,
        session.method,
        assignments,
        'True Neutral'
      );
      pendingCreations.delete(key);
      await message.channel.send(formatFullSheet(character));
    } catch (error) {
      // If creation failed, keep the session alive so the user can retry.
      pendingCreations.set(key, session);
      await message.reply(`❌ ${error.message}\nReceived stats: ${ABILITY_NAMES.map((a) => `${a}=${assignments[a]}`).join(' ')}`);
    }
  }
}

async function proceedToFreeBonusOrAssign(message, session) {
  const key = `${message.guild.id}-${message.author.id}`;
  const race = RACES[session.raceKey];
  if (race?.freeBonus) {
    session.step = 'free-bonus';
    pendingCreations.set(key, session);
    await message.channel.send(
      `🧬 As a ${race.name}, choose one ability to receive a +2 racial bonus:\n` +
      `Reply with one of: ${ABILITY_NAMES.join(', ')}.`
    );
    return;
  }
  await promptAssign(message, session);
}

async function promptAssign(message, session) {
  const key = `${message.guild.id}-${message.author.id}`;
  if (session.method === '4d6-drop') {
    session.step = 'assign-4d6';
    pendingCreations.set(key, session);

    const rollLines = session.rolls
      .map((r, i) => `  Stat ${i + 1}: [${r.join(', ')}] → **${session.rolledStats[i]}**`)
      .join('\n');

    await message.channel.send(
      `🎲 Rolled stats:\n${rollLines}\n\n` +
      'Assign each value to your abilities with:\n' +
      '`!dnd assign str=15 dex=12 con=14 int=10 wis=13 cha=8`\n\n' +
      'Not happy with these? Switch to point-buy 25 with `!dnd assign pointbuy`. (lowest of 7 sets dropped)'
    );
  } else {
    session.step = 'assign-pointbuy';
    pendingCreations.set(key, session);
    await message.channel.send(
      '✏️ Point-buy 25. Assign stats (8-18) using:\n' +
      '`!dnd assign str=14 dex=12 con=13 int=10 wis=12 cha=8`\n' +
      'Cost table: 8=0, 9=1, 10=2, 11=3, 12=4, 13=5, 14=6, 15=8, 16=10, 17=13, 18=16.\n\n' +
      'Want to go back to rolling? Restart with `!dnd create <name> <race> <class>`.'
    );
  }
}

async function showSheet(message) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character. Use `!dnd create` to make one.');
  }
  await message.channel.send(formatFullSheet(character));
}

async function rollAbility(message, args) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const stat = args[0]?.toLowerCase();
  if (!ABILITY_NAMES.includes(stat)) {
    return message.reply(`❌ Choose one of: ${ABILITY_NAMES.join(', ')}.`);
  }

  const mod = abilityModifier(character[stat]);
  const roll = d20Roll(mod, ABILITY_LABELS[stat]);
  logRoll(message.guild.id, message.author.id, character.id, 'ability', `d20+${mod}`, [roll.die], roll.total);
  await message.channel.send(`🎲 ${character.name} rolls ${ABILITY_LABELS[stat]}: ${formatD20Roll(roll)}`);
}

async function rollAttack(message) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  // Use STR for melee by default. Could later support finesse/ranged choice.
  const statMod = abilityModifier(character.str);
  const bonus = character.bab + statMod;
  const roll = d20Roll(bonus, 'attack');
  logRoll(message.guild.id, message.author.id, character.id, 'attack', `d20+${bonus}`, [roll.die], roll.total);
  await message.channel.send(`⚔️ ${character.name} attacks: ${formatD20Roll(roll)} (BAB ${formatModifier(character.bab)} + STR ${formatModifier(statMod)})`);
}

async function rollSave(message, args) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const saveType = args[0]?.toLowerCase();
  const saveMap = {
    fort: { field: 'fortitude', stat: 'con', label: 'Fortitude' },
    fortitude: { field: 'fortitude', stat: 'con', label: 'Fortitude' },
    ref: { field: 'reflex', stat: 'dex', label: 'Reflex' },
    reflex: { field: 'reflex', stat: 'dex', label: 'Reflex' },
    will: { field: 'will', stat: 'wis', label: 'Will' },
  };

  const mapping = saveMap[saveType];
  if (!mapping) {
    return message.reply('❌ Choose `fort`, `ref`, or `will`.');
  }

  const bonus = character[mapping.field] + abilityModifier(character[mapping.stat]);
  const roll = d20Roll(bonus, 'save');
  logRoll(message.guild.id, message.author.id, character.id, 'save', `d20+${bonus}`, [roll.die], roll.total);
  await message.channel.send(`🛡️ ${character.name} rolls ${mapping.label}: ${formatD20Roll(roll)}`);
}

async function rollSkill(message, args) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const skillName = args.join(' ');
  if (!skillName) {
    return message.reply('❌ Usage: `!dnd skill <skill name>`');
  }

  const skill = Object.keys(SKILLS).find(
    (s) => s.toLowerCase() === skillName.toLowerCase()
  );
  if (!skill) {
    return message.reply(`❌ Unknown skill. Use \`!dnd skills\` to see the list.`);
  }

  const keyStat = SKILLS[skill];
  const { getCharacterSkills } = require('../lib/dnd-characters');
  const skills = getCharacterSkills(character.id);
  const ranks = skills.find((s) => s.skill.toLowerCase() === skill.toLowerCase())?.ranks || 0;
  const statMod = keyStat ? abilityModifier(character[keyStat]) : 0;
  const bonus = ranks + statMod;
  const roll = d20Roll(bonus, skill);
  logRoll(message.guild.id, message.author.id, character.id, 'skill', `d20+${bonus}`, [roll.die], roll.total);
  await message.channel.send(`🎯 ${character.name} rolls ${skill}: ${formatD20Roll(roll)} (ranks ${ranks}${keyStat ? ` + ${ABILITY_LABELS[keyStat]} ${formatModifier(statMod)}` : ''})`);
}

async function showSkillsList(message) {
  const text = Object.entries(SKILLS)
    .map(([skill, stat]) => `- ${skill}${stat ? ` (${ABILITY_LABELS[stat]})` : ''}`)
    .join('\n');
  await message.channel.send(`**Available skills**\n${text}`);
}

async function adjustHpCommand(message, args) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const delta = parseInt(args[0], 10);
  if (Number.isNaN(delta)) {
    return message.reply('❌ Usage: `!dnd hp +5` or `!dnd hp -10`.');
  }

  const newHp = adjustHp(character.id, delta);
  await message.channel.send(
    `❤️ ${character.name} HP changed by ${delta >= 0 ? '+' : ''}${delta}. Current HP: **${newHp}/${character.max_hp}**.`
  );
}

async function restCommand(message) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const updated = restCharacter(character.id);
  await message.channel.send(`💤 ${updated.name} is fully rested. HP: **${updated.hp}/${updated.max_hp}**.`);
}

async function showInventory(message) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const { getCharacterInventory } = require('../lib/dnd-characters');
  const items = getCharacterInventory(character.id);
  if (items.length === 0) {
    return message.channel.send('🎒 Inventory is empty.');
  }

  const text = items
    .map((i) => `${i.quantity}x **${i.item}**${i.description ? ` — ${i.description}` : ''}`)
    .join('\n');
  await message.channel.send(`🎒 **${character.name}'s Inventory**\n${text}`);
}

async function addItemCommand(message, args, isDm = false) {
  let character;
  let targetUser = message.author;
  let itemArgs = args;

  if (isDm) {
    const mentioned = message.mentions.users.first();
    if (mentioned) {
      targetUser = mentioned;
      itemArgs = args.filter((a) => !a.startsWith('<@'));
    }
  }

  character = getCharacter(message.guild.id, targetUser.id);
  if (!character) {
    return message.reply(`❌ ${targetUser} has no active character.`);
  }

  const quantity = parseInt(itemArgs[0], 10);
  const hasQuantity = !Number.isNaN(quantity);
  const itemName = hasQuantity ? itemArgs.slice(1).join(' ') : itemArgs.join(' ');
  const qty = hasQuantity ? quantity : 1;

  if (!itemName) {
    return message.reply('❌ Usage: `!dnd add [qty] <item name>`.');
  }

  addInventoryItem(character.id, itemName, qty);
  await message.channel.send(`🎒 Added ${qty}x **${itemName}** to ${character.name}.`);
}

async function removeItemCommand(message, args) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const quantity = parseInt(args[0], 10);
  const hasQuantity = !Number.isNaN(quantity);
  const itemName = hasQuantity ? args.slice(1).join(' ') : args.join(' ');
  const qty = hasQuantity ? quantity : 1;

  if (!itemName) {
    return message.reply('❌ Usage: `!dnd remove [qty] <item name>`.');
  }

  const success = removeInventoryItem(character.id, itemName, qty);
  if (!success) {
    return message.reply(`❌ ${character.name} doesn't have **${itemName}**.`);
  }
  await message.channel.send(`🎒 Removed ${qty}x **${itemName}** from ${character.name}.`);
}

async function showSpells(message) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const { getCharacterSpells } = require('../lib/dnd-characters');
  const spells = getCharacterSpells(character.id);
  if (spells.length === 0) {
    return message.channel.send('📖 No spells known.');
  }

  const text = spells
    .map((s) => `${s.name} (level ${s.level})${s.prepared ? ' [prepared]' : ''}${s.uses_left !== null ? ` — ${s.uses_left} left` : ''}`)
    .join('\n');
  await message.channel.send(`📖 **${character.name}'s Spells**\n${text}`);
}

async function castSpellCommand(message, args) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const spellName = args.join(' ');
  if (!spellName) {
    return message.reply('❌ Usage: `!dnd cast <spell name>`.');
  }

  const result = castSpell(character.id, spellName);
  if (!result.success) {
    return message.reply(`❌ ${result.error}`);
  }

  await message.channel.send(`✨ ${character.name} casts **${result.spell.name}**!`);
}

async function spellDcCommand(message, args) {
  const character = getCharacter(message.guild.id, message.author.id);
  if (!character) {
    return message.reply('❌ You have no active character.');
  }

  const spellLevel = parseInt(args[0], 10);
  if (Number.isNaN(spellLevel) || spellLevel < 0 || spellLevel > 9) {
    return message.reply('❌ Usage: `!dnd dc <spell-level 0-9>`.');
  }

  try {
    const dc = calculateSpellDc(character, spellLevel);
    await message.channel.send(`🎯 ${character.name}'s spell DC for level ${spellLevel} spells is **${dc}**.`);
  } catch (error) {
    await message.reply(`❌ ${error.message}`);
  }
}

async function adminHeal(message, args) {
  if (!isAdmin(message)) {
    return message.reply('❌ Only server administrators can use this command.');
  }

  const mentioned = message.mentions.users.first();
  const amountArg = args.find((a) => a.startsWith('+') || a.startsWith('-') || !Number.isNaN(parseInt(a, 10)));
  const amount = amountArg === 'max' ? Infinity : parseInt(amountArg, 10);

  const targetUser = mentioned || message.author;
  const character = getCharacter(message.guild.id, targetUser.id);
  if (!character) {
    return message.reply(`❌ ${targetUser} has no active character.`);
  }

  let delta;
  if (amountArg === 'max') {
    delta = character.max_hp - character.hp;
  } else {
    delta = amount;
  }

  if (Number.isNaN(delta)) {
    return message.reply('❌ Usage: `!dnd heal <@user> <+amount|max>`.');
  }

  const newHp = adjustHp(character.id, delta);
  await message.channel.send(`💚 ${character.name} healed ${delta}. Current HP: **${newHp}/${character.max_hp}**.`);
}

async function adminDamage(message, args) {
  if (!isAdmin(message)) {
    return message.reply('❌ Only server administrators can use this command.');
  }

  const mentioned = message.mentions.users.first();
  const amountArg = args.find((a) => !isNaN(parseInt(a, 10)));
  const amount = parseInt(amountArg, 10);

  const targetUser = mentioned || message.author;
  const character = getCharacter(message.guild.id, targetUser.id);
  if (!character) {
    return message.reply(`❌ ${targetUser} has no active character.`);
  }

  if (Number.isNaN(amount) || amount <= 0) {
    return message.reply('❌ Usage: `!dnd damage <@user> <amount>`.');
  }

  const newHp = adjustHp(character.id, -amount);
  await message.channel.send(`💔 ${character.name} takes ${amount} damage. Current HP: **${newHp}/${character.max_hp}**.`);
}

async function adminLevelUp(message, args) {
  if (!isAdmin(message)) {
    return message.reply('❌ Only server administrators can use this command.');
  }

  const mentioned = message.mentions.users.first();
  const targetUser = mentioned || message.author;
  const character = getCharacter(message.guild.id, targetUser.id);
  if (!character) {
    return message.reply(`❌ ${targetUser} has no active character.`);
  }

  // For now, level up requires manual XP management; this command just marks intent.
  // Full implementation would recalculate stats, HP, saves, BAB and skill points.
  await message.channel.send(`📈 Level-up for **${character.name}** is not fully automated yet. Use \`!dnd setxp\` to set XP and the DM should adjust HP/saves manually.`);
}

async function adminSetXp(message, args) {
  if (!isAdmin(message)) {
    return message.reply('❌ Only server administrators can use this command.');
  }

  const mentioned = message.mentions.users.first();
  const xpArg = args.find((a) => !isNaN(parseInt(a, 10)));
  const xp = parseInt(xpArg, 10);

  const targetUser = mentioned || message.author;
  const character = getCharacter(message.guild.id, targetUser.id);
  if (!character) {
    return message.reply(`❌ ${targetUser} has no active character.`);
  }

  if (Number.isNaN(xp) || xp < 0) {
    return message.reply('❌ Usage: `!dnd setxp <@user> <xp>`.');
  }

  const newXp = addXp(character.id, xp - character.xp);
  await message.channel.send(`✨ ${character.name} XP set to **${newXp.toLocaleString()}**.`);
}

async function adminAddSpell(message, args) {
  if (!isAdmin(message)) {
    return message.reply('❌ Only server administrators can use this command.');
  }

  const mentioned = message.mentions.users.first();
  const targetUser = mentioned || message.author;
  const character = getCharacter(message.guild.id, targetUser.id);
  if (!character) {
    return message.reply(`❌ ${targetUser} has no active character.`);
  }

  // Parse: !dnd give-spell @user "Fireball" 3
  const spellArgs = args.filter((a) => !a.startsWith('<@'));
  const level = parseInt(spellArgs[spellArgs.length - 1], 10);
  const spellName = Number.isNaN(level) ? spellArgs.join(' ') : spellArgs.slice(0, -1).join(' ');
  const spellLevel = Number.isNaN(level) ? 0 : level;

  if (!spellName) {
    return message.reply('❌ Usage: `!dnd give-spell <@user> <spell name> [level]`.');
  }

  addSpell(character.id, spellName, spellLevel, true);
  await message.channel.send(`📖 ${character.name} learned **${spellName}** (level ${spellLevel}).`);
}

async function adminReset(message) {
  const mentioned = message.mentions.users.first();
  const targetUser = mentioned || message.author;

  // Anyone can retire their own character; only admins can retire someone else's.
  if (targetUser.id !== message.author.id && !isAdmin(message)) {
    return message.reply('❌ Only server administrators can retire another player\'s character.');
  }

  const character = getCharacter(message.guild.id, targetUser.id);
  if (!character) {
    return message.reply(`❌ ${targetUser} has no active character.`);
  }

  db.prepare("UPDATE dnd_characters SET status = 'retired' WHERE id = ?").run(character.id);
  await message.channel.send(`🗑️ **${character.name}** has been retired. ${targetUser} can create a new character.`);
}

// ---------- Party and encounter commands ----------

async function partyCreate(message, args) {
  const name = args.join(' ').trim();
  if (!name) {
    return message.reply('❌ Usage: `!dnd party create <name>`.');
  }

  try {
    const party = createParty(message.guild.id, name, message.author.id);
    await message.channel.send(`🛡️ Party **${party.name}** created! ID: ${party.id}. Others can join with \`!dnd party join ${party.id}\`.`);
  } catch (error) {
    await message.reply(`❌ ${error.message}`);
  }
}

async function partyJoin(message, args) {
  const partyId = parseInt(args[0], 10);
  if (Number.isNaN(partyId)) {
    return message.reply('❌ Usage: `!dnd party join <party-id>`. Use `!dnd party list` to see IDs.');
  }

  try {
    const party = joinParty(partyId, message.author.id);
    await message.channel.send(`🛡️ You joined party **${party.name}** (ID: ${party.id}).`);
  } catch (error) {
    await message.reply(`❌ ${error.message}`);
  }
}

async function partyLeave(message) {
  try {
    const party = leaveParty(message.guild.id, message.author.id);
    await message.channel.send(`🛡️ You left party **${party.name}**.`);
  } catch (error) {
    await message.reply(`❌ ${error.message}`);
  }
}

async function partyDisband(message) {
  try {
    const party = disbandParty(message.guild.id, message.author.id);
    await message.channel.send(`🛡️ Party **${party.name}** has been disbanded.`);
  } catch (error) {
    await message.reply(`❌ ${error.message}`);
  }
}

async function partyStatus(message) {
  const party = getActiveParty(message.guild.id, message.author.id);
  if (!party) {
    return message.reply('❌ You are not in an active party. Create one with `!dnd party create <name>`.');
  }

  const members = getPartyMembers(party.id);
  const lines = await Promise.all(
    members.map(async (m) => {
      const char = getCharacter(message.guild.id, m.user_id);
      const user = await message.client.users.fetch(m.user_id).catch(() => null);
      const label = char
        ? `${char.name} (${char.race} ${char.class}) HP ${char.hp}/${char.max_hp}`
        : 'no character';
      return `- ${user ? user.toString() : `<@${m.user_id}>`}: ${label}`;
    })
  );

  await message.channel.send(
    `🛡️ **Party: ${party.name}** (ID: ${party.id}, leader <@${party.leader_user_id}>)\n${lines.join('\n')}`
  );
}

async function partyList(message) {
  const parties = listParties(message.guild.id);
  if (parties.length === 0) {
    return message.channel.send('🛡️ No active parties in this server.');
  }

  const lines = parties.map((p) => `• **${p.name}** (ID: ${p.id}, leader <@${p.leader_user_id}>)`);
  await message.channel.send(`🛡️ **Active parties**\n${lines.join('\n')}`);
}

const formatCr = (cr) => (cr < 1 ? `1/${Math.round(1 / cr)}` : cr.toString());

async function encounterStart(message, args) {
  const party = getActiveParty(message.guild.id, message.author.id);
  if (!party) {
    return message.reply('❌ You must be in an active party to start an encounter. Create or join one with `!dnd party create <name>` or `!dnd party join <id>`.');
  }

  const monsterKey = args[0]?.toLowerCase();
  const monsterCount = parseInt(args[1], 10) || null;

  const members = getPartyMembers(party.id);
  const partyLevels = [];
  for (const member of members) {
    const char = getCharacter(message.guild.id, member.user_id);
    if (char) partyLevels.push(char.level);
  }
  const partyLevel = partyLevels.length > 0
    ? Math.round(partyLevels.reduce((a, b) => a + b, 0) / partyLevels.length)
    : 1;

  // Random encounter when no monster key is given.
  if (!monsterKey) {
    const { pickRandomEncounter } = require('../lib/dnd-monsters');
    const chosen = pickRandomEncounter(partyLevel);
    return runEncounter(message, party.id, chosen.monster.key, chosen.count, chosen.el, chosen.difficulty, true);
  }

  // Fixed encounter: optional count, otherwise default 1.
  const fixedCount = monsterCount && monsterCount >= 1 && monsterCount <= 20 ? monsterCount : 1;
  return runEncounter(message, party.id, monsterKey, fixedCount, null, null, false);
}

async function runEncounter(message, partyId, monsterKey, monsterCount, precomputedEl, precomputedDifficulty, isRandom) {
  try {
    const {
      encounter, partyLevel, encounterLevel, difficultyLabel, initiative,
    } = startEncounter(message.guild.id, message.channel.id, partyId, monsterKey, monsterCount);
    const monster = getMonster(monsterKey);

    const el = precomputedEl ?? encounterLevel;
    const difficulty = precomputedDifficulty ?? difficultyLabel;

    let text = '';
    if (isRandom) {
      text += `🎲 **Random encounter!**\n`;
    }
    text += `👹 **${encounter.monster_name}** appears!\n`;
    text += `${monster.description}\n`;
    text += `CR each: **${formatCr(monster.cr)}** | Total HP: **${encounter.monster_hp}/${encounter.monster_max_hp}** | AC: **${encounter.monster_ac}** | Total XP: **${encounter.monster_xp}**\n`;
    text += `Encounter Level: **${el}** vs party level **${partyLevel}** — **${difficulty}**\n\n`;

    const initiativeLines = initiative.map((actor) => {
      const bonusText = formatModifier(actor.bonus);
      return `- ${actor.name}: d20 (${actor.die}) ${bonusText} = **${actor.initiative_score}**`;
    });
    text += `🎲 **Initiative order**\n${initiativeLines.join('\n')}\n\n`;
    text += `⏳ **Current turn:** ${initiative[0]?.name || 'unknown'}\n`;
    text += `Use \`!dnd attack-monster\` on your turn. Check status with \`!dnd monster-status\`.`;

    await message.channel.send(text);
  } catch (error) {
    await message.reply(`❌ ${error.message}`);
  }
}

function formatMonsterTurn(turn) {
  if (turn.summary) return turn.summary;
  if (turn.error) return `❌ ${turn.error}`;

  let text = `🐾 **${turn.attacker}** attacks ${turn.target}: `;
  if (!turn.hit) {
    text += `missed (rolled **${turn.attackRoll.total}** vs AC).`;
  } else {
    text += `hit for **${turn.damage}** damage!`;
    if (turn.defeated) {
      text += ` 💀 ${turn.target} falls!`;
    } else {
      text += ` HP: **${turn.targetHp}/${turn.targetMaxHp}**`;
    }
  }
  return text;
}

async function attackMonsterCommand(message) {
  const result = attackMonster(message.guild.id, message.channel.id, message.author.id);
  if (result.error) {
    if (result.currentActor) {
      return message.reply(`❌ ${result.error}\n⏳ Current turn: **${result.currentActor}**`);
    }
    return message.reply(`❌ ${result.error}`);
  }

  let text = `⚔️ **${result.attacker}** attacks ${result.monsterName}`;
  if (result.slotIndex !== undefined) {
    text += ` (${result.slotIndex + 1}/${result.totalSlots || result.slotIndex + 1})`;
  }
  text += ': ';

  if (!result.hit) {
    text += `missed (rolled **${result.attackRoll.total}** vs AC **${result.monsterAc ?? result.monster_ac}**).`;
  } else {
    text += `hit for **${result.damage}** damage!\n`;
    if (result.slotDefeated) {
      text += `💀 ${result.monsterName} #${result.slotIndex + 1} falls!\n`;
    }
    text += `Encounter HP: **${result.monsterHp}/${result.monsterMaxHp}**`;
  }

  await message.channel.send(text);

  if (result.monsterTurns && result.monsterTurns.length > 0) {
    const monsterText = result.monsterTurns.map(formatMonsterTurn).join('\n');
    await message.channel.send(`🌙 **Monster turns**\n${monsterText}`);
  }

  const encounter = getActiveEncounter(message.guild.id, message.channel.id);
  if (encounter) {
    const current = getCurrentActor(encounter.id);
    if (current) {
      await message.channel.send(`⏳ **Current turn:** ${current.name}`);
    }
  }

  if (result.defeated) {
    const awarded = result.awarded || [];
    const lines = awarded.map((a) => `- ${a.name}: +${a.xp} XP (total ${a.totalXp.toLocaleString()})`);

    await message.channel.send(
      `🎉 **All monsters are defeated!**\n` +
      (awarded.length > 1 ? 'Party bonus applied. ' : '') +
      `XP awarded:\n${lines.join('\n') || 'No participants to reward.'}`
    );
  }
}

async function turnStatusCommand(message) {
  const encounter = getActiveEncounter(message.guild.id, message.channel.id);
  if (!encounter) {
    return message.reply('❌ There is no active encounter in this channel.');
  }

  const initiative = getInitiativeOrder(encounter.id);
  const current = getCurrentActor(encounter.id);

  const lines = initiative.map((a, i) => {
    const isCurrent = a.actor_type === encounter.current_turn_type && a.actor_id === encounter.current_actor_id;
    return `${isCurrent ? '➡️' : `${i + 1}.`} ${a.name} (${a.initiative_score})`;
  });

  let text = `🎲 **Round ${encounter.round}** — Initiative order\n${lines.join('\n')}`;
  if (current) {
    text += `\n\n⏳ **Current turn:** ${current.name}`;
  }

  await message.channel.send(text);
}

async function monsterStatusCommand(message) {
  const encounter = getActiveEncounter(message.guild.id, message.channel.id);
  if (!encounter) {
    return message.reply('❌ There is no active encounter in this channel.');
  }

  const { getEncounterMonsters } = require('../lib/dnd-party');
  const monster = getMonster(encounter.monster_key);
  const monsters = getEncounterMonsters(encounter.id);
  const monsterLines = monsters.map((m) => {
    const marker = m.status === 'alive' ? '🟥' : '💀';
    return `${marker} ${m.monster_name} #${m.slot_index + 1}: HP ${m.monster_hp}/${m.monster_max_hp}`;
  });

  const participants = getEncounterParticipants(encounter.id);
  const participantLines = participants.map((p) => {
    const char = getCharacter(message.guild.id, p.user_id);
    return `- ${char ? char.name : `<@${p.user_id}>`}: ${p.damage_dealt} damage`;
  });

  const initiative = getInitiativeOrder(encounter.id);
  const initiativeLines = initiative.map((a, i) => {
    const marker = a.actor_type === encounter.current_turn_type && a.actor_id === encounter.current_actor_id ? '➡️' : `${i + 1}.`;
    return `${marker} ${a.name} (${a.initiative_score})`;
  });

  let text =
    `👹 **${encounter.monster_name}** — EL **${encounter.encounter_level}** | CR each **${formatCr(encounter.monster_cr)}** | Round **${encounter.round}**\n` +
    `${monster.description}\n\n` +
    `**Monsters**\n${monsterLines.join('\n')}\n\n` +
    `**Participants**\n${participantLines.join('\n') || 'No attacks yet.'}\n\n` +
    `**Initiative order**\n${initiativeLines.join('\n')}`;

  await message.channel.send(text);
}

async function endEncounterCommand(message) {
  if (!isAdmin(message)) {
    return message.reply('❌ Only server administrators can end an encounter.');
  }

  const encounter = getActiveEncounter(message.guild.id, message.channel.id);
  if (!encounter) {
    return message.reply('❌ There is no active encounter in this channel.');
  }

  db.prepare("UPDATE dnd_encounters SET status = 'ended' WHERE id = ?").run(encounter.id);
  await message.channel.send(`👹 Encounter against **${encounter.monster_name}** has been ended by the DM.`);
}

async function listMonstersCommand(message, args) {
  const { listByDifficulty } = require('../lib/dnd-monsters');
  const difficulty = args[0]?.toLowerCase();
  const validDifficulties = ['easy', 'medium', 'hard', 'boss'];

  const formatCr = (cr) => (cr < 1 ? `1/${Math.round(1 / cr)}` : cr.toString());

  if (difficulty && validDifficulties.includes(difficulty)) {
    const monsters = listByDifficulty(difficulty);
    const lines = monsters.map((m) => `- \`${m.key}\`: ${m.name} (CR ${formatCr(m.cr)}, HP ${m.hp}, AC ${m.ac}, XP ${m.xp})`);
    await message.channel.send(`👹 **${difficulty[0].toUpperCase() + difficulty.slice(1)} monsters**\n${lines.join('\n')}`);
    return;
  }

  const allLines = validDifficulties.map((d) => {
    const monsters = listByDifficulty(d);
    const header = `${d[0].toUpperCase() + d.slice(1)} (${monsters.length})`;
    const lines = monsters.map((m) => `- \`${m.key}\`: ${m.name} (CR ${formatCr(m.cr)})`);
    return `**${header}**\n${lines.join('\n')}`;
  });

  await message.channel.send(`👹 **Monster manual**\n${allLines.join('\n\n')}\n\nUse \`!dnd monsters <easy|medium|hard|boss>\` for details.`);
}

module.exports = {
  name: 'dnd',
  description: 'D&D 3.5e character system. Use !dnd create to start.',
  async execute(message, args) {
    if (!isDndChannel(message)) {
      return message.reply(`🛡️ D&D commands can only be used in #${DND_CHANNEL_NAME}.`);
    }

    const subcommand = args.shift()?.toLowerCase();

    switch (subcommand) {
      case 'create':
        await startCreate(message, args);
        break;
      case 'assign':
        await handleCreateStep(message, args);
        break;
      case 'sheet':
        await showSheet(message);
        break;
      case 'roll':
        await rollAbility(message, args);
        break;
      case 'attack':
        await rollAttack(message);
        break;
      case 'save':
        await rollSave(message, args);
        break;
      case 'skill':
        await rollSkill(message, args);
        break;
      case 'skills':
        await showSkillsList(message);
        break;
      case 'hp':
        await adjustHpCommand(message, args);
        break;
      case 'rest':
        await restCommand(message);
        break;
      case 'inventory':
      case 'inv':
        await showInventory(message);
        break;
      case 'add':
        await addItemCommand(message, args, false);
        break;
      case 'remove':
        await removeItemCommand(message, args);
        break;
      case 'give':
        await addItemCommand(message, args, true);
        break;
      case 'spells':
        await showSpells(message);
        break;
      case 'cast':
        await castSpellCommand(message, args);
        break;
      case 'dc':
        await spellDcCommand(message, args);
        break;
      case 'give-spell':
        await adminAddSpell(message, args);
        break;
      case 'party':
        await handlePartySubcommand(message, args);
        break;
      case 'encounter':
        await encounterStart(message, args);
        break;
      case 'attack-monster':
        await attackMonsterCommand(message);
        break;
      case 'monster-status':
        await monsterStatusCommand(message);
        break;
      case 'turn-status':
        await turnStatusCommand(message);
        break;
      case 'end-encounter':
        await endEncounterCommand(message);
        break;
      case 'monsters':
        await listMonstersCommand(message, args);
        break;
      case 'classes':
        await message.channel.send(`**Available classes**\n${classListText()}`);
        break;
      case 'races':
        await message.channel.send(`**Available races**\n${raceListText()}`);
        break;
      case 'alignments':
        await message.channel.send(`**Available alignments**\n${alignmentListText()}`);
        break;
      case 'help':
        await showHelp(message);
        break;
      case 'heal':
        await adminHeal(message, args);
        break;
      case 'damage':
        await adminDamage(message, args);
        break;
      case 'levelup':
        await adminLevelUp(message, args);
        break;
      case 'setxp':
        await adminSetXp(message, args);
        break;
      case 'retire':
      case 'reset':
        await adminReset(message);
        break;
      default:
        await message.reply(
          '❌ Unknown D&D command. Available: `create`, `assign`, `sheet`, `roll`, `attack`, `save`, `skill`, `skills`, `hp`, `rest`, `inventory`, `add`, `remove`, `spells`, `cast`, `dc`, `classes`, `races`, `help`.\n' +
          'Party: `party create|join|leave|status|list|disband`. Encounters: `encounter [monster] [count]`, `attack-monster`, `monster-status`, `turn-status`, `end-encounter`, `monsters`.\n' +
          'Admin: `heal`, `damage`, `give`, `give-spell`, `setxp`, `retire`.'
        );
    }
  },
};

async function handlePartySubcommand(message, args) {
  const action = args.shift()?.toLowerCase();
  switch (action) {
    case 'create':
      await partyCreate(message, args);
      break;
    case 'join':
      await partyJoin(message, args);
      break;
    case 'leave':
      await partyLeave(message);
      break;
    case 'status':
      await partyStatus(message);
      break;
    case 'list':
      await partyList(message);
      break;
    case 'disband':
      await partyDisband(message);
      break;
    default:
      await message.reply(
        '❌ Unknown party command. Use `create`, `join`, `leave`, `status`, `list`, or `disband`.'
      );
  }
}
