import subprocess, os, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
os.chdir('D:/lingjing/lingjing')

# Pull from prod to merge
r = subprocess.run(['git', 'pull', 'prod', 'main', '--no-edit'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=60)
print('pull stdout:', r.stdout[:500] if r.stdout else '')
print('pull stderr:', r.stderr[:500] if r.stderr else '')
print('pull returncode:', r.returncode)

if r.returncode == 0:
    # Push back
    r2 = subprocess.run(['git', 'push', 'prod', 'main'], capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=120)
    print('\npush stdout:', r2.stdout[:500] if r2.stdout else '')
    print('push stderr:', r2.stderr[:500] if r2.stderr else '')
    print('push returncode:', r2.returncode)
