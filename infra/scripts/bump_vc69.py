import re

with open('/home/liuhui/lingjing-mobile/android/app/build.gradle') as f:
    content = f.read()

content = re.sub(r'versionCode\s+\d+', 'versionCode 69', content)
content = re.sub(r'versionName\s+["\u201c\u201d]?[^"\n]*["\u201c\u201d]?', 'versionName "1.73.34"', content)

with open('/home/liuhui/lingjing-mobile/android/app/build.gradle', 'w') as f:
    f.write(content)
print('Updated to versionCode 69, versionName 1.73.34')
