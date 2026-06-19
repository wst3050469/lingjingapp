cd /home/liuhui/lingjingapp
echo "=== packages/electron/node_modules? ==="
ls packages/electron/node_modules/.package-lock.json 2>/dev/null && echo "EXISTS" || echo "NOT FOUND"
echo ""
echo "=== esbuild available? ==="
npx esbuild --version 2>/dev/null || echo "esbuild NOT FOUND"
echo ""
echo "=== electron-builder available? ==="
npx electron-builder --version 2>/dev/null || echo "electron-builder NOT FOUND"
echo ""
echo "=== git: dist tracked? ==="
git ls-files packages/electron/dist/ | head -5
echo ""
echo "=== full build-main.mjs line count ==="
wc -l packages/electron/scripts/build-main.mjs
echo ""
echo "=== build-main.mjs last 30 lines ==="
tail -30 packages/electron/scripts/build-main.mjs