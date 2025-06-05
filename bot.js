require('dotenv').config();
const fs = require('fs');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');

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
const usersPath = './users.json';
const users = loadUsers();
let activeBounty = null;

function loadUsers() {
  if (fs.existsSync(usersPath)) {
    return JSON.parse(fs.readFileSync(usersPath));
  }
  return {};
}

function saveUsers() {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function getUser(userId) {
  if (!users[userId]) {
    users[userId] = { level: 1, credits: 1000, prestigeClass: 'None' };
  }
  return users[userId];
}

function hasAdminRole(member, authorId) {
  return member?.roles?.cache?.has(allowedRoleId) || allowedBotIds.includes(authorId) || authorId === allowedRoleId;
}

function getDifficultyColor(difficulty) {
  switch (difficulty.toLowerCase()) {
    case 'low': return 0x2ECC71; // green
    case 'medium': return 0xF1C40F; // yellow
    case 'high': return 0xE67E22; // orange
    case 'extreme': return 0xE74C3C; // red
    default: return 0x95A5A6; // grey
  }
}

function postBounty() {
  if (!client.channels.cache.has(bountyChannelId)) return;
  const bounty = bountyList[Math.floor(Math.random() * bountyList.length)];

  const embed = new EmbedBuilder()
    .setTitle(`New Bounty Posted!`)
    .addFields(
      { name: 'Target', value: `${bounty.name}`, inline: true },
      { name: 'Species', value: `${bounty.species}`, inline: true },
      { name: 'Affiliation', value: `${bounty.affiliation}`, inline: true },
      { name: 'Known Skills', value: `${bounty.known_skills}`, inline: true },
      { name: 'Location', value: `${bounty.location}`, inline: true },
      { name: 'Last Seen', value: `${bounty.last_seen}`, inline: false },
      { name: 'Crime', value: `${bounty.crime}`, inline: true },
      { name: 'Job Type', value: `${bounty.job_type}`, inline: true },
      { name: 'Difficulty', value: `${bounty.difficulty}`, inline: true },
      { name: 'Reward', value: `${bounty.reward} credits`, inline: true },
      { name: 'Bonus', value: `${bounty.bonus || 'None'}`, inline: true }
    )
    .setFooter({ text: `React 🎯 to claim this bounty.` })
    .setColor(getDifficultyColor(bounty.difficulty));

  client.channels.fetch(bountyChannelId).then(channel => {
    channel.send({ embeds: [embed] }).then(msg => {
      activeBounty = { id: msg.id, claimed: false, reward: bounty.reward };

      msg.react('🎯');

      const filter = (reaction, user) => reaction.emoji.name === '🎯' && !user.bot;
      const collector = msg.createReactionCollector({ filter, max: 1, time: 5 * 60 * 1000 });

      collector.on('collect', (reaction, user) => {
        if (!activeBounty.claimed) {
          activeBounty.claimed = true;
          const claimedEmbed = EmbedBuilder.from(embed)
            .setFooter({ text: `Claimed by ${user.username}` })
            .setColor(0x3498DB);

          msg.edit({ embeds: [claimedEmbed] }).catch(console.error);
          msg.reply(`Bounty claimed by <@${user.id}>! Use \`!bountyclaim\` when complete.`);

          const claimer = getUser(user.id);
          claimer.credits += activeBounty.reward;
          saveUsers();
          msg.channel.send(`<@${user.id}> has been awarded ${activeBounty.reward} credits.`);
        }
      });

      collector.on('end', () => {
        if (!activeBounty.claimed) {
          msg.reply('Bounty expired. No one claimed it.');
        }
        activeBounty = null;
      });
    });
  });
}\n` +
      `Affiliation: ${bounty.affiliation} | Skills: ${bounty.known_skills}\n` +
      `Location: ${bounty.location}\n` +
      `Crime: ${bounty.crime}\n` +
      `Job Type: ${bounty.job_type} | Difficulty: ${bounty.difficulty}\n` +
      `Reward: ${bounty.reward} credits | Bonus: ${bounty.bonus || 'None'}\n` +
      `${bounty.last_seen}`
    )
    .setFooter({ text: `React 🎯 to claim this bounty.` })
    .setColor(getDifficultyColor(bounty.difficulty));

  client.channels.fetch(bountyChannelId).then(channel => {
    channel.send({ embeds: [embed] }).then(msg => {
      activeBounty = { id: msg.id, claimed: false, reward: bounty.reward };

      msg.react('🎯');

      const filter = (reaction, user) => reaction.emoji.name === '🎯' && !user.bot;
      const collector = msg.createReactionCollector({ filter, max: 1, time: 5 * 60 * 1000 });

      collector.on('collect', (reaction, user) => {
        if (!activeBounty.claimed) {
          activeBounty.claimed = true;
          const claimedEmbed = EmbedBuilder.from(embed)
            .setFooter({ text: `Claimed by ${user.username}` })
            .setColor(0x3498DB);

          msg.edit({ embeds: [claimedEmbed] }).catch(console.error);
          msg.reply(`Bounty claimed by <@${user.id}>! Use \`!bountyclaim\` when complete.`);

          const claimer = getUser(user.id);
          claimer.credits += activeBounty.reward;
          saveUsers();
          msg.channel.send(`<@${user.id}> has been awarded ${activeBounty.reward} credits.`);
        }
      });

      collector.on('end', () => {
        if (!activeBounty.claimed) {
          msg.reply('Bounty expired. No one claimed it.');
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
    return message.reply(`Profile: ${message.author.username}\nLevel: ${user.level}\nCredits: ${user.credits}\nPrestige Class: ${user.prestigeClass}`);
  }

  if (command === 'balance') {
    return message.reply(`You have ${user.credits} credits.`);
  }

  if (command === 'setcredits') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) return message.reply('Usage: !setcredits @user <amount>');
    getUser(target.id).credits = amount;
    saveUsers();
    return message.reply(`Set ${target.username}'s credits to ${amount}.`);
  }

  if (command === 'give') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0) return message.reply('Usage: !give @user <amount>');
    if (user.credits < amount) return message.reply('You don’t have enough credits.');
    const targetUser = getUser(target.id);
    user.credits -= amount;
    targetUser.credits += amount;
    saveUsers();
    return message.reply(`Gave ${amount} credits to ${target.username}.`);
  }

  if (command === 'bountyclaim') {
    return message.reply(`@&${allowedRoleId}: <@${message.author.id}> has claimed a bounty! Please verify the completion.`);
  }

  if (command === 'forcebounty') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('You do not have permission.');
    postBounty();
    return message.reply('Manual bounty posted.');
  }
});

client.once('ready', () => {
  console.log(`Bot is running! Logged in as ${client.user.tag}`);
});

process.on('SIGINT', () => {
  console.log('Bot shutting down...');
  process.exit();
});

client.login(token);

     
