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
const encounterList = JSON.parse(fs.readFileSync('swtor_encounters_500.json'));
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
  if (!users[userId].sabaccStats) {
    users[userId].sabaccStats = {
      wins: 0,
      losses: 0,
      ties: 0,
      currentStreak: 0,
      bestStreak: 0
    };
  }
  return users[userId];
}

function hasAdminRole(member, authorId) {
  return member?.roles?.cache?.has(allowedRoleId) || allowedBotIds.includes(authorId) || authorId === allowedRoleId;
}

function postBounty() {
  if (!client.channels.cache.has(bountyChannelId)) return;
  const bounty = bountyList[Math.floor(Math.random() * bountyList.length)];
  const embed = new EmbedBuilder()
    .setTitle(`📡 New Bounty Posted!`)
    .setDescription(`🎯 **Target:** ${bounty.name}\n🧬 **Species:** ${bounty.species}\n📍 **Last Known Location:** ${bounty.location}\n💰 **Reward:** ${bounty.reward} credits`)
    .setFooter({ text: `First to react claims the bounty.` })
    .setColor('DarkRed');

  client.channels.fetch(bountyChannelId).then(channel => {
    channel.send({ embeds: [embed] }).then(msg => {
      activeBounty = { id: msg.id, claimed: false };
      msg.react('🎯');

      const filter = (reaction, user) => reaction.emoji.name === '🎯' && !user.bot;
      const collector = msg.createReactionCollector({ filter, time: 5 * 60 * 1000 });

      collector.on('collect', (reaction, user) => {
        if (!activeBounty.claimed) {
          activeBounty.claimed = true;
          msg.reply(`🛡️ Bounty claimed by <@${user.id}>! Use \`!bountyclaim\` when complete.`);
        }
      });

      collector.on('end', () => {
        if (!activeBounty.claimed) {
          msg.reply('⏳ Bounty expired. No one claimed it.').then(expiredMsg => {
            setTimeout(() => expiredMsg.delete().catch(() => {}), 5000);
          });
          msg.delete().catch(() => {});
        } else {
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
    return message.reply(`📄 **Profile: ${message.author.username}**\nLevel: ${user.level}\nCredits: ${user.credits}\nPrestige Class: ${user.prestigeClass}`);
  }

  if (command === 'balance') {
    return message.reply(`💳 You have **${user.credits} credits**.`);
  }

  if (command === 'setcredits') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount)) return message.reply('Usage: `!setcredits @user <amount>`');
    getUser(target.id).credits = amount;
    saveUsers();
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
    saveUsers();
    return message.reply(`💸 Gave **${amount} credits** to ${target.username}.`);
  }

  if (command === 'givecreditsto') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    const target = message.mentions.users.first();
    const amount = parseInt(args[1]);
    if (!target || isNaN(amount) || amount <= 0) return message.reply('Usage: `!givecreditsto @user <amount>`');
    const targetUser = getUser(target.id);
    targetUser.credits += amount;
    saveUsers();
    return message.reply(`💸 Gave **${amount} credits** to ${target.username}.`);
  }

  if (command === 'bountyclaim') {
    return message.reply(`📣 <@&${allowedRoleId}>: <@${message.author.id}> has claimed a bounty! Please verify the completion.`);
  }

  if (command === 'forcebounty') {
    if (!hasAdminRole(message.member, message.author.id)) return message.reply('⛔ You do not have permission.');
    postBounty();
    return message.reply('📡 Manual bounty posted.');
  }

  if (command === 'encounter') {
    const encounter = encounterList[Math.floor(Math.random() * encounterList.length)];
    const embed = new EmbedBuilder()
      .setTitle(`⚔️ Encounter: ${encounter.name}`)
      .setDescription(
        `🧬 **Species:** ${encounter.species}
🎭 **Role:** ${encounter.role}
🌍 **Location:** ${encounter.location}
🔥 **Threat Level:** ${encounter.threat}
❤️ **HP:** ${encounter.hp}
💥 **Damage:** ${encounter.damage}`
      )
      .setColor('DarkPurple');
    return message.reply({ embeds: [embed] });
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

  if (command === 'sabacc') {
    const bet = parseInt(args[0]);
    if (isNaN(bet) || bet <= 0) return message.reply('Usage: `!sabacc <amount>`');
    if (user.credits < bet) return message.reply('❌ You don’t have enough credits.');

    function drawCard() {
      const value = Math.floor(Math.random() * 21) - 10;
      return value === 0 ? drawCard() : value;
    }

    function drawHand() {
      const hand = [drawCard(), drawCard()];
      return { cards: hand, total: hand.reduce((a, b) => a + b, 0) };
    }

    const sabaccShift = Math.random() < 0.1;
    if (sabaccShift) {
      return message.reply(`🌪️ **Sabacc Shift!** The deck is scrambled! All bets are void.\n💳 Your balance remains at **${user.credits} credits**.`);
    }

    const player = drawHand();
    const dealer = drawHand();
    const playerDiff = 23 - Math.abs(player.total);
    const dealerDiff = 23 - Math.abs(dealer.total);
    const stats = user.sabaccStats;

    let resultText = `🃏 **You drew:** ${player.cards.join(', ')} (Total: ${player.total})\n🎲 **Dealer drew:** ${dealer.cards.join(', ')} (Total: ${dealer.total})\n`;

    if (Math.abs(player.total) === 23) {
      const winnings = bet * 2;
      user.credits += winnings;
      stats.wins++;
      stats.currentStreak++;
      if (stats.currentStreak > stats.bestStreak) stats.bestStreak = stats.currentStreak;
      saveUsers();
      resultText += `💰 You hit **23**! You win **${winnings} credits**!\n`;
    } else if (playerDiff < dealerDiff) {
      const winnings = bet * 2;
      user.credits += winnings;
      stats.wins++;
      stats.currentStreak++;
      if (stats.currentStreak > stats.bestStreak) stats.bestStreak = stats.currentStreak;
      saveUsers();
      resultText += `✅ You were closer to 23! You win **${winnings} credits**!\n`;
    } else if (playerDiff === dealerDiff) {
      stats.ties++;
      stats.currentStreak = 0;
      saveUsers();
      resultText += `🤝 It's a tie. Your bet is returned.\n`;
    } else {
      user.credits -= bet;
      stats.losses++;
      stats.currentStreak = 0;
      saveUsers();
      resultText += `😢 Dealer was closer to 23. You lose **${bet} credits**.\n`;
    }

    resultText += `💳 Your new balance: **${user.credits} credits**.`;
    return message.reply(resultText);
  }

  if (command === 'stats') {
    const stats = user.sabaccStats;
    return message.reply(`📊 **Sabacc Stats for ${message.author.username}:**
🏆 Wins: ${stats.wins}
💀 Losses: ${stats.losses}
⚖️ Ties: ${stats.ties}
🔥 Current Win Streak: ${stats.currentStreak}
✨ Best Streak: ${stats.bestStreak}`);
  }

  if (command === 'scoreboard') {
    const sorted = Object.entries(users)
      .filter(([_, data]) => data.sabaccStats)
      .sort(([, a], [, b]) => b.sabaccStats.wins - a.sabaccStats.wins)
      .slice(0, 10);

    const lines = await Promise.all(sorted.map(async ([userId, data], i) => {
      try {
        const userObj = await client.users.fetch(userId);
        return `${i + 1}. **${userObj.username}** – ${data.sabaccStats.wins} wins`;
      } catch {
        return `${i + 1}. Unknown User – ${data.sabaccStats.wins} wins`;
      }
    }));

    return message.reply(`🏅 **Top Sabacc Winners**\n${lines.join('\n')}`);
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












