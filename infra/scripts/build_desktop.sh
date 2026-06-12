#!/bin/bash
set -e
cd /home/liuhui/lingjing/packages/electron
echo "Building desktop v1.73.34..."

# Set artifact name with correct version
cat > /tmp/eb-config.json << 'EBEOF'
{
  "appId": "com.zhejiangjinmo.lingjing",
  "productName": "灵境",
  "directories": { "output": "release" },
  "win": {
    "target": [
      { "target": "nsis", "arch": ["x64"] }
    ],
    "artifactName": "LingJing-Setup-${version}-win-x64.${ext}"
  },
  "nsis": {
    "oneClick": false,
    "perMachine": true,
    "allowToChangeInstallationDirectory": true,
    "artifactName": "灵境 Setup ${version}.${ext}",
    "createDesktopShortcut": true,
    "installerIcon": "assets/icon.ico"
  }
}
EBEOF

# Build
npx electron-builder build --win --x64 --config /tmp/eb-config.json --publish never 2>&1 | tail -20

echo "Done"
ls -lh release/
