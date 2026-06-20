var fs = require("fs");

// Compute SHA512 from existing files
var crypto = require("crypto");
var path = require("path");

var dir = "/var/www/downloads/v1.73.137";
var files = {
  "win-x64_setup":      "LingJing-Setup-1.73.137-win-x64.exe",
  "win-x64_portable":   "LingJing-Portable-1.73.137-win-x64.exe",
  "win-x64_blockmap":   "LingJing-Setup-1.73.137-win-x64.exe.blockmap",
  "linux-x64_appimage": "LingJing-1.73.137-linux-x86_64.AppImage",
  "linux-x64_deb":      "LingJing-1.73.137-linux-x86_64.deb"
};

var entry = {};
Object.keys(files).forEach(function(k) {
  var fpath = path.join(dir, files[k]);
  var data = fs.readFileSync(fpath);
  var hash = crypto.createHash("sha512").update(data).digest("hex");
  entry[k] = {
    url: "/downloads/v1.73.137/" + files[k],
    size: data.length,
    sha512: hash
  };
});

// Add android
entry["android"] = {
  url: "/downloads/v1.73.134/LingJing-Mobile-1.73.134.apk",
  size: 86581179,
  sha512: "036d3cf97fa7d4b1ded3d0127e13cd7d9ce8cefb5178247ab0e9790e91e2cbf6f03570a5acc4c8daaaab5ae82edffe74381f33dc3f7913d82a323a9d741fd129"
};

var paths = ["/var/www/html/versions.json", "/var/www/downloads/versions.json"];
paths.forEach(function(p) {
  var d = JSON.parse(fs.readFileSync(p, "utf8"));
  d.latest = "1.73.137";
  
  // Remove old v1.73.137 entry if exists
  d.versions = d.versions.filter(function(v) { return v.version !== "1.73.137"; });
  
  // Add new entry at top
  d.versions.unshift({
    version: "1.73.137",
    status: "published",
    releaseDate: "2026-06-20",
    releaseNotes: "v1.73.137: remove review IPC stubs - diff review feature now works + v1.73.136 changes",
    files: entry
  });
  
  fs.writeFileSync(p, JSON.stringify(d, null, 2));
  console.log("Updated: " + p);
});

// Copy yml files
["latest.yml", "latest-linux.yml"].forEach(function(f) {
  var src = "/var/www/downloads/" + f;
  ["/var/www/lingjing/", "/var/www/html/"].forEach(function(dst) {
    fs.copyFileSync(src, dst + f);
    console.log("Copied " + f + " to " + dst);
  });
});

// Copy Linux files to root
["LingJing-1.73.137-linux-x86_64.AppImage", "LingJing-1.73.137-linux-x86_64.deb",
 "LingJing-Setup-1.73.137-win-x64.exe", "LingJing-Portable-1.73.137-win-x64.exe"].forEach(function(f) {
  fs.copyFileSync(dir + "/" + f, "/var/www/downloads/" + f);
  fs.copyFileSync(dir + "/" + f, "/var/www/lingjing/" + f);
  console.log("Copied " + f + " to root dirs");
});

// Copy APK
fs.copyFileSync("/var/www/downloads/v1.73.134/LingJing-Mobile-1.73.134.apk", dir + "/LingJing-Mobile-1.73.134.apk");
console.log("Copied APK to v1.73.137 dir");

console.log("ALL DONE");
