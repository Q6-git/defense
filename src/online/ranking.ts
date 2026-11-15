// 무한 모드 온라인 랭킹 (Firebase Firestore + 익명 로그인).
// Firebase 코드는 크기가 커서, 온라인 랭킹을 처음 쓸 때 따로 불러온다.
import type { DifficultyId } from '../core/types';
import { DIFFICULTY_ORDER } from '../data/difficulty';
import type { RankEntry } from '../ranking';
import { FIREBASE_CONFIG, USE_EMULATOR } from './config';

export interface OnlineEntry extends RankEntry {
  uid: string;
}

export interface SubmitResult {
  /** 이번 판이 내 온라인 최고 기록을 바꿨는지 */
  improved: boolean;
  /** 지금 내 온라인 최고 기록 */
  best: OnlineEntry;
  /** 그 기록의 온라인 순위 (1부터) */
  rank: number;
}

const COLLECTION = 'rankings';
const TIMEOUT_MS = 10000;

export function onlineEnabled(): boolean {
  return FIREBASE_CONFIG !== null;
}

type Fs = typeof import('firebase/firestore/lite');
interface Ctx {
  fs: Fs;
  db: import('firebase/firestore/lite').Firestore;
  uid: string;
}

let ctxPromise: Promise<Ctx> | null = null;

/** 처음 부를 때 Firebase를 불러오고 익명으로 로그인한다 (같은 브라우저면 같은 사용자) */
function context(): Promise<Ctx> {
  if (!FIREBASE_CONFIG) return Promise.reject(new Error('offline'));
  ctxPromise ??= (async () => {
    const [{ initializeApp }, auth, fs] = await Promise.all([import('firebase/app'), import('firebase/auth'), import('firebase/firestore/lite')]);
    const app = initializeApp(FIREBASE_CONFIG);
    const a = auth.getAuth(app);
    const db = fs.getFirestore(app);
    if (USE_EMULATOR) {
      auth.connectAuthEmulator(a, 'http://127.0.0.1:9099', { disableWarnings: true });
      fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
    }
    await a.authStateReady();
    const user = a.currentUser ?? (await auth.signInAnonymously(a)).user;
    return { fs, db, uid: user.uid };
  })();
  // 실패하면 다음에 다시 시도할 수 있게
  ctxPromise.catch(() => (ctxPromise = null));
  return ctxPromise;
}

function withTimeout<T>(p: Promise<T>): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS))]);
}

function fromDoc(d: import('firebase/firestore/lite').DocumentData): OnlineEntry {
  const at = d.at as { toMillis?: () => number } | null;
  return {
    uid: String(d.uid), name: String(d.name), wave: Number(d.wave), kills: Number(d.kills), map: String(d.map),
    difficulty: d.difficulty as DifficultyId, units: Array.isArray(d.units) ? (d.units as string[]).slice(0, 3) : [],
    at: at?.toMillis?.() ?? 0,
  };
}

const docId = (uid: string, difficulty: DifficultyId) => `${uid}_${difficulty}`;

/** 기록 (웨이브, 처치 수)의 순위: 나보다 웨이브가 높거나, 같은 웨이브에서 더 많이 잡은 사람 수 + 1 */
async function rankOf(c: Ctx, e: { difficulty: DifficultyId; wave: number; kills: number }): Promise<number> {
  const { fs, db } = c;
  const col = fs.collection(db, COLLECTION);
  const [above, tie] = await Promise.all([
    fs.getCount(fs.query(col, fs.where('difficulty', '==', e.difficulty), fs.where('wave', '>', e.wave))),
    fs.getCount(fs.query(col, fs.where('difficulty', '==', e.difficulty), fs.where('wave', '==', e.wave), fs.where('kills', '>', e.kills))),
  ]);
  return above.data().count + tie.data().count + 1;
}

/** 판 기록을 올린다. 내 온라인 최고 기록보다 좋을 때만 바뀐다 (규칙도 그렇게 막는다) */
export function submitOnline(entry: RankEntry): Promise<SubmitResult> {
  return withTimeout((async () => {
    const c = await context();
    const { fs, db, uid } = c;
    const ref = fs.doc(db, COLLECTION, docId(uid, entry.difficulty));
    const snap = await fs.getDoc(ref);
    const old = snap.exists() ? fromDoc(snap.data()) : null;
    const better = !old || entry.wave > old.wave || (entry.wave === old.wave && entry.kills > old.kills);
    if (better) {
      await fs.setDoc(ref, {
        uid, name: entry.name, wave: entry.wave, kills: entry.kills, map: entry.map,
        difficulty: entry.difficulty, units: entry.units.slice(0, 3), at: fs.serverTimestamp(),
      });
    } else if (old.name !== entry.name) {
      await fs.updateDoc(ref, { name: entry.name, at: fs.serverTimestamp() });
    }
    const best: OnlineEntry = better ? { ...entry, uid } : { ...old, name: entry.name };
    return { improved: better, best, rank: await rankOf(c, best) };
  })());
}

/** 난이도별 상위 n명과 (있으면) 내 기록·순위 */
export function fetchOnline(difficulty: DifficultyId, n = 10): Promise<{ top: OnlineEntry[]; me: OnlineEntry | null; myRank: number; uid: string }> {
  return withTimeout((async () => {
    const c = await context();
    const { fs, db, uid } = c;
    const q = fs.query(fs.collection(db, COLLECTION), fs.where('difficulty', '==', difficulty), fs.orderBy('wave', 'desc'), fs.orderBy('kills', 'desc'), fs.limit(n));
    const [list, mine] = await Promise.all([fs.getDocs(q), fs.getDoc(fs.doc(db, COLLECTION, docId(uid, difficulty)))]);
    const top = list.docs.map((d) => fromDoc(d.data()));
    const me = mine.exists() ? fromDoc(mine.data()) : null;
    const inTop = top.findIndex((e) => e.uid === uid);
    const myRank = inTop >= 0 ? inTop + 1 : me ? await rankOf(c, me) : 0;
    return { top, me, myRank, uid };
  })());
}

/** 이름을 바꾸면 이미 올린 내 기록들의 이름도 바꾼다 */
export function renameOnline(name: string): Promise<void> {
  return withTimeout((async () => {
    const { fs, db, uid } = await context();
    await Promise.all(DIFFICULTY_ORDER.map(async (d) => {
      const ref = fs.doc(db, COLLECTION, docId(uid, d));
      const snap = await fs.getDoc(ref);
      if (snap.exists() && snap.data().name !== name) await fs.updateDoc(ref, { name, at: fs.serverTimestamp() });
    }));
  })());
}
