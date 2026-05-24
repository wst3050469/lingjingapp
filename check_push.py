import subprocess, os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir('D:/lingjing/lingjing')

# Just check what needs pushing
r = subprocess.run(['git', 'rev-list', '--count', 'origin/main..HEAD'], capture_output=True, text=True, encoding='utf-8', errors='replace')
ahead_origin = r.stdout.strip()
print(f'origin ahead: {ahead_origin}')

r = subprocess.run(['git', 'rev-list', '--count', 'github/main..HEAD'], capture_output=True, text=True, encoding='utf-8', errors='replace')
ahead_github = r.stdout.strip() if r.stdout else 'error'
print(f'github ahead: {ahead_github}')
