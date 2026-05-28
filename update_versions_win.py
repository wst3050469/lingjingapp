import json
with open("/opt/lingjing/update-server/data/versions.json", "r") as f:
    d = json.load(f)
for v in d["versions"]:
    if v["version"] == "1.60.1":
        v["sha512"] = "875f0cff0a200b70d8a3b3f6d087afa5a23f23e8d3533a65d4e464e12d8dadced41394b89bd91a3d2ab3e130743a87927d7eaf2cad2339e5198dbe3da9c43231"
        v["size"] = 142181792
        if "win-x64-portable" not in v["files"]:
            v["files"]["win-x64-portable"] = "https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.60.1-win-x64.exe"
        if "win-x64-blockmap" not in v["files"]:
            v["files"]["win-x64-blockmap"] = "https://ide.zhejiangjinmo.com/downloads/LingJing-Setup-1.60.1-win-x64.exe.blockmap"
with open("/opt/lingjing/update-server/data/versions.json", "w") as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
print("Updated")
