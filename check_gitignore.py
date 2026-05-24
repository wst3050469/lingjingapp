import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Check gitignore
try:
    with open('.gitignore', 'r') as f:
        content = f.read()
    print('.gitignore contains release:', 'packages/release' in content or 'release/' in content)
    print('.gitignore contains .apk:', '.apk' in content)
except:
    print('No .gitignore found')
