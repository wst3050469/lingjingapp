import json, re

# Update app.json
with open('/home/liuhui/lingjing-mobile/app.json') as f:
    app = json.load(f)
app['expo']['version'] = '1.72.33'
app['version'] = '1.72.33'
with open('/home/liuhui/lingjing-mobile/app.json', 'w') as f:
    json.dump(app, f, indent=2)
print('app.json updated')

# Update android build.gradle
with open('/home/liuhui/lingjing-mobile/android/app/build.gradle') as f:
    gradle = f.read()
gradle = re.sub(r'versionCode \d+', 'versionCode 66', gradle)
gradle = re.sub(r'versionName "[^"]*"', 'versionName "1.72.33"', gradle)
with open('/home/liuhui/lingjing-mobile/android/app/build.gradle', 'w') as f:
    f.write(gradle)
print('build.gradle updated')
