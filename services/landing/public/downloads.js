/**
 * 灵境 LingJing - 下载中心页面脚本
 * 从 versions.json 动态加载版本信息和下载链接
 * 独立为外部JS文件以遵循CSP策略 (script-src 'self')
 */
(async function(){
  try {
    const resp = await fetch('/versions.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const latestVer = data.latest;
    const verEntry = data.versions.find(v => v.version === latestVer);
    if (!verEntry) throw new Error('version entry not found: ' + latestVer);

    document.getElementById('versionBadge').textContent = 'v' + latestVer;

    const files = verEntry.files || {};
    const platforms = verEntry.platforms || {};
    const secs = [];

    // Helper: get raw URL from files entry (handles both string and object format)
    function getUrl(key) {
      const f = files[key];
      if (!f) return null;
      return typeof f === 'string' ? f : (f.url || f.name || null);
    }
    // Helper: extract filename from URL for display
    function getFileName(url) {
      if (!url) return '';
      // If it's already just a filename (no http), return as-is
      if (!/^https?:\/\//.test(url)) return url;
      // Extract last segment after final /
      const parts = url.split('/');
      return parts[parts.length - 1] || url;
    }
    // Helper: get href for download (if full URL, use as-is; otherwise prepend /)
    function getHref(url) {
      if (!url) return '#';
      if (/^https?:\/\//.test(url)) return url;
      return '/' + url;
    }
    // Helper: get size from platforms or files
    function getSize(key) {
      if (platforms[key] && platforms[key].size) return platforms[key].size;
      const f = files[key];
      if (typeof f === 'object' && f.size) return f.size;
      return 0;
    }

    // Windows section
    const winItems = [];
    const winUrl = getUrl('win-x64');
    if (winUrl) {
      winItems.push({
        name: winUrl,
        label: '安装程序',
        size: getSize('win-x64')
      });
    }
    const winPortableUrl = getUrl('win-x64-portable');
    if (winPortableUrl) {
      winItems.push({
        name: winPortableUrl,
        label: '便携版 (免安装)',
        size: getSize('win-x64-portable')
      });
    } else if (winUrl) {
      winItems.push({
        name: 'LingJing-Portable-' + latestVer + '-win-x64.exe',
        label: '便携版 (免安装)',
        size: 0
      });
    }
    if (winItems.length) {
      secs.push({ title: '🖥️ Windows', items: winItems });
    }

    // Linux section
    const linuxItems = [];
    const linuxUrl = getUrl('linux-x64');
    if (linuxUrl) {
      linuxItems.push({
        name: linuxUrl,
        label: '通用 Linux 包 (AppImage)',
        size: getSize('linux-x64')
      });
    }
    const debUrl = getUrl('linux-x64-deb') || getUrl('linux-deb');
    if (debUrl) {
      linuxItems.push({
        name: debUrl,
        label: 'Debian/Ubuntu 安装包',
        size: getSize('linux-x64-deb') || getSize('linux-deb')
      });
    }
    if (linuxItems.length) {
      secs.push({ title: '🐧 Linux', items: linuxItems });
    }

    // Android section - only show if we have a real APK URL (no fallback to broken URL)
    const androidItems = [];
    const apkUrl = getUrl('android') || getUrl('android-x64');
    if (apkUrl) {
      androidItems.push({
        name: apkUrl,
        label: 'Android APK',
        size: getSize('android') || getSize('android-x64')
      });
    }
    // NOTE: No fallback - if no android entry in versions.json, simply hide the section
    if (androidItems.length) {
      secs.push({ title: '📱 移动端 (Android)', items: androidItems });
    }

    // Render sections
    let html = '';
    secs.forEach(s => {
      html += '<div class=sec><div class=sec-title>' + s.title + '</div>';
      s.items.forEach(f => {
        const sizeStr = f.size > 0 ? '(' + (f.size / 1024 / 1024).toFixed(0) + ' MB)' : '';
        const displayName = getFileName(f.name);
        const href = getHref(f.name);
        html += '<div class=li><div><div class=ft>' + displayName + '</div><div class=fs>' + f.label + ' ' + sizeStr + '</div></div><a href=' + href + ' class=btn>⬇ 下载</a></div>';
      });
      html += '</div>';
    });

    document.getElementById('content').innerHTML = html;
  } catch(e) {
    console.warn('[Downloads] Failed to load versions.json, using fallback:', e.message);
    document.getElementById('versionBadge').textContent = 'v1.72.11';
    document.getElementById('content').innerHTML = [
      '<div class=sec><div class=sec-title>🖥️ Windows</div>',
      '<div class=li><div><div class=ft>LingJing-Setup-1.72.11-win-x64.exe</div><div class=fs>安装程序 (140 MB)</div></div><a href=/LingJing-Setup-1.72.11-win-x64.exe class=btn>⬇ 下载</a></div>',
      '<div class=li><div><div class=ft>LingJing-Portable-1.72.11-win-x64.exe</div><div class=fs>便携版 (139 MB)</div></div><a href=/LingJing-Portable-1.72.11-win-x64.exe class=btn>⬇ 下载</a></div>',
      '</div>',
      '<div class=sec><div class=sec-title>🐧 Linux</div>',
      '<div class=li><div><div class=ft>LingJing-1.72.11-linux-x86_64.AppImage</div><div class=fs>通用 Linux 包 (173 MB)</div></div><a href=/LingJing-1.72.11-linux-x86_64.AppImage class=btn>⬇ 下载</a></div>',
      '<div class=li><div><div class=ft>LingJing-1.72.11-linux-x86_64.deb</div><div class=fs>Debian/Ubuntu 安装包 (105 MB)</div></div><a href=/LingJing-1.72.11-linux-x86_64.deb class=btn>⬇ 下载</a></div>',
      '</div>',
      '<div class=sec><div class=sec-title>📱 移动端 (Android)</div>',
      '<div class=li><div><div class=ft>lingjing-1.72.11-android.apk</div><div class=fs>Android 应用 (31 MB)</div></div><a href=/lingjing-1.72.11-android.apk class=btn>⬇ 下载</a></div>',
      '</div>'
    ].join('');
  }
})();
