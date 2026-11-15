// Firestore 보안 규칙 테스트. 에뮬레이터 안에서 돈다: npm run test:rules
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, serverTimestamp, setDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
// 규칙 파일을 글자 그대로 읽는다 (vite ?raw)
import rules from '../../firestore.rules?raw';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-defense',
    firestore: { rules, host: '127.0.0.1', port: 8080 },
  });
});
afterAll(() => env.cleanup());
beforeEach(() => env.clearFirestore());

const entry = (uid: string, extra: Record<string, unknown> = {}) => ({
  uid, name: '민준', wave: 30, kills: 500, map: 'kitchen', difficulty: 'normal', units: ['toaster', 'fan'], at: serverTimestamp(), ...extra,
});
const db = (uid: string | null) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();
const ref = (uid: string | null, id: string) => doc(db(uid), 'rankings', id);

describe('온라인 랭킹 보안 규칙', () => {
  it('누구나 읽을 수 있다', async () => {
    await env.withSecurityRulesDisabled((c) => setDoc(doc(c.firestore(), 'rankings', 'a_normal'), { ...entry('a'), at: Timestamp.now() }));
    await assertSucceeds(getDoc(ref(null, 'a_normal')));
  });

  it('로그인한 사용자는 자기 문서(<uid>_<난이도>)에만 쓴다', async () => {
    await assertSucceeds(setDoc(ref('a', 'a_normal'), entry('a')));
    await assertFails(setDoc(ref(null, 'x_normal'), entry('x')));
    await assertFails(setDoc(ref('a', 'b_normal'), entry('b')));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('b')));
    await assertFails(setDoc(ref('a', 'a_hard'), entry('a')));
  });

  it('값이 이상하면 거절', async () => {
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { name: '' })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { name: '아주아주긴이름입니다' })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { wave: 0 })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { wave: 999999 })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { wave: 30.5 })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { kills: 30 * 150 + 1 })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { map: 'moon' })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { units: ['a', 'b', 'c', 'd'] })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { at: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { admin: true })));
  });

  it('더 좋은 기록일 때만 덮어쓴다', async () => {
    await assertSucceeds(setDoc(ref('a', 'a_normal'), entry('a')));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { wave: 29, kills: 4000 })));
    await assertFails(setDoc(ref('a', 'a_normal'), entry('a', { wave: 30, kills: 500 })));
    await assertSucceeds(setDoc(ref('a', 'a_normal'), entry('a', { wave: 30, kills: 501 })));
    await assertSucceeds(setDoc(ref('a', 'a_normal'), entry('a', { wave: 31, kills: 0 })));
  });

  it('이름만 바꾸는 것은 허용, 다른 값은 같이 못 바꾼다', async () => {
    await assertSucceeds(setDoc(ref('a', 'a_normal'), entry('a')));
    await assertSucceeds(updateDoc(ref('a', 'a_normal'), { name: '새이름', at: serverTimestamp() }));
    await assertFails(updateDoc(ref('a', 'a_normal'), { name: '또', map: 'living', at: serverTimestamp() }));
    await assertFails(updateDoc(ref('b', 'a_normal'), { name: '남의것', at: serverTimestamp() }));
    // 같은 이름으로 시각만 새로 고치는 것은 안 된다
    await assertFails(updateDoc(ref('a', 'a_normal'), { name: '새이름', at: serverTimestamp() }));
  });

  it('지울 수 없다', async () => {
    await assertSucceeds(setDoc(ref('a', 'a_normal'), entry('a')));
    await assertFails(deleteDoc(ref('a', 'a_normal')));
  });
});
