const fs = require('fs');
const path = '/opt/lingjing/update-server/versions.json';

const data = JSON.parse(fs.readFileSync(path, 'utf8'));

// New version entry
const newEntry = {
    version: '1.73.36',
    status: 'published',
    releaseDate: new Date().toISOString(),
    releaseNotes: 'v1.73.36: 修复桌面端 conversation.js 缺失崩溃 — 恢复3个关键TS源文件 + .gitignore @codepilot排除修复 + Win/Linux全平台构建',
    platforms: {
        'win-x64': { size: 143760437, sha512: '8b0b11673282970da07059a95b7deecf923e5a3171f31664ef609bd01cde1be5f2fe8ef5b85e4761dc09831e69b0afd0fd0545785e500f665e759ecde429fae3' },
        'win-x64-portable': { size: 143418479, sha512: '8b0b11673282970da07059a95b7deecf923e5a3171f31664ef609bd01cde1be5f2fe8ef5b85e4761dc09831e69b0afd0fd0545785e500f665e759ecde429fae3' },
        'linux-x64': { size: 181090076, sha512: '834805adb07b0a83303341b6d1e3042c0b07c6ce065ff179f8bc4fcd3e00edea7897ff5abb2c7ef8b35c9ecbeea8f1d769230fc7b98721fb93184f9f4b5a9c5e' },
        'linux-x64-deb': { size: 109568752, sha512: 'pending' }
    },
    files: {
        'win-x64': 'https://ide.zhejiangjinmo.com/downloads/灵境 Setup 1.73.36.exe',
        'win-x64-portable': 'https://ide.zhejiangjinmo.com/downloads/LingJing-Portable-1.73.36-win-x64.exe',
        'linux-x64': 'https://ide.zhejiangjinmo.com/downloads/LingJing-1.73.36-linux-x86_64.AppImage',
        'linux-x64-deb': 'https://ide.zhejiangjinmo.com/downloads/LingJing-1.73.36-linux-x86_64.deb'
    }
};

// Update latest and prepend new version
data.latest = '1.73.36';
data.versions.unshift(newEntry);

// Also update platforms
data.platforms['win-x64'] = { version: '1.73.36', url: '/downloads/灵境 Setup 1.73.36.exe', size: 143760437 };
data.platforms['win-x64-portable'] = { version: '1.73.36', url: '/downloads/LingJing-Portable-1.73.36-win-x64.exe', size: 143418479 };

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('update-server versions.json updated: latest =', data.latest);

// Also update lingjing-update-server
const path2 = '/opt/lingjing/lingjing-update-server/versions.json';
try {
    fs.writeFileSync(path2, JSON.stringify(data, null, 2));
    console.log('lingjing-update-server versions.json updated');
} catch(e) {
    console.log('lingjing-update-server not found:', e.message);
}
