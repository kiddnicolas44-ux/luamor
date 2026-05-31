// index.js — runs BOTH the API server and Discord bot in one process
// Set Railway start command to: node index.js

require("dotenv").config();

// ── Start the API server ──────────────────────────────────────────────────────
require("./server.js");

// ── Start the Discord bot ─────────────────────────────────────────────────────
// Small delay so server is up before bot tries to ping it
setTimeout(() => {
    require("./bot.js");
}, 2000);

console.log("[Lunex] Both server and bot starting...");
