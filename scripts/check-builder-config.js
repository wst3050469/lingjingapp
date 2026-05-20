const j = require('../packages/electron/electron-builder.json');
console.log('output:', JSON.stringify(j.directories?.output));
console.log('linux:', JSON.stringify(j.linux));
