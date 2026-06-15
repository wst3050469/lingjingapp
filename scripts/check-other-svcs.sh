#!/bin/bash
echo "=== UPDATE-SERVER ==="
pm2 show update-server 2>/dev/null | head -30
echo ""
echo "=== ENTERPRISE-API ==="
pm2 show enterprise-api 2>/dev/null | head -30
echo ""
echo "=== HEALTH ENDPOINTS ==="
echo -n "update-server(3003): "; curl -s http://localhost:3003/health 2>/dev/null || echo "UNREACHABLE"
echo -n "enterprise-api(8900): "; curl -s http://localhost:8900/health 2>/dev/null || echo "UNREACHABLE"
echo ""
echo "=== ENTERPRISE-API RECENT ERRORS ==="
pm2 logs enterprise-api --nostream --lines 3 --err 2>/dev/null
echo "=== DONE ==="
