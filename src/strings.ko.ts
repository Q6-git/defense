// 게임 안에 표시되는 모든 텍스트. 다른 언어를 추가할 때는 같은 키로 파일을 하나 더 만든다.
export const STR = {
  title: '가전 수비대 vs 하수구 군단',
  hp: '❤️',
  money: '💰',
  wave: (n: number, total: number) => `🌊 ${n}/${total}`,
  startWave: '▶ 웨이브 시작',
  waveRunning: '진행 중…',
  gameOver: '콘센트가 막혔다!',
  restart: '다시 하기',
};
