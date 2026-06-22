/**
 * 在线升级检查 — 仅更高版本弹窗，App内下载安装
 */
import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, View, Text, ActivityIndicator, StyleSheet, TouchableOpacity } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as IntentLauncher from 'expo-intent-launcher';
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

const LATEST_URL = 'https://ide.zhejiangjinmo.com/downloads/version.json';

export default function UpdateChecker() {
  const checkedRef = useRef(false);
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    const currentVersion = Constants.expoConfig?.version || '0.0.0';

    fetch(LATEST_URL)
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then((data: any) => {
        const latestVer = data.version;
        if (!latestVer) return;
        // Only show when server version is strictly newer
        if (!isNewer(latestVer, currentVersion)) return;

        // version.json format: { version, apkUrl, fileSize, md5, releaseNotes, ... }
        const downloadUrl = data.apkUrl || '';
        if (!downloadUrl) return;
        const sizeMb = data.fileSize
          ? Math.round(data.fileSize / 1048576)
          : 0;
        const notes = data.releaseNotes || '';

        Alert.alert(
          '🔔 发现新版本',
          `${currentVersion} → ${latestVer}${sizeMb ? ` (${sizeMb}MB)` : ''}\n\n${notes}`,
          [
            { text: '稍后再说', style: 'cancel' },
            {
              text: '立即更新',
              onPress: () => downloadAndInstall(downloadUrl, latestVer),
            },
          ],
          { cancelable: true }
        );
      })
      .catch(() => {});

    async function downloadAndInstall(url: string, version: string) {
      try {
        setDownloading(true);
        setProgress(0);
        const fileUri = FileSystem.documentDirectory + `lingjing-v${version}.apk`;

        const downloadRes = await FileSystem.createDownloadResumable(
          url,
          fileUri,
          {},
          (progressObj) => {
            const pct = progressObj.totalBytesWritten / progressObj.totalBytesExpectedToWrite;
            setProgress(pct);
          }
        ).downloadAsync();

        if (downloadRes?.uri) {
          setDownloading(false);
          // Open APK for install
          try {
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: downloadRes.uri,
              type: 'application/vnd.android.package-archive',
              flags: 1,
            });
          } catch {
            // Fallback: use FileSystem
            Alert.alert('下载完成', `APK已保存，请手动安装: ${fileUri}`);
          }
        }
      } catch (e: any) {
        setDownloading(false);
        Alert.alert('下载失败', e.message || '请检查网络连接');
      }
    }
  }, []);

  return (
    <Modal visible={downloading} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>⬇ 正在下载更新...</Text>
          <ActivityIndicator size="large" color="#58a6ff" style={{ marginVertical: 16 }} />
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.pct}>{Math.round(progress * 100)}%</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 30 },
  card: { backgroundColor: '#161b22', borderRadius: 16, padding: 24, borderWidth: 1, borderColor: '#21262d' },
  title: { color: '#c9d1d9', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  barBg: { height: 6, backgroundColor: '#21262d', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', backgroundColor: '#238636', borderRadius: 3 },
  pct: { color: '#8b949e', fontSize: 13, textAlign: 'center', marginTop: 8 },
});
