# dnd-discord-bot

Discord bot for D&D 3.5e helper commands, originally split from RaspBot.

## Commands

- `!dnd create <name> <race> <class>` — create a character
- `!dnd sheet` — show your full character sheet
- `!dnd roll <str|dex|con|int|wis|cha>` — ability check
- `!dnd attack` — attack roll
- `!dnd save <fort|ref|will>` — saving throw
- `!dnd skill <skill name>` — skill check
- `!dnd hp <+/-amount>` — adjust HP
- `!dnd rest` — recover HP and spell slots
- `!dnd inventory` / `!dnd add [qty] <item>` / `!dnd remove [qty] <item>`
- `!dnd spells` / `!dnd cast <spell>` / `!dnd dc <level>`
- `!dnd party create <name>` / `!dnd party join <id>` / `!dnd party status`
- `!dnd encounter` / `!dnd encounter <monster> [count]` / `!dnd attack-monster`
- `!dnd help` — list available commands

See the original RaspBot README for the full command reference.

## Running locally

```bash
cp .env.example .env
# edit .env and set DISCORD_TOKEN
npm install
npm start
```

## Running with Docker

```bash
cp .env.example .env
# edit .env and set DISCORD_TOKEN
docker compose up -d --build
```

The SQLite D&D database is persisted in `data/dnd.db` (ignored by Git).

## Environment variables

- `DISCORD_TOKEN` — required Discord bot token
- `PREFIX` — optional command prefix (default `!`)
- `DEBUG` — optional, set to `TRUE` to use `#` as prefix
- `DND_DB_PATH` — optional path to the SQLite database (default `data/dnd.db`)
