require("dotenv").config();
const {
    Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes,
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    PermissionFlagsBits, ActivityType
} = require("discord.js");
const { createClient } = require("@supabase/supabase-js");
const crypto = require("crypto");

// ── Keep-alive ────────────────────────────────────────────────────────────────
process.on("SIGTERM",            () => console.log("[Lunex] SIGTERM ignored"));
process.on("SIGINT",             () => console.log("[Lunex] SIGINT ignored"));
process.on("uncaughtException",  e  => console.error("[Lunex] Uncaught:", e));
process.on("unhandledRejection", e  => console.error("[Lunex] Rejection:", e));

const sb     = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const SECRET = process.env.MASTER_SECRET;
const BASE   = process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${process.env.PORT || 3000}`;

// ════════════════════════════════════════════════════════════════════════════
// 50 PRE-SEEDED API KEYS (hardcoded — ready to give out)
// ════════════════════════════════════════════════════════════════════════════
const PRESET_API_KEYS = [
    "b26b12215c271c8ef0403dd6621d97473ddbd18f8529e14505607bed",
    "5d8db5fbef6639e8604015116766d82ac440f2c0372c8ceed4ebc3a1",
    "ad7eede0ccf59d8ebad3ed88954e65f8e23d4d0ab6a29511b3219186",
    "1a780c86d6d43795af427b7b8cb774b022710d4b23d86b17ad404ed6",
    "b13f59ab2f81bc1040cf3bb39cde0af41a1e87d2752601fed30a4b7a",
    "f695b1955f6c67da9ab9c7b6619b12988821f56c13f32c0bb44fff21",
    "68e3e612d2371038932ae10fd6627f888e8454db6621859b3f1f11f4",
    "19c848cc968b16c484b72169754b8e311a352e3a207b298da4614577",
    "c23a51d865173dbf12138d16e857afac6c0293f490e1837c2f3b4b07",
    "7bd72139661f4fbe89093ee0e5d195a11c728a27765c4188f7deea52",
    "5225bbf40338842e43999f8b9fe1184778cef89c8735980b8aeb414f",
    "ec90c783663916f5634c9f013f39596d601d79425cd2cf285f723fa3",
    "bd9c5edc71577648724ca19de6aca86c30c9d6adb6d2935f3b076ebd",
    "17354e73132de1f9d3d9d01060d742796289b8490a3fa394c38db8df",
    "6fac3b4353d2dc09f51d5987453d77271afb584ca68b693c06f5893a",
    "bbc8cc4b42de951dfb29b8c30a27719068c0b4fcb67609b9cda03672",
    "ae3289bdc68c18a48aa681a15b5f20eeb84d83679af6d981cff133e3",
    "16fc4aee1a62b08dd4df573f911d16806d811d0b18f22793ee9ab711",
    "21ddd683e0242ce800af4b060b3764ec7e63e59cae877f71f5680f3a",
    "b99d0c1c6dfba2f69b9f366c25c743c989ed1962c5ea1d79528e74e7",
    "29aa73fc01259cb2faca36e673de30c62920e419e4e7115e1e6ccadb",
    "5ba962a7312e519264aacc0e0d5d402485913c7171971860074cb99e",
    "3a46c2f83ab960d6188c98bb755479cfb9114a43845812219ca3bdbc",
    "80fc68d71dae909b0a9f2c982bc8f20e99452fc3e669818222181bc0",
    "71e09495bd6c6bbfa9f0ee6857b2b59933b293cfe45d9eea2d1ff23e",
    "7d3b56ef17a90dc6596b5deb9f2fbf8aeef2384ecd64a8bd60452495",
    "334f7b57c88a974398e6f2d4b54cff59105391629db56167f4e16d5b",
    "da66fb50bec98819885531679030855dbcb6597714b4a4c6529e16b4",
    "85c431eb66acf06591088a159efdc0b488665c7ff33e45792c70c3ec",
    "7bdd984b9265669d7110d6f71c9e22dc99edc50e957fbf62fa74a5fe",
    "bb1a38a79e3c3f5d1a7272059f06506bdeb25e8da21f2b94687463dd",
    "9261e619845ec8b548f9758da17caadaf6a1b7cd6684bd32550af68b",
    "615433973b6283e1e372a7eeaabb9d62c184fcb818a84525927454ef",
    "88631815fc4dbefd5e8672568f2a6abe6940a7ed400b1e389de78b6a",
    "7d527803aede129db61bbd8d23573160f924e06636b3b11782c0dc85",
    "a543fd9019545d452a0d8d9975bbdfb0a7c23ea542a0de1c70bfda03",
    "7e0f942c9b14cd179c986f690838bc1bbc03304ece4eedccb14cdd9e",
    "6c162dfa6b4e81a7a95c555e7cbaf84c49029a0d65688232f992468a",
    "eb6de543a64750f7a283749c4ed138f79750eebee7c349b867a199b4",
    "53899be37e1ba26a69112bdb464d06474522e889925c5a334ab26082",
    "f86a643287da9328943106761c98ad214ae4367b0c72a6b8fbf5b1d2",
    "84fe3cd49ae7ca3bef3f6ec701f3a67f3c80a463915d0e8d6f5a3592",
    "de32d071e8368d902203bf71cbb730ad9a159ee746afac24acccc864",
    "f2b2472f464c6c3cc7bd7c151ad102a2105a5d3d82988f1af3da82f8",
    "4d07a8c9aa14fef4113445b54adebf891d24fbfeb00c64f2e8885ed3",
    "f3f5cce8a127fa8812be31a68fb050c5bf71f0360ae85ead91be6d51",
    "ad24a83715d713c2f87a249a8ee7edb062e33fc2018967a308030de1",
    "3d2acb03a9f04d26fe7583c9cc71bb6544a2575a65e7d7acfbc3d9e2",
    "39c61c8673cb98bbca6eae503db537272ea9556feb9d9d5d8c85b952",
    "eaa05415d4a7c16d9dfc9723722fdd8fd9d2cc8921415a005798c6d6",
];

// ── Seed preset keys into Supabase on startup (idempotent) ────────────────────
async function seedPresetKeys() {
    for (const apiKey of PRESET_API_KEYS) {
        const { data } = await sb.from("owners").select("id").eq("api_key", apiKey).single();
        if (!data) {
            await sb.from("owners").insert({
                email:       `preset-${apiKey.slice(0, 8)}@lunex.local`,
                api_key:     apiKey,
                plan:        "starter",
                obfs_used:   0,
                created_at:  new Date().toISOString()
            });
        }
    }
    console.log("[Lunex] 50 preset API keys seeded");
}

// ── Duration helpers ───────────────────────────────────────────────────────────
const DURATIONS = {
    "1min":   60,
    "1hour":  3600,
    "1day":   86400,
    "1month": 86400 * 30,
    "1year":  86400 * 365,
    "2years": 86400 * 365 * 2,
    "3years": 86400 * 365 * 3,
};
function durToSecs(label) { return DURATIONS[label] || 0; }
function expiryFromLabel(label) {
    const secs = durToSecs(label);
    return secs > 0 ? Math.floor(Date.now() / 1000) + secs : null;
}
function fmtExpiry(k) {
    if (!k.expires_at) return "♾️ Lifetime";
    const sec = k.expires_at - Math.floor(Date.now() / 1000);
    if (sec <= 0) return "⛔ Expired";
    const d = Math.floor(sec / 86400), h = Math.floor((sec % 86400) / 3600);
    return d > 0 ? `⏳ ${d}d ${h}h left` : `⏳ ${h}h ${Math.floor((sec % 3600) / 60)}m left`;
}

// ── Key gen ────────────────────────────────────────────────────────────────────
function genKey(prefix = "LUNEX") {
    const s = () => crypto.randomBytes(3).toString("hex").toUpperCase();
    return `${prefix}-${s()}-${s()}-${s()}`;
}
function genApiKey() { return crypto.randomBytes(28).toString("hex"); }

// ── User → API key store (Supabase user_api_links table) ─────────────────────
async function getUserApiKey(discordId) {
    const { data } = await sb.from("user_api_links").select("api_key").eq("discord_id", discordId).single();
    return data?.api_key || null;
}
async function setUserApiKey(discordId, apiKey) {
    await sb.from("user_api_links").upsert({ discord_id: discordId, api_key: apiKey, updated_at: new Date().toISOString() }, { onConflict: "discord_id" });
}

// ── Owner API proxy ────────────────────────────────────────────────────────────
async function ownerReq(method, path, apiKey, body) {
    try {
        const r = await fetch(`${BASE}${path}`, {
            method,
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: body ? JSON.stringify(body) : undefined
        });
        return r.json();
    } catch(e) { return { error: e.message }; }
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

function isManager(member, cfg) {
    if (!member) return false;
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (cfg?.manager_role_id && member.roles.cache.has(cfg.manager_role_id)) return true;
    return false;
}

// ════════════════════════════════════════════════════════════════════════════
// CLIENT
// ════════════════════════════════════════════════════════════════════════════
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages
    ]
});

// ── SLASH COMMANDS ─────────────────────────────────────────────────────────────
const durChoices = [
    { name: "1 Minute",  value: "1min"   },
    { name: "1 Hour",    value: "1hour"  },
    { name: "1 Day",     value: "1day"   },
    { name: "1 Month",   value: "1month" },
    { name: "1 Year",    value: "1year"  },
    { name: "2 Years",   value: "2years" },
    { name: "3 Years",   value: "3years" },
    { name: "Lifetime",  value: "lifetime"},
];

const commands = [
    // ── USER self-service ──
    new SlashCommandBuilder()
        .setName("api-redeem").setDescription("Link your Lunex API key to use bot commands")
        .addStringOption(o => o.setName("key").setDescription("Your API key from the dashboard").setRequired(true)),

    new SlashCommandBuilder()
        .setName("my-projects").setDescription("View your linked projects"),

    new SlashCommandBuilder()
        .setName("my-key").setDescription("View your script key info"),

    new SlashCommandBuilder()
        .setName("get-script").setDescription("Get your loader for a project")
        .addStringOption(o => o.setName("project").setDescription("Project name").setRequired(false)),

    new SlashCommandBuilder()
        .setName("reset-hwid").setDescription("Reset your HWID lock"),

    // ── KEY CREATION ──
    new SlashCommandBuilder()
        .setName("create-key").setDescription("Create a key for a user")
        .addStringOption(o => o.setName("project").setDescription("Project name (from your linked projects)").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("How long the key lasts").setRequired(true).addChoices(...durChoices))
        .addUserOption(o => o.setName("user").setDescription("Discord user to assign key to"))
        .addStringOption(o => o.setName("note").setDescription("Note for this key")),

    new SlashCommandBuilder()
        .setName("create-api-key").setDescription("Create a Lunex dashboard API key")
        .addStringOption(o => o.setName("email").setDescription("Email for the account").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("How long it lasts").setRequired(true).addChoices(...durChoices))
        .addStringOption(o => o.setName("plan").setDescription("Plan tier").addChoices(
            { name: "Starter", value: "starter" },
            { name: "Pro",     value: "pro"     },
            { name: "Elite",   value: "elite"   }
        ))
        .addUserOption(o => o.setName("user").setDescription("Discord user to DM the key to"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    // ── MANAGEMENT ──
    new SlashCommandBuilder()
        .setName("login").setDescription("Link server to your Lunex account")
        .addStringOption(o => o.setName("api_key").setDescription("Your API key").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName("setup").setDescription("Configure project, buyer role and manager role")
        .addStringOption(o => o.setName("project_id").setDescription("Project ID from dashboard").setRequired(true))
        .addRoleOption(o => o.setName("buyer_role").setDescription("Role given to buyers").setRequired(true))
        .addRoleOption(o => o.setName("manager_role").setDescription("Role that can manage keys"))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    new SlashCommandBuilder()
        .setName("panel").setDescription("Post the user control panel in this channel")
        .addStringOption(o => o.setName("project_id").setDescription("Project ID (uses default if not set)"))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    new SlashCommandBuilder()
        .setName("whitelist").setDescription("Whitelist a user and give them a key")
        .addUserOption(o => o.setName("user").setDescription("User to whitelist").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Key duration").setRequired(true).addChoices(...durChoices))
        .addStringOption(o => o.setName("note").setDescription("Note")),

    new SlashCommandBuilder()
        .setName("revoke").setDescription("Revoke a user's key")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

    new SlashCommandBuilder()
        .setName("resethwid").setDescription("Reset a user's HWID (manager)")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

    new SlashCommandBuilder()
        .setName("extend").setDescription("Add time to a user's key")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Duration to add").setRequired(true).addChoices(...durChoices)),

    new SlashCommandBuilder()
        .setName("keyinfo").setDescription("View key details for a user")
        .addUserOption(o => o.setName("user").setDescription("User").setRequired(true)),

    new SlashCommandBuilder()
        .setName("genkeys").setDescription("Bulk generate keys")
        .addStringOption(o => o.setName("project").setDescription("Project name").setRequired(true))
        .addIntegerOption(o => o.setName("amount").setDescription("Amount (max 500)").setRequired(true))
        .addStringOption(o => o.setName("duration").setDescription("Duration").addChoices(...durChoices))
        .addStringOption(o => o.setName("note").setDescription("Batch note")),

    new SlashCommandBuilder()
        .setName("stats").setDescription("View whitelist stats")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    new SlashCommandBuilder()
        .setName("announce").setDescription("DM all active users an announcement")
        .addStringOption(o => o.setName("message").setDescription("Message").setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

async function registerCommands() {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_BOT_TOKEN);
    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID), { body: commands.map(c => c.toJSON()) });
    console.log("[Lunex] Commands registered");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const C = { main: 0x6366f1, ok: 0x10b981, err: 0xf43f5e, warn: 0xf59e0b, info: 0x06b6d4 };
const reply    = (i, desc, col = C.main) => i.editReply({ embeds: [new EmbedBuilder().setColor(col).setDescription(desc)], components: [] });
const replyEmb = (i, emb) => i.editReply({ embeds: [emb], components: [] });

// Resolve project name → project object from owner's project list
async function resolveProject(apiKey, nameOrId) {
    const d = await ownerReq("GET", "/v1/projects", apiKey);
    if (!d.success || !d.projects?.length) return null;
    const lower = nameOrId.toLowerCase();
    return d.projects.find(p =>
        p.id === nameOrId ||
        p.name.toLowerCase() === lower ||
        p.name.toLowerCase().includes(lower)
    ) || null;
}

// ════════════════════════════════════════════════════════════════════════════
// CONTROL PANEL BUILDER
// ════════════════════════════════════════════════════════════════════════════
function buildPanel(projectName, projectId) {
    return {
        embeds: [new EmbedBuilder()
            .setColor(0x2b2d31)
            .setAuthor({ name: "Lunex", iconURL: "https://cdn.discordapp.com/embed/avatars/0.png" })
            .setTitle(`${projectName} Control Panel`)
            .setDescription(
                `This control panel is for the project: **${projectName}**\n` +
                `If you're a buyer, click the buttons below to redeem your key, get the script or get your role.`
            )
            .setFooter({ text: `Sent by Lunex • ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` })
        ],
        components: [
            new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`redeem:${projectId}`).setLabel("Redeem Key").setEmoji("🔑").setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`script:${projectId}`).setLabel("Get Script").setEmoji("📋").setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`role:${projectId}`).setLabel("Get Role").setEmoji("🎭").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`hwid:${projectId}`).setLabel("Reset HWID").setEmoji("⚙️").setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`stats:${projectId}`).setLabel("Get Stats").setEmoji("📊").setStyle(ButtonStyle.Secondary)
            )
        ]
    };
}

// ════════════════════════════════════════════════════════════════════════════
// SLASH COMMAND HANDLER
// ════════════════════════════════════════════════════════════════════════════
client.on("interactionCreate", async interaction => {
    try {
        if (interaction.isChatInputCommand()) await handleSlash(interaction);
        else if (interaction.isButton())       await handleButton(interaction);
        else if (interaction.isModalSubmit())  await handleModal(interaction);
    } catch(e) {
        console.error("[Lunex] Interaction error:", e);
        const msg = "An error occurred. Please try again.";
        try {
            if (interaction.deferred || interaction.replied) await interaction.editReply({ content: msg, embeds: [], components: [] });
            else await interaction.reply({ content: msg, ephemeral: true });
        } catch {}
    }
});

async function handleSlash(i) {
    const { commandName, guildId } = i;
    await i.deferReply({ ephemeral: true });
    const cfg    = await getCfg(guildId);
    const member = i.member;

    // ── /api-redeem ──────────────────────────────────────────────────────────
    if (commandName === "api-redeem") {
        const key = i.options.getString("key").trim();
        // Verify against Supabase owners table
        const { data: owner } = await sb.from("owners").select("*").eq("api_key", key).single();
        if (!owner) return reply(i, "❌ Invalid API key — check your key and try again.", C.err);
        if (owner.expires_at && owner.expires_at <= Math.floor(Date.now() / 1000))
            return reply(i, "❌ This API key has expired. Contact your provider.", C.err);
        // Link to Discord ID
        await setUserApiKey(i.user.id, key);
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("✅ API Key Linked!")
            .setDescription("Your API key has been linked to your Discord account. You can now use all Lunex commands.")
            .addFields(
                { name: "Plan",    value: `\`${owner.plan || "starter"}\``, inline: true },
                { name: "Expires", value: owner.expires_at ? fmtExpiry(owner) : "♾️ Lifetime", inline: true }
            ).setFooter({ text: "Use /my-projects to see your scripts" }));
    }

    // ── /my-projects ─────────────────────────────────────────────────────────
    if (commandName === "my-projects") {
        const apiKey = await getUserApiKey(i.user.id);
        if (!apiKey) return reply(i, "❌ You haven't linked an API key yet. Run `/api-redeem <key>` first.", C.err);
        const d = await ownerReq("GET", "/v1/projects", apiKey);
        if (!d.success || !d.projects?.length)
            return reply(i, "No projects found. Create one in the dashboard.", C.info);
        return replyEmb(i, new EmbedBuilder().setColor(C.main).setTitle("📂 Your Projects")
            .setDescription(d.projects.map((p, n) =>
                `**${n+1}. ${p.name}**\n` +
                `ID: \`${p.id}\`\n` +
                `Status: ${p.active ? "🟢 Active" : "🔴 Paused"} • v${p.script_version || "N/A"}`
            ).join("\n\n"))
            .setFooter({ text: `${d.projects.length} project(s)` }));
    }

    // ── /my-key ──────────────────────────────────────────────────────────────
    if (commandName === "my-key") {
        const { data: keys } = await sb.from("keys").select("*").eq("discord_id", i.user.id).order("created_at", { ascending: false });
        if (!keys?.length) return reply(i, "❌ No key found for your account. Ask a manager or redeem a key.", C.err);
        const k = keys[0];
        return replyEmb(i, new EmbedBuilder().setColor(C.main).setTitle("🔑 Your Key")
            .addFields(
                { name: "Key",        value: `\`${k.key_string}\``,                                    inline: false },
                { name: "Status",     value: k.active ? "✅ Active" : "❌ Revoked",                    inline: true  },
                { name: "Expires",    value: fmtExpiry(k),                                              inline: true  },
                { name: "HWID",       value: k.hwid ? "🔒 Locked" : "🔓 Unlocked",                    inline: true  },
                { name: "Total Runs", value: String(k.total_executions || 0),                           inline: true  },
                { name: "Last Run",   value: k.last_exec ? `<t:${Math.floor(new Date(k.last_exec).getTime()/1000)}:R>` : "Never", inline: true }
            ));
    }

    // ── /get-script ──────────────────────────────────────────────────────────
    if (commandName === "get-script") {
        const { data: keys } = await sb.from("keys").select("*").eq("discord_id", i.user.id).eq("active", true).order("created_at", { ascending: false });
        if (!keys?.length) return reply(i, "❌ No active key found. Ask a manager to whitelist you.", C.err);
        const k = keys[0];
        const loader = `script_key="${k.key_string}";\nloadstring(game:HttpGet("${BASE}/v1/auth?key="..script_key.."&hwid="..game:GetService("RbxAnalyticsService"):GetClientId()))()`;
        try {
            await i.user.send({ embeds: [new EmbedBuilder().setColor(C.main).setTitle("📋 Your Script Loader")
                .addFields(
                    { name: "Loader", value: `\`\`\`lua\n${loader}\n\`\`\`` },
                    { name: "Expires", value: fmtExpiry(k), inline: true },
                    { name: "Runs", value: String(k.total_executions || 0), inline: true }
                ).setFooter({ text: "Keep this private — HWID locks on first run" })] });
            return reply(i, "✅ Loader sent to your DMs!", C.ok);
        } catch {
            return reply(i, "❌ Enable DMs from server members in your privacy settings.", C.err);
        }
    }

    // ── /reset-hwid (self) ────────────────────────────────────────────────────
    if (commandName === "reset-hwid") {
        const { data, error } = await sb.from("keys").update({ hwid: null, last_hwid_reset: new Date().toISOString() })
            .eq("discord_id", i.user.id).eq("active", true).select();
        if (error || !data?.length) return reply(i, "❌ No active key found for your account.", C.err);
        return reply(i, "✅ HWID cleared — run the script again to lock your new device.", C.ok);
    }

    // ── /create-key ───────────────────────────────────────────────────────────
    if (commandName === "create-key") {
        const apiKey = await getUserApiKey(i.user.id);
        if (!apiKey && !cfg?.api_key) return reply(i, "❌ Run `/api-redeem <key>` first to link your account.", C.err);
        const useKey = apiKey || cfg.api_key;
        if (!isManager(member, cfg) && !apiKey) return reply(i, "❌ You need to link your API key first.", C.err);
        const projName = i.options.getString("project");
        const durLabel = i.options.getString("duration");
        const target   = i.options.getUser("user");
        const note     = i.options.getString("note");
        // Resolve project
        const proj = await resolveProject(useKey, projName);
        if (!proj) return reply(i, `❌ Project "${projName}" not found. Use /my-projects to see your project names.`, C.err);
        const expiry = durLabel === "lifetime" ? null : expiryFromLabel(durLabel);
        const key    = genKey("LUNEX");
        const { error } = await sb.from("keys").insert({
            project_id: proj.id, key_string: key,
            discord_id: target?.id || null, note: note || null,
            active: true, expires_at: expiry, total_executions: 0,
            created_at: new Date().toISOString()
        });
        if (error) return reply(i, `❌ ${error.message}`, C.err);
        // Give buyer role if target + cfg has role
        if (target && cfg?.buyer_role_id) {
            try { const gm = await i.guild.members.fetch(target.id); await gm.roles.add(cfg.buyer_role_id); } catch {}
        }
        // DM the user
        if (target) {
            try {
                await target.send({ embeds: [new EmbedBuilder().setColor(C.ok).setTitle("🔑 New Key")
                    .setDescription(`You've been given a key for **${proj.name}**`)
                    .addFields(
                        { name: "Key",     value: `\`\`\`${key}\`\`\``, inline: false },
                        { name: "Expires", value: expiry ? fmtExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true }
                    ).setFooter({ text: "HWID locks on first run — keep this private" })] });
            } catch {}
        }
        const loader = `script_key="${key}";\nloadstring(game:HttpGet("${BASE}/v1/auth?key="..script_key.."&hwid="..game:GetService("RbxAnalyticsService"):GetClientId()))()`;
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("🔑 Key Created")
            .addFields(
                { name: "Project", value: proj.name, inline: true },
                { name: "Expires", value: expiry ? fmtExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true },
                { name: "For",     value: target ? `<@${target.id}>` : "Unassigned", inline: true },
                { name: "Key",     value: `\`${key}\``, inline: false },
                { name: "Loader",  value: `\`\`\`lua\n${loader}\n\`\`\``, inline: false }
            ));
    }

    // ── /create-api-key ───────────────────────────────────────────────────────
    if (commandName === "create-api-key") {
        if (!member.permissions.has(PermissionFlagsBits.Administrator))
            return reply(i, "❌ Admins only", C.err);
        const email    = i.options.getString("email");
        const durLabel = i.options.getString("duration");
        const plan     = i.options.getString("plan") || "starter";
        const target   = i.options.getUser("user");
        // Check if preset key available
        let newApiKey;
        let usedPreset = false;
        for (const pk of PRESET_API_KEYS) {
            const { data: owner } = await sb.from("owners").select("email").eq("api_key", pk).single();
            if (owner?.email?.includes("preset-")) {
                newApiKey = pk; usedPreset = true;
                break;
            }
        }
        if (!newApiKey) newApiKey = genApiKey();
        const expiry = durLabel === "lifetime" ? null : expiryFromLabel(durLabel);
        if (usedPreset) {
            // Update the preset key slot
            await sb.from("owners").update({ email, plan, expires_at: expiry }).eq("api_key", newApiKey);
        } else {
            const { error } = await sb.from("owners").insert({
                email, api_key: newApiKey, plan,
                obfs_used: 0, expires_at: expiry, created_at: new Date().toISOString()
            });
            if (error) return reply(i, `❌ ${error.message}`, C.err);
        }
        const embed = new EmbedBuilder().setColor(C.ok).setTitle("🗝️ API Key Created")
            .setDescription(`Dashboard: **${BASE}**\nLog in with the key below.`)
            .addFields(
                { name: "API Key",  value: `\`\`\`${newApiKey}\`\`\``, inline: false },
                { name: "Email",    value: email, inline: true },
                { name: "Plan",     value: plan,  inline: true },
                { name: "Expires",  value: expiry ? fmtExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true }
            );
        // DM the target user
        const dmTarget = target || i.user;
        try { await dmTarget.send({ embeds: [embed] }); } catch {}
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("✅ API Key Created")
            .setDescription(`Account created for **${email}** — API key sent to ${target ? `<@${target.id}>` : "your"} DMs.\nPlan: \`${plan}\` | Expiry: ${expiry ? fmtExpiry({ expires_at: expiry }) : "♾️ Lifetime"}`));
    }

    // ── /login ────────────────────────────────────────────────────────────────
    if (commandName === "login") {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) return reply(i, "❌ Admins only", C.err);
        const apiKey = i.options.getString("api_key");
        const d = await ownerReq("GET", "/v1/account", apiKey);
        if (!d.success) return reply(i, "❌ Invalid API key", C.err);
        await setCfg(guildId, { api_key: apiKey, email: d.account.email, plan: d.account.plan });
        return reply(i, `✅ Server linked to **${d.account.email}** (${d.account.plan}). Run \`/setup\` next.`, C.ok);
    }

    // ── /setup ────────────────────────────────────────────────────────────────
    if (commandName === "setup") {
        if (!member.permissions.has(PermissionFlagsBits.Administrator)) return reply(i, "❌ Admins only", C.err);
        const projectId   = i.options.getString("project_id");
        const buyerRole   = i.options.getRole("buyer_role");
        const managerRole = i.options.getRole("manager_role");
        const projs = await ownerReq("GET", "/v1/projects", cfg?.api_key || "");
        const proj  = projs.projects?.find(p => p.id === projectId);
        if (!proj) return reply(i, "❌ Project not found — check the ID in your dashboard", C.err);
        await setCfg(guildId, {
            project_id: projectId, project_name: proj.name,
            buyer_role_id: buyerRole.id,
            manager_role_id: managerRole?.id || null,
        });
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("✅ Setup Complete")
            .addFields(
                { name: "Project",      value: proj.name,                                     inline: true },
                { name: "Buyer Role",   value: `<@&${buyerRole.id}>`,                         inline: true },
                { name: "Manager Role", value: managerRole ? `<@&${managerRole.id}>` : "None", inline: true }
            ).setDescription("Run `/panel` to post the user control panel!"));
    }

    // ── /panel ────────────────────────────────────────────────────────────────
    if (commandName === "panel") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const apiKey    = cfg?.api_key || await getUserApiKey(i.user.id);
        const projIdOpt = i.options.getString("project_id");
        let projId   = projIdOpt || cfg?.project_id;
        let projName = cfg?.project_name || "Script";
        if (projIdOpt) {
            const d = await ownerReq("GET", "/v1/projects", apiKey);
            const p = d.projects?.find(p => p.id === projIdOpt);
            if (p) { projId = p.id; projName = p.name; }
        }
        await i.channel.send(buildPanel(projName, projId));
        return reply(i, "✅ Control panel posted!", C.ok);
    }

    // ── /whitelist ────────────────────────────────────────────────────────────
    if (commandName === "whitelist") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target   = i.options.getUser("user");
        const durLabel = i.options.getString("duration");
        const note     = i.options.getString("note");
        const expiry   = durLabel === "lifetime" ? null : expiryFromLabel(durLabel);
        const key      = genKey("LUNEX");
        const projId   = cfg?.project_id;
        if (!projId) return reply(i, "❌ Run `/setup` first to configure a project.", C.err);
        const { error } = await sb.from("keys").insert({
            project_id: projId, key_string: key,
            discord_id: target.id, note: note || null,
            active: true, expires_at: expiry, total_executions: 0,
            created_at: new Date().toISOString()
        });
        if (error) return reply(i, `❌ ${error.message}`, C.err);
        try { const gm = await i.guild.members.fetch(target.id); if (cfg.buyer_role_id) await gm.roles.add(cfg.buyer_role_id); } catch {}
        try {
            const loader = `script_key="${key}";\nloadstring(game:HttpGet("${BASE}/v1/auth?key="..script_key.."&hwid="..game:GetService("RbxAnalyticsService"):GetClientId()))()`;
            await target.send({ embeds: [new EmbedBuilder().setColor(C.ok).setTitle("🔑 You've Been Whitelisted!")
                .addFields(
                    { name: "Key",     value: `\`\`\`${key}\`\`\``,  inline: false },
                    { name: "Loader",  value: `\`\`\`lua\n${loader}\n\`\`\``, inline: false },
                    { name: "Expires", value: expiry ? fmtExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true }
                ).setFooter({ text: "HWID locks on first run" })] });
        } catch {}
        return replyEmb(i, new EmbedBuilder().setColor(C.ok).setTitle("✅ Whitelisted")
            .setDescription(`<@${target.id}> given key \`${key}\``)
            .addFields({ name: "Expires", value: expiry ? fmtExpiry({ expires_at: expiry }) : "♾️ Lifetime", inline: true }));
    }

    // ── /revoke ───────────────────────────────────────────────────────────────
    if (commandName === "revoke") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target = i.options.getUser("user");
        await sb.from("keys").update({ active: false }).eq("discord_id", target.id);
        try { const gm = await i.guild.members.fetch(target.id); if (cfg?.buyer_role_id) await gm.roles.remove(cfg.buyer_role_id).catch(() => {}); } catch {}
        try { await target.send({ embeds: [new EmbedBuilder().setColor(C.err).setTitle("🚫 Access Revoked").setDescription("Your key has been revoked.")] }); } catch {}
        return reply(i, `✅ Revoked key for <@${target.id}>`, C.ok);
    }

    // ── /resethwid (manager) ──────────────────────────────────────────────────
    if (commandName === "resethwid") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target = i.options.getUser("user");
        const { data } = await sb.from("keys").update({ hwid: null, last_hwid_reset: new Date().toISOString() }).eq("discord_id", target.id).select();
        if (!data?.length) return reply(i, "❌ No key found for this user", C.err);
        try { await target.send({ embeds: [new EmbedBuilder().setColor(C.info).setTitle("🔓 HWID Reset").setDescription("Your HWID has been cleared.")] }); } catch {}
        return reply(i, `✅ HWID reset for <@${target.id}>`, C.ok);
    }

    // ── /extend ───────────────────────────────────────────────────────────────
    if (commandName === "extend") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target   = i.options.getUser("user");
        const durLabel = i.options.getString("duration");
        const addSecs  = durToSecs(durLabel);
        const { data: keys } = await sb.from("keys").select("*").eq("discord_id", target.id).eq("active", true);
        if (!keys?.length) return reply(i, "❌ No active key for this user", C.err);
        const k = keys[0];
        const base   = k.expires_at ?? Math.floor(Date.now() / 1000);
        const newExp = base + addSecs;
        await sb.from("keys").update({ expires_at: newExp }).eq("key_string", k.key_string);
        try { await target.send({ embeds: [new EmbedBuilder().setColor(C.ok).setTitle("✅ Key Extended").setDescription(`Extended by **${durLabel}**. ${fmtExpiry({ expires_at: newExp })}`)] }); } catch {}
        return reply(i, `✅ Extended <@${target.id}>'s key by ${durLabel}. ${fmtExpiry({ expires_at: newExp })}`, C.ok);
    }

    // ── /keyinfo ──────────────────────────────────────────────────────────────
    if (commandName === "keyinfo") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const target = i.options.getUser("user");
        const { data: keys } = await sb.from("keys").select("*").eq("discord_id", target.id).order("created_at", { ascending: false });
        if (!keys?.length) return reply(i, "❌ No key found for this user", C.err);
        const k = keys[0];
        return replyEmb(i, new EmbedBuilder().setColor(k.active ? C.main : C.err)
            .setTitle(`🔑 Key Info — ${target.username}`)
            .setThumbnail(target.displayAvatarURL())
            .addFields(
                { name: "Key",        value: `\`${k.key_string}\``,                                    inline: false },
                { name: "Status",     value: k.active ? "✅ Active" : "❌ Revoked",                    inline: true  },
                { name: "Expires",    value: fmtExpiry(k),                                              inline: true  },
                { name: "HWID",       value: k.hwid ? "🔒 Locked" : "🔓 Unlocked",                    inline: true  },
                { name: "Total Runs", value: String(k.total_executions || 0),                           inline: true  },
                { name: "Last Run",   value: k.last_exec ? `<t:${Math.floor(new Date(k.last_exec).getTime()/1000)}:R>` : "Never", inline: true },
                { name: "Note",       value: k.note || "—",                                             inline: true  }
            ).setTimestamp());
    }

    // ── /genkeys ──────────────────────────────────────────────────────────────
    if (commandName === "genkeys") {
        const apiKey = cfg?.api_key || await getUserApiKey(i.user.id);
        if (!apiKey) return reply(i, "❌ No API key configured", C.err);
        if (!isManager(member, cfg) && !await getUserApiKey(i.user.id)) return reply(i, "❌ No permission", C.err);
        const projName = i.options.getString("project");
        const amount   = Math.min(i.options.getInteger("amount"), 500);
        const durLabel = i.options.getString("duration") || "lifetime";
        const note     = i.options.getString("note");
        const proj     = await resolveProject(apiKey, projName);
        if (!proj) return reply(i, `❌ Project "${projName}" not found.`, C.err);
        const expiry = durLabel === "lifetime" ? null : expiryFromLabel(durLabel);
        const d = await ownerReq("POST", `/v1/projects/${proj.id}/keys`, apiKey, { amount, note, expires_at: expiry });
        if (!d.success) return reply(i, `❌ ${d.error}`, C.err);
        const txt = d.keys.join("\n");
        return i.editReply({
            embeds: [new EmbedBuilder().setColor(C.ok).setTitle("🗝️ Keys Generated")
                .setDescription(`**${d.count}** keys for **${proj.name}** (${durLabel})`)],
            files: [{ attachment: Buffer.from(txt, "utf8"), name: `keys_${proj.name.replace(/\s+/g,"_")}_${Date.now()}.txt` }]
        });
    }

    // ── /stats ────────────────────────────────────────────────────────────────
    if (commandName === "stats") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const apiKey = cfg?.api_key;
        if (!apiKey) return reply(i, "❌ Run `/login` first", C.err);
        const d = await ownerReq("GET", "/v1/stats", apiKey);
        if (!d.success) return reply(i, `❌ ${d.error}`, C.err);
        const { data: allKeys } = await sb.from("keys").select("active,expires_at").eq("project_id", cfg.project_id || "");
        const now     = Math.floor(Date.now() / 1000);
        const active  = (allKeys || []).filter(k => k.active && (!k.expires_at || k.expires_at > now)).length;
        const expired = (allKeys || []).filter(k => k.expires_at && k.expires_at <= now).length;
        return replyEmb(i, new EmbedBuilder().setColor(C.main).setTitle("📊 Stats")
            .addFields(
                { name: "🟢 Active",     value: String(active),              inline: true },
                { name: "⛔ Expired",     value: String(expired),             inline: true },
                { name: "⚡ Total Runs",  value: String(d.total_executions),  inline: true },
                { name: "🔒 Obfs Used",  value: String(d.obfs_used || 0),    inline: true },
                { name: "📂 Projects",   value: String(d.projects),           inline: true },
                { name: "💎 Plan",       value: `\`${d.plan}\``,              inline: true }
            ).setTimestamp());
    }

    // ── /announce ─────────────────────────────────────────────────────────────
    if (commandName === "announce") {
        if (!isManager(member, cfg)) return reply(i, "❌ No permission", C.err);
        const msg  = i.options.getString("message");
        const { data: keys } = await sb.from("keys").select("discord_id").eq("project_id", cfg?.project_id || "").eq("active", true).not("discord_id", "is", null);
        let sent = 0;
        for (const k of keys || []) {
            try {
                const u = await client.users.fetch(k.discord_id);
                await u.send({ embeds: [new EmbedBuilder().setColor(C.warn).setTitle("📢 Announcement")
                    .setDescription(msg).setFooter({ text: cfg?.project_name || "Lunex" }).setTimestamp()] });
                sent++;
            } catch {}
            await new Promise(r => setTimeout(r, 300));
        }
        return reply(i, `✅ Sent to ${sent}/${keys?.length || 0} users`, C.ok);
    }
}

// ════════════════════════════════════════════════════════════════════════════
// BUTTON HANDLER (control panel)
// ════════════════════════════════════════════════════════════════════════════
async function handleButton(i) {
    const [action, projectId] = i.customId.split(":");
    const { guildId, user }   = i;
    const cfg = await getCfg(guildId);

    if (action === "redeem") {
        return i.showModal(new ModalBuilder()
            .setCustomId(`redeem_modal:${projectId}`)
            .setTitle("Redeem a key")
            .addComponents(new ActionRowBuilder().addComponents(
                new TextInputBuilder().setCustomId("key_val")
                    .setLabel("Enter script key below:")
                    .setPlaceholder("LUNEX-XXXXXX-XXXXXX-XXXXXX")
                    .setStyle(TextInputStyle.Short).setRequired(true).setMinLength(10).setMaxLength(80)
            )));
    }

    await i.deferReply({ ephemeral: true });

    if (action === "script") {
        const { data: keys } = await sb.from("keys").select("*").eq("discord_id", user.id).eq("active", true).order("created_at", { ascending: false });
        if (!keys?.length) return reply(i, "❌ No active key — click **Redeem Key** first.", C.err);
        const k = keys[0];
        if (k.expires_at && k.expires_at <= Math.floor(Date.now() / 1000))
            return reply(i, "❌ Your key has expired. Contact support.", C.err);
        const loader = `script_key="${k.key_string}";\nloadstring(game:HttpGet("${BASE}/v1/auth?key="..script_key.."&hwid="..game:GetService("RbxAnalyticsService"):GetClientId()))()`;
        try {
            await user.send({ embeds: [new EmbedBuilder().setColor(C.main).setTitle("📋 Your Script Loader")
                .addFields(
                    { name: "Loader", value: `\`\`\`lua\n${loader}\n\`\`\`` },
                    { name: "Expires", value: fmtExpiry(k), inline: true },
                    { name: "Runs",   value: String(k.total_executions || 0), inline: true }
                ).setFooter({ text: "HWID locks on first run — keep this private" })] });
            return reply(i, "✅ Loader sent to your DMs!", C.ok);
        } catch {
            return reply(i, "❌ Enable DMs from server members in your privacy settings.", C.err);
        }
    }

    if (action === "role") {
        if (!cfg?.buyer_role_id) return reply(i, "❌ No buyer role configured.", C.err);
        const { data: keys } = await sb.from("keys").select("*").eq("discord_id", user.id).eq("active", true);
        if (!keys?.length) return reply(i, "❌ No active key — redeem a key first.", C.err);
        const k = keys[0];
        if (k.expires_at && k.expires_at <= Math.floor(Date.now() / 1000)) return reply(i, "❌ Key expired.", C.err);
        try {
            const gm = await i.guild.members.fetch(user.id);
            if (gm.roles.cache.has(cfg.buyer_role_id)) return reply(i, "✅ You already have the buyer role!", C.ok);
            await gm.roles.add(cfg.buyer_role_id);
            return reply(i, `✅ Given <@&${cfg.buyer_role_id}>!`, C.ok);
        } catch {
            return reply(i, "❌ Failed to assign role — check bot permissions (Manage Roles).", C.err);
        }
    }

    if (action === "hwid") {
        const { data, error } = await sb.from("keys").update({ hwid: null, last_hwid_reset: new Date().toISOString() })
            .eq("discord_id", user.id).eq("active", true).select();
        if (error || !data?.length) return reply(i, "❌ No active key found for your account.", C.err);
        return i.editReply({ embeds: [new EmbedBuilder().setColor(C.ok).setTitle("🔓 HWID Reset")
            .setDescription("Your HWID has been cleared. Run the script again to lock your new device.")], components: [] });
    }

    if (action === "stats") {
        const { data: keys } = await sb.from("keys").select("*").eq("discord_id", user.id).order("created_at", { ascending: false });
        if (!keys?.length) return reply(i, "❌ No key found. Redeem a key first.", C.err);
        const k = keys[0];
        return i.editReply({ embeds: [new EmbedBuilder().setColor(C.main).setTitle("📊 Your Stats")
            .addFields(
                { name: "Status",     value: k.active ? "✅ Active" : "❌ Revoked",           inline: true },
                { name: "Expires",    value: fmtExpiry(k),                                     inline: true },
                { name: "HWID",       value: k.hwid ? "🔒 Locked" : "🔓 Unlocked",            inline: true },
                { name: "Total Runs", value: String(k.total_executions || 0),                  inline: true },
                { name: "Last Run",   value: k.last_exec ? `<t:${Math.floor(new Date(k.last_exec).getTime()/1000)}:R>` : "Never", inline: true },
                { name: "Key",        value: `\`${k.key_string.slice(0, 18)}...\``,           inline: true }
            ).setFooter({ text: cfg?.project_name || "Lunex" }).setTimestamp()], components: [] });
    }
}

// ════════════════════════════════════════════════════════════════════════════
// MODAL HANDLER
// ════════════════════════════════════════════════════════════════════════════
async function handleModal(i) {
    const [modalType, projectId] = i.customId.split(":");
    const { guildId, user } = i;
    const cfg = await getCfg(guildId);

    if (modalType === "redeem_modal") {
        await i.deferReply({ ephemeral: true });
        const keyStr = i.fields.getTextInputValue("key_val").trim();
        // Validate key exists
        const { data: keyRow } = await sb.from("keys").select("*")
            .eq("key_string", keyStr).single();
        if (!keyRow) return reply(i, "❌ Invalid key — check it and try again.", C.err);
        if (!keyRow.active) return reply(i, "❌ This key has been revoked.", C.err);
        if (keyRow.expires_at && keyRow.expires_at <= Math.floor(Date.now() / 1000))
            return reply(i, "❌ This key has expired.", C.err);
        if (keyRow.discord_id && keyRow.discord_id !== user.id)
            return reply(i, "❌ This key is already claimed by another account.", C.err);
        // Link it
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
            .setDescription("Key linked! Use **Get Script** for your loader, or **Get Role** for your buyer role.")
            .addFields(
                { name: "Expires", value: fmtExpiry(keyRow), inline: true },
                { name: "HWID",    value: "🔓 Will lock on first run", inline: true }
            ).setFooter({ text: "Do NOT share your key" })], components: [] });
    }
}

// ── READY ─────────────────────────────────────────────────────────────────────
client.once("ready", async () => {
    console.log(`[Lunex] Ready as ${client.user.tag}`);
    client.user.setActivity("Lunex Whitelist", { type: ActivityType.Watching });
    await seedPresetKeys();
    await registerCommands();
    // Keep-alive ping every 10 minutes
    setInterval(() => {
        console.log(`[Lunex] Alive — ${new Date().toISOString()}`);
        client.user.setActivity("Lunex Whitelist", { type: ActivityType.Watching });
    }, 600_000);
});

client.on("error",      err => console.error("[Lunex] Error:", err));
client.on("disconnect", ()  => {
    console.log("[Lunex] Disconnected — reconnecting in 5s");
    setTimeout(() => client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error), 5000);
});

client.login(process.env.DISCORD_BOT_TOKEN).catch(err => {
    console.error("[Lunex] Login failed:", err);
    setTimeout(() => client.login(process.env.DISCORD_BOT_TOKEN).catch(console.error), 10_000);
});
