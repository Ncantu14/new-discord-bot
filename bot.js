require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ],
  partials: ['MESSAGE', 'CHANNEL', 'REACTION']
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
  return member?.roles?.cache?.has(allowedRoleId) || allowedBotIds.includes(authorId) || authorId === allowedRoleId;
}

function postBounty() {
  if (!client.channels.cache.has(bountyChannelId)) return;
  const bounty = bountyList[Math.floor(Math.random() * bountyList.length)];
  const embed = new EmbedBuilder()
    .setTitle(`📡 New Bounty Posted!`)
    .setDescription(`🎯 **Target:** ${bounty.name}  \n🧬 **Species:** ${bounty.species}  \n📍 **Last Known Location:** ${bounty.location}  \n💰 **Reward:** ${bounty.reward} credits`)
    .setFooter({ text: `First to react claims the bounty.` })
    .setColor('DarkRed');

  client.channels.fetch(bountyChannelId).then(channel => {
    channel.send({ embeds: [embed] }).then(msg => {
      activeBounty = { id: msg.id, claimed: false, claimer: null };
      msg.react('🎯');

      const filter = (reaction, user) => reaction.emoji.name === '🎯' && !user.bot;
      const collector = msg.createReactionCollector({ filter, time: 5 * 60 * 1000 });

      collector.on('collect', (reaction, user) => {
        if (!activeBounty.claimed) {
          activeBounty.claimed = true;
          activeBounty.claimer = user.id;
          msg.reply(`🛡️ Bounty claimed by <@${user.id}>! Use \`!bountyclaim\` when complete.`);
        }
      });

      collector.on('end', () => {
        if (!activeBounty.claimed) {
          msg.reply('⏳ Bounty expired. No one claimed it.');
          msg.delete().catch(() => {});
        }
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

  if (command === 'setcredits') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) return message.reply('Usage: `!setcredits @user <amount>`');
    getUser(target.id).credits = amount;
    return message.reply(`✅ Set ${target.username}'s credits to ${amount}.`);
  }

  if (command === 'give') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0) return message.reply('Usage: `!give @user <amount>`');
    if (user.credits < amount) return message.reply('❌ You don’t have enough credits.');
    const targetUser = getUser(target.id);
    user.credits -= amount;
    targetUser.credits += amount;
    return message.reply(`💸 Gave **${amount} credits** to ${target.username}.`);
  }

  if (command === 'bountyclaim') {
    if (!activeBounty || !activeBounty.claimer) return message.reply('⚠️ No active bounty claim to process.');
    const rolePing = `<@&${allowedRoleId}>`;
    return message.reply(`${rolePing} – Bounty claimed by <@${activeBounty.claimer}>. Please verify and reward accordingly.`);
  }

  if (command === 'forcebounty') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    postBounty();
    return message.reply('📡 Manual bounty posted.');
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




