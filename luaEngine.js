/**
 * Prometheus Lua Obfuscator Engine (Node.js)
 * Runs the real Prometheus obfuscator via wasmoon (Lua 5.4 WASM VM).
 * Adapted from the browser version — uses fs.readFileSync instead of fetch.
 */
const fs = require("fs");
const path = require("path");
const { LuaFactory } = require("wasmoon");

const MODULE_PATHS = [
  "lua/colors.lua",
  "lua/config.lua",
  "lua/logger.lua",
  "lua/presets.lua",
  "lua/highlightlua.lua",
  "lua/prometheus.lua",
  "lua/prometheus/ast.lua",
  "lua/prometheus/bit.lua",
  "lua/prometheus/enums.lua",
  "lua/prometheus/parser.lua",
  "lua/prometheus/pipeline.lua",
  "lua/prometheus/randomLiterals.lua",
  "lua/prometheus/randomStrings.lua",
  "lua/prometheus/scope.lua",
  "lua/prometheus/step.lua",
  "lua/prometheus/steps.lua",
  "lua/prometheus/tokenizer.lua",
  "lua/prometheus/unparser.lua",
  "lua/prometheus/util.lua",
  "lua/prometheus/visitast.lua",
  "lua/prometheus/compiler/compiler.lua",
  "lua/prometheus/namegenerators.lua",
  "lua/prometheus/namegenerators/Il.lua",
  "lua/prometheus/namegenerators/confuse.lua",
  "lua/prometheus/namegenerators/mangled.lua",
  "lua/prometheus/namegenerators/mangled_shuffled.lua",
  "lua/prometheus/namegenerators/number.lua",
  "lua/prometheus/steps/AddVararg.lua",
  "lua/prometheus/steps/AntiTamper.lua",
  "lua/prometheus/steps/ConstantArray.lua",
  "lua/prometheus/steps/EncryptStrings.lua",
  "lua/prometheus/steps/NumbersToExpressions.lua",
  "lua/prometheus/steps/ProxifyLocals.lua",
  "lua/prometheus/steps/SplitStrings.lua",
  "lua/prometheus/steps/Vmify.lua",
  "lua/prometheus/steps/Watermark.lua",
  "lua/prometheus/steps/WatermarkCheck.lua",
  "lua/prometheus/steps/WrapInFunction.lua",
];

let enginePromise = null;

async function initEngine() {
  const factory = new LuaFactory();

  const baseDir = path.join(__dirname);
  for (const relPath of MODULE_PATHS) {
    const absPath = path.join(baseDir, relPath);
    const content = fs.readFileSync(absPath, "utf8");
    await factory.mountFile("/" + relPath, content);
  }

  const lua = await factory.createEngine();

  await lua.doString(`
    arg = arg or {}
    unpack = unpack or table.unpack
    loadstring = loadstring or load

    package.path = "/lua/?.lua;/lua/?/init.lua;" .. (package.path or "")

    local ok, err = pcall(function()
      _G._Prometheus = require("prometheus")
      _G._Prometheus.Logger.logLevel = _G._Prometheus.Logger.LogLevel.Error
    end)
    if not ok then
      error("Failed to initialise Prometheus: " .. tostring(err))
    end

    function _G._obfuscate(code, presetName)
      local preset = _G._Prometheus.Presets[presetName]
      if not preset then
        return false, "Unknown preset: " .. tostring(presetName)
      end
      local pipeline = _G._Prometheus.Pipeline:fromConfig(preset)
      return pcall(function()
        return pipeline:apply(code)
      end)
    end
  `);

  return lua;
}

function getEngine() {
  if (!enginePromise) {
    enginePromise = initEngine().catch((err) => {
      enginePromise = null;
      throw err;
    });
  }
  return enginePromise;
}

// Map luamor's level names to Prometheus presets
const LEVEL_TO_PRESET = {
  light:  "Weak",
  medium: "Medium",
  full:   "Strong",
  max:    "Maximum",
};

/**
 * Obfuscate Lua code using Prometheus.
 * @param {string} code  - Lua source
 * @param {string} level - "light" | "medium" | "full" | "max"  (default "full")
 * @returns {Promise<string>}
 */
async function obfuscateLua(code, level = "full") {
  const preset = LEVEL_TO_PRESET[level] || "Strong";
  const lua = await getEngine();

  lua.global.set("_input_code", code);
  lua.global.set("_input_preset", preset);

  await lua.doString("_result_ok, _result_value = _obfuscate(_input_code, _input_preset)");

  const ok    = lua.global.get("_result_ok");
  const value = lua.global.get("_result_value");

  if (!ok) {
    throw new Error(typeof value === "string" ? value : "Obfuscation failed");
  }
  if (typeof value !== "string") {
    throw new Error("Unexpected result type from obfuscator");
  }
  return value;
}

/** Warm up the engine at startup so the first upload is not slow. */
async function preloadEngine() {
  await getEngine();
}

module.exports = { obfuscateLua, preloadEngine };
