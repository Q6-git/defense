// 빌드 전에 온라인 랭킹 설정(VITE_FIREBASE_CONFIG)이 제대로 읽히는지 알려 준다. 값이 없어도 실패하지 않는다.
import { parseConfig } from '../src/online/config';

const raw = process.env.VITE_FIREBASE_CONFIG;
const c = parseConfig(raw);
if (!raw?.trim()) console.log('🌐 온라인 랭킹: 설정 없음 → 꺼진 채로 빌드');
else if (!c) {
  console.log('::warning::🌐 온라인 랭킹: FIREBASE_CONFIG를 읽지 못했습니다 (apiKey·projectId·appId가 있는지 확인)');
} else console.log(`🌐 온라인 랭킹: 켜짐 (프로젝트 ${c.projectId})`);
