require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const token = process.env.DISCORD_TOKEN;
const prefix = '!';

const allowedRoleId = '1373832351762612234'; // Human admin role
const allowedBotIds = ['1379634780534214676']; // Cantina bot ID (optional if you split again)

const users = {};
const slotsSymbols = ['🍒', '🍋', '🍇', '💎', '7️⃣', '🔔'];

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

client.on('messageCreate', async (message) => {
  if (!message.content.startsWith(prefix)) return;
  if (message.author.bot && !allowedBotIds.includes(message.author.id)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const sender = getUser(message.author.id);

  // !profile
  if (command === 'profile') {
    const embed = new EmbedBuilder()
      .setTitle(`📄 ${message.author.username}'s Profile`)
      .addFields(
        { name: 'XP', value: `${sender.xp}`, inline: true },
        { name: 'Level', value: `${sender.level}`, inline: true },
        { name: 'Credits', value: `${sender.credits}`, inline: true },
        { name: 'Prestige', value: `${sender.prestige} (${sender.prestigeClass})`, inline: true }
      )
      .setColor('Blue');
    return message.reply({ embeds: [embed] });
  }

  // !addxp @user amount
  if (command === 'addxp') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first() || message.author;
    const amount = parseInt(args[1] || args[0]);
    if (isNaN(amount)) return message.reply('Invalid amount.');
    const user = getUser(target.id);
    user.xp += amount;
    let msg = `✅ Added ${amount} XP to ${target.username}.`;
    const lvl = checkLevelUp(user);
    const pres = checkPrestige(user);
    if (lvl) msg += `\n${lvl}`;
    if (pres) msg += `\n${pres}`;
    return message.reply(msg);
  }

  // !removexp @user amount
  if (command === 'removexp') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first() || message.author;
    const amount = parseInt(args[1] || args[0]);
    if (isNaN(amount)) return message.reply('Invalid amount.');
    const user = getUser(target.id);
    user.xp = Math.max(0, user.xp - amount);
    return message.reply(`🗑️ Removed ${amount} XP from ${target.username}.`);
  }

  // !balance
  if (command === 'balance') {
    return message.reply(`💳 You have **${sender.credits} credits**.`);
  }

  // !give @user amount
  if (command === 'give') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0) return message.reply('Usage: `!give @user <amount>`');
    if (sender.credits < amount) return message.reply("Not enough credits.");
    const targetUser = getUser(target.id);
    sender.credits -= amount;
    targetUser.credits += amount;
    return message.reply(`💸 Gave **${amount} credits** to ${target.username}.`);
  }

  // !setcredits @user amount
  if (command === 'setcredits') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) return message.reply('Usage: `!setcredits @user <amount>`');
    getUser(target.id).credits = amount;
    return message.reply(`✅ Set ${target.username}'s credits to ${amount}.`);
  }

  // !slots <amount>
  if (command === 'slots') {
    const bet = parseInt(args[0]);
    if (isNaN(bet) || bet <= 0) return message.reply('Usage: `!slots <amount>`');
    if (sender.credits < bet) return message.reply("You don’t have enough credits.");

    const roll = [randSlot(), randSlot(), randSlot()];
    let win = false;
    let winnings = 0;

    if (roll[0] === roll[1] && roll[1] === roll[2]) {
      win = true;
      winnings = bet * 5;
    }

    sender.credits += win ? winnings : -bet;

    const result = new EmbedBuilder()
      .setTitle(`🎰 Cantina Slots`)
      .setDescription(`🎲 ${roll.join(' | ')}\n\n${win ? `💰 You won **${winnings} credits**!` : `❌ You lost **${bet} credits**.`}\nNew Balance: **${sender.credits} credits**`)
      .setColor(win ? 'Green' : 'Red');

    return message.reply({ embeds: [result] });
  }
});

function randSlot() {
  return slotsSymbols[Math.floor(Math.random() * slotsSymbols.length)];
}

client.once('ready', () => {
  console.log(`✅ SWTOR RP Bot is online as ${client.user.tag}`);
});

process.on('SIGINT', () => {
  console.log('👋 Bot shutting down...');
  process.exit();
});

client.login(token);


