import fetch from "node-fetch";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";
import * as fs from "fs";
import * as crypto from "crypto";

const BASE = "https://discord.com/api/v9";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function randFloat(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export function randChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function humanDelay(minS = 1.5, maxS = 8.0) {
  const mean = randFloat(minS, maxS);
  return Math.min(-mean * Math.log(Math.random()), maxS * 3) * 1000;
}

export function typingDuration(text: string) {
  const cpm = randFloat(180, 420);
  const base = (text.length / cpm) * 60;
  return (base + randFloat(0.5, 2.0)) * 1000;
}

export function snowflakeToDate(id: string) {
  const ts = (BigInt(id) >> 22n) + 1420070400000n;
  return new Date(Number(ts)).toISOString();
}

function proxyAgent(proxyUrl: string | null) {
  if (!proxyUrl) return undefined;
  if (proxyUrl.startsWith("socks")) return new SocksProxyAgent(proxyUrl);
  return new HttpsProxyAgent(proxyUrl);
}

export async function apiRequest(method: string, path: string, token: string, body: any = null, proxy: string | null = null) {
  const opts: any = {
    method,
    headers: headers(token),
    agent: proxyAgent(proxy),
  };
  if (body) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(`${BASE}${path}`, opts);
    let data;
    try { data = await res.json(); } catch { data = {}; }
    return { status: res.status, data };
  } catch (e: any) {
    return { status: -1, data: { error: e.message } };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Spoofer — X-Super-Properties + fingerprint generation
// ─────────────────────────────────────────────────────────────────────────────

const CHROME_VERSIONS = ["120.0.0.0", "121.0.0.0", "122.0.0.0", "119.0.0.0", "123.0.0.0"];
const BUILD_NUMBERS   = [312345, 311987, 310876, 309234, 308765, 307654, 265476];
const LOCALES         = ["en-US", "en-GB", "en-CA", "en-AU", "de", "fr", "es-ES", "pt-BR"];
const OS_VERSIONS     = { Windows: ["10", "11"], "Mac OS X": ["10_15_7", "13_0_0", "14_0_0"] };

function seededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s ^= s >> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export function generateProfile(token: string | null = null) {
  const seedVal = token
    ? parseInt(crypto.createHash("md5").update(token).digest("hex").slice(0, 8), 16)
    : Math.random() * 0xffffffff;
  const rng = seededRng(seedVal);
  const pick = (arr: any[]) => arr[Math.floor(rng() * arr.length)];

  const os = rng() > 0.2 ? "Windows" : "Mac OS X";
  const osVer = pick(OS_VERSIONS[os as keyof typeof OS_VERSIONS]);
  const cv = pick(CHROME_VERSIONS);
  const build = pick(BUILD_NUMBERS);
  const locale = pick(LOCALES);

  const ua =
    os === "Windows"
      ? `Mozilla/5.0 (Windows NT ${osVer === "11" ? "10.0" : "10.0"}; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${cv} Safari/537.36`
      : `Mozilla/5.0 (Macintosh; Intel Mac OS X ${osVer}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${cv} Safari/537.36`;

  const superPropsObj = {
    os,
    browser: "Chrome",
    device: "",
    system_locale: locale,
    browser_user_agent: ua,
    browser_version: cv,
    os_version: osVer,
    referrer: "",
    referring_domain: "",
    referrer_current: "",
    referring_domain_current: "",
    release_channel: "stable",
    client_build_number: build,
    client_event_source: null,
  };

  const encoded = Buffer.from(JSON.stringify(superPropsObj)).toString("base64");
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${ua}|${locale}|${build}|${token || ""}`)
    .digest("base64url")
    .slice(0, 32);

  return { os, osVer, cv, build, locale, ua, encoded, fingerprint, superPropsObj };
}

const _profileCache = new Map();
export function getProfile(token: string) {
  if (!_profileCache.has(token)) _profileCache.set(token, generateProfile(token));
  return _profileCache.get(token);
}
export function rotateProfile(token: string) {
  const p = generateProfile();
  _profileCache.set(token, p);
  return p;
}

export function headers(token: string | null = null, extra: any = {}) {
  const p = token ? getProfile(token) : generateProfile();
  const h: any = {
    "Content-Type": "application/json",
    "User-Agent": p.ua,
    "X-Super-Properties": p.encoded,
    "X-Discord-Locale": p.locale,
    "Accept-Language": `${p.locale},en;q=0.9`,
    "Origin": "https://discord.com",
    "Referer": "https://discord.com/channels/@me",
    ...extra,
  };
  if (token) h["Authorization"] = token;
  return h;
}

export const Spoofer = {
  generateProfile,
  getProfile,
  rotateProfile,
  headers,
  encode: (obj: any) => Buffer.from(JSON.stringify(obj)).toString("base64"),
  decode: (b64: string) => JSON.parse(Buffer.from(b64, "base64").toString()),
};

// ─────────────────────────────────────────────────────────────────────────────
// AccountManager
// ─────────────────────────────────────────────────────────────────────────────

export const ACCOUNT_STATUS = {
  IDLE: "idle",
  ONLINE: "online",
  BANNED: "banned",
  INVALID: "invalid",
  RATE_LIMITED: "rate_limited",
};

const FLAG_BITS: any = {
  [1 << 0]:  "Discord Staff",
  [1 << 1]:  "Partner",
  [1 << 2]:  "HypeSquad Events",
  [1 << 3]:  "Bug Hunter L1",
  [1 << 6]:  "HypeSquad Bravery",
  [1 << 7]:  "HypeSquad Brilliance",
  [1 << 8]:  "HypeSquad Balance",
  [1 << 9]:  "Early Supporter",
  [1 << 14]: "Bug Hunter L2",
  [1 << 17]: "Early Verified Bot Dev",
  [1 << 22]: "Active Developer",
};

export function parseFlags(flags: number) {
  return Object.entries(FLAG_BITS)
    .filter(([bit]) => flags & Number(bit))
    .map(([, name]) => name as string);
}

export class AccountManager {
  filePath: string;
  accounts: any[];

  constructor(filePath = "accounts.json") {
    this.filePath = filePath;
    this.accounts = [];
    this._load();
  }

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, "utf8");
      this.accounts = JSON.parse(raw);
    } catch {
      this.accounts = [];
    }
  }

  save() {
    fs.writeFileSync(this.filePath, JSON.stringify(this.accounts, null, 2));
  }

  add(token: string, proxy: string | null = null, label: string | null = null) {
    const acc = {
      token, proxy, label,
      status: ACCOUNT_STATUS.IDLE,
      lastChecked: 0,
      username: null, userId: null, email: null,
      phone: null, nitro: false, flags: [],
    };
    this.accounts.push(acc);
    this.save();
    return acc;
  }

  remove(token: string) {
    this.accounts = this.accounts.filter((a) => a.token !== token);
    this.save();
  }

  get(token: string) {
    return this.accounts.find((a) => a.token === token) || null;
  }

  async checkAccount(acc: any) {
    const { status, data } = await apiRequest("GET", "/users/@me", acc.token, null, acc.proxy);
    acc.lastChecked = Date.now();

    if (status === 200) {
      acc.username = `${data.username}#${data.discriminator || "0"}`;
      acc.userId = data.id;
      acc.email = data.email || null;
      acc.phone = data.phone || null;
      acc.nitro = (data.premium_type || 0) > 0;
      acc.flags = parseFlags((data.flags || 0) | (data.public_flags || 0));
      acc.status = ACCOUNT_STATUS.ONLINE;
    } else if (status === 401) {
      acc.status = ACCOUNT_STATUS.INVALID;
    } else if (status === 403) {
      acc.status = ACCOUNT_STATUS.BANNED;
    } else if (status === 429) {
      acc.status = ACCOUNT_STATUS.RATE_LIMITED;
    } else {
      acc.status = ACCOUNT_STATUS.INVALID;
    }

    this.save();
    return acc;
  }

  async checkAll(concurrency = 5) {
    const results = [];
    const queue = [...this.accounts];
    const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
      while (queue.length) {
        const acc = queue.shift();
        if (acc) results.push(await this.checkAccount(acc));
      }
    });
    await Promise.all(workers);
    return results;
  }

  summary() {
    const counts: any = Object.fromEntries(Object.values(ACCOUNT_STATUS).map((s) => [s, 0]));
    for (const a of this.accounts) counts[a.status]++;
    return { total: this.accounts.length, ...counts };
  }

  listByStatus(status: string) {
    return this.accounts.filter((a) => a.status === status);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TokenChecker
// ─────────────────────────────────────────────────────────────────────────────

const NITRO_TYPES: any = { 0: "None", 1: "Classic", 2: "Boost", 3: "Basic" };

export async function checkToken(token: string, proxy: string | null = null) {
  const result: any = {
    token, valid: false, banned: false, rateLimited: false, error: null,
    userId: null, username: null, discriminator: null, globalName: null,
    email: null, phone: null, verified: false, mfaEnabled: false,
    nitroType: "None", flags: [], rawFlags: 0, locale: null, createdAt: null,
    guildCount: 0, guilds: [], dmCount: 0, friendCount: 0, blockedCount: 0,
    connections: [], hasBilling: false, billingSources: [], boosts: [],
  };

  const { status, data } = await apiRequest("GET", "/users/@me", token, null, proxy);

  if (status === 401) { result.error = "Invalid token"; return result; }
  if (status === 403) { result.banned = true; result.error = "Banned/locked"; return result; }
  if (status === 429) { result.rateLimited = true; result.error = "Rate limited"; return result; }
  if (status !== 200) { result.error = `HTTP ${status}`; return result; }

  result.valid = true;
  result.userId = data.id;
  result.username = data.username;
  result.discriminator = data.discriminator || "0";
  result.globalName = data.global_name || null;
  result.email = data.email || null;
  result.phone = data.phone || null;
  result.verified = data.verified || false;
  result.mfaEnabled = data.mfa_enabled || false;
  result.nitroType = NITRO_TYPES[data.premium_type || 0] || "Unknown";
  result.rawFlags = (data.flags || 0) | (data.public_flags || 0);
  result.flags = parseFlags(result.rawFlags);
  result.locale = data.locale || null;
  if (data.id) result.createdAt = snowflakeToDate(data.id);

  const endpoints = [
    ["/users/@me/guilds?with_counts=true", "guilds"],
    ["/users/@me/channels", "channels"],
    ["/users/@me/relationships", "relationships"],
    ["/users/@me/connections", "connections"],
    ["/users/@me/billing/payment-sources", "billing"],
    ["/users/@me/guilds/premium/subscription-slots", "boosts"],
  ];

  const responses = await Promise.all(
    endpoints.map(([path]) => apiRequest("GET", path, token, null, proxy))
  );

  responses.forEach(({ status: s, data: d }, i) => {
    const key = endpoints[i][1];
    if (s !== 200 || !Array.isArray(d)) return;

    if (key === "guilds") {
      result.guildCount = d.length;
      result.guilds = d.map((g: any) => ({
        id: g.id, name: g.name, owner: g.owner,
        memberCount: g.approximate_member_count,
      }));
    } else if (key === "channels") {
      result.dmCount = d.length;
    } else if (key === "relationships") {
      result.friendCount = d.filter((r: any) => r.type === 1).length;
      result.blockedCount = d.filter((r: any) => r.type === 2).length;
    } else if (key === "connections") {
      result.connections = d.map((c: any) => ({ type: c.type, name: c.name, verified: c.verified }));
    } else if (key === "billing") {
      result.hasBilling = d.length > 0;
      result.billingSources = d.map((b: any) => ({
        type: b.type, brand: b.brand, last4: b.last_4, country: b.country,
      }));
    } else if (key === "boosts") {
      result.boosts = d;
    }
  });

  return result;
}

export async function checkTokens(tokens: string[], proxy: string | null = null, concurrency = 5) {
  const results = [];
  const queue = [...tokens];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const t = queue.shift();
      if (t) results.push(await checkToken(t, proxy));
    }
  });
  await Promise.all(workers);
  return results;
}

export const TokenChecker = { checkToken, checkTokens };

// ─────────────────────────────────────────────────────────────────────────────
// Warmup
// ─────────────────────────────────────────────────────────────────────────────

export const FILLER_MESSAGES = [
  "lol", "yeah", "fr fr", "nah", "wait what", "ok", "lmao", "bro",
  "actually yeah", "hmm", "no way", "true", "wait", "same", "idk",
  "maybe", "i mean", "thats crazy", "oh ok", "based", "ngl", "fr", "bruh",
];
export const REACTIONS = ["👍", "😂", "🔥", "💀", "😭", "✅", "❤️", "🤔", "👀", "😅"];

export class Warmup {
  token: string;
  channels: string[];
  proxy: string | null;
  cfg: any;
  sessionsCompleted: number;
  totalMessagesSent: number;
  log: any[];
  _running: boolean;

  constructor(token: string, channels: string[], opts: any = {}) {
    this.token = token;
    this.channels = channels;
    this.proxy = opts.proxy || null;
    this.cfg = {
      minMessages: opts.minMessages ?? 3,
      maxMessages: opts.maxMessages ?? 12,
      reactChance: opts.reactChance ?? 0.35,
      typingIndicator: opts.typingIndicator ?? true,
      interSessionHours: opts.interSessionHours ?? [1.0, 6.0],
      channelSwitchChance: opts.channelSwitchChance ?? 0.2,
      activeHoursStart: opts.activeHoursStart ?? 10,
      activeHoursEnd: opts.activeHoursEnd ?? 23,
    };
    this.sessionsCompleted = 0;
    this.totalMessagesSent = 0;
    this.log = [];
    this._running = false;
  }

  _log(action: string, detail = "") {
    const entry = { ts: Date.now(), action, detail };
    this.log.push(entry);
    console.log(`[WARMUP][${this.token.slice(0, 15)}...] ${action}: ${detail}`);
  }

  async _sendTyping(channelId: string) {
    await apiRequest("POST", `/channels/${channelId}/typing`, this.token, {}, this.proxy);
  }

  async _sendMessage(channelId: string, content: string) {
    return apiRequest("POST", `/channels/${channelId}/messages`, this.token, { content }, this.proxy);
  }

  async _getRecentMessages(channelId: string) {
    const { status, data } = await apiRequest(
      "GET", `/channels/${channelId}/messages?limit=10`, this.token, null, this.proxy
    );
    return status === 200 && Array.isArray(data) ? data : [];
  }

  async _addReaction(channelId: string, messageId: string, emoji: string) {
    const enc = encodeURIComponent(emoji);
    return apiRequest(
      "PUT",
      `/channels/${channelId}/messages/${messageId}/reactions/${enc}/@me`,
      this.token, {}, this.proxy
    );
  }

  async runSession() {
    const now = new Date();
    const hour = now.getUTCHours();
    if (hour < this.cfg.activeHoursStart || hour >= this.cfg.activeHoursEnd) {
      this._log("SKIP", `Outside active hours (${hour} UTC)`);
      return;
    }

    const channels = [...this.channels].sort(() => Math.random() - 0.5);
    const msgCount = randInt(this.cfg.minMessages, this.cfg.maxMessages);
    let sent = 0;

    for (let i = 0; i < msgCount; i++) {
      let channelId = randChoice(channels);
      if (i > 0 && Math.random() < this.cfg.channelSwitchChance) {
        channelId = randChoice(channels);
        await sleep(humanDelay(3000, 15000));
      }

      if (Math.random() < this.cfg.reactChance) {
        const msgs = await this._getRecentMessages(channelId);
        if (msgs.length) {
          const msg = randChoice(msgs.slice(0, 5));
          const emoji = randChoice(REACTIONS);
          await this._addReaction(channelId, msg.id, emoji);
          this._log("REACT", `channel=${channelId} emoji=${emoji}`);
          await sleep(humanDelay(1000, 4000));
        }
      }

      const text = randChoice(FILLER_MESSAGES);

      if (this.cfg.typingIndicator) {
        await this._sendTyping(channelId);
        await sleep(typingDuration(text));
      }

      const { status, data } = await this._sendMessage(channelId, text);
      if (status === 200) {
        sent++;
        this.totalMessagesSent++;
        this._log("MSG", `channel=${channelId} text=${JSON.stringify(text)}`);
      } else if (status === 429) {
        const retry = (data?.retry_after || 5) * 1000;
        this._log("RATELIMIT", `retry_after=${data?.retry_after}`);
        await sleep(retry + randFloat(1000, 3000));
      } else {
        this._log("ERROR", `status=${status}`);
      }

      await sleep(humanDelay(4000, 25000));
    }

    this.sessionsCompleted++;
    this._log("SESSION_END", `sent=${sent}/${msgCount}`);
  }

  async start(maxSessions: number | null = null) {
    this._running = true;
    let n = 0;
    while (this._running) {
      if (maxSessions !== null && n >= maxSessions) break;
      await this.runSession();
      n++;
      const gapH = randFloat(this.cfg.interSessionHours[0], this.cfg.interSessionHours[1]);
      this._log("SLEEP", `next session in ${gapH.toFixed(1)}h`);
      await sleep(gapH * 3600 * 1000);
    }
  }

  stop() {
    this._running = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FriendAutomator
// ─────────────────────────────────────────────────────────────────────────────

export const FRIEND_STATUS = {
  PENDING:  "pending",
  ACCEPTED: "accepted",
  MESSAGED: "messaged",
  FAILED:   "failed",
  BLOCKED:  "blocked",
  ALREADY:  "already",
};

export const DEFAULT_MESSAGES = ["hey", "hi", "hello", "hai?", "hihi", "heyyo"];

export class FriendAutomator {
  token: string;
  proxy: string | null;
  cfg: any;
  targets: any[];
  stateFile: string | null;
  _msgIndex: number;

  constructor(token: string, opts: any = {}) {
    this.token = token;
    this.proxy = opts.proxy || null;
    this.cfg = {
      delayMin: (opts.delayMin ?? 4) * 1000,
      delayMax: (opts.delayMax ?? 12) * 1000,
      postAcceptDelayMin: (opts.postAcceptDelayMin ?? 2) * 1000,
      postAcceptDelayMax: (opts.postAcceptDelayMax ?? 8) * 1000,
      acceptTimeout: (opts.acceptTimeout ?? 0) * 1000,
      acceptPollInterval: (opts.acceptPollInterval ?? 30) * 1000,
      waveOnAdd: opts.waveOnAdd ?? false,
      messageOnAccept: opts.messageOnAccept ?? true,
      messageTemplates: opts.messageTemplates || DEFAULT_MESSAGES,
      randomMessage: opts.randomMessage ?? true,
    };
    this.targets = [];
    this.stateFile = opts.stateFile || null;
    this._msgIndex = 0;

    if (this.stateFile) this._loadState();
  }

  _loadState() {
    try {
      const raw = fs.readFileSync(this.stateFile, "utf8");
      this.targets = JSON.parse(raw);
    } catch { this.targets = []; }
  }

  _saveState() {
    if (this.stateFile)
      fs.writeFileSync(this.stateFile, JSON.stringify(this.targets, null, 2));
  }

  addByIds(ids: string[]) {
    const existing = new Set(this.targets.map((t) => t.userId).filter(Boolean));
    for (const id of ids) {
      if (!existing.has(id))
        this.targets.push({ userId: id, username: null, discriminator: null, status: FRIEND_STATUS.PENDING, dmChannelId: null, error: null });
    }
  }

  addByUsernames(entries: string[]) {
    const existing = new Set(
      this.targets.filter((t) => t.username).map((t) => `${t.username}#${t.discriminator}`)
    );
    for (const entry of entries) {
      const [username, disc = "0"] = entry.includes("#") ? entry.split("#") : [entry, "0"];
      if (!existing.has(`${username}#${disc}`))
        this.targets.push({ userId: null, username, discriminator: disc, status: FRIEND_STATUS.PENDING, dmChannelId: null, error: null });
    }
  }

  _nextMessage() {
    const t = this.cfg.messageTemplates;
    if (this.cfg.randomMessage) return randChoice(t);
    return t[this._msgIndex++ % t.length];
  }

  async _sendFR(target: any, captchaKey: string | null = null) {
    const headers: any = { ...this.token ? { 'Authorization': this.token } : {} };
    if (captchaKey) headers['X-Captcha-Key'] = captchaKey;

    if (target.userId) {
      return apiRequest("PUT", `/users/@me/relationships/${target.userId}`, this.token, { type: 1, captcha_key: captchaKey }, this.proxy);
    }
    const payload: any = { username: target.username, captcha_key: captchaKey };
    if (target.discriminator !== "0") payload.discriminator = target.discriminator;
    return apiRequest("POST", "/users/@me/relationships", this.token, payload, this.proxy);
  }

  async _openDM(userId: string) {
    const { status, data } = await apiRequest("POST", "/users/@me/channels", this.token, { recipient_id: userId }, this.proxy);
    return status === 200 ? data.id : null;
  }

  async _sendDM(channelId: string, content: string) {
    return apiRequest("POST", `/channels/${channelId}/messages`, this.token, { content }, this.proxy);
  }

  async _getRelationships() {
    const { status, data } = await apiRequest("GET", "/users/@me/relationships", this.token, null, this.proxy);
    return status === 200 && Array.isArray(data) ? data : [];
  }

  async _handleTarget(target: any, captchaKey: string | null = null) {
    if ([FRIEND_STATUS.MESSAGED, FRIEND_STATUS.BLOCKED, FRIEND_STATUS.ALREADY].includes(target.status)) return;

    if (target.status === FRIEND_STATUS.PENDING) {
      const { status, data } = await this._sendFR(target, captchaKey);

      if (status === 200 || status === 204) {
        target.addedAt = Date.now();
        if (!target.userId && data?.id) target.userId = data.id;
        console.log(`[FRIEND] FR sent → ${target.userId || target.username}`);
      } else if (status === 429) {
        const retry = (data?.retry_after || 5) * 1000;
        console.warn(`[FRIEND] Rate limited, sleeping ${data?.retry_after}s`);
        await sleep(retry + randFloat(1000, 3000));
        return;
      } else if (status === 400) {
        const msg = JSON.stringify(data);
        target.status = msg.includes("80007") ? FRIEND_STATUS.BLOCKED
          : msg.toLowerCase().includes("already") ? FRIEND_STATUS.ALREADY
          : FRIEND_STATUS.FAILED;
        target.error = msg;
        console.warn(`[FRIEND] FR failed (${status}): ${msg}`);
        this._saveState();
        return;
      } else {
        target.status = FRIEND_STATUS.FAILED;
        target.error = `HTTP ${status}`;
        this._saveState();
        return;
      }
    }

    if (this.cfg.waveOnAdd && target.userId) {
      const ch = await this._openDM(target.userId);
      if (ch) {
        await this._sendDM(ch, "👋");
        console.log(`[FRIEND] Waved → ${target.userId}`);
        await sleep(randFloat(1000, 3000));
      }
    }

    if (this.cfg.acceptTimeout > 0 && target.userId) {
      const deadline = Date.now() + this.cfg.acceptTimeout;
      while (Date.now() < deadline) {
        const rels = await this._getRelationships();
        const found = rels.find((r: any) => r.id === target.userId && r.type === 1);
        if (found) { target.status = FRIEND_STATUS.ACCEPTED; break; }
        await sleep(this.cfg.acceptPollInterval);
      }
    }

    if (this.cfg.messageOnAccept && target.status === FRIEND_STATUS.ACCEPTED && target.userId) {
      await sleep(randFloat(this.cfg.postAcceptDelayMin, this.cfg.postAcceptDelayMax));
      const ch = target.dmChannelId || await this._openDM(target.userId);
      if (ch) {
        target.dmChannelId = ch;
        const msg = this._nextMessage();
        const { status } = await this._sendDM(ch, msg);
        if (status === 200) {
          target.status = FRIEND_STATUS.MESSAGED;
          target.messagedAt = Date.now();
          console.log(`[FRIEND] Messaged '${msg}' → ${target.userId}`);
        }
      }
    }

    this._saveState();
  }

  async run(concurrency = 1, captchaKey: string | null = null) {
    const pending = this.targets.filter((t) => t.status === FRIEND_STATUS.PENDING);
    console.log(`[FRIEND] Processing ${pending.length} targets...`);

    const queue = [...pending];
    const workers = Array.from({ length: Math.min(concurrency, queue.length || 1) }, async () => {
      while (queue.length) {
        const t = queue.shift();
        if (t) {
            await this._handleTarget(t, captchaKey);
            await sleep(randFloat(this.cfg.delayMin, this.cfg.delayMax));
        }
      }
    });
    await Promise.all(workers);
    this._printSummary();
  }

  _printSummary() {
    const counts: any = Object.fromEntries(Object.values(FRIEND_STATUS).map((s) => [s, 0]));
    for (const t of this.targets) counts[t.status]++;
    console.log("\n--- Friend Summary ---");
    for (const [s, c] of Object.entries(counts)) if (c) console.log(`  ${s.padEnd(12)}: ${c}`);
    console.log(`  ${"total".padEnd(12)}: ${this.targets.length}`);
  }
}
