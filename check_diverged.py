import subprocess, os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir('D:/lingjing/lingjing')

# Check what's on prod that we don't have
r = subprocess.run(['git', 'fetch', 'prod'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60)
print('fetch prod:', r.stderr[:300] if r.stderr else 'ok')

r = subprocess.run(['git', 'log', 'prod/main..HEAD', '--oneline'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print('\nLocal commits not on prod:')
print(r.stdout.strip() if r.stdout.strip() else '(none)')

r = subprocess.run(['git', 'log', 'HEAD..prod/main', '--oneline'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print('\nProd commits not in local:')
print(r.stdout.strip() if r.stdout.strip() else '(none)')
