import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Check what needs pushing
r = subprocess.run(['git', 'fetch', 'origin'], capture_output=True, text=True)
print('fetch origin stderr:', r.stderr.strip())

r = subprocess.run(['git', 'log', 'origin/main..HEAD', '--oneline'], capture_output=True, text=True)
print(f'\nCommits to push to origin (ssh://120.55.5.220):')
print(r.stdout.strip() if r.stdout.strip() else '   Nothing to push')

r = subprocess.run(['git', 'fetch', 'github'], capture_output=True, text=True)
print(f'\nfetch github stderr:', r.stderr.strip())

r = subprocess.run(['git', 'log', 'github/main..HEAD', '--oneline'], capture_output=True, text=True)
print(f'\nCommits to push to github:')
print(r.stdout.strip() if r.stdout.strip() else '   Nothing to push')
