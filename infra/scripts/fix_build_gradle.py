import re

with open('/home/liuhui/lingjing-mobile/android/app/build.gradle') as f:
    content = f.read()

# Find version info
ver_code = re.search(r'versionCode\s+(\d+)', content)
ver_name = re.search(r'versionName\s+"([^"]+)"', content)
print(f'Current versionCode: {ver_code.group(1) if ver_code else "NOT FOUND"}')
print(f'Current versionName: {ver_name.group(1) if ver_name else "NOT FOUND"}')

# Update to 1.73.0
content = re.sub(r'versionCode\s+\d+', 'versionCode 67', content)
content = re.sub(r'versionName\s+"[^"]*"', 'versionName "1.73.0"', content)

with open('/home/liuhui/lingjing-mobile/android/app/build.gradle', 'w') as f:
    f.write(content)

print('Updated to versionCode 67, versionName 1.73.0')
