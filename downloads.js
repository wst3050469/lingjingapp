/**
 * 灵境 LingJing - 下载中心页面脚本
 * 从 versions.json 动态加载版本信息和下载链接
 * 独立为外部JS文件以遵循CSP策略 (script-src 'self')
 */
(async function(){
  try {
    var resp = await fetch('/versions.json?_=' + Date.now());
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    var latestVer = data.latest;
    var verEntry = data.versions.find(function(v) { return v.version === latestVer; });
    if (!verEntry) throw new Error('version entry not found: ' + latestVer);

    document.getElementById('versionBadge').textContent = 'v' + latestVer;

    var files = verEntry.files || {};
    var platforms = verEntry.platforms || {};
    var secs = [];

    function getUrl(key) {
      var f = files[key];
      if (!f) return null;
      return typeof f === 'string' ? f : (f.url || f.name || null);
    }

    function getAnyUrl(keys) {
      for (var i = 0; i < keys.length; i++) {
        var url = getUrl(keys[i]);
        if (url) return url;
      }
      return null;
    }

    function getFileName(url) {
      if (!url) return '';
      if (!/^https?:\/\//.test(url)) return url;
      var parts = url.split('/');
      var raw = parts[parts.length - 1] || url;
      try { return decodeURIComponent(raw); } catch(e) { return raw; }
    }

    function getHref(url) {
      if (!url) return '#';
      if (/^https?:\/\//.test(url)) return url;
      if (url.charAt(0) === '/') return url;
      return '/' + url;
    }

    function getSize(keys) {
      var keyList = Array.isArray(keys) ? keys : [keys];
      for (var i = 0; i < keyList.length; i++) {
        var k = keyList[i];
        if (platforms[k] && platforms[k].size) return platforms[k].size;
        var f2 = files[k];
        if (typeof f2 === 'object' && f2.size) return f2.size;
      }
      return 0;
    }

    // Windows
    var winItems = [];
    var winSetupKeys = ['win-x64_setup', 'win-setup', 'win-x64'];
    var winUrl = getAnyUrl(winSetupKeys);
    if (winUrl) {
      winItems.push({ name: winUrl, label: '安装程序', size: getSize(winSetupKeys) });
    }
    var winPortKeys = ['win-x64_portable', 'win-x64-portable'];
    var winPortableUrl = getAnyUrl(winPortKeys);
    if (winPortableUrl) {
      winItems.push({ name: winPortableUrl, label: '便携版 (免安装)', size: getSize(winPortKeys) });
    } else if (winUrl && winItems.length === 1) {
      winItems.push({ name: 'LingJing-Portable-' + latestVer + '-win-x64.exe', label: '便携版 (免安装)', size: 0 });
    }
    if (winItems.length) secs.push({ title: '🖥️ Windows', items: winItems });

    // Linux
    var linuxItems = [];
    var linuxKeys = ['linux-x64_appimage', 'linux-x64', 'linux-x86_64'];
    var linuxUrl = getAnyUrl(linuxKeys);
    if (linuxUrl) {
      linuxItems.push({ name: linuxUrl, label: '通用 Linux 包 (AppImage)', size: getSize(linuxKeys) });
    }
    var debKeys = ['linux-x64_deb', 'linux-x64-deb', 'linux-deb'];
    var debUrl = getAnyUrl(debKeys);
    if (debUrl) {
      linuxItems.push({ name: debUrl, label: 'Debian/Ubuntu 安装包', size: getSize(debKeys) });
    }
    if (linuxItems.length) secs.push({ title: '🐧 Linux', items: linuxItems });

    // macOS
    var macX64Keys = ['mac-x64', 'mac-x64_zip'];
    var macX64Url = getAnyUrl(macX64Keys);
    var macArm64Keys = ['mac-arm64', 'mac-arm64_zip'];
    var macArm64Url = getAnyUrl(macArm64Keys);
    var macItems = [];
    if (macX64Url) macItems.push({ name: macX64Url, label: 'Intel 芯片 (x64)' });
    if (macArm64Url) macItems.push({ name: macArm64Url, label: 'Apple Silicon (M1/M2/M3)' });
    if (macItems.length) {
      macItems.push({ name: '', label: '', size: 0, isNotice: true });
      secs.push({ title: '🍎 macOS', items: macItems });
    }

    // Android
    var androidItems = [];
    var apkKeys = ['android-apk', 'android', 'android-x64'];
    var apkUrl = getAnyUrl(apkKeys);
    if (apkUrl) {
      androidItems.push({ name: apkUrl, label: 'Android APK', size: getSize(apkKeys) });
    }
    if (androidItems.length) secs.push({ title: '📱 移动端 (Android)', items: androidItems });

    // Render
    var html = '';
    secs.forEach(function(s) {
      html += '<div class=sec><div class=sec-title>' + s.title + '</div>';
      s.items.forEach(function(f) {
        if (f.isNotice) {
          html += '<div class=mac-notice><strong>⚠️ macOS 用户请注意</strong><br>由于应用未经过 Apple 公证，首次打开时可能提示"已损坏"。<br>解决方法：打开<b>终端</b>，执行以下命令后即可正常使用：<br><code>sudo xattr -rd com.apple.quarantine /Applications/灵境.app</code></div>';
          return;
        }
        var sizeStr = f.size > 0 ? '(' + (f.size / 1024 / 1024).toFixed(0) + ' MB)' : '';
        var displayName = getFileName(f.name);
        var href = getHref(f.name);
        html += '<div class=li><div><div class=ft>' + displayName + '</div><div class=fs>' + f.label + ' ' + sizeStr + '</div></div><a href="' + href + '" class=btn>⬇ 下载</a></div>';
      });
      html += '</div>';
    });

    document.getElementById('content').innerHTML = html;
  } catch(e) {
    console.warn('[Downloads] Failed to load versions.json, using fallback:', e.message);
    document.getElementById('versionBadge').textContent = 'v1.73.148';
    document.getElementById('content').innerHTML = [
      '<div class=sec><div class=sec-title>🖥️ Windows</div>',
      '<div class=li><div><div class=ft>LingJing-Setup-1.73.148-win-x64.exe</div><div class=fs>安装程序 (137 MB)</div></div><a href=/downloads/LingJing-Setup-1.73.148-win-x64.exe class=btn>⬇ 下载</a></div>',
      '<div class=li><div><div class=ft>LingJing-Portable-1.73.148-win-x64.exe</div><div class=fs>便携版 (137 MB)</div></div><a href=/downloads/LingJing-Portable-1.73.148-win-x64.exe class=btn>⬇ 下载</a></div>',
      '</div>',
      '<div class=sec><div class=sec-title>🐧 Linux</div>',
      '<div class=li><div><div class=ft>LingJing-1.73.148-linux-x86_64.AppImage</div><div class=fs>通用 Linux 包 (183 MB)</div></div><a href=/downloads/LingJing-1.73.148-linux-x86_64.AppImage class=btn>⬇ 下载</a></div>',
      '<div class=li><div><div class=ft>LingJing-1.73.148-linux-x86_64.deb</div><div class=fs>Debian/Ubuntu 安装包 (222 MB)</div></div><a href=/downloads/LingJing-1.73.148-linux-x86_64.deb class=btn>⬇ 下载</a></div>',
      '</div>',
      '<div class=sec><div class=sec-title>🍎 macOS</div>',
      '<div class=mac-notice><strong>⚠️ macOS 用户请注意</strong><br>由于应用未经过 Apple 公证，首次打开时可能提示"已损坏"。<br>解决方法：打开<b>终端</b>，执行以下命令后即可正常使用：<br><code>sudo xattr -rd com.apple.quarantine /Applications/灵境.app</code></div>',
      '</div>',
      '<div class=sec><div class=sec-title>📱 移动端 (Android)</div>',
      '<div class=li><div><div class=ft>LingJing-Mobile-1.73.148.apk</div><div class=fs>Android 应用 (36 MB)</div></div><a href=/downloads/LingJing-Mobile-1.73.148.apk class=btn>⬇ 下载</a></div>',
      '</div>'
    ].join('');
  }
})();
