import Phaser from 'phaser';
import { defaultConfig } from '../config';
import { Game, type GameEvent } from '../core/game';
import { TARGET_MODES, type Unit, type UnitId } from '../core/types';
import { UNIT_ORDER } from '../data/units';
import { loadBest, saveBest } from '../storage';
import { STR } from '../strings.ko';
import { button, text, type Button } from './ui';

const PANEL_X = 1040;
const PANEL_W = 240;
const SPEEDS = [1, 2, 3];

export class GameScene extends Phaser.Scene {
  private sim!: Game;
  private world!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private enemyEmojis = new Map<number, Phaser.GameObjects.Text>();
  private unitEmojis = new Map<number, Phaser.GameObjects.Text>();
  private hud!: Phaser.GameObjects.Text;
  private waveBtn!: Button;
  private speedBtn!: Button;
  private speed = 1;
  private shopBtns: { id: UnitId; btn: Button }[] = [];
  private toast!: Phaser.GameObjects.Text;
  private toastTimer = 0;

  /** 설치하려고 고른 유닛 */
  private placing: UnitId | null = null;
  private ghost: { x: number; y: number } | null = null;
  /** 정보 패널에 띄운 설치된 유닛 */
  private selected: Unit | null = null;
  private info!: {
    root: Phaser.GameObjects.Container;
    title: Phaser.GameObjects.Text;
    stats: Phaser.GameObjects.Text;
    upgrade: Button;
    sell: Button;
    target: Button;
  };

  constructor() {
    super('game');
  }

  create(): void {
    this.sim = new Game(defaultConfig());
    // 개발 서버에서만: 브라우저 자동 테스트가 상태를 들여다볼 수 있게 노출
    if (import.meta.env.DEV) (window as unknown as { sim: Game }).sim = this.sim;
    this.enemyEmojis.clear();
    this.unitEmojis.clear();
    this.placing = null;
    this.selected = null;
    this.drawMap();
    this.world = this.add.graphics();
    this.overlay = this.add.graphics().setDepth(5);
    this.hud = text(this, 16, 14, '', 22);
    this.speed = 1;
    this.waveBtn = button(this, 1130, 28, 280, 40, STR.startWave, () => this.sim.apply({ type: 'startWave' }), 0x2e9e5b, 17);
    this.speedBtn = button(this, 910, 28, 120, 40, STR.speed(1), () => this.cycleSpeed(), 0x4a4f5e, 17);
    this.buildShop();
    this.buildInfo();
    this.toast = text(this, 520, 690, '', 18, '#ffd35a').setOrigin(0.5).setDepth(20);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.placing) this.ghost = { x: p.worldX, y: p.worldY };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onMapTap(p.worldX, p.worldY));
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.25);
    this.sim.update(dt * this.speed);
    for (const ev of this.sim.drainEvents()) this.playEvent(ev);
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toast.setText('');
    }
    this.render();
  }

  // ───────────────────────── 입력

  private onMapTap(x: number, y: number): void {
    const { area } = this.sim.cfg.map;
    if (this.sim.finished || x >= area.x + area.w || y < area.y) return; // 패널/상단 바는 버튼이 처리
    if (this.placing) {
      const id = this.placing;
      const res = this.sim.apply({ type: 'place', unit: id, x, y });
      if (res.ok) {
        this.placing = null;
        this.ghost = null;
      } else if (res.reason in STR.placeError) {
        // 터치 환경에서는 첫 탭이 위치 미리보기 역할을 한다
        this.ghost = { x, y };
        this.showToast(STR.placeError[res.reason as keyof typeof STR.placeError]);
      }
      return;
    }
    const hit = this.sim.units.find((u) => Phaser.Math.Distance.Between(u.x, u.y, x, y) <= u.def.radius + 6);
    this.select(hit ?? null);
  }

  private choosePlacing(id: UnitId): void {
    this.select(null);
    this.placing = this.placing === id ? null : id;
    this.ghost = null;
    if (this.placing) this.showToast(STR.placeHint);
  }

  private cycleSpeed(): void {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    this.speedBtn.setText(STR.speed(this.speed));
  }

  private select(u: Unit | null): void {
    this.selected = u;
    if (u) this.placing = null;
  }

  private showToast(s: string): void {
    this.toast.setText(s);
    this.toastTimer = 1.6;
  }

  // ───────────────────────── UI 구성

  private buildShop(): void {
    text(this, PANEL_X + 16, 66, STR.shop, 18, '#9fb3c8');
    this.shopBtns = UNIT_ORDER.map((id, i) => {
      const def = this.sim.cfg.units[id];
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = PANEL_X + 64 + col * 112;
      const y = 140 + row * 96;
      const btn = button(this, x, y, 104, 86, '', () => this.choosePlacing(id), 0x2a2e39, 15);
      btn.label.setText(`${def.emoji}\n${STR.units[id].name}\n💰${def.levels[0].cost}`).setAlign('center');
      return { id, btn };
    });
  }

  private buildInfo(): void {
    const x = PANEL_X + 12;
    const y = 400;
    const w = PANEL_W - 24;
    const bg = this.add.rectangle(0, 0, w, 308, 0x262a34).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.12);
    const title = text(this, 12, 10, '', 20);
    const stats = text(this, 12, 44, '', 15, '#c9d2dc').setLineSpacing(4);
    const upgrade = button(this, w / 2, 192, w - 24, 38, '', () => this.selected && this.sim.apply({ type: 'upgrade', uid: this.selected.uid }), 0x2f6fd6, 16);
    const target = button(this, w / 2, 238, w - 24, 34, '', () => this.cycleTarget(), 0x4a4f5e, 15);
    const sell = button(this, w / 2, 280, w - 24, 34, '', () => this.sellSelected(), 0xa8443d, 15);
    const root = this.add.container(x, y, [bg, title, stats, upgrade.container, target.container, sell.container]);
    this.info = { root, title, stats, upgrade, sell, target };
  }

  private cycleTarget(): void {
    const u = this.selected;
    if (!u) return;
    const next = TARGET_MODES[(TARGET_MODES.indexOf(u.target) + 1) % TARGET_MODES.length];
    this.sim.apply({ type: 'setTarget', uid: u.uid, mode: next });
  }

  private sellSelected(): void {
    if (!this.selected) return;
    this.sim.apply({ type: 'sell', uid: this.selected.uid });
    this.selected = null;
  }

  // ───────────────────────── 그리기

  private drawMap(): void {
    const { map } = this.sim.cfg;
    const g = this.add.graphics();
    g.fillStyle(0x23262e).fillRect(map.area.x, map.area.y, map.area.w, map.area.h);
    g.lineStyle(1, 0xffffff, 0.04);
    for (let x = map.area.x; x <= map.area.x + map.area.w; x += 40) g.lineBetween(x, map.area.y, x, map.height);
    for (let y = map.area.y; y <= map.height; y += 40) g.lineBetween(map.area.x, y, map.area.x + map.area.w, y);
    const pts = map.path.map((p) => new Phaser.Math.Vector2(p.x, p.y));
    g.lineStyle(map.pathHalfWidth * 2 + 8, 0x3b3f4a).strokePoints(pts);
    for (const p of pts) g.fillStyle(0x3b3f4a).fillCircle(p.x, p.y, map.pathHalfWidth + 4);
    g.lineStyle(map.pathHalfWidth * 2, 0x4c5262).strokePoints(pts);
    for (const p of pts) g.fillStyle(0x4c5262).fillCircle(p.x, p.y, map.pathHalfWidth);
    const end = pts[pts.length - 1];
    text(this, 24, pts[0].y - 52, '🕳️ 배수구', 18, '#9fb3c8');
    text(this, end.x + 10, end.y, '🔌', 46).setOrigin(0.5);
    g.fillStyle(0x1b1d24).fillRect(0, 0, map.width, map.area.y);
    g.fillStyle(0x1b1d24).fillRect(PANEL_X, map.area.y, PANEL_W, map.area.h);
  }

  private render(): void {
    const g = this.world;
    const gm = this.sim;
    g.clear();

    // 선택한 유닛 사거리
    const sel = this.selected;
    if (sel) {
      const r = sel.def.levels[sel.level].range;
      if (r > 0) g.fillStyle(0xffffff, 0.08).fillCircle(sel.x, sel.y, r).lineStyle(2, 0xffffff, 0.35).strokeCircle(sel.x, sel.y, r);
    }

    // 유닛
    syncEmojis(this, this.unitEmojis, gm.units.map((u) => ({ uid: u.uid, x: u.x, y: u.y, emoji: u.def.emoji, size: u.def.radius * 1.3 })));
    for (const u of gm.units) {
      g.fillStyle(u.def.color, 0.9).fillCircle(u.x, u.y, u.def.radius);
      g.lineStyle(2, u === sel ? 0xffffff : 0x000000, u === sel ? 1 : 0.4).strokeCircle(u.x, u.y, u.def.radius);
      if (u.buffMul > 1) g.lineStyle(2, 0x3fbf8f, 0.9).strokeCircle(u.x, u.y, u.def.radius + 4);
      for (let i = 0; i <= u.level; i++) g.fillStyle(0xffd35a).fillCircle(u.x - 8 + i * 8, u.y + u.def.radius + 5, 3);
    }

    // 적
    syncEmojis(this, this.enemyEmojis, gm.enemies.map((e) => ({ uid: e.uid, x: e.x, y: e.y, emoji: e.def.emoji, size: e.def.radius * 1.4 })));
    for (const e of gm.enemies) {
      g.fillStyle(e.def.color).fillCircle(e.x, e.y, e.def.radius);
      if (e.slowMul < 1) g.lineStyle(3, 0x9fe3ff).strokeCircle(e.x, e.y, e.def.radius + 2);
      const w = Math.max(24, e.def.radius * 2);
      g.fillStyle(0x000000, 0.6).fillRect(e.x - w / 2, e.y - e.def.radius - 9, w, 4);
      g.fillStyle(0xff5a5a).fillRect(e.x - w / 2, e.y - e.def.radius - 9, (w * Math.max(0, e.hp)) / e.maxHp, 4);
    }

    // 설치 미리보기
    const o = this.overlay;
    o.clear();
    if (this.placing && this.ghost) {
      const def = gm.cfg.units[this.placing];
      const err = gm.canPlace(this.placing, this.ghost.x, this.ghost.y);
      const ok = err === null;
      const r = def.levels[0].range;
      if (r > 0) o.fillStyle(ok ? 0xffffff : 0xff4040, 0.08).fillCircle(this.ghost.x, this.ghost.y, r);
      o.fillStyle(ok ? 0x6fe07a : 0xff4040, 0.6).fillCircle(this.ghost.x, this.ghost.y, def.radius);
    }

    // HUD
    this.hud.setText(`${STR.hp} ${gm.hp}    ${STR.money} ${gm.money}    ${STR.wave(gm.wave, gm.totalWaves)}`);
    this.waveBtn.setEnabled(gm.phase === 'ready' || gm.phase === 'intermission');
    this.waveBtn.setText(
      gm.phase === 'intermission' ? STR.nextWave(Math.ceil(gm.timer), gm.earlyBonus)
        : gm.phase === 'ready' ? STR.startWave : STR.waveRunning,
    );
    for (const { id, btn } of this.shopBtns) {
      const def = gm.cfg.units[id];
      btn.setEnabled(gm.money >= def.levels[0].cost);
      btn.bg.setStrokeStyle(this.placing === id ? 3 : 2, this.placing === id ? 0xffd35a : 0xffffff, this.placing === id ? 1 : 0.25);
    }
    this.renderInfo();
  }

  private renderInfo(): void {
    const u = this.selected && this.sim.findUnit(this.selected.uid) ? this.selected : null;
    const id = u?.def.id ?? this.placing;
    this.info.root.setVisible(id !== null);
    if (!id) return;
    const def = this.sim.cfg.units[id];
    const level = u?.level ?? 0;
    const lv = def.levels[level];
    const name = STR.units[id];
    this.info.title.setText(`${def.emoji} ${name.name}${u ? `  ${STR.level(level + 1)}` : ''}`);
    const s = STR.stats;
    const lines = [name.desc, ''];
    if (lv.damage) lines.push(`${s.damage} ${lv.damage}`);
    if (lv.cooldown) lines.push(`${s.rate} ${lv.cooldown}초`);
    if (lv.range) lines.push(`${s.range} ${lv.range}`);
    if (lv.splash) lines.push(`${s.splash} ${lv.splash}`);
    if (lv.slow) lines.push(`${s.slow} ${Math.round((1 - lv.slow) * 100)}%`);
    if (lv.buff) lines.push(`${s.buff} ${Math.round(lv.buff * 100)}%`);
    if (lv.income) lines.push(`${s.income} 💰${lv.income}`);
    this.info.stats.setText(lines.join('\n'));
    const showControls = u !== null;
    this.info.upgrade.container.setVisible(showControls);
    this.info.sell.container.setVisible(showControls);
    const attacks = def.kind === 'single' || def.kind === 'splash';
    this.info.target.container.setVisible(showControls && attacks);
    if (!u) return;
    const cost = this.sim.upgradeCost(u);
    this.info.upgrade.setText(cost === null ? STR.maxLevel : STR.upgrade(cost));
    this.info.upgrade.setEnabled(cost !== null && this.sim.money >= cost);
    this.info.sell.setText(STR.sell(this.sim.sellValue(u)));
    this.info.target.setText(STR.target(u.target));
  }

  private playEvent(ev: GameEvent): void {
    switch (ev.type) {
      case 'shot': {
        const line = this.add.line(0, 0, ev.from.x, ev.from.y, ev.to.x, ev.to.y, ev.color, 0.9).setOrigin(0).setLineWidth(3);
        this.tweens.add({ targets: line, alpha: 0, duration: 120, onComplete: () => line.destroy() });
        break;
      }
      case 'blast':
      case 'pulse': {
        const c = this.add.circle(ev.x, ev.y, ev.r, ev.color, ev.type === 'blast' ? 0.45 : 0.18);
        this.tweens.add({ targets: c, alpha: 0, scale: 1.15, duration: 260, onComplete: () => c.destroy() });
        break;
      }
      case 'kill':
        this.floatText(ev.x, ev.y, `+${ev.reward}`, '#ffd35a');
        break;
      case 'leak':
        this.floatText(ev.x, ev.y, `-${ev.damage}`, '#ff5a5a');
        this.cameras.main.shake(120, 0.004);
        break;
      case 'income':
        this.floatText(ev.x, ev.y, `+💰${ev.amount}`, '#ffd35a');
        break;
      case 'waveCleared':
        this.showToast(STR.waveCleared(ev.wave, ev.bonus));
        break;
      case 'earlyBonus':
        this.showToast(STR.earlyBonus(ev.amount));
        break;
      case 'gameOver':
      case 'victory':
        this.showEndScreen(ev.type === 'victory');
        break;
    }
  }

  private showEndScreen(won: boolean): void {
    this.placing = null;
    this.selected = null;
    const reached = this.sim.wave;
    const isNew = saveBest(reached);
    const { width, height } = this.sim.cfg.map;
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0).setInteractive();
    const box = this.add.rectangle(width / 2, height / 2, 520, 300, 0x23262e).setStrokeStyle(2, won ? 0xffd35a : 0xff5a5a);
    const title = text(this, width / 2, height / 2 - 100, won ? `🏆 ${STR.victory}` : `💥 ${STR.gameOver}`, 34).setOrigin(0.5);
    const lines = [STR.reachedWave(reached), STR.best(loadBest())];
    if (isNew) lines.push(STR.newBest);
    const body = text(this, width / 2, height / 2 - 10, lines.join('\n'), 20, '#c9d2dc').setOrigin(0.5).setAlign('center').setLineSpacing(6);
    const again = button(this, width / 2, height / 2 + 100, 220, 50, STR.restart, () => this.scene.restart(), 0x2e9e5b, 20);
    for (const o of [dim, box, title, body, again.container]) o.setDepth(50);
  }

  private floatText(x: number, y: number, s: string, color: string): void {
    const t = text(this, x, y - 10, s, 16, color).setOrigin(0.5).setDepth(10);
    this.tweens.add({ targets: t, y: y - 40, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }
}

function syncEmojis(
  scene: Phaser.Scene,
  pool: Map<number, Phaser.GameObjects.Text>,
  items: { uid: number; x: number; y: number; emoji: string; size: number }[],
): void {
  const alive = new Set<number>();
  for (const it of items) {
    alive.add(it.uid);
    let t = pool.get(it.uid);
    if (!t) {
      t = text(scene, 0, 0, it.emoji, it.size).setOrigin(0.5).setDepth(2);
      pool.set(it.uid, t);
    }
    t.setPosition(it.x, it.y);
  }
  for (const [uid, t] of pool) {
    if (!alive.has(uid)) {
      t.destroy();
      pool.delete(uid);
    }
  }
}
