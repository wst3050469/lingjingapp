/**
 * 移动端在线升级检查组件
 * 启动时拉取 /api/latest，对比版本号，提示用户下载新版本
 */
import { useEffect, useRef } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import Constants from 'expo-constants';

function isNewer(a: string, b: string): boolean {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

const LATEST_URL = 'https://ide.zhejiangjinmo.com/api/latest';

export default function UpdateChecker() {
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const currentVersion = Constants.expoConfig?.version || '0.0.0';

    fetch(LATEST_URL)
      .then(res => res.json())
      .then((data: any) => {
        const latestVer = data.version;
        if (!latestVer) return;
        if (!isNewer(latestVer, currentVersion)) return;

        // Get APK download URL
        let downloadUrl: string | null = null;
        if (typeof data.files?.android === 'string') {
          downloadUrl = data.files.android;
        } else if (data.files?.android?.url) {
          downloadUrl = `https://ide.zhejiangjinmo.com/downloads/${data.files.android.url}`;
        }

        const sizeStr = data.platforms?.android?.size
          ? ` (${Math.round(data.platforms.android.size / 1048576)}MB)`
          : '';
        const notes = data.releaseNotes || `最新版本: ${latestVer}`;

        Alert.alert(
          '🔔 发现新版本',
          `当前: ${currentVersion} → 最新: ${latestVer}${sizeStr}\n\n${notes}`,
          [
            { text: '稍后再说', style: 'cancel' },
            {
              text: '立即更新',
              onPress: () => {
                const url = downloadUrl || `https://ide.zhejiangjinmo.com/downloads/lingjing-v${latestVer}.apk`;
                Linking.openURL(url).catch(() => {
                  Linking.openURL('https://ide.zhejiangjinmo.com/downloads/').catch(() => {});
                });
              },
            },
          ],
          { cancelable: true }
        );
      })
      .catch(() => {
        // 网络错误静默跳过
      });
  }, []);

  return null;
}
