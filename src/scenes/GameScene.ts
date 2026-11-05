import Phaser from 'phaser';
import { defaultConfig } from '../config';
import { Game } from '../core/game';
import { STR } from '../strings.ko';
import { button, text, type Button } from './ui';

export class GameScene extends Phaser.Scene {
  private sim!: Game;
  private world!: Phaser.GameObjects.Graphics;
  private emojis = new Map<number, Phaser.GameObjects.Text>();
  private hud!: Phaser.GameObjects.Text;
  private waveBtn!: Button;

  constructor() {
    super('game');
  }

  create(): void {
    this.sim = new Game(defaultConfig());
    this.emojis.clear();
    this.drawMap();
    this.world = this.add.graphics();
    this.hud = text(this, 16, 14, '', 22);
    this.waveBtn = button(this, 1160, 28, 220, 40, STR.startWave, () => this.sim.startWave(), 0x2e9e5b);
  }

  update(_t: number, deltaMs: number): void {
    this.sim.update(Math.min(deltaMs / 1000, 0.25));
    this.sim.drainEvents();
    this.render();
  }

  private drawMap(): void {
    const { map } = this.sim.cfg;
    const g = this.add.graphics();
    g.fillStyle(0x23262e).fillRect(map.area.x, map.area.y, map.area.w, map.area.h);
    // 타일 바닥
    g.lineStyle(1, 0xffffff, 0.04);
    for (let x = map.area.x; x <= map.area.x + map.area.w; x += 40) g.lineBetween(x, map.area.y, x, map.height);
    for (let y = map.area.y; y <= map.height; y += 40) g.lineBetween(map.area.x, y, map.area.x + map.area.w, y);
    // 배수관 경로
    const pts = map.path;
    g.lineStyle(map.pathHalfWidth * 2 + 8, 0x3b3f4a);
    g.strokePoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    for (const p of pts) g.fillStyle(0x3b3f4a).fillCircle(p.x, p.y, map.pathHalfWidth + 4);
    g.lineStyle(map.pathHalfWidth * 2, 0x4c5262);
    g.strokePoints(pts.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    for (const p of pts) {
      g.fillStyle(0x4c5262).fillCircle(p.x, p.y, map.pathHalfWidth);
    }
    const end = pts[pts.length - 1];
    text(this, 24, pts[0].y - 52, '🕳️ 배수구', 18, '#9fb3c8');
    text(this, end.x + 10, end.y, '🔌', 46).setOrigin(0.5);
    // 상단 바, 우측 패널
    g.fillStyle(0x1b1d24).fillRect(0, 0, map.width, map.area.y);
    g.fillStyle(0x1b1d24).fillRect(map.area.x + map.area.w, map.area.y, map.width - map.area.w, map.area.h);
  }

  private render(): void {
    const g = this.world;
    g.clear();
    const alive = new Set<number>();
    for (const e of this.sim.enemies) {
      alive.add(e.uid);
      g.fillStyle(e.def.color).fillCircle(e.x, e.y, e.def.radius);
      if (e.slowMul < 1) g.lineStyle(3, 0x9fe3ff).strokeCircle(e.x, e.y, e.def.radius + 2);
      // 체력바
      const w = e.def.radius * 2;
      g.fillStyle(0x000000, 0.6).fillRect(e.x - w / 2, e.y - e.def.radius - 9, w, 4);
      g.fillStyle(0xff5a5a).fillRect(e.x - w / 2, e.y - e.def.radius - 9, (w * e.hp) / e.maxHp, 4);
      let em = this.emojis.get(e.uid);
      if (!em) {
        em = text(this, 0, 0, e.def.emoji, e.def.radius * 1.4).setOrigin(0.5);
        this.emojis.set(e.uid, em);
      }
      em.setPosition(e.x, e.y);
    }
    for (const [uid, em] of this.emojis) {
      if (!alive.has(uid)) {
        em.destroy();
        this.emojis.delete(uid);
      }
    }
    const gm = this.sim;
    this.hud.setText(`${STR.hp} ${gm.hp}    ${STR.money} ${gm.money}    ${STR.wave(gm.wave, gm.totalWaves)}`);
    this.waveBtn.setEnabled(gm.phase === 'ready' && gm.wave < gm.totalWaves);
    this.waveBtn.setText(gm.phase === 'wave' ? STR.waveRunning : STR.startWave);
  }
}
