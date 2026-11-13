import Phaser from 'phaser';

/**
 * 카툰풍 이펙트 모음. 입자 텍스처는 처음 한 번 코드로 그려서 만든다.
 * 입자는 미리 만든 이미터로 터뜨려서 많이 터져도 가볍다.
 */
export class Fx {
  private sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  private puffs: Phaser.GameObjects.Particles.ParticleEmitter;
  private flakes: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(private scene: Phaser.Scene) {
    makeTextures(scene);
    this.sparks = scene.add.particles(0, 0, 'fx_spark', {
      emitting: false, lifespan: { min: 180, max: 320 }, speed: { min: 90, max: 220 },
      scale: { start: 0.7, end: 0 }, rotate: { min: 0, max: 360 }, angle: { min: 0, max: 360 },
    }).setDepth(9);
    this.puffs = scene.add.particles(0, 0, 'fx_dot', {
      emitting: false, lifespan: { min: 350, max: 600 }, speed: { min: 15, max: 60 },
      scale: { start: 0.9, end: 1.8 }, alpha: { start: 0.55, end: 0 }, angle: { min: 200, max: 340 }, tint: 0xb9aea3,
    }).setDepth(8);
    this.flakes = scene.add.particles(0, 0, 'fx_flake', {
      emitting: false, lifespan: { min: 400, max: 650 }, speed: { min: 40, max: 120 },
      scale: { start: 0.8, end: 0.2 }, rotate: { start: 0, end: 180 }, angle: { min: 0, max: 360 }, alpha: { start: 1, end: 0 },
    }).setDepth(9);
  }

  /** 맞은 곳: 별 모양 '팡'과 불꽃 입자 */
  impact(x: number, y: number, color: number, big = false): void {
    const star = this.scene.add.image(x, y, 'fx_star').setTint(big ? 0xfff2a8 : 0xffffff).setDepth(9).setScale(0.1).setAngle(Math.random() * 72);
    this.scene.tweens.add({ targets: star, scale: big ? 1.1 : 0.6, alpha: 0, angle: star.angle + 40, duration: big ? 260 : 160, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
    this.sparks.setParticleTint(color);
    this.sparks.explode(big ? 8 : 3, x, y);
  }

  /** 발사 순간 총구 쪽 하얀 섬광 */
  muzzle(x: number, y: number, angle: number, dist: number): void {
    const mx = x + Math.cos(angle) * dist;
    const my = y + Math.sin(angle) * dist;
    const f = this.scene.add.image(mx, my, 'fx_dot').setDepth(9).setScale(0.6).setAlpha(0.9);
    this.scene.tweens.add({ targets: f, scale: 1.1, alpha: 0, duration: 90, onComplete: () => f.destroy() });
  }

  /** 날아가는 투사체 대신 쓰는 선: 바깥 빛 + 하얀 심 */
  tracer(x1: number, y1: number, x2: number, y2: number, color: number, width: number, fade: number): void {
    const g = this.scene.add.graphics().setDepth(7);
    g.lineStyle(width * 2.2, color, 0.35).lineBetween(x1, y1, x2, y2);
    g.lineStyle(width, color, 0.95).lineBetween(x1, y1, x2, y2);
    g.lineStyle(Math.max(1, width * 0.4), 0xffffff, 1).lineBetween(x1, y1, x2, y2);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: fade, onComplete: () => g.destroy() });
  }

  /** 그릴 광선: 굵기가 일렁이는 빛줄기 */
  beam(x1: number, y1: number, x2: number, y2: number, power: number): void {
    const g = this.scene.add.graphics().setDepth(7);
    const w = 6 + power * 3 + Math.random() * 3;
    g.lineStyle(w * 2, 0xff6a1a, 0.3).lineBetween(x1, y1, x2, y2);
    g.lineStyle(w, 0xff9a3a, 0.9).lineBetween(x1, y1, x2, y2);
    g.lineStyle(w * 0.35, 0xfff2a8, 1).lineBetween(x1, y1, x2, y2);
    this.scene.tweens.add({ targets: g, alpha: 0, duration: 110, onComplete: () => g.destroy() });
  }

  /** 폭발: 노랑 속 + 주황 겉 + 충격파 고리 + 연기 + 불꽃 */
  explosion(x: number, y: number, r: number): void {
    const s = this.scene;
    const outer = s.add.circle(x, y, r, 0xff8a2a, 0.75).setDepth(8).setScale(0.3);
    const inner = s.add.circle(x, y, r * 0.6, 0xffe066, 0.95).setDepth(8).setScale(0.3);
    const ring = s.add.image(x, y, 'fx_ring').setDepth(8).setDisplaySize(r * 2, r * 2);
    const rs = ring.scaleX;
    ring.setScale(rs * 0.4).setTint(0xffffff);
    s.tweens.add({ targets: outer, scale: 1, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => outer.destroy() });
    s.tweens.add({ targets: inner, scale: 1, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => inner.destroy() });
    s.tweens.add({ targets: ring, scale: rs * 1.25, alpha: 0, duration: 320, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    this.puffs.explode(5, x, y);
    this.sparks.setParticleTint(0xffb02e);
    this.sparks.explode(10, x, y);
  }

  /** 선풍기 바람: 회오리 곡선 세 줄이 돌면서 퍼진다. 냉풍은 눈송이, 태풍은 더 크게 소용돌이 */
  wind(x: number, y: number, r: number, kind: 'plain' | 'frost' | 'typhoon' | 'suction'): void {
    const s = this.scene;
    const color = kind === 'frost' ? 0x8fd8ff : kind === 'suction' ? 0x9aa0b4 : 0x5fb7e8;
    const g = s.add.graphics({ x, y }).setDepth(6);
    const arcs = kind === 'typhoon' ? 4 : 3;
    for (let i = 0; i < arcs; i++) {
      const a = (i / arcs) * Math.PI * 2;
      g.lineStyle(kind === 'typhoon' ? 6 : 4, color, 0.8);
      g.beginPath();
      g.arc(0, 0, r * 0.85, a, a + 1.1);
      g.strokePath();
      g.lineStyle(3, 0xffffff, 0.8);
      g.beginPath();
      g.arc(0, 0, r * 0.6, a + 0.4, a + 1.2);
      g.strokePath();
    }
    g.fillStyle(color, kind === 'frost' ? 0.16 : 0.08).fillCircle(0, 0, r);
    // 흡입은 바깥에서 안으로, 나머지는 안에서 밖으로
    const inward = kind === 'suction';
    g.setScale(inward ? 1.1 : 0.35);
    s.tweens.add({
      targets: g, scale: inward ? 0.3 : 1, angle: (inward ? -1 : 1) * (kind === 'typhoon' ? 160 : 90), alpha: 0,
      duration: kind === 'typhoon' ? 520 : 380, ease: 'Quad.easeOut', onComplete: () => g.destroy(),
    });
    if (kind === 'frost') this.flakes.explode(8, x, y);
  }

  /** 치유사의 회복: 초록 고리가 퍼지고 십자가 떠오른다 */
  heal(x: number, y: number, r: number): void {
    const s = this.scene;
    const ring = s.add.image(x, y, 'fx_ring').setDepth(6).setTint(0x4fd06a).setDisplaySize(r * 2, r * 2);
    const full = ring.scaleX;
    ring.setScale(full * 0.2).setAlpha(0.8);
    s.tweens.add({ targets: ring, scale: full, alpha: 0, duration: 450, ease: 'Quad.easeOut', onComplete: () => ring.destroy() });
    const g = s.add.graphics({ x, y: y - 20 }).setDepth(9);
    g.fillStyle(0xffffff).fillRect(-4, -11, 8, 22).fillRect(-11, -4, 22, 8);
    g.fillStyle(0x3fae55).fillRect(-2.5, -9.5, 5, 19).fillRect(-9.5, -2.5, 19, 5);
    s.tweens.add({ targets: g, y: y - 50, alpha: 0, duration: 600, onComplete: () => g.destroy() });
  }

  /** 처치: 몸 색 불꽃 + 작은 고리 */
  pop(x: number, y: number, color: number): void {
    const ring = this.scene.add.image(x, y, 'fx_ring').setDepth(8).setScale(0.2).setTint(color);
    this.scene.tweens.add({ targets: ring, scale: 0.7, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    this.sparks.setParticleTint(color);
    this.sparks.explode(8, x, y);
  }
}

/** 사거리 표시: 반투명 채움 + 흰·색 이중 테두리 + 테두리를 따라 도는 점선 */
export function drawRange(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, color: number, t: number): void {
  g.fillStyle(color, 0.18).fillCircle(x, y, r);
  g.lineStyle(6, 0xffffff, 0.9).strokeCircle(x, y, r);
  g.lineStyle(3, color, 1).strokeCircle(x, y, r);
  const n = Math.max(12, Math.round(r / 9));
  const step = (Math.PI * 2) / n;
  const off = t * 0.8;
  g.lineStyle(3, 0xffffff, 1);
  for (let i = 0; i < n; i++) {
    const a = off + i * step;
    g.beginPath();
    g.arc(x, y, r - 7, a, a + step * 0.45);
    g.strokePath();
  }
}

function makeTextures(scene: Phaser.Scene): void {
  if (scene.textures.exists('fx_dot')) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // 둥근 점 (연기·섬광)
  g.fillStyle(0xffffff, 0.35).fillCircle(16, 16, 16);
  g.fillStyle(0xffffff, 1).fillCircle(16, 16, 11);
  g.generateTexture('fx_dot', 32, 32);
  g.clear();
  // 불꽃: 길쭉한 마름모
  g.fillStyle(0xffffff).fillPoints([new Phaser.Math.Vector2(12, 0), new Phaser.Math.Vector2(16, 12), new Phaser.Math.Vector2(12, 24), new Phaser.Math.Vector2(8, 12)], true);
  g.generateTexture('fx_spark', 24, 24);
  g.clear();
  // 별: 만화 '팡'
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? 46 : 20;
    pts.push(new Phaser.Math.Vector2(48 + Math.cos(a) * rr, 48 + Math.sin(a) * rr));
  }
  g.fillStyle(0xffffff).fillPoints(pts, true);
  g.lineStyle(4, 0xffb02e).strokePoints(pts, true);
  g.generateTexture('fx_star', 96, 96);
  g.clear();
  // 고리 (충격파)
  g.lineStyle(10, 0xffffff, 1).strokeCircle(64, 64, 58);
  g.generateTexture('fx_ring', 128, 128);
  g.clear();
  // 눈송이
  g.lineStyle(3, 0xffffff, 1);
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    g.lineBetween(12 - Math.cos(a) * 10, 12 - Math.sin(a) * 10, 12 + Math.cos(a) * 10, 12 + Math.sin(a) * 10);
  }
  g.generateTexture('fx_flake', 24, 24);
  g.destroy();
}
