const WebSocket = require("ws");
const https = require("https");

// ⚡ Keep-alive agent (reuses TLS connections)
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: Infinity,
  maxFreeSockets: Infinity
});

const token = process.env.DISCORD_TOKEN || "YOUR_USER_TOKEN";
const GATEWAY = "wss://gateway.discord.gg/?v=10&encoding=json";

if (token === "YOUR_USER_TOKEN") {
    console.error("Please set the DISCORD_TOKEN environment variable or edit the script.");
    process.exit(1);
}

const ws = new WebSocket(GATEWAY);

// ⚡ Pre-create request options (faster reuse)
function claim(code) {
  const options = {
    hostname: "discord.com",
    path: `/api/v9/entitlements/gift-codes/${code}/redeem`,
    method: "POST",
    headers: {
      "Authorization": token,
      "Content-Type": "application/json",
      "Connection": "keep-alive",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    },
    agent
  };

  // ⚡ Multiple parallel requests (race condition)
  for (let i = 0; i < 3; i++) {
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode === 200) {
          console.log(`✅ SUCCESS! Sniped Nitro: ${code}`);
        } else {
          console.log(`❌ Failed: ${res.statusCode} - ${data}`);
        }
      });
    });
    req.on("error", (err) => console.error(`❌ Error: ${err.message}`));
    req.write(JSON.stringify({ channel_id: null }));
    req.end();
  }
}

ws.on("open", () => {
  console.log("Connected to Discord Gateway");
  ws.send(JSON.stringify({
    op: 2,
    d: {
      token: token,
      properties: { os: "linux", browser: "chrome", device: "chrome" }
    }
  }));
});

ws.on("message", (data) => {
  const payload = JSON.parse(data);
  if (payload.t === "MESSAGE_CREATE") {
    const content = payload.d.content;
    const giftRegex = /(discord\.gift\/|discord\.com\/gifts\/|discordapp\.com\/gifts\/)([a-zA-Z0-9]+)/gi;
    const match = giftRegex.exec(content);
    if (match) {
      const code = match[2];
      console.log(`⚡ Detected Nitro: ${code}`);
      claim(code);
    }
  }
  if (payload.op === 10) {
    setInterval(() => ws.send(JSON.stringify({ op: 1, d: null })), payload.d.heartbeat_interval);
  }
});

ws.on("error", (err) => console.error("WebSocket Error:", err));
ws.on("close", () => console.log("Connection closed."));
