require("dotenv").config();
const {
    Client, GatewayIntentBits, GatewayIntentBit,
    SlashCommandBuilder, REST, Routes,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    PermissionFlagsBits, ActivityType, StringSelectMenuBuilder
} = require("discord.js");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

// ── Keep-alive on Railway ─────────────────────────────────────────────────────
process.on("SIGTERM", () => { console.log("[Bot] SIGTERM — staying alive"); });
process.on("SIGINT",  () => { console.log("[Bot] SIGINT  — staying alive"); });
process.on("uncaughtException",  err => console.error("[Bot] Uncaught:", err));
process.on("unhandledRejection", err => console.error("[Bot] Unhandled rejection:", err));

const sb     = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SECRET = process.env.MASTER_SECRET;
const BASE   = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${process.env.PORT || 3000}`;

// ── Colors ────────────────────────────────────────────────────────────────────
const C = { main: 0x6366f1, ok: 0x10b981, err: 0xf43f5e, warn: 0xf59e0b, info: 0x06b6d4 };

// ── Fetch helpers ─────────────────────────────────────────────────────────────
async function iPost(path, body) {
    const r = await fetch(`${BASE}${path}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: SECRET, ...body })
    });
    return r.json();
}
async function iGet(path, params = {}) {
    const qs = new URLSearchParams({ secret: SECRET, ...params }).toString();
    const r  = await fetch(`${BASE}${path}?${qs}`);
    return r.json();
}
async function ownerApi(method, path, apiKey, body) {
    const r = await fetch(`${BASE}${path}`, {
        method, headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: body ? JSON.stringify(body) : undefined
    });
    return r.json();
}

// ── Guild config ──────────────────────────────────────────────────────────────
async function getCfg(guildId) {
    const { data } = await sb.from("bot_configs").select("*").eq("guild_id", guildId).single();
    return data;
}
async function setCfg(guildId, updates) {
    const { data } = await sb.from("bot_configs")
        .upsert({ guild_id: guildId, ...updates, updated_at: new Date().toISOString() }, { onConflict: "guild_id" })
        .select().single();
    return data;
}

// ── Duration parser ───────────────────────────────────────────────────────────
function parseDuration(str) {
    // "30m", "2h", "1d", "lifetime"
    if (!str || str === "lifetime" || str === "0") return null;
    const num = parseInt(str);
    if (isNaN(num)) return null;
    const unit = str.replace(/\d+/g, "").toLowerCase();
    const mul  = unit === "d" ? 86400 : unit === "h" ? 3600 : unit === "m" ? 60 : 3600;
    return Math.floor(Date.now() / 1000) + num * mul;
}

function formatExpiry(k) {
    if (!k.expires_at) return "♾️ Lifetime";
    const sec = k.expires_at - Math.floor(Date.now() / 1000);
    if (sec <= 0) return "⛔ Expired";
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
    if (d > 0) return `⏳ ${d}d ${h}h`;
    if (h > 0) return `⏳ ${h}h ${m}m`;
    return `⏳ ${m}m`;
}

function isManager(member, cfg) {
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (cfg?.manager_role_id && member.roles.cache.has(cfg.manager_role_id)) return true;
    return false;
}

// ── CONTROL PANEL ─────────────────────────────────────────────────────────────
function buildPanel(cfg) {
    const name = cfg?.project_name || "Script";
    return {
        embeds: [new EmbedBuilder()
            .setColor(C.main)
            .setAuthor({ name: "Lunex Whitelist", iconURL: "https://cdn.discordapp.com/embed/avatars/0.png" })
            .setTitle(`${name} Control Panel`)
            .setDescription(
                `This control panel is for the project: **${name}**\n` +
                `If you're a buyer, click the buttons below to redeem your key, get the script, or get your role.`
            )
            .setFooter({ text: `Lunex • ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}` })
            .setTimestamp()
        ],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId("p_redeem").setLabel("Redeem Key").setEmoji("🔑").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId("p_script").setLabel("Get Script").setEmoji("📋").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId("p_role").setLabel("Get Role").setEmoji("🎭").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("p_hwid").setLabel("Reset HWID").setEmoji("⚙️").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId("p_stats").setLabel("Get Stats").setEmoji("📊").setStyle(ButtonStyle.Secondary)
            )
        ]
    };
}

function genKey(prefix = "LUNEX") {
    const s = () => crypto.randomBytes(3).toString("hex").toUpperCase();
    return `${prefix}-${s()}-${s()}-${s()}`;
}
function genApiKey() { return crypto.randomBytes(32).toString("hex"); }

// ── CLIENT ─────────────────────────────────────────────────────────────────────
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

// ── SLASH COMMANDS ─────────────────────────────────────────────────────────────
const commands = [
    new SlashCommandBuilder().setName("login").setDescription("Link this server to your Lunex account")
        .addStringOption(o => o.setName("api_key").setDescription("Your API key from the dashboard").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder().setName("setup").setDescription("Configure project and roles")
        .addStringOption(o => o.setName("project_id").setDescription("Project ID from dashboard").setRequired(true))
        .addRoleOption(o => o.setName("buyer_role").setDescription("Role given to buyers").setRequired(true))
        .addRoleOption(o => o.setName("manager_role").setDescription("Role that can manage keys"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder().setName("panel").setDescription("Post the user control panel in this channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder().setName("create-key").setDescription("Create a key for a user")
        .addStringOption(o => o.setName("duration").setDescription("Duration e.g. 30m, 2h, 7d, lifetime").setRequired(true))
        .addUserOption(o => o.setName("user").setDescription("Discord user (optional)"))
        .addStringOption(o => o.setName("note").setDescription("Note for this key")),

    new SlashCommandBuilder().setName("create-api-key").setDescription("Create an owner API key (access to dashboard)")
        .addStringOption(o => o.setName("email").setDescription("Email for this account").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Duration e.g. 30d, 1h, lifetime").setRequired(true))
        .addStringOption(o => o.setName("plan").setDescription("Plan tier").addChoices(
            { name: "Starter", value: "starter" },
            { name: "Pro", value: "pro" },
            { name: "Elite", value: "elite" }
        ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder().setName("whitelist").setDescription("Whitelist a user (generates a key)")
        .addUserOption(o => o.setName("user").setDescription("User to whitelist").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Duration e.g. 7d, 30d, lifetime (default: lifetime)"))
        .addStringOption(o => o.setName("note").setDescription("Note for this key")),

    new SlashCommandBuilder().setName("revoke").setDescription("Revoke a user's key")
        .addUserOption(o => o.setName("user").setDescription("User to revoke").setRequired(true)),

    new SlashCommandBuilder().setName("resethwid").setDescription("Reset a user's HWID lock")
        .addUserOption(o => o.setName("user").setDescription("User to reset").setRequired(true)),

    new SlashCommandBuilder().setName("extend").setDescription("Extend a user's key")
        .addUserOption(o => o.setName("user").setDescription("User to extend").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Duration to add e.g. 7d, 24h").setRequired(true)),

    new SlashCommandBuilder().setName("keyinfo").setDescription("View a user's key information")
        .addUserOption(o => o.setName("user").setDescription("User to look up").setRequired(true)),

    new SlashCommandBuilder().setName("genkeys").setDescription("Generate bulk unused keys")
        .addIntegerOption(o => o.setName("amount").setDescription("Amount (max 500)").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Duration e.g. 7d, lifetime"))
        .addStringOption(o => o.setName("note").setDescription("Note for batch")),

    new SlashCommandBuilder().setName("stats").setDescription("View server whitelist stats")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder().setName("announce").setDescription("DM an announcement to all whitelisted users")
        .addStringOption(o => o.setName("message").setDescription("Announcement text").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands.map(c => c.toJSON()) });
    console.log("[Bot] Commands registered");
}

// ── INTERACTION ROUTER ────────────────────────────────────────────────────────
client.on("interactionCreate", async interaction => {
    try {
        if (interaction.isChatInputCommand()) await handleSlash(interaction);
        else if (interaction.isButton())       await handleButton(interaction);
        else if (interaction.isModalSubmit())  await handleModal(interaction);
    } catch(e) {
        console.error("[Bot] Interaction error:", e);
        const txt = "An error occurred. Try again.";
        if (interaction.deferred || interaction.replied) {
            interaction.editReply({ content: txt, embeds: [], components: [] }).catch(() => {});
        } else {
            interaction.reply({ content: txt, ephemeral: true }).catch(() => {});
        }
    }
});

// ── REPLY HELPERS ─────────────────────────────────────────────────────────────
const reply    = (i, desc, col = C.main) => i.editReply({ embeds: [new EmbedBuilder().setColor(col).setDescription(desc)], components: [] });
const replyEmb = (i, emb) => i.editReply({ embeds: [emb], components: [] });

// ═══════════════════════════════════════════════════════════════════════════════
// SLASH COMMANDS
// ═══════════════════════════════════════════════════════════════════════════════
async function handleSlash(i) {
    const { commandName, guildId } = i;
    await i.deferReply({ ephemeral: true });
    const cfg    = await getCfg(guildId);
    const member = i.member;

    // ── /login ────────────────────────────────────────────────────────────────
    if (commandName === "login") {
        if (!member.permissions.has(PermissionFlagsBits.Administrator))
            return reply(i, "❌ Admins only", C.err);
        const apiKey = i.options.getString("api_key");
        const d = await ownerApi("GET", "/v1/account", apiKey);
        if (!d.success) return reply(i, "❌ Invalid API key — check your dashboard", C.err);
        await setCfg(guildId, { api_key: apiKey, email: d.account.email, plan: d.account.plan });
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("✅ Server Linked!")
            .addFields(
                { name: "Account", value: d.account.email || "—", inline: true },
                { name: "Plan", value: `\`${d.account.plan || "starter"}\``, inline: true }
            ).setDescription("Run `/setup` to configure your project and roles."));
    }

    if (!cfg?.api_key && !["login"].includes(commandName))
        return reply(i, "❌ Run `/login <api_key>` first to link this server.", C.err);

    // ── /setup ────────────────────────────────────────────────────────────────
    if (commandName === "setup") {
        if (!member.permissions.has(PermissionFlagsBits.Administrator))
            return reply(i, "❌ Admins only", C.err);
        const projectId   = i.options.getString("project_id");
        const buyerRole   = i.options.getRole("buyer_role");
        const managerRole = i.options.getRole("manager_role");
        const projs = await ownerApi("GET", "/v1/projects", cfg.api_key);
        const proj  = projs.projects?.find(p => p.id === projectId);
        if (!proj) return reply(i, "❌ Project not found — check the ID in your dashboard", C.err);
        await setCfg(guildId, {
            project_id:      projectId,
            project_name:    proj.name,
            buyer_role_id:   buyerRole.id,
            manager_role_id: managerRole?.id || null,
        });
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("✅ Setup Complete")
            .addFields(
                { name: "Project", value: proj.name, inline: true },
                { name: "Buyer Role", value: `<@&${buyerRole.id}>`, inline: true },
                { name: "Manager Role", value: managerRole ? `<@&${managerRole.id}>` : "Not set", inline: true }
            ).setDescription("Post a control panel with `/panel`"));
    }

    // ── /panel ────────────────────────────────────────────────────────────────
    if (commandName === "panel") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        await i.channel.send(buildPanel(cfg));
        return reply(i, "✅ Control panel posted!", C.ok);
    }

    // ── /create-key ───────────────────────────────────────────────────────────
    if (commandName === "create-key") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const durStr  = i.options.getString("duration");
        const target  = i.options.getUser("user");
        const note    = i.options.getString("note");
        const expiry  = parseDuration(durStr);
        const key     = genKey("LUNEX");
        const { error } = await sb.from("keys").insert({
            project_id: cfg.project_id,
            key_string:  key,
            discord_id:  target?.id || null,
            note:        note || null,
            active:      true,
            expires_at:  expiry,
            total_executions: 0,
            created_at:  new Date().toISOString()
        });
        if (error) return reply(i, `❌ ${error.message}`, C.err);
        // Assign buyer role if target user given
        if (target && cfg.buyer_role_id) {
            try {
                const gm = await i.guild.members.fetch(target.id);
                await gm.roles.add(cfg.buyer_role_id);
            } catch {}
        }
        // DM the key
        if (target) {
            try {
                await target.send({ embeds: [new EmbedBuilder().setColor(C.ok)
                    .setTitle("🔑 Your Key")
                    .setDescription(`Here's your key for **${cfg.project_name || "the script"}**:`)
                    .addFields(
                        { name: "Key", value: `\`\`\`${key}\`\`\``, inline: false },
                        { name: "Expires", value: expiry ? formatExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true }
                    ).setFooter({ text: "HWID locks on your first run — keep this private" })]
                });
            } catch {}
        }
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("🔑 Key Created")
            .addFields(
                { name: "Key",     value: `\`${key}\``,                                           inline: false },
                { name: "Expires", value: expiry ? formatExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true },
                { name: "User",    value: target ? `<@${target.id}>` : "Unassigned",              inline: true },
                { name: "Note",    value: note || "—",                                             inline: true }
            ));
    }

    // ── /create-api-key ───────────────────────────────────────────────────────
    if (commandName === "create-api-key") {
        if (!member.permissions.has(PermissionFlagsBits.Administrator))
            return reply(i, "❌ Admins only", C.err);
        const email  = i.options.getString("email");
        const durStr = i.options.getString("duration");
        const plan   = i.options.getString("plan") || "starter";
        const apiKey = genApiKey();
        const expiry = parseDuration(durStr);
        const { error } = await sb.from("owners").insert({
            email, api_key: apiKey, plan, obfs_used: 0,
            expires_at: expiry,
            created_at: new Date().toISOString()
        });
        if (error) return reply(i, `❌ ${error.message || "Failed to create API key"}`, C.err);
        // DM the key to the command user
        try {
            await i.user.send({ embeds: [new EmbedBuilder().setColor(C.ok)
                .setTitle("🗝️ API Key Created")
                .setDescription(`Dashboard: ${BASE}`)
                .addFields(
                    { name: "API Key",  value: `\`\`\`${apiKey}\`\`\``, inline: false },
                    { name: "Email",    value: email, inline: true },
                    { name: "Plan",     value: plan,  inline: true },
                    { name: "Expires",  value: expiry ? formatExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true }
                ).setFooter({ text: "Log in at " + BASE })] });
        } catch {}
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("✅ API Key Created")
            .setDescription(`Account created for **${email}** — API key sent to your DMs.\nPlan: \`${plan}\`\nExpiry: ${expiry ? formatExpiry({ expires_at: expiry }) : "♾️ Lifetime"}`));
    }

    // ── /whitelist ────────────────────────────────────────────────────────────
    if (commandName === "whitelist") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target  = i.options.getUser("user");
        const durStr  = i.options.getString("duration") || "lifetime";
        const note    = i.options.getString("note");
        const expiry  = parseDuration(durStr);
        const result  = await iPost("/internal/whitelist", {
            project_id: cfg.project_id, discord_id: target.id,
            note, expires_at: expiry
        });
        if (!result.success) return reply(i, `❌ ${result.error}`, C.err);
        try {
            const gm = await i.guild.members.fetch(target.id);
            if (cfg.buyer_role_id) await gm.roles.add(cfg.buyer_role_id);
        } catch {}
        try {
            await target.send({ embeds: [new EmbedBuilder().setColor(C.ok)
                .setTitle("🔑 You've Been Whitelisted!")
                .addFields(
                    { name: "Key", value: `\`\`\`${result.key}\`\`\``, inline: false },
                    { name: "Expires", value: expiry ? formatExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true }
                ).setFooter({ text: "HWID locks on first run" })] });
        } catch {}
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("✅ Whitelisted")
            .setDescription(`<@${target.id}> has been whitelisted.\nKey: \`${result.key}\``)
            .addFields({ name: "Expires", value: expiry ? formatExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true }));
    }

    // ── /revoke ───────────────────────────────────────────────────────────────
    if (commandName === "revoke") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target = i.options.getUser("user");
        await iPost("/internal/revoke", { discord_id: target.id });
        try { const gm = await i.guild.members.fetch(target.id); if (cfg.buyer_role_id) await gm.roles.remove(cfg.buyer_role_id).catch(()=>{}); } catch {}
        try { await target.send({ embeds: [new EmbedBuilder().setColor(C.err).setTitle("🚫 Access Revoked").setDescription("Your key has been revoked. Contact support.")] }); } catch {}
        return reply(i, `✅ Revoked access for <@${target.id}>`, C.ok);
    }

    // ── /resethwid ────────────────────────────────────────────────────────────
    if (commandName === "resethwid") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target = i.options.getUser("user");
        const result = await iPost("/internal/resethwid", { discord_id: target.id });
        if (!result.success) return reply(i, `❌ No key found for this user`, C.err);
        try { await target.send({ embeds: [new EmbedBuilder().setColor(C.info).setTitle("🔓 HWID Reset").setDescription("Your HWID has been cleared. Run the script again to lock your new device.")] }); } catch {}
        return reply(i, `✅ HWID reset for <@${target.id}>`, C.ok);
    }

    // ── /extend ───────────────────────────────────────────────────────────────
    if (commandName === "extend") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target = i.options.getUser("user");
        const durStr = i.options.getString("duration");
        const info   = await iGet("/internal/keyinfo", { discord_id: target.id });
        if (!info.keys?.length) return reply(i, "❌ No key found for this user", C.err);
        const k = info.keys[0];
        const addSecs = (() => {
            const n = parseInt(durStr); const u = durStr.replace(/\d+/g,"").toLowerCase();
            return n * (u==="d"?86400:u==="h"?3600:u==="m"?60:3600);
        })();
        const base   = k.expires_at ?? Math.floor(Date.now()/1000);
        const newExp = base + addSecs;
        await sb.from("keys").update({ expires_at: newExp }).eq("key_string", k.key_string);
        try { await target.send({ embeds: [new EmbedBuilder().setColor(C.ok).setTitle("✅ Key Extended").setDescription(`Extended by **${durStr}**. New expiry: ${formatExpiry({ expires_at: newExp })}`)] }); } catch {}
        return reply(i, `✅ Extended <@${target.id}>'s key by ${durStr}. New expiry: ${formatExpiry({ expires_at: newExp })}`, C.ok);
    }

    // ── /keyinfo ──────────────────────────────────────────────────────────────
    if (commandName === "keyinfo") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target = i.options.getUser("user");
        const result = await iGet("/internal/keyinfo", { discord_id: target.id });
        if (!result.keys?.length) return reply(i, "❌ No key found for this user", C.err);
        const k = result.keys[0];
        return replyEmb(i, new EmbedBuilder().setColor(k.active ? C.main : C.err)
            .setTitle(`🔑 Key Info — ${target.username}`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: "Key",        value: `\`${k.key_string}\``,                               inline: false },
                { name: "Status",     value: k.active ? "✅ Active" : "❌ Revoked",                inline: true  },
                { name: "Expires",    value: formatExpiry(k),                                       inline: true  },
                { name: "HWID",       value: k.hwid ? "🔒 Locked" : "🔓 Unlocked",                inline: true  },
                { name: "Total Runs", value: String(k.total_executions || 0),                       inline: true  },
                { name: "Last Run",   value: k.last_exec ? `<t:${Math.floor(new Date(k.last_exec).getTime()/1000)}:R>` : "Never", inline: true },
                { name: "Note",       value: k.note || "—",                                         inline: true  }
            ).setTimestamp());
    }

    // ── /genkeys ──────────────────────────────────────────────────────────────
    if (commandName === "genkeys") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const amount = Math.min(i.options.getInteger("amount"), 500);
        const durStr = i.options.getString("duration") || "lifetime";
        const note   = i.options.getString("note");
        const expiry = parseDuration(durStr);
        const result = await ownerApi("POST", `/v1/projects/${cfg.project_id}/keys`, cfg.api_key, {
            amount, note, expires_at: expiry
        });
        if (!result.success) return reply(i, `❌ ${result.error}`, C.err);
        return i.editReply({
            embeds: [new EmbedBuilder().setColor(C.ok).setTitle("🗝️ Keys Generated")
                .setDescription(`Generated **${result.count}** keys${expiry ? ` (${durStr})` : " (Lifetime)"}`)],
            files: [{ attachment: Buffer.from(result.keys.join("\n"), "utf8"), name: `keys_${Date.now()}.txt` }]
        });
    }

    // ── /stats ────────────────────────────────────────────────────────────────
    if (commandName === "stats") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const data = await ownerApi("GET", "/v1/stats", cfg.api_key);
        if (!data.success) return reply(i, `❌ ${data.error}`, C.err);
        const { data: allKeys } = await sb.from("keys").select("active,expires_at").eq("project_id", cfg.project_id);
        const now     = Math.floor(Date.now()/1000);
        const active  = (allKeys||[]).filter(k => k.active && (!k.expires_at || k.expires_at > now)).length;
        const expired = (allKeys||[]).filter(k => k.expires_at && k.expires_at <= now).length;
        const revoked = (allKeys||[]).filter(k => !k.active).length;
        return replyEmb(i, new EmbedBuilder().setColor(C.main).setTitle("📊 Whitelist Stats")
            .addFields(
                { name: "🟢 Active",       value: String(active),  inline: true },
                { name: "⛔ Expired",       value: String(expired), inline: true },
                { name: "🔴 Revoked",       value: String(revoked), inline: true },
                { name: "⚡ Total Runs",    value: String(data.total_executions), inline: true },
                { name: "🔒 Obfs Used",    value: String(data.obfs_used||0),     inline: true },
                { name: "💎 Plan",          value: `\`${data.plan||"starter"}\``,  inline: true }
            ).setTimestamp());
    }

    // ── /announce ─────────────────────────────────────────────────────────────
    if (commandName === "announce") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const msg  = i.options.getString("message");
        const { data: keys } = await sb.from("keys").select("discord_id").eq("project_id", cfg.project_id).eq("active", true).not("discord_id","is",null);
        let sent = 0;
        for (const k of keys || []) {
            try {
                const u = await client.users.fetch(k.discord_id);
                await u.send({ embeds: [new EmbedBuilder().setColor(C.warn).setTitle("📢 Announcement")
                    .setDescription(msg).setFooter({ text: cfg.project_name || "Lunex" }).setTimestamp()] });
                sent++;
            } catch {}
            await new Promise(r => setTimeout(r, 300));
        }
        return reply(i, `✅ Announced to ${sent}/${keys?.length||0} users`, C.ok);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
async function handleButton(i) {
    const { customId, guildId, user } = i;
    const cfg = await getCfg(guildId);

    if (customId === "p_redeem") {
        return i.showModal(new ModalBuilder().setCustomId("m_redeem").setTitle("Redeem a key")
            .addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("key_val")
                    .setLabel("Enter script key below:")
                    .setPlaceholder("LUNEX-XXXXXX-XXXXXX-XXXXXX")
                    .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(10).setMaxLength(80)
            )));
    }

    await i.deferReply({ ephemeral: true });

    if (customId === "p_script") {
        const info = await iGet("/internal/keyinfo", { discord_id: user.id });
        if (!info.keys?.length) return reply(i, "❌ You don't have a key — click **Redeem Key** first.", C.err);
        const k = info.keys[0];
        if (!k.active) return reply(i, "❌ Your key has been revoked. Contact support.", C.err);
        const loader = `script_key="${k.key_string}";\nloadstring(game:HttpGet("${BASE}/v1/auth?key="..script_key.."&hwid="..game:GetService("RbxAnalyticsService"):GetClientId()))()`;
        try {
            await user.send({ embeds: [new EmbedBuilder().setColor(C.main).setTitle("📋 Your Script Loader")
                .addFields(
                    { name: "Loader", value: `\`\`\`lua\n${loader}\n\`\`\`` },
                    { name: "Expires", value: formatExpiry(k), inline: true },
                    { name: "Total Runs", value: String(k.total_executions||0), inline: true }
                ).setFooter({ text: "Keep this private — HWID locks on first run" })] });
            return reply(i, "✅ Loader sent to your DMs!", C.ok);
        } catch {
            return reply(i, "❌ Couldn't DM you — enable DMs from server members in your privacy settings.", C.err);
        }
    }

    if (customId === "p_role") {
        if (!cfg?.buyer_role_id) return reply(i, "❌ No buyer role configured", C.err);
        const info = await iGet("/internal/keyinfo", { discord_id: user.id });
        if (!info.keys?.length) return reply(i, "❌ No key found — redeem a key first.", C.err);
        const k = info.keys[0];
        if (!k.active || (k.expires_at && k.expires_at <= Math.floor(Date.now()/1000)))
            return reply(i, "❌ Key expired or revoked.", C.err);
        try {
            const gm = await i.guild.members.fetch(user.id);
            if (gm.roles.cache.has(cfg.buyer_role_id)) return reply(i, "✅ You already have the buyer role!", C.ok);
            await gm.roles.add(cfg.buyer_role_id);
            return reply(i, `✅ You've been given <@&${cfg.buyer_role_id}>!`, C.ok);
        } catch(e) {
            return reply(i, "❌ Failed to assign role — check bot permissions.", C.err);
        }
    }

    if (customId === "p_hwid") {
        const info = await iGet("/internal/keyinfo", { discord_id: user.id });
        if (!info.keys?.length) return reply(i, "❌ No key found.", C.err);
        const k = info.keys[0];
        await sb.from("keys").update({ hwid: null, last_hwid_reset: new Date().toISOString() }).eq("key_string", k.key_string);
        return i.editReply({ embeds: [new EmbedBuilder().setColor(C.ok).setTitle("🔓 HWID Reset")
            .setDescription("Your HWID has been cleared. Run the script again to lock your new device.")], components: [] });
    }

    if (customId === "p_stats") {
        const info = await iGet("/internal/keyinfo", { discord_id: user.id });
        if (!info.keys?.length) return reply(i, "❌ No key found. Redeem a key first.", C.err);
        const k = info.keys[0];
        return i.editReply({ embeds: [new EmbedBuilder().setColor(C.main).setTitle("📊 Your Stats")
            .addFields(
                { name: "Status",     value: k.active ? "✅ Active" : "❌ Revoked",           inline: true },
                { name: "Expires",    value: formatExpiry(k),                                   inline: true },
                { name: "HWID",       value: k.hwid ? "🔒 Locked" : "🔓 Unlocked",            inline: true },
                { name: "Total Runs", value: String(k.total_executions||0),                     inline: true },
                { name: "Last Run",   value: k.last_exec ? `<t:${Math.floor(new Date(k.last_exec).getTime()/1000)}:R>` : "Never", inline: true },
                { name: "Key",        value: `\`${k.key_string.slice(0,18)}...\``,             inline: true }
            ).setFooter({ text: cfg?.project_name || "Lunex" }).setTimestamp()], components: [] });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL HANDLER
// ═══════════════════════════════════════════════════════════════════════════════
async function handleModal(i) {
    const { customId, guildId, user } = i;
    const cfg = await getCfg(guildId);

    if (customId === "m_redeem") {
        await i.deferReply({ ephemeral: true });
        const keyStr = i.fields.getTextInputValue("key_val").trim();
        const { data: keyRow } = await sb.from("keys").select("*").eq("key_string", keyStr).single();
        if (!keyRow)
            return reply(i, "❌ Invalid key — double-check and try again.", C.err);
        if (!keyRow.active)
            return reply(i, "❌ This key has been revoked.", C.err);
        if (keyRow.expires_at && keyRow.expires_at <= Math.floor(Date.now()/1000))
            return reply(i, "❌ This key has expired.", C.err);
        if (keyRow.discord_id && keyRow.discord_id !== user.id)
            return reply(i, "❌ This key is already claimed by another account.", C.err);
        // Link discord_id
        if (!keyRow.discord_id)
            await sb.from("keys").update({ discord_id: user.id }).eq("key_string", keyStr);
        // Give buyer role
        try {
            if (cfg?.buyer_role_id) {
                const gm = await i.guild.members.fetch(user.id);
                await gm.roles.add(cfg.buyer_role_id);
            }
        } catch {}
        return i.editReply({ embeds: [new EmbedBuilder().setColor(C.ok).setTitle("✅ Key Redeemed!")
            .setDescription("Your key has been linked. Use **Get Script** to get your loader, or **Get Role** to get your buyer role.")
            .addFields({ name: "Expires", value: formatExpiry(keyRow), inline: true })
            .setFooter({ text: "Do NOT share your key" })], components: [] });
    }
}

// ── READY ─────────────────────────────────────────────────────────────────────
client.once("ready", async () => {
    console.log(`[Bot] Ready as ${client.user.tag}`);
    client.user.setActivity("Lunex Whitelist", { type: ActivityType.Watching });
    await registerCommands();
});

// ── Auto-reconnect ────────────────────────────────────────────────────────────
client.on("disconnect", () => {
    console.log("[Bot] Disconnected — attempting reconnect...");
    setTimeout(() => client.login(process.env.DISCORD_BOT_TOKEN), 5000);
});

client.on("error", err => {
    console.error("[Bot] Client error:", err);
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.error("[Bot] Login failed:", err);
    setTimeout(() => client.login(process.env.DISCORD_BOT_TOKEN), 10000);
});
