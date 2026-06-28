/**
 * react-native.config.js
 * 
 * Provides Android project configuration for React Native CLI autolinking.
 * This is needed because Expo SDK 55 mocks @react-native-community/cli-platform-android,
 * preventing the CLI from auto-detecting the Android project.
 */
module.exports = {
  project: {
    android: {
      packageName: 'com.zhejiangjinmo.lingjing.mobile',
    },
  },
};
