import sys
sys.stdout.reconfigure(encoding='utf-8')
content = open(r'D:\lingjing-ide\desktop\electron\.tmp-asar-extract\dist\main.js', encoding='utf-8').read()
idx = content.find('__safeRequireCodepilot')
print('FOUND at index', idx)
print('has v6:', 'v6: stub fallback' in content)
print('has repair:', '__repairCodepilot' in content)
# Get the version from main.js
v_idx = content.find('app.getVersion()')
if v_idx > 0:
    print('getVersion snippet:', content[v_idx:v_idx+80])
# Check if __codepilot_dist__ exists in asar
import os
backup = os.path.join(r'D:\lingjing-ide\desktop\electron\.tmp-asar-extract\dist', '__codepilot_dist__')
print('__codepilot_dist__ exists:', os.path.exists(backup))
