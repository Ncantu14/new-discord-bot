require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const token = process.env.DISCORD_TOKEN;
const prefix = '!';
const allowedRoleId = '1373832351762612234';
const allowedBotIds = ['1379634780534214676'];
const bountyChannelId = '1373842052730720296';
const bountyList = JSON.parse(fs.readFileSync('bounties.json'));
const users = {};
let activeBounty = null;

function getUser(userId) {
  if (!users[userId]) {
    users[userId] = { xp: 0, level: 1, credits: 1000, prestige: 0, prestigeClass: 'None' };
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

function postBounty() {
  if (!client.channels.cache.has(bountyChannelId)) return;
  const bounty = bountyList[Math.floor(Math.random() * bountyList.length)];
  const embed = new EmbedBuilder()
    .setTitle(`📡 New Bounty Posted!`)
    .setDescription(`🎯 **Target:** ${bounty.name}  
🧬 **Species:** ${bounty.species}  
📍 **Last Known Location:** ${bounty.location}  
💰 **Reward:** ${bounty.reward} credits`)
    .setFooter({ text: `First to react claims the bounty.` })
    .setColor('DarkRed');

  client.channels.fetch(bountyChannelId).then(channel => {
    channel.send({ embeds: [embed] }).then(msg => {
      activeBounty = { id: msg.id, claimed: false };
      msg.react('🎯');

      const collector = msg.createReactionCollector({ time: 5 * 60 * 1000 });
      collector.on('collect', (reaction, user) => {
        if (!activeBounty.claimed && reaction.emoji.name === '🎯' && !user.bot) {
          activeBounty.claimed = true;
          msg.reply(`🛡️ Bounty claimed by <@${user.id}>! Use \`!bountyclaim\` when complete.`);
        }
      });

      collector.on('end', () => {
        if (!activeBounty.claimed) msg.delete().catch(() => {});
        activeBounty = null;
      });
    });
  });
}

setInterval(postBounty, 30 * 60 * 1000);

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const user = getUser(message.author.id);
  user.id = message.author.id;

  if (command === 'profile') {
    return message.reply(`📄 **Profile: ${message.author.username}**\nXP: ${user.xp}\nLevel: ${user.level}\nCredits: ${user.credits}\nPrestige: ${user.prestige} (${user.prestigeClass})`);
  }

  if (command === 'balance') return message.reply(`💳 You have **${user.credits} credits**.`);

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

  if (command === 'removexp') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const amount = parseInt(args[0]);
    if (isNaN(amount)) return message.reply('Invalid amount.');
    user.xp = Math.max(0, user.xp - amount);
    return message.reply(`🗑️ Removed ${amount} XP.`);
  }

  if (command === 'bountyclaim') {
    return message.reply('🔧 Bounty claims are currently manual. Please notify a mod for approval.');
  }

  if (command === 'roll') {
    const input = args.join('').toLowerCase();
    const match = input.match(/d(\d+)([+-]\d+)?/);
    if (!match) return message.reply('🎲 Invalid format. Try `!roll d20`, `!roll d100+5`, etc.');
    const sides = parseInt(match[1]);
    const modifier = parseInt(match[2]) || 0;
    const roll = Math.ceil(Math.random() * sides);
    const total = roll + modifier;
    const modText = modifier !== 0 ? ` (${roll} ${modifier > 0 ? '+' : '-'} ${Math.abs(modifier)})` : '';
    return message.reply(`🎲 You rolled a **${total}**${modText}`);
  }

  if (command === 'slots') {
    const bet = parseInt(args[0]);
    if (isNaN(bet) || bet <= 0) return message.reply('Usage: `!slots <amount>`');
    if (user.credits < bet) return message.reply('❌ You don’t have enough credits.');
    const symbols = ['🍒', '🍋', '🍇', '💎', '7️⃣', '🔔'];
    const result = Array.from({ length: 3 }, () => symbols[Math.floor(Math.random() * symbols.length)]);
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
});

client.once('ready', () => {
  console.log(`✅ Bot is running! Logged in as ${client.user.tag}`);
});

process.on('SIGINT', () => {
  console.log('👋 Bot shutting down...');
  process.exit();
});

client.login(token);

