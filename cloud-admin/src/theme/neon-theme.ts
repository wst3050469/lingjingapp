import { theme } from 'ant-design-vue';

export const neonTheme = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#00f5ff',
    colorInfo: '#00f5ff',
    colorSuccess: '#00ff88',
    colorWarning: '#ff8800',
    colorError: '#ff4d4f',
    colorBgContainer: '#0f0f1a',
    colorBgLayout: '#0a0a0f',
    colorBgElevated: '#161625',
    colorBorder: '#2a2a42',
    colorBorderSecondary: '#1e1e32',
    colorText: '#e0e0e8',
    colorTextSecondary: '#9e9eb0',
    colorTextTertiary: '#484f58',
    borderRadius: 8,
    borderRadiusLG: 12,
    fontSize: 14,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  components: {
    Menu: { itemBg: 'transparent', itemSelectedBg: 'rgba(0, 245, 255, 0.1)', itemHoverBg: 'rgba(0, 245, 255, 0.05)' },
    Table: { headerBg: '#161625', rowHoverBg: 'rgba(0, 245, 255, 0.03)' },
    Card: { colorBgContainer: '#0f0f1a' },
    Button: { primaryShadow: '0 0 20px rgba(0, 245, 255, 0.3)' },
    Input: { colorBgContainer: '#161625' },
    Select: { colorBgContainer: '#161625' },
    Modal: { contentBg: '#0f0f1a' },
    Drawer: { colorBgElevated: '#0f0f1a' },
  },
};

export type NeonThemeConfig = typeof neonTheme;