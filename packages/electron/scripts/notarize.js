// Stub notarize script - only used for macOS code signing
// No-op on Windows/Linux
exports.default = async function () {
  console.log('[notarize] Skipping notarization (not macOS)');
};
