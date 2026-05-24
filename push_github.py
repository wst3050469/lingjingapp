import subprocess, os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir('D:/lingjing/lingjing')

# Push to GitHub
print('=== Pushing to GitHub ===')
r = subprocess.run(['git', 'push', 'github', 'main'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
print('stdout:', r.stdout)
print('stderr:', r.stderr)
print('returncode:', r.returncode)
