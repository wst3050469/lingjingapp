import json

with open('/home/liuhui/lingjing/packages/electron/package.json') as f:
    pkg = json.load(f)
print(f"Current version: {pkg['version']}")

# Update to 1.72.33
pkg['version'] = '1.72.33'
with open('/home/liuhui/lingjing/packages/electron/package.json', 'w') as f:
    json.dump(pkg, f, indent=2)
print('Updated to 1.72.33')
