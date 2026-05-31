require("dotenv").config();
const express     = require("express");
const cors        = require("cors");
const rateLimit   = require("express-rate-limit");
const { createClient } = require("@supabase/supabase-js");
const crypto      = require("crypto");
const path        = require("path");
const cron        = require("node-cron");

const app = express();
const sb  = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

app.use(cors());
app.use(express.json({ limit: "8mb" }));
app.use(express.static(path.join(__dirname, "dashboard")));

const authLimiter = rateLimit({ windowMs: 60_000, max: 40,  message: { error: "Rate limited" } });
const apiLimiter  = rateLimit({ windowMs: 60_000, max: 200, message: { error: "Rate limited" } });

// ══════════════════════════════════════════════════════════════════════════════
// PROMETHEUS OBFUSCATION ENGINE
// Techniques: variable renaming, string→bytes, number→bit32, dead code,
//             control flow flattening, table indirection, XOR+base64 wrapper
// ══════════════════════════════════════════════════════════════════════════════
const PrometheusObf = (() => {
    const uid  = () => "_" + crypto.randomBytes(5).toString("hex");
    const uid2 = () => crypto.randomBytes(4).toString("hex").toUpperCase();

    // ── String encoder → byte array ──────────────────────────────────────────
    function encodeStr(s) {
        if (s.length === 0) return '""';
        const bytes = Array.from(Buffer.from(s, "utf8")).map(b => b.toString());
        const fn = uid(), r = uid(), i = uid(), S = uid();
        return `(function() local ${S}={${bytes.join(",")}}; local ${r}="" for ${i}=1,#${S} do ${r}=${r}..string.char(${S}[${i}]) end return ${r} end)()`;
    }

    // ── Number encoder → bit32 expression ───────────────────────────────────
    function encodeNum(n) {
        if (!Number.isInteger(n) || Math.abs(n) > 2147483647) return String(n);
        if (n === 0) return "bit32.band(0,0)";
        const a = Math.floor(Math.random() * 0xFFFF) + 1;
        const b = n ^ a;
        const c = Math.floor(Math.random() * 100) + 1;
        const d = a + c;
        return `bit32.bxor(${b},bit32.band(${d},${0xFFFF})-${c})`;
    }

    // ── Junk code generator ──────────────────────────────────────────────────
    function junk() {
        const v = uid(), w = uid();
        const variants = [
            `do local ${v}=math.type and math.type(0) or "integer"; if ${v}=="float" then error() end end`,
            `do local ${v}={};local ${w}=0;for _=1,0 do ${w}=${w}+1 end;${v}[${w}+1]=true end`,
            `do local ${v}=string.byte("\\0");if ${v}>255 then error() end end`,
            `do local ${v}=type(nil)=="nil";if not ${v} then error() end end`,
            `do local ${v}=select("#");if ${v}>0 then end end`,
            `do local ${v}=math.floor(0.5);if ${v}>0 then error() end end`,
        ];
        return variants[Math.floor(Math.random() * variants.length)];
    }

    // ── Variable rename pass ─────────────────────────────────────────────────
    function renameVars(src) {
        const map = {};
        // Match: local name = or local name, name =
        src = src.replace(/\blocal\s+([a-zA-Z][a-zA-Z0-9_]{2,})\s*=/g, (m, name) => {
            const skip = ["_G","_ENV","game","workspace","script","shared","plugin","math","table","string","os","io","bit32","utf8","coroutine","debug","package","loadstring","require","pairs","ipairs","next","select","type","error","assert","pcall","xpcall","tostring","tonumber","rawget","rawset","rawequal","rawlen","setmetatable","getmetatable","unpack","print","warn"];
            if (skip.includes(name)) return m;
            if (!map[name]) map[name] = uid();
            return `local ${map[name]} =`;
        });
        for (const [orig, renamed] of Object.entries(map)) {
            src = src.replace(new RegExp(`\\b${orig}\\b`, "g"), renamed);
        }
        return src;
    }

    // ── String obfuscation pass ──────────────────────────────────────────────
    function obfStrings(src) {
        return src.replace(/"((?:[^"\\]|\\.)*)"/g, (m, inner) => {
            if (inner.length < 2 || inner.length > 80) return m;
            if (/[\\n\\r\\t\\0]/.test(inner)) return m;
            if (inner.includes("\\")) return m;
            if (Math.random() < 0.3) return m; // only obf 70% of strings
            try { return encodeStr(inner); } catch { return m; }
        });
    }

    // ── Number obfuscation pass ──────────────────────────────────────────────
    function obfNumbers(src) {
        return src.replace(/\b(\d+)\b/g, (m, n) => {
            const num = parseInt(n);
            if (num > 1000000 || Math.random() < 0.35) return m; // skip large/some nums
            return encodeNum(num);
        });
    }

    // ── Table indirection (wrap globals in a lookup table) ───────────────────
    function addTableIndirection(src) {
        const tbl = uid();
        const header = `local ${tbl}={_G=_G,game=game,pairs=pairs,ipairs=ipairs,type=type,tostring=tostring,tonumber=tonumber,math=math,string=string,table=table,bit32=bit32,print=print,warn=warn,error=error,pcall=pcall,select=select};`;
        return header + "\n" + src;
    }

    // ── Control flow flattener (wrap top-level in dispatcher) ────────────────
    function flattenFlow(src) {
        const state = uid(), dispatch = uid();
        const steps = src.split(/\n(?=local |function |for |while |if |do |repeat )/)
            .filter(s => s.trim().length > 0);
        if (steps.length < 3) return src; // not worth it for short scripts
        const caseLines = steps.map((s, i) => `if ${state}==${i} then\n${s}\n${state}=${i+1}\n`).join(" else") + " end";
        return `local ${state}=0\nwhile ${state}<${steps.length} do\n${caseLines}\nend`;
    }

    // ── Junk insertion pass ──────────────────────────────────────────────────
    function insertJunk(src) {
        const lines = src.split("\n");
        const out = [];
        for (let i = 0; i < lines.length; i++) {
            out.push(lines[i]);
            if (i > 0 && i % 12 === 0 && Math.random() > 0.45) out.push(junk());
        }
        return out.join("\n");
    }

    // ── Final XOR + Base64 wrapper ───────────────────────────────────────────
    function xorWrap(src) {
        const key   = crypto.randomBytes(24);
        const kLen  = key.length;
        const srcBuf = Buffer.from(src, "utf8");
        const xored  = Buffer.alloc(srcBuf.length);
        for (let i = 0; i < srcBuf.length; i++) xored[i] = srcBuf[i] ^ key[i % kLen];
        const b64    = xored.toString("base64");
        const kBytes = Array.from(key).map(b => b.toString()).join(",");
        // Chunk base64 to avoid line-length issues
        const chunks = [];
        for (let i = 0; i < b64.length; i += 64) chunks.push(`"${b64.slice(i, i+64)}"`);
        const chunksStr = `{${chunks.join(",")}}`;
        const kStr      = `{${kBytes}}`;
        const S=uid(),r=uid(),o=uid(),i2=uid(),b=uid(),c=uid(),d=uid(),m=uid(),j=uid();
        // Decode+XOR+execute the payload
        return `-- Dragon Whitelist Protected Script
local ${b}="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local ${m}={}; for ${i2}=1,#${b} do ${m}[${b}:sub(${i2},${i2})]=${i2}-1 end
local function ${d}(${S})
  ${S}=${S}:gsub("[^A-Za-z0-9+/=]",""); local ${o}={}
  for ${i2}=1,#${S},4 do
    local ${c}=({${m}[${S}:sub(${i2},${i2})] or 0,${m}[${S}:sub(${i2}+1,${i2}+1)] or 0,${m}[${S}:sub(${i2}+2,${i2}+2)] or 0,${m}[${S}:sub(${i2}+3,${i2}+3)] or 0})
    local ${r}=${c}[1]*262144+${c}[2]*4096+${c}[3]*64+${c}[4]
    ${o}[#${o}+1]=string.char(math.floor(${r}/65536)%256)
    if ${S}:sub(${i2}+2,${i2}+2)~="=" then ${o}[#${o}+1]=string.char(math.floor(${r}/256)%256) end
    if ${S}:sub(${i2}+3,${i2}+3)~="=" then ${o}[#${o}+1]=string.char(${r}%256) end
  end
  return table.concat(${o})
end
local ${j}=${kStr}; local ${c}=${chunksStr}
local ${S}=${d}(table.concat(${c})); local ${o}={}
for ${i2}=1,#${S} do ${o}[${i2}]=string.char(string.byte(${S},${i2})~${j}[((${i2}-1)%#${j})+1]) end
assert(loadstring(table.concat(${o})))()`;
    }

    // ── FULL OBFUSCATION PIPELINE ────────────────────────────────────────────
    return function obfuscate(source, level = "full") {
        let s = source;
        if (level === "light") {
            s = obfStrings(s);
            s = insertJunk(s);
            s = xorWrap(s);
            return s;
        }
        // Full pipeline
        s = renameVars(s);
        s = obfStrings(s);
        s = obfNumbers(s);
        s = insertJunk(s);
        s = xorWrap(s);
        return s;
    };
})();

// ── Key + API key generators ──────────────────────────────────────────────────
function genKey(prefix = "DRAG") {
    const seg = () => crypto.randomBytes(3).toString("hex").toUpperCase();
    return `${prefix}-${seg()}-${seg()}-${seg()}`;
}
function genApiKey() { return crypto.randomBytes(28).toString("hex"); }

// ── Auth middleware ───────────────────────────────────────────────────────────
async function requireApiKey(req, res, next) {
    const key = (req.headers["authorization"] || "").replace("Bearer ", "").trim()
        || req.headers["x-api-key"];
    if (!key) return res.status(401).json({ error: "No API key" });
    const { data } = await sb.from("owners").select("*").eq("api_key", key).single();
    if (!data) return res.status(403).json({ error: "Invalid API key" });
    if (data.expires_at && Date.now() / 1000 > data.expires_at)
        return res.status(403).json({ error: "API key expired" });
    req.owner = data;
    next();
}


// ── DEBUG endpoint (remove after fixing) ─────────────────────────────────────
app.get("/debug", async (req, res) => {
    const info = {
        supabase_url_set:  !!process.env.SUPABASE_URL,
        supabase_key_set:  !!process.env.SUPABASE_SERVICE_KEY,
        master_secret_set: !!process.env.MASTER_SECRET,
        railway_domain:    process.env.RAILWAY_PUBLIC_DOMAIN || "not set",
        node_version:      process.version,
    };
    // Test Supabase connection
    try {
        const { data, error } = await sb.from("owners").select("id, email, plan").limit(3);
        info.supabase_connected = !error;
        info.supabase_error     = error?.message || null;
        info.owners_found       = data?.length || 0;
        info.owners             = data?.map(o => ({ email: o.email, plan: o.plan })) || [];
    } catch(e) {
        info.supabase_connected = false;
        info.supabase_error     = e.message;
    }
    res.json(info);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCRIPT AUTH (users' Lua loaders hit this)
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/v1/auth", authLimiter, async (req, res) => {
    const lua = (msg) => res.set("Content-Type","text/plain").send(`error(${JSON.stringify("Lunex: " + msg)})`);

    const { key: userKey, hwid } = req.query;
    if (!userKey || !hwid) return lua("Missing key or hwid");

    // Step 1: look up the key row by itself (no join — avoids null if script missing)
    const { data: keyRow, error: keyErr } = await sb.from("keys")
        .select("*").eq("key_string", userKey.trim()).single();

    if (keyErr || !keyRow) return lua("Invalid key");
    if (!keyRow.active)    return lua("Key revoked — contact support");
    if (keyRow.expires_at && Date.now() / 1000 > keyRow.expires_at)
        return lua("Key expired — contact support");

    // Step 2: HWID lock
    const now = new Date().toISOString();
    if (!keyRow.hwid) {
        // First run — lock HWID, start key_days timer if set
        const expires_at = keyRow.key_days
            ? Math.floor(Date.now() / 1000) + keyRow.key_days * 86400
            : keyRow.expires_at;
        await sb.from("keys").update({
            hwid,
            total_executions: 1,
            last_exec: now,
            ...(expires_at !== keyRow.expires_at ? { expires_at } : {})
        }).eq("id", keyRow.id);
    } else if (keyRow.hwid !== hwid) {
        return lua("HWID mismatch — run /reset-hwid in our Discord");
    } else {
        await sb.from("keys").update({
            total_executions: (keyRow.total_executions || 0) + 1,
            last_exec: now
        }).eq("id", keyRow.id);
    }

    // Step 3: fetch project separately
    if (!keyRow.project_id) return lua("Key has no project assigned");
    const { data: project } = await sb.from("projects")
        .select("obfuscated_script, active, name, ffa")
        .eq("id", keyRow.project_id).single();

    if (!project)          return lua("Project not found");
    if (!project.active)   return lua("Script is currently offline");
    if (!project.ffa && !keyRow.hwid && !hwid) return lua("Not whitelisted");

    const script = project.obfuscated_script;
    if (!script || script.trim() === "") return lua("No script uploaded yet — contact the developer");

    res.set("Content-Type", "text/plain");
    res.send(script);
});

// ═══════════════════════════════════════════════════════════════════════════════
// OWNER API — ACCOUNT
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/v1/account", apiLimiter, requireApiKey, async (req, res) => {
    const { data } = await sb.from("owners")
        .select("email, plan, created_at, expires_at, obfs_used, obfs_reset_at")
        .eq("id", req.owner.id).single();
    res.json({ success: true, account: data });
});

// Bulk generate owner API keys (admin use)
app.post("/v1/admin/owners", async (req, res) => {
    if (req.body.admin_secret !== process.env.ADMIN_SECRET)
        return res.status(403).json({ error: "Forbidden" });
    const { email, plan = "starter", days } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });
    const apiKey   = genApiKey();
    const expires  = days ? Math.floor(Date.now() / 1000) + days * 86400 : null;
    const { data, error } = await sb.from("owners").insert({
        email, api_key: apiKey, plan, expires_at: expires, obfs_used: 0
    }).select("id, email, plan").single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, api_key: apiKey, owner: data });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OWNER API — PROJECTS
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/v1/projects", apiLimiter, requireApiKey, async (req, res) => {
    const { data } = await sb.from("projects")
        .select("id, name, ffa, active, script_version, created_at, updated_at")
        .eq("owner_id", req.owner.id)
        .order("created_at", { ascending: false });
    res.json({ success: true, projects: data || [] });
});

app.post("/v1/projects", apiLimiter, requireApiKey, async (req, res) => {
    const { name, ffa = false } = req.body;
    if (!name) return res.status(400).json({ error: "Name required" });
    // Plan script limit
    const { count } = await sb.from("projects")
        .select("*", { count: "exact", head: true }).eq("owner_id", req.owner.id);
    const scriptLimits = { starter: 2, pro: 8, elite: 18 };
    if ((count || 0) >= (scriptLimits[req.owner.plan] || 2))
        return res.status(429).json({ error: `Script limit reached for your plan (${req.owner.plan})` });
    const { data, error } = await sb.from("projects").insert({
        owner_id: req.owner.id, name, ffa, active: true, script_version: "0001"
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, project: data });
});


// PATCH project (name/ffa)
app.patch("/v1/projects/:project_id", apiLimiter, requireApiKey, async (req, res) => {
    const { name, ffa } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (ffa !== undefined) updates.ffa = ffa;
    updates.updated_at = new Date().toISOString();
    const { data, error } = await sb.from("projects")
        .update(updates)
        .eq("id", req.params.project_id)
        .eq("owner_id", req.owner.id)
        .select().single();
    if (error || !data) return res.status(404).json({ error: "Project not found" });
    res.json({ success: true, project: data });
});

app.delete("/v1/projects/:project_id", apiLimiter, requireApiKey, async (req, res) => {
    await sb.from("projects").delete()
        .eq("id", req.params.project_id).eq("owner_id", req.owner.id);
    res.json({ success: true });
});

// Upload + obfuscate
app.post("/v1/projects/:project_id/script", apiLimiter, requireApiKey, async (req, res) => {
    const { source, level = "full" } = req.body;
    if (!source) return res.status(400).json({ error: "Source required" });
    const { data: proj } = await sb.from("projects").select("*")
        .eq("id", req.params.project_id).eq("owner_id", req.owner.id).single();
    if (!proj) return res.status(404).json({ error: "Project not found" });
    // Obfuscation limit check
    const limits = { starter: 20, pro: 100, elite: 3000 };
    const lim = limits[req.owner.plan] || 20;
    if ((req.owner.obfs_used || 0) >= lim)
        return res.status(429).json({ error: `Obfuscation limit reached (${lim}/month for ${req.owner.plan} plan)` });
    let obfuscated;
    try { obfuscated = PrometheusObf(source, level); }
    catch (e) { return res.status(500).json({ error: "Obfuscation failed: " + e.message }); }
    const newVer = String(parseInt(proj.script_version || "0000") + 1).padStart(4, "0");
    await sb.from("projects").update({
        obfuscated_script: obfuscated, raw_script: source,
        script_version: newVer, updated_at: new Date().toISOString()
    }).eq("id", proj.id);
    await sb.from("owners").update({ obfs_used: (req.owner.obfs_used || 0) + 1 }).eq("id", req.owner.id);
    const baseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
        ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
        : `http://localhost:${process.env.PORT || 3000}`;
    const loader = `script_key="KEY_HERE"; loadstring(game:HttpGet("${baseUrl}/v1/auth?key="..script_key.."&hwid="..game:GetService("RbxAnalyticsService"):GetClientId()))()`;
    res.json({ success: true, version: newVer, obfuscated_length: obfuscated.length, loader });
});

// Toggle active
app.post("/v1/projects/:project_id/toggle", apiLimiter, requireApiKey, async (req, res) => {
    const { data: proj } = await sb.from("projects").select("active")
        .eq("id", req.params.project_id).eq("owner_id", req.owner.id).single();
    if (!proj) return res.status(404).json({ error: "Not found" });
    await sb.from("projects").update({ active: !proj.active }).eq("id", req.params.project_id);
    res.json({ success: true, active: !proj.active });
});

// ═══════════════════════════════════════════════════════════════════════════════
// OWNER API — KEYS
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/v1/projects/:project_id/keys", apiLimiter, requireApiKey, async (req, res) => {
    const { page = 1, limit = 50, search, filter } = req.query;
    const off = (page - 1) * Math.min(limit, 200);
    let q = sb.from("keys").select("*", { count: "exact" })
        .eq("project_id", req.params.project_id)
        .order("created_at", { ascending: false })
        .range(off, off + parseInt(limit) - 1);
    if (search) q = q.ilike("key_string", `%${search}%`);
    if (filter === "active")  q = q.eq("active", true);
    if (filter === "revoked") q = q.eq("active", false);
    const { data, error, count } = await q;
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, keys: data || [], total: count || 0 });
});

// Generate keys
app.post("/v1/projects/:project_id/keys", apiLimiter, requireApiKey, async (req, res) => {
    const { amount = 1, key_days, discord_id, note, prefix = "DRAG" } = req.body;
    if (amount > 500) return res.status(400).json({ error: "Max 500 per request" });
    const { count } = await sb.from("keys")
        .select("*", { count: "exact", head: true })
        .eq("project_id", req.params.project_id);
    const userLimits = { starter: 200, pro: 1000, elite: 10000 };
    const maxU = userLimits[req.owner.plan] || 200;
    if ((count || 0) + amount > maxU)
        return res.status(429).json({ error: `User limit reached (${maxU} for ${req.owner.plan} plan)` });
    const rows = Array.from({ length: amount }, () => ({
        project_id:       req.params.project_id,
        key_string:       genKey(prefix),
        discord_id:       discord_id || null,
        note:             note || null,
        active:           true,
        key_days:         key_days || null,
        expires_at:       req.body.expires_at || null,
        total_executions: 0,
        created_at:       new Date().toISOString()
    }));
    const { data, error } = await sb.from("keys").insert(rows).select("key_string");
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, count: data.length, keys: data.map(k => k.key_string) });
});

// Bulk revoke
app.post("/v1/projects/:project_id/keys/bulk-revoke", apiLimiter, requireApiKey, async (req, res) => {
    const { keys } = req.body; // array of key strings
    if (!Array.isArray(keys)) return res.status(400).json({ error: "keys must be array" });
    await sb.from("keys").update({ active: false }).in("key_string", keys).eq("project_id", req.params.project_id);
    res.json({ success: true, revoked: keys.length });
});

// Reset HWID
app.post("/v1/keys/:key_string/resethwid", apiLimiter, requireApiKey, async (req, res) => {
    const { data } = await sb.from("keys").update({ hwid: null, last_hwid_reset: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("key_string", req.params.key_string).select().single();
    if (!data) return res.status(404).json({ error: "Key not found" });
    res.json({ success: true });
});

// Revoke
app.post("/v1/keys/:key_string/revoke", apiLimiter, requireApiKey, async (req, res) => {
    await sb.from("keys").update({ active: false }).eq("key_string", req.params.key_string);
    res.json({ success: true });
});

// Unrevoke
app.post("/v1/keys/:key_string/unrevoke", apiLimiter, requireApiKey, async (req, res) => {
    await sb.from("keys").update({ active: true }).eq("key_string", req.params.key_string);
    res.json({ success: true });
});

// Key info
app.get("/v1/keys/:key_string", apiLimiter, requireApiKey, async (req, res) => {
    const { data } = await sb.from("keys").select("*").eq("key_string", req.params.key_string).single();
    if (!data) return res.status(404).json({ error: "Key not found" });
    res.json({ success: true, key: data });
});

// Extend
app.post("/v1/keys/:key_string/extend", apiLimiter, requireApiKey, async (req, res) => {
    const { days } = req.body;
    if (!days || days < 1) return res.status(400).json({ error: "Days required" });
    const { data } = await sb.from("keys").select("expires_at").eq("key_string", req.params.key_string).single();
    if (!data) return res.status(404).json({ error: "Key not found" });
    const base = data.expires_at ?? Math.floor(Date.now() / 1000);
    const newExpiry = base + days * 86400;
    await sb.from("keys").update({ expires_at: newExpiry }).eq("key_string", req.params.key_string);
    res.json({ success: true, new_expiry: newExpiry });
});

// ═══════════════════════════════════════════════════════════════════════════════
// STATS
// ═══════════════════════════════════════════════════════════════════════════════
app.get("/v1/stats", apiLimiter, requireApiKey, async (req, res) => {
    const { data: projs } = await sb.from("projects").select("id").eq("owner_id", req.owner.id);
    const ids = (projs || []).map(p => p.id);
    if (!ids.length) return res.json({ success: true, projects: 0, total_keys: 0, total_executions: 0, plan: req.owner.plan, obfs_used: 0 });
    const [keyCnt, execs] = await Promise.all([
        sb.from("keys").select("*", { count: "exact", head: true }).in("project_id", ids),
        sb.from("keys").select("total_executions").in("project_id", ids)
    ]);
    const totalExecs = (execs.data || []).reduce((s, k) => s + (k.total_executions || 0), 0);
    res.json({ success: true, projects: ids.length, total_keys: keyCnt.count || 0, total_executions: totalExecs, plan: req.owner.plan, obfs_used: req.owner.obfs_used || 0 });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INTERNAL (Discord bot → server)
// ═══════════════════════════════════════════════════════════════════════════════
function checkInternal(req, res) {
    if (req.body.secret !== process.env.MASTER_SECRET) {
        res.status(403).json({ error: "Forbidden" });
        return false;
    }
    return true;
}

app.post("/internal/whitelist", async (req, res) => {
    if (!checkInternal(req, res)) return;
    const { project_id, discord_id, days, note } = req.body;
    const key        = genKey();
    const expires_at = days ? Math.floor(Date.now() / 1000) + days * 86400 : null;
    const { data, error } = await sb.from("keys").insert({
        project_id, key_string: key, discord_id, note: note || null,
        active: true, key_days: days || null, expires_at, total_executions: 0,
        created_at: new Date().toISOString()
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, key: data.key_string });
});

app.post("/internal/resethwid", async (req, res) => {
    if (!checkInternal(req, res)) return;
    const { discord_id } = req.body;
    const { data } = await sb.from("keys").update({ hwid: null, last_hwid_reset: new Date().toISOString() })
        .eq("discord_id", discord_id).select("key_string");
    res.json({ success: true, updated: data?.length || 0 });
});

app.post("/internal/revoke", async (req, res) => {
    if (!checkInternal(req, res)) return;
    await sb.from("keys").update({ active: false }).eq("discord_id", req.body.discord_id);
    res.json({ success: true });
});

app.get("/internal/keyinfo", async (req, res) => {
    if (req.query.secret !== process.env.MASTER_SECRET) return res.status(403).json({ error: "Forbidden" });
    const { data } = await sb.from("keys").select("*").eq("discord_id", req.query.discord_id);
    res.json({ success: true, keys: data || [] });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CRON JOBS
// ═══════════════════════════════════════════════════════════════════════════════
// Expire keys daily
cron.schedule("0 3 * * *", async () => {
    const now = Math.floor(Date.now() / 1000);
    const { count } = await sb.from("keys").update({ active: false })
        .lt("expires_at", now).eq("active", true);
    console.log(`[CRON] Expired ${count || 0} keys`);
});
// Reset monthly obfuscation counters
cron.schedule("0 0 1 * *", async () => {
    await sb.from("owners").update({ obfs_used: 0, obfs_reset_at: new Date().toISOString() });
    console.log("[CRON] Obfuscation counters reset");
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "dashboard", "index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`[Dragon Whitelist] Port ${PORT}`));
