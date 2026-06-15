import os, json

release = '/home/liuhui/lingjing/desktop/electron/release-v17379'
win_unpacked = os.path.join(release, 'win-unpacked')
resources = os.path.join(win_unpacked, 'resources')

print("=== Win Unpacked ===")
print(f"Exists: {os.path.exists(win_unpacked)}")
if os.path.exists(win_unpacked):
    items = os.listdir(win_unpacked)
    print(f"Items: {items}")

print()
print("=== Resources ===")
print(f"Exists: {os.path.exists(resources)}")
if os.path.exists(resources):
    items = os.listdir(resources)
    print(f"Items: {items}")

print()
print("=== app.asar.unpacked ===")
unpacked = os.path.join(resources, 'app.asar.unpacked')
print(f"Exists: {os.path.exists(unpacked)}")
if os.path.exists(unpacked):
    nm = os.path.join(unpacked, 'node_modules')
    cp = os.path.join(nm, '@codepilot') if os.path.exists(nm) else None
    core = os.path.join(cp, 'core') if cp and os.path.exists(cp) else None
    dist = os.path.join(core, 'dist') if core and os.path.exists(core) else None
    print(f"  node_modules: {os.path.exists(nm)}")
    print(f"  node_modules/@codepilot: {cp and os.path.exists(cp)}")
    print(f"  node_modules/@codepilot/core: {core and os.path.exists(core)}")
    print(f"  node_modules/@codepilot/core/dist: {dist and os.path.exists(dist)}")
    if dist and os.path.exists(dist):
        files = os.listdir(dist)
        print(f"  dist files: {len(files)}")
        for f in files[:5]:
            print(f"    {f}")
        idx = os.path.join(dist, 'index.js')
        if os.path.exists(idx):
            with open(idx) as f:
                has = 'loadPrompts' in f.read()
            print(f"  index.js has loadPrompts: {has}")
    else:
        print(f"  dist: NOT FOUND!")
    
    # Also check if there's pkg
    if core and os.path.exists(core):
        pkg = os.path.join(core, 'package.json')
        print(f"  package.json: {os.path.exists(pkg)}")
        if os.path.exists(pkg):
            with open(pkg) as f:
                pkg_data = json.load(f)
            print(f"    name: {pkg_data.get('name')}")
            print(f"    main: {pkg_data.get('main')}")
            print(f"    private: {pkg_data.get('private')}")

print()
print("=== extraResources (codepilot-core-dist) ===")
extra = os.path.join(resources, 'codepilot-core-dist')
print(f"Exists: {os.path.exists(extra)}")
if os.path.exists(extra):
    files = os.listdir(extra)
    print(f"Files: {len(files)}")
    for f in files[:5]:
        print(f"  {f}")

print()
print("=== NSIS installer ===")
setup = os.path.join(release, '灵境 Setup 1.73.81.exe')
print(f"Exists: {os.path.exists(setup)}")
if os.path.exists(setup):
    sz = os.path.getsize(setup)
    print(f"Size: {sz} ({sz//1048576}MB)")
