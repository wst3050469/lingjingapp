#!/bin/bash
# 灵境AI - 生产服务器Git仓库初始化脚本
# 在 120.55.5.220 上以 root 身份执行

set -e

echo '=== 初始化生产服务器Git bare仓库 ==='

# 1. 创建目录
mkdir -p /root/lingjing-git

# 2. 初始化 bare repo
cd /root/lingjing-git
git init --bare .git

# 3. 验证
echo ''
echo '仓库路径: /root/lingjing-git/.git'
ls -la /root/lingjing-git/.git/HEAD
echo ''
echo '✅ 完成！现在可以在本地推送:'
echo '  cd /home/liuhui/lingjingapp && git push prod main'
