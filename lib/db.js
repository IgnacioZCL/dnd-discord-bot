const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true, mode: 0o755 });
  }
} catch (error) {
  console.error(`Failed to create database directory ${dataDir}:`, error);
  throw error;
}

const dbPath = process.env.DND_DB_PATH || path.join(dataDir, 'dnd.db');

// Log the resolved database path to aid debugging permission issues.
console.log(`[db] Opening SQLite database at: ${dbPath}`);

let db;
try {
  db = new Database(dbPath);
} catch (error) {
  console.error(`[db] Failed to open SQLite database at ${dbPath}:`, error);
  throw error;
}

// Enable WAL for better concurrency and performance.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// D&D campaign per Discord server.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_campaigns (
    guild_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// D&D characters: one active character per user per guild in MVP.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_characters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    race TEXT NOT NULL,
    class TEXT NOT NULL,
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    hp INTEGER NOT NULL,
    max_hp INTEGER NOT NULL,
    ac INTEGER NOT NULL,
    alignment TEXT,
    str INTEGER NOT NULL,
    dex INTEGER NOT NULL,
    con INTEGER NOT NULL,
    int INTEGER NOT NULL,
    wis INTEGER NOT NULL,
    cha INTEGER NOT NULL,
    bab INTEGER NOT NULL DEFAULT 0,
    fortitude INTEGER NOT NULL DEFAULT 0,
    reflex INTEGER NOT NULL DEFAULT 0,
    will INTEGER NOT NULL DEFAULT 0,
    hit_dice TEXT NOT NULL,
    skill_points_remaining INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(guild_id, user_id, status)
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_dnd_characters_guild_user
  ON dnd_characters(guild_id, user_id);
`);

// Character skills (ranks assigned by player/level-up).
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_character_skills (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    skill TEXT NOT NULL,
    ranks INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (character_id) REFERENCES dnd_characters(id) ON DELETE CASCADE,
    UNIQUE(character_id, skill)
  );
`);

// Character inventory.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_character_inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    item TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    FOREIGN KEY (character_id) REFERENCES dnd_characters(id) ON DELETE CASCADE
  );
`);

// Character spells.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_character_spells (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    character_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    level INTEGER NOT NULL,
    prepared INTEGER NOT NULL DEFAULT 0,
    uses_left INTEGER,
    FOREIGN KEY (character_id) REFERENCES dnd_characters(id) ON DELETE CASCADE
  );
`);

// Roll log.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_roll_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    character_id INTEGER,
    roll_type TEXT NOT NULL,
    formula TEXT NOT NULL,
    dice_rolls TEXT NOT NULL,
    total INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (character_id) REFERENCES dnd_characters(id) ON DELETE SET NULL
  );
`);

// D&D parties within a guild.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    leader_user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_dnd_parties_guild
  ON dnd_parties(guild_id, status);
`);

// Party members.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_party_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    party_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id) REFERENCES dnd_parties(id) ON DELETE CASCADE,
    UNIQUE(party_id, user_id)
  );
`);

// Encounters (party vs monster(s)) per channel.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_encounters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    party_id INTEGER,
    monster_key TEXT NOT NULL,
    monster_name TEXT NOT NULL,
    monster_count INTEGER NOT NULL DEFAULT 1,
    monster_hp INTEGER NOT NULL,
    monster_max_hp INTEGER NOT NULL,
    monster_ac INTEGER NOT NULL,
    monster_bab INTEGER NOT NULL DEFAULT 0,
    monster_damage TEXT,
    monster_xp INTEGER NOT NULL DEFAULT 0,
    monster_cr REAL,
    encounter_level REAL,
    round INTEGER NOT NULL DEFAULT 1,
    current_turn_type TEXT,
    current_actor_id TEXT,
    initiative_started INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (party_id) REFERENCES dnd_parties(id) ON DELETE SET NULL
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_dnd_encounters_channel
  ON dnd_encounters(guild_id, channel_id, status);
`);

// Multiple monsters within a single encounter share the same stats.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_encounter_monsters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL,
    slot_index INTEGER NOT NULL,
    monster_name TEXT NOT NULL,
    monster_hp INTEGER NOT NULL,
    monster_max_hp INTEGER NOT NULL,
    monster_ac INTEGER NOT NULL,
    monster_bab INTEGER NOT NULL DEFAULT 0,
    monster_damage TEXT,
    monster_xp INTEGER NOT NULL DEFAULT 0,
    monster_cr REAL,
    status TEXT NOT NULL DEFAULT 'alive',
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (encounter_id) REFERENCES dnd_encounters(id) ON DELETE CASCADE,
    UNIQUE(encounter_id, slot_index)
  );
`);

// Encounter participants and their damage dealt.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_encounter_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    character_id INTEGER NOT NULL,
    damage_dealt INTEGER NOT NULL DEFAULT 0,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (encounter_id) REFERENCES dnd_encounters(id) ON DELETE CASCADE,
    FOREIGN KEY (character_id) REFERENCES dnd_characters(id) ON DELETE CASCADE,
    UNIQUE(encounter_id, user_id)
  );
`);

// Initiative order for turn-based combat.
db.exec(`
  CREATE TABLE IF NOT EXISTS dnd_encounter_initiative (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    encounter_id INTEGER NOT NULL,
    actor_type TEXT NOT NULL, -- 'player' or 'monster'
    actor_id TEXT NOT NULL,   -- user_id or monster slot id
    initiative_score INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY (encounter_id) REFERENCES dnd_encounters(id) ON DELETE CASCADE,
    UNIQUE(encounter_id, actor_type, actor_id)
  );
`);

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_dnd_encounter_initiative_encounter
  ON dnd_encounter_initiative(encounter_id, initiative_score DESC);
`);

// Migration: add encounter difficulty columns if they do not exist.
try {
  db.exec(`ALTER TABLE dnd_encounters ADD COLUMN monster_cr REAL`);
} catch (_) {
  // Column already exists.
}
try {
  db.exec(`ALTER TABLE dnd_encounters ADD COLUMN encounter_level REAL`);
} catch (_) {
  // Column already exists.
}
try {
  db.exec(`ALTER TABLE dnd_encounters ADD COLUMN monster_count INTEGER NOT NULL DEFAULT 1`);
} catch (_) {
  // Column already exists.
}

// Migration: add missing timestamp columns to dnd_encounter_monsters on existing DBs.
try {
  db.exec(`ALTER TABLE dnd_encounter_monsters ADD COLUMN created_at DATETIME`);
} catch (_) {
  // Column already exists.
}
try {
  db.exec(`ALTER TABLE dnd_encounter_monsters ADD COLUMN updated_at DATETIME`);
} catch (_) {
  // Column already exists.
}

// Migration: add turn-based combat columns to dnd_encounters on existing DBs.
const encounterTurnColumns = [
  'round INTEGER NOT NULL DEFAULT 1',
  'current_turn_type TEXT',
  'current_actor_id TEXT',
  'initiative_started INTEGER NOT NULL DEFAULT 0',
];
for (const col of encounterTurnColumns) {
  try {
    db.exec(`ALTER TABLE dnd_encounters ADD COLUMN ${col}`);
  } catch (_) {
    // Column already exists.
  }
}

module.exports = db;
