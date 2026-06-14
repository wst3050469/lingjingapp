var fs = require('fs');
var child_process = require('child_process');
var path = require('path');

var asar = 'D:/lingjing-ide/desktop/electron/release-v17363/win-unpacked/resources/app.asar';
var unpacked = asar + '.unpacked';

console.log('=== app.asar ===');
console.log('Size:', (fs.statSync(asar).size/1024/1024).toFixed(0), 'MB');

// Extract app.asar to check what's INSIDE (not unpacked)
var tmp = 'D:/lingjing-ide/tmp-asar';
if (fs.existsSync(tmp)) fs.rmSync(tmp, {recursive: true, force: true});
child_process.execSync('npx asar extract "' + asar + '" ' + tmp, {timeout: 60000, cwd: 'D:/lingjing-ide'});

// Check if @codepilot/core is inside the asar
var coreInAsar = path.join(tmp, 'node_modules', '@codepilot', 'core');
console.log('\nInside app.asar:');
console.log('  @codepilot/core exists:', fs.existsSync(coreInAsar));

// Check unpacked
console.log('\nUnpacked (app.asar.unpacked):');
var upCore = path.join(unpacked, 'node_modules', '@codepilot', 'core');
var upJson = path.join(upCore, 'package.json');
console.log('  @codepilot/core exists:', fs.existsSync(upCore));
console.log('  package.json exists:', fs.existsSync(upJson));

if (fs.existsSync(upJson)) {
    var pkg = JSON.parse(fs.readFileSync(upJson, 'utf8'));
    console.log('  version:', pkg.version);
    console.log('  type:', pkg.type);
    console.log('  private:', pkg.private);
    console.log('  main:', pkg.main);
    
    // Check key files
    var dist = path.join(upCore, 'dist');
    ['utils/logger.js', 'memory/nudger.js', 'skills/harvester.js', 'workflow/task-complexity-analyzer.js', 'index.js'].forEach(function(f){
        var fp = path.join(dist, f);
        console.log('  ' + f + ': ' + (fs.existsSync(fp) ? 'EXISTS' : 'MISSING!'));
    });
}

// Also check electron-builder config
var eb = JSON.parse(fs.readFileSync('D:/lingjing-ide/desktop/electron/electron-builder.json','utf8'));
console.log('\n=== electron-builder.json ===');
console.log('asarUnpack:', JSON.stringify(eb.asarUnpack));

// Cleanup
fs.rmSync(tmp, {recursive: true, force: true});
