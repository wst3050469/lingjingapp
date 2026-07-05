/**
 * 灵境AIIDE 移动端 - 共享常量定义
 * 所有服务器 URL 统一在此文件定义，避免分散在各处导致的域名不一致问题
 */

// Cloud server: 中央云账号服务 (JWT 认证)
export const CLOUD_SERVER_URL = 'https://ide.zhejiangjinmo.com';
export const CLOUD_SERVER_WS = 'wss://ide.zhejiangjinmo.com/ws';

// FRP relay: 通过云端隧道转发到桌面端 Web Server
export const FRP_RELAY_URL = 'https://wap.zhejiangjinmo.com';
export const FRP_RELAY_WS = 'wss://wap.zhejiangjinmo.com/ws';
