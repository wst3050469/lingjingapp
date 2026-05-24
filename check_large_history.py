import subprocess, os
os.chdir('D:/lingjing/lingjing')

# Check when packages/release/ was first added
r = subprocess.run(['git', 'log', '--oneline', '--diff-filter=A', '--', 'packages/release/'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print('First addition of packages/release:')
print(r.stdout[:500] if r.stdout.strip() else '(never added, tracked from earlier)')

r = subprocess.run(['git', 'log', '--oneline', '-1', '--', 'packages/release/win-unpacked/resources/app.asar'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print('\nLast commit touching app.asar:')
print(r.stdout[:500] if r.stdout.strip() else '(not found)')

# Check when the APK was added
r = subprocess.run(['git', 'log', '--oneline', '--diff-filter=A', '--', 'lingjing-mobile-*.apk'], capture_output=True, text=True, encoding='utf-8', errors='replace')
print('\nFirst APK addition:')
print(r.stdout[:500] if r.stdout.strip() else '(not in history)')
