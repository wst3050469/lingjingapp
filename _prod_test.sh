#!/bin/bash
set -e
cd /tmp
rm -rf crashtest
mkdir crashtest
cd crashtest

echo "1. Extracting production ASAR..."
npx asar extract /var/www/downloads/app-1.73.48.asar . 2>/dev/null
echo "   Done"

echo "2. Deleting executor.js..."
EXECUTOR="node_modules/@codepilot/core/dist/tools/executor.js"
if [ -f "$EXECUTOR" ]; then
    mv "$EXECUTOR" "${EXECUTOR}.gone"
    echo "   executor.js deleted"
else
    echo "   executor.js not found at $EXECUTOR"
    ls node_modules/@codepilot/core/dist/tools/ 2>/dev/null | head -5
fi

echo "3. Testing @codepilot/core load..."
node -e "
const path = require('path');
const CORE = path.join(process.cwd(), 'node_modules/@codepilot/core/dist/index.js');
try {
    const core = require(CORE);
    console.log('   PASS: module loaded');
    const a = new core.Agent({ provider: null, tools: { get: ()=>null }, systemPrompt: 't' });
    console.log('   PASS: Agent created');
} catch(e) {
    console.log('   FAIL:', e.code, e.message);
}
" 2>&1

echo "4. Restoring executor.js..."
mv "${EXECUTOR}.gone" "$EXECUTOR" 2>/dev/null
echo "   Done"

echo "5. Cleanup..."
cd /tmp
rm -rf crashtest
echo "=== ALL PASS ==="
