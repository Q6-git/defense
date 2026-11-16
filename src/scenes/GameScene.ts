import Phaser from 'phaser';
import { defaultConfig } from '../config';
import { Game, MASTERY, type GameEvent } from '../core/game';
import { applyMeta, META, buyMastery, buyResearch, masteryCost, masteryLevel, RESEARCH, researchCost, researchLevel } from '../meta';
import { TARGET_MODES, type AbilityId, type DifficultyId, type Enemy, type EnemyId, type Unit, type UnitId, type UnitLevel } from '../core/types';
import { ABILITY_ORDER } from '../data/abilities';
import { DIFFICULTIES, DIFFICULTY_ORDER } from '../data/difficulty';
import { MAP_ORDER, type MapId } from '../data/map';
import { GACHA_UNITS, UNIT_ORDER } from '../data/units';
import { clearParts, GACHA, GACHA_POOL, pull, type PullResult } from '../gacha';
import { sfx, type SoundId } from '../sfx';
import { ACHIEVEMENTS, evaluate, type Progress, type RunStats } from '../achievements';
import { loadBest, loadDeck, loadName, loadProgress, loadRanking, loadSetup, saveBest, saveDeck, saveName, saveProgress, saveRanking, saveSetup, type RunSetup } from '../storage';
import { addRank, cleanName, randomName, rankList, topUnits, type RankEntry } from '../ranking';
import { fetchOnline, onlineEnabled, renameOnline, submitOnline } from '../online/ranking';
import { LANGS, lang, setLang, STR } from '../i18n';
import { spriteUrls } from '../spriteLoader';
import type { Grid } from '../core/types';
import { BESTIARY, firstWave } from '../bestiary';
import { ANIM_FRAME, MODEL_ANIMS } from '../view3d/anims';
import { bulkGroup, nextBulkStep } from '../core/bulk';
import { Board3D, HOME, panView, zoomView, type Mark } from '../view3d/board';
import { OBSTACLE_SPRITE } from '../sprites';
import { drawRange, Fx } from './fx';
import { baseScale, button, card, fitText, icon, RoundBox, text, THEME, type Button, type Icon } from './ui';

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

function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** 갈래별 공격 모양: 빠른 공격은 투사체 대신 빛나는 탄도로 그린다 */
/** DPS 표시: 오르는 가전(그릴)은 최대치도 */
const dpsText = (d: { dps: number; max: number }) => `${Math.round(d.dps)}${d.max > d.dps + 0.5 ? STR.dpsMax(Math.round(d.max)) : ''}`;

/** 한 판에 들고 갈 수 있는 가전 수 */
const DECK_SIZE = 6;
const RARITY_COLOR: Record<string, number> = { rare: 0x5aa9e6, hero: 0xa57be0, legend: 0xf5a623 };

const BRANCH_SHOT: Record<string, { color: number; width: number; fade: number; sound: SoundId; big: boolean }> = {
  rapid: { color: 0xffc94d, width: 2, fade: 70, sound: 'shoot', big: false },
  sniper: { color: 0xffffff, width: 4, fade: 240, sound: 'snipe', big: true },
  crusher: { color: 0x9aa0b4, width: 5, fade: 120, sound: 'blast', big: true },
  pressure: { color: 0xff5a1a, width: 6, fade: 160, sound: 'blast', big: true },
  highvolt: { color: 0xfff27a, width: 5, fade: 160, sound: 'crit', big: true },
  steam: { color: 0xe8eef5, width: 14, fade: 300, sound: 'pulse', big: false },
  press: { color: 0xffffff, width: 9, fade: 260, sound: 'snipe', big: true },
  jet: { color: 0x3f9fe8, width: 18, fade: 300, sound: 'pulse', big: false },
  sterilize: { color: 0x7fe0c8, width: 10, fade: 280, sound: 'snipe', big: true },
};

/** 뽑기 가전의 공격 모양 */
const KIND_SHOT: Partial<Record<UnitId, { color: number; width: number; fade: number; sound: SoundId; big: boolean }>> = {
  stove: { color: 0xff8a2a, width: 5, fade: 120, sound: 'vacuum', big: false },
  strip: { color: 0xffe14a, width: 3, fade: 140, sound: 'crit', big: false },
  iron: { color: 0xffffff, width: 7, fade: 220, sound: 'blast', big: true },
  dishwasher: { color: 0x4fb3f0, width: 11, fade: 260, sound: 'pulse', big: false },
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
  /** ★강화 개수 표시 (레벨 점 아래 '★3') */
  private starTags = new Map<number, Icon>();
  private fx!: Fx;
  /** 업적: 판을 넘어 쌓이는 진행 상황과 이번 판 기록 */
  private progress: Progress = loadProgress();
  private run!: RunStats;
  /** 지금 떠 있는 업적 알림 수 (겹치지 않게 아래로 쌓는다) */
  private popups = 0;
  /** 이번 판에 보여 준 L 포즈 안내 횟수 (처음 몇 번만) */
  private weighHints = 0;
  /** 이번 판에 들고 온 가전 (상점에 나오는 순서) */
  private deck: UnitId[] = [...UNIT_ORDER];
  /** 이번 판에 번 부품 */
  private runParts = 0;
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
  private rewardText!: Phaser.GameObjects.Text;
  private waveBtn!: Button;
  private speedBtn!: Button;
  /** 확대했을 때 전체 보기로 되돌리는 버튼 (3D 맵) */
  private viewBtn!: Button;
  private muteBtn!: Button;
  private pauseBtn!: Button;
  /** 일시정지 중이면 일시정지 화면의 오브젝트들 */
  private pauseLayer: Phaser.GameObjects.Container | null = null;
  /** 처음 만난 몬스터 소개 카드 (떠 있는 동안 게임이 멈춘다) */
  private introLayer: Phaser.GameObjects.Container | null = null;
  /** 이번 판을 랭킹에 이미 남겼는지 */
  private ranked = false;
  /** 방금 남긴 랭킹 기록 (랭킹 표에서 강조) */
  private static lastRankAt = 0;
  private introQueue: EnemyId[] = [];
  /** 시작 화면(맵·난이도 선택)이 떠 있는지 */
  private picking = false;
  private pickerLayer?: Phaser.GameObjects.Container;
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
  /** 격자 맵이면 3D 화면 (없으면 기존 2D) */
  private board: Board3D | null = null;
  /** 정보 패널에 띄운 설치된 유닛 */
  private selected: Unit | null = null;
  private info!: {
    root: Phaser.GameObjects.Container;
    title: Phaser.GameObjects.Text;
    stats: Phaser.GameObjects.Text;
    upgrade: Button;
    upgradeAll: Button;
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
      if (this.textures.exists(key)) continue;
      // 동작 시트는 격자로 잘라서 프레임으로 읽는다
      if (key.endsWith('_anim')) this.load.spritesheet(key, url, { frameWidth: ANIM_FRAME, frameHeight: ANIM_FRAME });
      else this.load.image(key, url);
    }
  }

  /** data.start가 없으면(처음 열었거나 설정을 바꿀 때) 시작 화면을 띄운다 */
  create(data: { start?: boolean }): void {
    this.setup = loadSetup();
    this.endScreen = [];
    this.progress = loadProgress();
    // 저장된 덱에서 지금 가진 가전만 남긴다. 없으면 기본 6종
    const have = new Set<string>([...UNIT_ORDER, ...this.progress.owned]);
    const saved = (loadDeck() ?? []).filter((u) => have.has(u)).slice(0, DECK_SIZE) as UnitId[];
    this.deck = saved.length ? saved : [...UNIT_ORDER];
    // 연구·숙련도·덱이 반영된 설정으로 판을 만든다
    this.sim = new Game(applyMeta(defaultConfig(this.setup.difficulty, this.setup.endless, this.setup.map as MapId), this.progress, this.deck));
    // 움직이는 몬스터의 반복 동작 (도감·소개 카드)
    for (const [name, spec] of Object.entries(MODEL_ANIMS)) {
      const key = `${name}_anim`;
      if (this.textures.exists(key) && !this.anims.exists(key)) {
        this.anims.create({ key, frames: this.anims.generateFrameNumbers(key, { start: 0, end: spec.frames - 1 }), frameRate: spec.fps, repeat: -1 });
      }
    }
    // 개발 서버에서만: 브라우저 자동 테스트가 상태를 들여다볼 수 있게 노출
    if (import.meta.env.DEV) Object.assign(window, { sim: this.sim, scene: this });
    this.enemyEmojis.clear();
    this.unitEmojis.clear();
    this.badges.clear();
    this.starTags.clear();
    this.flashes.clear();
    this.pops.clear();
    this.punch.clear();
    this.born.clear();
    this.lastX.clear();
    this.placing = null;
    this.aiming = null;
    this.selected = null;
    this.speed = 1;

    this.board = null;
    if (this.sim.cfg.map.grid) this.attachBoard();
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
    this.preview = text(this, 408, 8, '', 15, THEME.textSoft);
    this.rewardText = text(this, 408, 28, '', 14, THEME.gold);
    // 맵·난이도 표시는 맵 오른쪽 위 구석에 (상단 바는 다음 웨이브 미리보기가 쓴다)
    this.diffLabel = text(this, PANEL_X - 12, 64, '', 15, THEME.gold).setOrigin(1, 0).setStroke('#ffffff', 4).setDepth(4);
    this.modLabel = text(this, 520, 64, '', 17, THEME.danger).setOrigin(0.5, 0).setStroke('#ffffff', 5).setDepth(6);
    this.pauseLayer = null;
    this.picking = false;
    this.ranked = false;
    this.runParts = 0;
    this.run = {
      map: this.setup.map, difficulty: this.setup.difficulty, endless: this.setup.endless,
      cleared: 0, placed: [], usedSkill: false, leaked: false, cards: 0,
    };
    this.popups = 0;
    this.weighHints = 0;
    this.pauseBtn = button(this, 772, 28, 48, 40, '⏸️', () => this.setPaused(true), THEME.neutral, 18);
    this.muteBtn = button(this, 828, 28, 48, 40, sfx.muted ? '🔇' : '🔊', () => this.muteBtn.setText(sfx.toggleMute() ? '🔇' : '🔊'), THEME.neutral, 18);
    this.speedBtn = button(this, 912, 28, 104, 40, STR.speed(1), () => this.cycleSpeed(), THEME.neutral, 17);
    this.viewBtn = button(this, PANEL_X - 62, 108, 108, 34, STR.resetView, () => this.board?.setView({ ...HOME }), THEME.neutral, 15);
    this.viewBtn.container.setDepth(6).setVisible(false);
    this.waveBtn = button(this, 1124, 28, 300, 40, STR.startWave, () => this.sim.apply({ type: 'startWave' }), THEME.green, 18);
    this.buildShop();
    this.buildAbilities();
    this.buildInfo();
    this.bossLabel = text(this, 520, 92, STR.bossName, 16, THEME.pink).setOrigin(0.5, 0).setDepth(6).setStroke('#ffffff', 4);
    this.toast = text(this, 520, 690, '', 19, THEME.text).setOrigin(0.5).setDepth(20).setStroke('#ffffff', 5);

    this.input.on('pointerdown', () => sfx.unlock());
    // Esc / P 로 일시정지, 탭을 벗어나거나 화면이 꺼지면 자동 일시정지
    const onKey = () => this.setPaused(!this.pauseLayer);
    // Esc: 설치·조준 중이면 그것부터 취소, 아니면 일시정지
    this.input.keyboard?.on('keydown-ESC', () => (this.placing || this.aiming ? this.cancelPlacing() : onKey()));
    this.input.keyboard?.on('keydown-P', onKey);
    const onHidden = () => this.setPaused(true);
    this.game.events.on(Phaser.Core.Events.HIDDEN, onHidden);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.game.events.off(Phaser.Core.Events.HIDDEN, onHidden));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (this.placing || this.aiming) {
        const q = this.toGame(p.worldX, p.worldY);
        this.ghost = this.snap(q.x, q.y);
      }
    });
    this.setupCameraInput();
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
    this.pickerLayer = layer;
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.55).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 640, 700, 'center', THEME.bar);
    const title = fitText(text(this, width / 2, 58, `🔌 ${STR.title}`, 36).setOrigin(0.5), 600);
    layer.add([dim, box, title]);
    const bestiaryBtn = button(this, 1120, 252, 230, 52, STR.bestiaryButton(this.progress.seen.length, BESTIARY.length), () => this.showBestiary(), THEME.green, 19);
    layer.add(bestiaryBtn.container);
    const rankBtn = button(this, 1120, 316, 230, 52, STR.rankingButton, () => this.showRanking(), THEME.orange, 19);
    layer.add(rankBtn.container);
    // 연구는 판 밖 성장이 켜져 있을 때만 (META.enabled)
    if (META.enabled) {
      const researchBtn = button(this, 1120, 380, 230, 52, STR.researchButton, () => this.showResearch(), THEME.red, 19);
      layer.add(researchBtn.container);
    }
    const settingsBtn = button(this, 1120, META.enabled ? 444 : 380, 230, 52, STR.settingsButton, () => this.showSettings(), THEME.neutral, 19);
    layer.add(settingsBtn.container);
    const ach = button(this, 1120, 60, 230, 52, STR.achButton(this.progress.done.length, ACHIEVEMENTS.length), () => this.showAchievements(), THEME.yellow, 19);
    layer.add(ach.container);
    const deckBtn = button(this, 1120, 124, 230, 52, STR.deckButton, () => this.showDeck(), THEME.blue, 19);
    const gachaBtn = button(this, 1120, 188, 230, 52, STR.gachaButton(this.progress.parts), () => this.showGacha(), THEME.purple, 19);
    layer.add([deckBtn.container, gachaBtn.container]);
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
      // 맵 5개가 시작 창 폭에 들어가도록 버튼을 좁게 나란히
      const gap = 124;
      const x = width / 2 + (i - (MAP_ORDER.length - 1) / 2) * gap;
      const b = button(this, x, 160, gap - 8, 66, '', () => this.changeSetup({ map: id }), id === this.setup.map ? 0xfff0c8 : THEME.white, 16);
      const m = STR.maps[id];
      fitText(b.label.setText(`${m.name}\n${m.desc}`).setAlign('center').setFontSize(14).setLineSpacing(2), gap - 16);
      b.bg.setStrokeStyle(id === this.setup.map ? 4 : 2, id === this.setup.map ? THEME.selected : THEME.cardLine);
      layer.add(b.container);
    });
  }

  update(_t: number, deltaMs: number): void {
    if (this.pauseLayer || this.introLayer) return;
    const dt = Math.min(deltaMs / 1000, 0.25);
    this.clock += dt;
    this.sim.update(dt * this.speed);
    for (const ev of this.sim.drainEvents()) this.playEvent(ev);
    this.checkNewEnemies();
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
    if (this.board) {
      this.board.fit(this.game.canvas);
      this.board.render(this.sim, this.clock, dt, {
        punch: this.punch,
        flash: new Set(this.flashes.keys()),
        born: this.born,
        levelScale: (u) => LEVEL_SCALE[Math.min(u.level, LEVEL_SCALE.length - 1)],
      });
    }
  }

  // ───────────────────────── 입력

  /** 격자 맵의 3D 화면을 Phaser 캔버스 뒤에 깐다. WebGL을 못 쓰면 2D 타일 화면으로 그린다 */
  private attachBoard(): void {
    let board: Board3D;
    try {
      board = new Board3D(this.sim.cfg.map, this.sim, (key) =>
        this.textures.exists(key) ? (this.textures.get(key).getSourceImage() as CanvasImageSource) : null,
      );
    } catch {
      return;
    }
    const canvas = this.game.canvas;
    canvas.parentElement?.insertBefore(board.canvas, canvas);
    canvas.style.position = 'relative';
    canvas.style.zIndex = '1';
    board.fit(canvas);
    this.board = board;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => board.dispose());
  }

  /** 게임 좌표(바닥 위 높이 lift) → 화면 좌표. 2D 맵은 그대로 */
  private sp(x: number, y: number, lift = 0): { x: number; y: number } {
    if (!this.board) return { x, y: y - lift };
    return this.board.project(x, y, lift);
  }

  /** 화면 좌표 → 게임 좌표 (3D면 그 자리 칸 높이까지 고려해 바닥으로 되돌린다) */
  private toGame(sx: number, sy: number): { x: number; y: number } {
    return this.board ? this.board.unproject(sx, sy) : { x: sx, y: sy };
  }

  /** 3D 화면에서 쓰도록 이벤트 좌표를 화면 좌표로 바꾼 사본 */
  private toScreen(ev: GameEvent): GameEvent {
    const b = this.board;
    if (!b) return ev;
    const BODY = 18;
    const P = (v: { x: number; y: number }, lift = BODY) => this.sp(v.x, v.y, lift);
    const e = { ...ev } as Record<string, unknown>;
    if (ev.type === 'shot') {
      e.from = P(ev.from, 30);
      e.to = P(ev.to);
      return e as GameEvent;
    }
    if (ev.type === 'bolt') {
      e.points = ev.points.map((q, i) => P(q, i === 0 ? 30 : BODY));
      return e as GameEvent;
    }
    if ('x' in ev && 'y' in ev) Object.assign(e, P(ev as { x: number; y: number }, ev.type === 'leak' || ev.type === 'blast' || ev.type === 'pulse' ? 6 : BODY));
    // 반지름은 그 자리의 원근 배율만큼 (옆으로 r만큼 떨어진 점까지의 화면 거리)
    if ('r' in ev && 'x' in ev) {
      const q = ev as { x: number; y: number; r: number };
      const c = this.sp(q.x, q.y), side = this.sp(q.x + q.r, q.y);
      e.r = Math.abs(side.x - c.x);
    }
    return e as GameEvent;
  }

  /** 격자 맵에서 가전을 놓을 때는 칸 가운데로 맞춘다 */
  private snap(x: number, y: number): { x: number; y: number } {
    const g = this.sim.cfg.map.grid;
    if (!g || !this.placing) return { x, y };
    const c = Math.floor((x - g.x) / g.size);
    const r = Math.floor((y - g.y) / g.size);
    if (c < 0 || r < 0 || c >= g.cols || r >= g.rows) return { x, y };
    return { x: g.x + (c + 0.5) * g.size, y: g.y + (r + 0.5) * g.size };
  }

  private onMapTap(x: number, y: number): void {
    const { area } = this.sim.cfg.map;
    if (this.pauseLayer || this.sim.offer || this.sim.finished || x >= area.x + area.w || y < area.y) return; // 패널/상단 바는 버튼이 처리
    const screen = { x, y };
    ({ x, y } = this.toGame(x, y));
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
      ({ x, y } = this.snap(x, y));
      const res = this.sim.apply({ type: 'place', unit: id, x, y });
      if (res.ok) {
        // 연속 설치: 한 대 더 살 수 있고 최대 대수가 아니면 설치 모드를 유지한다 (Esc·우클릭으로 끝)
        const more = this.sim.money >= this.sim.placeCost(id) && this.sim.units.filter((u) => u.def.id === id).length < this.sim.maxCount(id);
        if (!more) {
          this.placing = null;
          this.ghost = null;
        }
        sfx.play('place');
        if (!this.run.placed.includes(id)) this.run.placed.push(id);
        this.progress.placedBy[id] = (this.progress.placedBy[id] ?? 0) + 1;
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
    // 3D에서는 화면에 보이는 모델 몸통을 누른 것으로 고른다
    const hit = this.board
      ? this.sim.units.find((u) => {
          const c = this.sp(u.x, u.y, u.def.radius);
          return Phaser.Math.Distance.Between(c.x, c.y, screen.x, screen.y) <= u.def.radius * 1.3;
        })
      : this.sim.units.find((u) => Phaser.Math.Distance.Between(u.x, u.y, x, y) <= u.def.radius + 6);
    this.select(hit ?? null);
  }

  /**
   * 맵 위 입력: 짧게 누르면 설치·선택(onMapTap), 끌면 맵 이동, 휠·두 손가락이면 확대·축소 (3D 맵).
   * 우클릭은 설치·조준 취소.
   */
  private setupCameraInput(): void {
    const { area } = this.sim.cfg.map;
    const inMap = (p: { x: number; y: number }) => p.x < area.x + area.w && p.y > area.y;
    const blocked = () => !!this.pauseLayer || !!this.sim.offer || this.picking || this.endScreen.length > 0;
    let drag: { x: number; y: number; moved: boolean } | null = null;
    let pinch: number | null = null;
    this.input.addPointer(1);
    this.input.mouse?.disableContextMenu();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonDown()) {
        this.cancelPlacing();
        return;
      }
      drag = inMap(p) && !blocked() ? { x: p.x, y: p.y, moved: false } : null;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const b = this.board;
      if (!b || blocked()) return;
      const p1 = this.input.pointer1, p2 = this.input.pointer2;
      if (p1.isDown && p2.isDown) {
        // 두 손가락: 벌리면 확대, 가운데를 끌면 이동
        const d = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
        if (pinch) b.setView(zoomView(this.sim.cfg.map, b.view, mid.x, mid.y, d / pinch));
        pinch = d;
        if (drag) drag.moved = true;
        return;
      }
      if (!drag || !p.isDown) return;
      if (!drag.moved && Phaser.Math.Distance.Between(drag.x, drag.y, p.x, p.y) < 8) return;
      drag.moved = true;
      b.setView(panView(this.sim.cfg.map, b.view, { x: drag.x, y: drag.y }, { x: p.x, y: p.y }));
      drag.x = p.x;
      drag.y = p.y;
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (p.rightButtonReleased()) return;
      const wasDrag = drag?.moved || pinch !== null;
      if (!this.input.pointer1.isDown && !this.input.pointer2.isDown) {
        drag = null;
        pinch = null;
      }
      if (!wasDrag) this.onMapTap(p.worldX, p.worldY);
    });
    this.input.on('wheel', (p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (!this.board || blocked() || !inMap(p)) return;
      this.board.setView(zoomView(this.sim.cfg.map, this.board.view, p.x, p.y, Math.exp(-dy * 0.0015)));
    });
  }

  /** 설치·조준 모드 끝내기 */
  private cancelPlacing(): void {
    this.placing = null;
    this.aiming = null;
    this.ghost = null;
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

  private showToast(s: string, sec = 1.6): void {
    this.toast.setText(s);
    this.toastTimer = sec;
  }

  // ───────────────────────── UI 구성

  private buildShop(): void {
    text(this, PANEL_X + 16, 66, STR.shop, 16, THEME.textSoft);
    this.shopBtns = this.deck.map((id, i) => {
      const def = this.sim.cfg.units[id];
      const x = PANEL_X + 64 + (i % 2) * 112;
      const y = 122 + Math.floor(i / 2) * 76;
      const btn = button(this, x, y, 104, 68, '', () => this.choosePlacing(id), THEME.white, 14);
      const ic = icon(this, -33, 0, id, def.emoji, 36);
      fitText(btn.label.setPosition(18, 0).setText(`${STR.units[id].name}\n💰${def.levels[0].cost}`).setAlign('center'), 64);
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
      fitText(btn.label.setPosition(16, 0).setText(STR.abilities[id].name), 62);
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
    // 업그레이드 버튼 오른쪽에 '모두' (같은 가전을 돈이 되는 만큼 싼 것부터 올린다)
    const upgrade = button(this, (w - 66) / 2 + 2, 204, w - 24 - 66, 40, '', () => this.upgradeSelected(), THEME.blue, 17);
    const upgradeAll = button(this, w - 12 - 30, 204, 60, 40, STR.upgradeAll, () => this.upgradeAllSame(), THEME.blue, 15);
    const half = (w - 24) / 2 - 3;
    const branchA = button(this, 12 + half / 2, 200, half, 46, '', () => this.upgradeSelected(0), THEME.purple, 15);
    const branchB = button(this, w - 12 - half / 2, 200, half, 46, '', () => this.upgradeSelected(1), THEME.purple, 15);
    branchA.label.setAlign('center');
    branchB.label.setAlign('center');
    const target = button(this, w / 2, 248, w - 24, 32, '', () => this.cycleTarget(), THEME.neutral, 15);
    const sell = button(this, w / 2, 290, w - 24, 32, '', () => this.sellSelected(), THEME.red, 15);
    const root = this.add.container(x, y, [
      bg, title, stats, upgrade.container, upgradeAll.container, branchA.container, branchB.container, target.container, sell.container,
    ]);
    this.info = { root, title, stats, upgrade, upgradeAll, branchA, branchB, sell, target };
  }

  /** 고른 가전과 종류·갈래가 같은 가전을 함께 올린다: 갈래 전이면 Lv3까지, 갈래를 골랐으면 ★강화. 갈림길은 직접 고른다 */
  private upgradeAllSame(): void {
    const u = this.selected;
    if (!u) return;
    let n = 0;
    for (let guard = 0; guard < 500; guard++) {
      const step = nextBulkStep(this.sim, u);
      if (!step) break;
      if (!this.sim.apply({ type: 'upgrade', uid: step.unit.uid }).ok) break;
      this.upgradeFx(step.unit, undefined, step.star);
      n++;
    }
    if (n === 0) {
      sfx.play('error');
      return;
    }
    sfx.play('upgrade');
    const br = u.branch !== null ? u.def.branches?.[u.branch] : undefined;
    this.showToast(STR.upgradedAll(br ? STR.branches[br.id].full : (STR.units[u.def.id]?.name ?? u.def.id), n));
  }

  private upgradeSelected(branch?: 0 | 1): void {
    const u = this.selected;
    if (!u) return;
    const star = !!this.sim.upgradeOptions(u)[0]?.star;
    if (!this.sim.apply({ type: 'upgrade', uid: u.uid, branch }).ok) {
      sfx.play('error');
      return;
    }
    sfx.play('upgrade');
    this.upgradeFx(u, branch, star);
  }

  /** 업그레이드 연출: 고리, 글자, 3D 가전 튀어 오름 */
  private upgradeFx(u: Unit, branch: 0 | 1 | undefined, star: boolean): void {
    const color = branch !== undefined ? 0xc58aff : 0xffd35a;
    this.board?.levelUp(u.uid, this.clock);
    const center = this.sp(u.x, u.y, this.board ? u.def.radius : 0);
    const ring = this.add.circle(center.x, center.y, u.def.radius, color, 0).setStrokeStyle(4, color).setDepth(8);
    this.tweens.add({ targets: ring, scale: branch !== undefined ? 3.5 : 2.4, alpha: 0, duration: 450, onComplete: () => ring.destroy() });
    if (branch !== undefined) {
      const bid = u.def.branches![branch].id;
      if (!this.progress.branches.includes(bid)) this.progress.branches.push(bid);
      this.checkAchievements();
    }
    const label = branch !== undefined ? `${u.def.branches![branch].emoji} ${STR.branches[u.def.branches![branch].id].full}!` : star ? STR.starLabel(u.stars) : STR.levelUp;
    const at = this.sp(u.x, u.y, 30);
    this.floatText(at.x, at.y - 10, label, branch !== undefined ? THEME.pink : THEME.gold, 18);
    if (branch !== undefined) this.burst(at.x, at.y, color, 12, 60);
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
    const at = this.sp(u.x, u.y, 20);
    this.floatText(at.x, at.y, `+💰${value}`, THEME.gold);
    this.burst(at.x, at.y, u.def.color, 8);
    this.selected = null;
  }

  // ───────────────────────── 그리기

  private drawMap(): void {
    const { map } = this.sim.cfg;
    const g = this.add.graphics();
    if (this.board) {
      g.fillStyle(THEME.bar).fillRect(0, 0, map.width, map.area.y);
      g.fillStyle(THEME.barLine).fillRect(0, map.area.y - 3, map.width, 3);
      g.fillStyle(THEME.bar).fillRect(PANEL_X, map.area.y, PANEL_W, map.area.h);
      g.fillStyle(THEME.barLine).fillRect(PANEL_X, map.area.y, 3, map.area.h);
      return;
    }
    if (map.grid) drawTiles(g, map.grid, map.area, (x, y) => this.sim.distanceToPath({ x, y }) < map.pathHalfWidth);
    else drawFloor(g, map.id, map.area);
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
    if (!map.grid) {
      layer(hw * 2 + 10, 0x7a5a3a, 0.15, 6);
      layer(hw * 2 + 8, 0x7fa7bf, 1);
      layer(hw * 2, 0xcfe7f3, 1);
      layer(hw * 0.7, 0xeaf6fc, 0.9, -hw * 0.35);
    } else {
      // 격자 맵: 수로 바닥에 흐르는 물빛 한 줄
      layer(hw * 0.5, 0xeaf6fc, 0.55, 4);
    }
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
    this.world.clear();
    if (this.board) this.render3d();
    else this.render2d();
    this.renderOverlay();
    this.renderHud();
  }

  /** 2D 맵: 바닥 위 표시와 캐릭터 그림 */
  private render2d(): void {
    const g = this.world;
    const gm = this.sim;
    const t = this.clock;

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
    this.syncStarTags((u) => ({ x: u.x, y: u.y + u.def.radius * LEVEL_SCALE[Math.min(u.level, 3)] + 19 }));

    // 적: 통통 튀며 움직이고(떠오르면 길쭉, 내려앉으면 납작), 가는 방향을 보고, 맞으면 붉게 움찔한다
    const hop = (e: Enemy) => (e.stunTime <= 0 ? Math.abs(Math.sin(t * 9 + e.uid)) : 0);
    const pos = (e: Enemy) => ({ x: e.x, y: e.y - hop(e) * 5 });
    syncEmojis(this, this.enemyEmojis, gm.enemies.map((e) => ({ uid: e.uid, ...pos(e), key: e.def.id, emoji: e.def.emoji, size: e.def.radius * (e.def.radius < 13 ? 3.2 : 2.6) })), 2, true);
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
        if (prev !== undefined && Math.abs(e.x - prev) > 0.2) em.setFlipX(e.x > prev); // 3D로 렌더링한 그림은 모두 왼쪽 앞을 본다
        this.lastX.set(e.uid, e.x);
      }
      if (e.slowMul < 1) g.lineStyle(3, 0x4fb3e8, 0.9).strokeCircle(p.x, p.y, e.def.radius + 2);
      // 불붙은 적: 머리 위에 일렁이는 불꽃
      if (e.burnTime > 0) {
        const f = 5 + 2 * Math.sin(t * 30 + e.uid);
        g.fillStyle(0xff7a1a, 0.9).fillCircle(p.x, p.y - e.def.radius - 2, f);
        g.fillStyle(0xffe14a, 0.9).fillCircle(p.x, p.y - e.def.radius - 1, f * 0.5);
      }
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

  }

  /** ★강화한 가전 아래 금색 '★n' 글자 */
  private syncStarTags(at: (u: Unit) => { x: number; y: number }): void {
    const list = this.sim.units.filter((u) => u.stars > 0);
    syncEmojis(this, this.starTags, list.map((u) => ({ uid: u.uid, ...at(u), emoji: STR.stars(u.stars), size: 26 })), 3);
    for (const u of list) {
      const t = this.starTags.get(u.uid) as Phaser.GameObjects.Text | undefined;
      // 별 개수가 바뀌면 글자를 새로 쓴다
      if (t && t.text !== STR.stars(u.stars)) t.setText(STR.stars(u.stars));
      t?.setColor?.(THEME.gold).setStroke?.('#ffffff', 4);
    }
  }

  /** 3D 맵: 바닥 표시는 3D 안에(원근에 맞게), 체력바·레벨 점·배지는 화면 좌표로 */
  private render3d(): void {
    const b = this.board!;
    const gm = this.sim;
    const t = this.clock;
    const g = this.world;
    const marks: Mark[] = [];
    const ring = (x: number, y: number, r: number, color: number, alpha: number, width = 3) => marks.push({ shape: 'ring', x, y, r, color, alpha, width });
    const disc = (x: number, y: number, r: number, color: number, alpha: number) => marks.push({ shape: 'disc', x, y, r, color, alpha });
    const range = (x: number, y: number, r: number, color: number) => {
      disc(x, y, r, color, 0.12);
      ring(x, y, r, color, 0.6 + 0.2 * Math.sin(t * 4), 4);
    };

    const sel = this.selected;
    if (sel) {
      const r = gm.stats(sel).range;
      if (r > 0) range(sel.x, sel.y, r, 0x3d8fd6);
    }
    for (const z of gm.zones) disc(z.x, z.y, z.r, 0xff6a1a, 0.25 + 0.08 * Math.sin(t * 20 + z.x));
    const overload = gm.overloadTime > 0;
    for (const u of gm.units) {
      const r = u.def.radius;
      // Lv3은 금빛 후광, Lv4는 보라 후광 (발밑에)
      if (u.branch !== null) disc(u.x, u.y, r + 12, 0xc58aff, 0.35 + 0.1 * Math.sin(t * 4 + u.uid));
      else if (u.level >= 2) disc(u.x, u.y, r + 10, 0xffc020, 0.38 + 0.1 * Math.sin(t * 4 + u.uid));
      if (u === sel) ring(u.x, u.y, r + 8, THEME.selected, 1, 4);
      if (u.buffMul > 1) ring(u.x, u.y, r + 4, 0x3fbf8f, 0.9, 2);
      if (overload && u.def.kind !== 'income' && u.def.kind !== 'buff') ring(u.x, u.y, r + 11, 0xffe14a, 0.5 + 0.4 * Math.sin(t * 20), 3);
    }
    for (const e of gm.enemies) {
      if (e.slowMul < 1) ring(e.x, e.y, e.def.radius + 4, 0x4fb3e8, 0.9, 3);
      if (e.stunTime > 0 && e.frozenVuln > 1) disc(e.x, e.y, e.def.radius + 5, 0xbfefff, 0.55);
      if (e.hackMul > 1) ring(e.x, e.y, e.def.radius + 6, 0x5fff9f, 0.5 + 0.5 * Math.sin(t * 25), 2);
      if (e.shield > 0) ring(e.x, e.y, e.def.radius + 6, 0x4f8fd0, 0.9, 3);
    }
    // 설치 / 조준 미리보기
    if (this.placing && this.ghost) {
      const ok = gm.canPlace(this.placing, this.ghost.x, this.ghost.y) === null;
      const color = ok ? 0x3fae55 : 0xe5484d;
      const r = gm.cfg.units[this.placing].levels[0].range;
      if (r > 0) range(this.ghost.x, this.ghost.y, r, color);
      const half = (gm.cfg.map.grid?.size ?? 52) / 2 - 3;
      marks.push({ shape: 'square', x: this.ghost.x, y: this.ghost.y, r: half, color, alpha: 0.5 });
    }
    if (this.aiming && this.ghost) range(this.ghost.x, this.ghost.y, gm.abilityStats(this.aiming).radius ?? 0, 0xa57be0);
    b.setMarks(marks);

    // 화면 좌표 표시: 배지, 레벨 점
    const badgeAt = (u: Unit) => this.sp(u.x + u.def.radius * 0.9, u.y, u.def.radius * 2.4);
    syncEmojis(this, this.badges, gm.units.filter((u) => u.branch !== null).map((u) => ({
      uid: u.uid, ...badgeAt(u), emoji: u.def.branches![u.branch!].emoji, size: 24,
    })), 3);
    this.chipG.clear();
    for (const u of gm.units) {
      if (u.branch !== null) {
        const p = badgeAt(u);
        this.chipG.fillStyle(0xffffff).fillCircle(p.x, p.y, 10).lineStyle(2, 0xa57be0).strokeCircle(p.x, p.y, 10);
      }
      const foot = this.sp(u.x, u.y + u.def.radius + 2);
      for (let i = 0; i <= u.level; i++) {
        const dx = foot.x - u.level * 4.5 + i * 9;
        g.fillStyle(0xffffff).fillCircle(dx, foot.y, 4.5);
        g.fillStyle(i === 3 ? 0xa57be0 : 0xf5a623).fillCircle(dx, foot.y, 3.2);
      }
    }
    this.syncStarTags((u) => {
      const p = this.sp(u.x, u.y + u.def.radius + 2);
      return { x: p.x, y: p.y + 12 };
    });
    // 적: 머리 위 체력바, 방패 칸, 기절 별, 불꽃
    for (const e of gm.enemies) {
      const head = this.sp(e.x, e.y, e.def.radius * 2.3);
      const w = Math.max(22, e.def.radius * 1.8);
      for (let i = 0; i < e.shield; i++) {
        const sx = head.x - (e.shield * 7) / 2 + i * 7;
        g.fillStyle(0xffffff).fillRect(sx, head.y - 16, 6, 6);
        g.fillStyle(0x4f8fd0).fillRect(sx + 1, head.y - 15, 4, 4);
      }
      g.fillStyle(0x000000, 0.6).fillRect(head.x - w / 2, head.y - 8, w, 4);
      g.fillStyle(0xff5a5a).fillRect(head.x - w / 2, head.y - 8, (w * Math.max(0, e.hp)) / e.maxHp, 4);
      if (e.stunTime > 0) {
        for (let i = 0; i < 3; i++) {
          const a = t * 6 + (i * Math.PI * 2) / 3;
          g.fillStyle(0xffe14a).fillCircle(head.x + Math.cos(a) * e.def.radius, head.y + 2 + Math.sin(a) * 4, 3);
        }
      }
      if (e.burnTime > 0) {
        const f = 5 + 2 * Math.sin(t * 30 + e.uid);
        g.fillStyle(0xff7a1a, 0.9).fillCircle(head.x, head.y - 14, f);
        g.fillStyle(0xffe14a, 0.9).fillCircle(head.x, head.y - 13, f * 0.5);
      }
    }
  }

  /** 보스 체력바와 설치·조준 미리보기 */
  private renderOverlay(): void {
    const gm = this.sim;
    const t = this.clock;
    const o = this.overlay;
    o.clear();
    const boss = gm.enemies.find((e) => e.def.boss);
    this.bossLabel.setVisible(!!boss);
    if (boss) {
      const name = STR.bossNames[boss.def.id] ?? STR.bossName;
      if (this.bossLabel.text !== name) this.bossLabel.setText(name);
      o.fillStyle(0x000000, 0.6).fillRect(320, 66, 400, 14);
      o.fillStyle(0xb04ae0).fillRect(320, 66, (400 * Math.max(0, boss.hp)) / boss.maxHp, 14);
      o.lineStyle(1, 0xffffff, 0.5).strokeRect(320, 66, 400, 14);
    }

    // 설치 / 조준 미리보기 (3D는 바닥 표시를 render3d가 그리고, 여기서는 반투명 가전 그림만)
    if (this.placing && this.ghost) {
      const def = gm.cfg.units[this.placing];
      if (!this.board) {
        const ok = gm.canPlace(this.placing, this.ghost.x, this.ghost.y) === null;
        const color = ok ? 0x3fae55 : 0xe5484d;
        const r = def.levels[0].range;
        if (r > 0) drawRange(o, this.ghost.x, this.ghost.y, r, color, t);
        const grid = gm.cfg.map.grid;
        if (grid) {
          const h = grid.size / 2 - 2;
          o.fillStyle(color, 0.4).fillRoundedRect(this.ghost.x - h, this.ghost.y - h, h * 2, h * 2, 8);
          o.lineStyle(3, color, 0.9).strokeRoundedRect(this.ghost.x - h, this.ghost.y - h, h * 2, h * 2, 8);
        } else {
          o.fillStyle(color, 0.35).fillCircle(this.ghost.x, this.ghost.y, def.radius + 4);
        }
      }
      // 놓일 가전을 반투명하게 미리 보여 준다
      if (this.ghostIcon?.id !== this.placing) {
        this.ghostIcon?.icon.destroy();
        this.ghostIcon = { id: this.placing, icon: icon(this, 0, 0, this.placing, def.emoji, def.radius * 2.9).setDepth(5.5).setAlpha(0.75) };
        if (this.board) this.ghostIcon.icon.setOrigin(0.5, FEET);
      }
      const at = this.board ? this.sp(this.ghost.x, this.ghost.y) : this.ghost;
      this.ghostIcon.icon.setPosition(at.x, at.y);
    } else if (this.ghostIcon) {
      this.ghostIcon.icon.destroy();
      this.ghostIcon = null;
    }
    if (this.aiming && this.ghost && !this.board) {
      const r = gm.abilityStats(this.aiming).radius ?? 0;
      drawRange(o, this.ghost.x, this.ghost.y, r, 0xa57be0, t);
    }
  }

  private renderHud(): void {
    const gm = this.sim;
    const t = this.clock;
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
    const reward = gm.clearRewardPreview();
    this.rewardText.setText(
      reward ? STR.rewardPreview(reward.wave, reward.bonus, reward.income, clearParts(reward.wave, gm.totalWaves, this.setup.difficulty)) : '',
    );
    const am = gm.activeMod;
    this.modLabel.setText(am ? `${am.emoji} ${STR.waveMods[am.id].name}: ${STR.waveMods[am.id].desc}` : '');
    this.pauseBtn.setEnabled(!gm.finished && !this.picking);
    this.viewBtn.container.setVisible(!!this.board && this.board.view.zoom > 1.01);
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
    const lv = u ? this.sim.stats(u) : this.sim.levelStats(id, 0);
    const name = STR.units[id];
    const br = u && u.branch !== null ? def.branches![u.branch] : null;
    const title = br ? `${br.emoji} ${STR.branches[br.id].full}` : `${def.emoji} ${name.name}`;
    // 이름이 긴 언어에서는 글씨를 줄여 패널 폭에 맞춘다
    fitText(this.info.title.setFontSize(20).setText(`${title}${u ? `  ${STR.level(level + 1)}${u.stars ? ` ${STR.stars(u.stars)}` : ''}` : ''}`), PANEL_W - 48, 12);
    const s = STR.stats;
    const opts = u ? this.sim.upgradeOptions(u) : [];
    const atFork = opts.length === 2;
    // 갈림길에서는 설명과 스탯 대신 두 갈래 설명만 보여 준다 (패널 공간이 좁다)
    const lines = atFork ? [] : [br ? STR.branches[br.id].desc : name.desc, ''];
    if (atFork) {
      // 지금 능력을 짧은 한 줄로 (갈래 버튼의 DPS와 비교할 수 있게). 보라색 갈래 버튼이 고르라는 표시를 대신한다
      const cur = this.sim.dps(id, lv, u ?? undefined);
      const now: string[] = [];
      if (cur.dps) now.push(`DPS ${dpsText(cur)}`);
      else if (lv.slow) now.push(`${s.slow} ${Math.round((1 - lv.slow) * 100)}%`);
      else if (lv.buff) now.push(`${s.buff} ${Math.round(lv.buff * 100)}%`);
      else if (lv.income) now.push(`💰${lv.income}`);
      if (lv.range) now.push(`${STR.rangeShort} ${Math.round(lv.range)}`);
      lines.push(now.length ? `${STR.nowStats} ${now.join(' · ')}` : STR.branchPrompt);
      for (const b of def.branches!) lines.push(`${b.emoji} ${STR.branches[b.id].name}: ${STR.branches[b.id].desc}`);
    }
    const n1 = (v: number) => String(Math.round(v * 10) / 10);
    if (!atFork) {
      const cur = this.sim.dps(id, lv, u ?? undefined);
      if (cur.dps) {
        // 업그레이드하면 얼마나 오르는지 같이 보여 준다
        const next = u && opts.length === 1
          ? this.sim.dps(id, opts[0].star ? this.sim.levelStats(id, level, u.branch, u.stars + 1) : this.sim.levelStats(id, level + 1), u)
          : null;
        const area = def.kind === 'slow' || lv.hitAll || lv.line || lv.splash ? ` ${s.perEnemy}` : '';
        lines.push(`${s.dps} ${dpsText(cur)}${next ? ` → ${dpsText(next)}` : ''}${area}`);
      }
      // 지원형 수치도 업그레이드·★강화하면 얼마나 오르는지 (→) 보여 준다
      const nx = u && opts.length === 1 ? (opts[0].star ? this.sim.levelStats(id, level, u.branch, u.stars + 1) : this.sim.levelStats(id, level + 1)) : null;
      const to = (a: number | undefined, b: number | undefined, f: (v: number) => string) =>
        `${f(a ?? 0)}${b !== undefined && f(b) !== f(a ?? 0) ? ` → ${f(b)}` : ''}`;
      const pct = (v: number) => `${Math.round(v * 100)}%`;
      if (lv.damage) lines.push(lv.cooldown ? s.hit(n1(lv.damage), Math.round(lv.cooldown * 100) / 100) : `${s.damage} ${n1(lv.damage)}`);
      if (lv.range) lines.push(`${s.range} ${Math.round(lv.range)}`);
      if (lv.splash) lines.push(`${s.splash} ${Math.round(lv.splash)}`);
      if (lv.slow) lines.push(`${s.slow} ${to(1 - lv.slow, nx?.slow === undefined ? undefined : 1 - nx.slow, pct)}`);
      if (lv.knockback) lines.push(`${s.knockback} ${to(lv.knockback, nx?.knockback, (v) => String(Math.round(v)))}`);
      if (lv.freeze) lines.push(`${s.freeze} ${to(lv.freeze, nx?.freeze, (v) => s.seconds(n1(v)))}`);
      if (lv.buff) lines.push(`${s.buff} ${to(lv.buff, nx?.buff, pct)}`);
      if (lv.income) lines.push(`${s.income} ${to(lv.income, nx?.income, (v) => `💰${v}`)}`);
      if (lv.bounty) lines.push(`${s.bounty} ${to(lv.bounty.mul - 1, nx?.bounty ? nx.bounty.mul - 1 : undefined, (v) => `+${pct(v)}`)}`);
      if (lv.dot) lines.push(`${s.dot} ${s.dotLine(lv.dot.dps, lv.dot.duration)}`);
      if (lv.chainHits) lines.push(`${s.chain} ${s.chainCount(lv.chainHits)}`);
      if (lv.dmgBuff) lines.push(`${s.dmgBuff} ${to(lv.dmgBuff, nx?.dmgBuff, pct)}`);
      if (lv.shred) lines.push(`${s.shred} ${lv.shred}`);
      if (lv.globalSlow) lines.push(`${s.globalSlow} ${to(lv.globalSlow, nx?.globalSlow, pct)}`);
      if (lv.globalVuln) lines.push(`${s.globalVuln} ${to(lv.globalVuln, nx?.globalVuln, (v) => `+${pct(v)}`)}`);
    }
    // 줄이 많으면(갈래 설명 + 지원 수치) 아래 버튼을 가리지 않게 글씨를 줄인다
    const key = lines.join('\n');
    if (this.info.stats.text !== key || this.info.stats.getData('lang') !== lang()) {
      this.info.stats.setData('lang', lang()).setFontSize(15).setText(key).setWordWrapWidth(PANEL_W - 48, true);
      for (let fs = 15; this.info.stats.height > 142 && fs > 10; fs--) this.info.stats.setFontSize(fs - 1);
    }
    const showControls = u !== null;
    this.info.upgrade.container.setVisible(showControls && !atFork);
    // '모두'는 종류와 갈래가 같은 가전이 2대 이상일 때만
    const same = u ? bulkGroup(this.sim, u).length : 0;
    this.info.upgradeAll.container.setVisible(showControls && !atFork && same >= 2);
    if (u) this.info.upgradeAll.setEnabled(nextBulkStep(this.sim, u) !== null);
    this.info.branchA.container.setVisible(showControls && atFork);
    this.info.branchB.container.setVisible(showControls && atFork);
    this.info.sell.container.setVisible(showControls);
    const attacks = def.kind === 'single' || def.kind === 'splash';
    this.info.target.container.setVisible(showControls && attacks);
    if (!u) return;
    if (atFork) {
      [this.info.branchA, this.info.branchB].forEach((b, i) => {
        const bd = def.branches![i];
        // 갈래 DPS는 버튼 안에 (설명 줄이 길어서 패널에는 자리가 없다)
        const d = this.sim.dps(id, this.sim.levelStats(id, level, i as 0 | 1), u);
        // 실제로 내는 값 (갈림길 할인·업그레이드 세일 카드 반영)
        const cost = opts[i].cost;
        b.setText(STR.branchButton(bd.emoji, STR.branches[bd.id].name, cost, d.dps ? Math.round(d.dps) : null));
        b.setEnabled(this.sim.money >= cost);
      });
    } else {
      const cost = opts[0]?.cost ?? null;
      this.info.upgrade.setText(cost === null ? STR.maxLevel : opts[0].star ? STR.starUp(cost) : STR.upgrade(cost));
      this.info.upgrade.setEnabled(cost !== null && this.sim.money >= cost);
    }
    this.info.sell.setText(STR.sell(this.sim.sellValue(u)));
    this.info.target.setText(STR.target(u.target));
  }

  // ───────────────────────── 이펙트

  private playEvent(raw: GameEvent): void {
    if (raw.type === 'shot') this.board?.onShot(raw.unit, raw.to);
    const ev = this.toScreen(raw);
    switch (ev.type) {
      case 'shot': {
        this.recoil(ev.unit);
        const { from, to } = ev;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const radius = this.sim.cfg.units[ev.kind].radius;
        // 갈래 전용 모양이 없으면 가전 기본 모양을 쓴다 (뽑기 가전 갈래)
        const style = (ev.branch ? BRANCH_SHOT[ev.branch] : undefined) ?? KIND_SHOT[ev.kind];
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
        this.progress.killsBy[ev.enemy] = (this.progress.killsBy[ev.enemy] ?? 0) + 1;
        if (ev.enemy === 'sixseven') this.progress.sixseven++;
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
      case 'bolt':
        for (let i = 1; i < ev.points.length; i++) {
          const a = ev.points[i - 1];
          const b = ev.points[i];
          this.fx.tracer(a.x, a.y, b.x, b.y, 0xffe14a, 3, 140);
          if (i > 1) this.fx.impact(b.x, b.y, 0xffe14a);
        }
        break;
      case 'heal':
        this.fx.heal(ev.x, ev.y, ev.r);
        break;
      case 'weigh': {
        // 식스세븐이 6 또는 7을 골랐다: 머리 위에 큰 숫자
        this.floatText(ev.x, ev.y - 26, STR.weigh(ev.mode), ev.mode === 6 ? '#4f8fd0' : THEME.danger, 26);
        if (this.weighHints < 1) {
          this.showToast(STR.weighHint, 3);
          this.weighHints++;
        }
        break;
      }
      case 'sixtySeven':
        this.pop67(STR.sixtySeven(ev.kills));
        this.cameras.main.flash(200, 255, 220, 120);
        sfx.play('coin');
        break;
      case 'taunt': {
        // L 포즈: 보스 위에 글자, 약 오른 가전마다 💢
        this.floatText(ev.x, ev.y - 30, '💢', THEME.pink, 30);
        this.popTaunt(ev.units.length > 0);
        this.board?.taunt(ev.enemy, this.clock);
        for (const uid of ev.units) {
          const u = this.sim.findUnit(uid);
          if (!u) continue;
          const at = this.sp(u.x, u.y, u.def.radius * 2.4);
          this.floatText(at.x, at.y, '💢', THEME.danger, 22);
        }
        sfx.play('error');
        break;
      }
      case 'waveStart':
        if (ev.mod) this.banner(STR.modBanner(ev.mod.emoji, STR.waveMods[ev.mod.id].name), '#ffd35a');
        else {
          // 보스마다 등장 문구가 다르다
          const bossId = this.sim.waveDef(ev.wave)?.groups.map((g) => g.enemy).find((id) => this.sim.cfg.enemies[id].boss);
          const bossText = (bossId && STR.bossBanners[bossId]) || STR.bossBanner;
          if (ev.wave === 67 && !ev.boss) this.pop67(STR.wave67Sub);
          else this.banner(ev.boss ? bossText : STR.waveBanner(ev.wave), ev.boss ? '#ff6b6b' : '#ffffff');
        }
        if (ev.boss) {
          this.cameras.main.shake(800, 0.006);
          sfx.play('boss');
        } else sfx.play('wave');
        break;
      case 'waveCleared':
        this.run.cleared = ev.wave;
        {
          // 판 보상: 웨이브마다 부품, 20웨이브를 깨면 보너스
          const gain = clearParts(ev.wave, this.sim.totalWaves, this.setup.difficulty);
          this.progress.parts += gain;
          this.runParts += gain;
          this.run.endless = this.sim.endless;
          this.checkAchievements();
          this.banner(STR.clearBanner(ev.bonus + ev.income, gain), '#ffd35a', 0.8);
          this.showToast(STR.clearDetail(ev.bonus, ev.income, gain), 3);
        }
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
    syncEmojis(this, this.unitEmojis, this.sim.units.map((u) => ({ uid: u.uid, x: u.x, y: u.y, key: u.def.id, emoji: u.def.emoji, size: u.def.radius * 2.9 })), 2, true);
  }

  private popIn(u: Unit | undefined): void {
    if (!u) return;
    const at = this.sp(u.x, u.y, 10);
    this.burst(at.x, at.y, 0xffffff, 6);
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

  /** 화면 가운데 큰 알림 (같은 종류가 이미 떠 있으면 새것으로 바꾼다) */
  private pops = new Map<string, Phaser.GameObjects.Container>();
  private bigPop(kind: string, parts: Phaser.GameObjects.GameObject[], hold: number): Phaser.GameObjects.Container {
    this.pops.get(kind)?.destroy();
    // 맵 가운데 (오른쪽 패널 제외)
    const c = this.add.container(PANEL_X / 2, 330, parts).setDepth(46).setScale(0.2).setAlpha(0);
    this.pops.set(kind, c);
    this.tweens.chain({
      targets: c,
      tweens: [
        { scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' },
        { scale: 1.04, duration: hold, yoyo: false },
        { scale: 1.35, alpha: 0, duration: 260, ease: 'Quad.easeIn' },
      ],
      onComplete: () => {
        c.destroy();
        if (this.pops.get(kind) === c) this.pops.delete(kind);
      },
    });
    return c;
  }

  /** 67! 파란 6과 빨간 7이 손바닥 저울질하듯 번갈아 오르내린다 */
  private pop67(sub: string): void {
    const big = (s: string, x: number, color: string) =>
      text(this, x, 0, s, 190, color).setOrigin(0.5).setStroke('#ffffff', 14).setShadow(0, 6, 'rgba(0,0,0,0.35)', 8);
    const six = big('6', -62, '#3f86d6');
    const seven = big('7', 62, '#e5484d');
    const shrug = text(this, 0, -128, '🤷', 64).setOrigin(0.5);
    const label = text(this, 0, 128, sub, 30, THEME.gold).setOrigin(0.5).setStroke('#4a3b34', 7);
    this.bigPop('67', [six, seven, shrug, label], 1500);
    this.tweens.add({ targets: six, y: -22, duration: 230, yoyo: true, repeat: 3, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: seven, y: -22, duration: 230, yoyo: true, repeat: 3, delay: 230, ease: 'Sine.easeInOut' });
  }

  /** L을 가져가! 분홍 글씨가 흔들리며 튀어나온다 */
  private popTaunt(hit: boolean): void {
    const main = text(this, 0, 0, STR.taunt, 92, '#ff5fa2').setOrigin(0.5).setStroke('#ffffff', 12).setShadow(0, 5, 'rgba(0,0,0,0.3)', 8);
    const parts: Phaser.GameObjects.GameObject[] = [main];
    if (hit) parts.push(text(this, 0, 78, STR.tauntSub, 26, THEME.text).setOrigin(0.5).setStroke('#ffffff', 6));
    this.bigPop('taunt', parts, 700);
    main.setAngle(-8);
    this.tweens.add({ targets: main, angle: 8, duration: 120, yoyo: true, repeat: 3, ease: 'Sine.easeInOut', onComplete: () => main.setAngle(0) });
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

  /** 덱 편성 화면: 가진 가전 중 최대 6종을 고른다 */
  /**
   * 시작 화면 위에 뜨는 창(도감·업적·덱·뽑기). 창이 열려 있는 동안 아래 시작 화면 버튼은 눌리지 않게 막는다.
   * (Phaser는 마지막 렌더 순서로 맨 위 물체를 고르는데, 그리는 도중에 누르면 아래 버튼이 눌릴 수 있다)
   */
  private modalLayer(): Phaser.GameObjects.Container {
    const layer = this.add.container(0, 0).setDepth(80);
    const under = this.pickerLayer;
    const setInput = (on: boolean) => {
      if (!under?.active) return;
      const walk = (o: Phaser.GameObjects.GameObject) => {
        if (o.input) o.input.enabled = on;
        if (o instanceof Phaser.GameObjects.Container) o.list.forEach(walk);
      };
      walk(under);
    };
    setInput(false);
    layer.once(Phaser.GameObjects.Events.DESTROY, () => {
      // 창을 닫는 그 클릭이 아래 버튼까지 누르지 않게 한 박자 늦게 푼다
      this.time.delayedCall(0, () => {
        const other = this.children.list.some((o) => o !== layer && o.active && o instanceof Phaser.GameObjects.Container && o.depth === 80);
        if (!other) setInput(true);
      });
    });
    return layer;
  }

  private showDeck(): void {
    const { width, height } = this.sim.cfg.map;
    const layer = this.modalLayer();
    const reopen = () => {
      layer.destroy();
      this.showDeck();
    };
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.7).setOrigin(0).setInteractive();
    const p = this.progress;
    // 숙련도가 켜져 있으면 카드 아래에 강화 줄이 붙어서 창이 더 크다
    const meta = META.enabled;
    const top = meta ? 86 : 132;
    const box = card(this, width / 2, height / 2, 800, meta ? 620 : 520, 'center', THEME.bar);
    const title = text(this, width / 2 - 370, top, STR.deckTitle, 30).setOrigin(0, 0.5);
    const parts = text(this, width / 2 + 230, top, meta ? STR.gachaParts(p.parts) : '', 18, THEME.gold).setOrigin(1, 0.5);
    const hint = text(this, width / 2, top + (meta ? 44 : 48), STR.deckHint(this.deck.length, DECK_SIZE), 18, THEME.textSoft).setOrigin(0.5);
    const note = text(this, width / 2, 154, meta ? STR.masteryHint(Math.round(MASTERY.power * 100), Math.round(MASTERY.support * 100)) : '', 14, THEME.textSoft).setOrigin(0.5);
    const warn = text(this, width / 2, meta ? 648 : 560, '', 17, THEME.danger).setOrigin(0.5);
    // 닫으면 덱을 저장하고 시작 화면을 다시 그린다 (상점이 새 덱으로 바뀐다)
    const close = button(this, width / 2 + 310, top, 130, 44, STR.close, () => {
      saveDeck(this.deck);
      this.scene.restart({});
    }, THEME.green, 18);
    layer.add([dim, box, title, parts, hint, note, warn, close.container]);
    const all: UnitId[] = [...UNIT_ORDER, ...GACHA_UNITS];
    all.forEach((id, i) => {
      const def = this.sim.cfg.units[id];
      const x = width / 2 + ((i % 6) - 2.5) * 125;
      const y = meta ? 250 + Math.floor(i / 6) * 225 : 285 + Math.floor(i / 6) * 160;
      const owned = UNIT_ORDER.includes(id) || this.progress.owned.includes(id);
      const inDeck = this.deck.includes(id);
      const rarity = GACHA_POOL[id];
      const bg = new RoundBox(this, x, y, 112, 140, !owned ? THEME.neutral : inDeck ? 0xfff0c8 : THEME.white, 14)
        .setStrokeStyle(inDeck ? 5 : 3, inDeck ? THEME.selected : rarity ? RARITY_COLOR[rarity] : THEME.cardLine);
      const ic = icon(this, x, y - 26, id, def.emoji, 62).setAlpha(owned ? 1 : 0.35);
      const name = text(this, x, y + 26, STR.units[id].name, 15, owned ? THEME.text : THEME.textSoft).setOrigin(0.5);
      const sub = text(this, x, y + 48, owned ? (rarity ? STR.gachaRarity[rarity] : `💰${def.levels[0].cost}`) : STR.locked, 12, THEME.textSoft).setOrigin(0.5);
      layer.add([bg, ic, name, sub]);
      if (!owned) return;
      // 숙련도: 카드 아래에 레벨과 강화 버튼
      const lv = masteryLevel(p, id);
      const cost = masteryCost(p, id);
      const tag = text(this, x, y + 84, `${'★'.repeat(lv)}${'☆'.repeat(MASTERY.max - lv)}`, 15, lv ? THEME.gold : THEME.textSoft).setOrigin(0.5);
      const up = button(this, x, y + 114, 108, 36, cost === null ? STR.masteryMax : STR.masteryBuy(cost), () => {
        if (!buyMastery(p, id)) return sfx.play('error');
        saveProgress(p);
        sfx.play('upgrade');
        reopen();
      }, cost === null ? THEME.neutral : THEME.purple, 15);
      up.setEnabled(cost !== null && p.parts >= cost);
      if (meta) layer.add([tag, up.container]);
      else {
        tag.destroy();
        up.container.destroy();
      }
      bg.setInteractive(new Phaser.Geom.Rectangle(-56, -70, 112, 140), Phaser.Geom.Rectangle.Contains);
      if (bg.input) bg.input.cursor = 'pointer';
      bg.on('pointerup', () => {
        if (inDeck) {
          if (this.deck.length <= 1) return warn.setText(STR.deckMin);
          this.deck = this.deck.filter((u) => u !== id);
        } else {
          if (this.deck.length >= DECK_SIZE) return warn.setText(STR.deckFull);
          this.deck = [...this.deck, id];
        }
        sfx.play('place');
        reopen();
      });
    });
  }

  /** 뽑기 화면. results가 있으면 방금 뽑은 결과를 보여 준다 */
  private showGacha(results: PullResult[] = []): void {
    const { width, height } = this.sim.cfg.map;
    const p = this.progress;
    const layer = this.modalLayer();
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.7).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 800, 600, 'center', THEME.bar);
    const title = text(this, width / 2 - 370, 92, STR.gachaTitle, 30).setOrigin(0, 0.5);
    const parts = text(this, width / 2 + 230, 92, STR.gachaParts(p.parts), 20, THEME.gold).setOrigin(1, 0.5);
    const close = button(this, width / 2 + 310, 92, 130, 44, STR.close, () => this.scene.restart({}), THEME.neutral, 18);
    const info = text(this, width / 2, 140, `${STR.gachaRates}   ·   ${STR.gachaPity(GACHA.pity - p.pity)}${META.enabled ? `   ·   ${STR.gachaDupNote}` : ''}`, 15, THEME.textSoft).setOrigin(0.5);
    layer.add([dim, box, title, parts, close.container, info]);
    const doPull = (n: 1 | 10) => {
      const r = pull(p, n);
      if (!r) return sfx.play('error');
      saveProgress(p);
      sfx.play(r.some((x) => !x.duplicate || x.mastery) ? 'win' : 'coin');
      layer.destroy();
      this.showGacha(r);
    };
    const one = button(this, width / 2 - 140, 200, 250, 56, STR.gachaOne(GACHA.cost), () => doPull(1), THEME.purple, 20);
    const ten = button(this, width / 2 + 140, 200, 250, 56, STR.gachaTen(GACHA.cost10), () => doPull(10), THEME.orange, 20);
    one.setEnabled(p.parts >= GACHA.cost);
    ten.setEnabled(p.parts >= GACHA.cost10);
    layer.add([one.container, ten.container]);
    // 방금 뽑은 결과: 한 장씩 튀어나온다
    results.forEach((r, i) => {
      const x = width / 2 + (i - (results.length - 1) / 2) * 74;
      const def = this.sim.cfg.units[r.unit as UnitId];
      const bg = new RoundBox(this, 0, 0, 66, 96, r.duplicate ? THEME.white : 0xfff0c8, 12).setStrokeStyle(4, RARITY_COLOR[r.rarity]);
      const ic = icon(this, 0, -14, r.unit, def.emoji, 50);
      const tag = r.mastery
        ? text(this, 0, 32, STR.gachaMastery, 13, THEME.gold).setOrigin(0.5)
        : text(this, 0, 32, r.duplicate ? STR.gachaDup(r.refund) : STR.gachaNew, r.duplicate ? 11 : 15, r.duplicate ? THEME.textSoft : THEME.danger).setOrigin(0.5);
      const c = this.add.container(x, 330, [bg, ic, tag]).setScale(0);
      layer.add(c);
      this.tweens.add({ targets: c, scale: 1, delay: i * 70, duration: 240, ease: 'Back.easeOut' });
    });
    // 수집 현황
    GACHA_UNITS.forEach((id, i) => {
      const def = this.sim.cfg.units[id];
      const x = width / 2 + (i - 2.5) * 125;
      const y = 500;
      const owned = p.owned.includes(id);
      const rarity = GACHA_POOL[id];
      const bg = new RoundBox(this, x, y, 112, 150, owned ? THEME.white : THEME.neutral, 14).setStrokeStyle(3, RARITY_COLOR[rarity]);
      const ic = icon(this, x, y - 34, id, def.emoji, 56).setAlpha(owned ? 1 : 0.35);
      const name = text(this, x, y + 10, STR.units[id].name, 15, owned ? THEME.text : THEME.textSoft).setOrigin(0.5);
      const rar = text(this, x, y + 32, STR.gachaRarity[rarity], 13, THEME.textSoft).setOrigin(0.5);
      const st = text(this, x, y + 54, owned ? `✅ ${META.enabled ? STR.masteryTag(masteryLevel(p, id), MASTERY.max) : STR.gachaOwned}` : '🔒', 13, owned ? THEME.gold : THEME.textSoft).setOrigin(0.5);
      layer.add([bg, ic, name, rar, st]);
    });
  }

  /** 설정 화면: 언어와 효과음 */
  private showSettings(): void {
    const { width, height } = this.sim.cfg.map;
    const layer = this.modalLayer();
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.7).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 560, 560, 'center', THEME.bar);
    const title = text(this, width / 2 - 250, 122, STR.settingsTitle, 30).setOrigin(0, 0.5);
    const close = button(this, width / 2 + 190, 122, 130, 44, STR.close, () => layer.destroy(), THEME.green, 18);
    const langLabel = text(this, width / 2, 176, STR.language, 18, THEME.textSoft).setOrigin(0.5);
    layer.add([dim, box, title, close.container, langLabel]);
    LANGS.forEach((l, i) => {
      const on = l.id === lang();
      // 언어 이름은 그 언어로 적는다 (지금 언어를 못 읽어도 찾을 수 있게). 고르면 화면을 새 언어로 다시 그린다
      const b = button(this, width / 2, 226 + i * 58, 420, 50, l.name, () => {
        if (on) return;
        setLang(l.id);
        this.scene.restart({});
      }, on ? 0xfff0c8 : THEME.white, 20);
      b.bg.setStrokeStyle(on ? 4 : 2, on ? THEME.selected : THEME.cardLine);
      layer.add(b.container);
    });
    const soundY = 226 + LANGS.length * 58 + 44;
    const soundLabel = text(this, width / 2, soundY - 40, STR.sound, 18, THEME.textSoft).setOrigin(0.5);
    const sound = button(this, width / 2, soundY, 420, 50, sfx.muted ? STR.soundOff : STR.soundOn, () => {
      const muted = sfx.toggleMute();
      sound.setText(muted ? STR.soundOff : STR.soundOn);
      this.muteBtn.setText(muted ? '🔇' : '🔊');
    }, THEME.blue, 20);
    layer.add([soundLabel, sound.container]);
  }

  /** 연구 화면: 부품으로 올리는 영구 강화 */
  private showResearch(): void {
    const { width, height } = this.sim.cfg.map;
    const p = this.progress;
    const layer = this.modalLayer();
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.7).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 800, 640, 'center', THEME.bar);
    const title = text(this, width / 2 - 370, 76, STR.researchTitle, 30).setOrigin(0, 0.5);
    const parts = text(this, width / 2 + 230, 76, STR.gachaParts(p.parts), 18, THEME.gold).setOrigin(1, 0.5);
    // 닫으면 시작 화면을 다시 그린다 (연구가 다음 판 설정에 반영된다)
    const close = button(this, width / 2 + 310, 76, 130, 44, STR.close, () => this.scene.restart({}), THEME.green, 18);
    const hint = text(this, width / 2, 118, STR.researchHint, 16, THEME.textSoft).setOrigin(0.5);
    layer.add([dim, box, title, parts, close.container, hint]);
    RESEARCH.forEach((r, i) => {
      const y = 180 + i * 72;
      const lv = researchLevel(p, r.id);
      const max = r.costs.length;
      const cost = researchCost(p, r.id);
      const info = STR.research[r.id];
      const row = new RoundBox(this, width / 2, y, 760, 62, lv >= max ? 0xfff0c8 : THEME.white, 12).setStrokeStyle(2, lv >= max ? THEME.selected : THEME.cardLine);
      const name = text(this, width / 2 - 360, y - 12, `${r.emoji} ${info.name}`, 19).setOrigin(0, 0.5);
      const now = lv > 0 ? `  (${info.now(r.step * lv)})` : '';
      const desc = text(this, width / 2 - 360, y + 14, `${max > 1 ? STR.researchPerLevel(info.desc(r.step)) : info.desc(r.step)}${now}`, 14, THEME.textSoft).setOrigin(0, 0.5);
      const level = text(this, width / 2 + 150, y, STR.researchLevel(lv, max), 17, lv ? THEME.gold : THEME.textSoft).setOrigin(0.5);
      const buy = button(this, width / 2 + 285, y, 150, 44, cost === null ? STR.researchDone : STR.researchBuy(cost), () => {
        if (!buyResearch(p, r.id)) return sfx.play('error');
        saveProgress(p);
        sfx.play('upgrade');
        layer.destroy();
        this.showResearch();
      }, cost === null ? THEME.neutral : THEME.purple, 17);
      buy.setEnabled(cost !== null && p.parts >= cost);
      layer.add([row, name, desc, level, buy.container]);
    });
  }

  /** 업적 목록 화면 (시작 화면에서 연다) */
  // ───────────────────────── 몬스터 소개 카드와 도감

  /** 맵에 처음 보는 몬스터가 나오면 소개 카드를 띄운다 (한 번 본 몬스터는 저장해서 다시 안 띄움) */
  private checkNewEnemies(): void {
    for (const e of this.sim.enemies) {
      const id = e.def.id;
      if (this.progress.seen.includes(id)) continue;
      this.progress.seen.push(id);
      saveProgress(this.progress);
      this.introQueue.push(id);
    }
    if (!this.introLayer && this.introQueue.length && !this.pauseLayer && !this.sim.finished) this.showIntro(this.introQueue.shift()!);
  }

  /** 몬스터 그림: 동작 시트가 있으면 반복 재생, 없으면 정지 그림 */
  private portrait(id: string, emoji: string, x: number, y: number, size: number): Phaser.GameObjects.GameObject & { setAlpha(a: number): unknown } {
    const key = `${id}_anim`;
    if (this.anims.exists(key)) {
      // 시트 한 칸은 정지 그림보다 여백이 많아(모든 프레임을 담는 고정 카메라) 조금 크게
      return this.add.sprite(x, y, key).setDisplaySize(size * 1.45, size * 1.45).play(key);
    }
    return icon(this, x, y, id, emoji, size);
  }

  /** 체력·속도·방어 막대 (보스처럼 큰 값도 비교되게 제곱근 눈금) */
  private statBars(layer: Phaser.GameObjects.Container, id: EnemyId, x: number, y: number, w: number): void {
    const all = BESTIARY.map((k) => this.sim.cfg.enemies[k]);
    const def = this.sim.cfg.enemies[id];
    const rows: [string, number, number, number][] = [
      [STR.statHp, Math.sqrt(def.hp), Math.max(...all.map((d) => Math.sqrt(d.hp))), 0xff6b6b],
      [STR.statSpeed, def.speed, Math.max(...all.map((d) => d.speed)), 0x4fb3e8],
      [STR.statArmor, def.armor, Math.max(...all.map((d) => d.armor)), 0x9aa0b4],
    ];
    rows.forEach(([label, v, max, color], i) => {
      const yy = y + i * 26;
      const g = this.add.graphics();
      g.fillStyle(0xe8dccb).fillRoundedRect(x + 56, yy - 7, w - 56, 14, 7);
      if (v > 0) g.fillStyle(color).fillRoundedRect(x + 56, yy - 7, Math.max(14, ((w - 56) * v) / max), 14, 7);
      layer.add([text(this, x, yy, label, 15, THEME.textSoft).setOrigin(0, 0.5), g]);
    });
  }

  /** 첫 등장 소개 카드: 그림, 이름, 특징, 대응 팁. 누르면 게임 계속 */
  private showIntro(id: EnemyId): void {
    const { width, height } = this.sim.cfg.map;
    const def = this.sim.cfg.enemies[id];
    const info = STR.enemies[id];
    const boss = !!def.boss;
    const cx = width / 2 - 120, cy = height / 2 + 10;
    const layer = this.add.container(0, 0).setDepth(85);
    this.introLayer = layer;
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.45).setOrigin(0).setInteractive();
    const box = card(this, cx, cy, 560, 470, 'center', THEME.bar).setStrokeStyle(4, boss ? 0xff6b6b : THEME.selected);
    const tag = text(this, cx, cy - 205, boss ? STR.introBoss : STR.introNew, 22, boss ? THEME.danger : THEME.gold).setOrigin(0.5);
    const pic = this.portrait(id, def.emoji, cx - 160, cy - 80, 150);
    const name = text(this, cx - 60, cy - 140, `${def.emoji} ${info.name}`, 30).setOrigin(0, 0.5);
    const desc = text(this, cx - 60, cy - 110, info.desc, 17, THEME.text).setWordWrapWidth(300, true).setLineSpacing(4);
    layer.add([dim, box, tag, pic, name, desc]);
    this.statBars(layer, id, cx - 240, cy + 30, 220);
    const tipBox = new RoundBox(this, cx, cy + 135, 500, 76, 0xfff6d8, 12, 0, 'center').setStrokeStyle(2, 0xf0d890);
    const tip = text(this, cx - 235, cy + 112, `${STR.tipLabel}
${info.tip}`, 16, THEME.text).setWordWrapWidth(470, true).setLineSpacing(3);
    const saved = text(this, cx + 150, cy + 72, STR.introSaved, 14, THEME.textSoft).setOrigin(0.5);
    const ok = button(this, cx + 150, cy + 30, 160, 48, STR.introOk, () => close(), THEME.green, 19);
    layer.add([tipBox, tip, saved, ok.container]);
    // 살짝 커지며 등장
    layer.setScale(0.9).setAlpha(0);
    this.tweens.add({ targets: layer, scale: 1, alpha: 1, duration: 180, ease: 'Back.easeOut' });
    sfx.play(boss ? 'boss' : 'wave');
    const close = () => {
      layer.destroy();
      this.introLayer = null;
      if (this.introQueue.length) this.showIntro(this.introQueue.shift()!);
    };
  }

  /** 도감: 만난 몬스터는 그림과 이름, 못 만난 몬스터는 실루엣과 ???. 누르면 오른쪽에 자세한 정보 */
  private showBestiary(tab: 'enemies' | 'units' = 'enemies'): void {
    const { width, height } = this.sim.cfg.map;
    const p = this.progress;
    const layer = this.modalLayer();
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.7).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 1000, 690, 'center', THEME.bar);
    const title = text(this, width / 2 - 470, 40, STR.bestiaryTitle, 30).setOrigin(0, 0.5);
    const close = button(this, width / 2 + 410, 40, 130, 44, STR.close, () => layer.destroy(), THEME.neutral, 18);
    layer.add([dim, box, title, close.container]);
    // 탭: 하수구 군단 / 가전 수비대
    const owned = [...UNIT_ORDER, ...GACHA_UNITS].filter((u) => UNIT_ORDER.includes(u) || p.owned.includes(u)).length;
    (['enemies', 'units'] as const).forEach((t, i) => {
      const label = `${STR.bestiaryTabs[t]} ${t === 'enemies' ? `${p.seen.length}/${BESTIARY.length}` : `${owned}/${UNIT_ORDER.length + GACHA_UNITS.length}`}`;
      const b = button(this, width / 2 - 200 + i * 230, 40, 220, 44, label, () => {
        if (t === tab) return;
        layer.destroy();
        this.showBestiary(t);
      }, t === tab ? THEME.green : THEME.neutral, 16);
      layer.add(b.container);
    });
    if (tab === 'units') {
      this.unitCodex(layer);
      return;
    }
    // 오른쪽 자세히 보기
    const detail = this.add.container(0, 0);
    layer.add(detail);
    const dx = width / 2 + 120;
    const show = (id: EnemyId) => {
      detail.removeAll(true);
      const def = this.sim.cfg.enemies[id];
      const panel = new RoundBox(this, dx, 90, 360, 590, THEME.white, 14, 0, 'topleft').setStrokeStyle(2, THEME.cardLine);
      detail.add(panel);
      if (!p.seen.includes(id)) {
        const shadow = icon(this, dx + 180, 230, id, def.emoji, 170);
        if ('setTintFill' in shadow) shadow.setTintFill(0x3a3341);
        shadow.setAlpha(0.35);
        detail.add([shadow, text(this, dx + 180, 370, STR.unknown, 34, THEME.textSoft).setOrigin(0.5), text(this, dx + 180, 410, STR.bestiaryLocked, 17, THEME.textSoft).setOrigin(0.5)]);
        return;
      }
      const info = STR.enemies[id];
      detail.add([
        this.portrait(id, def.emoji, dx + 180, 200, 150),
        text(this, dx + 180, 300, `${def.emoji} ${info.name}${def.boss ? '  ⚠' : ''}`, 26).setOrigin(0.5),
        text(this, dx + 20, 330, info.desc, 15, THEME.text).setWordWrapWidth(320, true).setLineSpacing(3),
      ]);
      this.statBars(detail, id, dx + 20, 450, 320);
      detail.add([
        text(this, dx + 20, 535, `${STR.tipLabel}
${info.tip}`, 15, THEME.text).setWordWrapWidth(320, true).setLineSpacing(3),
        text(this, dx + 20, 640, `${STR.firstWave(firstWave(id))}   ${STR.killCount(p.killsBy[id] ?? 0)}`, 15, THEME.textSoft),
      ]);
    };
    // 왼쪽 격자 (4열)
    BESTIARY.forEach((id, i) => {
      const x = width / 2 - 420 + (i % 4) * 130;
      const y = 140 + Math.floor(i / 4) * 140;
      const def = this.sim.cfg.enemies[id];
      const seen = p.seen.includes(id);
      const cell = new RoundBox(this, x, y, 118, 128, seen ? THEME.white : 0xeee6da, 12, 0, 'center').setStrokeStyle(2, def.boss && seen ? 0xff9a9a : THEME.cardLine);
      // 둥근 상자는 클릭 영역을 따로 줘야 해서, 같은 크기의 투명한 사각형으로 누른다
      const hit = this.add.rectangle(x, y, 118, 128, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => show(id));
      const pic = icon(this, x, y - 14, id, def.emoji, 78);
      if (!seen) {
        if ('setTintFill' in pic) pic.setTintFill(0x3a3341);
        pic.setAlpha(0.35);
      }
      const label = text(this, x, y + 46, seen ? STR.enemies[id].name : STR.unknown, 15, seen ? THEME.text : THEME.textSoft).setOrigin(0.5);
      layer.add([cell, pic, label, hit]);
    });
    const firstSeen = BESTIARY.find((id) => p.seen.includes(id));
    if (firstSeen) show(firstSeen);
    else detail.add(text(this, dx + 180, 380, STR.bestiaryPick, 18, THEME.textSoft).setOrigin(0.5));
  }

  /** 가전 도감: 가진 가전은 역할·레벨별 성능·갈래, 못 뽑은 가전은 실루엣 */
  private unitCodex(layer: Phaser.GameObjects.Container): void {
    const { width } = this.sim.cfg.map;
    const p = this.progress;
    const all = [...UNIT_ORDER, ...GACHA_UNITS];
    const has = (u: UnitId) => UNIT_ORDER.includes(u) || p.owned.includes(u);
    const detail = this.add.container(0, 0);
    layer.add(detail);
    const dx = width / 2 + 120;
    const show = (id: UnitId) => {
      detail.removeAll(true);
      const def = this.sim.cfg.units[id];
      const rarity = GACHA_POOL[id];
      detail.add(new RoundBox(this, dx, 90, 360, 590, THEME.white, 14, 0, 'topleft').setStrokeStyle(2, rarity ? RARITY_COLOR[rarity] : THEME.cardLine));
      if (!has(id)) {
        const shadow = icon(this, dx + 180, 230, id, def.emoji, 170);
        if ('setTintFill' in shadow) shadow.setTintFill(0x3a3341);
        shadow.setAlpha(0.35);
        detail.add([
          shadow,
          text(this, dx + 180, 370, STR.unknown, 34, THEME.textSoft).setOrigin(0.5),
          text(this, dx + 180, 410, `${STR.unitLocked}${rarity ? ` (${STR.gachaRarity[rarity]})` : ''}`, 16, THEME.textSoft).setOrigin(0.5),
        ]);
        return;
      }
      const info = STR.units[id];
      // 레벨별 성능: 공격형은 DPS, 지원형은 효과
      const main = (lv: UnitLevel) => {
        const d = this.sim.dps(id, lv);
        if (d.dps) return STR.codex.dps(Math.round(d.dps));
        if (lv.buff) return STR.codex.buff(Math.round(lv.buff * 100));
        if (lv.dmgBuff) return STR.codex.dmgBuff(Math.round(lv.dmgBuff * 100));
        if (lv.income) return STR.codex.income(lv.income);
        if (lv.globalSlow) return STR.codex.globalSlow(Math.round(lv.globalSlow * 100));
        return '';
      };
      const lines = def.levels.map((_, i) => STR.levelLine(i + 1, main(this.sim.levelStats(id, i)), Math.round(def.levels[i].range), def.levels[i].cost));
      const branches = (def.branches ?? []).map((b, i) => `${b.emoji} ${STR.branches[b.id].name} (💰${b.cost}, ${main(this.sim.levelStats(id, def.levels.length, i as 0 | 1))}): ${STR.branches[b.id].desc}`);
      detail.add([
        icon(this, dx + 180, 165, id, def.emoji, 120),
        text(this, dx + 180, 248, `${def.emoji} ${info.name}${rarity ? `  ${STR.gachaRarity[rarity]}` : ''}`, 24).setOrigin(0.5),
        text(this, dx + 20, 272, `${info.desc}\n${STR.roleLabel(STR.roles[def.kind])}`, 14, THEME.text).setWordWrapWidth(320, true).setLineSpacing(3),
        text(this, dx + 20, 330, lines.join('\n'), 14, THEME.text).setLineSpacing(4),
        text(this, dx + 20, 405, `${STR.branchesLabel}\n${branches.join('\n')}`, 13, THEME.text).setWordWrapWidth(320, true).setLineSpacing(3),
        text(this, dx + 20, 650, STR.placedCount(p.placedBy[id] ?? 0), 15, THEME.textSoft),
      ]);
    };
    all.forEach((id, i) => {
      const x = width / 2 - 420 + (i % 4) * 130;
      const y = 140 + Math.floor(i / 4) * 140;
      const def = this.sim.cfg.units[id];
      const mine = has(id);
      const rarity = GACHA_POOL[id];
      const cell = new RoundBox(this, x, y, 118, 128, mine ? THEME.white : 0xeee6da, 12, 0, 'center').setStrokeStyle(2, rarity && mine ? RARITY_COLOR[rarity] : THEME.cardLine);
      const hit = this.add.rectangle(x, y, 118, 128, 0xffffff, 0).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => show(id));
      const pic = icon(this, x, y - 14, id, def.emoji, 78);
      if (!mine) {
        if ('setTintFill' in pic) pic.setTintFill(0x3a3341);
        pic.setAlpha(0.35);
      }
      const label = text(this, x, y + 46, mine ? STR.units[id].name : STR.unknown, 15, mine ? THEME.text : THEME.textSoft).setOrigin(0.5);
      layer.add([cell, pic, label, hit]);
    });
    show(all[0]);
  }

  private showAchievements(): void {
    const { width, height } = this.sim.cfg.map;
    const p = this.progress;
    const layer = this.modalLayer();
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.7).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 860, 690, 'center', THEME.bar);
    const title = text(this, width / 2 - 400, 40, STR.achTitle, 30).setOrigin(0, 0.5);
    const parts = text(this, width / 2 + 230, 40, STR.achParts(p.parts), 18, THEME.gold).setOrigin(1, 0.5);
    const close = button(this, width / 2 + 340, 40, 130, 44, STR.close, () => layer.destroy(), THEME.neutral, 18);
    layer.add([dim, box, title, parts, close.container]);
    ACHIEVEMENTS.forEach((a, i) => {
      // 업적 수에 맞춰 줄 간격을 줄인다 (창 높이 안에 다 들어가도록)
      const step = Math.min(43, 590 / ACHIEVEMENTS.length);
      const y = 96 + i * step;
      const done = p.done.includes(a.id);
      const info = STR.achievements[a.id];
      const row = new RoundBox(this, width / 2, y, 820, step - 5, done ? 0xfff0c8 : THEME.white, 10).setStrokeStyle(2, done ? THEME.selected : THEME.cardLine);
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
      // 4장이면 간격을 좁혀 맵 폭 안에 넣는다
      const x = width / 2 + (i - (offer.length - 1) / 2) * (offer.length > 3 ? 276 : 290);
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
    const rerollCost = gm.cfg.cardRerollCost;
    const canReroll = rerollCost !== undefined;
    const skip = button(this, width / 2 + (canReroll ? 160 : 0), 630, 300, 50, STR.cardSkip(gm.cfg.cardSkipMoney ?? 0), () => {
      if (gm.apply({ type: 'skipCard' }).ok) close();
    }, THEME.neutral, 18);
    layer.add(skip.container);
    if (canReroll) {
      // 다시 뽑기: 성공하면 cardOffer 이벤트가 새 카드로 이 화면을 다시 띄운다
      const reroll = button(this, width / 2 - 160, 630, 300, 50, gm.rerolled ? STR.cardRerolled : STR.cardReroll(rerollCost), () => {
        if (gm.apply({ type: 'rerollCards' }).ok) close();
        else sfx.play('error');
      }, THEME.blue, 18);
      reroll.setEnabled(!gm.rerolled && gm.money >= rerollCost);
      layer.add(reroll.container);
    }
    sfx.play('clear');
  }

  /** 판을 그만둔다. 도달한 웨이브는 기록으로 남긴다 */
  private leaveRun(restart: boolean): void {
    if (this.sim.wave > 0) saveBest({ ...this.setup, endless: this.sim.endless }, this.sim.wave);
    this.recordRank();
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

  /**
   * 무한 모드 판이 끝나면 랭킹에 남긴다. 이 기기 순위를 돌려준다 (순위 밖이거나 무한 모드가 아니면 0).
   * 온라인 랭킹을 켰으면 거기에도 올리고, 결과가 오면 onOnline으로 알려 준다.
   */
  private recordRank(onOnline?: (line: string) => void): { rank: number; online: boolean } {
    if (this.ranked || !this.sim.endless || this.sim.wave <= 0) return { rank: 0, online: false };
    this.ranked = true;
    const entry: RankEntry = {
      name: this.playerName(),
      wave: this.sim.wave,
      kills: this.sim.kills,
      map: this.setup.map,
      difficulty: this.setup.difficulty,
      at: Date.now(),
      units: topUnits(this.sim.units.map((u) => u.def.id)),
    };
    const { list, rank } = addRank(loadRanking(), entry);
    saveRanking(list);
    if (rank > 0) GameScene.lastRankAt = entry.at;
    if (onlineEnabled()) {
      submitOnline(entry).then(
        (r) => onOnline?.(STR.onlineRanked(r.rank, r.improved, r.best.wave)),
        () => onOnline?.(STR.onlineSendFailed),
      );
    }
    return { rank, online: onlineEnabled() };
  }

  /** 랭킹에 쓰는 이름. 아직 안 정했으면 '수비대1234' 같은 이름을 하나 지어 둔다 */
  private playerName(): string {
    let name = loadName();
    if (!name) saveName((name = randomName(Math.random, STR.namePrefix)));
    return name;
  }

  /** 무한 모드 랭킹 표: 내 기기 / 온라인, 난이도 탭, 이름 바꾸기 */
  private showRanking(diff: DifficultyId = this.difficulty, source: 'local' | 'online' = 'local'): void {
    const { width, height } = this.sim.cfg.map;
    const layer = this.modalLayer();
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.7).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 1000, 690, 'center', THEME.bar);
    const title = text(this, width / 2 - 470, 40, STR.rankingTitle, 28).setOrigin(0, 0.5);
    const close = button(this, width / 2 + 410, 40, 130, 44, STR.close, () => layer.destroy(), THEME.neutral, 18);
    layer.add([dim, box, title, close.container]);
    const reopen = (d: DifficultyId, src = source) => {
      layer.destroy();
      this.showRanking(d, src);
    };
    (['local', 'online'] as const).forEach((src, i) => {
      const b = button(this, width / 2 - 130 + i * 140, 40, 132, 44, STR.rankingSources[src], () => src !== source && reopen(diff, src), src === source ? THEME.purple : THEME.neutral, 16);
      layer.add(b.container);
    });
    const name = this.playerName();
    const nameBtn = button(this, width / 2 + 225, 40, 200, 44, STR.rankingName(name), () => {
      // 휴대폰에서도 바로 글자를 칠 수 있게 브라우저 입력 창을 쓴다
      const v = window.prompt(STR.rankingNamePrompt, name);
      const next = v === null ? '' : cleanName(v);
      if (!next || next === name) return;
      saveName(next);
      // 이미 올린 온라인 기록의 이름도 바꾼다 (끝나면 표를 다시 그린다)
      if (onlineEnabled()) renameOnline(next).catch(() => undefined).finally(() => layer.active && reopen(diff));
      else reopen(diff);
    }, THEME.white, 16);
    layer.add(nameBtn.container);
    const colors: Record<DifficultyId, number> = { easy: THEME.green, normal: THEME.blue, hard: THEME.orange, hell: 0xc8445a };
    DIFFICULTY_ORDER.forEach((id, i) => {
      const b = button(this, width / 2 - 345 + i * 230, 100, 220, 46, STR.difficulties[id].name, () => id !== diff && reopen(id), id === diff ? colors[id] : THEME.neutral, 18);
      layer.add(b.container);
    });
    const left = width / 2 - 460;
    const cols = [0, 70, 220, 320, 400, 560, 800];
    STR.rankingHead.forEach((h, i) => layer.add(text(this, left + cols[i], 146, h, 15, THEME.textSoft)));
    const medal = ['🥇', '🥈', '🥉'];
    const row = (e: RankEntry, rank: number, y: number, mine: boolean, into: Phaser.GameObjects.Container) => {
      const bg = new RoundBox(this, width / 2, y, 940, 40, mine ? 0xfff0c8 : rank % 2 ? THEME.white : THEME.bar, 10).setStrokeStyle(mine ? 3 : 0, THEME.selected);
      into.add(bg);
      const d = new Date(e.at);
      const cells = [
        medal[rank - 1] ?? `${rank}`, e.name, `${e.wave}`, `${e.kills}`, STR.maps[e.map as MapId]?.name ?? e.map, '', e.at ? `${d.getMonth() + 1}/${d.getDate()}` : '',
      ];
      cells.forEach((c, j) => into.add(text(this, left + cols[j] + (j === 0 ? 12 : 0), y, c, j === 2 ? 22 : 17, j === 2 ? THEME.gold : THEME.text).setOrigin(0, 0.5)));
      e.units.forEach((u, k) => into.add(icon(this, left + cols[5] + 18 + k * 40, y, u, this.sim.cfg.units[u as UnitId]?.emoji ?? '❓', 34)));
    };
    const message = (s: string) => text(this, width / 2, 380, s, 22, THEME.textSoft).setOrigin(0.5).setAlign('center').setLineSpacing(8);

    if (source === 'local') {
      const list = rankList(loadRanking(), diff);
      if (!list.length) layer.add(message(STR.rankingEmpty));
      list.forEach((e, i) => row(e, i + 1, 196 + i * 46, e.at === GameScene.lastRankAt, layer));
      layer.add(text(this, width / 2, 676, STR.rankingNote, 15, THEME.textSoft).setOrigin(0.5));
      return;
    }
    if (!onlineEnabled()) {
      layer.add(message(STR.onlineOff));
      return;
    }
    // 온라인: 불러오는 동안 안내 글자, 오면 표를 그린다 (그 사이 창을 닫았으면 그리지 않는다)
    const body = this.add.container(0, 0);
    const wait = message(STR.onlineLoading);
    body.add(wait);
    layer.add(body);
    fetchOnline(diff).then(({ top, me, myRank, uid }) => {
      if (!body.active) return;
      wait.destroy();
      if (!top.length) body.add(message(STR.onlineEmpty));
      top.forEach((e, i) => row(e, i + 1, 196 + i * 46, e.uid === uid, body));
      // 내가 10위 밖이면 맨 아래에 내 줄
      if (me && myRank > top.length) {
        body.add(text(this, width / 2, 638, '⋯', 18, THEME.textSoft).setOrigin(0.5));
        row(me, myRank, 664, true, body);
      } else body.add(text(this, width / 2, 676, STR.onlineNote, 15, THEME.textSoft).setOrigin(0.5));
    }, () => {
      if (!body.active) return;
      wait.setText(STR.onlineFailed);
    });
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
    const lines = [
      `${STR.maps[this.setup.map as MapId]?.name ?? ''}  ${STR.difficulties[this.difficulty].name}${run.endless ? ' ♾️' : ''}`,
      STR.reachedWave(reached), STR.best(loadBest(run)),
    ];
    if (isNew) lines.push(STR.newBest);
    // 온라인 결과는 나중에 오므로 자리만 잡아 두고 글자를 바꾼다
    let onlineLine = -1;
    let body: Phaser.GameObjects.Text | null = null;
    const { rank, online } = this.recordRank((line) => {
      lines[onlineLine] = line;
      if (body?.active) body.setText(lines.join('\n'));
    });
    if (rank > 0) lines.push(STR.rankedAt(rank));
    if (online) onlineLine = lines.push(STR.onlineSending) - 1;
    lines.push(STR.runReward(this.runParts));
    // 줄 수에 맞춰 창 높이를 정한다
    const canContinue = won && !!this.sim.cfg.extraWave;
    const bodyH = lines.length * 31;
    const btnOff = 105 + bodyH + 40;
    const boxH = btnOff + (canContinue ? 135 : 60);
    const top = height / 2 - boxH / 2;
    const dim = this.add.rectangle(0, 0, width, height, THEME.overlay, 0.55).setOrigin(0).setInteractive();
    const box = card(this, width / 2, height / 2, 540, boxH, 'center', THEME.bar).setStrokeStyle(4, won ? THEME.selected : THEME.red);
    const title = text(this, width / 2, top + 55, won ? `🏆 ${STR.victory}` : `💥 ${STR.gameOver}`, 34).setOrigin(0.5);
    body = text(this, width / 2, top + 100, lines.join('\n'), 20, THEME.text).setOrigin(0.5, 0).setAlign('center').setLineSpacing(6);
    const again = button(this, width / 2 - 120, top + btnOff, 220, 50, STR.restart, () => this.scene.restart({ start: true }), THEME.green, 20);
    const change = button(this, width / 2 + 120, top + btnOff, 220, 50, STR.changeDifficulty, () => this.scene.restart({}), THEME.neutral, 20);
    this.endScreen = [dim, box, title, body, again.container, change.container];
    // 20웨이브를 이기면 그대로 무한 모드로 이어갈 수 있다
    if (canContinue) {
      const cont = button(this, width / 2, top + btnOff + 75, 460, 50, STR.continueEndless, () => this.continueEndless(), THEME.purple, 20);
      this.endScreen.push(cont.container);
    }
    for (const ob of this.endScreen) (ob as unknown as { setDepth(d: number): void }).setDepth(50);
    box.setScale(0.6);
    this.tweens.add({ targets: box, scale: 1, duration: 300, ease: 'Back.easeOut' });
  }
}

/** 캐릭터 그림에서 발바닥 높이 (그림 위쪽 0 ~ 아래쪽 1) */
const FEET = 0.82;

function syncEmojis(
  scene: Phaser.Scene,
  pool: Map<number, Icon>,
  items: { uid: number; x: number; y: number; key?: string; emoji: string; size: number }[],
  depth = 2,
  feet = false,
): void {
  const alive = new Set<number>();
  for (const it of items) {
    alive.add(it.uid);
    let t = pool.get(it.uid);
    if (!t) {
      t = icon(scene, 0, 0, it.key, it.emoji, it.size).setDepth(depth);
      // 캐릭터는 발바닥을 기준점으로 세운다 (늘였다 줄였다 해도 발은 바닥에 붙어 있게)
      if (feet) t.setOrigin(0.5, FEET);
      pool.set(it.uid, t);
    }
    if (feet) {
      t.setPosition(it.x, it.y + it.size * (FEET - 0.5));
      // 3/4 시점: 화면 아래쪽(앞)에 있는 캐릭터가 위쪽 캐릭터를 가린다
      t.setDepth(depth + it.y / 10000);
    } else t.setPosition(it.x, it.y);
  }
  for (const [uid, t] of pool) {
    if (!alive.has(uid)) {
      t.destroy();
      pool.delete(uid);
    }
  }
}

/**
 * 격자 맵 바닥: 도톰한 타일 블록을 깔고, 배수관 칸은 한 단 낮은 수로로 그린다.
 * 위에서 비스듬히 내려다보는 시점이라 수로 위쪽 칸의 앞면(벽)이 보인다.
 */
function drawTiles(g: Phaser.GameObjects.Graphics, grid: Grid, a: { x: number; y: number; w: number; h: number }, isPath: (x: number, y: number) => boolean): void {
  const { size: s } = grid;
  const LIP = 9; // 타일 앞면 두께
  g.fillStyle(0xe2c9a6).fillRect(a.x, a.y, a.w, a.h); // 줄눈
  const path = (c: number, r: number) => r >= 0 && r < grid.rows && c >= 0 && c < grid.cols && isPath(grid.x + (c + 0.5) * s, grid.y + (r + 0.5) * s);
  // 맵 위아래 남는 줄은 줄눈 색 그대로 두고, 격자 칸만 그린다
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      const x = grid.x + c * s;
      const y = grid.y + r * s;
      if (path(c, r)) {
        // 수로: 물 바닥 + 위쪽(북쪽) 칸이 바닥이면 그 칸의 앞면 벽이 보인다
        g.fillStyle(0x9fd3ea).fillRect(x, y, s, s);
        if (!path(c, r - 1)) {
          g.fillStyle(0xc9a174).fillRect(x, y, s, LIP);
          g.fillStyle(0x000000, 0.08).fillRect(x, y + LIP, s, 6);
        }
        continue;
      }
      // 바닥 타일: 앞면(아래쪽 두께) → 윗면 → 윗면 하이라이트
      const light = (r + c) % 2 === 0;
      g.fillStyle(light ? 0xe8cfa8 : 0xe0c39a).fillRoundedRect(x + 2, y + 2, s - 4, s - 2, 8);
      g.fillStyle(light ? 0xfdf3e1 : 0xf6e2c4).fillRoundedRect(x + 2, y + 2, s - 4, s - 4 - LIP / 2, 8);
      g.fillStyle(0xffffff, 0.5).fillRoundedRect(x + 7, y + 5, s - 14, 3, 2);
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
  if (id === 'laundry') {
    // 세탁실: 연회색 타일에 물방울 무늬
    const s = 56;
    g.fillStyle(0xeef1f6).fillRect(a.x, a.y, a.w, a.h);
    for (let y = a.y, row = 0; y < a.y + a.h; y += s, row++) {
      for (let x = a.x + (row % 2) * (s / 2); x < a.x + a.w; x += s) g.fillStyle(0xdde3ee).fillCircle(x + s / 4, y + s / 2, 7);
    }
    g.lineStyle(2, 0xffffff, 0.8);
    for (let y = a.y; y <= a.y + a.h; y += s) g.lineBetween(a.x, y, a.x + a.w, y);
    return;
  }
  if (id === 'living') {
    // 거실: 따뜻한 카펫 줄무늬
    const h = 44;
    for (let y = a.y, row = 0; y < a.y + a.h; y += h, row++) g.fillStyle(row % 2 ? 0xf3e2d3 : 0xf7ebdf).fillRect(a.x, y, a.w, h);
    for (let x = a.x + 30; x < a.x + a.w; x += 60) g.fillStyle(0xe9d2bf, 0.5).fillRect(x, a.y, 3, a.h);
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
