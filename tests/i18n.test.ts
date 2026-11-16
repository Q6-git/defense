import { describe, expect, it } from 'vitest';
import { detectLang, LANGS, STRINGS, type LangId } from '../src/i18n';
import { NAME_MAX } from '../src/ranking';

/** 문구 묶음의 모양: 키 경로 → 종류 (문자열, 함수, 배열 길이) */
function shape(v: unknown, path = ''): Record<string, string> {
  if (typeof v === 'string') return { [path]: 'string' };
  if (typeof v === 'function') return { [path]: `fn/${(v as (...a: unknown[]) => unknown).length}` };
  if (Array.isArray(v)) return { [path]: `array/${v.length}` };
  const out: Record<string, string> = {};
  for (const [k, x] of Object.entries(v as object)) Object.assign(out, shape(x, path ? `${path}.${k}` : k));
  return out;
}

/** 화면에 나올 수 있는 글자 전부 (함수는 소스 글자) */
function allText(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'function') return String(v);
  if (v && typeof v === 'object') return Object.values(v).map(allText).join('\n');
  return '';
}

const others = LANGS.map((l) => l.id).filter((id) => id !== 'ko');

describe('언어', () => {
  it('설정에 나오는 언어마다 문구 묶음이 있다', () => {
    expect(LANGS.map((l) => l.id).sort()).toEqual(Object.keys(STRINGS).sort());
    expect(LANGS.length).toBe(5);
  });

  it.each(others)('%s: 한국어와 키가 모두 같다 (카드·적·업적 등 목록 포함)', (id) => {
    const ko = shape(STRINGS.ko);
    const other = shape(STRINGS[id]);
    expect(Object.keys(other).sort()).toEqual(Object.keys(ko).sort());
    for (const k of Object.keys(ko)) {
      // 함수는 인자 수가 달라도 된다 (안 쓰는 인자는 생략)
      expect(other[k].split('/')[0], k).toBe(ko[k].split('/')[0]);
      if (ko[k].startsWith('array')) expect(other[k], k).toBe(ko[k]);
    }
  });

  it.each(others)('%s: 번역 안 된 한글이 남아 있지 않고, 빈 문구가 없다', (id) => {
    expect(allText(STRINGS[id])).not.toMatch(/[가-힣]/);
    const walk = (v: unknown, path: string): void => {
      if (typeof v === 'string') expect(v.trim().length, path).toBeGreaterThan(0);
      else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
    };
    walk(STRINGS[id], id);
  });

  it('자동으로 붙는 이름(앞부분 + 숫자 4개)이 랭킹 이름 길이 한도 안이다', () => {
    for (const id of Object.keys(STRINGS) as LangId[]) expect(Array.from(STRINGS[id].namePrefix).length + 4, id).toBeLessThanOrEqual(NAME_MAX);
  });

  it('브라우저 언어에서 고른다: 지원하는 첫 언어, 없으면 영어', () => {
    expect(detectLang(['ko-KR', 'en-US'])).toBe('ko');
    expect(detectLang(['ja'])).toBe('ja');
    expect(detectLang(['zh-CN'])).toBe('zh');
    expect(detectLang(['fil-PH'])).toBe('tl');
    expect(detectLang(['tl'])).toBe('tl');
    expect(detectLang(['fr-FR', 'ja-JP'])).toBe('ja');
    expect(detectLang(['fr-FR'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });
});
