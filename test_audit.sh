#!/bin/bash
RESP=$(curl -s -X POST http://localhost:8000/api/admin/login -H 'Content-Type: application/json' -d '{"username":"admin","password":"admin123"}')
TOKEN=$(echo $RESP | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
echo "=== Audit Logs ==="
curl -s http://localhost:8000/api/admin/audit-logs -H "Authorization: Bearer $TOKEN" | python3 -m json.tool
echo ""
echo "=== Stats ==="
curl -s http://localhost:8000/api/admin/stats -H "Authorization: Bearer $TOKEN" | python3 -m json.tool | head -20
