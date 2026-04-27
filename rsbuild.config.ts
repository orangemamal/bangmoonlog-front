import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';

export default defineConfig({
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'https://bangmoonlog.vercel.app',
        changeOrigin: true,
      },
    },
  },
  plugins: [pluginReact(), pluginSass()],
  html: {
    template: './index.html',
  },
  source: {
    entry: {
      index: './src/index.tsx',
    },
    define: {
      'process.env': JSON.stringify(process.env),
    },
  },
});
