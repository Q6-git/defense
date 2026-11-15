import { describe, expect, it } from 'vitest';
import { parseConfig } from '../src/online/config';
import { cleanName, NAME_MAX, randomName } from '../src/ranking';

describe('온라인 랭킹 설정과 이름', () => {
  it('JSON 설정을 읽는다', () => {
    expect(parseConfig('{"apiKey":"k","projectId":"p","appId":"a"}')?.projectId).toBe('p');
  });

  it('Firebase 콘솔에서 복사한 코드 모양도 읽는다', () => {
    const pasted = `const firebaseConfig = {
      apiKey: "AIza-test",
      authDomain: "my-game.firebaseapp.com",
      projectId: "my-game",
      storageBucket: "my-game.firebasestorage.app",
      messagingSenderId: "123",
      appId: "1:123:web:abc",
    };`;
    const c = parseConfig(pasted);
    expect(c?.apiKey).toBe('AIza-test');
    expect(c?.appId).toBe('1:123:web:abc');
  });

  it('비었거나 필수 값이 없으면 꺼짐(null)', () => {
    expect(parseConfig(undefined)).toBeNull();
    expect(parseConfig('')).toBeNull();
    expect(parseConfig('{"apiKey":"k"}')).toBeNull();
    expect(parseConfig('엉망')).toBeNull();
  });

  it('이름: 공백 정리, 최대 8글자, 이모지를 반으로 자르지 않는다', () => {
    expect(cleanName('  가전   지킴이  ')).toBe('가전 지킴이');
    expect(Array.from(cleanName('🔌🔌🔌🔌🔌🔌🔌🔌🔌🔌'))).toHaveLength(NAME_MAX);
    expect(cleanName('   ')).toBe('');
  });

  it('기본 이름은 수비대 + 숫자 4개', () => {
    expect(randomName(() => 0.0421)).toBe('수비대0421');
  });
});
