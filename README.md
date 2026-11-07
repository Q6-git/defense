# 가전 수비대 vs 하수구 군단

배수구에서 올라오는 하수구 군단을 가전제품으로 막아 콘센트(기지)를 지키는 웹 타워 디펜스 게임.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm test           # 로직 단위 테스트
npm run balance    # 봇 플레이어로 밸런스 확인
npm run build      # dist/ 에 배포용 빌드
```

## 플레이 방법

- 오른쪽 상점에서 가전을 고르고 맵을 눌러 설치 (배수관 위에는 설치할 수 없음)
- 설치한 가전을 누르면 업그레이드 / 타겟팅 모드 변경 / 판매(투자금 60% 환불)
- 기지에 도착한 적은 **남은 체력만큼** 기지 HP를 깎는다
- 웨이브 사이 15초 대기 중에 다음 웨이브를 일찍 부르면 남은 시간만큼 보너스
- 20웨이브 보스를 막으면 승리
- 스킬 2개를 웨이브 중에 직접 사용
  - 🪠 뚫어뻥: 누른 곳을 내려쳐 범위 피해 + 기절 (재사용 20초)
  - ⚡ 과부하: 6초 동안 모든 가전 공격 속도 2배 (재사용 40초)
- 공격의 10%는 크리티컬(2.5배)
- 상단에 다음 웨이브 구성 미리보기, 🔊 버튼으로 효과음 끄기

| 가전 | 역할 |
|---|---|
| 🍞 토스터 | 원거리 단일 공격 |
| 🌀 선풍기 | 범위 감속 |
| 📦 전자레인지 | 범위 폭발 |
| 🤖 로봇청소기 | 근거리 고속 공격 |
| 📶 와이파이 | 주변 가전 공격 속도 증가 |
| 🪙 동전 세탁기 | 웨이브마다 수입 (최대 3대) |

## 구조

```
src/core/      게임 로직 (Phaser 의존 없음, 테스트 대상, 멀티플레이 서버에서도 재사용 가능)
  game.ts      상태, 명령(Command) 처리, 시뮬레이션 스텝
  path.ts      경로 계산
  types.ts
src/data/      밸런스 데이터: units.ts, enemies.ts, waves.ts, map.ts
src/config.ts  시작 자금, 기지 HP, 보너스 등 규칙 수치
src/strings.ko.ts  화면 텍스트 (다른 언어는 같은 키로 파일 추가)
src/scenes/    Phaser 렌더링과 입력
tests/         Vitest
scripts/       balance.ts (밸런스 시뮬레이터), shot.cjs (Playwright 스크린샷)
```

유저 조작은 모두 `game.apply(command)`를 거친다. 멀티플레이를 붙일 때는 이 명령을 서버로 보내고, 서버가 같은 `Game`을 돌리면 된다.

## 배포

`main`에 push되면 GitHub Actions가 테스트 → 빌드 → GitHub Pages 배포를 한다.
처음 한 번은 저장소 **Settings → Pages → Source**를 **GitHub Actions**로 바꿔야 한다.
