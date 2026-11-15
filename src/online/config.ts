// Firebase 설정. 빌드할 때 환경 변수 VITE_FIREBASE_CONFIG(웹 앱 설정 JSON)로 넣는다.
// 웹 앱 설정(apiKey 등)은 비밀이 아니다 — 누구나 볼 수 있고, 실제 보호는 firestore.rules가 한다.
// 값이 없으면 온라인 랭킹을 숨기고 이 기기 랭킹만 쓴다.
export interface FirebaseWebConfig {
  apiKey: string;
  authDomain?: string;
  projectId: string;
  appId: string;
  [key: string]: string | undefined;
}

export function parseConfig(raw: string | undefined): FirebaseWebConfig | null {
  if (!raw || !raw.trim()) return null;
  try {
    // 콘솔에서 복사한 'const firebaseConfig = { apiKey: "..." }' 모양도 받아 준다
    const body = raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')
      .replace(/,\s*}/g, '}');
    const c = JSON.parse(body) as FirebaseWebConfig;
    return c.apiKey && c.projectId && c.appId ? c : null;
  } catch {
    return null;
  }
}

export const FIREBASE_CONFIG = parseConfig(import.meta.env.VITE_FIREBASE_CONFIG as string | undefined);

/** 개발용: 로컬 에뮬레이터(npm run emulators)에 붙는다 */
export const USE_EMULATOR = import.meta.env.VITE_FIREBASE_EMULATOR === '1';
