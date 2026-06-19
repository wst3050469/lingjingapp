#!/bin/bash
nohup bash /tmp/b.sh > /tmp/blog.log 2>&1 &
echo "PID=$!"
