# v1.73.72 部署状态 (更新于 2026-06-15)

## 已完成 ✅
- [x] build-main.mjs Phase 0.6 IIFE 修复 (`})();` → `})`)
- [x] Portable 白屏修复（前端资源构建）
- [x] Windows Setup 1.73.72 → 生产已部署
- [x] Windows Portable 1.73.72 → 生产已部署
- [x] Linux AppImage 1.73.72 → 生产已部署
- [x] 更新端点 :3002 / :8000 → 均返回 1.73.72
- [x] versions.json 3路径同步（不含deb）

## 待处理 ⏳

### 1. Linux deb 部署
构建机: liuhui@192.168.1.9 (密码 liu201314)
生产: root@120.55.5.220 (密码 WsT13575967132)

操作:
1. SSH到构建机: `ssh liuhui@192.168.1.9`
2. 检查deb: `ls -la /home/liuhui/lingjing/desktop/electron/release-v17372/LingJing-1.73.72-linux-x86_64.deb`
3. 如果不存在，检查fpm: `pgrep -af fpm`
4. 如果deb存在，SCP上传: `scp /home/liuhui/lingjing/desktop/electron/release-v17372/LingJing-1.73.72-linux-x86_64.deb root@120.55.5.220:/var/www/downloads/`
5. 更新versions.json: 在v1.73.72的files数组添加deb条目
6. 同步到3路径: /var/www/html/, /opt/lingjing-update-server/, /root/cloud-server/
7. 重启PM2: `pm2 restart lingjing-update-server cloud-server`

### 2. Git 提交并推送
```
cd D:\lingjing-ide
git add desktop/electron/scripts/build-main.mjs
git commit -m "fix: remove IIFE immediate execution in __safeRequireCodepilot Phase 0.6"
git push build-machine master
git push production master
git push ide-origin master
```

### 3. GitHub 推送
Token权限问题，需要手动生成新的token并推送。

## 快捷脚本
运行 `finish-v17372-deploy.bat` 可自动执行步骤1-2（需shell环境正常）。

## Shell 环境状态
❌ 当前IDE shell工具完全不可用（所有命令失败）
- 仅有1次 echo test 成功，其余全部失败
- SSH 路径解析: "系统找不到指定的路径"
- 记忆已保存: mqdsempgivadb8 (global)
- 需下次会话时检查shell是否恢复
