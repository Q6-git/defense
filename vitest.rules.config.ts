import { defineConfig } from 'vitest/config';

// Firestore 보안 규칙 테스트 전용 (npm run test:rules 가 에뮬레이터를 띄운 뒤 실행)
export default defineConfig({
  test: { include: ['tests/rules/**/*.test.ts'], testTimeout: 20000 },
});
