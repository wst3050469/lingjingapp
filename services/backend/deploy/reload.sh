#!/bin/bash
set -e

# Delete existing processes
pm2 delete cloud-server 2>/dev/null || true
pm2 delete update-server 2>/dev/null || true

# Wait for cleanup
sleep 2

# Start from ecosystem config
pm2 start /root/cloud-server/deploy/ecosystem.config.json

# Save PM2 process list
pm2 save

# Verify
pm2 list
