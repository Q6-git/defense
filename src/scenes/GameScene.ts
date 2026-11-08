import Phaser from 'phaser';
import { defaultConfig } from '../config';
import { Game, type GameEvent } from '../core/game';
import { TARGET_MODES, type AbilityId, type DifficultyId, type Enemy, type Unit, type UnitId } from '../core/types';
import { ABILITY_ORDER } from '../data/abilities';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty';
import { UNIT_ORDER } from '../data/units';
import { sfx, type SoundId } from '../sfx';
import { loadBest, loadSetup, saveBest, saveSetup, type RunSetup } from '../storage';
import { STR } from '../strings.ko';
import { button, text, type Button } from './ui';

const PANEL_X = 1040;
const PANEL_W = 240;
const SPEEDS = [1, 2, 3];
/** 투사체가 날아가는 속도(px/초). 피해는 즉시 들어가므로 너무 느리면 어색하다. */
const PROJECTILE_SPEED = 1400;
const PROJECTILE_EMOJI: Partial<Record<UnitId, string>> = { toaster: '🍞', microwave: '🔥' };
/** 갈래별 공격 모양: 빠른 공격은 투사체 대신 선으로 그린다 */
const BRANCH_SHOT: Record<string, { color: number; width: number; fade: number; sound: SoundId }> = {
  rapid: { color: 0xffd35a, width: 2, fade: 60, sound: 'shoot' },
  sniper: { color: 0xffffff, width: 5, fade: 250, sound: 'snipe' },
  grill: { color: 0xff7a1a, width: 6, fade: 110, sound: 'beam' },
  crusher: { color: 0xc0c4d0, width: 6, fade: 120, sound: 'blast' },
};

interface AbilityButton {
  id: AbilityId;
  btn: Button;
  shade: Phaser.GameObjects.Rectangle;
  timer: Phaser.GameObjects.Text;
}

export class GameScene extends Phaser.Scene {
  private sim!: Game;
  private setup: RunSetup = loadSetup();
  private endScreen: Phaser.GameObjects.GameObject[] = [];
  private get difficulty(): DifficultyId {
    return this.setup.difficulty;
  }
  private world!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private enemyEmojis = new Map<number, Phaser.GameObjects.Text>();
  private unitEmojis = new Map<number, Phaser.GameObjects.Text>();
  /** 갈림길을 고른 가전 위의 작은 배지 */
  private badges = new Map<number, Phaser.GameObjects.Text>();
  /** 맞은 적을 잠깐 하얗게 깜빡이게 하는 남은 시간 */
  private flashes = new Map<number, number>();
  private hud!: Phaser.GameObjects.Text;
  private diffLabel!: Phaser.GameObjects.Text;
  private preview!: Phaser.GameObjects.Text;
  private waveBtn!: Button;
  private speedBtn!: Button;
  private muteBtn!: Button;
  private speed = 1;
  private shopBtns: { id: UnitId; btn: Button }[] = [];
  private abilityBtns: AbilityButton[] = [];
  private toast!: Phaser.GameObjects.Text;
  private toastTimer = 0;
  private bossLabel!: Phaser.GameObjects.Text;
  private clock = 0;

  /** 설치하려고 고른 유닛 */
  private placing: UnitId | null = null;
  /** 조준 중인 스킬 */
  private aiming: AbilityId | null = null;
  private ghost: { x: number; y: number } | null = null;
  /** 정보 패널에 띄운 설치된 유닛 */
  private selected: Unit | null = null;
  private info!: {
    root: Phaser.GameObjects.Container;
    title: Phaser.GameObjects.Text;
    stats: Phaser.GameObjects.Text;
    upgrade: Button;
    branchA: Button;
    branchB: Button;
    sell: Button;
    target: Button;
  };

  constructor() {
    super('game');
  }

  /** data.start가 없으면(처음 열었거나 설정을 바꿀 때) 시작 화면을 띄운다 */
  create(data: { start?: boolean }): void {
    this.setup = loadSetup();
    this.endScreen = [];
    this.sim = new Game(defaultConfig(this.setup.difficulty, this.setup.endless));
    // 개발 서버에서만: 브라우저 자동 테스트가 상태를 들여다볼 수 있게 노출
    if (import.meta.env.DEV) (window as unknown as { sim: Game }).sim = this.sim;
    this.enemyEmojis.clear();
    this.unitEmojis.clear();
    this.badges.clear();
    this.flashes.clear();
    this.placing = null;
    this.aiming = null;
    this.selected = null;
    this.speed = 1;

    this.drawMap();
    this.world = this.add.graphics();
    this.overlay = this.add.graphics().setDepth(5);
    this.hud = text(this, 16, 14, '', 22);
    this.preview = text(this, 330, 18, '', 17, '#9fb3c8');
    this.diffLabel = text(this, 720, 18, '', 17, '#ffd35a').setOrigin(1, 0);
    this.muteBtn = button(this, 828, 28, 48, 40, sfx.muted ? '🔇' : '🔊', () => this.muteBtn.setText(sfx.toggleMute() ? '🔇' : '🔊'), 0x4a4f5e, 18);
    this.speedBtn = button(this, 912, 28, 104, 40, STR.speed(1), () => this.cycleSpeed(), 0x4a4f5e, 17);
    this.waveBtn = button(this, 1124, 28, 300, 40, STR.startWave, () => this.sim.apply({ type: 'startWave' }), 0x2e9e5b, 17);
    this.buildShop();
    this.buildAbilities();
    this.buildInfo();
    this.bossLabel = text(this, 520, 92, STR.bossName, 16, '#e0b0ff').setOrigin(0.5, 0).setDepth(6);
    this.toast = text(this, 520, 690, '', 18, '#ffd35a').setOrigin(0.5).setDepth(20);

    this.input.on('pointerdown', () => sfx.unlock());
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.placing || this.aiming) this.ghost = { x: p.worldX, y: p.worldY };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => this.onMapTap(p.worldX, p.worldY));
    if (!data.start) this.showDifficultyPicker();
  }

  /** 시작 화면에서 설정을 바꾸면 저장하고 시작 화면을 다시 그린다 */
  private changeSetup(patch: Partial<RunSetup>, start = false): void {
    saveSetup({ ...this.setup, ...patch });
    this.scene.restart({ start });
  }

  private showDifficultyPicker(): void {
    const { width, height } = this.sim.cfg.map;
    const layer = this.add.container(0, 0).setDepth(60);
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.75).setOrigin(0).setInteractive();
    const title = text(this, width / 2, 60, `🔌 ${STR.title}`, 34).setOrigin(0.5);
    layer.add([dim, title]);
    // 맵 선택 줄이 들어갈 자리 (MAP_ROW_Y)
    this.buildMapRow(layer);
    const sub = text(this, width / 2, 232, STR.chooseDifficulty, 18, '#9fb3c8').setOrigin(0.5);
    layer.add(sub);
    DIFFICULTY_ORDER.forEach((id, i) => {
      const d = DIFFICULTIES[id];
      const y = 290 + i * 78;
      const colors: Record<DifficultyId, number> = { easy: 0x2e9e5b, normal: 0x2f6fd6, hard: 0xc0612b, hell: 0x8a1f2a };
      const b = button(this, width / 2, y, 520, 68, '', () => this.changeSetup({ difficulty: id }, true), colors[id], 17);
      const name = STR.difficulties[id];
      b.label.setText(`${name.name}\n${name.desc}`).setAlign('center').setLineSpacing(2);
      const info = text(this, 190, 0, `${STR.bestShort(loadBest({ ...this.setup, difficulty: id }))}\n❤️${d.startHp}`, 14, '#e8eef5').setOrigin(0.5).setAlign('center');
      b.container.add(info);
      if (id === this.difficulty) b.bg.setStrokeStyle(4, 0xffd35a);
      layer.add(b.container);
    });
    const on = this.setup.endless;
    const toggle = button(this, width / 2, 640, 520, 52, '', () => this.changeSetup({ endless: !on }), on ? 0x7a3fc0 : 0x3a3e4a, 17);
    toggle.label.setText(`${STR.endlessToggle(on)}\n${STR.endlessHint}`).setAlign('center').setFontSize(15);
    if (on) toggle.bg.setStrokeStyle(3, 0xe0b0ff);
    layer.add(toggle.container);
  }

  /** 맵 선택 줄. 맵이 하나뿐이면 비워 둔다 */
  private buildMapRow(_layer: Phaser.GameObjects.Container): void {}

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.25);
    this.clock += dt;
    this.sim.update(dt * this.speed);
    for (const ev of this.sim.drainEvents()) this.playEvent(ev);
    for (const [uid, t] of this.flashes) {
      if (t - dt <= 0) this.flashes.delete(uid);
      else this.flashes.set(uid, t - dt);
    }
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
    if (this.aiming) {
      const res = this.sim.apply({ type: 'ability', id: this.aiming, x, y });
      if (res.ok) {
        this.aiming = null;
        this.ghost = null;
      }
      return;
    }
    if (this.placing) {
      const id = this.placing;
      const res = this.sim.apply({ type: 'place', unit: id, x, y });
      if (res.ok) {
        this.placing = null;
        this.ghost = null;
        sfx.play('place');
        const u = this.sim.units[this.sim.units.length - 1];
        this.popIn(u);
      } else if (res.reason in STR.placeError) {
        // 터치 환경에서는 첫 탭이 위치 미리보기 역할을 한다
        this.ghost = { x, y };
        sfx.play('error');
        this.showToast(STR.placeError[res.reason as keyof typeof STR.placeError]);
      }
      return;
    }
    const hit = this.sim.units.find((u) => Phaser.Math.Distance.Between(u.x, u.y, x, y) <= u.def.radius + 6);
    this.select(hit ?? null);
  }

  private choosePlacing(id: UnitId): void {
    this.select(null);
    this.aiming = null;
    this.placing = this.placing === id ? null : id;
    this.ghost = null;
    if (this.placing) this.showToast(STR.placeHint);
  }

  private useAbility(id: AbilityId): void {
    if (this.sim.phase === 'ready') {
      this.showToast(STR.abilityNotYet);
      sfx.play('error');
      return;
    }
    if (this.sim.cooldowns[id] > 0) {
      sfx.play('error');
      return;
    }
    if (this.sim.cfg.abilities[id].radius) {
      // 범위 스킬은 조준 모드로 들어간다
      this.select(null);
      this.placing = null;
      this.aiming = this.aiming === id ? null : id;
      this.ghost = null;
      if (this.aiming) this.showToast(STR.aimHint);
    } else {
      this.sim.apply({ type: 'ability', id });
    }
  }

  private cycleSpeed(): void {
    this.speed = SPEEDS[(SPEEDS.indexOf(this.speed) + 1) % SPEEDS.length];
    this.speedBtn.setText(STR.speed(this.speed));
  }

  private select(u: Unit | null): void {
    this.selected = u;
    if (u) {
      this.placing = null;
      this.aiming = null;
    }
  }

  private showToast(s: string): void {
    this.toast.setText(s);
    this.toastTimer = 1.6;
  }

  // ───────────────────────── UI 구성

  private buildShop(): void {
    text(this, PANEL_X + 16, 64, STR.shop, 16, '#9fb3c8');
    this.shopBtns = UNIT_ORDER.map((id, i) => {
      const def = this.sim.cfg.units[id];
      const x = PANEL_X + 64 + (i % 2) * 112;
      const y = 122 + Math.floor(i / 2) * 76;
      const btn = button(this, x, y, 104, 68, '', () => this.choosePlacing(id), 0x2a2e39, 13);
      const icon = text(this, -32, 0, def.emoji, 24).setOrigin(0.5);
      btn.label.setPosition(16, 0).setText(`${STR.units[id].name}\n💰${def.levels[0].cost}`).setAlign('center');
      btn.container.add(icon);
      return { id, btn };
    });
  }

  private buildAbilities(): void {
    this.abilityBtns = ABILITY_ORDER.map((id, i) => {
      const def = this.sim.cfg.abilities[id];
      const x = PANEL_X + 64 + i * 112;
      const y = 352;
      const btn = button(this, x, y, 104, 56, '', () => this.useAbility(id), 0x5a3d8a, 15);
      const icon = text(this, -30, 0, def.emoji, 26).setOrigin(0.5);
      btn.label.setPosition(16, 0).setText(STR.abilities[id].name);
      const shade = this.add.rectangle(-52, 28, 104, 56, 0x000000, 0.6).setOrigin(0, 1);
      const timer = text(this, 0, 0, '', 20).setOrigin(0.5);
      btn.container.add([icon, shade, timer]);
      return { id, btn, shade, timer };
    });
  }

  private buildInfo(): void {
    const x = PANEL_X + 12;
    const y = 392;
    const w = PANEL_W - 24;
    const bg = this.add.rectangle(0, 0, w, 318, 0x262a34).setOrigin(0).setStrokeStyle(1, 0xffffff, 0.12);
    const title = text(this, 12, 10, '', 20);
    const stats = text(this, 12, 44, '', 15, '#c9d2dc').setLineSpacing(4);
    const upgrade = button(this, w / 2, 204, w - 24, 38, '', () => this.upgradeSelected(), 0x2f6fd6, 16);
    const half = (w - 24) / 2 - 3;
    const branchA = button(this, 12 + half / 2, 200, half, 46, '', () => this.upgradeSelected(0), 0x8a4fd6, 14);
    const branchB = button(this, w - 12 - half / 2, 200, half, 46, '', () => this.upgradeSelected(1), 0x8a4fd6, 14);
    branchA.label.setAlign('center');
    branchB.label.setAlign('center');
    const target = button(this, w / 2, 248, w - 24, 32, '', () => this.cycleTarget(), 0x4a4f5e, 15);
    const sell = button(this, w / 2, 290, w - 24, 32, '', () => this.sellSelected(), 0xa8443d, 15);
    const root = this.add.container(x, y, [
      bg, title, stats, upgrade.container, branchA.container, branchB.container, target.container, sell.container,
    ]);
    this.info = { root, title, stats, upgrade, branchA, branchB, sell, target };
  }

  private upgradeSelected(branch?: 0 | 1): void {
    const u = this.selected;
    if (!u) return;
    if (!this.sim.apply({ type: 'upgrade', uid: u.uid, branch }).ok) {
      sfx.play('error');
      return;
    }
    sfx.play('upgrade');
    const color = branch !== undefined ? 0xc58aff : 0xffd35a;
    const ring = this.add.circle(u.x, u.y, u.def.radius, color, 0).setStrokeStyle(4, color).setDepth(8);
    this.tweens.add({ targets: ring, scale: branch !== undefined ? 3.5 : 2.4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    const label = branch !== undefined ? `${u.def.branches![branch].emoji} ${STR.branches[u.def.branches![branch].id].full}!` : STR.levelUp;
    this.floatText(u.x, u.y - 10, label, branch !== undefined ? '#e0c0ff' : '#ffd35a', 18);
    if (branch !== undefined) this.burst(u.x, u.y, color, 12, 60);
    const em = this.unitEmojis.get(u.uid);
    if (em) this.tweens.add({ targets: em, scale: 1.5, duration: 120, yoyo: true });
  }

  private cycleTarget(): void {
    const u = this.selected;
    if (!u) return;
    const next = TARGET_MODES[(TARGET_MODES.indexOf(u.target) + 1) % TARGET_MODES.length];
    this.sim.apply({ type: 'setTarget', uid: u.uid, mode: next });
  }

  private sellSelected(): void {
    const u = this.selected;
    if (!u) return;
    const value = this.sim.sellValue(u);
    this.sim.apply({ type: 'sell', uid: u.uid });
    sfx.play('sell');
    this.floatText(u.x, u.y, `+💰${value}`, '#ffd35a');
    this.burst(u.x, u.y, u.def.color, 8);
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
    // 진행 방향 표시
    g.fillStyle(0xffffff, 0.06);
    for (let d = 40; d < this.sim.path.length; d += 80) {
      const a = this.sim.path.pointAt(d);
      const b = this.sim.path.pointAt(d + 1);
      const ang = Math.atan2(b.y - a.y, b.x - a.x);
      const tri = [0, 2.5, -2.5].map((o) => ({ x: a.x + Math.cos(ang + o) * 8, y: a.y + Math.sin(ang + o) * 8 }));
      g.fillTriangle(tri[0].x, tri[0].y, tri[1].x, tri[1].y, tri[2].x, tri[2].y);
    }
    const end = pts[pts.length - 1];
    text(this, 24, pts[0].y - 52, '🕳️ 배수구', 18, '#9fb3c8');
    text(this, end.x + 10, end.y, '🔌', 46).setOrigin(0.5);
    g.fillStyle(0x1b1d24).fillRect(0, 0, map.width, map.area.y);
    g.fillStyle(0x1b1d24).fillRect(PANEL_X, map.area.y, PANEL_W, map.area.h);
  }

  private render(): void {
    const g = this.world;
    const gm = this.sim;
    const t = this.clock;
    g.clear();

    // 선택한 유닛 사거리
    const sel = this.selected;
    if (sel) {
      const r = this.sim.stats(sel).range;
      if (r > 0) g.fillStyle(0xffffff, 0.08).fillCircle(sel.x, sel.y, r).lineStyle(2, 0xffffff, 0.35).strokeCircle(sel.x, sel.y, r);
    }

    // 유닛
    const overload = gm.overloadTime > 0;
    this.syncUnits();
    syncEmojis(this, this.badges, gm.units.filter((u) => u.branch !== null).map((u) => ({
      uid: u.uid, x: u.x + u.def.radius * 0.8, y: u.y - u.def.radius * 0.8, emoji: u.def.branches![u.branch!].emoji, size: 14,
    })), 3);
    // 불 장판
    for (const z of gm.zones) {
      g.fillStyle(0xff6a1a, 0.18 + 0.08 * Math.sin(t * 20 + z.x)).fillCircle(z.x, z.y, z.r);
    }
    for (const u of gm.units) {
      g.fillStyle(u.def.color, 0.9).fillCircle(u.x, u.y, u.def.radius);
      g.lineStyle(2, u === sel ? 0xffffff : 0x000000, u === sel ? 1 : 0.4).strokeCircle(u.x, u.y, u.def.radius);
      if (u.buffMul > 1) g.lineStyle(2, 0x3fbf8f, 0.9).strokeCircle(u.x, u.y, u.def.radius + 4);
      if (overload && u.def.kind !== 'income' && u.def.kind !== 'buff') {
        g.lineStyle(3, 0xffe14a, 0.5 + 0.4 * Math.sin(t * 20)).strokeCircle(u.x, u.y, u.def.radius + 7);
      }
      for (let i = 0; i <= u.level; i++) {
        g.fillStyle(i === 3 ? 0xc58aff : 0xffd35a).fillCircle(u.x - 12 + i * 8, u.y + u.def.radius + 5, 3);
      }
      if (u.branch !== null) g.lineStyle(2, 0xc58aff, 0.9).strokeCircle(u.x, u.y, u.def.radius + 2);
    }

    // 적: 통통 튀며 움직이고, 맞으면 하얗게 깜빡인다
    const pos = (e: Enemy) => {
      const moving = e.stunTime <= 0;
      const bob = moving ? Math.abs(Math.sin(t * 9 + e.uid)) * 4 : 0;
      return { x: e.x, y: e.y - bob };
    };
    syncEmojis(this, this.enemyEmojis, gm.enemies.map((e) => ({ uid: e.uid, ...pos(e), emoji: e.def.emoji, size: e.def.radius * 1.4 })));
    for (const e of gm.enemies) {
      const p = pos(e);
      const flash = this.flashes.has(e.uid);
      g.fillStyle(0x000000, 0.25).fillEllipse(e.x, e.y + e.def.radius * 0.8, e.def.radius * 1.8, e.def.radius * 0.6);
      g.fillStyle(flash ? 0xffffff : e.def.color).fillCircle(p.x, p.y, e.def.radius);
      const em = this.enemyEmojis.get(e.uid);
      if (em) {
        if (flash) em.setTintFill(0xffffff);
        else em.clearTint();
      }
      if (e.slowMul < 1) g.lineStyle(3, 0x9fe3ff).strokeCircle(p.x, p.y, e.def.radius + 2);
      if (e.stunTime > 0 && e.frozenVuln > 1) g.fillStyle(0xbfefff, 0.45).fillCircle(p.x, p.y, e.def.radius + 3);
      if (e.hackMul > 1) g.lineStyle(2, 0x5fff9f, 0.5 + 0.5 * Math.sin(t * 25)).strokeRect(p.x - e.def.radius - 3, p.y - e.def.radius - 3, e.def.radius * 2 + 6, e.def.radius * 2 + 6);
      if (e.stunTime > 0) {
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * Math.PI * 2) / 3;
          g.fillStyle(0xffe14a).fillCircle(p.x + Math.cos(a) * e.def.radius, p.y - e.def.radius - 4 + Math.sin(a) * 4, 3);
        }
      }
      const w = Math.max(24, e.def.radius * 2);
      g.fillStyle(0x000000, 0.6).fillRect(p.x - w / 2, p.y - e.def.radius - 9, w, 4);
      g.fillStyle(0xff5a5a).fillRect(p.x - w / 2, p.y - e.def.radius - 9, (w * Math.max(0, e.hp)) / e.maxHp, 4);
    }

    // 보스 체력바
    const o = this.overlay;
    o.clear();
    const boss = gm.enemies.find((e) => e.def.boss);
    this.bossLabel.setVisible(!!boss);
    if (boss) {
      o.fillStyle(0x000000, 0.6).fillRect(320, 66, 400, 14);
      o.fillStyle(0xb04ae0).fillRect(320, 66, (400 * Math.max(0, boss.hp)) / boss.maxHp, 14);
      o.lineStyle(1, 0xffffff, 0.5).strokeRect(320, 66, 400, 14);
    }

    // 설치 / 조준 미리보기
    if (this.placing && this.ghost) {
      const def = gm.cfg.units[this.placing];
      const ok = gm.canPlace(this.placing, this.ghost.x, this.ghost.y) === null;
      const r = def.levels[0].range;
      if (r > 0) o.fillStyle(ok ? 0xffffff : 0xff4040, 0.08).fillCircle(this.ghost.x, this.ghost.y, r);
      o.fillStyle(ok ? 0x6fe07a : 0xff4040, 0.6).fillCircle(this.ghost.x, this.ghost.y, def.radius);
    }
    if (this.aiming && this.ghost) {
      const r = gm.cfg.abilities[this.aiming].radius ?? 0;
      o.fillStyle(0xb04ae0, 0.15).fillCircle(this.ghost.x, this.ghost.y, r);
      o.lineStyle(3, 0xe0b0ff, 0.6 + 0.3 * Math.sin(t * 10)).strokeCircle(this.ghost.x, this.ghost.y, r);
    }

    // HUD
    const waveText = gm.endless ? STR.waveEndless(gm.wave) : STR.wave(gm.wave, gm.totalWaves);
    this.hud.setText(`${STR.hp} ${gm.hp}   ${STR.money} ${gm.money}   ${waveText}`);
    this.diffLabel.setText(`${STR.difficulties[this.difficulty].name}${gm.endless ? ' ♾️' : ''}`);
    const next = gm.wavePreview(gm.wave + 1);
    this.preview.setText(next.length ? `${STR.preview} ${next.map((n) => `${gm.cfg.enemies[n.id].emoji}×${n.count}`).join(' ')}` : '');
    this.waveBtn.setEnabled(gm.phase === 'ready' || gm.phase === 'intermission');
    this.waveBtn.setText(
      gm.phase === 'intermission' ? STR.nextWave(Math.ceil(gm.timer), gm.earlyBonus)
        : gm.phase === 'ready' ? STR.startWave : STR.waveRunning,
    );
    if (gm.phase === 'ready' || gm.phase === 'intermission') {
      this.waveBtn.container.setScale(1 + 0.03 * Math.sin(t * 6));
    } else {
      this.waveBtn.container.setScale(1);
    }
    for (const { id, btn } of this.shopBtns) {
      const def = gm.cfg.units[id];
      btn.setEnabled(gm.money >= def.levels[0].cost);
      btn.bg.setStrokeStyle(this.placing === id ? 3 : 2, this.placing === id ? 0xffd35a : 0xffffff, this.placing === id ? 1 : 0.25);
    }
    for (const a of this.abilityBtns) {
      const cd = gm.cooldowns[a.id];
      const ratio = cd / gm.cfg.abilities[a.id].cooldown;
      a.shade.setScale(1, ratio).setVisible(cd > 0);
      a.timer.setText(cd > 0 ? String(Math.ceil(cd)) : '');
      a.btn.label.setVisible(cd <= 0);
      a.btn.setEnabled(gm.phase !== 'ready' && !gm.finished);
      const ready = cd <= 0 && gm.phase === 'wave';
      a.btn.bg.setStrokeStyle(this.aiming === a.id || ready ? 3 : 2, this.aiming === a.id ? 0xffffff : ready ? 0xe0b0ff : 0xffffff, ready ? 0.6 + 0.4 * Math.sin(t * 6) : 0.25);
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
    const lv = u ? this.sim.stats(u) : def.levels[0];
    const name = STR.units[id];
    const br = u && u.branch !== null ? def.branches![u.branch] : null;
    const title = br ? `${br.emoji} ${STR.branches[br.id].full}` : `${def.emoji} ${name.name}`;
    this.info.title.setText(`${title}${u ? `  ${STR.level(level + 1)}` : ''}`);
    const s = STR.stats;
    const opts = u ? this.sim.upgradeOptions(u) : [];
    const atFork = opts.length === 2;
    // 갈림길에서는 설명과 스탯 대신 두 갈래 설명만 보여 준다 (패널 공간이 좁다)
    const lines = atFork ? [] : [br ? STR.branches[br.id].desc : name.desc, ''];
    if (atFork) {
      lines.push(STR.branchPrompt);
      for (const b of def.branches!) lines.push(`${b.emoji} ${STR.branches[b.id].name}: ${STR.branches[b.id].desc}`);
    }
    if (!atFork && lv.damage) lines.push(`${s.damage} ${lv.damage}`);
    if (!atFork) {
      if (lv.cooldown) lines.push(`${s.rate} ${lv.cooldown}초`);
      if (lv.range) lines.push(`${s.range} ${lv.range}`);
      if (lv.splash) lines.push(`${s.splash} ${lv.splash}`);
      if (lv.slow) lines.push(`${s.slow} ${Math.round((1 - lv.slow) * 100)}%`);
      if (lv.buff) lines.push(`${s.buff} ${Math.round(lv.buff * 100)}%`);
      if (lv.income) lines.push(`${s.income} 💰${lv.income}`);
    }
    this.info.stats.setText(lines.join('\n')).setWordWrapWidth(PANEL_W - 48, true);
    const showControls = u !== null;
    this.info.upgrade.container.setVisible(showControls && !atFork);
    this.info.branchA.container.setVisible(showControls && atFork);
    this.info.branchB.container.setVisible(showControls && atFork);
    this.info.sell.container.setVisible(showControls);
    const attacks = def.kind === 'single' || def.kind === 'splash';
    this.info.target.container.setVisible(showControls && attacks);
    if (!u) return;
    if (atFork) {
      [this.info.branchA, this.info.branchB].forEach((b, i) => {
        const bd = def.branches![i];
        b.setText(STR.branchButton(bd.emoji, STR.branches[bd.id].name, bd.cost));
        b.setEnabled(this.sim.money >= bd.cost);
      });
    } else {
      const cost = opts[0]?.cost ?? null;
      this.info.upgrade.setText(cost === null ? STR.maxLevel : STR.upgrade(cost));
      this.info.upgrade.setEnabled(cost !== null && this.sim.money >= cost);
    }
    this.info.sell.setText(STR.sell(this.sim.sellValue(u)));
    this.info.target.setText(STR.target(u.target));
  }

  // ───────────────────────── 이펙트

  private playEvent(ev: GameEvent): void {
    switch (ev.type) {
      case 'shot': {
        this.recoil(ev.unit);
        const style = ev.branch ? BRANCH_SHOT[ev.branch] : undefined;
        const emoji = ev.branch ? undefined : PROJECTILE_EMOJI[ev.kind];
        if (style) {
          const line = this.add.line(0, 0, ev.from.x, ev.from.y, ev.to.x, ev.to.y, style.color, 0.95).setOrigin(0).setLineWidth(style.width).setDepth(7);
          this.tweens.add({ targets: line, alpha: 0, duration: style.fade, onComplete: () => line.destroy() });
          sfx.play(style.sound);
          break;
        } else if (emoji) {
          const dur = (Phaser.Math.Distance.Between(ev.from.x, ev.from.y, ev.to.x, ev.to.y) / PROJECTILE_SPEED) * 1000;
          const p = text(this, ev.from.x, ev.from.y, emoji, 18).setOrigin(0.5).setDepth(7);
          this.tweens.add({ targets: p, x: ev.to.x, y: ev.to.y, angle: 360, duration: dur, onComplete: () => p.destroy() });
        } else {
          const line = this.add.line(0, 0, ev.from.x, ev.from.y, ev.to.x, ev.to.y, ev.color, 0.9).setOrigin(0).setLineWidth(3).setDepth(7);
          this.tweens.add({ targets: line, alpha: 0, duration: 90, onComplete: () => line.destroy() });
        }
        sfx.play(ev.kind === 'vacuum' ? 'vacuum' : 'shoot');
        break;
      }
      case 'blast': {
        const c = this.add.circle(ev.x, ev.y, ev.r, 0xffa040, 0.55).setDepth(6);
        this.tweens.add({ targets: c, alpha: 0, scale: 1.2, duration: 280, onComplete: () => c.destroy() });
        sfx.play('blast');
        break;
      }
      case 'pulse': {
        this.recoil(ev.unit);
        const color = ev.branch === 'frost' ? 0xdff8ff : ev.branch === 'typhoon' ? 0xb0e0ff : ev.color;
        const c = this.add.circle(ev.x, ev.y, ev.r, color, ev.branch === 'frost' ? 0.15 : 0).setStrokeStyle(ev.branch ? 5 : 3, color, 0.7).setScale(0.3).setDepth(6);
        this.tweens.add({ targets: c, alpha: 0, scale: 1, duration: 350, onComplete: () => c.destroy() });
        sfx.play('pulse');
        break;
      }
      case 'hit':
        this.flashes.set(ev.enemy, 0.07);
        if (ev.crit) {
          const t = text(this, ev.x, ev.y - 16, STR.crit(ev.amount), 22, '#ffe14a').setOrigin(0.5).setDepth(12).setStroke('#7a2a00', 4).setScale(0.4);
          this.tweens.add({ targets: t, scale: 1.1, duration: 120, ease: 'Back.easeOut' });
          this.tweens.add({ targets: t, y: ev.y - 50, alpha: 0, delay: 250, duration: 450, onComplete: () => t.destroy() });
          sfx.play('crit');
        } else {
          sfx.play('hit');
        }
        break;
      case 'kill':
        this.burst(ev.x, ev.y, 0x9fe36a, 7);
        this.floatText(ev.x, ev.y, `+${ev.reward}`, '#ffd35a');
        sfx.play('pop');
        break;
      case 'leak': {
        this.floatText(ev.x, ev.y, `-${ev.damage}`, '#ff5a5a', 24);
        this.cameras.main.shake(200, Math.min(0.02, 0.004 + ev.damage / 20000));
        const { width, height } = this.sim.cfg.map;
        const red = this.add.rectangle(0, 0, width, height, 0xff0000, 0.25).setOrigin(0).setDepth(40);
        this.tweens.add({ targets: red, alpha: 0, duration: 400, onComplete: () => red.destroy() });
        sfx.play('leak');
        break;
      }
      case 'income':
        this.floatText(ev.x, ev.y, `+💰${ev.amount}`, '#ffd35a', 20);
        sfx.play('coin');
        break;
      case 'ability':
        if (ev.id === 'plunger') this.plungerFx(ev.x, ev.y, ev.r);
        else {
          sfx.play('overload');
          this.cameras.main.flash(250, 255, 230, 80);
        }
        break;
      case 'waveStart':
        this.banner(ev.boss ? STR.bossBanner : STR.waveBanner(ev.wave), ev.boss ? '#ff6b6b' : '#ffffff');
        if (ev.boss) {
          this.cameras.main.shake(800, 0.006);
          sfx.play('boss');
        } else sfx.play('wave');
        break;
      case 'waveCleared':
        this.banner(STR.clearBanner(ev.bonus), '#ffd35a', 0.8);
        sfx.play('clear');
        break;
      case 'earlyBonus':
        this.showToast(STR.earlyBonus(ev.amount));
        sfx.play('coin');
        break;
      case 'gameOver':
      case 'victory':
        sfx.play(ev.type === 'victory' ? 'win' : 'lose');
        this.showEndScreen(ev.type === 'victory');
        break;
    }
  }

  /** 발사한 가전이 움찔하는 반동 */
  private recoil(uid: number): void {
    const em = this.unitEmojis.get(uid);
    if (!em || this.tweens.isTweening(em)) return;
    this.tweens.add({ targets: em, scale: 1.3, duration: 50, yoyo: true });
  }

  private syncUnits(): void {
    syncEmojis(this, this.unitEmojis, this.sim.units.map((u) => ({ uid: u.uid, x: u.x, y: u.y, emoji: u.def.emoji, size: u.def.radius * 1.3 })));
  }

  private popIn(u: Unit | undefined): void {
    if (!u) return;
    this.burst(u.x, u.y, 0xffffff, 6);
    this.syncUnits();
    const em = this.unitEmojis.get(u.uid);
    if (em) this.tweens.add({ targets: em, scale: { from: 0.2, to: 1 }, duration: 260, ease: 'Back.easeOut' });
  }

  private plungerFx(x: number, y: number, r: number): void {
    const p = text(this, x, y - 220, '🪠', 64).setOrigin(0.5, 1).setDepth(30);
    this.tweens.add({
      targets: p, y, duration: 160, ease: 'Quad.easeIn',
      onComplete: () => {
        sfx.play('plunger');
        this.cameras.main.shake(220, 0.012);
        const ring = this.add.circle(x, y, r, 0xb04ae0, 0.35).setStrokeStyle(5, 0xe0b0ff).setScale(0.2).setDepth(29);
        this.tweens.add({ targets: ring, scale: 1, alpha: 0, duration: 380, onComplete: () => ring.destroy() });
        this.burst(x, y, 0x8a6a4a, 14, 120);
        this.tweens.add({ targets: p, alpha: 0, y: y - 30, delay: 150, duration: 250, onComplete: () => p.destroy() });
      },
    });
  }

  /** 작은 입자가 사방으로 튀는 효과 */
  private burst(x: number, y: number, color: number, n: number, dist = 40): void {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = dist * (0.6 + Math.random() * 0.6);
      const c = this.add.circle(x, y, 3 + Math.random() * 3, color).setDepth(9);
      this.tweens.add({ targets: c, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.3, duration: 350 + Math.random() * 150, ease: 'Quad.easeOut', onComplete: () => c.destroy() });
    }
  }

  private banner(s: string, color: string, hold = 1): void {
    const t = text(this, -300, 300, s, 46, color).setOrigin(0.5).setDepth(45).setStroke('#000000', 6);
    this.tweens.chain({
      targets: t,
      tweens: [
        { x: 520, duration: 260, ease: 'Back.easeOut' },
        { x: 540, duration: hold * 700 },
        { x: 1400, alpha: 0, duration: 260, ease: 'Quad.easeIn' },
      ],
      onComplete: () => t.destroy(),
    });
  }

  private floatText(x: number, y: number, s: string, color: string, size = 16): void {
    const t = text(this, x, y - 10, s, size, color).setOrigin(0.5).setDepth(10).setStroke('#000000', 3);
    this.tweens.add({ targets: t, y: y - 45, alpha: 0, duration: 750, onComplete: () => t.destroy() });
  }

  private continueEndless(): void {
    if (!this.sim.apply({ type: 'continueEndless' }).ok) return;
    for (const ob of this.endScreen) ob.destroy();
    this.endScreen = [];
    this.banner(STR.continueEndless, '#e0b0ff');
    sfx.play('wave');
  }

  private showEndScreen(won: boolean): void {
    this.placing = null;
    this.aiming = null;
    this.selected = null;
    const reached = this.sim.wave;
    const run: RunSetup = { ...this.setup, endless: this.sim.endless };
    const isNew = saveBest(run, reached);
    const { width, height } = this.sim.cfg.map;
    const dim = this.add.rectangle(0, 0, width, height, 0x000000, 0.65).setOrigin(0).setInteractive();
    const canContinue = won && !!this.sim.cfg.extraWave;
    const boxH = canContinue ? 400 : 320;
    const top = height / 2 - boxH / 2;
    const box = this.add.rectangle(width / 2, height / 2, 540, boxH, 0x23262e).setStrokeStyle(2, won ? 0xffd35a : 0xff5a5a);
    const title = text(this, width / 2, top + 60, won ? `🏆 ${STR.victory}` : `💥 ${STR.gameOver}`, 34).setOrigin(0.5);
    const lines = [
      `${STR.difficulties[this.difficulty].name}${run.endless ? ' ♾️' : ''}`, STR.reachedWave(reached), STR.best(loadBest(run)),
    ];
    if (isNew) lines.push(STR.newBest);
    const body = text(this, width / 2, top + 155, lines.join('\n'), 20, '#c9d2dc').setOrigin(0.5).setAlign('center').setLineSpacing(6);
    const again = button(this, width / 2 - 120, top + 265, 220, 50, STR.restart, () => this.scene.restart({ start: true }), 0x2e9e5b, 20);
    const change = button(this, width / 2 + 120, top + 265, 220, 50, STR.changeDifficulty, () => this.scene.restart({}), 0x4a4f5e, 20);
    this.endScreen = [dim, box, title, body, again.container, change.container];
    // 20웨이브를 이기면 그대로 무한 모드로 이어갈 수 있다
    if (canContinue) {
      const cont = button(this, width / 2, top + 340, 460, 50, STR.continueEndless, () => this.continueEndless(), 0x7a3fc0, 20);
      this.endScreen.push(cont.container);
    }
    for (const ob of this.endScreen) (ob as unknown as { setDepth(d: number): void }).setDepth(50);
    box.setScale(0.6);
    this.tweens.add({ targets: box, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }
}

function syncEmojis(
  scene: Phaser.Scene,
  pool: Map<number, Phaser.GameObjects.Text>,
  items: { uid: number; x: number; y: number; emoji: string; size: number }[],
  depth = 2,
): void {
  const alive = new Set<number>();
  for (const it of items) {
    alive.add(it.uid);
    let t = pool.get(it.uid);
    if (!t) {
      t = text(scene, 0, 0, it.emoji, it.size).setOrigin(0.5).setDepth(depth);
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
