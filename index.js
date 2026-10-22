const { Client, GatewayIntentBits, Collection } = require("discord.js");
const fs = require("fs");
const path = require("path");

// Load .env file if present (useful for local development; Docker uses env_file)
if (fs.existsSync(path.join(__dirname, ".env"))) {
  require("dotenv").config();
}

// config.json is optional; fallback values are used if it is missing.
let config = { prefix: "!" };
try {
  config = require("./config.json");
} catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") {
    console.error("Error loading config.json:", error);
    process.exit(1);
  }
  console.log("No config.json found, using default prefix: !");
}

const DEBUG = process.env.DEBUG === "TRUE";
const PREFIX = DEBUG ? "#" : (process.env.PREFIX || config.prefix || "!");
console.log(`DEBUG=${DEBUG ? "TRUE" : "FALSE"}, using prefix: ${PREFIX}`);

const DISCORD_TOKEN = process.env.DISCORD_TOKEN || config.token;
if (!DISCORD_TOKEN) {
  console.error(
    "Error: DISCORD_TOKEN is not set. Provide it via environment variable or config.json.",
  );
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  client.commands.set(command.name, command);
}

client.once("clientReady", () => {
  console.log(`Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args, PREFIX);
  } catch (error) {
    console.error(error);
    await message.reply("❌ There was an error executing that command.");
  }
});

client.login(DISCORD_TOKEN);
