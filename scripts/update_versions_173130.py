import json

with open('/var/www/downloads/versions.json') as f:
    data = json.load(f)

v130 = {
    'version': '1.73.130',
    'status': 'published',
    'releaseDate': '2026-06-20',
    'releaseNotes': 'v1.73.130: RemoteFolderPicker upload/download + proper Windows build',
    'files': {
        'win-x64_setup': {
            'url': '/downloads/v1.73.130/LingJing-Setup-1.73.130-win-x64.exe',
            'size': 143111458,
            'sha512': 'dd315f42a8a03b3b4736b8c959331f0d0edc0c07e6f59f5af980a469d676fda4e2317f8a3949dc94cd1cb328bea80955e639807f21ac77571bac6a311fd7fd33'
        },
        'win-x64_portable': {
            'url': '/downloads/v1.73.130/LingJing-Portable-1.73.130-win-x64.exe',
            'size': 142769911,
            'sha512': '81219f3005e3b3f42196c57fe59bc2b83d10d842ce05e2597475e66939f9da29e45daf1a0b0254db4c586f3a939606de4d97db0c3d2368fb5c26795bd7312e04'
        },
        'win-x64_blockmap': {
            'url': '/downloads/v1.73.130/LingJing-Setup-1.73.130-win-x64.exe.blockmap',
            'size': 150247,
            'sha512': '6ac05f7ca9cbd610b8fd36821d29f47aa1329eb4b6885a06b896477b4fc2908d253596ba2320cf7e785fa611f7c05606dea454336485db1f0a720b1e7e11b8b9'
        },
        'linux-x64_appimage': {
            'url': '/downloads/v1.73.130/LingJing-1.73.130-linux-x86_64.AppImage',
            'size': 179979370,
            'sha512': '349e828477b2e63feb473c2fb8ccc79036dd67db943f6e00fd9dd81709edae35f4cee8bcea39328915921c00ab1cc5856f2bb05c6ae743ac1f83445d074454ec'
        },
        'linux-x64_deb': {
            'url': '/downloads/v1.73.130/LingJing-1.73.130-linux-x86_64.deb',
            'size': 108617536,
            'sha512': '0770d028e162206526228ad339b6903d3712a9b10e8b5189756eec19e1fd52a41efca5111a1ed91f2ba531f4a62e38c1aa165d47337a6dc0cdde47adc1cd08f6'
        }
    }
}

data['versions'] = [v for v in data.get('versions', []) if v['version'] != '1.73.130']
data['versions'].insert(0, v130)
data['latest'] = '1.73.130'

with open('/var/www/downloads/versions.json', 'w') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
print('versions.json updated - latest: 1.73.130')
