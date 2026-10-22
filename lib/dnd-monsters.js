// Simplified D&D 3.5e monster/NPC stats for RaspBot.

const MONSTERS = {
  // Easy (10)
  goblin: {
    name: 'Goblin',
    difficulty: 'easy',
    cr: 0.33,
    hp: 5,
    ac: 15,
    bab: 0,
    damage: '1d4',
    damageBonus: 0,
    attackStat: 'dex',
    fortitude: 2,
    reflex: 2,
    will: -1,
    xp: 50,
    description: 'A small, green humanoid with a rusty dagger.',
  },
  kobold: {
    name: 'Kobold',
    difficulty: 'easy',
    cr: 0.25,
    hp: 4,
    ac: 15,
    bab: 0,
    damage: '1d4',
    damageBonus: -1,
    attackStat: 'dex',
    fortitude: 1,
    reflex: 2,
    will: 1,
    xp: 50,
    description: 'A diminutive reptilian humanoid with a spear.',
  },
  'giant-rat': {
    name: 'Giant Rat',
    difficulty: 'easy',
    cr: 0.125,
    hp: 6,
    ac: 14,
    bab: 1,
    damage: '1d4',
    damageBonus: 0,
    attackStat: 'str',
    fortitude: 2,
    reflex: 2,
    will: 1,
    xp: 50,
    description: 'An oversized, mangy rat with sharp teeth.',
  },
  skeleton: {
    name: 'Skeleton',
    difficulty: 'easy',
    cr: 0.33,
    hp: 6,
    ac: 13,
    bab: 0,
    damage: '1d6',
    damageBonus: 1,
    attackStat: 'str',
    fortitude: 0,
    reflex: 1,
    will: 2,
    xp: 75,
    description: 'Animated bones wielding a broken scimitar.',
  },
  'giant-bee': {
    name: 'Giant Bee',
    difficulty: 'easy',
    cr: 0.5,
    hp: 5,
    ac: 14,
    bab: 1,
    damage: '1d4',
    damageBonus: 0,
    attackStat: 'dex',
    fortitude: 2,
    reflex: 2,
    will: 0,
    xp: 50,
    description: 'A bee the size of a cat with a venomous stinger.',
  },
  bandit: {
    name: 'Bandit',
    cr: 0.5,
    difficulty: 'easy',
    cr: 0.5,
    hp: 7,
    ac: 12,
    bab: 0,
    damage: '1d6',
    damageBonus: 1,
    attackStat: 'str',
    fortitude: 2,
    reflex: 0,
    will: 0,
    xp: 75,
    description: 'A rough-looking human with a club and ill intent.',
  },
  'giant-spider': {
    name: 'Giant Spider',
    difficulty: 'easy',
    cr: 0.5,
    hp: 8,
    ac: 14,
    bab: 1,
    damage: '1d4',
    damageBonus: 0,
    attackStat: 'dex',
    fortitude: 2,
    reflex: 3,
    will: 0,
    xp: 75,
    description: 'A hairy spider as large as a dog.',
  },
  'giant-ant': {
    name: 'Giant Ant',
    difficulty: 'easy',
    cr: 0.5,
    hp: 8,
    ac: 15,
    bab: 1,
    damage: '1d4',
    damageBonus: 1,
    attackStat: 'str',
    fortitude: 3,
    reflex: 1,
    will: 0,
    xp: 75,
    description: 'A chittering ant the size of a small pony.',
  },
  'dire-badger': {
    name: 'Dire Badger',
    difficulty: 'easy',
    cr: 1,
    hp: 9,
    ac: 14,
    bab: 1,
    damage: '1d6',
    damageBonus: 1,
    attackStat: 'str',
    fortitude: 3,
    reflex: 1,
    will: 1,
    xp: 100,
    description: 'A furious badger grown to monstrous size.',
  },
  'fire-beetle': {
    name: 'Fire Beetle',
    difficulty: 'easy',
    cr: 0.33,
    hp: 7,
    ac: 13,
    bab: 1,
    damage: '1d4',
    damageBonus: 1,
    attackStat: 'str',
    fortitude: 2,
    reflex: 1,
    will: 0,
    xp: 50,
    description: 'A beetle whose glands glow with inner heat.',
  },

  // Medium (10)
  orc: {
    name: 'Orc',
    difficulty: 'medium',
    cr: 0.5,
    hp: 12,
    ac: 13,
    bab: 2,
    damage: '1d8',
    damageBonus: 2,
    attackStat: 'str',
    fortitude: 3,
    reflex: 0,
    will: 0,
    xp: 150,
    description: 'A muscular humanoid with a greataxe.',
  },
  hobgoblin: {
    name: 'Hobgoblin',
    difficulty: 'medium',
    cr: 1,
    hp: 13,
    ac: 15,
    bab: 2,
    damage: '1d8',
    damageBonus: 1,
    attackStat: 'str',
    fortitude: 2,
    reflex: 1,
    will: 0,
    xp: 150,
    description: 'A disciplined goblinoid warrior in crude armor.',
  },
  lizardfolk: {
    name: 'Lizardfolk',
    difficulty: 'medium',
    cr: 1,
    hp: 14,
    ac: 15,
    bab: 2,
    damage: '1d8',
    damageBonus: 2,
    attackStat: 'str',
    fortitude: 3,
    reflex: 1,
    will: 0,
    xp: 150,
    description: 'A scaly humanoid wielding a club and shield.',
  },
  bugbear: {
    name: 'Bugbear',
    difficulty: 'medium',
    cr: 2,
    hp: 18,
    ac: 14,
    bab: 3,
    damage: '1d8',
    damageBonus: 3,
    attackStat: 'str',
    fortitude: 3,
    reflex: 1,
    will: 0,
    xp: 200,
    description: 'A hulking goblinoid ambusher with a morningstar.',
  },
  ghoul: {
    name: 'Ghoul',
    difficulty: 'medium',
    cr: 1,
    hp: 16,
    ac: 14,
    bab: 2,
    damage: '1d6',
    damageBonus: 1,
    attackStat: 'str',
    fortitude: 1,
    reflex: 3,
    will: 3,
    xp: 200,
    description: 'A ravenous undead with filthy claws.',
  },
  harpy: {
    name: 'Harpy',
    difficulty: 'medium',
    cr: 4,
    hp: 15,
    ac: 13,
    bab: 2,
    damage: '1d8',
    damageBonus: 1,
    attackStat: 'dex',
    fortitude: 2,
    reflex: 3,
    will: 2,
    xp: 200,
    description: 'A winged creature with a wicked talon strike.',
  },
  werewolf: {
    name: 'Werewolf',
    difficulty: 'medium',
    cr: 3,
    hp: 20,
    ac: 14,
    bab: 3,
    damage: '1d6',
    damageBonus: 2,
    attackStat: 'str',
    fortitude: 4,
    reflex: 3,
    will: 1,
    xp: 250,
    description: 'A cursed humanoid in hybrid wolf form.',
  },
  minotaur: {
    name: 'Minotaur',
    difficulty: 'medium',
    cr: 4,
    hp: 26,
    ac: 14,
    bab: 4,
    damage: '1d8',
    damageBonus: 4,
    attackStat: 'str',
    fortitude: 5,
    reflex: 1,
    will: 2,
    xp: 300,
    description: 'A bull-headed brute armed with a greataxe.',
  },
  manticore: {
    name: 'Manticore',
    difficulty: 'medium',
    cr: 5,
    hp: 24,
    ac: 15,
    bab: 3,
    damage: '1d8',
    damageBonus: 3,
    attackStat: 'str',
    fortitude: 4,
    reflex: 3,
    will: 1,
    xp: 300,
    description: 'A winged lion with a spiked tail and claws.',
  },
  wyvern: {
    name: 'Wyvern',
    difficulty: 'medium',
    cr: 6,
    hp: 28,
    ac: 15,
    bab: 4,
    damage: '1d8',
    damageBonus: 3,
    attackStat: 'str',
    fortitude: 4,
    reflex: 3,
    will: 1,
    xp: 350,
    description: 'A two-legged dragon with a venomous stinger.',
  },

  // Hard (6)
  troll: {
    name: 'Troll',
    difficulty: 'hard',
    cr: 5,
    hp: 42,
    ac: 16,
    bab: 5,
    damage: '1d8',
    damageBonus: 5,
    attackStat: 'str',
    fortitude: 7,
    reflex: 2,
    will: 2,
    xp: 500,
    description: 'A lanky regenerating giant with rending claws.',
  },
  gargoyle: {
    name: 'Gargoyle',
    difficulty: 'hard',
    cr: 4,
    hp: 38,
    ac: 16,
    bab: 4,
    damage: '1d6',
    damageBonus: 3,
    attackStat: 'str',
    fortitude: 4,
    reflex: 4,
    will: 4,
    xp: 450,
    description: 'A living stone statue with cruel claws.',
  },
  hillgiant: {
    name: 'Hill Giant',
    difficulty: 'hard',
    cr: 7,
    hp: 45,
    ac: 15,
    bab: 6,
    damage: '2d6',
    damageBonus: 5,
    attackStat: 'str',
    fortitude: 7,
    reflex: 1,
    will: 2,
    xp: 600,
    description: 'A towering giant swinging a massive club.',
  },
  chimera: {
    name: 'Chimera',
    difficulty: 'hard',
    cr: 7,
    hp: 44,
    ac: 15,
    bab: 5,
    damage: '1d8',
    damageBonus: 4,
    attackStat: 'str',
    fortitude: 6,
    reflex: 3,
    will: 3,
    xp: 550,
    description: 'A three-headed beast of lion, goat, and dragon.',
  },
  mindflayer: {
    name: 'Mind Flayer',
    difficulty: 'hard',
    cr: 8,
    hp: 36,
    ac: 16,
    bab: 3,
    damage: '1d6',
    damageBonus: 2,
    attackStat: 'dex',
    fortitude: 2,
    reflex: 4,
    will: 6,
    xp: 500,
    description: 'A tentacled humanoid that hungers for minds.',
  },
  behir: {
    name: 'Behir',
    difficulty: 'hard',
    cr: 8,
    hp: 52,
    ac: 16,
    bab: 6,
    damage: '1d8',
    damageBonus: 5,
    attackStat: 'str',
    fortitude: 7,
    reflex: 3,
    will: 3,
    xp: 650,
    description: 'A serpentine dragon-like predator that spits lightning.',
  },

  // Bosses (4)
  'young-red-dragon': {
    name: 'Young Red Dragon',
    difficulty: 'boss',
    cr: 10,
    hp: 80,
    ac: 18,
    bab: 8,
    damage: '2d6',
    damageBonus: 6,
    attackStat: 'str',
    fortitude: 8,
    reflex: 5,
    will: 7,
    xp: 1500,
    description: 'A cruel red wyrm whose breath is molten flame.',
  },
  lich: {
    name: 'Lich',
    difficulty: 'boss',
    cr: 13,
    hp: 60,
    ac: 18,
    bab: 5,
    damage: '1d8',
    damageBonus: 3,
    attackStat: 'dex',
    fortitude: 2,
    reflex: 4,
    will: 9,
    xp: 2000,
    description: 'An undead archmage bound to a phylactery.',
  },
  beholder: {
    name: 'Beholder',
    difficulty: 'boss',
    cr: 13,
    hp: 75,
    ac: 19,
    bab: 4,
    damage: '1d8',
    damageBonus: 3,
    attackStat: 'dex',
    fortitude: 4,
    reflex: 5,
    will: 9,
    xp: 1800,
    description: 'A floating orb of flesh with eye rays of annihilation.',
  },
  'pit-fiend': {
    name: 'Pit Fiend',
    difficulty: 'boss',
    cr: 20,
    hp: 90,
    ac: 20,
    bab: 10,
    damage: '2d8',
    damageBonus: 8,
    attackStat: 'str',
    fortitude: 10,
    reflex: 6,
    will: 8,
    xp: 2500,
    description: 'A towering devil lord of the Nine Hells.',
  },
};

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard', 'boss'];

function getMonster(key) {
  return MONSTERS[key.toLowerCase()] || null;
}

function listByDifficulty(difficulty) {
  return Object.entries(MONSTERS)
    .filter(([, m]) => m.difficulty === difficulty)
    .map(([key, m]) => ({ key, ...m }));
}

function rollDamage(diceExpr, bonus = 0) {
  if (!diceExpr) return bonus;
  const match = diceExpr.match(/^(\d+)d(\d+)$/);
  if (!match) return bonus;

  const count = parseInt(match[1], 10);
  const faces = parseInt(match[2], 10);
  let total = 0;
  for (let i = 0; i < count; i++) {
    total += Math.floor(Math.random() * faces) + 1;
  }
  return Math.max(1, total + bonus);
}

// Random encounter generation scaled to a party level.
function pickRandomEncounter(partyLevel, desiredDifficulty = null) {
  const candidates = Object.entries(MONSTERS).map(([key, m]) => ({ key, ...m }));

  // Build encounter options: single monsters and small groups.
  const options = [];
  for (const monster of candidates) {
    for (let count = 1; count <= 8; count++) {
      const crs = Array(count).fill(monster.cr);
      const el = calculateEncounterLevelProxy(crs);
      const totalXp = monster.xp * count;
      options.push({
        monster,
        count,
        el,
        totalXp,
        difficulty: estimateDifficultyProxy(el, partyLevel),
      });
    }
  }

  let pool = options;
  if (desiredDifficulty) {
    pool = options.filter((o) => o.difficulty.toLowerCase() === desiredDifficulty.toLowerCase());
  }

  // Keep only encounters that make sense for the party:
  // - EL between partyLevel - 1 and partyLevel + 1 for an exciting but fair fight
  pool = pool.filter((o) => o.el >= partyLevel - 1 && o.el <= partyLevel + 1);

  if (pool.length === 0) {
    // Fall back to single monsters whose CR is in the same band.
    pool = options.filter((o) => o.count === 1 && o.el >= partyLevel - 1 && o.el <= partyLevel + 1);
  }
  if (pool.length === 0) {
    // Last resort: nearest single monster.
    const singles = options.filter((o) => o.count === 1);
    singles.sort((a, b) => Math.abs(a.el - partyLevel) - Math.abs(b.el - partyLevel));
    pool = singles.slice(0, 10);
  }

  // Prefer encounters close to the party level; penalise extreme counts and swarms of trivial monsters.
  const weighted = pool.map((o) => {
    const elDiff = Math.abs(o.el - partyLevel);
    const countPenalty = o.count > 6 ? 4 : o.count > 4 ? 2 : 0;
    const smallSwarmPenalty = partyLevel >= 4 && o.monster.cr < 1 ? 8 : 0;
    const weight = Math.max(1, 12 - elDiff * 2 - countPenalty - smallSwarmPenalty);
    return { ...o, weight };
  });

  const totalWeight = weighted.reduce((sum, o) => sum + o.weight, 0);
  let pick = Math.random() * totalWeight;
  for (const o of weighted) {
    pick -= o.weight;
    if (pick <= 0) return o;
  }
  return weighted[weighted.length - 1];
}

// Tiny inlined copies of the EL/difficulty helpers so this module stays self-contained
// when generating encounters without importing dnd-rules (avoids circular risk).
function calculateEncounterLevelProxy(crValues) {
  if (crValues.length === 0) return 0;
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

function estimateDifficultyProxy(encounterLevel, partyLevel) {
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
  MONSTERS,
  DIFFICULTY_ORDER,
  getMonster,
  listByDifficulty,
  rollDamage,
  pickRandomEncounter,
};
