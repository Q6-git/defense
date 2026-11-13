import Phaser from 'phaser';
import { defaultConfig } from '../config';
import { Game, type GameEvent } from '../core/game';
import { TARGET_MODES, type AbilityId, type DifficultyId, type Enemy, type Unit, type UnitId } from '../core/types';
import { ABILITY_ORDER } from '../data/abilities';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty';
import { MAP_ORDER, type MapId } from '../data/map';
import { UNIT_ORDER } from '../data/units';
import { sfx, type SoundId } from '../sfx';
import { ACHIEVEMENTS, evaluate, type Progress, type RunStats } from '../achievements';
import { loadBest, loadProgress, loadSetup, saveBest, saveProgress, saveSetup, type RunSetup } from '../storage';
import { STR } from '../strings.ko';
import { spriteUrls } from '../spriteLoader';
import { OBSTACLE_SPRITE } from '../sprites';
import { drawRange, Fx } from './fx';
import { baseScale, button, card, icon, RoundBox, text, THEME, type Button, type Icon } from './ui';

const PANEL_X = 1040;
const PANEL_W = 240;
const SPEEDS = [1, 2, 3];
/** 투사체가 날아가는 속도(px/초). 피해는 즉시 들어가므로 너무 느리면 어색하다. */
const PROJECTILE_SPEED = 1400;
const PROJECTILE: Partial<Record<UnitId, { key: string; emoji: string }>> = {
  toaster: { key: 'proj_toast', emoji: '🍞' },
  microwave: { key: 'proj_fire', emoji: '🔥' },
};
/** 레벨별 가전 크기 배율 (Lv1~Lv4) */
const LEVEL_SCALE = [1, 1.07, 1.14, 1.22];
/** 그림이 왼쪽을 보고 있는 적 (오른쪽으로 갈 때 뒤집는다) */
const FACES_LEFT = new Set(['rat']);

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** 갈래별 공격 모양: 빠른 공격은 투사체 대신 빛나는 탄도로 그린다 */
const BRANCH_SHOT: Record<string, { color: number; width: number; fade: number; sound: SoundId; big: boolean }> = {
  rapid: { color: 0xffc94d, width: 2, fade: 70, sound: 'shoot', big: false },
  sniper: { color: 0xffffff, width: 4, fade: 240, sound: 'snipe', big: true },
  crusher: { color: 0x9aa0b4, width: 5, fade: 120, sound: 'blast', big: true },
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
  private enemyEmojis = new Map<number, Icon>();
  private unitEmojis = new Map<number, Icon>();
  /** 갈림길을 고른 가전 위의 작은 배지 */
  private badges = new Map<number, Icon>();
  private fx!: Fx;
  /** 업적: 판을 넘어 쌓이는 진행 상황과 이번 판 기록 */
  private progress: Progress = loadProgress();
  private run!: RunStats;
  /** 지금 떠 있는 업적 알림 수 (겹치지 않게 아래로 쌓는다) */
  private popups = 0;
  /** 설치 미리보기로 반투명하게 보여 주는 가전 그림 */
  private ghostIcon: { id: UnitId; icon: Icon } | null = null;
  /** 순간 크기 변화(반동·피격·업그레이드). 1이 기본이고 매 프레임 1로 돌아간다. 유닛·적 uid는 겹치지 않는다 */
  private punch = new Map<number, number>();
  /** 가전이 설치된 시각 (튀어나오는 연출) */
  private born = new Map<number, number>();
  /** 적이 바라보는 방향을 정하려고 지난 프레임 x를 기억한다 */
  private lastX = new Map<number, number>();
  /** 갈래 배지 바탕 원 */
  private chipG!: Phaser.GameObjects.Graphics;
  /** 맞은 적을 잠깐 물들이는 남은 시간 */
  private flashes = new Map<number, number>();
  private hpText!: Phaser.GameObjects.Text;
  private moneyText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;
  private diffLabel!: Phaser.GameObjects.Text;
  /** 진행 중인 특수 웨이브 안내 */
  private modLabel!: Phaser.GameObjects.Text;
  private preview!: Phaser.GameObjects.Text;
  private waveBtn!: Button;
  private speedBtn!: Button;
  private muteBtn!: Button;
  private pauseBtn!: Button;
  /** 일시정지 중이면 일시정지 화면의 오브젝트들 */
  private pauseLayer: Phaser.GameObjects.Container | null = null;
  /** 시작 화면(맵·난이도 선택)이 떠 있는지 */
  private picking = false;
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

  preload(): void {
    // 검사를 통과한 그림만 불러온다. 못 불러온 그림은 이모지로 그려진다
    for (const [key, url] of Object.entries(spriteUrls)) {
      if (!this.textures.exists(key)) this.load.image(key, url);
    }
  }

  /** data.start가 없으면(처음 열었거나 설정을 바꿀 때) 시작 화면을 띄운다 */
  create(data: { start?: boolean }): void {
    this.setup = loadSetup();
    this.endScreen = [];
    this.sim = new Game(defaultConfig(this.setup.difficulty, this.setup.endless, this.setup.map as MapId));
    // 개발 서버에서만: 브라우저 자동 테스트가 상태를 들여다볼 수 있게 노출
    if (import.meta.env.DEV) (window as unknown as { sim: Game }).sim = this.sim;
    this.enemyEmojis.clear();
    this.unitEmojis.clear();
    this.badges.clear();
    this.flashes.clear();
    this.punch.clear();
    this.born.clear();
    this.lastX.clear();
    this.placing = null;
    this.aiming = null;
    this.selected = null;
    this.speed = 1;

    this.drawMap();
    this.world = this.add.graphics();
    this.overlay = this.add.graphics().setDepth(5);
    this.fx = new Fx(this);
    this.ghostIcon = null;
    this.chipG = this.add.graphics().setDepth(2.5);
    const chip = (x: number, w: number) => {
      new RoundBox(this, x, 10, w, 36, THEME.white, 18, 0, 'topleft').setStrokeStyle(2, THEME.cardLine);
      return text(this, x + w / 2, 28, '', 20).setOrigin(0.5);
    };
    this.hpText = chip(12, 110);
    this.moneyText = chip(130, 140);
    this.waveText = chip(278, 118);
    this.preview = text(this, 408, 18, '', 15, THEME.textSoft);
    // 맵·난이도 표시는 맵 오른쪽 위 구석에 (상단 바는 다음 웨이브 미리보기가 쓴다)
    this.diffLabel = text(this, PANEL_X - 12, 64, '', 15, THEME.gold).setOrigin(1, 0).setStroke('#ffffff', 4).setDepth(4);
    this.modLabel = text(this, 520, 64, '', 17, THEME.danger).setOrigin(0.5, 0).setStroke('#ffffff', 5).setDepth(6);
    this.pauseLayer = null;
    this.picking = false;
    this.progress = loadProgress();
    this.run = {
      map: this.setup.map, difficulty: this.setup.difficulty, endless: this.setup.endless,
      cleared: 0, placed: [], usedSkill: false, leaked: false, cards: 0,
    };
    this.popups = 0;
    this.pauseBtn = button(this, 772, 28, 48, 40, '⏸️', () => this.setPaused(true), THEME.neutral, 18);
    this.muteBtn = button(this, 828, 28, 48, 40, sfx.muted ? '🔇' : '🔊', () => this.muteBtn.setText(sfx.toggleMute() ? '🔇' : '🔊'), THEME.neutral, 18);
    this.speedBtn = button(this, 912, 28, 104, 40, STR.speed(1), () => this.cycleSpeed(), THEME.neutral, 17);
    this.waveBtn = button(this, 1124, 28, 300, 40, STR.startWave, () => this.sim.apply({ type: 'startWave' }), THEME.green, 18);
    this.buildShop();
    this.buildAbilities();
    this.buildInfo();
    this.bossLabel = text(this, 520, 92, STR.bossName, 16, THEME.pink).setOrigin(0.5, 0).setDepth(6).setStroke('#ffffff', 4);
    this.toast = text(this, 520, 690, '', 19, THEME.text).setOrigin(0.5).setDepth(20).setStroke('#ffffff', 5);

    this.input.on('pointerdown', () => sfx.unlock());
    // Esc / P 로 일시정지, 탭을 벗어나거나 화면이 꺼지면 자동 일시정지
    const onKey = () => this.setPaused(!this.pauseLayer);
    this.input.keyboard?.on('keydown-ESC', onKey);
    this.input.keyboard?.on('keydown-P', onKey);
    const onHidden = () => this.setPaused(true);
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden));
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
    this.picking = true;
    const { width, height } = this.sim.cfg.map;
    const layer = this.add.container(0, 0).setDepth(60);
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.55).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 640, 700, 'center', THEME.bar);
    const title = text(this, width / 2, 58, `🔌 ${STR.title}`, 36).setOrigin(0.5);
    layer.add([dim, box, title]);
    const ach = button(this, 1120, 60, 230, 52, STR.achButton(this.progress.done.length, ACHIEVEMENTS.length), () => this.showAchievements(), THEME.yellow, 19);
    layer.add(ach.container);
    // 맵 선택 줄이 들어갈 자리 (MAP_ROW_Y)
    this.buildMapRow(layer);
    const sub = text(this, width / 2, 232, STR.chooseDifficulty, 18, THEME.textSoft).setOrigin(0.5);
    layer.add(sub);
    DIFFICULTY_ORDER.forEach((id, i) => {
      const d = DIFFICULTIES[id];
      const y = 290 + i * 78;
      const colors: Record<DifficultyId, number> = { easy: THEME.green, normal: THEME.blue, hard: THEME.orange, hell: 0xc8445a };
      const b = button(this, width / 2, y, 520, 68, '', () => this.changeSetup({ difficulty: id }, true), colors[id], 17);
      const name = STR.difficulties[id];
      b.label.setText(`${name.name}\n${name.desc}`).setAlign('center').setLineSpacing(2);
      const info = text(this, 190, 0, `${STR.bestShort(loadBest({ ...this.setup, difficulty: id }))}\n❤️${d.startHp}`, 14, THEME.textOnDark).setOrigin(0.5).setAlign('center');
      b.container.add(info);
      if (id === this.difficulty) b.bg.setStrokeStyle(4, THEME.selected);
      layer.add(b.container);
    });
    const on = this.setup.endless;
    const toggle = button(this, width / 2, 640, 520, 52, '', () => this.changeSetup({ endless: !on }), on ? THEME.purple : THEME.neutral, 17);
    toggle.label.setText(`${STR.endlessToggle(on)}\n${STR.endlessHint}`).setAlign('center').setFontSize(15);
    if (on) toggle.bg.setStrokeStyle(3, THEME.selected);
    layer.add(toggle.container);
  }

  /** 맵 선택 줄 */
  private buildMapRow(layer: Phaser.GameObjects.Container): void {
    const { width } = this.sim.cfg.map;
    layer.add(text(this, width / 2, 108, STR.chooseMap, 18, THEME.textSoft).setOrigin(0.5));
    MAP_ORDER.forEach((id, i) => {
      const x = width / 2 + (i - 1) * 176;
      const b = button(this, x, 160, 166, 66, '', () => this.changeSetup({ map: id }), id === this.setup.map ? 0xfff0c8 : THEME.white, 16);
      const m = STR.maps[id];
      b.label.setText(`${m.name}\n${m.desc}`).setAlign('center').setFontSize(15).setLineSpacing(2);
      b.bg.setStrokeStyle(id === this.setup.map ? 4 : 2, id === this.setup.map ? THEME.selected : THEME.cardLine);
      layer.add(b.container);
    });
  }

  update(_t: number, deltaMs: number): void {
    if (this.pauseLayer) return;
    const dt = Math.min(deltaMs / 1000, 0.25);
    this.clock += dt;
    this.sim.update(dt * this.speed);
    for (const ev of this.sim.drainEvents()) this.playEvent(ev);
    for (const [uid, v] of this.punch) {
      const next = 1 + (v - 1) * Math.exp(-dt * 16);
      if (Math.abs(next - 1) < 0.005) this.punch.delete(uid);
      else this.punch.set(uid, next);
    }
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
    if (this.pauseLayer || this.sim.offer || this.sim.finished || x >= area.x + area.w || y < area.y) return; // 패널/상단 바는 버튼이 처리
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
        if (!this.run.placed.includes(id)) this.run.placed.push(id);
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
    if (this.sim.offer) return;
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
    text(this, PANEL_X + 16, 66, STR.shop, 16, THEME.textSoft);
    this.shopBtns = UNIT_ORDER.map((id, i) => {
      const def = this.sim.cfg.units[id];
      const x = PANEL_X + 64 + (i % 2) * 112;
      const y = 122 + Math.floor(i / 2) * 76;
      const btn = button(this, x, y, 104, 68, '', () => this.choosePlacing(id), THEME.white, 14);
      const ic = icon(this, -33, 0, id, def.emoji, 36);
      btn.label.setPosition(18, 0).setText(`${STR.units[id].name}\n💰${def.levels[0].cost}`).setAlign('center');
      btn.container.add(ic);
      return { id, btn };
    });
  }

  private buildAbilities(): void {
    this.abilityBtns = ABILITY_ORDER.map((id, i) => {
      const def = this.sim.cfg.abilities[id];
      const x = PANEL_X + 64 + i * 112;
      const y = 352;
      const btn = button(this, x, y, 104, 56, '', () => this.useAbility(id), THEME.purple, 16);
      const ic = icon(this, -30, 0, `ab_${id}`, def.emoji, 40);
      btn.label.setPosition(16, 0).setText(STR.abilities[id].name);
      const shade = this.add.rectangle(-52, 24, 104, 52, 0x2b2230, 0.55).setOrigin(0, 1);
      const timer = text(this, 0, -2, '', 22, THEME.textOnDark).setOrigin(0.5);
      btn.container.add([ic, shade, timer]);
      return { id, btn, shade, timer };
    });
  }

  private buildInfo(): void {
    const x = PANEL_X + 12;
    const y = 392;
    const w = PANEL_W - 24;
    const bg = card(this, 0, 0, w, 318);
    const title = text(this, 12, 10, '', 20);
    const stats = text(this, 12, 44, '', 15, THEME.text).setLineSpacing(4);
    const upgrade = button(this, w / 2, 204, w - 24, 40, '', () => this.upgradeSelected(), THEME.blue, 17);
    const half = (w - 24) / 2 - 3;
    const branchA = button(this, 12 + half / 2, 200, half, 46, '', () => this.upgradeSelected(0), THEME.purple, 15);
    const branchB = button(this, w - 12 - half / 2, 200, half, 46, '', () => this.upgradeSelected(1), THEME.purple, 15);
    branchA.label.setAlign('center');
    branchB.label.setAlign('center');
    const target = button(this, w / 2, 248, w - 24, 32, '', () => this.cycleTarget(), THEME.neutral, 15);
    const sell = button(this, w / 2, 290, w - 24, 32, '', () => this.sellSelected(), THEME.red, 15);
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
    if (branch !== undefined) {
      const bid = u.def.branches![branch].id;
      if (!this.progress.branches.includes(bid)) this.progress.branches.push(bid);
      this.checkAchievements();
    }
    const label = branch !== undefined ? `${u.def.branches![branch].emoji} ${STR.branches[u.def.branches![branch].id].full}!` : STR.levelUp;
    this.floatText(u.x, u.y - 10, label, branch !== undefined ? THEME.pink : THEME.gold, 18);
    if (branch !== undefined) this.burst(u.x, u.y, color, 12, 60);
    this.punch.set(u.uid, 1.5);
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
    this.floatText(u.x, u.y, `+💰${value}`, THEME.gold);
    this.burst(u.x, u.y, u.def.color, 8);
    this.selected = null;
  }

  // ───────────────────────── 그리기

  private drawMap(): void {
    const { map } = this.sim.cfg;
    const g = this.add.graphics();
    drawFloor(g, map.id, map.area);
    // 장애물
    for (const b of map.blocked ?? []) {
      g.fillStyle(0x7a5a3a, 0.1).fillRoundedRect(b.x, b.y + 4, b.w, b.h, 12);
      g.fillStyle(0xffffff, 0.55).fillRoundedRect(b.x, b.y, b.w, b.h, 12);
      g.lineStyle(2, 0x7a5a3a, 0.25).strokeRoundedRect(b.x, b.y, b.w, b.h, 12);
      // 상자 안에 그림을 고르게 채운다
      const size = Math.min(b.w, b.h) * 0.62;
      const n = Math.max(1, Math.floor(b.w / (size * 1.25)));
      for (let i = 0; i < n; i++) {
        icon(this, b.x + (b.w * (i + 0.5)) / n, b.y + b.h / 2, OBSTACLE_SPRITE[b.emoji], b.emoji, size * 1.3);
      }
    }
    // 배수관: 그림자 → 테두리 → 몸통 → 하이라이트 순서로, 길마다 같은 단계를 먼저 다 그려야 합류 지점이 깔끔하다
    const hw = map.pathHalfWidth;
    const lines = map.paths.map((path) => path.map((p) => new Phaser.Math.Vector2(p.x, p.y)));
    const layer = (width: number, color: number, alpha: number, dy = 0) => {
      for (const pts of lines) {
        const shifted = pts.map((p) => new Phaser.Math.Vector2(p.x, p.y + dy));
        g.lineStyle(width, color, alpha).strokePoints(shifted);
        for (const p of shifted) g.fillStyle(color, alpha).fillCircle(p.x, p.y, width / 2);
      }
    };
    layer(hw * 2 + 10, 0x7a5a3a, 0.15, 6);
    layer(hw * 2 + 8, 0x7fa7bf, 1);
    layer(hw * 2, 0xcfe7f3, 1);
    layer(hw * 0.7, 0xeaf6fc, 0.9, -hw * 0.35);
    // 진행 방향 표시
    g.fillStyle(0x7fa7bf, 0.45);
    for (const path of this.sim.paths) {
      for (let d = 40; d < path.length; d += 80) {
        const a = path.pointAt(d);
        const b = path.pointAt(d + 1);
        const ang = Math.atan2(b.y - a.y, b.x - a.x);
        const tri = [0, 2.5, -2.5].map((o) => ({ x: a.x + Math.cos(ang + o) * 7, y: a.y + Math.sin(ang + o) * 7 }));
        g.fillTriangle(tri[0].x, tri[0].y, tri[1].x, tri[1].y, tri[2].x, tri[2].y);
      }
    }
    for (const pts of lines) {
      icon(this, 26, pts[0].y, 'drain', '🕳️', 50).setDepth(1);
      text(this, 56, pts[0].y - 50, STR.drain, 16, THEME.textSoft).setStroke('#ffffff', 4);
    }
    const end = lines[0][lines[0].length - 1];
    icon(this, end.x + 6, end.y, 'outlet', '🔌', 60).setDepth(1);
    // 상단 바와 우측 패널
    g.fillStyle(THEME.bar).fillRect(0, 0, map.width, map.area.y);
    g.fillStyle(THEME.barLine).fillRect(0, map.area.y - 3, map.width, 3);
    g.fillStyle(THEME.bar).fillRect(PANEL_X, map.area.y, PANEL_W, map.area.h);
    g.fillStyle(THEME.barLine).fillRect(PANEL_X, map.area.y, 3, map.area.h);
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
      if (r > 0) drawRange(g, sel.x, sel.y, r, 0x3d8fd6, t);
    }

    // 유닛
    const overload = gm.overloadTime > 0;
    this.syncUnits();
    const badgeAt = (u: Unit) => ({ x: u.x + u.def.radius * 1.05, y: u.y - u.def.radius * 1.05 });
    syncEmojis(this, this.badges, gm.units.filter((u) => u.branch !== null).map((u) => ({
      uid: u.uid, ...badgeAt(u), emoji: u.def.branches![u.branch!].emoji, size: 26,
    })), 3);
    this.chipG.clear();
    for (const u of gm.units) {
      if (u.branch === null) continue;
      const b = badgeAt(u);
      this.chipG.fillStyle(0xffffff).fillCircle(b.x, b.y, 11).lineStyle(2, 0xa57be0).strokeCircle(b.x, b.y, 11);
    }
    // 불 장판
    for (const z of gm.zones) {
      g.fillStyle(0xff6a1a, 0.18 + 0.08 * Math.sin(t * 20 + z.x)).fillCircle(z.x, z.y, z.r);
    }
    for (const u of gm.units) {
      const lvl = LEVEL_SCALE[Math.min(u.level, LEVEL_SCALE.length - 1)];
      const r = u.def.radius * lvl;
      // Lv3은 금빛 후광, Lv4는 보라 후광
      if (u.branch !== null) {
        g.fillStyle(0xc58aff, 0.28 + 0.1 * Math.sin(t * 4 + u.uid)).fillCircle(u.x, u.y, r + 10);
      } else if (u.level >= 2) {
        g.fillStyle(0xffc020, 0.32 + 0.1 * Math.sin(t * 4 + u.uid)).fillCircle(u.x, u.y, r + 8);
      }
      g.fillStyle(0x7a5a3a, 0.22).fillEllipse(u.x, u.y + r * 0.95, r * 2.1, r * 0.6);
      const em = this.unitEmojis.get(u.uid);
      if (em) {
        const age = this.clock - (this.born.get(u.uid) ?? -1);
        const appear = age < 0.3 ? 0.2 + 0.8 * easeOutBack(age / 0.3) : 1;
        const breathe = 0.03 * Math.sin(t * 3 + u.uid);
        const k = baseScale(em) * lvl * appear * (this.punch.get(u.uid) ?? 1);
        em.setScale(k * (1 + breathe), k * (1 - breathe));
      }
      if (!this.textures.exists(u.def.id)) g.fillStyle(u.def.color, 0.9).fillCircle(u.x, u.y, u.def.radius);
      if (u === sel) g.lineStyle(4, THEME.selected, 1).strokeCircle(u.x, u.y, u.def.radius + 4);
      if (u.buffMul > 1) g.lineStyle(2, 0x3fbf8f, 0.9).strokeCircle(u.x, u.y, u.def.radius + 4);
      if (overload && u.def.kind !== 'income' && u.def.kind !== 'buff') {
        g.lineStyle(3, 0xffe14a, 0.5 + 0.4 * Math.sin(t * 20)).strokeCircle(u.x, u.y, u.def.radius + 7);
      }
      // 레벨 점 (흰 테두리로 밝은 바닥에서도 보이게)
      for (let i = 0; i <= u.level; i++) {
        const dx = u.x - u.level * 4.5 + i * 9;
        const dy = u.y + r + 7;
        g.fillStyle(0xffffff).fillCircle(dx, dy, 4.5);
        g.fillStyle(i === 3 ? 0xa57be0 : 0xf5a623).fillCircle(dx, dy, 3.2);
      }
    }

    // 적: 통통 튀며 움직이고(떠오르면 길쭉, 내려앉으면 납작), 가는 방향을 보고, 맞으면 붉게 움찔한다
    const hop = (e: Enemy) => (e.stunTime <= 0 ? Math.abs(Math.sin(t * 9 + e.uid)) : 0);
    const pos = (e: Enemy) => ({ x: e.x, y: e.y - hop(e) * 5 });
    syncEmojis(this, this.enemyEmojis, gm.enemies.map((e) => ({ uid: e.uid, ...pos(e), key: e.def.id, emoji: e.def.emoji, size: e.def.radius * (e.def.radius < 13 ? 3.2 : 2.6) })));
    for (const e of gm.enemies) {
      const p = pos(e);
      const flash = this.flashes.has(e.uid);
      g.fillStyle(0x000000, 0.25).fillEllipse(e.x, e.y + e.def.radius * 0.8, e.def.radius * 1.8, e.def.radius * 0.6);
      if (!this.textures.exists(e.def.id)) g.fillStyle(flash ? 0xffffff : e.def.color).fillCircle(p.x, p.y, e.def.radius);
      const em = this.enemyEmojis.get(e.uid);
      if (em) {
        // 계속 맞아도 모양이 보이도록 하얗게 덮지 않고 붉게 물들인다
        const enraged = !!e.def.enrage && e.hp <= e.maxHp * e.def.enrage.below;
        if (flash) em.setTint(0xff7a7a);
        else if (enraged) em.setTint(0xffa890);
        else em.clearTint();
        // 투명한 유령은 흐릿하게
        em.setAlpha(e.hidden ? 0.3 : 1);
        const squash = e.stunTime > 0 ? 0 : (hop(e) - 0.5) * 0.16;
        const k = baseScale(em) * (this.punch.get(e.uid) ?? 1);
        em.setScale(k * (1 - squash), k * (1 + squash));
        const prev = this.lastX.get(e.uid);
        if (prev !== undefined && Math.abs(e.x - prev) > 0.2) em.setFlipX((e.x < prev) !== FACES_LEFT.has(e.def.id));
        this.lastX.set(e.uid, e.x);
      }
      if (e.slowMul < 1) g.lineStyle(3, 0x4fb3e8, 0.9).strokeCircle(p.x, p.y, e.def.radius + 2);
      if (e.stunTime > 0 && e.frozenVuln > 1) g.fillStyle(0xbfefff, 0.45).fillCircle(p.x, p.y, e.def.radius + 3);
      if (e.hackMul > 1) g.lineStyle(2, 0x5fff9f, 0.5 + 0.5 * Math.sin(t * 25)).strokeRect(p.x - e.def.radius - 3, p.y - e.def.radius - 3, e.def.radius * 2 + 6, e.def.radius * 2 + 6);
      if (e.stunTime > 0) {
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * Math.PI * 2) / 3;
          g.fillStyle(0xffe14a).fillCircle(p.x + Math.cos(a) * e.def.radius, p.y - e.def.radius - 4 + Math.sin(a) * 4, 3);
        }
      }
      const w = Math.max(24, e.def.radius * 2);
      // 방패: 남은 겹 수만큼 체력바 위에 파란 칸
      for (let i = 0; i < e.shield; i++) {
        const sx = p.x - (e.shield * 7) / 2 + i * 7;
        g.fillStyle(0xffffff).fillRect(sx, p.y - e.def.radius - 17, 6, 6);
        g.fillStyle(0x4f8fd0).fillRect(sx + 1, p.y - e.def.radius - 16, 4, 4);
      }
      if (e.shield > 0) g.lineStyle(3, 0x4f8fd0, 0.9).strokeCircle(p.x, p.y, e.def.radius + 4);
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
      const color = ok ? 0x3fae55 : 0xe5484d;
      const r = def.levels[0].range;
      if (r > 0) drawRange(o, this.ghost.x, this.ghost.y, r, color, t);
      o.fillStyle(color, 0.35).fillCircle(this.ghost.x, this.ghost.y, def.radius + 4);
      // 놓일 가전을 반투명하게 미리 보여 준다
      if (this.ghostIcon?.id !== this.placing) {
        this.ghostIcon?.icon.destroy();
        this.ghostIcon = { id: this.placing, icon: icon(this, 0, 0, this.placing, def.emoji, def.radius * 2.9).setDepth(5.5).setAlpha(0.75) };
      }
      this.ghostIcon.icon.setPosition(this.ghost.x, this.ghost.y);
    } else if (this.ghostIcon) {
      this.ghostIcon.icon.destroy();
      this.ghostIcon = null;
    }
    if (this.aiming && this.ghost) {
      const r = gm.abilityStats(this.aiming).radius ?? 0;
      drawRange(o, this.ghost.x, this.ghost.y, r, 0xa57be0, t);
    }

    // HUD
    const waveText = gm.endless ? STR.waveEndless(gm.wave) : STR.wave(gm.wave, gm.totalWaves);
    this.hpText.setText(`${STR.hp} ${gm.hp}`);
    this.moneyText.setText(`${STR.money} ${gm.money}`);
    this.waveText.setText(waveText);
    const cardTag = gm.cards.length ? `${STR.cardCount(gm.cards.length)}  ` : '';
    this.diffLabel.setText(`${cardTag}${STR.maps[this.setup.map as MapId]?.name ?? ''}  ${STR.difficulties[this.difficulty].name}${gm.endless ? ' ♾️' : ''}`);
    const next = gm.wavePreview(gm.wave + 1);
    const nextMod = gm.waveMod(gm.wave + 1);
    const modTag = nextMod ? `[${nextMod.emoji}${STR.waveMods[nextMod.id].name}] ` : '';
    this.preview.setText(next.length ? `${STR.preview} ${modTag}${next.map((n) => `${gm.cfg.enemies[n.id].emoji}×${n.count}`).join(' ')}` : '');
    const am = gm.activeMod;
    this.modLabel.setText(am ? `${am.emoji} ${STR.waveMods[am.id].name}: ${STR.waveMods[am.id].desc}` : '');
    this.pauseBtn.setEnabled(!gm.finished && !this.picking);
    this.waveBtn.setEnabled((gm.phase === 'ready' || gm.phase === 'intermission') && !gm.offer);
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
      const cost = gm.placeCost(id);
      btn.setEnabled(gm.money >= cost);
      // 할인 카드를 고르면 가격표가 바뀐다
      const label = `${STR.units[id].name}\n💰${cost}`;
      if (btn.label.text !== label) btn.label.setText(label);
      btn.bg.setStrokeStyle(this.placing === id ? 3 : 2, this.placing === id ? 0xffd35a : 0xffffff, this.placing === id ? 1 : 0.25);
    }
    for (const a of this.abilityBtns) {
      const cd = gm.cooldowns[a.id];
      const ratio = cd / gm.abilityStats(a.id).cooldown;
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
    const n1 = (v: number) => String(Math.round(v * 10) / 10);
    if (!atFork && lv.damage) lines.push(`${s.damage} ${n1(lv.damage)}`);
    if (!atFork) {
      if (lv.cooldown) lines.push(`${s.rate} ${Math.round(lv.cooldown * 100) / 100}초`);
      if (lv.range) lines.push(`${s.range} ${Math.round(lv.range)}`);
      if (lv.splash) lines.push(`${s.splash} ${Math.round(lv.splash)}`);
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
        const { from, to } = ev;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const radius = this.sim.cfg.units[ev.kind].radius;
        const style = ev.branch ? BRANCH_SHOT[ev.branch] : undefined;
        const proj = ev.branch ? undefined : PROJECTILE[ev.kind];
        if (ev.branch === 'grill') {
          // 그릴: 지질수록 굵어지는 광선
          this.fx.beam(from.x, from.y, to.x, to.y, this.sim.findUnit(ev.unit)?.rampMul ?? 1);
          if (Math.random() < 0.3) this.fx.impact(to.x, to.y, 0xff8a2a);
          sfx.play('beam');
          break;
        }
        this.fx.muzzle(from.x, from.y, angle, radius);
        if (style) {
          this.fx.tracer(from.x, from.y, to.x, to.y, style.color, style.width, style.fade);
          this.fx.impact(to.x, to.y, style.color === 0xffffff ? 0xffd35a : style.color, style.big);
          sfx.play(style.sound);
          break;
        } else if (proj) {
          const dur = (Phaser.Math.Distance.Between(from.x, from.y, to.x, to.y) / PROJECTILE_SPEED) * 1000;
          const p = icon(this, from.x, from.y, proj.key, proj.emoji, 26).setDepth(7);
          this.tweens.add({
            targets: p, x: to.x, y: to.y, angle: 360, duration: dur,
            onComplete: () => {
              p.destroy();
              if (ev.kind === 'toaster') this.fx.impact(to.x, to.y, 0xe9a94f);
            },
          });
        } else {
          // 로봇청소기: 짧은 탄도 + 먼지
          this.fx.tracer(from.x, from.y, to.x, to.y, 0x9aa0b4, 3, 80);
          this.fx.impact(to.x, to.y, 0x9aa0b4);
        }
        sfx.play(ev.kind === 'vacuum' ? 'vacuum' : 'shoot');
        break;
      }
      case 'blast': {
        this.fx.explosion(ev.x, ev.y, ev.r);
        sfx.play('blast');
        break;
      }
      case 'pulse': {
        this.recoil(ev.unit);
        const kind = ev.branch === 'frost' ? 'frost' : ev.branch === 'typhoon' ? 'typhoon' : ev.branch === 'suction' ? 'suction' : 'plain';
        this.fx.wind(ev.x, ev.y, ev.r, kind);
        sfx.play(kind === 'suction' ? 'vacuum' : 'pulse');
        break;
      }
      case 'hit':
        this.flashes.set(ev.enemy, 0.07);
        this.punch.set(ev.enemy, Math.max(this.punch.get(ev.enemy) ?? 1, ev.crit ? 1.25 : 1.1));
        if (ev.crit) {
          const t = text(this, ev.x, ev.y - 16, STR.crit(ev.amount), 22, '#ffe14a').setOrigin(0.5).setDepth(12).setStroke('#7a2a00', 4).setScale(0.4);
          this.tweens.add({ targets: t, scale: 1.1, duration: 120, ease: 'Back.easeOut' });
          this.tweens.add({ targets: t, y: ev.y - 50, alpha: 0, delay: 250, duration: 450, onComplete: () => t.destroy() });
          sfx.play('crit');
        } else {
          sfx.play('hit');
        }
        break;
      case 'kill': {
        this.progress.kills++;
        const def = this.sim.cfg.enemies[ev.enemy];
        const ghost = icon(this, ev.x, ev.y, def.id, def.emoji, def.radius * 2.6).setDepth(8);
        const s0 = baseScale(ghost);
        this.tweens.add({ targets: ghost, scaleX: s0 * 1.6, scaleY: s0 * 0.4, alpha: 0, duration: 220, ease: 'Quad.easeOut', onComplete: () => ghost.destroy() });
        this.fx.pop(ev.x, ev.y, def.color);
        this.floatText(ev.x, ev.y, `+${ev.reward}`, THEME.gold);
        sfx.play('pop');
        break;
      }
      case 'leak': {
        this.run.leaked = true;
        this.floatText(ev.x, ev.y, `-${ev.damage}`, THEME.danger, 24);
        this.cameras.main.shake(200, Math.min(0.02, 0.004 + ev.damage / 20000));
        const { width, height } = this.sim.cfg.map;
        const red = this.add.rectangle(0, 0, width, height, 0xff0000, 0.25).setOrigin(0).setDepth(40);
        this.tweens.add({ targets: red, alpha: 0, duration: 400, onComplete: () => red.destroy() });
        sfx.play('leak');
        break;
      }
      case 'income':
        this.floatText(ev.x, ev.y, `+💰${ev.amount}`, THEME.gold, 20);
        sfx.play('coin');
        break;
      case 'ability':
        this.run.usedSkill = true;
        if (ev.id === 'plunger') this.plungerFx(ev.x, ev.y, ev.r);
        else {
          sfx.play('overload');
          this.cameras.main.flash(250, 255, 230, 80);
        }
        break;
      case 'shieldHit':
        this.punch.set(ev.enemy, Math.max(this.punch.get(ev.enemy) ?? 1, 1.1));
        this.fx.impact(ev.x, ev.y, 0x4f8fd0, ev.left === 0);
        sfx.play(ev.left === 0 ? 'crit' : 'hit');
        break;
      case 'heal':
        this.fx.heal(ev.x, ev.y, ev.r);
        break;
      case 'waveStart':
        if (ev.mod) this.banner(STR.modBanner(ev.mod.emoji, STR.waveMods[ev.mod.id].name), '#ffd35a');
        else this.banner(ev.boss ? STR.bossBanner : STR.waveBanner(ev.wave), ev.boss ? '#ff6b6b' : '#ffffff');
        if (ev.boss) {
          this.cameras.main.shake(800, 0.006);
          sfx.play('boss');
        } else sfx.play('wave');
        break;
      case 'waveCleared':
        this.run.cleared = ev.wave;
        this.run.endless = this.sim.endless;
        this.checkAchievements();
        this.banner(STR.clearBanner(ev.bonus), '#ffd35a', 0.8);
        sfx.play('clear');
        break;
      case 'cardOffer':
        this.showCards();
        break;
      case 'cardPicked':
        this.run.cards++;
        if (this.sim.cfg.cards?.find((c) => c.id === ev.id)?.rarity === 'legend' && !this.progress.legends.includes(ev.id)) {
          this.progress.legends.push(ev.id);
        }
        this.checkAchievements();
        this.showToast(STR.cardPicked(STR.cards[ev.id]?.name ?? ev.id));
        sfx.play('upgrade');
        break;
      case 'chain':
        this.fx.impact(ev.x, ev.y, 0xff8a2a, true);
        break;
      case 'blocked':
        this.floatText(ev.x, ev.y, STR.blocked, THEME.pink, 22);
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
    this.punch.set(uid, Math.max(this.punch.get(uid) ?? 1, 1.18));
  }

  private syncUnits(): void {
    syncEmojis(this, this.unitEmojis, this.sim.units.map((u) => ({ uid: u.uid, x: u.x, y: u.y, key: u.def.id, emoji: u.def.emoji, size: u.def.radius * 2.9 })));
  }

  private popIn(u: Unit | undefined): void {
    if (!u) return;
    this.burst(u.x, u.y, 0xffffff, 6);
    this.born.set(u.uid, this.clock);
  }

  private plungerFx(x: number, y: number, r: number): void {
    const p = icon(this, x, y - 220, 'ab_plunger', '🪠', 96).setOrigin(0.5, 1).setDepth(30);
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
    const t = text(this, -300, 300, s, 52, color).setOrigin(0.5).setDepth(45).setStroke('#4a3b34', 9);
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
    const t = text(this, x, y - 10, s, size, color).setOrigin(0.5).setDepth(10).setStroke('#ffffff', 4);
    this.tweens.add({ targets: t, y: y - 45, alpha: 0, duration: 750, onComplete: () => t.destroy() });
  }

  /** 일시정지 켜기/끄기. 시작 화면이나 결과 화면이 떠 있을 때는 무시한다 */
  private setPaused(on: boolean): void {
    if (on === !!this.pauseLayer) return;
    if (on && (this.sim.finished || this.picking || this.sim.offer)) return;
    if (!on) {
      this.pauseLayer?.destroy();
      this.pauseLayer = null;
      this.tweens.resumeAll();
      this.time.paused = false;
      return;
    }
    this.tweens.pauseAll();
    this.time.paused = true;
    this.placing = null;
    this.aiming = null;
    const { width, height } = this.sim.cfg.map;
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.55).setOrigin(0).setInteractive();
    // 왼쪽: 이번 판 카드 목록, 오른쪽: 일시정지 메뉴
    const cx = 920;
    const box = card(this, cx, height / 2, 420, 370, 'center', THEME.bar);
    const title = text(this, cx, height / 2 - 130, `⏸️ ${STR.paused}`, 34).setOrigin(0.5);
    const resume = button(this, cx, height / 2 - 50, 320, 54, STR.resume, () => this.setPaused(false), THEME.green, 21);
    const restart = button(this, cx, height / 2 + 20, 320, 50, STR.restartRun, () => this.leaveRun(true), THEME.neutral, 18);
    const quit = button(this, cx, height / 2 + 84, 320, 50, STR.quit, () => this.leaveRun(false), THEME.red, 18);
    const hint = text(this, cx, height / 2 + 148, STR.pauseHint, 14, THEME.textSoft).setOrigin(0.5);
    this.pauseLayer = this.add.container(0, 0, [dim, box, title, resume.container, restart.container, quit.container, hint, ...this.cardListPanel(360, height / 2)]).setDepth(70);
  }

  /** 새로 달성한 업적이 있으면 알림을 띄우고 진행 상황을 저장한다 */
  private checkAchievements(): void {
    for (const a of evaluate(this.run, this.progress)) {
      const slot = this.popups++;
      const label = STR.achUnlocked(STR.achievements[a.id]?.name ?? a.id, a.reward);
      const box = new RoundBox(this, 0, 0, 520, 50, THEME.yellow, 16, 4);
      const t = text(this, 0, -2, label, 20).setOrigin(0.5);
      const c = this.add.container(520, -40, [box, t]).setDepth(75);
      this.tweens.chain({
        targets: c,
        tweens: [
          { y: 100 + slot * 60, duration: 350, ease: 'Back.easeOut' },
          { y: 100 + slot * 60, duration: 2600 },
          { alpha: 0, duration: 400 },
        ],
        onComplete: () => {
          c.destroy();
          this.popups = Math.max(0, this.popups - 1);
        },
      });
      sfx.play('win');
    }
    saveProgress(this.progress);
  }

  /** 업적 목록 화면 (시작 화면에서 연다) */
  private showAchievements(): void {
    const { width, height } = this.sim.cfg.map;
    const p = this.progress;
    const layer = this.add.container(0, 0).setDepth(80);
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.7).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 860, 690, 'center', THEME.bar);
    const title = text(this, width / 2 - 400, 40, STR.achTitle, 30).setOrigin(0, 0.5);
    const parts = text(this, width / 2 + 230, 40, STR.achParts(p.parts), 18, THEME.gold).setOrigin(1, 0.5);
    const close = button(this, width / 2 + 340, 40, 130, 44, STR.close, () => layer.destroy(), THEME.neutral, 18);
    layer.add([dim, box, title, parts, close.container]);
    ACHIEVEMENTS.forEach((a, i) => {
      const y = 96 + i * 43;
      const done = p.done.includes(a.id);
      const info = STR.achievements[a.id];
      const row = new RoundBox(this, width / 2, y, 820, 38, done ? 0xfff0c8 : THEME.white, 10).setStrokeStyle(2, done ? THEME.selected : THEME.cardLine);
      const name = text(this, width / 2 - 395, y, `${a.emoji} ${info?.name ?? a.id}`, 17, done ? THEME.text : THEME.textSoft).setOrigin(0, 0.5);
      const prog = a.progress && !done ? `  (${a.progress(p).join('/')})` : '';
      const desc = text(this, width / 2 - 170, y, `${info?.desc ?? ''}${prog}`, 15, THEME.textSoft).setOrigin(0, 0.5);
      const reward = text(this, width / 2 + 395, y, done ? `✅ ${STR.achReward(a.reward)}` : STR.achReward(a.reward), 16, done ? THEME.gold : THEME.textSoft).setOrigin(1, 0.5);
      layer.add([row, name, desc, reward]);
    });
  }

  /** 이번 판에 고른 카드 목록 패널 (일시정지 화면용) */
  private cardListPanel(cx: number, cy: number): Phaser.GameObjects.GameObject[] {
    const gm = this.sim;
    const ids = [...new Set(gm.cards)];
    const rowH = 30;
    const h = Math.max(140, 80 + ids.length * rowH);
    const top = cy - h / 2;
    const out: Phaser.GameObjects.GameObject[] = [
      card(this, cx, cy, 600, h, 'center', THEME.bar),
      text(this, cx, top + 34, `🃏 ${STR.cardList}`, 24).setOrigin(0.5),
    ];
    if (!ids.length) out.push(text(this, cx, top + 90, STR.cardNone, 16, THEME.textSoft).setOrigin(0.5));
    ids.forEach((id, i) => {
      const def = gm.cfg.cards?.find((c) => c.id === id);
      const n = gm.cardCount(id);
      const y = top + 78 + i * rowH;
      const info = STR.cards[id];
      out.push(text(this, cx - 280, y, `${def?.emoji ?? ''} ${info?.name ?? id}${n > 1 ? ` ×${n}` : ''}`, 17).setOrigin(0, 0.5));
      out.push(text(this, cx - 80, y, (info?.desc ?? '').replace('\n', ' / '), 14, THEME.textSoft).setOrigin(0, 0.5));
    });
    return out;
  }

  /** 카드 고르기 화면. 고르거나 건너뛸 때까지 게임이 멈춰 있다 */
  private showCards(): void {
    const gm = this.sim;
    const offer = gm.offer;
    if (!offer) return;
    this.placing = null;
    this.aiming = null;
    this.select(null);
    const { width, height } = gm.cfg.map;
    const layer = this.add.container(0, 0).setDepth(65);
    const close = () => layer.destroy();
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.6).setOrigin(0).setInteractive();
    const title = text(this, width / 2, 110, STR.cardTitle(gm.wave), 34, THEME.textOnDark).setOrigin(0.5).setStroke('#4a3b34', 8);
    layer.add([dim, title]);
    const colors = { common: 0x8fb3c9, rare: THEME.purple, legend: 0xf5a623, risk: 0xe5484d };
    offer.forEach((c, i) => {
      const kind = c.risk ? 'risk' : c.rarity;
      const color = colors[kind];
      const x = width / 2 + (i - (offer.length - 1) / 2) * 290;
      const y = 370;
      const pick = () => {
        if (gm.apply({ type: 'pickCard', index: i }).ok) close();
      };
      const bg = new RoundBox(this, 0, 0, 260, 360, THEME.white, 20, 6).setStrokeStyle(6, color);
      bg.setInteractive(new Phaser.Geom.Rectangle(-130, -180, 260, 366), Phaser.Geom.Rectangle.Contains);
      if (bg.input) bg.input.cursor = 'pointer';
      bg.on('pointerup', pick);
      const tag = new RoundBox(this, 0, -150, 90, 30, color, 15);
      const tagText = text(this, 0, -150, STR.rarity[kind], 16, THEME.textOnDark).setOrigin(0.5);
      const emoji = text(this, 0, -80, c.emoji, 64).setOrigin(0.5);
      const info = STR.cards[c.id];
      const name = text(this, 0, -10, info?.name ?? c.id, 26).setOrigin(0.5);
      const desc = text(this, 0, 55, info?.desc ?? '', 17, THEME.text).setOrigin(0.5).setAlign('center').setLineSpacing(6).setWordWrapWidth(230, true);
      const owned = gm.cardCount(c.id);
      const stack = text(this, 0, 118, c.max > 1 ? STR.cardOwned(owned, c.max) : '', 14, THEME.textSoft).setOrigin(0.5);
      const cont = this.add.container(x, y + 40, [bg, tag, tagText, emoji, name, desc, stack]).setAlpha(0);
      layer.add(cont);
      // 한 장씩 아래에서 올라온다
      this.tweens.add({ targets: cont, y, alpha: 1, delay: i * 90, duration: 260, ease: 'Back.easeOut' });
      bg.on('pointerover', () => cont.setScale(1.04)).on('pointerout', () => cont.setScale(1));
    });
    const skip = button(this, width / 2, 630, 300, 50, STR.cardSkip(gm.cfg.cardSkipMoney ?? 0), () => {
      if (gm.apply({ type: 'skipCard' }).ok) close();
    }, THEME.neutral, 18);
    layer.add(skip.container);
    sfx.play('clear');
  }

  /** 판을 그만둔다. 도달한 웨이브는 기록으로 남긴다 */
  private leaveRun(restart: boolean): void {
    if (this.sim.wave > 0) saveBest({ ...this.setup, endless: this.sim.endless }, this.sim.wave);
    saveProgress(this.progress);
    this.tweens.resumeAll();
    this.time.paused = false;
    this.scene.restart(restart ? { start: true } : {});
  }

  private continueEndless(): void {
    if (!this.sim.apply({ type: 'continueEndless' }).ok) return;
    for (const ob of this.endScreen) ob.destroy();
    this.endScreen = [];
    this.banner(STR.continueEndless, '#e8c8ff');
    sfx.play('wave');
  }

  private showEndScreen(won: boolean): void {
    this.placing = null;
    this.aiming = null;
    this.selected = null;
    saveProgress(this.progress); // 마지막 웨이브에서 잡은 적까지 저장
    const reached = this.sim.wave;
    const run: RunSetup = { ...this.setup, endless: this.sim.endless };
    const isNew = saveBest(run, reached);
    const { width, height } = this.sim.cfg.map;
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.55).setOrigin(0).setInteractive();
    const canContinue = won && !!this.sim.cfg.extraWave;
    const boxH = canContinue ? 400 : 320;
    const top = height / 2 - boxH / 2;
    const box = card(this, width / 2, height / 2, 540, boxH, 'center', THEME.bar).setStrokeStyle(4, won ? THEME.selected : THEME.red);
    const title = text(this, width / 2, top + 60, won ? `🏆 ${STR.victory}` : `💥 ${STR.gameOver}`, 34).setOrigin(0.5);
    const lines = [
      `${STR.maps[this.setup.map as MapId]?.name ?? ''}  ${STR.difficulties[this.difficulty].name}${run.endless ? ' ♾️' : ''}`,
      STR.reachedWave(reached), STR.best(loadBest(run)),
    ];
    if (isNew) lines.push(STR.newBest);
    const body = text(this, width / 2, top + 155, lines.join('\n'), 20, THEME.text).setOrigin(0.5).setAlign('center').setLineSpacing(6);
    const again = button(this, width / 2 - 120, top + 265, 220, 50, STR.restart, () => this.scene.restart({ start: true }), THEME.green, 20);
    const change = button(this, width / 2 + 120, top + 265, 220, 50, STR.changeDifficulty, () => this.scene.restart({}), THEME.neutral, 20);
    this.endScreen = [dim, box, title, body, again.container, change.container];
    // 20웨이브를 이기면 그대로 무한 모드로 이어갈 수 있다
    if (canContinue) {
      const cont = button(this, width / 2, top + 340, 460, 50, STR.continueEndless, () => this.continueEndless(), THEME.purple, 20);
      this.endScreen.push(cont.container);
    }
    for (const ob of this.endScreen) (ob as unknown as { setDepth(d: number): void }).setDepth(50);
    box.setScale(0.6);
    this.tweens.add({ targets: box, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }
}

function syncEmojis(
  scene: Phaser.Scene,
  pool: Map<number, Icon>,
  items: { uid: number; x: number; y: number; key?: string; emoji: string; size: number }[],
  depth = 2,
): void {
  const alive = new Set<number>();
  for (const it of items) {
    alive.add(it.uid);
    let t = pool.get(it.uid);
    if (!t) {
      t = icon(scene, 0, 0, it.key, it.emoji, it.size).setDepth(depth);
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

/** 맵별 바닥 무늬: 주방은 체크 타일, 욕실은 하늘색 타일, 베란다는 나무 바닥 */
function drawFloor(g: Phaser.GameObjects.Graphics, id: string, a: { x: number; y: number; w: number; h: number }): void {
  if (id === 'bathroom') {
    g.fillStyle(0xe4f3f8).fillRect(a.x, a.y, a.w, a.h);
    const s = 48;
    for (let y = a.y; y < a.y + a.h; y += s) {
      for (let x = a.x; x < a.x + a.w; x += s) {
        if (((x - a.x) / s + (y - a.y) / s) % 2 === 0) g.fillStyle(0xd5ecf3).fillRect(x, y, s, s);
      }
    }
    g.lineStyle(2, 0xffffff, 0.9);
    for (let x = a.x; x <= a.x + a.w; x += s) g.lineBetween(x, a.y, x, a.y + a.h);
    for (let y = a.y; y <= a.y + a.h; y += s) g.lineBetween(a.x, y, a.x + a.w, y);
    return;
  }
  if (id === 'balcony') {
    // 나무 판자: 줄마다 이음매 위치를 엇갈리게
    const h = 34;
    for (let y = a.y, row = 0; y < a.y + a.h; y += h, row++) {
      g.fillStyle(row % 2 ? 0xe8c99a : 0xedd2a8).fillRect(a.x, y, a.w, h);
      g.fillStyle(0xc9a274, 0.6).fillRect(a.x, y + h - 2, a.w, 2);
      for (let x = a.x + ((row * 97) % 180); x < a.x + a.w; x += 180) g.fillStyle(0xc9a274, 0.6).fillRect(x, y, 2, h);
    }
    return;
  }
  // 주방: 크림·살구 체크 타일
  const s = 40;
  g.fillStyle(0xfdf3e1).fillRect(a.x, a.y, a.w, a.h);
  for (let y = a.y; y < a.y + a.h; y += s) {
    for (let x = a.x; x < a.x + a.w; x += s) {
      if (((x - a.x) / s + Math.floor((y - a.y) / s)) % 2 === 0) g.fillStyle(0xf6e2c4).fillRect(x, y, s, s);
    }
  }
}
