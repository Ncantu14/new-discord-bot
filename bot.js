require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const token = process.env.MTM3NDM4MjcwMTU4NjQxNTY0Nw.G2jQ0s.rmjdlnqEETMyyTaRP0IlkY7aIT9SLflnaRF_Vo;
const prefix = '!';
const allowedRoleId = '1373832351762612234'; // Role ID that can use admin commands
const users = {};

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

function hasAdminRole(member) {
  return member?.roles?.cache?.has(allowedRoleId);
}

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const user = getUser(message.author.id);
  user.id = message.author.id;

  if (command === 'profile') {
    return message.reply(
      `📄 **Profile: ${message.author.username}**\n` +
      `XP: ${user.xp}\nLevel: ${user.level}\nCredits: ${user.credits}\nPrestige: ${user.prestige} (${user.prestigeClass})`
    );
  }

  if (command === 'addxp') {
    if (!hasAdminRole(message.member)) return message.reply('⛔ You do not have permission to use this command.');
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

  if (command === 'removexp') {
    if (!hasAdminRole(message.member)) return message.reply('⛔ You do not have permission to use this command.');
    const amount = parseInt(args[0]);
    if (isNaN(amount)) return message.reply('Invalid amount.');
    user.xp = Math.max(0, user.xp - amount);
    return message.reply(`🗑️ Removed ${amount} XP.`);
  }

  if (command === 'balance') {
    return message.reply(`💳 You have **${user.credits} credits**.`);
  }

  if (command === 'give') {
    if (!hasAdminRole(message.member)) return message.reply('⛔ You do not have permission to use this command.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0) return message.reply('Usage: `!give @user <amount>`');
    if (user.credits < amount) return message.reply("Not enough credits.");
    const targetUser = getUser(target.id);
    user.credits -= amount;
    targetUser.credits += amount;
    return message.reply(`💸 Gave **${amount} credits** to ${target.username}.`);
  }

  if (command === 'setcredits') {
    if (!hasAdminRole(message.member)) return message.reply('⛔ You do not have permission to use this command.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) return message.reply('Usage: `!setcredits @user <amount>`');
    getUser(target.id).credits = amount;
    return message.reply(`✅ Set ${target.username}'s credits to ${amount}.`);
  }

  if (command === 'sabacc') {
    const bet = parseInt(args[0]);
    if (isNaN(bet) || bet <= 0) return message.reply('Usage: `!sabacc <amount>`');
    if (user.credits < bet) return message.reply("You don't have enough credits!");

    const userHand = [drawCard(), drawCard()];
    const botHand = [drawCard(), drawCard()];
    const [d1, d2] = rollSpike();
    let sabaccShift = false;

    if (d1 === d2) {
      sabaccShift = true;
      userHand.length = 0;
      botHand.length = 0;
      userHand.push(drawCard(), drawCard());
      botHand.push(drawCard(), drawCard());
    }

    const userScore = calculateHand(userHand);
    const botScore = calculateHand(botHand);
    let result = '';

    if (Math.abs(userScore) > 23 && Math.abs(botScore) > 23) {
      result = 'Both busted! It’s a draw.';
    } else if (Math.abs(userScore) > 23) {
      result = 'You busted! Bot wins.';
      user.credits -= bet;
    } else if (Math.abs(botScore) > 23) {
      result = 'Bot busted! You win!';
      user.credits += bet;
    } else if (Math.abs(userScore) > Math.abs(botScore)) {
      result = 'You win!';
      user.credits += bet;
    } else if (Math.abs(botScore) > Math.abs(userScore)) {
      result = 'Bot wins!';
      user.credits -= bet;
    } else {
      result = 'It’s a tie!';
    }

    return message.reply(
      `🎲 **Sabacc Match** 🎲\n` +
      (sabaccShift ? '⚡ **Sabacc Shift triggered!**\n' : '') +
      `**Your Hand**: ${userHand.map(c => c.name).join(', ')} = ${userScore}\n` +
      `**Bot’s Hand**: ${botHand.map(c => c.name).join(', ')} = ${botScore}\n\n` +
      `🎯 ${result}\n💰 New Balance: ${user.credits} credits`
    );
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
