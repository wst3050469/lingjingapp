const builder = require('electron-builder');
const buildOptions = {
  linux: ['AppImage', 'deb'],
  config: {
    appId: 'com.lingjing.ide',
    productName: '灵境',
    directories: { output: '../release' },
    files: ['dist/**/*', 'renderer/**/*', 'node_modules/**/*', 'package.json'],
    linux: {
      target: [
        { target: 'AppImage', arch: ['x64'] },
        { target: 'deb', arch: ['x64'] }
      ],
      icon: 'assets',
      category: 'Development',
      executableName: 'lingjing',
      artifactName: 'LingJing-${version}-linux-x86_64.${ext}'
    },
    extraResources: [],
    publish: { provider: 'generic', url: 'https://ide.zhejiangjinmo.com/downloads/' }
  }
};
console.log('Starting Linux cross-build...');
builder.build(buildOptions)
  .then(r => { console.log('SUCCESS:', JSON.stringify(r)); process.exit(0); })
  .catch(e => { console.error('ERROR:', e.message); process.exit(1); });
