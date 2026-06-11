#!/bin/bash
cd /home/liuhui/lingjing

echo "=== Update version to 1.72.10 in package.json ==="
sed -i 's/"version": "1.72.8"/"version": "1.72.10"/' package.json

echo "=== Update app.json version ==="
python3 -c "
import json
with open('app.json') as f:
    data = json.load(f)
data['expo']['version'] = '1.72.10'
data['expo']['versionCode'] = 56
data['version'] = '1.72.10'
with open('app.json', 'w') as f:
    json.dump(data, f, indent=2)
print('app.json updated')
"

echo "=== Verify versions ==="
grep '"version"' package.json
grep '"version"' app.json

echo ""
echo "=== Commit changes ==="
git add -A
git commit -m "release: v1.72.10 - remove --disable-gpu (fixes no-window bug on Windows/Linux)

- Removed --disable-gpu from main.ts (was blocking GPU process entirely)
- Let Electron/Chromium auto-detect GPU and fallback naturally
- Fix Linux --disable-software-rasterizer in launch script
- Dependency adjustments for build compatibility
- Bump version: 1.72.8 -> 1.72.10"

echo ""
echo "=== Git log ==="
git log --oneline -3
