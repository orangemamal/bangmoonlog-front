import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginSass } from '@rsbuild/plugin-sass';

export default defineConfig({
  server: {
    host: '0.0.0.0', // 공유기 내 모든 IP 접속을 허용합니다 (또는 '192.168.0.100' 직접 입력)
  },
  plugins: [pluginReact(), pluginSass()],
  html: {
    template: './index.html',
  },
  source: {
    entry: {
      index: './src/index.tsx',
    },
  },
});
