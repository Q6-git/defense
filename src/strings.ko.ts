import type { PlaceError } from './core/game';
import type { TargetMode, UnitId } from './core/types';

// 게임 안에 표시되는 모든 텍스트. 다른 언어를 추가할 때는 같은 키로 파일을 하나 더 만든다.
export const STR = {
  title: '가전 수비대 vs 하수구 군단',
  hp: '❤️',
  money: '💰',
  wave: (n: number, total: number) => `🌊 ${n}/${total}`,
  startWave: '▶ 웨이브 시작',
  waveRunning: '진행 중…',
  nextWave: (sec: number, bonus: number) => `▶ 다음 웨이브 ${sec}초  +💰${bonus}`,
  speed: (x: number) => `⏩ ${x}배속`,
  waveCleared: (n: number, bonus: number) => `웨이브 ${n} 클리어!  +💰${bonus}`,
  earlyBonus: (n: number) => `조기 호출 보너스 +💰${n}`,
  gameOver: '콘센트가 막혔다!',
  victory: '집을 지켜냈다!',
  reachedWave: (n: number) => `도달한 웨이브: ${n}`,
  best: (n: number) => `최고 기록: 웨이브 ${n}`,
  newBest: '🎉 새 기록!',
  restart: '다시 하기',
  shop: '가전 설치',
  cancel: '취소',
  upgrade: (cost: number) => `⬆ 업그레이드 💰${cost}`,
  maxLevel: '최대 레벨',
  sell: (v: number) => `판매 +💰${v}`,
  level: (n: number) => `Lv.${n}`,
  target: (m: TargetMode) => `🎯 ${TARGET_NAMES[m]}`,
  stats: {
    damage: '공격력',
    range: '사거리',
    rate: '공격 간격',
    splash: '폭발 범위',
    slow: '감속',
    buff: '공속 증가',
    income: '웨이브당 수입',
  },
  placeHint: '맵을 눌러 설치하세요',
  placeError: {
    money: '돈이 부족해요',
    path: '배수관 위에는 설치할 수 없어요',
    overlap: '다른 가전과 겹쳐요',
    bounds: '여기는 설치할 수 없어요',
    limit: '최대 개수에 도달했어요',
  } satisfies Record<PlaceError, string>,
  units: {
    toaster: { name: '토스터', desc: '식빵을 발사하는 기본 포탑' },
    fan: { name: '선풍기', desc: '주변 적을 모두 느리게 만든다' },
    microwave: { name: '전자레인지', desc: '맞은 곳 주변을 폭발시킨다' },
    vacuum: { name: '로봇청소기', desc: '사거리는 짧지만 아주 빠르다' },
    wifi: { name: '와이파이', desc: '주변 가전의 공격 속도 증가' },
    washer: { name: '동전 세탁기', desc: '웨이브마다 돈을 번다 (최대 3대)' },
  } satisfies Record<UnitId, { name: string; desc: string }>,
};

const TARGET_NAMES: Record<TargetMode, string> = {
  first: '맨 앞',
  last: '맨 뒤',
  strong: '가장 강한',
  close: '가장 가까운',
};
