const { CLASSES, ABILITY_NAMES, getSpellSlots } = require('./dnd-data');

function rollDie(faces) {
  return Math.floor(Math.random() * faces) + 1;
}

function rollDice(count, faces) {
  const rolls = [];
  for (let i = 0; i < count; i++) {
    rolls.push(rollDie(faces));
  }
  return rolls;
}

function roll4d6DropLowest() {
  // Roll 7 sets of 4d6 and drop the lowest resulting stat.
  const sets = [];
  for (let i = 0; i < 7; i++) {
    const rolls = rollDice(4, 6);
    const sorted = [...rolls].sort((a, b) => a - b);
    sorted.shift(); // drop the lowest single die
    const total = sorted.reduce((a, b) => a + b, 0);
    sets.push({ rolls, total });
  }

  // Sort ascending by total and discard the lowest set.
  sets.sort((a, b) => a.total - b.total);
  const discarded = sets.shift();

  const stats = sets.map((s) => s.total);
  const allRolls = sets.map((s) => s.rolls);

  return { stats, rolls: allRolls, discarded: discarded.rolls, discardedTotal: discarded.total };
}

function abilityModifier(score) {
  return Math.floor((score - 10) / 2);
}

function formatModifier(mod) {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

// 3.5e point buy table. Costs are cumulative from 8.
const POINT_BUY_COSTS = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 6, 15: 8, 16: 10, 17: 13, 18: 16,
};

function pointBuyCost(score) {
  if (score < 8 || score > 18) return null;
  return POINT_BUY_COSTS[score];
}

function validatePointBuy25(scores) {
  const values = ABILITY_NAMES.map((a) => scores[a]);
  if (values.some((s) => s < 8 || s > 18)) {
    return { valid: false, error: 'All scores must be between 8 and 18.' };
  }

  const totalCost = values.reduce((sum, s) => sum + pointBuyCost(s), 0);
  if (totalCost > 25) {
    return { valid: false, error: `Point-buy cost is ${totalCost}, maximum is 25.` };
  }
  return { valid: true, cost: totalCost, remaining: 25 - totalCost };
}

function babForLevel(level, progression) {
  if (progression === 'fast') return level;
  if (progression === 'medium') return Math.floor(level * 0.75);
  return Math.floor(level * 0.5);
}

function saveForLevel(level, progression) {
  if (progression === 'good') return 2 + Math.floor(level / 2);
  return Math.floor(level / 3);
}

function hpForLevel(level, hitDie, conMod) {
  // Level 1: max hit die + con mod.
  // Subsequent levels: average rounded up + con mod.
  let total = hitDie + conMod;
  const avg = Math.ceil((hitDie + 1) / 2);
  for (let i = 2; i <= level; i++) {
    total += Math.max(1, avg + conMod);
  }
  return total;
}

function skillPointsForLevel(level, classKey, intMod, isFirstLevel = false) {
  const cls = CLASSES[classKey];
  if (!cls) return 0;
  // 3.5e: (skillPointsPerLevel + intMod) * 4 at first level, then skillPointsPerLevel + intMod.
  const base = Math.max(1, cls.skillPointsPerLevel + intMod);
  if (isFirstLevel) return base * 4;
  return base;
}

function getClassProgression(classKey, level) {
  const cls = CLASSES[classKey];
  if (!cls) return null;
  return {
    bab: babForLevel(level, cls.babProgression),
    fortitude: saveForLevel(level, cls.saveProgression.fortitude),
    reflex: saveForLevel(level, cls.saveProgression.reflex),
    will: saveForLevel(level, cls.saveProgression.will),
    hitDie: cls.hitDie,
    caster: cls.caster,
    castingStat: cls.castingStat,
    classSkills: cls.classSkills,
    spellSlots: getSpellSlots(classKey, level),
  };
}

function getArmorClass(dexMod, armorBonus = 0) {
  return 10 + dexMod + armorBonus;
}

function d20Roll(bonus = 0, label = '') {
  const die = rollDie(20);
  const total = die + bonus;
  return { die, bonus, total, label };
}

function formatD20Roll(roll) {
  const mod = formatModifier(roll.bonus);
  return `d20 (${roll.die}) ${mod}${roll.label ? ` ${roll.label}` : ''} = **${roll.total}**`;
}

// ---------- Initiative helpers ----------

function rollInitiative(bonus = 0) {
  return d20Roll(bonus, 'initiative');
}

function calculatePlayerInitiativeBonus(character) {
  return abilityModifier(character.dex);
}

function calculateMonsterInitiativeBonus(monster) {
  // Use the monster's attack stat (STR or DEX) for the initiative modifier.
  const stat = monster.attackStat || 'str';
  const score = stat === 'dex' ? monster.bab * 2 + 10 : monster.bab * 2 + 10;
  return abilityModifier(score);
}

// ---------- DC (Difficulty Class) helpers ----------

function calculateSpellDc(character, spellLevel) {
  const cls = CLASSES[character.class.toLowerCase()];
  const castingStat = cls?.castingStat;
  if (!castingStat) {
    throw new Error(`${character.class} is not a spellcasting class.`);
  }
  const mod = abilityModifier(character[castingStat]);
  return 10 + spellLevel + mod;
}

function calculateSaveDc(character, base = 10, stat = 'wis') {
  return base + abilityModifier(character[stat]);
}

function calculateMonsterDc(monster, base = 10) {
  // Simplified: DC driven by monster CR, e.g. 10 + half CR rounded up.
  const cr = monster.cr || 0;
  return base + Math.ceil(cr / 2);
}

// ---------- CR / Encounter Level helpers ----------

// Sort CRs descending and compute EL per 3.5e guidelines:
// - Each monster at CR >= highest-3 contributes its full CR value.
// - Multiple equal-CR monsters: 2 = +2, 3-4 = +3, 5-6 = +4, 7-8 = +5, etc.
function calculateEncounterLevel(crValues) {
  if (crValues.length === 0) return 0;

  // 3.5e encounter level rules for mixed-CR groups:
  // Sort descending, then walk from the highest CR, pairing/equating monsters
  // using the standard table: 2 of same CR = CR+2, 4 = CR+4, 8 = CR+6, etc.
  // For different CRs, combine two lowest until only one remains, adding 2 EL
  // each time a pair of equal-CR or adjacent monsters is merged.
  const values = [...crValues].sort((a, b) => a - b);

  while (values.length > 1) {
    const a = values.shift();
    const b = values.shift();
    const combined = Math.max(a, b) + 2;
    values.push(combined);
    values.sort((x, y) => x - y);
  }

  return values[0];
}

function calculatePartyLevel(levels) {
  if (levels.length === 0) return 0;
  const sum = levels.reduce((a, b) => a + b, 0);
  return Math.round(sum / levels.length);
}

function estimateDifficulty(encounterLevel, partyLevel) {
  const diff = encounterLevel - partyLevel;
  if (diff <= -3) return 'Very Easy';
  if (diff === -2) return 'Easy';
  if (diff === -1) return 'Average';
  if (diff === 0) return 'Challenging';
  if (diff === 1) return 'Hard';
  if (diff === 2) return 'Very Hard';
  return 'Deadly';
}

module.exports = {
  rollDie,
  rollDice,
  roll4d6DropLowest,
  abilityModifier,
  formatModifier,
  pointBuyCost,
  validatePointBuy25,
  babForLevel,
  saveForLevel,
  hpForLevel,
  skillPointsForLevel,
  getClassProgression,
  getArmorClass,
  d20Roll,
  formatD20Roll,
  rollInitiative,
  calculatePlayerInitiativeBonus,
  calculateMonsterInitiativeBonus,
  calculateSpellDc,
  calculateSaveDc,
  calculateMonsterDc,
  calculateEncounterLevel,
  calculatePartyLevel,
  estimateDifficulty,
};
