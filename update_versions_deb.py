import json
with open("/opt/lingjing/update-server/data/versions.json", "r") as f:
    d = json.load(f)
for v in d["versions"]:
    if v["version"] == "1.60.1":
        v["sha512"] = "edc6628b7c25eab2cfd6436ff7f5ab9e28ace55d9b3f5df1557966a3e7d779d1357390d1d000c4c332d8eb6c8dcd4c8d0ee0b7db8ff692f5461395c35790b9fa"
        v["size"] = 183516856
        # Ensure linux-deb entry exists
        if "linux-deb" not in v["files"]:
            v["files"]["linux-deb"] = "https://ide.zhejiangjinmo.com/downloads/LingJing-1.60.1-linux-x86_64.deb"
with open("/opt/lingjing/update-server/data/versions.json", "w") as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
print("Updated")
