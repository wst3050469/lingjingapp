#!/usr/bin/env python3
"""灵境 IDE v1.64.46 全量发布"""
import subprocess, json, hashlib, os, sys, base64
from datetime import datetime, timezone

VERSION = "1.64.46"
RELEASE_NOTES = "Docker构建修复+Win交叉编译支持: 修复docker-build.sh/docker-compose.yml拼写错误, 新增Dockerfile.win(Wine交叉编译)"

PROD_USER = 'root'
DOWNLOAD_DIR = '/var/www/downloads/'
LINGJING_DIR = '/var/www/lingjing/'

VERSIONS_PATHS = [
    '/var/www/downloads/versions.json',
    '/var/www/html/downloads/versions.json',
    '/var/www/lingjing/versions.json',
    '/root/lingjing-update/data/versions.json',
    '/var/www/update-server/data/versions.json',
    '/opt/lingjing-update/data/versions.json',
]

def run(cmd):
    print(f'  [CMD] {cmd[:150]}')
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return r

def sha512_file(filepath):
    h = hashlib.sha512()
    with open(filepath, 'rb') as f:
        for chunk in iter(lambda: f.read(8192), b''):
            h.update(chunk)
    return h.hexdigest()

def main():
    print(f'\n{"="*60}')
    print(f'  灵境 IDE v{VERSION} 全量发布')
    print(f'{"="*60}\n')

    SRC = '/root/lingjing/packages/electron/release-v1646'
    TMP_WIN = '/tmp/lingjing-win'

    files = {
        'win-x64':          f'{TMP_WIN}/LingJing-Setup-{VERSION}-win-x64.exe',
        'win-x64-portable': f'{TMP_WIN}/LingJing-Portable-{VERSION}-win-x64.exe',
        'linux-x64':        f'{SRC}/LingJing-{VERSION}-linux-x86_64.AppImage',
        'linux-deb':        f'{SRC}/LingJing-{VERSION}-linux-x86_64.deb',
    }

    # Step 1: SHA512
    print('📊 Computing SHA512...')
    file_info = {}
    for plat, fpath in files.items():
        if os.path.exists(fpath):
            sha = sha512_file(fpath)
            size = os.path.getsize(fpath)
            fname = os.path.basename(fpath)
            file_info[plat] = {'sha512': sha, 'size': size, 'filename': fname}
            print(f'  {plat}: {sha[:16]}... {size} bytes')

    if not file_info:
        print('❌ No files found!')
        sys.exit(1)

    # Step 2: Copy to web dirs
    print('\n📤 Copying to web directories...')
    for plat, info in file_info.items():
        fname = info['filename']
        src = files[plat]
        run(f'cp {src} {DOWNLOAD_DIR}{fname}')
        run(f'cp {src} {LINGJING_DIR}{fname}')
        print(f'  ✅ {fname}')

    # Step 3: Generate YAML
    print('\n📝 Generating latest.yml...')
    now_iso = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')

    if 'win-x64' in file_info:
        yml = f"""version: {VERSION}
files:
  - url: https://ide.zhejiangjinmo.com/downloads/{file_info['win-x64']['filename']}
    sha512: {file_info['win-x64']['sha512']}
    size: {file_info['win-x64']['size']}
path: {file_info['win-x64']['filename']}
sha512: {file_info['win-x64']['sha512']}
releaseDate: {now_iso}
releaseNotes: "{RELEASE_NOTES}"
"""
        with open(f'{DOWNLOAD_DIR}latest.yml', 'w') as f:
            f.write(yml)
        run(f'cp {DOWNLOAD_DIR}latest.yml {LINGJING_DIR}latest.yml')
        print('  ✅ latest.yml')

    if 'linux-x64' in file_info:
        yml = f"""version: {VERSION}
files:
  - url: https://ide.zhejiangjinmo.com/downloads/{file_info['linux-x64']['filename']}
    sha512: {file_info['linux-x64']['sha512']}
    size: {file_info['linux-x64']['size']}
path: {file_info['linux-x64']['filename']}
sha512: {file_info['linux-x64']['sha512']}
releaseDate: {now_iso}
releaseNotes: "{RELEASE_NOTES}"
"""
        with open(f'{DOWNLOAD_DIR}latest-linux.yml', 'w') as f:
            f.write(yml)
        run(f'cp {DOWNLOAD_DIR}latest-linux.yml {LINGJING_DIR}latest-linux.yml')
        print('  ✅ latest-linux.yml')

    # Step 4: versions.json
    print('\n📋 Updating versions.json...')
    r = run(f'cat {VERSIONS_PATHS[0]}')
    try:
        data = json.loads(r.stdout.strip()) if r.stdout.strip() else {'latest': VERSION, 'versions': []}
    except:
        data = {'latest': VERSION, 'versions': []}

    data['latest'] = VERSION
    new_entry = {
        'version': VERSION,
        'releaseDate': now_iso,
        'releaseNotes': RELEASE_NOTES,
        'status': 'published',
        'platforms': {},
        'files': {}
    }
    for plat, info in file_info.items():
        new_entry['platforms'][plat] = {'url': info['filename'], 'sha512': info['sha512'], 'size': info['size']}
        new_entry['files'][plat] = info['filename']

    existing = next((i for i, v in enumerate(data.get('versions', [])) if v.get('version') == VERSION), None)
    if existing is not None:
        data['versions'][existing] = new_entry
    else:
        data.setdefault('versions', []).insert(0, new_entry)

    new_json = json.dumps(data, ensure_ascii=False, indent=2)
    for vpath in VERSIONS_PATHS:
        with open(vpath, 'w') as f:
            f.write(new_json)
    print(f'  💾 {len(VERSIONS_PATHS)} paths updated')

    # Step 5: Restart PM2
    print('\n🔄 Restarting PM2 services...')
    run('pm2 restart cloud-server update-server lingjing-update-server')
    print('  ✅ Services restarted')

    # Step 6: Verify
    import time
    time.sleep(2)
    print('\n🔍 Verification...')
    r = run('curl -s http://localhost:8000/api/latest')
    print(f'  /api/latest: {r.stdout.strip()[:200]}')

    r2 = run('curl -s http://localhost:8900/')
    print(f'  /8900/: {r2.stdout.strip()[:100]}')

    print(f'\n{"="*60}')
    print(f'  ✅ v{VERSION} 全量发布完成!')
    print(f'{"="*60}\n')

if __name__ == '__main__':
    main()
