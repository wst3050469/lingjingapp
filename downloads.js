/**
 * 灵境 LingJing - 下载中心页面脚本
 * 从 versions.json 动态加载版本信息和下载链接
 * 独立为外部JS文件以遵循CSP策略 (script-src 'self')
 */
(async function(){
  try {
    const resp = await fetch('/downloads/versions.json');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const data = await resp.json();
    const latestVer = data.latest;
    const verEntry = data.versions.find(v => v.version === latestVer);
    if (!verEntry) throw new Error('version entry not found: ' + latestVer);

    document.getElementById('versionBadge').textContent = 'v' + latestVer;

    // versions.json 使用 "platforms" 字段，兼容老版本 "files" 字段
    const platforms = verEntry.platforms || verEntry.files || {};
    const secs = [];

    // Windows section
    const winItems = [];
    if (platforms['win-x64']) {
      winItems.push({
        name: platforms['win-x64'].url,
        label: '安装程序',
        size: platforms['win-x64'].size
      });
    }
    if (platforms['win-x64-portable']) {
      winItems.push({
        name: platforms['win-x64-portable'].url,
        label: '便携版 (免安装)',
        size: platforms['win-x64-portable'].size
      });
    } else if (platforms['win-x64']) {
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
    if (platforms['linux-x64']) {
      linuxItems.push({
        name: platforms['linux-x64'].url,
        label: '通用 Linux 包 (AppImage)',
        size: platforms['linux-x64'].size
      });
    }
    if (platforms['linux-deb']) {
      linuxItems.push({
        name: platforms['linux-deb'].url,
        label: 'Debian/Ubuntu 安装包',
        size: platforms['linux-deb'].size
      });
    }
    if (linuxItems.length) {
      secs.push({ title: '🐧 Linux', items: linuxItems });
    }

    // Render sections
    let html = '';
    secs.forEach(s => {
      html += '<div class=sec><div class=sec-title>' + s.title + '</div>';
      s.items.forEach(f => {
        const sizeStr = f.size ? '(' + (f.size / 1024 / 1024).toFixed(0) + ' MB)' : '';
        const href = f.name.startsWith('/') ? f.name : '/' + f.name;
        html += '<div class=li><div><div class=ft>' + f.name + '</div><div class=fs>' + f.label + ' ' + sizeStr + '</div></div><a href=' + href + ' class=btn>⬇ 下载</a></div>';
      });
      html += '</div>';
    });

    document.getElementById('content').innerHTML = html;
  } catch(e) {
    console.warn('[Downloads] Failed to load versions.json, using fallback:', e.message);
    document.getElementById('versionBadge').textContent = 'v1.52.0';
    document.getElementById('content').innerHTML = [
      '<div class=sec><div class=sec-title>🖥️ Windows</div>',
      '<div class=li><div><div class=ft>LingJing-Setup-1.51.0-win-x64.exe</div><div class=fs>安装程序 (142 MB)</div></div><a href=/LingJing-Setup-1.51.0-win-x64.exe class=btn>⬇ 下载</a></div>',
      '<div class=li><div><div class=ft>LingJing-Portable-1.51.0-win-x64.exe</div><div class=fs>便携版 (142 MB)</div></div><a href=/LingJing-Portable-1.51.0-win-x64.exe class=btn>⬇ 下载</a></div>',
      '</div>',
      '<div class=sec><div class=sec-title>🐧 Linux</div>',
      '<div class=li><div><div class=ft>LingJing-1.51.0-linux-x86_64.AppImage</div><div class=fs>通用 Linux 包 (180 MB)</div></div><a href=/LingJing-1.51.0-linux-x86_64.AppImage class=btn>⬇ 下载</a></div>',
      '<div class=li><div><div class=ft>LingJing-1.51.0-linux-x86_64.deb</div><div class=fs>Debian/Ubuntu 安装包 (109 MB)</div></div><a href=/LingJing-1.51.0-linux-x86_64.deb class=btn>⬇ 下载</a></div>',
      '</div>'
    ].join('');
  }
})();
