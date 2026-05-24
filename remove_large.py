import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Remove large files from tracking but keep on disk
for pattern in ['packages/release/', 'lingjing-mobile-*.apk', '*.apk']:
    r = subprocess.run(['git', 'rm', '-r', '--cached', pattern], capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(f'git rm --cached {pattern}: returncode={r.returncode}, out={r.stdout[:200]}, err={r.stderr[:200]}')

# Add patterns to .gitignore
with open('.gitignore', 'a') as f:
    f.write('\n# Build artifacts - too large for GitHub\npackages/release/\n*.apk\n')

# Commit the removal
r = subprocess.run(['git', 'add', '.gitignore'], capture_output=True, text=True, encoding='utf-8', errors='replace')
r2 = subprocess.run(['git', 'status', '--short'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print('\nRemaining changes:')
print(r2.stdout[:500])
