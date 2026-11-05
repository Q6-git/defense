import { defineConfig } from 'vite';

// base는 GitHub Pages(https://<user>.github.io/<repo>/)에서도 동작하도록 상대 경로로 둔다.
export default defineConfig({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
