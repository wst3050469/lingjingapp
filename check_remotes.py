import subprocess, os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir('D:/lingjing/lingjing')

r = subprocess.run(['git', 'remote', '-v'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print(r.stdout)
