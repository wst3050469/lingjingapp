#!/bin/bash
nohup bash /tmp/auto-monitor.sh > /tmp/auto-monitor-nohup.log 2>&1 &
echo "Auto-monitor PID: $!"
