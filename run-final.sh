#!/bin/bash
nohup node /tmp/final-update.cjs > /tmp/final-update.log 2>&1 &
echo "Script started in background"
