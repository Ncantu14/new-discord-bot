require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const token = process.env.DISCORD_TOKEN;
const prefix = '!';

const allowedRoleId = '1373832351762612234'; // Admin role
const allowedBotIds = ['1379634780534214676']; // Trusted bot (e.g. Cantina bot)

const users = {}; // XP + credits tracker

function getUser(userId) {
  if (!users[userId]) {
    users[userId] = {
      xp: 0,
      level: 1,
      credits: 1000,
      prestige: 0,
      prestigeClass: 'None'
    };
  }
  return users[userId];
}

function checkLevelUp(user) {
  const nextLevelXP = user.level * 100;
  if (user.xp >= nextLevelXP) {
    user.level++;
    user.xp = 0;
    return `🔺 Leveled up to **Level ${user.level}**!`;
  }
  return null;
}

function checkPrestige(user) {
  if (user.level >= 20 && user.prestige < 5) {
    user.prestige++;
    user.level = 1;
    user.xp = 0;
    user.prestigeClass = `Prestige ${user.prestige}`;
    return `🌟 Reached **Prestige ${user.prestige}**!`;
  }
  return null;
}

function hasAdminRole(member, authorId) {
  return member?.roles?.cache?.has(allowedRoleId) || allowedBotIds.includes(authorId);
}

const suits = ['Sabers', 'Flasks', 'Staves', 'Coins'];
const deck = [];
for (let i = -10; i <= 10; i++) {
  if (i === 0) deck.push({ name: 'The Idiot', value: 0 });
  else for (let suit of suits) deck.push({ name: `${i} of ${suit}`, value: i });
}
function drawCard() {
  return deck[Math.floor(Math.random() * deck.length)];
}
function rollSpike() {
  return [Math.ceil(Math.random() * 6), Math.ceil(Math.random() * 6)];
}
function calculateHand(hand) {
  return hand.reduce((sum, card) => sum + card.value, 0);
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const user = getUser(message.author.id);
  user.id = message.author.id;

  // Profile
  if (command === 'profile') {
    return message.reply(
      `📄 **Profile: ${message.author.username}**\n` +
      `XP: ${user.xp}\nLevel: ${user.level}\nCredits: ${user.credits}\nPrestige: ${user.prestige} (${user.prestigeClass})`
    );
  }

  // Balance
  if (command === 'balance') {
    return message.reply(`💳 You have **${user.credits} credits**.`);
  }

  // Add XP
  if (command === 'addxp') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const amount = parseInt(args[0]);
    if (isNaN(amount)) return message.reply('Invalid amount.');
    user.xp += amount;
    let msg = `✅ Added ${amount} XP.`;
    const lvl = checkLevelUp(user);
    const pres = checkPrestige(user);
    if (lvl) msg += `\n${lvl}`;
    if (pres) msg += `\n${pres}`;
    return message.reply(msg);
  }

  // Remove XP
  if (command === 'removexp') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const amount = parseInt(args[0]);
    if (isNaN(amount)) return message.reply('Invalid amount.');
    user.xp = Math.max(0, user.xp - amount);
    return message.reply(`🗑️ Removed ${amount} XP.`);
  }

  // Give credits
  if (command === 'give') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0) return message.reply('Usage: `!give @user <amount>`');
    if (user.credits < amount) return message.reply("Not enough credits.");
    const targetUser = getUser(target.id);
    user.credits -= amount;
    targetUser.credits += amount;
    return message.reply(`💸 Gave **${amount} credits** to ${target.username}.`);
  }

  // Set credits
  if (command === 'setcredits') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) return message.reply('Usage: `!setcredits @user <amount>`');
    getUser(target.id).credits = amount;
    return message.reply(`✅ Set ${target.username}'s credits to ${amount}.`);
  }

  // Slots game
  if (command === 'slots') {
    const bet = parseInt(args[0]);
    if (isNaN(bet) || bet <= 0) return message.reply('Usage: `!slots <amount>`');
    if (user.credits < bet) return message.reply('❌ You don’t have enough credits.');

    const symbols = ['🍒', '🍋', '🍇', '💎', '7️⃣', '🔔'];
    const result = [0, 1, 2].map(() => symbols[Math.floor(Math.random() * symbols.length)]);
    const win = result.every(s => s === result[0]);

    if (win) {
      const winnings = bet * 5;
      user.credits += winnings;
      return message.reply(`🎰 ${result.join(' ')}\n💰 Jackpot! You win **${winnings} credits**!`);
    } else {
      user.credits -= bet;
      return message.reply(`🎰 ${result.join(' ')}\n😢 You lost **${bet} credits**.`);
    }
  }

  // Dice Roller
  if (command === 'roll') {
    const input = args.join('').toLowerCase(); // e.g., d20+5
    const match = input.match(/d(\d+)([+-]\d+)?/);

    if (!match) {
      return message.reply('🎲 Invalid format. Try `!roll d20`, `!roll d100+5`, or `!roll d6-1`.');
    }

    const sides = parseInt(match[1]);
    const modifier = parseInt(match[2]) || 0;

    if (isNaN(sides) || sides <= 0) {
      return message.reply('❌ Invalid number of sides. Use something like `d20`, `d6`, `d100`, etc.');
    }

    const roll = Math.ceil(Math.random() * sides);
    const total = roll + modifier;
    const modifierText = modifier !== 0 ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : '';
    return message.reply(`🎲 Rolled **1d${sides}${modifierText}** → 🎯 **${roll}**${modifier !== 0 ? ` → Total: **${total}**` : ''}`);
  }
});

client.once('ready', () => {
  console.log(`✅ Bot is running! Logged in as ${client.user.tag}`);
});

process.on('SIGINT', () => {
  console.log('👋 Bot shutting down...');
  process.exit();
});

client.login(token);



