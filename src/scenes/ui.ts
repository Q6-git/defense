import Phaser from 'phaser';

export const FONT = '"Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", NanumSquareRound, sans-serif';

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 18, color = '#f2f2f2') {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
}

export interface Button {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  setEnabled(on: boolean): void;
  setText(s: string): void;
}

/** 사각형 + 텍스트 버튼. 마우스와 터치 모두 pointerup으로 처리한다. */
export function button(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, s: string, onClick: () => void,
  color = 0x2f6fd6, size = 18,
): Button {
  const bg = scene.add.rectangle(0, 0, w, h, color).setStrokeStyle(2, 0xffffff, 0.25);
  const label = text(scene, 0, 0, s, size).setOrigin(0.5);
  const container = scene.add.container(x, y, [bg, label]);
  let enabled = true;
  bg.setInteractive({ useHandCursor: true })
    .on('pointerover', () => enabled && bg.setFillStyle(Phaser.Display.Color.ValueToColor(color).lighten(15).color))
    .on('pointerout', () => bg.setFillStyle(color))
    .on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      if (enabled) onClick();
    });
  return {
    container, bg, label,
    setEnabled(on) {
      enabled = on;
      container.setAlpha(on ? 1 : 0.45);
    },
    setText(t) {
      label.setText(t);
    },
  };
}
