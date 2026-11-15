/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// base는 GitHub Pages(https://<user>.github.io/<repo>/)에서도 동작하도록 상대 경로로 둔다.
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2000,
    // 게임 엔진(Phaser)과 3D(three.js)는 따로 묶어 캐시가 오래가게 한다
    rollupOptions: { output: { manualChunks: { phaser: ['phaser'], three: ['three'] } } },
  },
  test: {
    // 보안 규칙 테스트는 Firebase 에뮬레이터가 있어야 해서 따로 돌린다 (npm run test:rules)
    exclude: ['**/node_modules/**', 'tests/rules/**'],
  },
});
