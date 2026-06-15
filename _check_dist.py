import os

backup = '/home/liuhui/lingjing/desktop/electron/dist/__codepilot_dist__'
core_dist = '/home/liuhui/lingjing/desktop/core/dist'

print('=== __codepilot_dist__ (asar backup) ===')
if os.path.exists(backup):
    items = os.listdir(backup)
    print(f'  Files: {len(items)}')
    for f in items[:5]:
        print(f'    {f}')
    # Check index.js
    idx = os.path.join(backup, 'index.js')
    if os.path.exists(idx):
        with open(idx) as f:
            content = f.read()
            has_loadPrompts = 'loadPrompts' in content
            print(f'  index.js: {len(content)} chars, has loadPrompts: {has_loadPrompts}')
    else:
        print(f'  index.js: NOT FOUND')
else:
    print(f'  DIRECTORY NOT FOUND')

print()
print('=== core/dist (source) ===')
if os.path.exists(core_dist):
    items = os.listdir(core_dist)
    print(f'  Files: {len(items)}')
    idx = os.path.join(core_dist, 'index.js')
    if os.path.exists(idx):
        with open(idx) as f:
            content = f.read()
            has_loadPrompts = 'loadPrompts' in content
            print(f'  index.js: {len(content)} chars, has loadPrompts: {has_loadPrompts}')
else:
    print(f'  DIRECTORY NOT FOUND')

# Check main.js for safe-require
print()
main_js = '/home/liuhui/lingjing/desktop/electron/dist/main.js'
print('=== dist/main.js ===')
if os.path.exists(main_js):
    with open(main_js) as f:
        content = f.read()
    print(f'  Size: {len(content)} chars')
    has_safe = '__safeRequireCodepilot' in content
    has_repair = '__repairCodepilot' in content
    has_backup = '__codepilot_dist__' in content
    print(f'  Has __safeRequireCodepilot: {has_safe}')
    print(f'  Has __repairCodepilot: {has_repair}')
    print(f'  Has __codepilot_dist__: {has_backup}')
else:
    print(f'  NOT FOUND')
