// 언어 선택. 화면 코드는 여기서 STR을 가져다 쓴다 (언어를 바꾸면 STR이 그 언어의 문구로 바뀐다).
// 새 언어: strings.<언어>.ts를 Strings 모양으로 만들고 아래 TABLE과 LANGS에 한 줄씩 넣는다.
import { loadLang, saveLang } from './storage';
import { STR as en } from './strings.en';
import { STR as ja } from './strings.ja';
import { STR as ko, type Strings } from './strings.ko';
import { STR as tl } from './strings.tl';
import { STR as zh } from './strings.zh';

export type LangId = 'ko' | 'en' | 'zh' | 'ja' | 'tl';

/**
 * 고를 수 있는 언어 (설정 화면에 나오는 순서). 이름은 그 언어로 적는다.
 * 따갈로그어(tl)는 문구는 있지만 일단 빼 두었다. 다시 넣으려면 { id: 'tl', name: 'Tagalog' } 한 줄을 더한다
 */
export const LANGS: { id: LangId; name: string }[] = [
  { id: 'ko', name: '한국어' },
  { id: 'en', name: 'English' },
  { id: 'zh', name: '简体中文' },
  { id: 'ja', name: '日本語' },
];

/** 문구가 준비된 언어 전부 (고를 수 없는 언어도 포함) */
export const STRINGS: Record<LangId, Strings> = { ko, en, zh, ja, tl };

const selectable = (id: string): id is LangId => LANGS.some((l) => l.id === id);

/** 브라우저 언어 목록에서 고를 수 있는 첫 언어를 고른다. 없으면 영어 (fil은 따갈로그어로 본다) */
export function detectLang(preferred: readonly string[]): LangId {
  for (const p of preferred) {
    const code = p.toLowerCase().split('-')[0];
    const id = code === 'fil' ? 'tl' : code;
    if (selectable(id)) return id;
  }
  return 'en';
}

function initial(): LangId {
  const saved = loadLang();
  // 전에 고른 언어가 지금은 고를 수 없으면(빼 둔 언어) 브라우저 언어를 따른다
  if (selectable(saved)) return saved;
  return typeof navigator === 'undefined' ? 'ko' : detectLang(navigator.languages ?? [navigator.language]);
}

let current: LangId = initial();
/** 지금 언어의 문구. setLang으로 바뀐다 */
export let STR: Strings = STRINGS[current];

function syncDocument(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = current === 'zh' ? 'zh-Hans' : current;
  document.title = STR.title;
}
syncDocument();

export function lang(): LangId {
  return current;
}

/** 문구 묶음에서 화면에 나올 수 있는 글자를 모두 모은다 (함수로 된 문구는 소스 안의 글자를 쓴다) */
function allText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'function') return String(v);
  if (v && typeof v === 'object') return Object.values(v).map(allText).join('');
  return '';
}

/**
 * 그 언어의 글자가 든 글꼴 파일을 미리 받는다. 한글 글꼴(주아)은 글자 범위별로 쪼개진 파일이라,
 * 받기 전에 Phaser가 글자를 그리면 일부 글자만 다른 글꼴로 남는다. 늦어도 3초 뒤에는 그냥 진행한다
 */
export async function loadFontFor(id: LangId = current): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  const sample = `${allText(STRINGS[id])}0123456789+-×/%!?.,:()[]`;
  const load = document.fonts.load('24px Jua', sample).then(() => undefined, () => undefined);
  await Promise.race([load, new Promise((r) => setTimeout(r, 3000))]);
}

/** 언어를 바꾸고 저장한다. 이미 그린 글자는 그대로이므로 화면을 다시 그려야 한다 (그 전에 loadFontFor) */
export function setLang(id: LangId): void {
  current = id;
  STR = STRINGS[id];
  saveLang(id);
  syncDocument();
}
