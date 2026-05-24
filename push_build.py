import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Push to build server
r = subprocess.run(['git', 'push', 'build', 'main'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
print('push to build server:')
print('stdout:', r.stdout[:300] if r.stdout else '')
print('stderr:', r.stderr[:500] if r.stderr else '')
print('returncode:', r.returncode)
