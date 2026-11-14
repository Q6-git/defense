import Phaser from 'phaser';
import { SPRITES } from '../sprites';

/** 둥근 한글 글꼴 '주아'. 못 불러오면 시스템 글꼴로 대신 그린다 */
export const FONT = 'Jua, "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", NanumSquareRound, sans-serif';

/** 밝은 캐주얼 테마 색. 화면 전체 색은 여기서만 바꾼다 */
export const THEME = {
  text: '#4a3b34',
  textSoft: '#9a8577',
  textOnDark: '#fffaf2',
  bar: 0xfff6e8,
  barLine: 0xe7d6bd,
  card: 0xffffff,
  cardLine: 0xe9dcc8,
  overlay: 0x2b2230,
  // 버튼 색
  green: 0x5cc46b,
  blue: 0x5aa9e6,
  red: 0xef6f6c,
  purple: 0xa57be0,
  yellow: 0xffc94d,
  orange: 0xf29a4a,
  neutral: 0xece2d3,
  white: 0xffffff,
  // 강조
  gold: '#f5a623',
  pink: '#c86fd8',
  danger: '#e5484d',
  selected: 0xffb020,
};

export function text(scene: Phaser.Scene, x: number, y: number, s: string, size = 18, color: string = THEME.text) {
  return scene.add.text(x, y, s, { fontFamily: FONT, fontSize: `${size}px`, color });
}

/** 밝은 색이면 true (그 위에는 진한 글자를 쓴다) */
function isLight(color: number): boolean {
  const c = Phaser.Display.Color.ValueToColor(color);
  return 0.299 * c.red + 0.587 * c.green + 0.114 * c.blue > 170;
}

/**
 * 둥근 사각형. Rectangle처럼 setFillStyle / setStrokeStyle을 쓸 수 있다.
 * 아래쪽에 진한 그림자를 깔아서 눌리는 버튼처럼 보이게 한다 (depthPx).
 */
export class RoundBox extends Phaser.GameObjects.Graphics {
  private fillColor: number;
  private fillAlpha = 1;
  private line = { w: 0, color: 0, alpha: 0 };

  constructor(
    scene: Phaser.Scene, x: number, y: number,
    readonly w: number, readonly h: number, color: number,
    readonly radius = 14, readonly depthPx = 0, readonly origin: 'center' | 'topleft' = 'center',
  ) {
    super(scene, { x, y });
    this.fillColor = color;
    scene.add.existing(this);
    this.redraw();
  }

  setFillStyle(color: number, alpha = 1): this {
    this.fillColor = color;
    this.fillAlpha = alpha;
    return this.redraw();
  }

  setStrokeStyle(w: number, color = 0, alpha = 1): this {
    this.line = { w, color, alpha };
    return this.redraw();
  }

  get left(): number {
    return this.origin === 'center' ? -this.w / 2 : 0;
  }

  get top(): number {
    return this.origin === 'center' ? -this.h / 2 : 0;
  }

  private redraw(): this {
    const { w, h, radius: r, depthPx: d, left: x, top: y } = this;
    this.clear();
    if (d > 0) {
      const shade = Phaser.Display.Color.ValueToColor(this.fillColor).darken(22).color;
      this.fillStyle(shade, this.fillAlpha).fillRoundedRect(x, y + d, w, h, r);
    }
    this.fillStyle(this.fillColor, this.fillAlpha).fillRoundedRect(x, y, w, h, r);
    // 윗부분 하이라이트
    if (d > 0) this.fillStyle(0xffffff, 0.18).fillRoundedRect(x + 4, y + 3, w - 8, h * 0.38, { tl: r - 3, tr: r - 3, bl: 6, br: 6 });
    if (this.line.w > 0) this.lineStyle(this.line.w, this.line.color, this.line.alpha).strokeRoundedRect(x, y, w, h, r);
    return this;
  }
}

/** 카드(패널) 바탕: 흰 둥근 사각형 + 옅은 테두리 */
export function card(scene: Phaser.Scene, x: number, y: number, w: number, h: number, origin: 'center' | 'topleft' = 'topleft', color = THEME.card) {
  return new RoundBox(scene, x, y, w, h, color, 16, 0, origin).setStrokeStyle(2, THEME.cardLine);
}

export interface Button {
  container: Phaser.GameObjects.Container;
  bg: RoundBox;
  label: Phaser.GameObjects.Text;
  setEnabled(on: boolean): void;
  setText(s: string): void;
}

/** 둥근 입체 버튼. 마우스와 터치 모두 pointerup으로 처리하고, 누르는 동안 살짝 내려간다 */
export function button(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, s: string, onClick: () => void,
  color: number = THEME.blue, size = 18,
): Button {
  const depthPx = 4;
  const bg = new RoundBox(scene, 0, -depthPx / 2, w, h - depthPx, color, Math.min(14, h / 3), depthPx);
  const light = isLight(color);
  const label = text(scene, 0, -depthPx / 2, s, size, light ? THEME.text : THEME.textOnDark).setOrigin(0.5);
  if (!light) label.setShadow(0, 1, 'rgba(0,0,0,0.25)', 2);
  const container = scene.add.container(x, y, [bg, label]);
  let enabled = true;
  const hover = Phaser.Display.Color.ValueToColor(color).lighten(8).color;
  const press = (down: boolean) => {
    bg.y = -depthPx / 2 + (down ? 2 : 0);
    label.y = bg.y;
  };
  bg.setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
  if (bg.input) bg.input.cursor = 'pointer';
  bg.on('pointerover', () => enabled && bg.setFillStyle(hover))
    .on('pointerout', () => {
      bg.setFillStyle(color);
      press(false);
    })
    .on('pointerdown', () => enabled && press(true))
    .on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      press(false);
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

/** 그림이 있으면 그림, 없으면 이모지 글자. size는 화면에 보이는 지름(px) */
export type Icon = Phaser.GameObjects.Image | Phaser.GameObjects.Text;

export function icon(scene: Phaser.Scene, x: number, y: number, key: string | undefined, emoji: string, size: number): Icon {
  if (key && scene.textures.exists(key)) {
    // 3D로 렌더링한 그림은 외곽선 여백이 있어서 조금 크게 그린다
    const s = SPRITES[key]?.endsWith('.png') ? size * 1.3 : size;
    const im = scene.add.image(x, y, key).setDisplaySize(s, s);
    im.setData('base', im.scaleX);
    return im;
  }
  const t = text(scene, x, y, emoji, Math.round(size * 0.55)).setOrigin(0.5);
  t.setData('base', 1);
  return t;
}

/** 반동·튕김 효과를 줄 때 기준이 되는 원래 배율 */
export function baseScale(o: Icon): number {
  return (o.getData('base') as number | undefined) ?? 1;
}
