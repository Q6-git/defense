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
});
