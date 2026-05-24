import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Check tracked release files
r = subprocess.run(['git', 'ls-files', 'packages/release/'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print('Tracked files in packages/release/:')
print(r.stdout if r.stdout.strip() else '(empty)')

# Check the HEAD commit for large files
print('\nLarge files in HEAD:')
r2 = subprocess.run(['git', 'ls-tree', '-r', 'HEAD', '--name-only'], capture_output=True, text=True, encoding='utf-8', errors='replace')
for f in r2.stdout.split('\n'):
    if f:
        r3 = subprocess.run(['git', 'cat-file', '-s', f'HEAD:{f}'], capture_output=True, text=True, encoding='utf-8', errors='replace')
        try:
            size = int(r3.stdout.strip())
            if size > 5_000_000:  # > 5MB
                print(f'  {f}: {size/1024/1024:.1f} MB')
        except:
            pass
