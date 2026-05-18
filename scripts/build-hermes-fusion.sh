# Hermes Fusion v1.42.0 Build Script (Linux Server)

set -e

echo "=== Hermes Fusion Build Pipeline ==="
echo "Checking environment..."

# Check Node.js >= 20
NODE_VER=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 20 ]; then
  echo "Node.js >= 20 required"
  exit 1
fi
echo "Node.js $(node --version) OK"

# Check pnpm
which pnpm >/dev/null 2>&1 || npm i -g pnpm
echo "pnpm OK"

cd /root/lingjing || { echo "Cloning repo..."; git clone https://github.com/wst3050469/lingjing.git /root/lingjing; cd /root/lingjing; }

# Fetch latest code
git fetch origin
git checkout main
git pull origin main

echo ""
echo "=== Step 1: Build core package ==="
cd packages/core
pnpm install
npx tsc
echo "Core build OK: $(find dist -name '*.js' | wc -l) JS files"

echo ""
echo "=== Step 2: Build Electron main process ==="
cd ../electron
pnpm install
node scripts/build-main.mjs
echo "Main process build OK"

echo ""
echo "=== Step 3: Build renderer ==="
cd ../renderer
pnpm install
npx vite build
echo "Renderer build OK"

echo ""
echo "=== Step 4: Pre-package ==="
cd ../electron
node scripts/pre-package.mjs
echo "Pre-package OK"

echo ""
echo "=== Step 5: Build Windows installer ==="
npx electron-builder build --win --x64
echo "Windows build OK"

echo ""
echo "=== Step 6: Build Linux installer ==="
npx electron-builder build --linux --x64
echo "Linux build OK"

echo ""
echo "=== Step 7: Deploy ==="
# Find output files
OUT_DIR="packages/electron/release"
ls -lh "$OUT_DIR"/*.exe "$OUT_DIR"/*.AppImage "$OUT_DIR"/*.deb 2>/dev/null || echo "Check output directory"
echo ""
echo "=== Build Complete v1.42.0 ==="
