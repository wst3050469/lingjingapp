#!/bin/bash
set -e
ssh -i ~/.ssh/lingjing_prod -o StrictHostKeyChecking=no root@120.55.5.220 "restricted-deploy.sh pm2 restart cloud-server" 2>&1 || true
echo "RESTART_ATTEMPT_COMPLETE"
