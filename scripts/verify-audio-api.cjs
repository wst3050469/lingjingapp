/**
 * v1.73.167 Deployment Verification Script
 */
const https = require("https");

const BASE = "https://ide.zhejiangjinmo.com";
const TESTS = [
  { name: "Setup.exe", method: "HEAD", url: "/downloads/LingJing-Setup-1.73.167-win-x64.exe", minSize: 140000000 },
  { name: "Portable.exe", method: "HEAD", url: "/downloads/LingJing-Portable-1.73.167-win-x64.exe", minSize: 140000000 },
  { name: "AppImage", method: "HEAD", url: "/downloads/LingJing-1.73.167-linux-x86_64.AppImage", minSize: 180000000 },
  { name: "DEB", method: "HEAD", url: "/downloads/LingJing-1.73.167-linux-x86_64.deb", minSize: 180000000 },
  { name: "APK", method: "HEAD", url: "/downloads/LingJing-Mobile-1.73.167.apk", minSize: 80000000 },
  { name: "latest.yml (GET)", method: "GET", url: "/downloads/latest.yml", minContent: "version: 1.73.167" },
  { name: "latest-linux.yml (GET)", method: "GET", url: "/downloads/latest-linux.yml", minContent: "version: 1.73.167" },
  { name: "version.json (GET)", method: "GET", url: "/downloads/version.json", minContent: "1.73.167" },
  { name: "/api/latest (GET)", method: "GET", url: "/api/latest", minContent: "1.73.167" },
];

let pass = 0, fail = 0;

function check(test) {
  return new Promise(function (resolve) {
    var opts = { method: test.method };
    var req = https.request(BASE + test.url, opts, function (res) {
      var data = "";
      res.on("data", function (chunk) { data += chunk; });
      res.on("end", function () {
        var ok = false;
        if (test.method === "HEAD") {
          var cl = parseInt(res.headers["content-length"]) || 0;
          ok = res.statusCode === 200 && cl >= test.minSize;
          console.log((ok ? "PASS" : "FAIL") + " " + test.name + " | HTTP " + res.statusCode + " | size=" + cl);
        } else {
          ok = res.statusCode === 200 && data.indexOf(test.minContent) >= 0;
          console.log((ok ? "PASS" : "FAIL") + " " + test.name + " | HTTP " + res.statusCode + " | contains:" + test.minContent);
        }
        if (ok) pass++; else fail++;
        resolve();
      });
    });
    req.on("error", function (e) {
      fail++;
      console.log("FAIL " + test.name + " | " + e.message);
      resolve();
    });
    req.end();
  });
}

async function run() {
  console.log("=== v1.73.167 Deployment Verification ===\n");
  for (var i = 0; i < TESTS.length; i++) {
    await check(TESTS[i]);
  }
  console.log("\n=== " + pass + "/" + TESTS.length + " PASSED ===");
  process.exit(fail > 0 ? 1 : 0);
}

run();
