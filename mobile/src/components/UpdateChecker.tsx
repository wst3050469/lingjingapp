/**
 * 移动端在线升级检查组件
 * 启动时拉取 versions.json，对比版本号，提示用户下载新版本
 */
import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

interface VersionEntry {
  version: string;
  status?: string;
  files?: Record<string, string>;
  platforms?: Record<string, { size: number; sha512: string }>;
}

/**
 * 比较版本号 a > b 返回 true
 */
function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false; // equal
}

const VERSIONS_URL = 'https://ide.zhejiangjinmo.com/versions.json';
const DOWNLOAD_PAGE = 'https://ide.zhejiangjinmo.com/downloads/';

export default function UpdateChecker() {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const currentVersion = Constants.expoConfig?.version || '0.0.0';

    fetch(VERSIONS_URL)
      .then(res => res.json())
      .then((data: { latest: string; versions: VersionEntry[] }) => {
        const latest = data.latest;
        if (!latest) return;

        if (isNewer(latest, currentVersion)) {
          // 查找该版本的更新说明
          const entry = data.versions.find(v => v.version === latest);
          const notes = entry?.status === 'published'
            ? `\n\n更新: ${latest}`
            : `\n\n最新版本: ${latest}`;

          Alert.alert(
            '发现新版本',
            `当前版本 ${currentVersion}，最新版本 ${latest}${notes}\n请前往下载页面下载最新安装包`,
            [
              { text: '稍后再说', style: 'cancel' },
              {
                text: '立即更新',
                onPress: () => {
                  Linking.openURL(DOWNLOAD_PAGE).catch(() => {
                    // 如果无法打开浏览器，尝试直接下载 APK
                    const apkFile = `https://ide.zhejiangjinmo.com/downloads/LingJing-${latest}-android.apk`;
                    Linking.openURL(apkFile).catch(() => {});
                  });
                },
              },
            ],
            { cancelable: true }
          );
        }
      })
      .catch(() => {
        // 网络错误静默跳过 - 不影响 APP 正常使用
      });
  }, []);

  // 无 UI，纯逻辑组件
  return null;
}
