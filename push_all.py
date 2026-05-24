import subprocess, os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir('D:/lingjing/lingjing')

# Push to GitHub (origin)
print('=== Push to GitHub (origin) ===')
r = subprocess.run(['git', 'push', 'origin', 'main'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
print('stdout:', r.stdout[:500] if r.stdout else '')
print('stderr:', r.stderr[:500] if r.stderr else '')
print('returncode:', r.returncode)
