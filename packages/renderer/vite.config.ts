import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Plugin: remove crossorigin from script tags (not needed for Electron file:// protocol,
// and can cause issues with asar-packed apps)
function removeCrossorigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    enforce: 'post',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin(?:="[^"]*")?/g, '');
    },
  };
}

export default defineConfig({
  plugins: [react(), removeCrossorigin()],
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    modulePreload: false,
    target: 'esnext',
    minify: 'esbuild',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/monaco-editor')) {
            return 'vendor-editor';
          }
          if (id.includes('node_modules/xterm')) {
            return 'vendor-terminal';
          }
          if (id.includes('node_modules/allotment') || id.includes('node_modules/clsx')) {
            return 'vendor-ui';
          }
          if (id.includes('node_modules/zustand')) {
            return 'vendor-state';
          }
          if (id.includes('node_modules/zod')) {
            return 'vendor-utils';
          }
          return null;
        },
      },
    },
  },
  server: {
    port: 5173,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'zod',
      'clsx',
    ],
    exclude: ['monaco-editor'],
  },
});
