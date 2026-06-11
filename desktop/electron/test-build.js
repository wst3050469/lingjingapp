const builder = require('electron-builder');
const buildOptions = {
  win: ['nsis', 'portable'],
  config: {
    appId: 'com.lingjing.ide',
    productName: '灵境',
    directories: { output: '../release' },
    files: ['dist/**/*', 'renderer/**/*', 'node_modules/**/*', 'package.json'],
    win: {
      target: [
        { target: 'nsis', arch: ['x64'] },
        { target: 'portable', arch: ['x64'] }
      ],
      icon: 'assets/icon.ico'
    },
    nsis: { oneClick: false, allowToChangeInstallationDirectory: true }
  }
};
console.log('Starting build...');
builder.build(buildOptions)
  .then(r => { console.log('SUCCESS:', JSON.stringify(r)); process.exit(0); })
  .catch(e => { console.error('ERROR:', e.message, e.stack); process.exit(1); });
