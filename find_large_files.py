import subprocess, os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir('D:/lingjing/lingjing')

# Check which commits have these large files
r = subprocess.run(['git', 'rev-list', '--objects', '--all'], capture_output=True, text=True, encoding='utf-8', errors='replace')
lines = r.stdout.split('\n')
# Check for specific patterns
large_patterns = ['packages/release/', '.exe', '.asar', '.AppImage']
for line in lines:
    for pat in large_patterns:
        if pat in line:
            print(line)
            break
