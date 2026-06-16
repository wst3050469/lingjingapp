#!/bin/bash
# fix-latest-yml.sh — Post-build script to fix electron-builder latest.yml paths
# 
# Problem: electron-builder generates "latest.yml" with relative filenames
# (e.g. "path: LingJing-Setup-x.y.z.exe") but we deploy files in version 
# subdirectories (/downloads/x.y.z/). This script adds the version prefix.
#
# Also fixes files[0] mismatch: electron-builder sometimes puts Portable info
# in files[0] while path points to Setup — this aligns them.
#
# Usage: ./fix-latest-yml.sh <release-dir> <version>
# Example: ./fix-latest-yml.sh ./release-v17388 1.73.88

set -e

RELEASE_DIR="${1:-.}"
VERSION="${2:-unknown}"

if [ "$VERSION" = "unknown" ]; then
    echo "ERROR: Version argument required"
    echo "Usage: $0 <release-dir> <version>"
    exit 1
fi

LATEST_YML="$RELEASE_DIR/latest.yml"
LATEST_LINUX_YML="$RELEASE_DIR/latest-linux.yml"

fix_yml() {
    local FILE="$1"
    local PREFIX="$2"
    
    if [ ! -f "$FILE" ]; then
        echo "[fix-latest-yml] $FILE not found, skipping"
        return
    fi
    
    echo "[fix-latest-yml] Processing $FILE..."
    
    # Extract current values
    local YML_PATH=$(grep "^path:" "$FILE" | sed 's/^path: //')
    local YML_VERSION=$(grep "^version:" "$FILE" | sed 's/^version: //')
    
    echo "  Current path: $YML_PATH"
    echo "  Version: $YML_VERSION"
    
    # Check if path already has version prefix
    if echo "$YML_PATH" | grep -q "^$PREFIX/"; then
        echo "  Path already has version prefix — OK"
        return
    fi
    
    # Add version prefix to path and files[0].url
    local NEW_PATH="$PREFIX/$YML_PATH"
    echo "  New path: $NEW_PATH"
    
    # Update 'path:' line
    sed -i "s|^path: .*|path: $NEW_PATH|" "$FILE"
    
    # Update '  - url:' line (files[0])  
    local OLD_URL=$(grep "  - url:" "$FILE" | head -1 | sed 's/  - url: //')
    if [ -n "$OLD_URL" ]; then
        local NEW_URL="$PREFIX/$OLD_URL"
        # Only add prefix if not already present
        if ! echo "$OLD_URL" | grep -q "^$PREFIX/"; then
            sed -i "s|  - url: $OLD_URL|  - url: $NEW_URL|" "$FILE"
            echo "  Updated files[0].url: $OLD_URL → $NEW_URL"
        fi
    fi
    
    echo "  Fixed: $FILE"
}

fix_yml "$LATEST_YML" "$VERSION"
fix_yml "$LATEST_LINUX_YML" "$VERSION"

echo "[fix-latest-yml] Done"
