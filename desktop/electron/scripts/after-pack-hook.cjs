// after-pack-hook.cjs — electron-builder afterPack hook
// Called AFTER ASAR is created but BEFORE NSIS/AppImage/portable installers.
//
// v1.73.58: @codepilot/core is now asarUnpacked — it lives outside the ASAR as
//   real files in app.asar.unpacked/node_modules/@codepilot/core/.
//   This avoids the resolveExports() path corruption bug in NSIS temp
//   directories because core is on the real filesystem, not inside the
//   ASAR virtual filesystem where Electron's patched module resolver can
//   produce truncated paths (\..\ or \re.\).
//
//   package.json fix (remove private) is done in build-main.mjs during the
//   symlink→real-files conversion step, before electron-builder packages.

exports.default = async function afterPack(context) {
  console.log('[afterPack] v1.73.58: @codepilot/core is asarUnpacked — no injection needed');
  console.log('[afterPack] ✅ Core lives in app.asar.unpacked (real filesystem, resolves safely)');
};
