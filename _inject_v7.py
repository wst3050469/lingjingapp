# _inject_v7.py — DEPRECATED as of v1.73.88
# The v9 safe-require wrapper is now directly embedded in build-main.mjs (SAFE_REQUIRE_PREAMBLE).
# This standalone injection script is preserved for historical reference only.
# Last used: v1.73.84 (v7 repair)
import re

fpath = r'D:\lingjing-ide\desktop\electron\scripts\build-main.mjs'
with open(fpath, 'rb') as f:
    content = f.read()

# Find the SAFE_REQUIRE_PREAMBLE array start
start_marker = b"const SAFE_REQUIRE_PREAMBLE = ["
start_idx = content.find(start_marker)
if start_idx < 0:
    print("NOT FOUND")
    exit(1)

# Find the end of the array: "    ].join('\\n')\n" 
# Look for the pattern after the "});" line
# Find the '          },' pattern that marks the end of the preamble array
end_marker = b"    ].join('\\n')\r\n"
end_idx = content.find(end_marker, start_idx)
if end_idx < 0:
    # Try without CR
    end_marker = b"    ].join('\\n')\n"
    end_idx = content.find(end_marker, start_idx)

if end_idx < 0:
    print(f"end_marker not found after byte {start_idx}")
    # Print nearby content
    print(content[start_idx:start_idx+2000].decode('utf-8', errors='replace')[-500:])
    exit(1)

print(f"Found preamble: bytes {start_idx} to {end_idx} ({end_idx - start_idx} bytes)")

# Build the v7 preamble (without CR)
v7_preamble = """    const SAFE_REQUIRE_PREAMBLE = [
      '// @codepilot/core safe-require wrapper (v7: persistent userData backup survives ANY update)',
      'var __safeRequireCodepilot = (function(subpath) {',
      '  var modulePath = "@codepilot/core" + (subpath ? "/" + subpath : "");',
      '  var __getPersistentDir = function() {',
      '    try {',
      '      var _homedir = require("os").homedir();',
      '      var _pdir;',
      '      if (process.platform === "win32") {',
      '        _pdir = require("path").join(_homedir, ".lingjing", "backup", "codepilot-core");',
      '      } else if (process.platform === "darwin") {',
      '        _pdir = require("path").join(_homedir, "Library", "Application Support", "lingjing-ide", "codepilot-persistent");',
      '      } else {',
      '        _pdir = require("path").join(_homedir, ".config", "lingjing-ide", "codepilot-persistent");',
      '      }',
      '      return _pdir;',
      '    } catch(e) { return null; }',
      '  };',
      '  var __repairCodepilot = function() {',
      '    try {',
      '      var _fs2 = require("fs");',
      '      var _path2 = require("path");',
      '      var _unpackedPath = _path2.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "@codepilot", "core", "dist");',
      '      var _strategies = [',
      '        { name: "asar-backup", src: _path2.join(__dirname, "__codepilot_dist__") },',
      '        { name: "extraResources", src: _path2.join(process.resourcesPath, "codepilot-core-dist") },',
      '        { name: "persistent", src: __getPersistentDir() },',
      '      ];',
      '      for (var _si = 0; _si < _strategies.length; _si++) {',
      '        var _strat = _strategies[_si];',
      '        if (!_strat.src || !_fs2.existsSync(_strat.src)) continue;',
      '        var _entries = 0; try { _entries = _fs2.readdirSync(_strat.src).length; } catch(e) {}',
      '        console.log("[main] @codepilot repair: " + _strat.name + " (" + _entries + " files)");',
      '        try {',
      '          if (_fs2.existsSync(_unpackedPath)) _fs2.rmSync(_unpackedPath, { recursive: true, force: true });',
      '          _fs2.mkdirSync(_path2.dirname(_unpackedPath), { recursive: true });',
      '          _fs2.cpSync(_strat.src, _unpackedPath, { recursive: true, force: true });',
      '          try { delete require.cache[require.resolve("@codepilot/core")]; } catch {}',
      '          return true;',
      '        } catch(_ce) {',
      '          console.warn("[main] @codepilot repair " + _strat.name + " copy failed:", _ce.message);',
      '        }',
      '      }',
      '      console.warn("[main] @codepilot/core repair: ALL strategies exhausted");',
      '    } catch(e2) {',
      '      console.warn("[main] @codepilot/core repair error:", e2.message);',
      '    }',
      '    return false;',
      '  };',
      '  // v7: Write persistent backup on first successful load',
      '  var __savePersistent = function() {',
      '    try {',
      '      var _fs3 = require("fs");',
      '      var _pdir = __getPersistentDir();',
      '      if (!_pdir) return;',
      '      if (_fs3.existsSync(_pdir)) return; // already saved',
      '      var _src = require("path").join(process.resourcesPath, "app.asar.unpacked", "node_modules", "@codepilot", "core", "dist");',
      '      if (!_fs3.existsSync(_src)) {',
      '        _src = require("path").join(process.resourcesPath, "codepilot-core-dist");',
      '      }',
      '      if (_fs3.existsSync(_src)) {',
      '        _fs3.mkdirSync(require("path").dirname(_pdir), { recursive: true });',
      '        _fs3.cpSync(_src, _pdir, { recursive: true, force: true });',
      '        console.log("[main] @codepilot persistent backup saved (" + _fs3.readdirSync(_pdir).length + " files)");',
      '      }',
      '    } catch(e) {}',
      '  };',
      '  // v6: Stub module with noop functions for graceful degradation.',
      '  // When @codepilot/core is unavailable, the app still starts but core features',
      '  // (Agent, Quest) will show user-friendly errors instead of crashing.',
      '  var __stub = function() {',
      '    console.warn("[main] @codepilot/core stub module — core features degraded");',
      '    return {',
      '      loadPrompts: function() { return Promise.resolve(); },',
      '      getPrompt: function() { return ""; },',
      '      MAIN_PROMPT: "",',
      '      clearPromptCache: function() {},',
      '      Agent: function() { throw new Error("Agent unavailable — @codepilot/core not loaded"); },',
      '      Conversation: function() { throw new Error("Conversation unavailable"); },',
      '      loadConfig: function() { return Promise.resolve({}); },',
      '      createProvider: function() { throw new Error("Provider unavailable — @codepilot/core not loaded"); },',
      '      createDefaultRegistry: function() { return { tools: new Map(), register: function(){} }; },',
      '      estimateTokens: function() { return 0; },',
      '      estimateMessageTokens: function() { return 0; },',
      '    };',
      '  };',
      '  try {',
      '    var mod = require(modulePath);',
      '    if (!subpath && mod && typeof mod.loadPrompts !== "function") {',
      '      console.warn("[main] @codepilot/core outdated (loadPrompts missing), attempting auto-repair...");',
      '      if (__repairCodepilot()) {',
      '        var _repaired = require(modulePath);',
      '        if (_repaired && typeof _repaired.loadPrompts === "function") {',
      '          __savePersistent();',
      '          return _repaired;',
      '        }',
      '      }',
      '      console.warn("[main] @codepilot/core repair failed — merging stubs for graceful degradation");',
      '      var _st = __stub();',
      '      for (var _k in _st) { if (!(_k in mod) || typeof mod[_k] !== "function") { mod[_k] = _st[_k]; } }',
      '    } else if (!subpath) {',
      '      __savePersistent();',
      '    }',
      '    return mod;',
      '  } catch(e) {',
      '    if (e && (e.code === "MODULE_NOT_FOUND" || e.code === "ERR_MODULE_NOT_FOUND" ||',
      '        (e.message && e.message.indexOf("codepilot") !== -1))) {',
      '      console.warn("[main] " + modulePath + " unavailable, attempting auto-repair...");',
      '      if (__repairCodepilot()) {',
      '        try { var _r = require(modulePath); __savePersistent(); return _r; } catch(e3) {}',
      '      }',
      '      console.warn("[main] " + modulePath + " unavailable, returning stub module");',
      '      return __stub();',
      '    }',
      '    throw e;',
      '  }',
      '})',
      '',
"""

# Replace in content (converting to same line endings as original)
# The original uses \r\n, we need to convert our preamble
v7_bytes = v7_preamble.encode('utf-8')
# Check if original uses CRLF
has_cr = b'\r\n' in content[start_idx:end_idx]
if has_cr:
    v7_bytes = v7_bytes.replace(b'\n', b'\r\n')

new_content = content[:start_idx] + v7_bytes + content[end_idx:]

with open(fpath, 'wb') as f:
    f.write(new_content)

print(f"✅ v7 preamble injected ({len(v7_bytes)} bytes)")
print(f"New file size: {len(new_content)} bytes")
