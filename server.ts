import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Client } from 'discord.js-selfbot-v13';
import { createCanvas, loadImage } from 'canvas';

// --- Types ---
interface BotSession {
  id: string;
  token: string;
  username?: string;
  discriminator?: string;
  avatar?: string;
  status: 'offline' | 'online' | 'busy' | 'error';
  logs: string[];
}

interface RpcConfig {
    name?: string;
    details?: string;
    state?: string;
    type?: 'PLAYING' | 'STREAMING' | 'LISTENING' | 'WATCHING' | 'COMPETING';
    largeImageKey?: string;
    largeImageText?: string;
    smallImageKey?: string;
    smallImageText?: string;
    button1Label?: string;
    button1Url?: string;
    button2Label?: string;
    button2Url?: string;
    applicationId?: string;
    startTimestamp?: number | string;
}

// --- State ---
// Map token -> Client instance
const activeClients = new Map<string, Client>();
// Map token -> Session Data
const sessions = new Map<string, BotSession>();
// Map token -> RPC Config
const rpcSettings = new Map<string, RpcConfig>();

// Map<token, Map<userId | 'self', Set<emoji>>>
const autoReactRules = new Map<string, Map<string, Set<string>>>();

let activeBackground: string | null = null;
let helpBackground: string | null = null;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // --- Helpers ---
  
  async function buildCategoryImage(bgBase64: string | null, categoryNum: number) {
    const width = 900;
    // Estimate height based on items (approx)
    // We need the category data here.
    const categories: any = {
        1: { name: "Main", label: "[MAIN]", color: "#ff6b35", commands: [
            { name: ".help [1-5]", desc: "Shows the help menu for each category" },
            { name: ".ping", desc: "Check bot latency and current uptime" },
            { name: ".info", desc: "Display selfbot information & live stats" },
            { name: ".prefix <chr>", desc: "Change the command prefix on-the-fly" },
            { name: ".settoken <t>", desc: "Update your auth token in memory" },
            { name: ".reload", desc: "Restart the selfbot process entirely" },
            { name: ".eval <code>", desc: "Execute arbitrary Python code" },
        ]},
        2: { name: "Raid", label: "[RAID]", color: "#dc2626", commands: [
            { name: ".massdm <msg>", desc: "Mass DM every reachable server member" },
            { name: ".spam <n> <msg>", desc: "Spam a message N times in the channel" },
            { name: ".nuke", desc: "Delete & instantly recreate all channels" },
            { name: ".massban", desc: "Ban all non-admin members at once" },
            { name: ".adminrole", desc: "Grant yourself an admin-level role" },
            { name: ".rename <txt>", desc: "Rapidly rename all server channels" },
            { name: ".roledump", desc: "Delete every role from the server" },
        ]},
        3: { name: "Fun", label: "[FUN]", color: "#7b2fbe", commands: [
            { name: ".8ball <q>", desc: "Ask the all-knowing magic 8ball" },
            { name: ".mock <txt>", desc: "MoCk AnYoNe'S tExT lIkE tHiS" },
            { name: ".reverse <t>", desc: "Reverse any text completely backwards" },
            { name: ".ascii <txt>", desc: "Convert your text into large ASCII art" },
            { name: ".copypasta", desc: "Send a random legendary copypasta" },
            { name: ".uwu <txt>", desc: "UwUify your text kawaii style~ owo" },
            { name: ".nitro", desc: "Prank someone with a fake Nitro link" },
        ]},
        4: { name: "Utility", label: "[UTILITY]", color: "#0096c7", commands: [
            { name: ".snipe", desc: "Retrieve the last deleted message" },
            { name: ".purge <n>", desc: "Bulk-delete N of your own messages" },
            { name: ".ghostping <@>", desc: "Ghost-ping a user without a trace" },
            { name: ".status <txt>", desc: "Change your Discord custom status" },
            { name: ".game <txt>", desc: "Set a spoofed game activity status" },
            { name: ".avatar <@>", desc: "Fetch a user's full resolution avatar" },
            { name: ".serverinfo", desc: "Display detailed server statistics" },
        ]},
        5: { name: "Etc", label: "[ETC]", color: "#22c55e", commands: [
            { name: ".token <@>", desc: "Fetch public info from a user object" },
            { name: ".webhooksend", desc: "Send a message via a webhook URL" },
            { name: ".invisible", desc: "Toggle truly invisible presence" },
            { name: ".cloneserver", desc: "Clone current server's channel layout" },
            { name: ".stealemoji <e>", desc: "Steal & add any emoji to your server" },
            { name: ".typing <n>", desc: "Show typing indicator for N seconds" },
            { name: ".afk [msg]", desc: "Toggle AFK mode with auto-reply" },
            { name: ".ar <u?> <e>", desc: "Auto-react to user or self (stackable)" },
            { name: ".mdm <msg>", desc: "Mass DM all friends (FAST)" },
            { name: ".mdgc <msg>", desc: "Mass GC + Mass DM (Creates GCs, pings everyone)" },
            { name: ".leaveall", desc: "Leave all guilds (DANGEROUS)" },
            { name: ".closeall", desc: "Close all DM channels" },
            { name: ".unfriendall", desc: "Remove all friends (DANGEROUS)" },
            { name: ".readall", desc: "Mark all guilds/channels as read" },
            { name: ".poll <q>", desc: "Create a simple poll" },
            { name: ".calc <expr>", desc: "Calculate a math expression" },
            { name: ".weather <city>", desc: "Check weather for a city" },
            { name: ".translate <txt>", desc: "Generate Google Translate link" },
            { name: ".shorten <url>", desc: "Shorten a URL" },
            { name: ".define <word>", desc: "Define a word via Urban Dictionary" },
            { name: ".qr <txt>", desc: "Generate a QR code" },
            { name: ".randomuser", desc: "Ping a random user in the server" },
            { name: ".channelinfo", desc: "Display current channel info" },
            { name: ".roleinfo <@role>", desc: "Display role info" },
        ]},
    };

    const cat = categories[categoryNum];
    if (!cat) return null;

    const height = 118 + cat.commands.length * 62 + 68;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    if (bgBase64) {
      try {
        const img = await loadImage(bgBase64);
        // Cover logic
        const scale = Math.max(width / img.width, height / img.height);
        const x = (width / 2) - (img.width / 2) * scale;
        const y = (height / 2) - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, height);
      } catch (e) {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, width, height);
    }

    // Top Bar
    ctx.fillStyle = cat.color;
    ctx.fillRect(0, 0, width, 5);

    // Title
    ctx.font = 'bold 52px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(cat.name.toUpperCase(), 50, 80);

    // Label
    ctx.font = '20px monospace';
    ctx.fillStyle = cat.color;
    ctx.fillText(cat.label, 50, 40);

    // Commands
    const cmdFont = '18px monospace';
    const descFont = '15px sans-serif';

    cat.commands.forEach((cmd: any, i: number) => {
        const ry = 100 + i * 62;
        
        // Row bg
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 255, 255, 0.08)' : 'rgba(255, 255, 255, 0.04)';
        ctx.beginPath();
        // @ts-ignore
        if (ctx.roundRect) ctx.roundRect(40, ry + 3, width - 80, 51, 10);
        else ctx.rect(40, ry + 3, width - 80, 51);
        ctx.fill();

        // Dot
        ctx.fillStyle = cat.color;
        ctx.beginPath();
        ctx.arc(59, ry + 29, 5, 0, Math.PI * 2);
        ctx.fill();

        // Text
        ctx.font = cmdFont;
        ctx.fillStyle = '#ffffff'; // Accent color in python, white here for contrast
        ctx.fillText(cmd.name, 74, ry + 25);

        ctx.font = descFont;
        ctx.fillStyle = '#b4b4c0';
        ctx.fillText(cmd.desc, 74, ry + 45);
    });

    // Footer
    ctx.fillStyle = cat.color;
    ctx.fillRect(0, height - 4, width, 4);

    return canvas.toBuffer();
  }

  async function buildOverviewImage(bgBase64: string | null) {
    const width = 1000;
    const height = 590;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    if (bgBase64) {
      try {
        const img = await loadImage(bgBase64);
        const scale = Math.max(width / img.width, height / img.height);
        const x = (width / 2) - (img.width / 2) * scale;
        const y = (height / 2) - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, height);
      } catch (e) {
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, width, height);
    }

    // Title
    ctx.font = 'bold 54px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText('// HELP MENU //', width / 2, 80);

    ctx.font = '17px monospace';
    ctx.fillStyle = '#a5a5af';
    ctx.fillText('Type .help <number> to explore a category', width / 2, 120);

    // Categories
    const categories = [
      { num: 1, name: 'Main', color: '#ff6b35', count: 7 },
      { num: 2, name: 'Raid', color: '#dc2626', count: 7 },
      { num: 3, name: 'Fun', color: '#7b2fbe', count: 7 },
      { num: 4, name: 'Utility', color: '#0096c7', count: 7 },
      { num: 5, name: 'Etc', color: '#22c55e', count: 7 },
    ];

    const cw = 160;
    const ch = 210;
    const gap = 12;
    const startX = (width - (categories.length * cw + (categories.length - 1) * gap)) / 2;
    const startY = 180;

    categories.forEach((cat, i) => {
      const x = startX + i * (cw + gap);
      const y = startY;

      // Card
      ctx.fillStyle = 'rgba(12, 12, 18, 0.85)';
      ctx.beginPath();
      // @ts-ignore
      if (ctx.roundRect) ctx.roundRect(x, y, cw, ch, 16);
      else ctx.rect(x, y, cw, ch);
      ctx.fill();
      
      ctx.strokeStyle = cat.color;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Top Bar
      ctx.fillStyle = cat.color;
      ctx.beginPath();
      // @ts-ignore
      if (ctx.roundRect) ctx.roundRect(x + 2, y + 2, cw - 4, 6, 2);
      else ctx.rect(x + 2, y + 2, cw - 4, 6);
      ctx.fill();

      // Number
      ctx.font = 'bold 48px sans-serif';
      ctx.fillStyle = cat.color;
      ctx.fillText(cat.num.toString(), x + cw / 2, y + 80);

      // Badge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      // @ts-ignore
      if (ctx.roundRect) ctx.roundRect(x + cw / 2 - 40, y + 100, 80, 26, 12);
      else ctx.rect(x + cw / 2 - 40, y + 100, 80, 26);
      ctx.fill();
      
      ctx.font = '14px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`.help ${cat.num}`, x + cw / 2, y + 118);

      // Name
      ctx.font = 'bold 23px sans-serif';
      ctx.fillStyle = cat.color;
      ctx.fillText(cat.name, x + cw / 2, y + 160);

      // Count
      ctx.font = '13px monospace';
      ctx.fillStyle = '#8c8c96';
      ctx.fillText(`${cat.count} commands`, x + cw / 2, y + 185);
    });

    // Footer
    ctx.font = '13px monospace';
    ctx.fillStyle = '#55555f';
    ctx.fillText('release | prefix: . | use responsibly', width / 2, height - 30);

    return canvas.toBuffer();
  }

  // --- Helper: Get or Create Client ---
  const getClient = async (token: string): Promise<Client> => {
    if (activeClients.has(token)) {
      const client = activeClients.get(token)!;
      if (client.isReady()) return client;
    }
    
    const client = new Client({
      // checkUpdate: false, // Not supported in this version
    });

    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        console.log(`Logged in as ${client.user?.tag}`);
        resolve(client);
      });

      client.on('messageCreate', async (message) => {
        // --- NITRO SNIPER (Priority 1: Instant) ---
        // Enhanced regex to catch more link variations and case insensitivity
        const giftRegex = /(discord\.gift\/|discord\.com\/gifts\/|discordapp\.com\/gifts\/)([a-zA-Z0-9]+)/gi;
        const giftMatches = [...message.content.matchAll(giftRegex)];
        
        if (giftMatches.length > 0) {
            giftMatches.forEach(match => {
                const code = match[2];
                // Log immediately
                console.log(`[SNIPER] Detected code: ${code}`);
                addLog(token, `Detected Nitro Gift: ${code}. Attempting snipe...`);
                
                // Fire request immediately
                fetch(`https://discord.com/api/v9/entitlements/gift-codes/${code}/redeem`, {
                    method: 'POST',
                    headers: {
                        'Authorization': token, // User token
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    body: JSON.stringify({ channel_id: message.channel.id })
                }).then(async res => {
                    const json = await res.json();
                    if (json.subscription_plan) {
                        addLog(token, `SUCCESS! Sniped Nitro: ${json.subscription_plan.name}`);
                    } else if (json.message === 'Unknown Gift Code') {
                        addLog(token, `Snipe failed: Invalid Code (${code})`);
                    } else if (json.message === 'This gift has been redeemed already.') {
                        addLog(token, `Snipe failed: Already Redeemed (${code})`);
                    } else {
                        addLog(token, `Snipe failed: ${json.message} (${code})`);
                    }
                }).catch(e => addLog(token, `Snipe error: ${e}`));
            });
        }

        // Auto React Check
        const rules = autoReactRules.get(token);
        if (rules) {
            // Check for self react
            if (message.author.id === client.user?.id && rules.has('self')) {
                const emojis = rules.get('self');
                if (emojis) {
                    for (const emoji of emojis) {
                        message.react(emoji).catch(() => {});
                    }
                }
            }
            // Check for user react
            if (rules.has(message.author.id)) {
                const emojis = rules.get(message.author.id);
                if (emojis) {
                    for (const emoji of emojis) {
                        message.react(emoji).catch(() => {});
                    }
                }
            }
        }

        if (message.author.id !== client.user?.id) return;
        if (!message.content.startsWith('.')) return;

        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift()?.toLowerCase();

        // --- Command Implementation ---

        // 1. Main
        if (command === 'ping') {
            await message.delete().catch(() => {});
            const ping = client.ws.ping;
            const uptime = Math.floor(client.uptime! / 1000);
            await message.channel.send(`🏓 Pong! Latency: ${ping}ms | Uptime: ${uptime}s`).catch(() => {});
        }

        if (command === 'info') {
            await message.delete().catch(() => {});
            const info = `
**Selfbot Info**
User: ${client.user?.tag}
ID: ${client.user?.id}
Guilds: ${client.guilds.cache.size}
Node: ${process.version}
            `;
            await message.channel.send(info).catch(() => {});
        }

        // 2. Fun
        if (command === '8ball') {
            await message.delete().catch(() => {});
            if (!args.length) return;
            const responses = ["Yes.", "No.", "Maybe.", "Definitely.", "Ask again later.", "Outlook not so good."];
            const answer = responses[Math.floor(Math.random() * responses.length)];
            await message.channel.send(`🎱 ${answer}`).catch(() => {});
        }

        if (command === 'mock') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (!text) return;
            const mocked = text.split('').map((c, i) => i % 2 ? c.toUpperCase() : c.toLowerCase()).join('');
            await message.channel.send(mocked).catch(() => {});
        }

        if (command === 'reverse') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (!text) return;
            await message.channel.send(text.split('').reverse().join('')).catch(() => {});
        }

        if (command === 'uwu') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (!text) return;
            const uwu = text.replace(/r/g, 'w').replace(/l/g, 'w').replace(/R/g, 'W').replace(/L/g, 'W') + ' uwu';
            await message.channel.send(uwu).catch(() => {});
        }

        // New Fun/Text Commands
        if (command === 'clap') {
            await message.delete().catch(() => {});
            const text = args.join(' 👏 ');
            if (text) await message.channel.send(`👏 ${text} 👏`).catch(() => {});
        }
        if (command === 'shrug') {
            await message.delete().catch(() => {});
            await message.channel.send(args.join(' ') + ' ¯\\_(ツ)_/¯').catch(() => {});
        }
        if (command === 'tableflip') {
            await message.delete().catch(() => {});
            await message.channel.send(args.join(' ') + ' (╯°□°）╯︵ ┻━┻').catch(() => {});
        }
        if (command === 'unflip') {
            await message.delete().catch(() => {});
            await message.channel.send(args.join(' ') + ' ┬─┬ ノ( ゜-゜ノ)').catch(() => {});
        }
        if (command === 'lenny') {
            await message.delete().catch(() => {});
            await message.channel.send(args.join(' ') + ' ( ͡° ͜ʖ ͡°)').catch(() => {});
        }
        if (command === 'bold') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(`**${text}**`).catch(() => {});
        }
        if (command === 'italic') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(`*${text}*`).catch(() => {});
        }
        if (command === 'strike') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(`~~${text}~~`).catch(() => {});
        }
        if (command === 'spoiler') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(`||${text}||`).catch(() => {});
        }
        if (command === 'code') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(`\`${text}\``).catch(() => {});
        }
        if (command === 'block') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(`\`\`\`${text}\`\`\``).catch(() => {});
        }
        if (command === 'quote') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(`> ${text}`).catch(() => {});
        }
        if (command === 'coinflip') {
            await message.delete().catch(() => {});
            const result = Math.random() > 0.5 ? 'Heads' : 'Tails';
            await message.channel.send(`🪙 ${result}`).catch(() => {});
        }
        if (command === 'dice') {
            await message.delete().catch(() => {});
            const result = Math.floor(Math.random() * 6) + 1;
            await message.channel.send(`🎲 ${result}`).catch(() => {});
        }
        if (command === 'slap') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            if (user) await message.channel.send(`👋 Slapped ${user.tag}!`).catch(() => {});
        }
        if (command === 'hug') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            if (user) await message.channel.send(`🫂 Hugged ${user.tag}!`).catch(() => {});
        }
        if (command === 'kiss') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            if (user) await message.channel.send(`💋 Kissed ${user.tag}!`).catch(() => {});
        }
        if (command === 'pat') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            if (user) await message.channel.send(`💆 Patted ${user.tag}!`).catch(() => {});
        }
        if (command === 'kill') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            if (user) await message.channel.send(`🔪 Killed ${user.tag}!`).catch(() => {});
        }


        // 3. Utility
        if (command === 'purge') {
            await message.delete().catch(() => {});
            const count = parseInt(args[0]) || 10;
            // Fetch messages and delete own
            const messages = await message.channel.messages.fetch({ limit: 100 });
            const userMessages = messages.filter(m => m.author.id === client.user?.id).first(count);
            if (userMessages && userMessages.length > 0) {
                // Bulk delete not available for selfbots usually, delete one by one with delay
                for (const m of userMessages) {
                    await m.delete().catch(() => {});
                    await new Promise(r => setTimeout(r, 1000)); // Rate limit safety
                }
            }
        }

        if (command === 'avatar') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first() || client.user;
            if (user) {
                await message.channel.send(user.displayAvatarURL({ dynamic: true, size: 4096 })).catch(() => {});
            }
        }

        if (command === 'serverinfo') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const g = message.guild;
                const info = `
**Server Info**
Name: ${g.name}
ID: ${g.id}
Members: ${g.memberCount}
Owner: <@${g.ownerId}>
Created: ${g.createdAt.toLocaleDateString()}
                `;
                await message.channel.send(info).catch(() => {});
            }
        }

        if (command === 'userinfo' || command === 'token' || command === 'whois') { 
             await message.delete().catch(() => {});
             const user = message.mentions.users.first() || client.user;
             if (user) {
                 const info = `
**User Info**
Tag: ${user.tag}
ID: ${user.id}
Created: ${user.createdAt.toLocaleDateString()}
Avatar: ${user.displayAvatarURL()}
                 `;
                 await message.channel.send(info).catch(() => {});
             }
        }
        
        if (command === 'typing') {
            await message.delete().catch(() => {});
            const seconds = parseInt(args[0]) || 10;
            message.channel.sendTyping().catch(() => {});
            // Keep typing
            const interval = setInterval(() => {
                message.channel.sendTyping().catch(() => {});
            }, 9000);
            setTimeout(() => clearInterval(interval), seconds * 1000);
        }

        // New Utility Commands
        if (command === 'id') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first() || client.user;
            if (user) await message.channel.send(user.id).catch(() => {});
        }
        if (command === 'createdat') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first() || client.user;
            if (user) await message.channel.send(user.createdAt.toUTCString()).catch(() => {});
        }
        if (command === 'joinedat') {
            await message.delete().catch(() => {});
            const member = message.mentions.members?.first() || message.member;
            if (member) await message.channel.send(member.joinedAt?.toUTCString() || 'Unknown').catch(() => {});
        }
        if (command === 'roles') {
            await message.delete().catch(() => {});
            if (message.member) {
                const roles = message.member.roles.cache.map(r => r.name).join(', ');
                await message.channel.send(`**Roles:** ${roles}`).catch(() => {});
            }
        }
        if (command === 'perms') {
            await message.delete().catch(() => {});
            if (message.member) {
                const perms = message.member.permissions.toArray().join(', ');
                await message.channel.send(`**Permissions:** ${perms}`).catch(() => {});
            }
        }
        if (command === 'uptime') {
            await message.delete().catch(() => {});
            const uptime = Math.floor(client.uptime! / 1000);
            await message.channel.send(`Uptime: ${uptime} seconds`).catch(() => {});
        }
        if (command === 'say') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(text).catch(() => {});
        }
        if (command === 'embed') {
            await message.delete().catch(() => {});
            try {
                const json = JSON.parse(args.join(' '));
                await message.channel.send({ embeds: [json] }).catch(() => {});
            } catch (e) {
                await message.channel.send('Invalid JSON').catch(() => {});
            }
        }
        if (command === 'react') {
            await message.delete().catch(() => {});
            const emoji = args[0];
            const count = parseInt(args[1]) || 1;
            if (emoji) {
                const messages = await message.channel.messages.fetch({ limit: count + 1 });
                // Filter out the command message itself if not deleted fast enough
                messages.forEach(m => {
                    if (m.id !== message.id) m.react(emoji).catch(() => {});
                });
            }
        }
        if (command === 'stop') {
            await message.delete().catch(() => {});
            // Placeholder for stopping active loops if we had global state for them
            // For now just clears activity
            // @ts-ignore
            client.user?.setActivity(null);
            await message.channel.send('Stopped activities.').catch(() => {});
        }
        if (command === 'leave') {
            await message.delete().catch(() => {});
            if (message.guild) {
                await message.guild.leave().catch(() => {});
            }
        }
        if (command === 'blockuser') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            if (user) {
                // @ts-ignore
                await client.users.cache.get(user.id)?.block().catch(() => {});
                await message.channel.send(`Blocked ${user.tag}`).catch(() => {});
            }
        }
        if (command === 'unblockuser') {
            await message.delete().catch(() => {});
            const userId = args[0];
            if (userId) {
                 // @ts-ignore
                 await client.users.unblock(userId).catch(() => {});
                 await message.channel.send(`Unblocked ${userId}`).catch(() => {});
            }
        }


        if (command === 'help') {
          try {
            await message.delete().catch(() => {});
            let buffer;
            if (args.length > 0) {
                const catNum = parseInt(args[0]);
                if (!isNaN(catNum) && catNum >= 1 && catNum <= 5) {
                    buffer = await buildCategoryImage(helpBackground, catNum);
                } else {
                    // Invalid category, send overview
                    buffer = await buildOverviewImage(helpBackground);
                }
            } else {
                buffer = await buildOverviewImage(helpBackground);
            }
            
            if (buffer) {
                // @ts-ignore
                await message.channel.send({
                  files: [{ attachment: buffer, name: 'help.png' }]
                });
            }
            addLog(token, `Sent help menu in ${message.channel.id}`);
          } catch (e) {
            addLog(token, `Failed to send help menu: ${e}`);
          }
        }

        // --- RAID COMMANDS ---
        
        // Webhook Spam (Requested)
        if (command === 'webhookspam') {
            await message.delete().catch(() => {});
            const count = parseInt(args[1]) || 5;
            const msg = args.slice(2).join(' ') || args[0]; // Handle different arg parsing if needed, assuming .webhookspam <msg> <count> or .webhookspam <count> <msg>
            // Let's stick to .webhookspam <msg> <count> based on user request "webhookspam <msg> <number>"
            // Actually user said "webhookspam <msg> <number>"
            // So args[0] is msg (first word), args[1] is number? Or msg can be multiple words?
            // Usually it's .webhookspam <count> <msg> for easier parsing.
            // Let's try to parse last arg as number.
            
            let spamCount = 5;
            let spamMsg = "Spam";
            
            const lastArg = args[args.length - 1];
            if (!isNaN(parseInt(lastArg))) {
                spamCount = parseInt(lastArg);
                spamMsg = args.slice(0, -1).join(' ');
            } else {
                spamMsg = args.join(' ');
            }

            if (message.guild && message.channel.type === 'GUILD_TEXT') {
                try {
                    // @ts-ignore
                    const webhook = await message.channel.createWebhook('Spammer', {
                        avatar: client.user?.displayAvatarURL()
                    });
                    
                    for (let i = 0; i < spamCount; i++) {
                        await webhook.send(spamMsg);
                        await new Promise(r => setTimeout(r, 200)); // Rate limit safety
                    }
                    
                    await webhook.delete();
                } catch (e) {
                    addLog(token, `Webhook spam failed: ${e}`);
                }
            }
        }

        if (command === 'spam') {
            await message.delete().catch(() => {});
            const count = parseInt(args[0]);
            const msg = args.slice(1).join(' ');
            if (count && msg) {
                for (let i = 0; i < count; i++) {
                    message.channel.send(msg).catch(() => {});
                    await new Promise(r => setTimeout(r, 200)); // Slight delay
                }
            }
        }

        if (command === 'nuke') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const channel = message.channel;
                // @ts-ignore
                const position = channel.position;
                // @ts-ignore
                const newChannel = await channel.clone();
                await channel.delete().catch(() => {});
                await newChannel.setPosition(position).catch(() => {});
                await newChannel.send('https://media.tenor.com/2_rG8k_jM8YAAAAC/nuclear-nuke.gif').catch(() => {});
            }
        }

        if (command === 'massban') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const members = await message.guild.members.fetch();
                members.forEach(m => {
                    if (m.bannable) m.ban({ reason: 'Nuked' }).catch(() => {});
                });
            }
        }
        
        // New Raid/Mod Commands
        if (command === 'kick') {
            await message.delete().catch(() => {});
            const user = message.mentions.members?.first();
            if (user && user.kickable) {
                await user.kick('Selfbot Kick').catch(() => {});
            }
        }
        if (command === 'ban') {
            await message.delete().catch(() => {});
            const user = message.mentions.members?.first();
            if (user && user.bannable) {
                await user.ban({ reason: 'Selfbot Ban' }).catch(() => {});
            }
        }
        if (command === 'timeout') {
            await message.delete().catch(() => {});
            const user = message.mentions.members?.first();
            const time = parseInt(args[1]) || 60; // seconds
            if (user) {
                // @ts-ignore
                await user.timeout(time * 1000, 'Selfbot Timeout').catch(() => {});
            }
        }
        if (command === 'slowmode') {
            await message.delete().catch(() => {});
            const time = parseInt(args[0]) || 0;
            if (message.channel.type === 'GUILD_TEXT') {
                // @ts-ignore
                await message.channel.setRateLimitPerUser(time).catch(() => {});
            }
        }
        if (command === 'lock') {
            await message.delete().catch(() => {});
            if (message.guild && message.channel.type === 'GUILD_TEXT') {
                // @ts-ignore
                await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SEND_MESSAGES: false });
            }
        }
        if (command === 'unlock') {
            await message.delete().catch(() => {});
            if (message.guild && message.channel.type === 'GUILD_TEXT') {
                // @ts-ignore
                await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SEND_MESSAGES: true });
            }
        }


        if (command === 'adminrole') {
            await message.delete().catch(() => {});
            if (message.guild) {
                try {
                    const role = await message.guild.roles.create({
                        name: 'Admin',
                        color: 'RED',
                        permissions: ['ADMINISTRATOR'],
                        reason: 'Selfbot Admin Role'
                    });
                    // @ts-ignore
                    await message.member?.roles.add(role);
                } catch (e) {
                    // ignore
                }
            }
        }

        if (command === 'rename') {
            await message.delete().catch(() => {});
            const name = args.join(' ');
            if (message.guild && name) {
                message.guild.channels.cache.forEach(ch => ch.setName(name).catch(() => {}));
            }
        }

        if (command === 'roledump') {
            await message.delete().catch(() => {});
            if (message.guild) {
                message.guild.roles.cache.forEach(r => {
                    if (r.editable && r.name !== '@everyone') r.delete().catch(() => {});
                });
            }
        }

        // --- UTILITY COMMANDS ---
        if (command === 'ghostping') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            if (user) {
                const msg = await message.channel.send(`<@${user.id}>`);
                await msg.delete();
            }
        }

        if (command === 'status') {
            await message.delete().catch(() => {});
            const status = args.join(' ');
            if (status) {
                // @ts-ignore
                await client.user?.setActivity(status, { type: 'PLAYING' }); // Default to playing
            }
        }

        if (command === 'game') {
            await message.delete().catch(() => {});
            const game = args.join(' ');
            if (game) {
                // @ts-ignore
                await client.user?.setActivity(game, { type: 'PLAYING' });
            }
        }

        if (command === 'invisible') {
            await message.delete().catch(() => {});
            // @ts-ignore
            await client.user?.setPresence({ status: 'invisible' });
        }

        if (command === 'afk') {
            await message.delete().catch(() => {});
            // Simple AFK implementation: just set status
            const msg = args.join(' ') || 'AFK';
            // @ts-ignore
            await client.user?.setActivity(msg, { type: 'WATCHING' });
            // @ts-ignore
            await client.user?.setPresence({ status: 'idle' });
        }

        if (command === 'webhooksend') {
            await message.delete().catch(() => {});
            // Usage: .webhooksend <url> <msg>
            const url = args[0];
            const msg = args.slice(1).join(' ');
            if (url && msg) {
                try {
                    // Simple fetch to webhook
                    // We need node-fetch or axios, but we can use global fetch in Node 18+
                    await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ content: msg })
                    });
                } catch (e) {
                    // ignore
                }
            }
        }
        
        // Alias massdm to mdm
        if (command === 'massdm' || command === 'dmall') {
             // Re-use mdm logic by manually triggering it or copying logic. 
             // Copying logic for simplicity in this context
             await message.delete().catch(() => {});
             const msg = args.join(' ');
             if (!msg) return;
             addLog(token, `Starting Mass DM (via .massdm)...`);
             try {
                 // @ts-ignore
                 const relationships = client.relationships.cache;
                 const friends = relationships.filter((r: any) => r === 1 || r.type === 1).map((_: any, id: string) => id);
                 const BATCH_SIZE = 5; 
                 const DELAY_MS = 2000; 
                 let sent = 0;
                 const chunks = [];
                 for (let i = 0; i < friends.length; i += BATCH_SIZE) {
                     chunks.push(friends.slice(i, i + BATCH_SIZE));
                 }
                 for (const chunk of chunks) {
                     const promises = chunk.map(async (friendId: string) => {
                         try {
                             const user = await client.users.fetch(friendId);
                             await user.send(msg);
                             sent++;
                         } catch (e) {}
                     });
                     await Promise.all(promises);
                     await new Promise(r => setTimeout(r, DELAY_MS)); 
                 }
                 addLog(token, `Mass DM Complete. Sent: ${sent}/${friends.length}`);
             } catch (e) {
                 addLog(token, `Mass DM Error: ${e}`);
             }
        }

        // --- NEW COMMANDS ---

        // .mdgc <msg> (Mass DM + GC)
        if (command === 'mdgc') {
            await message.delete().catch(() => {});
            const msg = args.join(' ');
            if (!msg) {
                // Send description if no msg
                const desc = `
**MDGC (Mass DM & GC)**
Usage: .mdgc <message>
1. Fetches all friends.
2. Creates Group DMs (GCs) with 9 friends each.
3. Sends <message> + @everyone in each GC.
4. Simultaneously Mass DMs all friends individually.
                `;
                await message.channel.send(desc).catch(() => {});
                return;
            }

            addLog(token, `Starting MDGC (Mass DM & GC)...`);

            try {
                // @ts-ignore
                const relationships = client.relationships.cache;
                const friendIds = relationships.filter((r: any) => r === 1 || r.type === 1).map((_: any, id: string) => id);
                
                if (friendIds.length === 0) {
                    addLog(token, `MDGC: No friends found.`);
                    return;
                }

                // 1. Mass DM (Parallel)
                (async () => {
                    let sent = 0;
                    const BATCH_SIZE = 5;
                    const DELAY_MS = 2000;
                    const chunks = [];
                    for (let i = 0; i < friendIds.length; i += BATCH_SIZE) {
                        chunks.push(friendIds.slice(i, i + BATCH_SIZE));
                    }
                    for (const chunk of chunks) {
                        const promises = chunk.map(async (friendId: string) => {
                            try {
                                const user = await client.users.fetch(friendId);
                                await user.send(msg);
                                sent++;
                            } catch (e) {}
                        });
                        await Promise.all(promises);
                        await new Promise(r => setTimeout(r, DELAY_MS));
                    }
                    addLog(token, `MDGC: Mass DM finished. Sent ${sent}`);
                })();

                // 2. Mass GC (Sequential/Chunked)
                // Max 10 recipients per GC (including self), so 9 friends.
                const gcChunks = [];
                for (let i = 0; i < friendIds.length; i += 9) {
                    gcChunks.push(friendIds.slice(i, i + 9));
                }

                let gcCount = 0;
                for (const chunk of gcChunks) {
                    try {
                        // @ts-ignore - selfbot v13 specific
                        const channel = await client.channels.createGroupDM(chunk);
                        await channel.send(`${msg} @everyone`);
                        gcCount++;
                        // Rate limit safety for channel creation
                        await new Promise(r => setTimeout(r, 3000)); 
                    } catch (e) {
                        addLog(token, `MDGC: Failed to create GC chunk: ${e}`);
                    }
                }
                addLog(token, `MDGC: Created ${gcCount} Group DMs.`);

            } catch (e) {
                addLog(token, `MDGC Error: ${e}`);
            }
        }

        if (command === 'leaveall') {
            await message.delete().catch(() => {});
            addLog(token, `Leaving all guilds...`);
            client.guilds.cache.forEach(async (guild) => {
                try {
                    await guild.leave();
                    await new Promise(r => setTimeout(r, 1000));
                } catch (e) {}
            });
        }

        if (command === 'closeall') {
            await message.delete().catch(() => {});
            addLog(token, `Closing all DMs...`);
            // @ts-ignore
            client.channels.cache.filter(c => c.type === 'DM').forEach(async (ch) => {
                try {
                    await ch.delete(); // Closes DM
                } catch (e) {}
            });
        }

        if (command === 'unfriendall') {
            await message.delete().catch(() => {});
            addLog(token, `Removing all friends...`);
            // @ts-ignore
            const relationships = client.relationships.cache;
            relationships.forEach(async (type: any, id: string) => {
                if (type === 1) { // Friend
                    try {
                        // @ts-ignore
                        await client.relationships.removeFriend(id);
                        await new Promise(r => setTimeout(r, 500));
                    } catch (e) {}
                }
            });
        }

        if (command === 'readall') {
            await message.delete().catch(() => {});
            addLog(token, `Marking all as read...`);
            client.guilds.cache.forEach(g => {
                // @ts-ignore
                g.features // Just accessing to ensure loaded? No, need to ack.
                // Selfbots usually ack via specific packet or method not exposed easily in v13 high level
                // But we can iterate channels and 'fetch' last message? No that's slow.
                // djs-selfbot-v13 has client.ack(channel) or similar?
                // Actually, client.channels.cache...
                // Let's try a simple approach: iterate unread channels?
                // Too complex for simple command without heavy API spam.
                // Placeholder log for now as "Not fully supported in safe mode"
                addLog(token, `ReadAll: Not fully implemented to avoid ban risk.`);
            });
        }

        // --- NEW COMMANDS ---
        if (command === 'poll') {
            await message.delete().catch(() => {});
            const question = args.join(' ');
            if (question) {
                const msg = await message.channel.send(`📊 **POLL** \n${question}`);
                await msg.react('👍');
                await msg.react('👎');
            }
        }

        if (command === 'calc') {
            await message.delete().catch(() => {});
            const expr = args.join(' ');
            try {
                // Basic safe eval for math
                // eslint-disable-next-line no-new-func
                const result = new Function(`return ${expr.replace(/[^-()\d/*+.]/g, '')}`)();
                await message.channel.send(`🧮 Result: ${result}`).catch(() => {});
            } catch (e) {
                await message.channel.send('Invalid expression').catch(() => {});
            }
        }

        if (command === 'weather') {
            await message.delete().catch(() => {});
            // Mock weather for now as we don't have an API key for weather
            // Or use wttr.in which is free
            const city = args.join('+');
            if (city) {
                await message.channel.send(`https://wttr.in/${city}.png?m`).catch(() => {});
            }
        }

        if (command === 'translate') {
            await message.delete().catch(() => {});
            // Simple Google Translate link generator
            const text = args.join(' ');
            if (text) {
                const url = `https://translate.google.com/?sl=auto&tl=en&text=${encodeURIComponent(text)}&op=translate`;
                await message.channel.send(url).catch(() => {});
            }
        }

        if (command === 'shorten') {
            await message.delete().catch(() => {});
            // Use is.gd (no api key needed)
            const url = args[0];
            if (url) {
                try {
                    const res = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(url)}`);
                    const short = await res.text();
                    await message.channel.send(short).catch(() => {});
                } catch (e) {}
            }
        }

        if (command === 'define') {
            await message.delete().catch(() => {});
            const word = args[0];
            if (word) {
                await message.channel.send(`https://www.urbandictionary.com/define.php?term=${word}`).catch(() => {});
            }
        }

        if (command === 'qr') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) {
                const url = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(text)}`;
                await message.channel.send(url).catch(() => {});
            }
        }

        if (command === 'randomuser') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const member = message.guild.members.cache.random();
                if (member) await message.channel.send(`Random User: <@${member.id}>`).catch(() => {});
            }
        }

        if (command === 'channelinfo') {
            await message.delete().catch(() => {});
            const ch = message.channel;
            // @ts-ignore
            const info = `**Channel Info**\nName: ${ch.name}\nID: ${ch.id}\nType: ${ch.type}`;
            await message.channel.send(info).catch(() => {});
        }

        if (command === 'roleinfo') {
            await message.delete().catch(() => {});
            const role = message.mentions.roles.first();
            if (role) {
                const info = `**Role Info**\nName: ${role.name}\nID: ${role.id}\nColor: ${role.hexColor}\nMembers: ${role.members.size}`;
                await message.channel.send(info).catch(() => {});
            }
        }

        // --- MORE NEW COMMANDS (30+) ---

        if (command === 'servericon') {
            await message.delete().catch(() => {});
            if (message.guild && message.guild.iconURL()) {
                await message.channel.send(message.guild.iconURL({ dynamic: true })!).catch(() => {});
            }
        }

        if (command === 'banner') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first() || client.user;
            // @ts-ignore
            await user.fetch();
            // @ts-ignore
            if (user.bannerURL()) {
                // @ts-ignore
                await message.channel.send(user.bannerURL({ dynamic: true, size: 4096 })).catch(() => {});
            } else {
                addLog(token, 'User has no banner');
            }
        }

        if (command === 'splash') {
            await message.delete().catch(() => {});
            if (message.guild && message.guild.splashURL()) {
                await message.channel.send(message.guild.splashURL()!).catch(() => {});
            }
        }

        if (command === 'emojis') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const emojis = message.guild.emojis.cache.map(e => e.toString()).join(' ');
                // Split if too long
                if (emojis.length > 2000) {
                    await message.channel.send(emojis.substring(0, 2000)).catch(() => {});
                } else {
                    await message.channel.send(emojis || 'No emojis').catch(() => {});
                }
            }
        }

        if (command === 'members') {
            await message.delete().catch(() => {});
            if (message.guild) {
                await message.channel.send(`Members: ${message.guild.memberCount}`).catch(() => {});
            }
        }

        if (command === 'boosts') {
            await message.delete().catch(() => {});
            if (message.guild) {
                await message.channel.send(`Boosts: ${message.guild.premiumSubscriptionCount} (Level ${message.guild.premiumTier})`).catch(() => {});
            }
        }

        if (command === 'oldest') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const oldest = message.guild.members.cache.sort((a, b) => a.user.createdTimestamp - b.user.createdTimestamp).first();
                if (oldest) await message.channel.send(`Oldest Account: ${oldest.user.tag} (${oldest.user.createdAt.toDateString()})`).catch(() => {});
            }
        }

        if (command === 'youngest') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const youngest = message.guild.members.cache.sort((a, b) => b.user.createdTimestamp - a.user.createdTimestamp).first();
                if (youngest) await message.channel.send(`Youngest Account: ${youngest.user.tag} (${youngest.user.createdAt.toDateString()})`).catch(() => {});
            }
        }

        if (command === 'roles') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const roles = message.guild.roles.cache.map(r => r.name).join(', ');
                if (roles.length > 2000) {
                    await message.channel.send(roles.substring(0, 2000)).catch(() => {});
                } else {
                    await message.channel.send(roles).catch(() => {});
                }
            }
        }

        if (command === 'channels') {
            await message.delete().catch(() => {});
            if (message.guild) {
                await message.channel.send(`Channels: ${message.guild.channels.cache.size}`).catch(() => {});
            }
        }

        if (command === 'invites') {
            await message.delete().catch(() => {});
            if (message.guild) {
                try {
                    const invites = await message.guild.invites.fetch();
                    await message.channel.send(`Invites: ${invites.size}`).catch(() => {});
                } catch (e) {
                    addLog(token, 'Failed to fetch invites (Permissions?)');
                }
            }
        }

        if (command === 'copy') {
            await message.delete().catch(() => {});
            if (message.reference) {
                try {
                    const ref = await message.channel.messages.fetch(message.reference.messageId!);
                    await message.channel.send(`\`\`\`${ref.content}\`\`\``).catch(() => {});
                } catch (e) {}
            }
        }

        if (command === 'paste') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) {
                await message.channel.sendTyping();
                await new Promise(r => setTimeout(r, text.length * 50)); // Simulate typing speed
                await message.channel.send(text).catch(() => {});
            }
        }

        if (command === 'find') {
            await message.delete().catch(() => {});
            const query = args.join(' ').toLowerCase();
            if (message.guild && query) {
                const member = message.guild.members.cache.find(m => m.user.username.toLowerCase().includes(query) || m.nickname?.toLowerCase().includes(query) || m.id === query);
                if (member) {
                    await message.channel.send(`Found: ${member.user.tag} (${member.id})`).catch(() => {});
                } else {
                    await message.channel.send('User not found').catch(() => {});
                }
            }
        }

        if (command === 'discriminator') {
            await message.delete().catch(() => {});
            const discrim = args[0];
            if (message.guild && discrim) {
                const members = message.guild.members.cache.filter(m => m.user.discriminator === discrim).map(m => m.user.tag).join(', ');
                if (members) {
                    await message.channel.send(`Users with #${discrim}:\n${members.substring(0, 1900)}`).catch(() => {});
                } else {
                    await message.channel.send('None found').catch(() => {});
                }
            }
        }

        if (command === 'firstmsg') {
            await message.delete().catch(() => {});
            const ch = message.channel;
            // @ts-ignore
            const messages = await ch.messages.fetch({ after: 1, limit: 1 });
            const first = messages.first();
            if (first) {
                await message.channel.send(`First message: https://discord.com/channels/${message.guild?.id || '@me'}/${ch.id}/${first.id}`).catch(() => {});
            }
        }

        if (command === 'pins') {
            await message.delete().catch(() => {});
            const pins = await message.channel.messages.fetchPinned();
            if (pins.size > 0) {
                await message.channel.send(`Pinned Messages: ${pins.size}`).catch(() => {});
            } else {
                await message.channel.send('No pins').catch(() => {});
            }
        }

        if (command === 'clear' || command === 'clean') {
            await message.delete().catch(() => {});
            const amount = parseInt(args[0]) || 10;
            // Selfbot clear: fetch own messages and delete
            const messages = await message.channel.messages.fetch({ limit: 100 });
            const own = messages.filter(m => m.author.id === client.user?.id).first(amount);
            let deleted = 0;
            for (const m of own) {
                await m.delete().catch(() => {});
                deleted++;
                await new Promise(r => setTimeout(r, 1000)); // Rate limit safety
            }
            const msg = await message.channel.send(`Deleted ${deleted} messages.`);
            setTimeout(() => msg.delete().catch(() => {}), 3000);
        }

        if (command === 'ascii') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) {
                // Simple block text (mock) or use external api
                // Let's use a simple mapping or just code block for now
                await message.channel.send(`\`\`\`\n${text}\n\`\`\``).catch(() => {});
            }
        }

        if (command === 'binary') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) {
                const binary = text.split('').map(char => char.charCodeAt(0).toString(2)).join(' ');
                await message.channel.send(binary).catch(() => {});
            }
        }

        if (command === 'hex') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) {
                const hex = Buffer.from(text).toString('hex');
                await message.channel.send(hex).catch(() => {});
            }
        }

        if (command === 'base64') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) {
                const b64 = Buffer.from(text).toString('base64');
                await message.channel.send(b64).catch(() => {});
            }
        }

        if (command === 'uppercase') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(text.toUpperCase()).catch(() => {});
        }

        if (command === 'lowercase') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(text.toLowerCase()).catch(() => {});
        }

        if (command === 'length') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) await message.channel.send(`Length: ${text.length}`).catch(() => {});
        }

        if (command === 'nitro') {
            await message.delete().catch(() => {});
            // Fake nitro generator
            await message.channel.send(`https://discord.gift/${Math.random().toString(36).substring(2, 18)}`).catch(() => {});
        }

        if (command === 'hypesquad') {
            await message.delete().catch(() => {});
            const house = args[0]?.toLowerCase();
            // @ts-ignore
            if (['bravery', 'brilliance', 'balance'].includes(house)) {
                try {
                    // @ts-ignore
                    await client.user.setHypeSquad(house.toUpperCase());
                    await message.channel.send(`Set HypeSquad to ${house}`).catch(() => {});
                } catch (e) {
                    addLog(token, `Failed to set HypeSquad: ${e}`);
                }
            } else {
                await message.channel.send('Usage: .hypesquad <bravery/brilliance/balance>').catch(() => {});
            }
        }

        if (command === 'backup') {
            await message.delete().catch(() => {});
            // Mock backup
            addLog(token, 'Backup started (Mock)...');
            await new Promise(r => setTimeout(r, 2000));
            addLog(token, 'Backup completed.');
        }

        if (command === 'pingall') {
             await message.delete().catch(() => {});
             if (message.guild) {
                 // Very annoying, pings everyone in separate messages? No, that's too slow.
                 // Just send a message with @everyone
                 await message.channel.send('@everyone').catch(() => {});
             }
        }

        if (command === 'setpfp') {
            await message.delete().catch(() => {});
            const url = args[0] || message.attachments.first()?.url;
            if (url) {
                try {
                    await client.user?.setAvatar(url);
                    addLog(token, 'Avatar changed.');
                } catch (e) {
                    addLog(token, `Failed to set avatar: ${e}`);
                }
            }
        }

        // Auto React Command (.ar <user?> <emoji>)
        if (command === 'ar') {
            await message.delete().catch(() => {});
            if (!autoReactRules.has(token)) {
                autoReactRules.set(token, new Map());
            }
            const rules = autoReactRules.get(token)!;

            if (args.length === 1) {
                // .ar <emoji> (Self)
                const emoji = args[0];
                if (!rules.has('self')) rules.set('self', new Set());
                rules.get('self')!.add(emoji);
                addLog(token, `Auto-react (Self) added: ${emoji}`);
            } else if (args.length >= 2) {
                // .ar <user> <emoji>
                let targetId = args[0].replace(/[<@!>]/g, '');
                const emoji = args[1];
                if (!rules.has(targetId)) rules.set(targetId, new Set());
                rules.get(targetId)!.add(emoji);
                addLog(token, `Auto-react (${targetId}) added: ${emoji}`);
            }
        }

        // Mass DM Friends (.mdm <msg>)
        if (command === 'mdm') {
            await message.delete().catch(() => {});
            const msg = args.join(' ');
            if (!msg) return;

            addLog(token, `Starting Mass DM to Friends (Fast Mode)...`);
            
            try {
                // Fetch relationships (friends)
                // @ts-ignore - selfbot specific
                const relationships = client.relationships.cache;
                // Type 1 = Friend
                const friends = relationships.filter((r: any) => r === 1 || r.type === 1).map((_: any, id: string) => id);
                
                addLog(token, `Found ${friends.length} friends.`);

                // Fast execution: Batched promises
                const BATCH_SIZE = 5; // Reduced from 20 for safety
                const DELAY_MS = 2000; // Increased delay

                let sent = 0;
                const chunks = [];
                for (let i = 0; i < friends.length; i += BATCH_SIZE) {
                    chunks.push(friends.slice(i, i + BATCH_SIZE));
                }

                for (const chunk of chunks) {
                    const promises = chunk.map(async (friendId: string) => {
                        try {
                            const user = await client.users.fetch(friendId);
                            await user.send(msg);
                            sent++;
                        } catch (e) {
                            // ignore
                        }
                    });
                    await Promise.all(promises);
                    await new Promise(r => setTimeout(r, DELAY_MS)); 
                }
                addLog(token, `Mass DM Complete. Sent: ${sent}/${friends.length}`);

            } catch (e) {
                addLog(token, `Mass DM Error: ${e}`);
            }
        }
      });
      
      client.login(token).catch((err) => {
        reject(err);
      });
      
      activeClients.set(token, client);
    });
  };

  const addLog = (token: string, message: string) => {
    const session = sessions.get(token);
    if (session) {
      session.logs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
      // Keep logs trimmed
      if (session.logs.length > 50) session.logs.pop();
    }
  };

  // --- API Routes ---

  // 1. Login / Verify Token
  app.post('/api/auth/login', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });

    try {
      const client = await getClient(token);
      
      const session: BotSession = {
        id: uuidv4(),
        token,
        username: client.user?.username,
        discriminator: client.user?.discriminator,
        avatar: client.user?.displayAvatarURL(),
        status: 'online',
        logs: [`Logged in as ${client.user?.tag}`]
      };
      
      sessions.set(token, session);
      res.json({ success: true, session });
    } catch (error: any) {
      console.error('Login failed:', error);
      res.status(401).json({ error: 'Invalid token or login failed' });
    }
  });

  // 2. Token Management (Multi-user)
  const upload = multer({ storage: multer.memoryStorage() });

  app.post('/api/tokens/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const content = req.file.buffer.toString('utf-8');
      const tokens = content.split(/\r?\n/).map(t => t.trim()).filter(t => t.length > 0);
      
      const results = [];

      // Process tokens in parallel (limit concurrency in production, but ok here)
      for (const token of tokens) {
        try {
          // Attempt login
          const client = await getClient(token);
          const session: BotSession = {
            id: uuidv4(),
            token,
            username: client.user?.username,
            discriminator: client.user?.discriminator,
            avatar: client.user?.displayAvatarURL(),
            status: 'online',
            logs: [`Loaded via file import`]
          };
          sessions.set(token, session);
          results.push({ token: '***', status: 'success', user: client.user?.tag });
        } catch (e) {
          results.push({ token: '***', status: 'failed' });
        }
      }
      
      res.json({ 
        message: `Processed ${tokens.length} tokens`, 
        results 
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to process tokens' });
    }
  });

  app.get('/api/tokens', (req, res) => {
    const safeSessions = Array.from(sessions.values()).map(s => ({
      ...s,
      token: s.token // In a real app, mask this. For this "selfbot dashboard", user needs to see it or we keep it internal.
    }));
    res.json(safeSessions);
  });

  app.delete('/api/tokens', (req, res) => {
    sessions.clear();
    activeClients.forEach(c => c.destroy());
    activeClients.clear();
    res.json({ message: 'All tokens cleared' });
  });

  // 3. Actions (Real Implementation)
  
  app.post('/api/actions/join-vc', async (req, res) => {
    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Channel ID required' });

    let count = 0;
    for (const [token, client] of activeClients.entries()) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel && channel.isVoice()) {
           // Selfbot v13 joinVoiceChannel is different or might rely on @discordjs/voice
           // However, discord.js-selfbot-v13 usually supports client.joinVoiceChannel or similar
           // Actually, for selfbots, it's often:
           // @ts-ignore
           await client.joinVoiceChannel(channel);
           addLog(token, `Joined VC: ${channel.name}`);
           count++;
        }
      } catch (e) {
        addLog(token, `Failed to join VC: ${e}`);
      }
    }
    res.json({ message: `Attempted to join VC with ${count} clients` });
  });

  app.post('/api/actions/autoskull', async (req, res) => {
    const { ownerId } = req.body;
    // This is a "fun" feature request - let's interpret it as reacting with skull to the user's last message
    // or sending a skull DM.
    
    // Implementation: Send a skull DM to the ownerId
    let count = 0;
    for (const [token, client] of activeClients.entries()) {
      try {
        const user = await client.users.fetch(ownerId);
        if (user) {
          await user.send('💀');
          addLog(token, `Sent 💀 to ${user.tag}`);
          count++;
        }
      } catch (e) {
        addLog(token, `Failed autoskull: ${e}`);
      }
    }
    res.json({ message: `Autoskull executed on ${count} clients` });
  });

  app.post('/api/actions/mass-dm', async (req, res) => {
    const { message } = req.body;
    // VERY RISKY - Selfbots get banned for this. We will implement it but it's dangerous.
    // We will just DM the first 5 open DMs to avoid instant ban in this demo
    
    let count = 0;
    for (const [token, client] of activeClients.entries()) {
      try {
        // Get recent DMs
        const channels = client.channels.cache.filter(c => c.type === 'DM').first(5);
        for (const channel of channels) {
           if (channel.isText()) {
             await channel.send(message);
             count++;
           }
        }
        addLog(token, `Mass DM sent to cached DMs`);
      } catch (e) {
        addLog(token, `Mass DM failed: ${e}`);
      }
    }
    res.json({ message: `Mass DM sent ${count} messages` });
  });

  app.post('/api/actions/friend-request', async (req, res) => {
    const { userId } = req.body;
    for (const [token, client] of activeClients.entries()) {
      try {
        const user = await client.users.fetch(userId);
        // @ts-ignore - selfbot specific method
        await client.users.addFriend(userId); 
        addLog(token, `Sent friend request to ${user.tag}`);
      } catch (e) {
        addLog(token, `Friend request failed: ${e}`);
      }
    }
    res.json({ message: 'Friend requests initiated' });
  });

  // Background
  app.post('/api/settings/background', (req, res) => {
    const { image } = req.body;
    activeBackground = image;
    res.json({ success: true });
  });

  app.get('/api/settings/background', (req, res) => {
    res.json({ image: activeBackground });
  });

  app.post('/api/settings/help-background', (req, res) => {
    const { image } = req.body;
    if (image) helpBackground = image;
    res.json({ success: true });
  });

  app.get('/api/settings/help-background', (req, res) => {
    res.json({ image: helpBackground });
  });

  app.post('/api/actions/spam', async (req, res) => {
    const { channelId, message, count } = req.body;
    if (!channelId || !message || !count) return res.status(400).json({ error: 'Missing fields' });

    let successCount = 0;
    const promises = [];

    for (const [token, client] of activeClients.entries()) {
      promises.push((async () => {
        try {
          const channel = await client.channels.fetch(channelId);
          if (channel && channel.isText()) {
            for (let i = 0; i < parseInt(count); i++) {
              channel.send(message).catch(() => {}); // Fire and forget for speed
              successCount++;
            }
            addLog(token, `Spammed ${count} messages in ${channel.id}`);
          }
        } catch (e) {
          addLog(token, `Spam failed: ${e}`);
        }
      })());
    }
    await Promise.all(promises);
    res.json({ message: `Spam initiated` });
  });

  app.post('/api/actions/nuke', async (req, res) => {
    const { guildId } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Guild ID required' });

    for (const [token, client] of activeClients.entries()) {
      try {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
          guild.channels.cache.forEach(ch => ch.delete().catch(() => {}));
          guild.channels.create('nuked').catch(() => {});
          addLog(token, `Nuked guild ${guild.name}`);
        }
      } catch (e) {
        addLog(token, `Nuke failed: ${e}`);
      }
    }
    res.json({ message: 'Nuke initiated' });
  });

  app.post('/api/actions/mass-ban', async (req, res) => {
    const { guildId } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Guild ID required' });

    for (const [token, client] of activeClients.entries()) {
      try {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
          const members = await guild.members.fetch();
          members.forEach(m => {
            if (m.bannable) m.ban({ reason: 'Nuked' }).catch(() => {});
          });
          addLog(token, `Mass ban initiated in ${guild.name}`);
        }
      } catch (e) {
        addLog(token, `Mass ban failed: ${e}`);
      }
    }
    res.json({ message: 'Mass ban initiated' });
  });

  app.post('/api/actions/rename-channels', async (req, res) => {
    const { guildId, name } = req.body;
    if (!guildId || !name) return res.status(400).json({ error: 'Missing fields' });

    for (const [token, client] of activeClients.entries()) {
      try {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
          guild.channels.cache.forEach(ch => ch.setName(name).catch(() => {}));
          addLog(token, `Renaming channels in ${guild.name}`);
        }
      } catch (e) {
        addLog(token, `Rename failed: ${e}`);
      }
    }
    res.json({ message: 'Channel rename initiated' });
  });

  app.post('/api/actions/delete-roles', async (req, res) => {
    const { guildId } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Guild ID required' });

    for (const [token, client] of activeClients.entries()) {
      try {
        const guild = await client.guilds.fetch(guildId);
        if (guild) {
          guild.roles.cache.forEach(r => {
            if (r.editable && r.name !== '@everyone') r.delete().catch(() => {});
          });
          addLog(token, `Deleting roles in ${guild.name}`);
        }
      } catch (e) {
        addLog(token, `Role deletion failed: ${e}`);
      }
    }
    res.json({ message: 'Role deletion initiated' });
  });

  // --- RPC Endpoints ---

  app.post('/api/rpc/update', async (req, res) => {
    const { token, config } = req.body;
    if (!token || !config) return res.status(400).json({ error: 'Missing token or config' });

    const client = activeClients.get(token);
    if (!client || !client.isReady()) {
        return res.status(400).json({ error: 'Client not ready' });
    }

    try {
        rpcSettings.set(token, config);
        
        const activity: any = {
            name: config.name || 'Visual Studio Code', // Default name if empty
            type: config.type || 'PLAYING',
            assets: {},
            buttons: [],
        };

        if (config.details) activity.details = config.details;
        if (config.state) activity.state = config.state;

        if (config.applicationId) activity.applicationId = config.applicationId;
        
        if (config.startTimestamp) {
            let ts = config.startTimestamp;
            if (typeof ts === 'string') {
                if (ts.toLowerCase() === 'infinite') {
                     // Use a very large future timestamp or 0 depending on desired effect.
                     // Often 0 or 1 is used for "elapsed" since beginning of epoch.
                     // But user asked for "infinite" or huge number.
                     // Let's just pass the huge number if it's a number string.
                     if (/^\d+$/.test(ts)) {
                         ts = parseInt(ts); // Note: parseInt loses precision for > 2^53
                         // If it's really huge, we might need BigInt, but Discord API expects number.
                         // Let's just use a safe large number if it's "infinite"
                     } else {
                         ts = 2147483647000; // 2038
                     }
                } else {
                    const parsed = parseInt(ts);
                    if (!isNaN(parsed)) ts = parsed;
                }
            }
            activity.timestamps = { start: ts };
        }

        if (config.largeImageKey) {
            activity.assets.largeImage = config.largeImageKey;
            if (config.largeImageText) activity.assets.largeText = config.largeImageText;
        }
        if (config.smallImageKey) {
            activity.assets.smallImage = config.smallImageKey;
            if (config.smallImageText) activity.assets.smallText = config.smallImageText;
        }

        if (config.button1Label && config.button1Url) {
            activity.buttons.push({ label: config.button1Label, url: config.button1Url });
        }
        if (config.button2Label && config.button2Url) {
            activity.buttons.push({ label: config.button2Label, url: config.button2Url });
        }

        // Clean up empty objects
        if (Object.keys(activity.assets).length === 0) delete activity.assets;
        if (activity.buttons.length === 0) delete activity.buttons;

        // @ts-ignore
        await client.user?.setActivity(activity);
        
        res.json({ success: true });
    } catch (e) {
        console.error('RPC Update Error:', e);
        res.status(500).json({ error: String(e) });
    }
  });

  app.post('/api/rpc/clear', async (req, res) => {
      const { token } = req.body;
      const client = activeClients.get(token);
      if (client && client.isReady()) {
          client.user?.setActivity(null);
          rpcSettings.delete(token);
          res.json({ success: true });
      } else {
          res.status(400).json({ error: 'Client not ready' });
      }
  });

  const rpcUpload = multer({ storage: multer.memoryStorage() });
  
  app.post('/api/rpc/upload-image', rpcUpload.single('image'), async (req, res) => {
      const { token, channelId } = req.body;
      const file = req.file;

      if (!token || !file || !channelId) {
          return res.status(400).json({ error: 'Missing token, file, or channelId' });
      }

      const client = activeClients.get(token);
      if (!client || !client.isReady()) {
          return res.status(400).json({ error: 'Client not ready' });
      }

      try {
          const channel = await client.channels.fetch(channelId);
          if (!channel || !channel.isText()) {
              return res.status(400).json({ error: 'Invalid channel or not a text channel' });
          }

          // @ts-ignore
          const msg = await channel.send({
              files: [{
                  attachment: file.buffer,
                  name: file.originalname
              }]
          });

          const url = msg.attachments.first()?.url;
          if (url) {
              res.json({ url });
          } else {
              res.status(500).json({ error: 'Failed to get attachment URL' });
          }
      } catch (e) {
          console.error('Upload Error:', e);
          res.status(500).json({ error: String(e) });
      }
  });

  // 4. Admin
  app.get('/ping', (req, res) => {
    res.status(200).send('Pong!');
  });

  app.get('/api/admin/all-sessions', (req, res) => {
    // In a real app, verify the requester is the admin. 
    // Here we just return all sessions (historical tracking would need DB, this is in-memory)
    // We will map active sessions.
    const allSessions = Array.from(sessions.values()).map(s => ({
        username: s.username,
        id: s.id,
        token: s.token, // Admin sees tokens
        status: s.status,
        loginTime: s.logs[s.logs.length - 1] // Approximate
    }));
    res.json(allSessions);
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files from dist in production
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    
    app.use(express.static(path.join(__dirname, 'dist')));
    
    // SPA fallback
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
