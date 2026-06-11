#!/bin/bash
echo "=== Cloud Server Sync Check ==="
echo "Git version: $(grep version /root/lingjing-git/cloud-server/package.json | head -1)"
echo "Prod version: $(grep version /root/cloud-server/package.json | head -1)"

echo ""
echo "=== Diff (excluding node_modules) ==="
diff -rq /root/lingjing-git/cloud-server /root/cloud-server -x node_modules -x .git 2>/dev/null | head -20
echo "---"
echo "Diff count: $(diff -rq /root/lingjing-git/cloud-server /root/cloud-server -x node_modules -x .git 2>/dev/null | wc -l)"

if diff -rq /root/lingjing-git/cloud-server /root/cloud-server -x node_modules -x .git > /dev/null 2>&1; then
  echo "STATUS: IN SYNC - no deployment needed"
else
  echo "STATUS: OUT OF SYNC - deployment may be needed"
fi
