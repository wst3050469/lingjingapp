import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Commit the merge
r = subprocess.run(['git', 'commit', '--no-edit'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=30)
print('commit:', r.stdout[:300] if r.stdout else '')
print('stderr:', r.stderr[:300] if r.stderr else '')
print('returncode:', r.returncode)

if r.returncode == 0:
    # Push to prod
    r2 = subprocess.run(['git', 'push', 'prod', 'main'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
    print('\npush to prod:', r2.stdout[:300] if r2.stdout else '')
    print('stderr:', r2.stderr[:500] if r2.stderr else '')
    print('returncode:', r2.returncode)
