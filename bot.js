require('dotenv').config();
const fs = require('fs');
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

// Bounty system config
const BOUNTY_CHANNEL_ID = '1373842052730720296';
const BOUNTY_POST_INTERVAL = 1000 * 60 * 30; // 30 minutes
const BOUNTY_EXPIRE_TIMEOUT = 1000 * 60 * 5; // 5 minutes
let activeBounty = null;

function loadBounties() {
  try {
    const data = fs.readFileSync('bounties.json', 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Failed to load bounties.json:', err);
    return [];
  }
}

function getRandomBounty() {
  const bounties = loadBounties();
  if (bounties.length === 0) return null;
  return bounties[Math.floor(Math.random() * bounties.length)];
}

async function postBounty() {
  if (!client.isReady()) return;
  const bounty = getRandomBounty();
  if (!bounty) return;

  const channel = await client.channels.fetch(BOUNTY_CHANNEL_ID);
  if (!channel) return;

  const embed = {
    title: `🚨 Bounty Posted: ${bounty.name}`,
    description: `**Species**: ${bounty.species}\n**Location**: ${bounty.location}\n**Reward**: ${bounty.reward} credits`,
    color: 0xff0000,
    footer: { text: 'Use !bountyclaim to collect. Expires in 5 minutes.' }
  };

  const bountyMsg = await channel.send({ embeds: [embed] });
  activeBounty = {
    messageId: bountyMsg.id,
    channelId: BOUNTY_CHANNEL_ID,
    bounty: bounty,
    claimed: false
  };

  // Auto-delete after timeout
  setTimeout(async () => {
    if (!activeBounty.claimed) {
      try {
        await channel.messages.delete(bountyMsg.id);
        activeBounty = null;
      } catch (err) {
        console.error('Error deleting expired bounty:', err);
      }
    }
  }, BOUNTY_EXPIRE_TIMEOUT);
}

client.once('ready', () => {
  console.log(`✅ Bot is running! Logged in as ${client.user.tag}`);
  setInterval(postBounty, BOUNTY_POST_INTERVAL);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.content.startsWith(prefix)) return;
  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const user = getUser(message.author.id);
  user.id = message.author.id;

  if (command === 'bountyclaim') {
    if (!activeBounty || activeBounty.claimed) {
      return message.reply('❌ No active bounty to claim.');
    }

    const channel = await client.channels.fetch(activeBounty.channelId);
    try {
      const msg = await channel.messages.fetch(activeBounty.messageId);
      await msg.delete();
    } catch (err) {
      console.error('Error deleting claimed bounty:', err);
    }

    user.credits += activeBounty.bounty.reward;
    activeBounty.claimed = true;

    return message.reply(`🎯 You have successfully claimed the bounty on **${activeBounty.bounty.name}** and earned **${activeBounty.bounty.reward} credits**.`);
  }
});



