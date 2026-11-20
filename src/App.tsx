/**
 * MathCipher 3D — The Last Exit
 * High-fidelity 60 FPS 3D Backrooms Game
 * Curriculum: Fungsi Komposisi & Invers (No Mod 26, No Cheat Calculator)
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';

import {
  ChaserType,
  Difficulty,
  GameStatus,
  PlayerStats,
  PuzzleData,
  SimpleQuizData,
} from './game/types';
import { generatePuzzle, generateSimpleQuiz, LEVELS } from './game/cipher';
import { createCharacter, CharacterController } from './game/character';
import { buildWorld, WorldObjects } from './game/world';
import {
  EnemyState,
  LockerSpot,
  SLENDER_BLINK_HOP,
  SLENDER_CREEP_SPEED,
  SLENDER_SPACE_BLINK_HOP,
  SLENDER_SPACE_BLINK_INTERVAL,
  SLENDER_SPACE_CAPTURE_DIST,
  SLENDER_SPACE_CREEP_SPEED,
  SLENDER_SPACE_MAX_HP,
  SLENDER_SPRINT_LOCK_DIST,
  TEACHER_CHASE_SPEED,
  TEACHER_ZAP_STUN_SECONDS,
  animateEnemyLimbs,
  buildSpaceDimension,
  computeKnockbackTarget,
  createChubbyEntityMesh,
  createLockerInteriorRig,
  createMathTeacherMesh,
  createMysticStaffMesh,
  createSlendermanMesh,
  findNextMazeStep,
  gridToWorld,
  hasGridLineOfSight,
  pickFarthestOpenCell,
  pickOpenCell,
  resetEnemyPose,
  resolveEntityWallCollisions,
  SpaceDimensionObjects,
  worldToGrid,
} from './game/enemies';
import { PlayerPhysics, SmoothFollowCamera, InputState } from './game/controls';
import { sound } from './game/audio';
import { buildOpeningScene, OpeningSceneObjects } from './game/opening';

import { HUD, MinimapEntityMarker } from './components/HUD';
import { TerminalModal } from './components/TerminalModal';
import { QuizModal } from './components/QuizModal';
import { HugCutscene } from './components/HugCutscene';
import {
  CutsceneOverlay,
  ChubbyWakeMashOverlay,
} from './components/CutsceneOverlays';
import { StartScreen } from './components/StartScreen';
import { EndScreen } from './components/EndScreen';
import { TouchControls } from './components/TouchControls';

const MAX_LOCKER_USES = 5;
const SPACE_TRIAL_SECONDS = 65;

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);

  const [gameStatus, setGameStatus] = useState<GameStatus>('START');
  const [difficulty, setDifficulty] = useState<Difficulty>('EASY');
  const [puzzle, setPuzzle] = useState<PuzzleData>(() => generatePuzzle('EASY'));
  const [activeQuiz, setActiveQuiz] = useState<SimpleQuizData | null>(null);
  const [wakeMashMode, setWakeMashMode] = useState<'counter' | 'sacrifice_revive'>('counter');

  const [stats, setStats] = useState<PlayerStats>({
    lives: 3,
    maxLives: 3,
    timeLeft: 600,
    maxTime: 600,
    status: 'START',
    difficulty: 'EASY',
    distanceToTerminal: 99,
    distanceToExit: 99,
    isNearTerminal: false,
    isNearExit: false,
    isExitUnlocked: false,
    isSprinting: false,
    isSprintLocked: false,
    isShiftLocked: false,
    speed: 0,
    lockerUsesLeft: MAX_LOCKER_USES,
    maxLockerUses: MAX_LOCKER_USES,
    isNearLocker: false,
    isHidingInLocker: false,
    activeChaser: 'NONE',
    alertMessage: null,
    inSpaceWorld: false,
    spaceTimeLeft: SPACE_TRIAL_SECONDS,
    hasMysticStaff: false,
    isStaffEquipped: false,
    teacherStunTimer: 0,
    spaceHasPortalOpen: false,
    spaceSlenderHp: SLENDER_SPACE_MAX_HP,
    spaceSlenderMaxHp: SLENDER_SPACE_MAX_HP,
    spaceSlenderBlinking: false,
    canReviveChubby: false,
    chubbyReviveBlockedReason: null,
  });

  const [playerCoordinates, setPlayerCoordinates] = useState({ x: 0, z: 0 });
  const [playerYaw, setPlayerYaw] = useState(0);
  const [mazeGrid, setMazeGrid] = useState<number[][]>([]);
  const [enemyMarkers, setEnemyMarkers] = useState<MinimapEntityMarker[]>([]);
  const [lockerMarkers, setLockerMarkers] = useState<{ x: number; z: number }[]>([]);

  // Track already-asked quiz IDs so each retry/death presents fresh unrepeated questions
  const askedQuizIdsRef = useRef<Set<string>>(new Set());

  const engineRef = useRef<{
    renderer: THREE.WebGLRenderer;
    world: WorldObjects;
    spaceWorld: SpaceDimensionObjects;
    openingWorld: OpeningSceneObjects;
    sackMesh: THREE.Group;
    camera: THREE.PerspectiveCamera;
    character: CharacterController;
    playerStaffMesh: THREE.Group;
    physics: PlayerPhysics;
    followCamera: SmoothFollowCamera;
    input: InputState;
    enemies: EnemyState[];
    touchVector: { x: number; y: number };
    touchSprint: boolean;
    isExitUnlocked: boolean;
    lives: number;
    timeLeft: number;
    lockerUsesLeft: number;
    isHidingInLocker: boolean;
    lockerInteriorGroup: THREE.Group;
    activeLocker: LockerSpot | null;
    lockerPeekYaw: number;
    lockerPeekPitch: number;
    isGameActive: boolean;
    isShiftLocked: boolean;
    isSprintLocked: boolean;
    inSpaceWorld: boolean;
    spaceHasPortalOpen: boolean;
    preAbductPos: THREE.Vector3;
    preAbductYaw: number;
    spaceTimeLeft: number;
    hasMysticStaff: boolean;
    isStaffEquipped: boolean;
    teacherStunTimer: number;
    spaceSlenderPos: THREE.Vector3;
    spaceSlenderYaw: number;
    spaceSlenderBlinkTimer: number;
    spaceSlenderHideTimer: number;
    spaceSlenderHp: number;
    spaceSlenderBlinking: boolean;
    blackHoleAnchor: THREE.Vector3;
    cutsceneMode:
      | 'NONE'
      | 'OPENING'
      | 'CHUBBY_CAPTURE'
      | 'CHUBBY_COUNTER'
      | 'CHUBBY_WAKE_MASH'
      | 'HUG'
      | 'CHUBBY_SACRIFICE'
      | 'TEACHER_CATCH'
      | 'SLENDER_ABDUCT'
      | 'SLENDER_SPACE_ARRIVE'
      | 'SLENDER_BLACKHOLE'
      | 'TEACHER_ZAP';
    cutsceneTimer: number;
    cutsceneStartMs: number;
    cutsceneAnchor: THREE.Vector3;
    cutsceneDir: THREE.Vector2;
    chubbyShakeImpulse: number;
    chubbyWokeUp: boolean;
    chubbyWakeContext: 'COUNTER' | 'SACRIFICE_REVIVE';
    teacherFleeTarget: { r: number; c: number } | null;
    zapStartPos: THREE.Vector3;
    zapEndPos: THREE.Vector3;
    zapHitWall: boolean;
    zapYaw: number;
    sacrificeDistChubby: number;
    sacrificeDistTeacher: number;
    chubbyCompanionActive: boolean;
    chubbySacrificeDone: boolean;
    chubbyNeedsRevive: boolean;
    chubbySacrificeCooldown: number;
    canReviveChubby: boolean;
    chubbyReviveBlockedReason: string | null;
    playerStaffTip: THREE.Object3D;
    staffMuzzleArc: THREE.Group;
    staffMuzzleDir: THREE.Vector3;
    staffMuzzleTimer: number;
    lightningCooldown: number;
    lightningBolts: {
      group: THREE.Group;
      active: boolean;
      pos: THREE.Vector3;
      dir: THREE.Vector3;
      life: number;
    }[];
    zapSparks: THREE.Mesh[];
    backwardEscapeTimer: number;
    backwardEscapeDir: THREE.Vector2;
    mouseDragging: boolean;
    hoverMouseInit: boolean;
    lastMouseX: number;
    lastMouseY: number;
    alertTimer: number;
    alertText: string | null;
    staffUseJustPressed: boolean;
    castJustPressed: boolean;
  } | null>(null);

  const triggerAlertBanner = useCallback((msg: string, duration = 3.2) => {
    const eng = engineRef.current;
    if (eng) {
      eng.alertText = msg;
      eng.alertTimer = duration;
    }
    setStats((prev) => ({ ...prev, alertMessage: msg }));
  }, []);

  const spawnAllEnemies = useCallback((eng: NonNullable<typeof engineRef.current>) => {
    const { maze, cellSize, offset } = eng.world;
    const occupied: { r: number; c: number }[] = [
      { r: 1, c: 1 },
      { r: 1, c: 2 },
      { r: 2, c: 1 },
      { r: 2, c: 2 },
    ];

    eng.enemies.forEach((enemy) => {
      let minR = 6;
      let minC = 6;
      if (enemy.kind === 'CHUBBY') {
        minR = 4;
        minC = 8;
      } else if (enemy.kind === 'SLENDER') {
        minR = 9;
        minC = 4;
      }

      const cell = pickOpenCell(maze, minR, minC, occupied);
      occupied.push(cell);
      const pos = gridToWorld(cell.r, cell.c, cellSize, offset);
      enemy.position.set(pos.x, 0, pos.z);
      enemy.group.position.set(pos.x, 0, pos.z);
      enemy.group.rotation.order = 'XYZ';
      enemy.group.rotation.set(0, 0, 0);
      enemy.group.visible = true;
      enemy.mode = 'PATROL';
      enemy.targetCell = null;
      enemy.lastKnownPlayerPos = null;
      enemy.chaseMemoryTimer = 0;
      enemy.walkPhase = 0;
      enemy.blinkTimer = 0;
      enemy.blinkHideTimer = 0;
      enemy.cooldownTimer = 0;
      resetEnemyPose(enemy);
      if (enemy.pacifiedHalo) enemy.pacifiedHalo.visible = false;
    });

    eng.chubbyCompanionActive = false;
    eng.chubbySacrificeDone = false;
    eng.chubbyNeedsRevive = false;
    eng.chubbySacrificeCooldown = 0;
    eng.canReviveChubby = false;
    eng.chubbyReviveBlockedReason = null;
    eng.staffMuzzleTimer = 0;
    eng.staffMuzzleArc.visible = false;
  }, []);

  // Mirror game state to body[data-state] for DOM inspection
  useEffect(() => {
    if (gameStatus === 'START') document.body.dataset.state = 'title';
    else if (gameStatus === 'VICTORY' || gameStatus === 'DEFEAT') {
      document.body.dataset.state = 'gameover';
    } else if (gameStatus === 'PLAYING' || gameStatus === 'SPACE_WORLD') {
      document.body.dataset.state = 'playing';
    } else {
      document.body.dataset.state = 'paused';
    }
  }, [gameStatus]);

  // Helper refs so the single rAF loop stays decoupled from React re-renders
  const handlersRef = useRef({
    onOpenTerminal: () => {},
    onToggleLocker: () => {},
    onTriggerChubbyQuiz: () => {},
    onTriggerChubbySacrifice: () => {},
    onReviveChubby: () => {},
    onSlenderJumpscare: () => {},
    onSlenderBlackhole: () => {},
    onTeacherCatch: () => {},
    onTeacherZap: () => {},
    onCastLightning: () => {},
    onVictory: () => {},
    onToggleShiftLock: () => {},
    onUseMysticStaff: () => {},
    onSpaceOutcome: (_won: boolean) => {},
  });

  // Initialize Three.js Engine once on mount
  useEffect(() => {
    if (!mountRef.current) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      precision: 'mediump',
      stencil: false,
      depth: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setPixelRatio(1.0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = false;

    mountRef.current.replaceChildren(renderer.domElement);

    const camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.1,
      110
    );

    const world = buildWorld(renderer);
    const spaceWorld = buildSpaceDimension();
    const openingWorld = buildOpeningScene();
    setMazeGrid(world.maze.map((r) => [...r]));
    setLockerMarkers(world.lockers.map((l) => ({ x: l.position.x, z: l.position.z })));

    // 3D Woven Burlap Sack (Karung) used during Chubby POV capture
    const sackMesh = new THREE.Group();
    const sackMat = new THREE.MeshStandardMaterial({
      color: 0x6b4423,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
    const sackCone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.42, 0.36, 0.82, 12, 1, true),
      sackMat
    );
    sackMesh.add(sackCone);
    const sackTop = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), sackMat);
    sackTop.rotation.x = Math.PI / 2;
    sackTop.position.y = 0.41;
    sackMesh.add(sackTop);
    sackMesh.visible = false;
    world.scene.add(sackMesh);

    // 3D Steel Safe-Locker Interior Rig for true inside-locker slit POV
    const lockerInteriorGroup = createLockerInteriorRig();
    world.scene.add(lockerInteriorGroup);

    const character = createCharacter();
    world.scene.add(character.group);

    // Attach Tongkat Kunci Ghaib directly to player's right hand (equipped with [F], casts petir with [Enter])
    const playerStaffMesh = createMysticStaffMesh(0.68);
    playerStaffMesh.position.set(0, -0.02, -0.04);
    playerStaffMesh.rotation.set(-Math.PI * 0.44, 0, 0);
    playerStaffMesh.visible = false;
    // Exact 3D anchor at the glowing violet crystal orb on the staff tip
    const playerStaffTip = new THREE.Object3D();
    playerStaffTip.position.set(0, 1.68, 0);
    playerStaffMesh.add(playerStaffTip);
    character.parts.rightHand.add(playerStaffMesh);

    // Pre-allocated pool of Harry-Potter-style mini lightning bolts
    const boltMatCyan = new THREE.MeshBasicMaterial({ color: 0x6fffea });
    const boltMatViolet = new THREE.MeshBasicMaterial({ color: 0xc084fc });
    const segGeo1 = new THREE.BoxGeometry(0.06, 0.06, 0.55);
    const segGeo2 = new THREE.BoxGeometry(0.05, 0.05, 0.48);

    // Crackling lightning burst emitted directly from the tip of Tongkat Kunci Ghaib when [ENTER] fires
    const staffMuzzleArc = new THREE.Group();
    const mProng1 = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 0.9), boltMatCyan);
    mProng1.position.set(0.08, 0.05, 0.45);
    mProng1.rotation.set(0.16, -0.24, 0.15);
    staffMuzzleArc.add(mProng1);
    const mProng2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.78), boltMatViolet);
    mProng2.position.set(-0.09, -0.04, 0.42);
    mProng2.rotation.set(-0.18, 0.25, -0.12);
    staffMuzzleArc.add(mProng2);
    const mProng3 = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.65), boltMatCyan);
    mProng3.position.set(0.02, 0.12, 0.58);
    mProng3.rotation.set(-0.22, -0.12, 0.3);
    staffMuzzleArc.add(mProng3);
    const mCore = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), boltMatCyan);
    staffMuzzleArc.add(mCore);
    staffMuzzleArc.visible = false;
    world.scene.add(staffMuzzleArc);

    const lightningBolts = Array.from({ length: 6 }, () => {
      const g = new THREE.Group();
      const s1 = new THREE.Mesh(segGeo1, boltMatCyan);
      s1.position.set(0.05, 0.02, 0.22);
      s1.rotation.set(0.12, -0.22, 0);
      g.add(s1);
      const s2 = new THREE.Mesh(segGeo2, boltMatViolet);
      s2.position.set(-0.05, -0.02, -0.18);
      s2.rotation.set(-0.14, 0.25, 0);
      g.add(s2);
      const s3 = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), boltMatCyan);
      s3.position.set(0, 0, -0.45);
      g.add(s3);
      g.visible = false;
      world.scene.add(g);
      return {
        group: g,
        active: false,
        pos: new THREE.Vector3(),
        dir: new THREE.Vector3(0, 0, -1),
        life: 0,
      };
    });

    // Pre-allocated electric shock spark spheres on Guru MTK during TEACHER_ZAP cutscene
    const sparkGeo = new THREE.OctahedronGeometry(0.11, 0);
    const zapSparks = Array.from({ length: 8 }, (_, idx) => {
      const m = new THREE.Mesh(sparkGeo, idx % 2 === 0 ? boltMatCyan : boltMatViolet);
      m.visible = false;
      world.scene.add(m);
      return m;
    });

    // 3 Procedural 3D Enemy Entities
    const teacherModel = createMathTeacherMesh();
    world.scene.add(teacherModel.group);
    const teacherEntity: EnemyState = {
      kind: 'TEACHER',
      group: teacherModel.group,
      position: new THREE.Vector3(),
      rotationY: 0,
      bodyBaseY: 1.35,
      mode: 'PATROL',
      targetCell: null,
      lastKnownPlayerPos: null,
      chaseMemoryTimer: 0,
      walkPhase: 0,
      blinkTimer: 0,
      blinkHideTimer: 0,
      cooldownTimer: 0,
      parts: teacherModel.parts,
    };

    const chubbyModel = createChubbyEntityMesh();
    world.scene.add(chubbyModel.group);
    const chubbyEntity: EnemyState = {
      kind: 'CHUBBY',
      group: chubbyModel.group,
      position: new THREE.Vector3(),
      rotationY: 0,
      bodyBaseY: 1.16,
      mode: 'PATROL',
      targetCell: null,
      lastKnownPlayerPos: null,
      chaseMemoryTimer: 0,
      walkPhase: 0,
      blinkTimer: 0,
      blinkHideTimer: 0,
      cooldownTimer: 0,
      pacifiedHalo: chubbyModel.pacifiedHalo,
      parts: chubbyModel.parts,
    };

    const slenderModel = createSlendermanMesh();
    world.scene.add(slenderModel.group);
    const slenderEntity: EnemyState = {
      kind: 'SLENDER',
      group: slenderModel.group,
      position: new THREE.Vector3(),
      rotationY: 0,
      bodyBaseY: 2.75,
      mode: 'PATROL',
      targetCell: null,
      lastKnownPlayerPos: null,
      chaseMemoryTimer: 0,
      walkPhase: 0,
      blinkTimer: 0,
      blinkHideTimer: 0,
      cooldownTimer: 0,
      parts: slenderModel.parts,
    };

    // Start player in spacious open cell (2, 2) facing East (+X) along corridor
    const startX = (2 - world.offset) * world.cellSize;
    const startZ = (2 - world.offset) * world.cellSize;
    character.group.position.set(startX, 0, startZ);
    character.group.rotation.y = -Math.PI * 0.5;

    const physics = new PlayerPhysics(startX, startZ);
    physics.rotationY = -Math.PI * 0.5;
    const followCamera = new SmoothFollowCamera(camera);
    followCamera.yaw = -Math.PI * 0.5;
    followCamera.snap(physics.position, world.walls);

    const input: InputState = {
      forward: 0,
      strafe: 0,
      sprint: false,
      interactJustPressed: false,
      escapeJustPressed: false,
    };

    const engineState = {
      renderer,
      world,
      spaceWorld,
      openingWorld,
      sackMesh,
      camera,
      character,
      playerStaffMesh,
      physics,
      followCamera,
      input,
      enemies: [teacherEntity, chubbyEntity, slenderEntity],
      touchVector: { x: 0, y: 0 },
      touchSprint: false,
      isExitUnlocked: false,
      lives: 3,
      timeLeft: 600,
      lockerUsesLeft: MAX_LOCKER_USES,
      isHidingInLocker: false,
      lockerInteriorGroup,
      activeLocker: null as LockerSpot | null,
      lockerPeekYaw: 0,
      lockerPeekPitch: 0,
      isGameActive: false,
      isShiftLocked: false,
      isSprintLocked: false,
      inSpaceWorld: false,
      spaceHasPortalOpen: false,
      preAbductPos: new THREE.Vector3(startX, 0, startZ),
      preAbductYaw: -Math.PI * 0.5,
      spaceTimeLeft: SPACE_TRIAL_SECONDS,
      hasMysticStaff: false,
      isStaffEquipped: false,
      teacherStunTimer: 0,
      spaceSlenderPos: new THREE.Vector3(0, 0, -13.5),
      spaceSlenderYaw: 0,
      spaceSlenderBlinkTimer: 0,
      spaceSlenderHideTimer: 0,
      spaceSlenderHp: SLENDER_SPACE_MAX_HP,
      spaceSlenderBlinking: false,
      blackHoleAnchor: new THREE.Vector3(),
      cutsceneMode: 'NONE' as
        | 'NONE'
        | 'OPENING'
        | 'CHUBBY_CAPTURE'
        | 'CHUBBY_COUNTER'
        | 'CHUBBY_WAKE_MASH'
        | 'HUG'
        | 'CHUBBY_SACRIFICE'
        | 'TEACHER_CATCH'
        | 'SLENDER_ABDUCT'
        | 'SLENDER_SPACE_ARRIVE'
        | 'SLENDER_BLACKHOLE'
        | 'TEACHER_ZAP',
      cutsceneTimer: 0,
      cutsceneStartMs: 0,
      cutsceneAnchor: new THREE.Vector3(),
      cutsceneDir: new THREE.Vector2(1, 0),
      chubbyShakeImpulse: 0,
      chubbyWokeUp: false,
      chubbyWakeContext: 'COUNTER' as 'COUNTER' | 'SACRIFICE_REVIVE',
      teacherFleeTarget: null as { r: number; c: number } | null,
      zapStartPos: new THREE.Vector3(),
      zapEndPos: new THREE.Vector3(),
      zapHitWall: false,
      zapYaw: 0,
      sacrificeDistChubby: 3.6,
      sacrificeDistTeacher: 4.5,
      chubbyCompanionActive: false,
      chubbySacrificeDone: false,
      chubbyNeedsRevive: false,
      chubbySacrificeCooldown: 0,
      canReviveChubby: false,
      chubbyReviveBlockedReason: null as string | null,
      playerStaffTip,
      staffMuzzleArc,
      staffMuzzleDir: new THREE.Vector3(0, 0, -1),
      staffMuzzleTimer: 0,
      lightningCooldown: 0,
      lightningBolts,
      zapSparks,
      backwardEscapeTimer: 0,
      backwardEscapeDir: new THREE.Vector2(-1, 0),
      mouseDragging: false,
      hoverMouseInit: false,
      lastMouseX: 0,
      lastMouseY: 0,
      alertTimer: 0,
      alertText: null as string | null,
      staffUseJustPressed: false,
      castJustPressed: false,
    };
    engineRef.current = engineState;
    spawnAllEnemies(engineState);

    if (!isSoftwareGl) {
      renderer.compile(world.scene, camera);
      renderer.compile(spaceWorld.scene, camera);
    }

    const activeKeys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      activeKeys[e.code] = true;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        if (engineRef.current?.isGameActive) e.preventDefault();
      }
      if (e.code === 'KeyE' && !e.repeat) {
        input.interactJustPressed = true;
      }
      if (e.code === 'KeyL' && !e.repeat && engineRef.current?.isGameActive) {
        handlersRef.current.onToggleShiftLock();
      }
      if (e.code === 'KeyF' && !e.repeat && engineRef.current?.isGameActive) {
        engineRef.current.staffUseJustPressed = true;
      }
      if (
        e.code === 'Space' &&
        !e.repeat &&
        engineRef.current?.isGameActive &&
        !engineRef.current.inSpaceWorld &&
        engineRef.current.canReviveChubby
      ) {
        e.preventDefault();
        handlersRef.current.onReviveChubby();
      }
      if (
        (e.code === 'Enter' || e.code === 'NumpadEnter') &&
        !e.repeat &&
        engineRef.current?.isGameActive &&
        engineRef.current.hasMysticStaff &&
        (engineRef.current.isStaffEquipped || engineRef.current.inSpaceWorld) &&
        !engineRef.current.isHidingInLocker
      ) {
        e.preventDefault();
        engineRef.current.castJustPressed = true;
      }
      if (e.code === 'Escape') {
        input.escapeJustPressed = true;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      activeKeys[e.code] = false;
    };

    const handleBlur = () => {
      for (const k in activeKeys) activeKeys[k] = false;
      input.forward = 0;
      input.strafe = 0;
      input.sprint = false;
      if (engineRef.current) {
        engineRef.current.mouseDragging = false;
        engineRef.current.hoverMouseInit = false;
      }
    };

    const domEl = renderer.domElement;
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    const handleMouseDown = (e: MouseEvent) => {
      const eng = engineRef.current;
      if (!eng) return;
      // Left-click (button 0) fires Mystic Staff lightning when staff is held (or in Space World)
      if (
        e.button === 0 &&
        eng.isGameActive &&
        eng.hasMysticStaff &&
        (eng.isStaffEquipped || eng.inSpaceWorld) &&
        !eng.isHidingInLocker
      ) {
        eng.castJustPressed = true;
        return;
      }
      // Support right-click mouse drag (button 2) for camera direction, as well as left-click drag when staff isn't active
      if (e.button === 2 || e.button === 0) {
        eng.mouseDragging = true;
        eng.lastMouseX = e.clientX;
        eng.lastMouseY = e.clientY;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const eng = engineRef.current;
      if (!eng || !eng.mouseDragging) return;

      const sensitivity = 0.0048;
      const dx = e.clientX - eng.lastMouseX;
      const dy = e.clientY - eng.lastMouseY;
      eng.lastMouseX = e.clientX;
      eng.lastMouseY = e.clientY;

      if (eng.isHidingInLocker) {
        eng.lockerPeekYaw = Math.max(-0.26, Math.min(0.26, eng.lockerPeekYaw - dx * sensitivity * 0.65));
        eng.lockerPeekPitch = Math.max(-0.14, Math.min(0.14, eng.lockerPeekPitch + dy * sensitivity * 0.65));
      } else {
        followCamera.yaw -= dx * sensitivity;
        followCamera.pitch = Math.max(0.05, Math.min(0.68, followCamera.pitch + dy * sensitivity));
      }
    };

    const handleMouseUp = () => {
      if (engineRef.current) engineRef.current.mouseDragging = false;
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    domEl.addEventListener('contextmenu', handleContextMenu);
    domEl.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    // Pre-allocated scratch helpers (zero GC inside rAF!)
    let frameId = 0;
    let timeoutId = 0;
    let lastTime = performance.now();
    let statsTimerAcc = 0;
    let lastAudioChaser: ChaserType = 'NONE';
    const tempCutsceneTarget = new THREE.Vector3();
    const tempMuzzleLook = new THREE.Vector3();
    const tempLockerLook = new THREE.Vector3();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          timeoutId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          timeoutId = window.setTimeout(cb, 80);
        }
      };
      timeoutId = window.setTimeout(poll, 5);
    }

    const updateEnemies = (dt: number, eng: NonNullable<typeof engineRef.current>) => {
      const { maze, mazeSize, cellSize, offset } = eng.world;
      const px = eng.physics.position.x;
      const pz = eng.physics.position.z;
      const playerCell = worldToGrid(px, pz, mazeSize, cellSize, offset);

      let highestChaser: ChaserType = 'NONE';
      let sprintLocked = false;

      for (let i = 0; i < eng.enemies.length; i++) {
        const en = eng.enemies[i];
        if (en.cooldownTimer > 0) {
          en.cooldownTimer = Math.max(0, en.cooldownTimer - dt);
        }

        const enRadius = en.kind === 'SLENDER' ? 0.44 : 0.48;

        // If Guru Matematika is knocked out face-down (tengkurap) from Mystic Staff lightning:
        if (en.kind === 'TEACHER' && eng.teacherStunTimer > 0) {
          eng.teacherStunTimer = Math.max(0, eng.teacherStunTimer - dt);
          en.mode = 'PATROL';
          en.cooldownTimer = eng.teacherStunTimer;
          resolveEntityWallCollisions(en.position, enRadius, maze, cellSize, offset);
          en.group.position.set(en.position.x, 0.24, en.position.z);
          en.group.rotation.order = 'YXZ';
          en.group.rotation.set(-Math.PI * 0.5, en.rotationY, 0);
          en.parts.leftArm.rotation.set(0.35, 0, -0.2);
          en.parts.rightArm.rotation.set(0.35, 0, 0.2);
          en.parts.leftLeg.rotation.set(0, 0, 0);
          en.parts.rightLeg.rotation.set(0, 0, 0);
          if (eng.teacherStunTimer <= 0) {
            // Wake back up and resume normal patrol!
            en.group.rotation.order = 'XYZ';
            en.group.position.y = 0;
            en.group.rotation.set(0, en.rotationY, 0);
            en.parts.leftArm.rotation.set(0, 0, 0);
            en.parts.rightArm.rotation.set(0, 0, 0);
            en.parts.body.rotation.set(0, 0, 0);
            triggerAlertBanner('⚠ Guru Matematika sudah bangun & kembali berpatroli normal!', 3.2);
          }
          continue;
        }

        if (eng.chubbySacrificeCooldown > 0 && i === 0) {
          eng.chubbySacrificeCooldown = Math.max(0, eng.chubbySacrificeCooldown - dt);
        }

        // Companion Bang Biru (Pacified after hug / revive): walks upright normally & intercepts Guru MTK ONLY when actually met!
        if (en.kind === 'CHUBBY' && en.mode === 'PACIFIED') {
          if (eng.chubbyCompanionActive && !eng.chubbySacrificeDone) {
            eng.canReviveChubby = false;
            eng.chubbyReviveBlockedReason = null;

            const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
            if (
              teacher &&
              eng.chubbySacrificeCooldown <= 0 &&
              eng.teacherStunTimer <= 0 &&
              teacher.cooldownTimer <= 0 &&
              !eng.isHidingInLocker
            ) {
              const distTeacherToPlayer = Math.hypot(px - teacher.position.x, pz - teacher.position.z);
              const distTeacherToChubby = Math.hypot(
                en.position.x - teacher.position.x,
                en.position.z - teacher.position.z
              );
              if (
                (distTeacherToPlayer <= 8.5 || distTeacherToChubby <= 8.0) &&
                hasGridLineOfSight(px, pz, teacher.position.x, teacher.position.z, maze, cellSize, offset, 10.5)
              ) {
                eng.chubbyCompanionActive = false;
                eng.chubbySacrificeDone = true;
                handlersRef.current.onTriggerChubbySacrifice();
                break;
              }
            }

            const distP = Math.hypot(px - en.position.x, pz - en.position.z);
            const cCell = worldToGrid(en.position.x, en.position.z, mazeSize, cellSize, offset);
            const nextAllyStep = findNextMazeStep(cCell.r, cCell.c, playerCell.r, playerCell.c, maze);
            const allyStepWorld = gridToWorld(nextAllyStep.r, nextAllyStep.c, cellSize, offset);
            const allyTx =
              distP < 6.0 && hasGridLineOfSight(en.position.x, en.position.z, px, pz, maze, cellSize, offset, 7.5)
                ? px
                : allyStepWorld.x;
            const allyTz =
              distP < 6.0 && hasGridLineOfSight(en.position.x, en.position.z, px, pz, maze, cellSize, offset, 7.5)
                ? pz
                : allyStepWorld.z;
            const adx = allyTx - en.position.x;
            const adz = allyTz - en.position.z;
            const aDist = Math.hypot(adx, adz);
            const followSpeed = distP > 3.2 ? 4.4 : distP > 1.85 ? 3.1 : 0;

            if (followSpeed > 0 && aDist > 0.05) {
              const step = Math.min(aDist, followSpeed * dt);
              en.position.x += (adx / aDist) * step;
              en.position.z += (adz / aDist) * step;
              resolveEntityWallCollisions(en.position, enRadius, maze, cellSize, offset);
              const desiredYaw = Math.atan2(-adx, -adz);
              let diff = desiredYaw - en.rotationY;
              while (diff < -Math.PI) diff += Math.PI * 2;
              while (diff > Math.PI) diff -= Math.PI * 2;
              en.rotationY += diff * Math.min(1, 10 * dt);
            }
            // Guarantee strictly upright normal walking transforms every frame (preserve bodyBaseY!)
            en.group.rotation.order = 'XYZ';
            en.group.scale.set(1, 1, 1);
            en.group.position.set(en.position.x, 0, en.position.z);
            en.group.rotation.set(0, en.rotationY, 0);
            en.parts.body.position.set(0, en.bodyBaseY, 0);
            en.parts.body.rotation.set(0, 0, 0);
            en.parts.head.rotation.set(0, 0, 0);
            animateEnemyLimbs(en, dt, followSpeed);
          } else {
            // Fainted TELENTANG safely on corridor floor -> wait for Teacher to move far away, then allow [SPACE] mash revive!
            resolveEntityWallCollisions(en.position, enRadius, maze, cellSize, offset);
            en.group.rotation.order = 'YXZ';
            en.group.scale.set(1, 1, 1);
            en.group.position.set(en.position.x, 0.36, en.position.z);
            en.group.rotation.set(Math.PI * 0.5, en.rotationY, 0);
            en.parts.body.position.set(0, en.bodyBaseY, 0);
            en.parts.body.rotation.set(0, 0, 0);
            en.parts.head.rotation.set(0, 0, 0);
            en.parts.leftArm.rotation.set(0.22, 0, -0.32);
            en.parts.rightArm.rotation.set(0.22, 0, 0.32);
            en.parts.leftLeg.rotation.set(0, 0, 0);
            en.parts.rightLeg.rotation.set(0, 0, 0);

            const distToChubby = Math.hypot(px - en.position.x, pz - en.position.z);
            const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
            const teacherDistPlayer = teacher ? Math.hypot(px - teacher.position.x, pz - teacher.position.z) : 99;
            const teacherDistChubby = teacher
              ? Math.hypot(en.position.x - teacher.position.x, en.position.z - teacher.position.z)
              : 99;
            const teacherFarEnough =
              (teacherDistPlayer >= 10 && teacherDistChubby >= 10) ||
              (eng.teacherStunTimer > 0 && teacherDistChubby >= 7.5);

            if (eng.chubbyNeedsRevive && distToChubby <= 2.85 && !eng.isHidingInLocker) {
              if (teacherFarEnough) {
                eng.canReviveChubby = true;
                eng.chubbyReviveBlockedReason = null;
              } else {
                eng.canReviveChubby = false;
                eng.chubbyReviveBlockedReason =
                  'Guru MTK masih terlalu dekat — menjauh dulu untuk membangunkan Bang Biru!';
              }
            } else {
              eng.canReviveChubby = false;
              eng.chubbyReviveBlockedReason = null;
            }
          }
          continue;
        }

        const dxP = px - en.position.x;
        const dzP = pz - en.position.z;
        const distPlayer = Math.sqrt(dxP * dxP + dzP * dzP);

        const canSeePlayer =
          !eng.isHidingInLocker &&
          en.cooldownTimer <= 0 &&
          hasGridLineOfSight(
            en.position.x,
            en.position.z,
            px,
            pz,
            maze,
            cellSize,
            offset,
            en.kind === 'SLENDER' ? 28 : en.kind === 'TEACHER' ? 24 : 18
          );

        // If player hides in a locker, Math Teacher stops chasing immediately!
        if (eng.isHidingInLocker && en.kind === 'TEACHER' && en.mode === 'CHASE') {
          en.mode = 'PATROL';
          en.chaseMemoryTimer = 0;
          en.targetCell = null;
        }

        if (canSeePlayer) {
          en.mode = 'CHASE';
          en.chaseMemoryTimer = en.kind === 'SLENDER' ? 5.5 : en.kind === 'TEACHER' ? 4.5 : 3.5;
        } else if (en.mode === 'CHASE') {
          en.chaseMemoryTimer -= dt;
          if (en.chaseMemoryTimer <= 0 || eng.isHidingInLocker) {
            en.mode = 'PATROL';
            en.targetCell = null;
          }
        }

        // Slenderman Sprint Lock at <= 2.0m
        if (
          en.kind === 'SLENDER' &&
          !eng.isHidingInLocker &&
          en.cooldownTimer <= 0 &&
          distPlayer <= SLENDER_SPRINT_LOCK_DIST
        ) {
          sprintLocked = true;
        }

        // Priority activeChaser for HUD & Soundtrack
        if (en.mode === 'CHASE' && !eng.isHidingInLocker) {
          if (en.kind === 'SLENDER' && distPlayer < 24) {
            highestChaser = 'SLENDER';
          } else if (en.kind === 'TEACHER' && highestChaser !== 'SLENDER') {
            highestChaser = 'TEACHER';
          } else if (en.kind === 'CHUBBY' && highestChaser === 'NONE') {
            highestChaser = 'CHUBBY';
          }
        }

        // Movement per enemy policy + Center-aligned corridor steering (prevents cutting across wall corners!)
        const eCell = worldToGrid(en.position.x, en.position.z, mazeSize, cellSize, offset);

        let goalCell: { r: number; c: number };
        if (en.mode === 'CHASE') {
          goalCell = playerCell;
        } else {
          if (!en.targetCell || (eCell.r === en.targetCell.r && eCell.c === en.targetCell.c)) {
            en.targetCell = pickOpenCell(maze, 1, 1, [playerCell]);
          }
          goalCell = en.targetCell;
        }

        const nextStep = findNextMazeStep(eCell.r, eCell.c, goalCell.r, goalCell.c, maze);
        const eCellWorld = gridToWorld(eCell.r, eCell.c, cellSize, offset);
        const stepWorld = gridToWorld(nextStep.r, nextStep.c, cellSize, offset);

        // Steer through cell center on orthogonal corridor turns so entities don't hug/clip inside wall corners
        let wpX = stepWorld.x;
        let wpZ = stepWorld.z;
        const dr = nextStep.r - eCell.r;
        const dc = nextStep.c - eCell.c;
        if (dr !== 0 && Math.abs(en.position.x - eCellWorld.x) > 0.72) {
          wpX = eCellWorld.x;
          wpZ = eCellWorld.z;
        } else if (dc !== 0 && Math.abs(en.position.z - eCellWorld.z) > 0.72) {
          wpX = eCellWorld.x;
          wpZ = eCellWorld.z;
        }

        const tx = en.mode === 'CHASE' && canSeePlayer ? px : wpX;
        const tz = en.mode === 'CHASE' && canSeePlayer ? pz : wpZ;

        const dirX = tx - en.position.x;
        const dirZ = tz - en.position.z;
        const stepDist = Math.sqrt(dirX * dirX + dirZ * dirZ);

        let moveSpeed = 0;
        if (en.kind === 'TEACHER') {
          moveSpeed = en.mode === 'CHASE' ? TEACHER_CHASE_SPEED : 2.2;
        } else if (en.kind === 'CHUBBY') {
          moveSpeed = en.mode === 'CHASE' ? 2.55 : 1.5;
        } else {
          moveSpeed = en.mode === 'CHASE' ? SLENDER_CREEP_SPEED : 0.75;
        }

        if (en.kind === 'SLENDER' && en.mode === 'CHASE') {
          // Blink-step pursuit at 50% speed with wall collision guard
          en.blinkTimer += dt;
          if (en.blinkHideTimer > 0) {
            en.blinkHideTimer -= dt;
            en.group.visible = false;
          } else {
            en.group.visible = true;
          }

          if (stepDist > 0.05) {
            const creep = Math.min(stepDist, moveSpeed * dt);
            en.position.x += (dirX / stepDist) * creep;
            en.position.z += (dirZ / stepDist) * creep;
            resolveEntityWallCollisions(en.position, enRadius, maze, cellSize, offset);
          }

          if (en.blinkTimer >= 0.52 && stepDist > 0.25) {
            en.blinkTimer = 0;
            en.blinkHideTimer = 0.09;
            const jumpLen = Math.min(stepDist - 0.15, SLENDER_BLINK_HOP);
            if (jumpLen > 0) {
              const candX = en.position.x + (dirX / stepDist) * jumpLen;
              const candZ = en.position.z + (dirZ / stepDist) * jumpLen;
              if (hasGridLineOfSight(en.position.x, en.position.z, candX, candZ, maze, cellSize, offset, jumpLen + 0.5)) {
                en.position.x = candX;
                en.position.z = candZ;
                resolveEntityWallCollisions(en.position, enRadius, maze, cellSize, offset);
              }
            }
          }
        } else if (stepDist > 0.05) {
          en.group.visible = true;
          const step = Math.min(stepDist, moveSpeed * dt);
          en.position.x += (dirX / stepDist) * step;
          en.position.z += (dirZ / stepDist) * step;
          resolveEntityWallCollisions(en.position, enRadius, maze, cellSize, offset);
        }

        // Smooth rotation toward movement direction (-Z front)
        if (stepDist > 0.1) {
          const desiredYaw = Math.atan2(-dirX, -dirZ);
          let diff = desiredYaw - en.rotationY;
          while (diff < -Math.PI) diff += Math.PI * 2;
          while (diff > Math.PI) diff -= Math.PI * 2;
          en.rotationY += diff * Math.min(1, 10 * dt);
        }

        en.group.rotation.order = 'XYZ';
        en.group.position.set(en.position.x, 0, en.position.z);
        en.group.rotation.set(0, en.rotationY, 0);
        animateEnemyLimbs(en, dt, moveSpeed);

        // Recompute distance after wall-resolved movement for catch thresholds
        const postDist = Math.hypot(px - en.position.x, pz - en.position.z);

        // Collision / Catch Checks (when player is outside lockers)
        if (!eng.isHidingInLocker && en.cooldownTimer <= 0) {
          if (en.kind === 'TEACHER' && postDist < 1.35) {
            handlersRef.current.onTeacherCatch();
            break;
          } else if (en.kind === 'CHUBBY' && postDist < 1.45) {
            handlersRef.current.onTriggerChubbyQuiz();
            break;
          } else if (en.kind === 'SLENDER' && postDist <= SLENDER_SPACE_CAPTURE_DIST) {
            const fX = -Math.sin(eng.followCamera.yaw);
            const fZ = -Math.cos(eng.followCamera.yaw);
            en.position.set(px + fX * 1.15, 0, pz + fZ * 1.15);
            resolveEntityWallCollisions(en.position, enRadius, maze, cellSize, offset);
            en.group.position.copy(en.position);
            en.group.lookAt(eng.camera.position.x, 0, eng.camera.position.z);
            en.group.visible = true;
            handlersRef.current.onSlenderJumpscare();
            break;
          }
        }
      }

      eng.isSprintLocked = sprintLocked;

      if (highestChaser !== lastAudioChaser) {
        lastAudioChaser = highestChaser;
        sound.setChaserAudio(highestChaser);
      }

      return highestChaser;
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const eng = engineRef.current;
      if (!eng) return;

      const keyForward =
        (activeKeys['KeyW'] || activeKeys['ArrowUp'] ? 1 : 0) -
        (activeKeys['KeyS'] || activeKeys['ArrowDown'] ? 1 : 0);
      const keyStrafe =
        (activeKeys['KeyD'] || activeKeys['ArrowRight'] ? 1 : 0) -
        (activeKeys['KeyA'] || activeKeys['ArrowLeft'] ? 1 : 0);

      eng.input.forward = eng.touchVector.y !== 0 ? eng.touchVector.y : keyForward;
      eng.input.strafe = eng.touchVector.x !== 0 ? eng.touchVector.x : keyStrafe;
      // Shift Lock [L] locks auto-sprint ON so player doesn't need to hold Shift!
      eng.input.sprint =
        activeKeys['ShiftLeft'] ||
        activeKeys['ShiftRight'] ||
        eng.touchSprint ||
        eng.isShiftLocked;

      if (eng.alertTimer > 0) {
        eng.alertTimer -= dt;
        if (eng.alertTimer <= 0) {
          eng.alertText = null;
          setStats((prev) => ({ ...prev, alertMessage: null }));
        }
      }

      // 1. ALL CINEMA CUTSCENES (Opening, Chubby multi-stage, Teacher catch, Slenderman abduct, Space arrive, Teacher zap)
      if (eng.cutsceneMode !== 'NONE') {
        const cutsceneDt = Math.min(rawDt, 0.25);
        eng.cutsceneTimer =
          eng.cutsceneStartMs > 0
            ? (now - eng.cutsceneStartMs) / 1000
            : eng.cutsceneTimer + cutsceneDt;
        const t = eng.cutsceneTimer;
        const chubby = eng.enemies.find((e) => e.kind === 'CHUBBY');
        const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
        const slender = eng.enemies.find((e) => e.kind === 'SLENDER');

        if (eng.cutsceneMode === 'OPENING') {
          const ow = eng.openingWorld;
          eng.character.setManualPose(true);
          eng.character.group.rotation.order = 'XYZ';
          // Position & pose character based on relaxed 20s timeline (0..20.0s)
          if (t < 5.5) {
            // Phase 1 (0..5.5s): Close-up on realistic normal-sized smartphone in hands, smoothly zoom out to suburban house
            const p = t / 5.5;
            const ease = p * p * (3 - 2 * p);
            eng.character.group.position.set(0, 0, 5.4);
            eng.character.group.rotation.set(0, 0, 0);
            eng.character.parts.leftShoulder.rotation.set(1.05, 0, -0.22);
            eng.character.parts.rightShoulder.rotation.set(1.05, 0, 0.22);
            eng.character.parts.leftElbow.rotation.set(-0.55, 0, 0);
            eng.character.parts.rightElbow.rotation.set(-0.55, 0, 0);

            ow.phoneGroup.visible = true;
            ow.phoneGroup.position.set(0, 1.36, 4.90);
            ow.phoneGroup.rotation.set(-0.22, 0.25 * (1 - ease), 0);
            ow.phoneScreenMat.color.setHex(0xffffff);
            ow.doorPivot.rotation.y = 0;
            ow.backroomsLight.intensity = 0.2;

            camera.position.set(
              THREE.MathUtils.lerp(0.55, 2.05, ease),
              THREE.MathUtils.lerp(1.50, 2.05, ease),
              THREE.MathUtils.lerp(5.12, 8.5, ease)
            );
            tempCutsceneTarget.set(
              0,
              THREE.MathUtils.lerp(1.36, 1.35, ease),
              THREE.MathUtils.lerp(4.90, 2.0, ease)
            );
            camera.lookAt(tempCutsceneTarget);
          } else if (t < 10.5) {
            // Phase 2 (5.5..10.5s): Calmly lower phone & walk up stone walkway toward house front door
            const p = (t - 5.5) / 5.0;
            const zPos = THREE.MathUtils.lerp(5.4, 1.25, p);
            const yPos = zPos < 2.1 ? 0.22 : 0;
            const stride = Math.sin(t * 6.5);
            ow.phoneGroup.visible = p < 0.35;
            ow.phoneGroup.position.set(0.24, 1.35 - p * 0.85, zPos - 0.42);
            ow.phoneScreenMat.color.setHex(p < 0.2 ? 0xffffff : 0x111111);
            ow.doorPivot.rotation.y = 0;

            eng.character.group.position.set(0, yPos, zPos);
            eng.character.group.rotation.set(0, 0, 0);
            eng.character.parts.leftHip.rotation.x = stride * 0.52;
            eng.character.parts.rightHip.rotation.x = -stride * 0.52;
            eng.character.parts.leftShoulder.rotation.x = -stride * 0.42;
            eng.character.parts.rightShoulder.rotation.x = stride * 0.42;
            eng.character.parts.leftShoulder.rotation.z = 0;
            eng.character.parts.rightShoulder.rotation.z = 0;

            camera.position.set(2.05, 2.0, zPos + 3.4);
            tempCutsceneTarget.set(0, 1.4, zPos - 1.2);
            camera.lookAt(tempCutsceneTarget);
          } else if (t < 15.2) {
            // Phase 3 (10.5..15.2s): Reach right arm forward & slowly swing front door INWARD (+Y) -> Backrooms glows yellow!
            const p = Math.min(1, (t - 10.5) / 4.2);
            const openEase = p * p * (3 - 2 * p);
            ow.phoneGroup.visible = false;
            eng.character.group.position.set(0, 0.22, 1.25);
            eng.character.parts.leftHip.rotation.x = 0;
            eng.character.parts.rightHip.rotation.x = 0;
            eng.character.parts.leftShoulder.rotation.x = 0;
            eng.character.parts.rightShoulder.rotation.x = 1.35 * Math.sin(Math.min(1, p * 1.4) * Math.PI * 0.5);
            eng.character.parts.rightElbow.rotation.x = -0.25;

            ow.doorPivot.rotation.y = 1.72 * openEase;
            ow.backroomsLight.intensity = 0.6 + 5.0 * openEase;

            camera.position.set(1.15 - openEase * 0.55, 1.75, 3.35 - openEase * 0.55);
            tempCutsceneTarget.set(0, 1.45, -2.5);
            camera.lookAt(tempCutsceneTarget);
          } else {
            // Phase 4 (15.2..20.0s): Step inside Backrooms doorway & stand ready!
            const p = Math.min(1, (t - 15.2) / 4.8);
            const walkDone = p > 0.72;
            const zPos = THREE.MathUtils.lerp(1.25, -2.6, Math.min(1, p / 0.72));
            const stride = walkDone ? 0 : Math.sin(t * 6.5);
            ow.doorPivot.rotation.y = 1.72;
            ow.backroomsLight.intensity = 5.6;

            eng.character.group.position.set(0, 0.22, zPos);
            eng.character.parts.leftHip.rotation.x = stride * 0.48;
            eng.character.parts.rightHip.rotation.x = -stride * 0.48;
            eng.character.parts.leftShoulder.rotation.x = walkDone ? 0.1 : -stride * 0.42;
            eng.character.parts.rightShoulder.rotation.x = walkDone ? 0.1 : stride * 0.42;

            camera.position.set(0.35 * (1 - p), 1.95, zPos + 3.1);
            tempCutsceneTarget.set(0, 1.55, zPos - 2.5);
            camera.lookAt(tempCutsceneTarget);
          }

          renderer.render(ow.scene, camera);
        } else if (eng.cutsceneMode === 'CHUBBY_CAPTURE' && chubby) {
          eng.character.setManualPose(true);
          const ax = eng.cutsceneAnchor.x;
          const az = eng.cutsceneAnchor.z;
          const dx = eng.cutsceneDir.x;
          const dz = eng.cutsceneDir.y;
          const dirYaw = Math.atan2(-dx, -dz);
          const sideX = -dz;
          const sideZ = dx;

          if (t < 1.7) {
            // Phase 1: Chubby stands close & reaches both arms/hands tightly forward gripping player's neck!
            const shake = Math.sin(t * 28) * 0.035;
            eng.character.group.rotation.order = 'XYZ';
            eng.character.group.position.set(ax + shake, 0, az);
            eng.character.group.rotation.set(0, dirYaw, 0);
            eng.character.parts.leftShoulder.rotation.set(1.28, 0, -0.18);
            eng.character.parts.rightShoulder.rotation.set(1.28, 0, 0.18);

            chubby.group.rotation.order = 'XYZ';
            chubby.group.position.set(ax + dx * 0.68, 0, az + dz * 0.68);
            chubby.group.rotation.set(0, dirYaw + Math.PI, 0);
            chubby.parts.body.position.x = 0;
            chubby.parts.leftArm.rotation.set(1.75, 0, 0.32);
            chubby.parts.rightArm.rotation.set(1.75, 0, -0.32);
            chubby.parts.body.rotation.set(0.18, 0, shake * 1.4);

            camera.position.set(
              ax + dx * 0.34 + sideX * 2.0,
              1.62,
              az + dz * 0.34 + sideZ * 2.0
            );
            tempCutsceneTarget.set(ax + dx * 0.34, 1.38, az + dz * 0.34);
            camera.lookAt(tempCutsceneTarget);
            eng.sackMesh.visible = false;
          } else if (t < 2.8) {
            // Phase 2: Player falls backward flat on floor (clean telentang in all directions using YXZ order)
            const p = (t - 1.7) / 1.1;
            const ease = Math.min(1, p * p);
            eng.character.group.rotation.order = 'YXZ';
            eng.character.group.position.set(ax, 0.22 * ease, az);
            eng.character.group.rotation.set((Math.PI * 0.5) * ease, dirYaw, 0);
            eng.character.parts.leftShoulder.rotation.set(0.5 * (1 - ease), 0, 0.4 * ease);
            eng.character.parts.rightShoulder.rotation.set(0.5 * (1 - ease), 0, -0.4 * ease);

            chubby.group.rotation.order = 'XYZ';
            chubby.group.position.set(ax + dx * 1.05, 0, az + dz * 1.05);
            chubby.group.rotation.set(0, dirYaw + Math.PI, 0);
            chubby.parts.leftArm.rotation.set(0.95, 0, 0);
            chubby.parts.rightArm.rotation.set(0.95, 0, 0);
            chubby.parts.body.rotation.set(0.28, 0, 0);

            camera.position.set(
              ax + sideX * (2.05 - ease * 1.55),
              THREE.MathUtils.lerp(1.58, 0.48, ease),
              az + sideZ * (2.05 - ease * 1.55)
            );
            tempCutsceneTarget.set(ax + dx * 0.45, 0.9, az + dz * 0.45);
            camera.lookAt(tempCutsceneTarget);
          } else {
            // Phase 3: POV lying flat on back (telentang) looking UP as Chubby lowers burlap sack over head!
            const p = Math.min(1, (t - 2.8) / 2.0);
            eng.character.group.rotation.order = 'YXZ';
            eng.character.group.position.set(ax, 0.22, az);
            eng.character.group.rotation.set(Math.PI * 0.5, dirYaw, 0);
            eng.character.group.visible = false;

            chubby.group.rotation.order = 'XYZ';
            chubby.group.position.set(ax + dx * 0.72, 0, az + dz * 0.72);
            chubby.group.rotation.set(0, dirYaw + Math.PI, 0);
            chubby.parts.body.rotation.set(0.45, 0, 0);
            chubby.parts.head.rotation.set(0.35, 0, 0);
            chubby.parts.leftArm.rotation.set(1.25, 0, 0.12);
            chubby.parts.rightArm.rotation.set(1.25, 0, -0.12);

            eng.sackMesh.visible = true;
            const camEyeX = ax - dx * 0.15;
            const camEyeZ = az - dz * 0.15;
            eng.sackMesh.position.set(
              camEyeX,
              THREE.MathUtils.lerp(1.45, 0.42, p),
              camEyeZ
            );

            camera.position.set(camEyeX, 0.34, camEyeZ);
            tempCutsceneTarget.set(ax + dx * 0.52, 1.72, az + dz * 0.52);
            camera.lookAt(tempCutsceneTarget);
          }

          renderer.render(eng.world.scene, camera);
        } else if (eng.cutsceneMode === 'CHUBBY_COUNTER' && chubby) {
          eng.sackMesh.visible = false;
          eng.character.setManualPose(true);
          eng.character.group.visible = true;
          const ax = eng.cutsceneAnchor.x;
          const az = eng.cutsceneAnchor.z;
          const dx = eng.cutsceneDir.x;
          const dz = eng.cutsceneDir.y;
          const dirYaw = Math.atan2(-dx, -dz);
          const sideX = -dz;
          const sideZ = dx;

          eng.character.group.rotation.order = 'XYZ';
          eng.character.group.rotation.set(0, dirYaw, 0);

          if (t < 1.1) {
            const p = t / 1.1;
            eng.character.group.position.set(ax, 0, az);
            eng.character.parts.rightShoulder.rotation.set(-0.75 * p, 0, 0);
            eng.character.parts.rightElbow.rotation.set(-0.8 * p, 0, 0);
            eng.character.parts.leftShoulder.rotation.set(0.6 * p, 0, 0);

            chubby.group.rotation.order = 'XYZ';
            chubby.group.position.set(ax + dx * 1.05, 0, az + dz * 1.05);
            chubby.group.rotation.set(0, dirYaw + Math.PI, 0);
            chubby.parts.body.position.x = 0;
            chubby.parts.body.rotation.set(0, 0, 0);
            chubby.parts.leftArm.rotation.set(0.3, 0, 0);
            chubby.parts.rightArm.rotation.set(0.3, 0, 0);
          } else if (t < 1.85) {
            const p = Math.min(1, (t - 1.1) / 0.35);
            eng.character.group.position.set(ax + dx * 0.32 * p, 0, az + dz * 0.32 * p);
            eng.character.parts.torso.rotation.set(-0.24 * p, 0, 0);
            eng.character.parts.rightShoulder.rotation.set(THREE.MathUtils.lerp(-0.75, 1.58, p), 0, 0);
            eng.character.parts.rightElbow.rotation.set(THREE.MathUtils.lerp(-0.8, -0.1, p), 0, 0);

            chubby.group.rotation.order = 'XYZ';
            chubby.group.position.set(ax + dx * (1.05 + p * 0.25), 0, az + dz * (1.05 + p * 0.25));
            chubby.parts.body.rotation.set(0.28 * p, 0, 0);
            chubby.parts.leftArm.rotation.set(0.9 * p, 0, 0.35 * p);
            chubby.parts.rightArm.rotation.set(0.9 * p, 0, -0.35 * p);
          } else {
            // Chubby collapses clean TELENTANG (flat on back, face UP +Y) on floor!
            const p = Math.min(1, (t - 1.85) / 1.1);
            eng.character.group.position.set(ax + dx * 0.2, 0, az + dz * 0.2);
            eng.character.parts.torso.rotation.set(-0.08, 0, 0);
            eng.character.parts.rightShoulder.rotation.set(0.25, 0, 0);
            eng.character.parts.rightElbow.rotation.set(-0.2, 0, 0);

            chubby.group.rotation.order = 'YXZ';
            chubby.group.position.set(ax + dx * 1.35, 0.38 * p, az + dz * 1.35);
            chubby.group.rotation.set((Math.PI * 0.5) * p, dirYaw + Math.PI, 0);
            chubby.parts.body.rotation.set(0, 0, 0);
          }

          camera.position.set(
            ax + dx * 0.75 + sideX * 2.75,
            1.42,
            az + dz * 0.75 + sideZ * 2.75
          );
          tempCutsceneTarget.set(ax + dx * 0.85, 0.85, az + dz * 0.85);
          camera.lookAt(tempCutsceneTarget);
          renderer.render(eng.world.scene, camera);
        } else if (eng.cutsceneMode === 'CHUBBY_WAKE_MASH' && chubby) {
          eng.character.setManualPose(true);
          eng.character.group.visible = true;
          const { maze, cellSize, offset } = eng.world;
          const ax = eng.cutsceneAnchor.x;
          const az = eng.cutsceneAnchor.z;
          const dx = eng.cutsceneDir.x;
          const dz = eng.cutsceneDir.y;
          const dirYaw = Math.atan2(-dx, -dz);
          const sideX = -dz;
          const sideZ = dx;

          const cx =
            eng.chubbyWakeContext === 'SACRIFICE_REVIVE'
              ? chubby.position.x
              : ax + dx * 1.35;
          const cz =
            eng.chubbyWakeContext === 'SACRIFICE_REVIVE'
              ? chubby.position.z
              : az + dz * 1.35;

          // Natural, gentle rocking impulse on Space mash (no weird wild spinning)
          eng.chubbyShakeImpulse = Math.max(0, eng.chubbyShakeImpulse - cutsceneDt * 2.8);
          const gentleRock = Math.sin(t * 18) * eng.chubbyShakeImpulse * 0.065;
          const armNudge = Math.sin(t * 18) * eng.chubbyShakeImpulse * 0.14;

          // Dynamically pick the clearest non-wall side around Chubby so the player never clips or leans on a wall
          const candidateDirs: [number, number][] = [
            [sideX, sideZ],
            [-sideX, -sideZ],
            [-dx, -dz],
            [dx, dz],
          ];
          let bestStandX = cx + sideX * 0.90;
          let bestStandZ = cz + sideZ * 0.90;
          let bestDirX = sideX;
          let bestDirZ = sideZ;
          let bestScore = -999;

          for (let k = 0; k < candidateDirs.length; k++) {
            const [vx, vz] = candidateDirs[k];
            const candX = cx + vx * 0.90;
            const candZ = cz + vz * 0.90;
            const los = hasGridLineOfSight(cx, cz, candX, candZ, maze, cellSize, offset, 1.8);
            tempCutsceneTarget.set(candX, 0, candZ);
            resolveEntityWallCollisions(tempCutsceneTarget, 0.48, maze, cellSize, offset);
            const wallPush = Math.hypot(tempCutsceneTarget.x - candX, tempCutsceneTarget.z - candZ);
            const sep = Math.hypot(tempCutsceneTarget.x - cx, tempCutsceneTarget.z - cz);
            const score = (los ? 3.0 : 0) + sep - wallPush * 5.0;
            if (score > bestScore) {
              bestScore = score;
              bestStandX = tempCutsceneTarget.x;
              bestStandZ = tempCutsceneTarget.z;
              bestDirX = vx;
              bestDirZ = vz;
            }
          }

          // Face directly toward Chubby (-Z faces target when yaw = atan2(px - cx, pz - cz))
          const faceChubbyYaw = Math.atan2(bestStandX - cx, bestStandZ - cz);
          eng.character.group.rotation.order = 'XYZ';
          eng.character.group.position.set(bestStandX, -0.07, bestStandZ);
          eng.character.group.rotation.set(0, faceChubbyYaw, 0);
          eng.character.parts.leftHip.rotation.set(0.52, 0, 0);
          eng.character.parts.rightHip.rotation.set(0.52, 0, 0);
          eng.character.parts.leftKnee.rotation.set(-0.82, 0, 0);
          eng.character.parts.rightKnee.rotation.set(-0.82, 0, 0);
          // Negative X leans torso & head FORWARD (-Z) right over Bang Biru!
          eng.character.parts.torso.rotation.set(-0.58 - Math.abs(gentleRock) * 0.65, 0, 0);
          eng.character.parts.headGroup.rotation.set(-0.20, 0, 0);
          eng.character.parts.leftShoulder.rotation.set(1.28 + armNudge * 0.7, 0, -0.14);
          eng.character.parts.rightShoulder.rotation.set(1.28 - armNudge * 0.7, 0, 0.14);
          eng.character.parts.leftElbow.rotation.set(0.22, 0, 0);
          eng.character.parts.rightElbow.rotation.set(0.22, 0, 0);

          if (eng.chubbyWokeUp) {
            if (eng.chubbyWakeContext === 'SACRIFICE_REVIVE') {
              // Revived upright on his feet immediately!
              resetEnemyPose(chubby);
              chubby.group.position.set(cx, 0, cz);
              chubby.group.rotation.set(0, dirYaw + Math.PI, 0);
              if (chubby.pacifiedHalo) chubby.pacifiedHalo.visible = true;
            } else {
              // Wakes up and sits upright before hug!
              chubby.group.rotation.order = 'XYZ';
              chubby.group.position.set(cx, -0.32, cz);
              chubby.group.rotation.set(0, dirYaw + Math.PI, 0);
              chubby.parts.body.position.set(0, chubby.bodyBaseY, 0);
              chubby.parts.head.rotation.set(0, 0, 0);
              chubby.parts.leftLeg.rotation.set(1.45, 0, 0);
              chubby.parts.rightLeg.rotation.set(1.45, 0, 0);
              chubby.parts.body.rotation.set(-0.08, 0, 0);
              chubby.parts.leftArm.rotation.set(0.35, 0, 0);
              chubby.parts.rightArm.rotation.set(0.35, 0, 0);
              if (chubby.pacifiedHalo) chubby.pacifiedHalo.visible = true;
            }
          } else {
            // Lying flat TELENTANG on back, gently nudged sideways when [SPACE] is pressed
            const perpX = -bestDirZ;
            const perpZ = bestDirX;
            chubby.group.rotation.order = 'YXZ';
            chubby.group.position.set(cx + perpX * (gentleRock * 0.45), 0.38, cz + perpZ * (gentleRock * 0.45));
            chubby.group.rotation.set(Math.PI * 0.5, dirYaw + Math.PI, 0);
            chubby.parts.body.position.set(gentleRock * 0.5, chubby.bodyBaseY, 0);
            chubby.parts.body.rotation.set(0, 0, gentleRock * 1.1);
            chubby.parts.head.rotation.set(0, 0, gentleRock * 1.5);
            chubby.parts.leftArm.rotation.set(0.32 + armNudge, 0, -0.18);
            chubby.parts.rightArm.rotation.set(0.32 - armNudge, 0, 0.18);
          }

          // Pick a wall-free camera vantage looking clearly at both the forward-leaning player and Bang Biru
          const camCandidates: [number, number][] = [
            [cx - bestDirX * 1.85 - bestDirZ * 1.15, cz - bestDirZ * 1.85 + bestDirX * 1.15],
            [cx - bestDirX * 1.85 + bestDirZ * 1.15, cz - bestDirZ * 1.85 - bestDirX * 1.15],
            [cx - bestDirZ * 2.15, cz + bestDirX * 2.15],
            [cx + bestDirZ * 2.15, cz - bestDirX * 2.15],
          ];
          let camX = camCandidates[0][0];
          let camZ = camCandidates[0][1];
          for (let cIdx = 0; cIdx < camCandidates.length; cIdx++) {
            const [tx, tz] = camCandidates[cIdx];
            if (hasGridLineOfSight(cx, cz, tx, tz, maze, cellSize, offset, 3.5)) {
              camX = tx;
              camZ = tz;
              break;
            }
          }
          camera.position.set(camX, 1.38, camZ);
          tempCutsceneTarget.set((cx + bestStandX) * 0.5, 0.58, (cz + bestStandZ) * 0.5);
          camera.lookAt(tempCutsceneTarget);
          renderer.render(eng.world.scene, camera);
        } else if (eng.cutsceneMode === 'HUG' && chubby) {
          eng.character.setManualPose(true);
          eng.character.group.visible = true;
          const ax = eng.cutsceneAnchor.x;
          const az = eng.cutsceneAnchor.z;
          const dx = eng.cutsceneDir.x;
          const dz = eng.cutsceneDir.y;
          const dirYaw = Math.atan2(-dx, -dz);
          const sway = Math.sin(t * 2.2) * 0.04;

          eng.character.group.rotation.order = 'XYZ';
          eng.character.group.position.set(ax + dx * 0.25, 0, az + dz * 0.25);
          eng.character.group.rotation.set(0, dirYaw, sway);
          eng.character.parts.leftHip.rotation.set(0, 0, 0);
          eng.character.parts.rightHip.rotation.set(0, 0, 0);
          eng.character.parts.leftKnee.rotation.set(0, 0, 0);
          eng.character.parts.rightKnee.rotation.set(0, 0, 0);
          eng.character.parts.headGroup.rotation.set(0, 0, 0);
          eng.character.parts.torso.rotation.set(-0.08, 0, 0);
          eng.character.parts.leftShoulder.rotation.set(1.38, 0, 0.16);
          eng.character.parts.rightShoulder.rotation.set(1.38, 0, -0.16);
          eng.character.parts.leftElbow.rotation.set(0.35, 0, 0);
          eng.character.parts.rightElbow.rotation.set(0.35, 0, 0);

          chubby.group.rotation.order = 'XYZ';
          chubby.group.position.set(ax + dx * 0.95, 0, az + dz * 0.95);
          chubby.group.rotation.set(0, dirYaw + Math.PI, -sway);
          chubby.parts.body.position.set(0, chubby.bodyBaseY, 0);
          chubby.parts.head.rotation.set(0, 0, 0);
          chubby.parts.leftLeg.rotation.set(0, 0, 0);
          chubby.parts.rightLeg.rotation.set(0, 0, 0);
          chubby.parts.body.rotation.set(-0.08, 0, 0);
          chubby.parts.leftArm.rotation.set(1.36, 0, 0.22);
          chubby.parts.rightArm.rotation.set(1.36, 0, -0.22);
          if (chubby.pacifiedHalo) chubby.pacifiedHalo.visible = true;

          const centerX = ax + dx * 0.6;
          const centerZ = az + dz * 0.6;
          const orbit = t * 0.35 + dirYaw + 1.15;
          camera.position.set(
            centerX + Math.sin(orbit) * 2.6,
            1.52,
            centerZ + Math.cos(orbit) * 2.6
          );
          tempCutsceneTarget.set(centerX, 1.18, centerZ);
          camera.lookAt(tempCutsceneTarget);
          renderer.render(eng.world.scene, camera);
        } else if (eng.cutsceneMode === 'CHUBBY_SACRIFICE' && chubby && teacher) {
          eng.character.setManualPose(true);
          eng.character.group.visible = true;
          eng.character.group.rotation.order = 'XYZ';
          teacher.group.rotation.order = 'XYZ';
          const { maze, cellSize, offset } = eng.world;
          const ax = eng.cutsceneAnchor.x;
          const az = eng.cutsceneAnchor.z;
          const dx = eng.cutsceneDir.x;
          const dz = eng.cutsceneDir.y;
          const dirYaw = Math.atan2(-dx, -dz);
          const sideX = -dz;
          const sideZ = dx;
          const cStop = eng.sacrificeDistChubby;
          const tStop = eng.sacrificeDistTeacher;

          if (t < 2.2) {
            const p = t / 2.2;
            const cDist = THREE.MathUtils.lerp(1.0, cStop, p);
            const tDist = THREE.MathUtils.lerp(tStop + 2.2, tStop, p);

            eng.character.group.position.set(ax + dx * p * 0.9, 0, az + dz * p * 0.9);
            resolveEntityWallCollisions(eng.character.group.position, 0.45, maze, cellSize, offset);
            eng.character.group.rotation.set(0, dirYaw, 0);
            const pWalk = Math.sin(t * 7);
            eng.character.parts.leftHip.rotation.x = pWalk * 0.35;
            eng.character.parts.rightHip.rotation.x = -pWalk * 0.35;

            chubby.group.rotation.order = 'XYZ';
            chubby.group.position.set(ax + dx * cDist, 0, az + dz * cDist);
            resolveEntityWallCollisions(chubby.group.position, 0.48, maze, cellSize, offset);
            chubby.group.rotation.set(0, dirYaw, 0);
            animateEnemyLimbs(chubby, cutsceneDt, 2.5);

            teacher.group.position.set(ax + dx * tDist, 0, az + dz * tDist);
            resolveEntityWallCollisions(teacher.group.position, 0.48, maze, cellSize, offset);
            teacher.group.rotation.set(0, dirYaw + Math.PI, 0);
            teacher.group.visible = true;
            animateEnemyLimbs(teacher, cutsceneDt, 3.0);

            camera.position.set(
              ax + dx * (cStop * 0.5) + sideX * 2.75,
              1.92,
              az + dz * (cStop * 0.5) + sideZ * 2.75
            );
            tempCutsceneTarget.set(chubby.group.position.x, 1.2, chubby.group.position.z);
            camera.lookAt(tempCutsceneTarget);
          } else if (t < 7.2) {
            const struggle = Math.sin(t * 9) * 0.14;
            eng.character.group.position.set(ax + dx * 0.9, 0, az + dz * 0.9);
            resolveEntityWallCollisions(eng.character.group.position, 0.45, maze, cellSize, offset);
            eng.character.parts.leftHip.rotation.x = 0;
            eng.character.parts.rightHip.rotation.x = 0;

            chubby.group.position.set(
              ax + dx * (cStop + struggle * 0.3),
              0,
              az + dz * (cStop + struggle * 0.3)
            );
            resolveEntityWallCollisions(chubby.group.position, 0.48, maze, cellSize, offset);
            chubby.group.rotation.set(0, dirYaw, 0);
            chubby.parts.leftArm.rotation.set(1.15, 0, -0.55);
            chubby.parts.rightArm.rotation.set(1.15, 0, 0.55);
            chubby.parts.body.rotation.set(0.15, 0, struggle);

            teacher.group.position.set(
              ax + dx * (tStop + struggle * 0.35),
              0,
              az + dz * (tStop + struggle * 0.35)
            );
            resolveEntityWallCollisions(teacher.group.position, 0.48, maze, cellSize, offset);
            teacher.group.rotation.set(0, dirYaw + Math.PI, 0);
            teacher.parts.rightArm.rotation.set(1.25 + Math.sin(t * 7) * 0.45, 0, 0);
            teacher.parts.leftArm.rotation.set(1.0, 0, 0);

            camera.position.set(
              ax + dx * (cStop * 0.72) + sideX * 2.85,
              1.72,
              az + dz * (cStop * 0.72) + sideZ * 2.85
            );
            tempCutsceneTarget.set(
              (chubby.group.position.x + teacher.group.position.x) * 0.5,
              1.25,
              (chubby.group.position.z + teacher.group.position.z) * 0.5
            );
            camera.lookAt(tempCutsceneTarget);
          } else if (t < 8.5) {
            const p = Math.min(1, (t - 7.2) / 1.3);
            teacher.group.position.set(ax + dx * (tStop - 0.1), 0, az + dz * (tStop - 0.1));
            resolveEntityWallCollisions(teacher.group.position, 0.48, maze, cellSize, offset);
            teacher.parts.rightArm.rotation.set(THREE.MathUtils.lerp(2.0, 0.55, Math.min(1, p * 2.2)), 0, 0);

            // Chubby collapses cleanly TELENTANG (flat on back, face UP +Y)
            chubby.group.rotation.order = 'YXZ';
            chubby.group.position.set(ax + dx * (cStop - 0.15), 0.38 * p, az + dz * (cStop - 0.15));
            resolveEntityWallCollisions(chubby.group.position, 0.48, maze, cellSize, offset);
            chubby.group.rotation.set((Math.PI * 0.5) * p, dirYaw, 0);
            chubby.parts.body.rotation.set(0, 0, 0);
            chubby.parts.leftArm.rotation.set(0.25 * p, 0, -0.3 * p);
            chubby.parts.rightArm.rotation.set(0.25 * p, 0, 0.3 * p);

            camera.position.set(
              ax + dx * (cStop * 0.75) + sideX * 2.7,
              1.55,
              az + dz * (cStop * 0.75) + sideZ * 2.7
            );
            tempCutsceneTarget.set(chubby.group.position.x, 0.9, chubby.group.position.z);
            camera.lookAt(tempCutsceneTarget);
          } else if (t < 9.8) {
            // Guru MTK bends down (menunduk) & drags telentang Bang Biru sideways using ONLY his free LEFT hand (right ruler arm tucked safe)!
            const p = (t - 8.5) / 1.3;
            const dragLat = p * 1.15;
            chubby.group.rotation.order = 'YXZ';
            chubby.group.position.set(
              ax + dx * (cStop - 0.15) + sideX * dragLat,
              0.38,
              az + dz * (cStop - 0.15) + sideZ * dragLat
            );
            resolveEntityWallCollisions(chubby.group.position, 0.48, maze, cellSize, offset);
            chubby.group.rotation.set(Math.PI * 0.5, dirYaw, 0);
            chubby.parts.body.rotation.set(0, 0, 0);
            chubby.parts.leftArm.rotation.set(0.25, 0, -0.3);
            chubby.parts.rightArm.rotation.set(0.25, 0, 0.3);

            teacher.group.rotation.order = 'XYZ';
            teacher.group.position.set(
              ax + dx * (cStop + 0.25) + sideX * (dragLat - 0.52),
              -0.14,
              az + dz * (cStop + 0.25) + sideZ * (dragLat - 0.52)
            );
            resolveEntityWallCollisions(teacher.group.position, 0.48, maze, cellSize, offset);
            teacher.group.rotation.set(0, dirYaw + Math.PI - 0.32, 0);
            teacher.parts.body.rotation.set(-0.58, 0, 0);
            teacher.parts.head.rotation.set(-0.22, 0, 0);
            teacher.parts.leftLeg.rotation.set(-0.36, 0, 0);
            teacher.parts.rightLeg.rotation.set(0.32, 0, 0);
            teacher.parts.leftArm.rotation.set(1.58, 0, 0.24);
            teacher.parts.rightArm.rotation.set(-0.42, 0, -0.22);

            camera.position.set(
              ax + dx * (cStop * 0.65) + sideX * 2.65,
              1.62,
              az + dz * (cStop * 0.65) + sideZ * 2.65
            );
            tempCutsceneTarget.set(chubby.group.position.x, 0.72, chubby.group.position.z);
            camera.lookAt(tempCutsceneTarget);
          } else {
            const p = Math.min(1, (t - 9.8) / 2.4);
            const playerBackDist = 0.9 - p * 3.1;
            const teacherDist = cStop + 0.35 - p * 3.3;

            eng.character.group.position.set(ax + dx * playerBackDist, 0, az + dz * playerBackDist);
            resolveEntityWallCollisions(eng.character.group.position, 0.45, maze, cellSize, offset);
            eng.character.group.rotation.set(0, dirYaw, 0);
            const pSprint = -Math.sin(t * 14);
            eng.character.parts.leftHip.rotation.x = pSprint * 0.7;
            eng.character.parts.rightHip.rotation.x = -pSprint * 0.7;
            eng.character.parts.leftShoulder.rotation.x = -pSprint * 0.75;
            eng.character.parts.rightShoulder.rotation.x = pSprint * 0.75;

            teacher.group.position.set(ax + dx * teacherDist, 0, az + dz * teacherDist);
            resolveEntityWallCollisions(teacher.group.position, 0.48, maze, cellSize, offset);
            teacher.group.rotation.set(0, dirYaw + Math.PI, 0);
            teacher.parts.body.rotation.set(0, 0, 0);
            teacher.parts.head.rotation.set(0, 0, 0);
            teacher.position.set(teacher.group.position.x, 0, teacher.group.position.z);
            teacher.rotationY = dirYaw + Math.PI;
            teacher.mode = 'CHASE';
            animateEnemyLimbs(teacher, cutsceneDt, 4.9);

            camera.position.set(
              eng.character.group.position.x + sideX * 2.45 - dx * 2.0,
              1.82,
              eng.character.group.position.z + sideZ * 2.45 - dz * 2.0
            );
            tempCutsceneTarget.set(
              (eng.character.group.position.x + teacher.group.position.x) * 0.5,
              1.35,
              (eng.character.group.position.z + teacher.group.position.z) * 0.5
            );
            camera.lookAt(tempCutsceneTarget);
          }

          renderer.render(eng.world.scene, camera);
        } else if (eng.cutsceneMode === 'TEACHER_CATCH' && teacher) {
          eng.character.setManualPose(true);
          eng.character.group.visible = true;
          const ax = eng.cutsceneAnchor.x;
          const az = eng.cutsceneAnchor.z;
          const dx = eng.cutsceneDir.x;
          const dz = eng.cutsceneDir.y;
          const dirYaw = Math.atan2(-dx, -dz);
          const sideX = -dz;
          const sideZ = dx;

          // World coordinates of fallen player's STOMACH (perut) when lying telentang via YXZ!
          const stomachX = ax - dx * 1.05;
          const stomachZ = az - dz * 1.05;

          if (t < 2.2) {
            // Phase 1: Guru MTK swings wooden ruler & strikes player down fainted!
            const hitP = Math.min(1, t / 0.85);
            const fallP = Math.max(0, Math.min(1, (t - 0.65) / 1.1));

            eng.character.group.rotation.order = 'YXZ';
            eng.character.group.position.set(ax, 0.22 * fallP, az);
            eng.character.group.rotation.set((Math.PI * 0.5) * fallP, dirYaw, 0);

            teacher.group.rotation.order = 'XYZ';
            teacher.group.position.set(ax + dx * 1.02, 0, az + dz * 1.02);
            resolveEntityWallCollisions(teacher.group.position, 0.48, eng.world.maze, eng.world.cellSize, eng.world.offset);
            teacher.group.rotation.set(0, dirYaw + Math.PI, 0);
            teacher.parts.rightArm.rotation.set(
              hitP < 0.45 ? THREE.MathUtils.lerp(0.6, 2.2, hitP / 0.45) : THREE.MathUtils.lerp(2.2, 0.45, (hitP - 0.45) / 0.55),
              0,
              0
            );

            camera.position.set(ax + dx * 0.5 + sideX * 2.6, 1.48, az + dz * 0.5 + sideZ * 2.6);
            tempCutsceneTarget.set(ax + dx * 0.4, 1.05, az + dz * 0.4);
            camera.lookAt(tempCutsceneTarget);
          } else if (t < 5.0) {
            // Phase 2: Teacher stands beside fallen player's STOMACH & stomps squarely on top of (stomachX, 0.38, stomachZ)!
            const stompWave = Math.max(0, Math.sin((t - 2.2) * 5.2));
            eng.character.group.rotation.order = 'YXZ';
            eng.character.group.position.set(ax, 0.22, az);
            eng.character.group.rotation.set(Math.PI * 0.5, dirYaw, 0);

            teacher.group.rotation.order = 'XYZ';
            teacher.group.position.set(stomachX + sideX * 0.48, 0, stomachZ + sideZ * 0.48);
            resolveEntityWallCollisions(teacher.group.position, 0.48, eng.world.maze, eng.world.cellSize, eng.world.offset);
            teacher.group.rotation.set(0, Math.atan2(sideX, sideZ), 0);
            teacher.parts.rightLeg.rotation.x = 0.48 + stompWave * 0.52;
            teacher.parts.leftLeg.rotation.x = -0.12;
            teacher.parts.body.rotation.x = -0.18;
            teacher.parts.rightArm.rotation.x = 0.85 + stompWave * 0.42;

            const orbit = (t - 2.2) * 0.42 + dirYaw + 0.9;
            camera.position.set(stomachX + Math.sin(orbit) * 2.35, 1.15, stomachZ + Math.cos(orbit) * 2.35);
            tempCutsceneTarget.set(stomachX, 0.55, stomachZ);
            camera.lookAt(tempCutsceneTarget);
          } else {
            // Phase 3: Teacher runs away calmly/slowly around maze corridors toward farthest corner!
            eng.character.group.rotation.order = 'YXZ';
            eng.character.group.position.set(ax, 0.22, az);
            eng.character.group.rotation.set(Math.PI * 0.5, dirYaw, 0);

            teacher.group.rotation.order = 'XYZ';
            teacher.parts.body.rotation.x = -0.14;
            const { maze, mazeSize, cellSize, offset } = eng.world;
            const tCell = worldToGrid(teacher.position.x, teacher.position.z, mazeSize, cellSize, offset);
            if (!eng.teacherFleeTarget || (tCell.r === eng.teacherFleeTarget.r && tCell.c === eng.teacherFleeTarget.c)) {
              eng.teacherFleeTarget = pickFarthestOpenCell(maze, tCell);
            }
            const nextStep = findNextMazeStep(tCell.r, tCell.c, eng.teacherFleeTarget.r, eng.teacherFleeTarget.c, maze);
            const wp = gridToWorld(nextStep.r, nextStep.c, cellSize, offset);
            const fdx = wp.x - teacher.position.x;
            const fdz = wp.z - teacher.position.z;
            const fDist = Math.hypot(fdx, fdz);
            const fleeSpeed = 3.2;
            if (fDist > 0.05) {
              const step = Math.min(fDist, fleeSpeed * cutsceneDt);
              teacher.position.x += (fdx / fDist) * step;
              teacher.position.z += (fdz / fDist) * step;
              resolveEntityWallCollisions(teacher.position, 0.48, maze, cellSize, offset);
              teacher.rotationY = Math.atan2(-fdx, -fdz);
            }
            teacher.group.position.set(teacher.position.x, 0, teacher.position.z);
            teacher.group.rotation.y = teacher.rotationY;
            animateEnemyLimbs(teacher, cutsceneDt, fleeSpeed);

            camera.position.set(ax + sideX * 1.9, 1.55, az + sideZ * 1.9);
            tempCutsceneTarget.set(teacher.position.x, 1.3, teacher.position.z);
            camera.lookAt(tempCutsceneTarget);
          }

          renderer.render(eng.world.scene, camera);
        } else if (eng.cutsceneMode === 'SLENDER_ABDUCT' && slender) {
          // Slenderman continuously grips player's NECK & lifts player straight up all the way through teleport!
          eng.character.setManualPose(true);
          const dx = eng.cutsceneDir.x;
          const dz = eng.cutsceneDir.y;
          const dirYaw = Math.atan2(-dx, -dz);
          const liftProgress = Math.min(1, t / 2.2);
          const legKick = liftProgress > 0.2 ? Math.sin(t * 14) * 0.32 * liftProgress : 0;

          eng.character.group.rotation.order = 'XYZ';
          eng.character.group.position.set(
            eng.cutsceneAnchor.x,
            liftProgress * 2.05,
            eng.cutsceneAnchor.z
          );
          eng.character.group.rotation.set(0.08 * liftProgress, dirYaw, 0);
          eng.character.parts.leftHip.rotation.x = -0.18 * liftProgress + legKick;
          eng.character.parts.rightHip.rotation.x = 0.18 * liftProgress - legKick;
          eng.character.parts.leftShoulder.rotation.set(0.95 * liftProgress, 0, -0.2);
          eng.character.parts.rightShoulder.rotation.set(0.95 * liftProgress, 0, 0.2);

          // Position Slenderman right in front so his 1.65m arms stay locked on player's neck as player rises
          slender.group.rotation.order = 'XYZ';
          slender.group.position.set(
            eng.cutsceneAnchor.x + dx * 1.48,
            0,
            eng.cutsceneAnchor.z + dz * 1.48
          );
          slender.group.rotation.set(0, dirYaw + Math.PI, 0);
          const gripAngle = 0.85 + liftProgress * 0.93;
          slender.parts.leftArm.rotation.set(gripAngle, 0, -0.12);
          slender.parts.rightArm.rotation.set(gripAngle, 0, 0.12);
          slender.parts.body.rotation.x = 0.06 * liftProgress;

          if (t >= 3.5) {
            const flicker = Math.floor(t * 24) % 2 === 0;
            eng.character.group.visible = flicker;
            slender.group.visible = flicker;
          } else {
            eng.character.group.visible = true;
            slender.group.visible = true;
          }

          const orbit = t * 0.42 + dirYaw + 0.95;
          const camDist = 3.85 - liftProgress * 0.45;
          camera.position.set(
            eng.cutsceneAnchor.x + dx * 0.55 + Math.sin(orbit) * camDist,
            1.6 + liftProgress * 1.25,
            eng.cutsceneAnchor.z + dz * 0.55 + Math.cos(orbit) * camDist
          );
          tempCutsceneTarget.set(
            eng.cutsceneAnchor.x + dx * 0.55,
            1.65 + liftProgress * 1.2,
            eng.cutsceneAnchor.z + dz * 0.55
          );
          camera.lookAt(tempCutsceneTarget);
          renderer.render(eng.world.scene, camera);
        } else if (eng.cutsceneMode === 'SLENDER_SPACE_ARRIVE') {
          // Space Dimension Arrival:
          // Phase 1 (0..1.7s): Slenderman & Player descend from high above cosmic sky down to center (0, 0, 0)
          // Phase 2 (1.7..3.4s): Slenderman drops player briefly & SHOVES (mendorong) hard across center to cliff edge (z = 24.4)
          // Phase 3 (3.4..5.6s): Player teeters dangerously at the brink of the cliff before regaining balance
          const sw = eng.spaceWorld;
          eng.character.setManualPose(true);
          eng.character.group.visible = true;
          eng.character.group.rotation.order = 'XYZ';
          sw.updateSpace(cutsceneDt, false);

          sw.slenderGroup.visible = true;
          sw.slenderGroup.rotation.set(0, Math.PI, 0);

          if (t < 1.7) {
            const p = t / 1.7;
            const easeDesc = 1 - Math.pow(1 - p, 2.2);
            const slenderY = THREE.MathUtils.lerp(11.5, 0, easeDesc);
            const struggle = Math.sin(t * 16) * 0.25;

            sw.slenderGroup.position.set(0, slenderY, -1.48);
            sw.slenderParts.leftArm.rotation.set(1.78, 0, -0.12);
            sw.slenderParts.rightArm.rotation.set(1.78, 0, 0.12);

            eng.character.group.position.set(0, slenderY + 2.05, 0);
            eng.character.group.rotation.set(0.08, 0, 0);
            eng.character.parts.leftHip.rotation.x = struggle;
            eng.character.parts.rightHip.rotation.x = -struggle;
            eng.character.parts.leftShoulder.rotation.set(0.95, 0, -0.2);
            eng.character.parts.rightShoulder.rotation.set(0.95, 0, 0.2);

            camera.position.set(3.8, slenderY + 3.4, 3.6);
            tempCutsceneTarget.set(0, slenderY + 1.85, -0.45);
            camera.lookAt(tempCutsceneTarget);
          } else if (t < 3.4) {
            const p = (t - 1.7) / 1.7;
            const dropBlend = Math.min(1, p / 0.22);
            const shovePhase = Math.max(0, (p - 0.22) / 0.78);
            const easeShove = 1 - Math.pow(1 - shovePhase, 1.8);
            const zPush = THREE.MathUtils.lerp(0.15, 24.4, easeShove);
            const playerY = shovePhase <= 0 ? THREE.MathUtils.lerp(2.05, 0, dropBlend) : Math.sin(shovePhase * Math.PI) * 0.28;

            const lunge = shovePhase < 0.25 ? Math.sin((shovePhase / 0.25) * Math.PI) : 0;
            sw.slenderGroup.position.set(0, 0, -1.48 + lunge * 1.25);
            sw.slenderParts.leftArm.rotation.set(
              shovePhase < 0.35 ? 1.68 : THREE.MathUtils.lerp(1.68, 0.2, (shovePhase - 0.35) / 0.65),
              0,
              -0.1
            );
            sw.slenderParts.rightArm.rotation.set(
              shovePhase < 0.35 ? 1.68 : THREE.MathUtils.lerp(1.68, 0.2, (shovePhase - 0.35) / 0.65),
              0,
              0.1
            );

            eng.character.group.position.set(0, playerY, zPush);
            eng.character.group.rotation.set(-0.28 * Math.sin(shovePhase * Math.PI), 0, Math.sin(t * 20) * 0.08 * shovePhase);
            eng.character.parts.leftShoulder.rotation.set(1.25, 0, -0.65);
            eng.character.parts.rightShoulder.rotation.set(1.25, 0, 0.65);
            eng.character.parts.leftHip.rotation.x = Math.sin(t * 18) * 0.45;
            eng.character.parts.rightHip.rotation.x = -Math.sin(t * 18) * 0.45;

            camera.position.set(4.2, 2.35, zPush + 4.4);
            tempCutsceneTarget.set(0, 1.05, zPush * 0.92);
            camera.lookAt(tempCutsceneTarget);
          } else {
            const p = Math.min(1, (t - 3.4) / 2.2);
            const flail = Math.sin(t * 16) * (1 - p);
            const zSettle = THREE.MathUtils.lerp(24.4, 22.8, p * p);
            sw.slenderGroup.position.set(0, 0, -1.48);
            sw.slenderParts.leftArm.rotation.set(0, 0, 0);
            sw.slenderParts.rightArm.rotation.set(0, 0, 0);

            eng.character.group.position.set(0, 0, zSettle);
            eng.character.group.rotation.set(-0.42 * (1 - p), 0, flail * 0.2);
            eng.character.parts.leftShoulder.rotation.set(1.25 * (1 - p), 0, -0.78 * (1 - p));
            eng.character.parts.rightShoulder.rotation.set(1.25 * (1 - p), 0, 0.78 * (1 - p));
            eng.character.parts.leftHip.rotation.x = 0.28 * (1 - p);
            eng.character.parts.rightHip.rotation.x = -0.28 * (1 - p);

            camera.position.set(3.4 - p * 1.1, 2.15, zSettle + 5.2);
            tempCutsceneTarget.set(0, 1.1, zSettle);
            camera.lookAt(tempCutsceneTarget);
          }

          renderer.render(sw.scene, camera);
        } else if (eng.cutsceneMode === 'TEACHER_ZAP' && teacher) {
          // Mystic Staff Lightning Cutscene:
          // Phase 1 (0..1.5s): Electric sparks shock Teacher, blasting him backward (slamming wall if near!) & dropping him tengkurap
          // Phase 2 (1.5..3.0s): Lies tengkurap pingsan
          // Phase 3 (3.0..5.5s): Trembles & forces himself to rise / stand up
          // Phase 4 (5.5..7.8s): Gives out & collapses helplessly back down tengkurap pingsan!
          eng.character.setManualPose(true);
          eng.character.group.visible = true;
          eng.character.group.rotation.order = 'XYZ';
          eng.character.group.rotation.set(0, eng.physics.rotationY, 0);
          eng.character.parts.rightShoulder.rotation.set(1.38, 0, 0);
          eng.character.parts.rightElbow.rotation.set(-0.15, 0, 0);

          const midX = (eng.zapStartPos.x + eng.zapEndPos.x) * 0.5;
          const midZ = (eng.zapStartPos.z + eng.zapEndPos.z) * 0.5;

          if (t < 1.5) {
            const p = t / 1.5;
            const easeOut = 1 - Math.pow(1 - p, 2);
            const curX = THREE.MathUtils.lerp(eng.zapStartPos.x, eng.zapEndPos.x, easeOut);
            const curZ = THREE.MathUtils.lerp(eng.zapStartPos.z, eng.zapEndPos.z, easeOut);
            const arcY = Math.sin(p * Math.PI) * (eng.zapHitWall ? 0.52 : 0.85);
            const pitch = -Math.PI * 0.5 * Math.min(1, p * 1.15);

            teacher.group.visible = true;
            teacher.group.rotation.order = 'YXZ';
            teacher.group.position.set(curX, arcY + 0.22 * p, curZ);
            teacher.group.rotation.set(pitch, eng.zapYaw, Math.sin(t * 42) * 0.14);
            teacher.parts.leftArm.rotation.set(0.95, 0, -0.45);
            teacher.parts.rightArm.rotation.set(0.95, 0, 0.45);

            // Crackling electric sparks dancing around Teacher
            for (let s = 0; s < eng.zapSparks.length; s++) {
              const sp = eng.zapSparks[s];
              sp.visible = true;
              const ang = t * 18 + (s / eng.zapSparks.length) * Math.PI * 2;
              sp.position.set(
                curX + Math.cos(ang) * 0.65,
                Math.max(0.25, arcY + 0.85 + Math.sin(t * 25 + s) * 0.48),
                curZ + Math.sin(ang) * 0.65
              );
              sp.rotation.set(ang, ang * 1.4, 0);
              sp.scale.setScalar(0.85 + Math.sin(t * 36 + s) * 0.4);
            }

            camera.position.set(
              midX + 2.85,
              2.05,
              midZ + 2.85
            );
            tempCutsceneTarget.set(curX, 0.85, curZ);
            camera.lookAt(tempCutsceneTarget);
          } else if (t < 3.0) {
            // Phase 2: Knocked out flat tengkurap (face down!)
            for (let s = 0; s < eng.zapSparks.length; s++) {
              eng.zapSparks[s].visible = t < 1.9 && s % 2 === 0;
              eng.zapSparks[s].position.set(
                eng.zapEndPos.x + Math.sin(t * 20 + s) * 0.45,
                0.35 + (s % 2) * 0.2,
                eng.zapEndPos.z + Math.cos(t * 20 + s) * 0.45
              );
            }
            teacher.group.rotation.order = 'YXZ';
            teacher.group.position.set(eng.zapEndPos.x, 0.24, eng.zapEndPos.z);
            teacher.group.rotation.set(-Math.PI * 0.5, eng.zapYaw, 0);
            teacher.parts.leftArm.rotation.set(0.45, 0, -0.25);
            teacher.parts.rightArm.rotation.set(0.45, 0, 0.25);

            camera.position.set(eng.zapEndPos.x + 2.45, 1.55, eng.zapEndPos.z + 2.45);
            tempCutsceneTarget.set(eng.zapEndPos.x, 0.35, eng.zapEndPos.z);
            camera.lookAt(tempCutsceneTarget);
          } else if (t < 5.5) {
            // Phase 3: Guru MTK trembles & forces himself to push up off the floor!
            for (let s = 0; s < eng.zapSparks.length; s++) eng.zapSparks[s].visible = false;
            const p = (t - 3.0) / 2.5;
            const push = Math.sin(p * Math.PI * 0.5);
            const tremble = Math.sin(t * 24) * 0.055;
            teacher.group.rotation.order = 'YXZ';
            teacher.group.position.set(
              eng.zapEndPos.x,
              THREE.MathUtils.lerp(0.24, 0.05, push),
              eng.zapEndPos.z
            );
            teacher.group.rotation.set(THREE.MathUtils.lerp(-Math.PI * 0.5, -0.35, push), eng.zapYaw + tremble, tremble);
            teacher.parts.leftArm.rotation.set(1.25 - push * 0.4, 0, -0.35);
            teacher.parts.rightArm.rotation.set(1.25 - push * 0.4, 0, 0.35);
            teacher.parts.leftLeg.rotation.set(0.35 * push, 0, 0);

            camera.position.set(eng.zapEndPos.x + 2.3, 1.35, eng.zapEndPos.z + 2.3);
            tempCutsceneTarget.set(eng.zapEndPos.x, 0.55 + push * 0.35, eng.zapEndPos.z);
            camera.lookAt(tempCutsceneTarget);
          } else {
            // Phase 4: Strength fails — crashes back down tengkurap pingsan tak berdaya!
            for (let s = 0; s < eng.zapSparks.length; s++) eng.zapSparks[s].visible = false;
            const p = Math.min(1, (t - 5.5) / 0.85);
            const easeCollapse = p * p;
            teacher.group.rotation.order = 'YXZ';
            teacher.group.position.set(
              eng.zapEndPos.x,
              THREE.MathUtils.lerp(0.05, 0.24, easeCollapse),
              eng.zapEndPos.z
            );
            teacher.group.rotation.set(THREE.MathUtils.lerp(-0.35, -Math.PI * 0.5, easeCollapse), eng.zapYaw, 0);
            teacher.parts.leftArm.rotation.set(0.35, 0, -0.2);
            teacher.parts.rightArm.rotation.set(0.35, 0, 0.2);
            teacher.parts.leftLeg.rotation.set(0, 0, 0);

            camera.position.set(eng.zapEndPos.x + 2.55, 1.65, eng.zapEndPos.z + 2.55);
            tempCutsceneTarget.set(eng.zapEndPos.x, 0.3, eng.zapEndPos.z);
            camera.lookAt(tempCutsceneTarget);
          }

          renderer.render(eng.world.scene, camera);
        } else if (eng.cutsceneMode === 'SLENDER_BLACKHOLE') {
          // 10th Lightning Hit -> Black Hole opens behind Slenderman & sucks him completely into the void!
          const sw = eng.spaceWorld;
          eng.character.setManualPose(true);
          eng.character.group.visible = true;
          eng.character.group.rotation.order = 'XYZ';
          eng.character.group.position.set(eng.physics.position.x, 0, eng.physics.position.z);
          eng.character.group.rotation.set(0, eng.physics.rotationY, 0);
          eng.character.parts.rightShoulder.rotation.set(1.38, 0, 0);
          eng.character.parts.rightElbow.rotation.set(-0.12, 0, 0);

          sw.updateSpace(cutsceneDt, true);

          const sPos = eng.blackHoleAnchor;
          let awayX = sPos.x - eng.physics.position.x;
          let awayZ = sPos.z - eng.physics.position.z;
          const awayLen = Math.hypot(awayX, awayZ) || 1;
          awayX /= awayLen;
          awayZ /= awayLen;
          const bhX = sPos.x + awayX * 2.5;
          const bhY = 2.25;
          const bhZ = sPos.z + awayZ * 2.5;

          sw.blackHoleGroup.visible = true;
          sw.blackHoleGroup.position.set(bhX, bhY, bhZ);
          sw.blackHoleGroup.lookAt(eng.physics.position.x, 1.4, eng.physics.position.z);

          if (t < 1.35) {
            const p = t / 1.35;
            const ease = 1 - Math.pow(1 - p, 2);
            sw.updateBlackHole(cutsceneDt, ease * 1.4);
            sw.slenderGroup.visible = true;
            sw.slenderGroup.scale.set(1, 1, 1);
            sw.slenderGroup.position.set(
              sPos.x + Math.sin(t * 34) * 0.08,
              0,
              sPos.z + Math.cos(t * 34) * 0.08
            );
            sw.slenderGroup.rotation.set(0, Math.atan2(-awayX, -awayZ) + Math.sin(t * 16) * 0.22, 0);
            sw.slenderParts.leftArm.rotation.set(1.9, 0, -0.45);
            sw.slenderParts.rightArm.rotation.set(1.9, 0, 0.45);
          } else if (t < 3.7) {
            const p = (t - 1.35) / 2.35;
            const pull = p * p;
            sw.updateBlackHole(cutsceneDt, 1.4 + Math.sin(t * 10) * 0.08);
            const curX = THREE.MathUtils.lerp(sPos.x, bhX, pull);
            const curY = THREE.MathUtils.lerp(0, bhY - 0.3, pull);
            const curZ = THREE.MathUtils.lerp(sPos.z, bhZ, pull);
            const shrink = Math.max(0.02, 1 - pull * 0.98);
            sw.slenderGroup.visible = p < 0.96;
            sw.slenderGroup.position.set(curX, curY, curZ);
            sw.slenderGroup.rotation.set(pull * 1.2, eng.spaceSlenderYaw + t * 10.5, pull * 0.85);
            sw.slenderGroup.scale.set(shrink, shrink * (1 + pull * 0.35), shrink);
            sw.slenderParts.leftArm.rotation.set(2.3, 0, -0.75);
            sw.slenderParts.rightArm.rotation.set(2.3, 0, 0.75);
          } else {
            const p = Math.min(1, (t - 3.7) / 1.1);
            sw.updateBlackHole(cutsceneDt, Math.max(0.01, 1.4 * (1 - p)));
            sw.slenderGroup.visible = false;
            eng.character.parts.rightShoulder.rotation.set(THREE.MathUtils.lerp(1.38, 0.2, p), 0, 0);
          }

          const sideVecX = -awayZ;
          const sideVecZ = awayX;
          camera.position.set(
            sPos.x - awayX * 5.2 + sideVecX * 3.1,
            2.65,
            sPos.z - awayZ * 5.2 + sideVecZ * 3.1
          );
          tempCutsceneTarget.set(
            THREE.MathUtils.lerp(sPos.x, bhX, 0.55),
            1.6,
            THREE.MathUtils.lerp(sPos.z, bhZ, 0.55)
          );
          camera.lookAt(tempCutsceneTarget);
          renderer.render(sw.scene, camera);
        }

        if (isSoftwareGl) {
          afterDraw(() => tick(performance.now()));
        } else {
          frameId = requestAnimationFrame(tick);
        }
        return;
      }

      let currentChaser: ChaserType = 'NONE';

      // 2. SLENDERMAN'S ENLARGED SPACE DIMENSION MODE (Dunia Angkasa + Boss Battle 10x Petir)
      if (eng.isGameActive && eng.inSpaceWorld) {
        eng.isSprintLocked = false; // Player CAN sprint freely in Space Dimension!

        if (eng.lightningCooldown > 0) {
          eng.lightningCooldown = Math.max(0, eng.lightningCooldown - dt);
        }
        if (eng.staffMuzzleTimer > 0) {
          eng.staffMuzzleTimer = Math.max(0, eng.staffMuzzleTimer - dt);
          if (eng.staffMuzzleTimer <= 0 || !eng.isStaffEquipped) {
            eng.staffMuzzleArc.visible = false;
          } else {
            eng.character.group.updateMatrixWorld(true);
            eng.playerStaffTip.getWorldPosition(tempCutsceneTarget);
            eng.staffMuzzleArc.position.copy(tempCutsceneTarget);
            tempMuzzleLook.copy(tempCutsceneTarget).add(eng.staffMuzzleDir);
            eng.staffMuzzleArc.lookAt(tempMuzzleLook);
            eng.staffMuzzleArc.rotation.z += 36 * dt;
            eng.staffMuzzleArc.scale.setScalar(0.88 + Math.sin(now * 0.06) * 0.24);
            eng.staffMuzzleArc.visible = true;
          }
        }
        if (eng.staffUseJustPressed) {
          eng.staffUseJustPressed = false;
          handlersRef.current.onUseMysticStaff();
        }
        if (eng.castJustPressed) {
          eng.castJustPressed = false;
          handlersRef.current.onCastLightning();
        }

        eng.physics.update(dt, eng.input, eng.followCamera.yaw, [], false, null);

        // Clamp within circular cosmic platform boundary
        const maxR = eng.spaceWorld.arenaRadius - 0.65;
        const radial = Math.hypot(eng.physics.position.x, eng.physics.position.z);
        if (radial > maxR) {
          const ratio = maxR / radial;
          eng.physics.position.x *= ratio;
          eng.physics.position.z *= ratio;
        }

        eng.character.group.position.x = eng.physics.position.x;
        eng.character.group.position.z = eng.physics.position.z;
        eng.character.group.rotation.y = eng.physics.rotationY;
        eng.character.update(
          dt,
          eng.physics.velocity,
          eng.physics.isSprinting,
          eng.physics.angularVelocity
        );
        sound.setSprinting(eng.physics.isSprinting && eng.physics.velocity.length() > 1.2);

        eng.spaceWorld.updateSpace(dt, eng.hasMysticStaff, eng.spaceHasPortalOpen);

        if (!eng.spaceHasPortalOpen) {
          // Space Slenderman pursuit (+10% creep speed) & Blink every 2.0 seconds (invulnerable while blinking!)
          const sdx = eng.physics.position.x - eng.spaceSlenderPos.x;
          const sdz = eng.physics.position.z - eng.spaceSlenderPos.z;
          const sDist = Math.hypot(sdx, sdz);
          if (sDist > 0.1) {
            eng.spaceSlenderPos.x += (sdx / sDist) * SLENDER_SPACE_CREEP_SPEED * dt;
            eng.spaceSlenderPos.z += (sdz / sDist) * SLENDER_SPACE_CREEP_SPEED * dt;
            eng.spaceSlenderBlinkTimer += dt;
            if (eng.spaceSlenderBlinkTimer >= SLENDER_SPACE_BLINK_INTERVAL) {
              eng.spaceSlenderBlinkTimer = 0;
              eng.spaceSlenderHideTimer = 0.65;
              const hop = Math.min(Math.max(0, sDist - 1.6), SLENDER_SPACE_BLINK_HOP);
              if (hop > 0) {
                eng.spaceSlenderPos.x += (sdx / sDist) * hop;
                eng.spaceSlenderPos.z += (sdz / sDist) * hop;
              }
            }
            if (eng.spaceSlenderHideTimer > 0) {
              eng.spaceSlenderHideTimer = Math.max(0, eng.spaceSlenderHideTimer - dt);
              eng.spaceSlenderBlinking = true;
              eng.spaceWorld.slenderGroup.visible = Math.floor(eng.spaceSlenderHideTimer * 24) % 3 === 0;
            } else {
              eng.spaceSlenderBlinking = false;
              eng.spaceWorld.slenderGroup.visible = true;
            }
            eng.spaceSlenderYaw = Math.atan2(-sdx, -sdz);
            eng.spaceWorld.slenderGroup.position.copy(eng.spaceSlenderPos);
            eng.spaceWorld.slenderGroup.rotation.y = eng.spaceSlenderYaw;
          }

          // Update mini lightning bolts in Space Dimension against Slenderman!
          for (let b = 0; b < eng.lightningBolts.length; b++) {
            const bolt = eng.lightningBolts[b];
            if (!bolt.active) continue;
            bolt.life -= dt;
            if (bolt.life <= 0) {
              bolt.active = false;
              bolt.group.visible = false;
              continue;
            }
            bolt.pos.addScaledVector(bolt.dir, 26.0 * dt);
            bolt.group.position.copy(bolt.pos);
            bolt.group.rotation.z += 28 * dt;

            const hitDist = Math.hypot(
              bolt.pos.x - eng.spaceSlenderPos.x,
              bolt.pos.z - eng.spaceSlenderPos.z
            );
            if (hitDist < 1.85 && eng.hasMysticStaff) {
              bolt.active = false;
              bolt.group.visible = false;
              if (eng.spaceSlenderBlinking) {
                triggerAlertBanner('⚡ Slenderman sedang BLINK — kebal serangan petir!', 1.5);
              } else {
                eng.spaceSlenderHp = Math.max(0, eng.spaceSlenderHp - 1);
                sound.playElectricShock();
                const awayX = eng.spaceSlenderPos.x - eng.physics.position.x;
                const awayZ = eng.spaceSlenderPos.z - eng.physics.position.z;
                const awayLen = Math.hypot(awayX, awayZ) || 1;
                eng.spaceSlenderPos.x += (awayX / awayLen) * 1.45;
                eng.spaceSlenderPos.z += (awayZ / awayLen) * 1.45;
                const sr = Math.hypot(eng.spaceSlenderPos.x, eng.spaceSlenderPos.z);
                if (sr > maxR) {
                  eng.spaceSlenderPos.x *= maxR / sr;
                  eng.spaceSlenderPos.z *= maxR / sr;
                }
                eng.spaceWorld.slenderGroup.position.copy(eng.spaceSlenderPos);
                setStats((prev) => ({
                  ...prev,
                  spaceSlenderHp: eng.spaceSlenderHp,
                  spaceSlenderBlinking: eng.spaceSlenderBlinking,
                }));
                if (eng.spaceSlenderHp <= 0) {
                  handlersRef.current.onSlenderBlackhole();
                  break;
                }
              }
            }
          }

          eng.spaceTimeLeft = Math.max(0, eng.spaceTimeLeft - dt);

          // Check Mystic Staff pickup -> Auto-equip & start 10-hit boss duel (portal opens after Black Hole!)
          if (!eng.hasMysticStaff) {
            const dStaff = Math.hypot(
              eng.physics.position.x - eng.spaceWorld.staffPosition.x,
              eng.physics.position.z - eng.spaceWorld.staffPosition.z
            );
            if (dStaff < 1.85) {
              eng.hasMysticStaff = true;
              eng.isStaffEquipped = true;
              eng.spaceSlenderHp = SLENDER_SPACE_MAX_HP;
              eng.spaceWorld.staffMesh.visible = false;
              eng.playerStaffMesh.visible = true;
              eng.character.setStaffHeld(true);
              sound.playStaffPickup();
              setStats((prev) => ({
                ...prev,
                hasMysticStaff: true,
                isStaffEquipped: true,
                spaceSlenderHp: SLENDER_SPACE_MAX_HP,
              }));
              triggerAlertBanner(
                'TONGKAT DIDAPAT! Serang Slenderman 10x dengan [KLIK KIRI / ENTER]! (Kebal saat BLINK!)',
                4.2
              );
            }
          }

          // Check Space Failure (Time up or Slenderman caught player inside space)
          if (eng.inSpaceWorld && (eng.spaceTimeLeft <= 0 || sDist < 1.15)) {
            handlersRef.current.onSpaceOutcome(false);
          }
        } else {
          // Portal Backrooms terbuka setelah Slenderman tersedot Black Hole
          eng.spaceWorld.slenderGroup.visible = false;
          eng.spaceSlenderBlinking = false;
          for (let b = 0; b < eng.lightningBolts.length; b++) {
            const bolt = eng.lightningBolts[b];
            if (!bolt.active) continue;
            bolt.life -= dt;
            if (bolt.life <= 0) {
              bolt.active = false;
              bolt.group.visible = false;
              continue;
            }
            bolt.pos.addScaledVector(bolt.dir, 26.0 * dt);
            bolt.group.position.copy(bolt.pos);
            bolt.group.rotation.z += 28 * dt;
          }

          const dPortal = Math.hypot(
            eng.physics.position.x - eng.spaceWorld.portalPosition.x,
            eng.physics.position.z - eng.spaceWorld.portalPosition.z
          );
          if (dPortal < 2.2 || (dPortal < 3.6 && eng.input.interactJustPressed)) {
            handlersRef.current.onSpaceOutcome(true);
          }
        }

        statsTimerAcc += dt;
        if (statsTimerAcc > 0.16) {
          statsTimerAcc = 0;
          setStats((prev) => ({
            ...prev,
            inSpaceWorld: eng.inSpaceWorld,
            spaceTimeLeft: eng.spaceTimeLeft,
            hasMysticStaff: eng.hasMysticStaff,
            isStaffEquipped: eng.isStaffEquipped,
            spaceHasPortalOpen: eng.spaceHasPortalOpen,
            spaceSlenderHp: eng.spaceSlenderHp,
            spaceSlenderMaxHp: SLENDER_SPACE_MAX_HP,
            spaceSlenderBlinking: eng.spaceSlenderBlinking,
            isSprintLocked: false,
            isShiftLocked: eng.isShiftLocked,
            isSprinting: eng.physics.isSprinting,
            speed: eng.physics.velocity.length(),
          }));
        }

        eng.followCamera.update(dt, eng.physics.position, []);
        renderer.render(eng.inSpaceWorld ? eng.spaceWorld.scene : eng.world.scene, camera);

        eng.input.interactJustPressed = false;
        eng.input.escapeJustPressed = false;
        eng.staffUseJustPressed = false;
        eng.castJustPressed = false;

        if (isSoftwareGl) {
          afterDraw(() => tick(performance.now()));
        } else {
          frameId = requestAnimationFrame(tick);
        }
        return;
      }

      // 3. NORMAL BACKROOMS GAMEPLAY
      eng.world.update(dt);

      if (eng.isGameActive) {
        if (eng.lightningCooldown > 0) {
          eng.lightningCooldown = Math.max(0, eng.lightningCooldown - dt);
        }
        if (eng.staffMuzzleTimer > 0) {
          eng.staffMuzzleTimer = Math.max(0, eng.staffMuzzleTimer - dt);
          if (eng.staffMuzzleTimer <= 0 || !eng.isStaffEquipped) {
            eng.staffMuzzleArc.visible = false;
          } else {
            eng.character.group.updateMatrixWorld(true);
            eng.playerStaffTip.getWorldPosition(tempCutsceneTarget);
            eng.staffMuzzleArc.position.copy(tempCutsceneTarget);
            tempMuzzleLook.copy(tempCutsceneTarget).add(eng.staffMuzzleDir);
            eng.staffMuzzleArc.lookAt(tempMuzzleLook);
            eng.staffMuzzleArc.rotation.z += 36 * dt;
            eng.staffMuzzleArc.scale.setScalar(0.88 + Math.sin(now * 0.06) * 0.24);
            eng.staffMuzzleArc.visible = true;
          }
        }

        if (eng.staffUseJustPressed) {
          eng.staffUseJustPressed = false;
          handlersRef.current.onUseMysticStaff();
        }
        if (eng.castJustPressed) {
          eng.castJustPressed = false;
          handlersRef.current.onCastLightning();
        }

        // Update active Mini Lightning Bolts ([ENTER] from Mystic Staff!)
        const teacherEntity = eng.enemies.find((e) => e.kind === 'TEACHER');
        for (let b = 0; b < eng.lightningBolts.length; b++) {
          const bolt = eng.lightningBolts[b];
          if (!bolt.active) continue;
          bolt.life -= dt;
          if (bolt.life <= 0) {
            bolt.active = false;
            bolt.group.visible = false;
            continue;
          }
          bolt.pos.addScaledVector(bolt.dir, 24.0 * dt);
          bolt.group.position.copy(bolt.pos);
          bolt.group.rotation.z += 28 * dt;

          const bCell = worldToGrid(
            bolt.pos.x,
            bolt.pos.z,
            eng.world.mazeSize,
            eng.world.cellSize,
            eng.world.offset
          );
          if (eng.world.maze[bCell.r]?.[bCell.c] === 1) {
            bolt.active = false;
            bolt.group.visible = false;
            continue;
          }

          if (
            teacherEntity &&
            eng.teacherStunTimer <= 0 &&
            Math.hypot(bolt.pos.x - teacherEntity.position.x, bolt.pos.z - teacherEntity.position.z) < 1.65
          ) {
            bolt.active = false;
            bolt.group.visible = false;
            handlersRef.current.onTeacherZap();
            break;
          }
        }

        if (!eng.isHidingInLocker) {
          // If coming right out of Chubby Sacrifice chase, maintain brief backward-escape run!
          if (eng.backwardEscapeTimer > 0) {
            eng.backwardEscapeTimer = Math.max(0, eng.backwardEscapeTimer - dt);
            if (Math.abs(eng.input.forward) < 0.01 && Math.abs(eng.input.strafe) < 0.01) {
              eng.input.forward = -1;
              eng.input.sprint = true;
            } else {
              eng.backwardEscapeTimer = 0;
            }
          }

          eng.physics.update(
            dt,
            eng.input,
            eng.followCamera.yaw,
            eng.world.walls,
            eng.isSprintLocked,
            null
          );
          eng.character.group.position.x = eng.physics.position.x;
          eng.character.group.position.z = eng.physics.position.z;
          eng.character.group.rotation.y = eng.physics.rotationY;
          eng.character.update(
            dt,
            eng.physics.velocity,
            eng.physics.isSprinting,
            eng.physics.angularVelocity
          );

          const isRunning = eng.physics.isSprinting && eng.physics.velocity.length() > 1.2;
          sound.setSprinting(isRunning);
        } else {
          eng.physics.velocity.set(0, 0);
          sound.setSprinting(false);
        }

        // Update 3 Enemy AI Entities
        currentChaser = updateEnemies(dt, eng);

        // Proximity checks: Terminal, Exit Door, and Lockers
        const distTerminal = eng.physics.position.distanceTo(eng.world.terminalPosition);
        const distExit = eng.physics.position.distanceTo(eng.world.exitPosition);
        const nearTerminal = distTerminal < 3.8;
        const nearExit = distExit < 3.2;

        let nearLocker = false;
        for (let i = 0; i < eng.world.lockers.length; i++) {
          if (eng.physics.position.distanceTo(eng.world.lockers[i].position) < 2.5) {
            nearLocker = true;
            break;
          }
        }

        if (eng.input.interactJustPressed) {
          if (eng.isHidingInLocker) {
            handlersRef.current.onToggleLocker();
          } else if (nearTerminal && !eng.isExitUnlocked) {
            handlersRef.current.onOpenTerminal();
          } else if (nearExit && eng.isExitUnlocked) {
            handlersRef.current.onVictory();
          } else if (nearLocker) {
            handlersRef.current.onToggleLocker();
          }
        }

        if (eng.isExitUnlocked && nearExit && distExit < 2.2) {
          handlersRef.current.onVictory();
        }

        statsTimerAcc += dt;
        if (statsTimerAcc > 0.18) {
          statsTimerAcc = 0;
          setPlayerCoordinates({
            x: eng.physics.position.x,
            z: eng.physics.position.z,
          });
          setPlayerYaw(eng.physics.rotationY);
          setEnemyMarkers(
            eng.enemies.map((e) => ({
              id: e.kind,
              x: e.position.x,
              z: e.position.z,
              color:
                e.kind === 'TEACHER'
                  ? '#ef4444'
                  : e.kind === 'CHUBBY'
                  ? e.mode === 'PACIFIED'
                    ? '#4ade80'
                    : '#3b82f6'
                  : '#ffffff',
              radius: e.kind === 'SLENDER' ? 0.85 : 0.72,
            }))
          );

          setStats((prev) => ({
            ...prev,
            distanceToTerminal: distTerminal,
            distanceToExit: distExit,
            isNearTerminal: nearTerminal,
            isNearExit: nearExit,
            isNearLocker: nearLocker,
            isHidingInLocker: eng.isHidingInLocker,
            lockerUsesLeft: eng.lockerUsesLeft,
            isExitUnlocked: eng.isExitUnlocked,
            isSprinting: eng.physics.isSprinting && !eng.isHidingInLocker,
            isSprintLocked: eng.isSprintLocked,
            isShiftLocked: eng.isShiftLocked,
            inSpaceWorld: false,
            hasMysticStaff: eng.hasMysticStaff,
            isStaffEquipped: eng.isStaffEquipped,
            teacherStunTimer: eng.teacherStunTimer,
            canReviveChubby: eng.canReviveChubby,
            chubbyReviveBlockedReason: eng.chubbyReviveBlockedReason,
            speed: eng.physics.velocity.length(),
            activeChaser: currentChaser,
          }));
        }
      } else {
        sound.setSprinting(false);
        if (lastAudioChaser !== 'NONE') {
          lastAudioChaser = 'NONE';
          sound.setChaserAudio('NONE');
        }
      }

      if (eng.isHidingInLocker && eng.activeLocker) {
        const rotY = eng.activeLocker.mesh.rotation.y;
        const outX = Math.sin(rotY);
        const outZ = Math.cos(rotY);
        const eyeX = eng.activeLocker.position.x - outX * 0.14;
        const eyeY = 1.62;
        const eyeZ = eng.activeLocker.position.z - outZ * 0.14;
        camera.position.set(eyeX, eyeY, eyeZ);

        const lookYaw = rotY + eng.lockerPeekYaw;
        tempLockerLook.set(
          eyeX + Math.sin(lookYaw) * 6.0,
          eyeY + eng.lockerPeekPitch * 4.5 - 0.12,
          eyeZ + Math.cos(lookYaw) * 6.0
        );
        camera.lookAt(tempLockerLook);
      } else {
        eng.followCamera.update(dt, eng.physics.position, eng.world.walls);
      }
      renderer.render(eng.world.scene, camera);

      eng.input.interactJustPressed = false;
      eng.input.escapeJustPressed = false;
      eng.staffUseJustPressed = false;
      eng.castJustPressed = false;

      if (isSoftwareGl) {
        afterDraw(() => tick(performance.now()));
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(timeoutId);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      domEl.removeEventListener('contextmenu', handleContextMenu);
      domEl.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);

      character.dispose();
      world.dispose();
      spaceWorld.dispose();
      openingWorld.dispose();
      renderer.dispose();
      sound.stopAmbientHum();
      sound.stopSpaceAudio();
      sound.stopSadCutsceneMusic();
      sound.setChaserAudio('NONE');
    };
  }, [spawnAllEnemies, triggerAlertBanner]);

  // Countdown Timer (10 minutes = 600s during PLAYING)
  useEffect(() => {
    if (gameStatus !== 'PLAYING') return;

    const timer = setInterval(() => {
      setStats((prev) => {
        if (prev.timeLeft <= 1) {
          clearInterval(timer);
          if (engineRef.current) engineRef.current.isGameActive = false;
          setGameStatus('DEFEAT');
          return { ...prev, timeLeft: 0 };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameStatus]);

  // Start / Restart Game (always generates new maze + new puzzle + resets entities & lockers)
  const startGame = useCallback(
    (diff: Difficulty = difficulty) => {
      const lvl = LEVELS[diff];
      const newPuzzle = generatePuzzle(diff);
      setPuzzle(newPuzzle);
      setDifficulty(diff);
      setActiveQuiz(null);
      askedQuizIdsRef.current.clear();

      sound.stopSpaceAudio();
      sound.stopSadCutsceneMusic();
      sound.setChaserAudio('NONE');

      const eng = engineRef.current;
      if (eng) {
        const newMaze = eng.world.rebuildMaze();
        setMazeGrid(newMaze.map((r) => [...r]));
        setLockerMarkers(eng.world.lockers.map((l) => ({ x: l.position.x, z: l.position.z })));

        eng.world.scene.add(eng.character.group);
        eng.world.scene.add(eng.staffMuzzleArc);
        eng.lightningBolts.forEach((b) => {
          eng.world.scene.add(b.group);
          b.active = false;
          b.group.visible = false;
        });
        eng.spaceWorld.blackHoleGroup.visible = false;
        eng.spaceWorld.slenderGroup.scale.set(1, 1, 1);
        eng.character.resetPose();
        eng.character.setStaffHeld(false);
        eng.character.group.rotation.order = 'XYZ';
        eng.sackMesh.visible = false;
        if (eng.activeLocker) {
          eng.activeLocker.mesh.visible = true;
          eng.activeLocker = null;
        }
        eng.lockerInteriorGroup.visible = false;
        eng.lockerPeekYaw = 0;
        eng.lockerPeekPitch = 0;
        eng.inSpaceWorld = false;
        eng.spaceHasPortalOpen = false;
        eng.spaceWorld.portalMesh.visible = false;
        eng.hasMysticStaff = false;
        eng.isStaffEquipped = false;
        eng.playerStaffMesh.visible = false;
        eng.teacherStunTimer = 0;
        eng.lightningCooldown = 0;
        eng.staffMuzzleTimer = 0;
        eng.staffMuzzleArc.visible = false;
        eng.chubbyCompanionActive = false;
        eng.chubbySacrificeDone = false;
        eng.chubbyNeedsRevive = false;
        eng.chubbySacrificeCooldown = 0;
        eng.canReviveChubby = false;
        eng.chubbyReviveBlockedReason = null;
        eng.spaceSlenderHp = SLENDER_SPACE_MAX_HP;
        eng.spaceSlenderBlinking = false;
        eng.zapSparks.forEach((sp) => {
          sp.visible = false;
        });
        eng.isSprintLocked = false;
        eng.cutsceneMode = 'NONE';
        eng.cutsceneTimer = 0;
        eng.cutsceneStartMs = 0;
        eng.backwardEscapeTimer = 0;
        eng.spaceTimeLeft = SPACE_TRIAL_SECONDS;

        const startX = (2 - eng.world.offset) * eng.world.cellSize;
        const startZ = (2 - eng.world.offset) * eng.world.cellSize;
        eng.preAbductPos.set(startX, 0, startZ);
        eng.preAbductYaw = -Math.PI * 0.5;
        eng.physics.position.set(startX, 0, startZ);
        eng.physics.velocity.set(0, 0);
        eng.physics.rotationY = -Math.PI * 0.5;
        eng.character.group.position.set(startX, 0, startZ);
        eng.character.group.rotation.set(0, -Math.PI * 0.5, 0);
        eng.character.group.visible = true;
        eng.followCamera.yaw = -Math.PI * 0.5;
        eng.followCamera.snap(eng.physics.position, eng.world.walls);

        eng.isExitUnlocked = false;
        eng.lives = lvl.initialLives;
        eng.timeLeft = lvl.timeSeconds;
        eng.lockerUsesLeft = MAX_LOCKER_USES;
        eng.isHidingInLocker = false;
        eng.alertText = null;
        eng.alertTimer = 0;
        eng.isGameActive = true;

        spawnAllEnemies(eng);
      }

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }

      setStats((prev) => ({
        lives: lvl.initialLives,
        maxLives: lvl.initialLives,
        timeLeft: lvl.timeSeconds,
        maxTime: lvl.timeSeconds,
        status: 'PLAYING',
        difficulty: diff,
        distanceToTerminal: 99,
        distanceToExit: 99,
        isNearTerminal: false,
        isNearExit: false,
        isExitUnlocked: false,
        isSprinting: false,
        isSprintLocked: false,
        isShiftLocked: prev.isShiftLocked,
        speed: 0,
        lockerUsesLeft: MAX_LOCKER_USES,
        maxLockerUses: MAX_LOCKER_USES,
        isNearLocker: false,
        isHidingInLocker: false,
        activeChaser: 'NONE',
        alertMessage: null,
        inSpaceWorld: false,
        spaceTimeLeft: SPACE_TRIAL_SECONDS,
        hasMysticStaff: false,
        isStaffEquipped: false,
        teacherStunTimer: 0,
        spaceHasPortalOpen: false,
        spaceSlenderHp: SLENDER_SPACE_MAX_HP,
        spaceSlenderMaxHp: SLENDER_SPACE_MAX_HP,
        spaceSlenderBlinking: false,
        canReviveChubby: false,
        chubbyReviveBlockedReason: null,
      }));

      setGameStatus('PLAYING');
      sound.startAmbientHum();
    },
    [difficulty, spawnAllEnemies]
  );

  // Start Opening Real-World -> Backrooms Cutscene when clicking "Masuk ke Backrooms (Mulai)"
  const beginOpeningSequence = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) {
      startGame(difficulty);
      return;
    }
    sound.setChaserAudio('NONE');
    sound.stopSpaceAudio();
    sound.stopSadCutsceneMusic();
    eng.isGameActive = false;
    eng.openingWorld.scene.add(eng.character.group);
    eng.character.resetPose();
    eng.character.setManualPose(true);
    eng.character.group.visible = true;
    eng.cutsceneMode = 'OPENING';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('OPENING_CUTSCENE');
  }, [difficulty, startGame]);

  // Support ?autostart=1 URL param for automated verification (skips opening into playing directly)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      const t = setTimeout(() => startGame('EASY'), 80);
      return () => clearTimeout(t);
    }
  }, [startGame]);

  // Toggle Shift Lock (Auto-Sprint Lock via [L] or HUD button)
  const handleToggleShiftLock = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const next = !eng.isShiftLocked;
    eng.isShiftLocked = next;

    if (next) {
      triggerAlertBanner('SHIFT LOCK (LARI) AKTIF — Karakter otomatis berlari!', 2.2);
    } else {
      triggerAlertBanner('SHIFT LOCK (LARI) NONAKTIF — Tahan SHIFT untuk lari.', 2.2);
    }
    setStats((prev) => ({ ...prev, isShiftLocked: next }));
  }, [triggerAlertBanner]);

  // Mystic Staff [F]: Toggle Holding Tongkat Kunci Ghaib in Right Hand
  const handleUseMysticStaff = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !eng.hasMysticStaff || !eng.isGameActive || eng.isHidingInLocker) {
      return;
    }
    const next = eng.inSpaceWorld ? true : !eng.isStaffEquipped;
    eng.isStaffEquipped = next;
    eng.playerStaffMesh.visible = next;
    eng.character.setStaffHeld(next);
    setStats((prev) => ({ ...prev, isStaffEquipped: next }));

    if (next) {
      sound.playStaffPickup();
      triggerAlertBanner(
        eng.inSpaceWorld
          ? 'TONGKAT SIAP! Tekan [KLIK KIRI / ENTER] tembak Slenderman 10x!'
          : 'TONGKAT DI TANGAN! Arahkan ke Guru MTK lalu [KLIK KIRI / ENTER] untuk tembak petir!',
        3.2
      );
    } else {
      triggerAlertBanner('Tongkat disimpan kembali. Tekan [F] untuk memegang di tangan.', 2.2);
    }
  }, [triggerAlertBanner]);

  // Mystic Staff [ENTER]: Fire Harry-Potter-style mini lightning bolt directly out of the crystal tip of Tongkat Kunci Ghaib!
  const handleCastLightning = useCallback(() => {
    const eng = engineRef.current;
    if (
      !eng ||
      !eng.hasMysticStaff ||
      (!eng.isStaffEquipped && !eng.inSpaceWorld) ||
      !eng.isGameActive ||
      eng.isHidingInLocker ||
      eng.lightningCooldown > 0
    ) {
      return;
    }

    if (eng.inSpaceWorld && !eng.isStaffEquipped) {
      eng.isStaffEquipped = true;
      eng.playerStaffMesh.visible = true;
      eng.character.setStaffHeld(true);
    }

    const slot = eng.lightningBolts.find((b) => !b.active);
    if (!slot) return;

    const aimYaw = eng.followCamera.yaw;
    const fwdX = -Math.sin(aimYaw);
    const fwdZ = -Math.cos(aimYaw);
    eng.physics.rotationY = aimYaw;
    eng.character.group.rotation.y = aimYaw;
    eng.character.group.updateMatrixWorld(true);

    eng.playerStaffTip.getWorldPosition(slot.pos);
    slot.dir
      .set(
        eng.physics.position.x + fwdX * 16 - slot.pos.x,
        1.18 - slot.pos.y,
        eng.physics.position.z + fwdZ * 16 - slot.pos.z
      )
      .normalize();

    slot.active = true;
    slot.life = 0.85;
    slot.group.position.copy(slot.pos);
    eng.staffMuzzleDir.set(
      eng.physics.position.x + fwdX * 16,
      1.18,
      eng.physics.position.z + fwdZ * 16
    );
    slot.group.lookAt(eng.staffMuzzleDir);
    slot.group.visible = true;

    eng.staffMuzzleArc.position.copy(slot.pos);
    eng.staffMuzzleArc.lookAt(eng.staffMuzzleDir);
    eng.staffMuzzleDir.copy(slot.dir);
    eng.staffMuzzleTimer = 0.24;
    eng.staffMuzzleArc.visible = true;

    eng.lightningCooldown = 0.48;
    sound.playLightningCast();
  }, []);

  // Guru MTK hit by Mini Lightning -> Shock Sparks + Knockback / Wall Slam + Tengkurap Collapse + Attempt-to-Stand Cutscene!
  const handleTeacherZap = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.cutsceneMode !== 'NONE') return;
    const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
    if (!teacher) return;

    eng.isGameActive = false;
    eng.physics.velocity.set(0, 0);
    sound.setChaserAudio('NONE');
    sound.playElectricShock();

    eng.lightningBolts.forEach((b) => {
      b.active = false;
      b.group.visible = false;
    });

    const kx = teacher.position.x - eng.physics.position.x;
    const kz = teacher.position.z - eng.physics.position.z;
    const kb = computeKnockbackTarget(
      teacher.position.x,
      teacher.position.z,
      kx,
      kz,
      7.5,
      eng.world.maze,
      eng.world.cellSize,
      eng.world.offset
    );

    eng.zapStartPos.set(teacher.position.x, 0, teacher.position.z);
    eng.zapEndPos.set(kb.x, 0, kb.z);
    eng.zapHitWall = kb.hitWall;
    eng.zapYaw = Math.atan2(-kx, -kz);

    eng.cutsceneMode = 'TEACHER_ZAP';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('TEACHER_ZAP_CUTSCENE');
  }, []);

  // Complete Teacher Zap Cutscene -> Leave Guru MTK knocked out tengkurap with visible 20s recovery timer!
  const handleTeacherZapComplete = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    eng.zapSparks.forEach((sp) => {
      sp.visible = false;
    });
    eng.cutsceneMode = 'NONE';
    eng.character.resetPose();
    eng.character.setStaffHeld(eng.isStaffEquipped);
    eng.character.group.rotation.order = 'XYZ';
    eng.character.group.position.set(eng.physics.position.x, 0, eng.physics.position.z);
    eng.character.group.rotation.set(0, eng.physics.rotationY, 0);
    eng.followCamera.snap(eng.physics.position, eng.world.walls);

    const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
    if (teacher) {
      teacher.position.set(eng.zapEndPos.x, 0, eng.zapEndPos.z);
      teacher.rotationY = eng.zapYaw;
      teacher.group.rotation.order = 'YXZ';
      teacher.group.position.set(eng.zapEndPos.x, 0.24, eng.zapEndPos.z);
      teacher.group.rotation.set(-Math.PI * 0.5, eng.zapYaw, 0);
      teacher.parts.leftArm.rotation.set(0.35, 0, -0.2);
      teacher.parts.rightArm.rotation.set(0.35, 0, 0.2);
      teacher.parts.leftLeg.rotation.set(0, 0, 0);
      teacher.parts.rightLeg.rotation.set(0, 0, 0);
      teacher.mode = 'PATROL';
      teacher.chaseMemoryTimer = 0;
      teacher.cooldownTimer = TEACHER_ZAP_STUN_SECONDS;
    }

    eng.teacherStunTimer = TEACHER_ZAP_STUN_SECONDS;
    eng.isGameActive = true;
    setStats((prev) => ({
      ...prev,
      teacherStunTimer: TEACHER_ZAP_STUN_SECONDS,
    }));
    setGameStatus('PLAYING');
    triggerAlertBanner(
      `⚡ Guru MTK tersambar petir & pingsan tengkurap! Bangun lagi dalam ${TEACHER_ZAP_STUN_SECONDS} detik!`,
      4.0
    );
  }, [triggerAlertBanner]);

  // Locker Toggle
  const handleToggleLocker = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.inSpaceWorld) return;

    if (!eng.isHidingInLocker) {
      if (eng.lockerUsesLeft <= 0) {
        sound.playError();
        triggerAlertBanner('Kesempatan masuk lemari sudah habis (0/5)!', 2.8);
        return;
      }

      let nearest: LockerSpot | null = null;
      let bestDist = Infinity;
      for (let i = 0; i < eng.world.lockers.length; i++) {
        const lk = eng.world.lockers[i];
        const d = eng.physics.position.distanceTo(lk.position);
        if (d < bestDist) {
          bestDist = d;
          nearest = lk;
        }
      }
      if (!nearest || bestDist >= 2.65) {
        return;
      }

      eng.lockerUsesLeft -= 1;
      eng.isHidingInLocker = true;
      eng.activeLocker = nearest;
      eng.lockerPeekYaw = 0;
      eng.lockerPeekPitch = 0;
      nearest.mesh.visible = false;
      eng.lockerInteriorGroup.position.copy(nearest.position);
      eng.lockerInteriorGroup.rotation.set(0, nearest.mesh.rotation.y, 0);
      eng.lockerInteriorGroup.visible = true;
      eng.character.group.visible = false;
      eng.physics.velocity.set(0, 0);

      const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
      if (teacher) {
        teacher.mode = 'PATROL';
        teacher.chaseMemoryTimer = 0;
        teacher.targetCell = null;
      }

      sound.playLockerToggle(true);
      setStats((prev) => ({
        ...prev,
        isHidingInLocker: true,
        lockerUsesLeft: eng.lockerUsesLeft,
        activeChaser: 'NONE',
      }));
      triggerAlertBanner(
        `Bersembunyi di dalam lemari brankas! Mengintip lewat celah kecil • Sisa: ${eng.lockerUsesLeft}/5`,
        2.6
      );
    } else {
      eng.isGameActive = false;
      const q = generateSimpleQuiz('locker', askedQuizIdsRef.current);
      askedQuizIdsRef.current.add(q.id);
      setActiveQuiz(q);
      setGameStatus('LOCKER_QUIZ');
    }
  }, [triggerAlertBanner]);

  // Helper to pick clearest cardinal hallway direction around player for cutscenes
  const getOpenHallDirection = useCallback((eng: NonNullable<typeof engineRef.current>) => {
    const { maze, mazeSize, cellSize, offset } = eng.world;
    const cell = worldToGrid(eng.physics.position.x, eng.physics.position.z, mazeSize, cellSize, offset);
    const dirs: [number, number][] = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    let bestDir: [number, number] = [1, 0];
    let bestLen = -1;
    for (const [dx, dz] of dirs) {
      let run = 0;
      for (let step = 1; step <= 4; step++) {
        const nr = cell.r + dz * step;
        const nc = cell.c + dx * step;
        if (nr >= 0 && nr < mazeSize && nc >= 0 && nc < mazeSize && maze[nr][nc] === 0) {
          run++;
        } else {
          break;
        }
      }
      if (run > bestLen) {
        bestLen = run;
        bestDir = [dx, dz];
      }
    }
    return bestDir;
  }, []);

  // Guru Matematika Catch -> FIRST play Ruler Hit + Stomach Stomp + Fast Flee Cutscene -> THEN Faint Quiz!
  const handleTeacherCatch = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.cutsceneMode !== 'NONE') return;

    eng.isGameActive = false;
    eng.physics.velocity.set(0, 0);
    sound.setChaserAudio('NONE');

    const [dx, dz] = getOpenHallDirection(eng);
    eng.cutsceneAnchor.copy(eng.physics.position);
    eng.cutsceneDir.set(dx, dz);

    const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
    if (teacher) {
      teacher.position.set(
        eng.physics.position.x + dx * 1.02,
        0,
        eng.physics.position.z + dz * 1.02
      );
      teacher.group.position.copy(teacher.position);
      teacher.group.visible = true;
      const pCell = worldToGrid(
        eng.physics.position.x,
        eng.physics.position.z,
        eng.world.mazeSize,
        eng.world.cellSize,
        eng.world.offset
      );
      eng.teacherFleeTarget = pickFarthestOpenCell(eng.world.maze, pCell);
    }

    eng.cutsceneMode = 'TEACHER_CATCH';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('TEACHER_CATCH_CUTSCENE');
  }, [getOpenHallDirection]);

  const handleTeacherCatchCutsceneComplete = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    eng.cutsceneMode = 'NONE';
    const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
    if (teacher) {
      resetEnemyPose(teacher);
      const pCell = worldToGrid(
        eng.physics.position.x,
        eng.physics.position.z,
        eng.world.mazeSize,
        eng.world.cellSize,
        eng.world.offset
      );
      const far = pickFarthestOpenCell(eng.world.maze, pCell);
      const wp = gridToWorld(far.r, far.c, eng.world.cellSize, eng.world.offset);
      teacher.position.set(wp.x, 0, wp.z);
      teacher.group.position.set(wp.x, 0, wp.z);
      teacher.mode = 'PATROL';
      teacher.chaseMemoryTimer = 0;
      teacher.cooldownTimer = 7.5;
    }

    const q = generateSimpleQuiz('teacher_faint', askedQuizIdsRef.current);
    askedQuizIdsRef.current.add(q.id);
    setActiveQuiz(q);
    setGameStatus('TEACHER_FAINT_QUIZ');
  }, []);

  // Chubby Catch -> Choke & Growl -> Fall Telentang -> POV Lower Burlap Sack -> Chubby Quiz
  const handleTriggerChubbyQuiz = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.cutsceneMode !== 'NONE') return;
    eng.isGameActive = false;
    eng.physics.velocity.set(0, 0);
    sound.setChaserAudio('NONE');

    const [dx, dz] = getOpenHallDirection(eng);
    eng.cutsceneAnchor.copy(eng.physics.position);
    eng.cutsceneDir.set(dx, dz);
    eng.cutsceneMode = 'CHUBBY_CAPTURE';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('CHUBBY_CAPTURE_CUTSCENE');
  }, [getOpenHallDirection]);

  const handleChubbyCaptureComplete = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.cutsceneMode = 'NONE';
    eng.sackMesh.visible = false;
    eng.character.group.visible = true;
    const q = generateSimpleQuiz('chubby', askedQuizIdsRef.current);
    askedQuizIdsRef.current.add(q.id);
    setActiveQuiz(q);
    setGameStatus('CHUBBY_QUIZ');
  }, []);

  // Slenderman 0.55m Capture -> Continuously choke neck & lift up to teleport!
  const handleSlenderJumpscare = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.inSpaceWorld || eng.cutsceneMode !== 'NONE') return;
    eng.isGameActive = false;
    eng.physics.velocity.set(0, 0);
    sound.setChaserAudio('NONE');
    sound.playSlenderJumpscare();

    eng.preAbductPos.copy(eng.physics.position);
    eng.preAbductYaw = eng.physics.rotationY;

    const faceYaw = eng.physics.rotationY;
    const fwdX = -Math.sin(faceYaw);
    const fwdZ = -Math.cos(faceYaw);
    eng.cutsceneAnchor.copy(eng.physics.position);
    eng.cutsceneDir.set(fwdX, fwdZ);

    const slender = eng.enemies.find((e) => e.kind === 'SLENDER');
    if (slender) {
      slender.position.set(
        eng.physics.position.x + fwdX * 1.48,
        0,
        eng.physics.position.z + fwdZ * 1.48
      );
      slender.group.position.copy(slender.position);
      slender.group.rotation.y = faceYaw + Math.PI;
      slender.group.visible = true;
    }

    eng.character.group.visible = true;
    eng.cutsceneMode = 'SLENDER_ABDUCT';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('SLENDER_ABDUCT_CUTSCENE');
  }, []);

  // Complete Slenderman Abduction Cutscene -> Transition into Space Arrival Throw Cutscene!
  const handleSlenderAbductComplete = useCallback(() => {
    const curr = engineRef.current;
    if (!curr) return;

    curr.character.resetPose();
    curr.character.setManualPose(true);
    curr.character.group.rotation.order = 'XYZ';
    curr.character.group.visible = true;

    const slender = curr.enemies.find((e) => e.kind === 'SLENDER');
    if (slender) {
      slender.parts.leftArm.rotation.set(0, 0, 0);
      slender.parts.rightArm.rotation.set(0, 0, 0);
      slender.parts.body.rotation.set(0, 0, 0);
      slender.group.visible = true;
    }

    curr.spaceWorld.resetSpaceTrial();
    curr.spaceWorld.scene.add(curr.character.group);
    curr.spaceWorld.scene.add(curr.staffMuzzleArc);
    curr.lightningBolts.forEach((b) => {
      curr.spaceWorld.scene.add(b.group);
      b.active = false;
      b.group.visible = false;
    });
    curr.staffMuzzleTimer = 0;
    curr.staffMuzzleArc.visible = false;
    curr.spaceTimeLeft = SPACE_TRIAL_SECONDS;
    curr.spaceHasPortalOpen = false;
    curr.spaceSlenderHp = SLENDER_SPACE_MAX_HP;
    curr.spaceSlenderBlinking = false;
    curr.isSprintLocked = false;
    curr.hasMysticStaff = false;
    curr.isStaffEquipped = false;
    curr.character.setStaffHeld(false);
    curr.playerStaffMesh.visible = false;

    sound.startSpaceAudio();
    curr.cutsceneMode = 'SLENDER_SPACE_ARRIVE';
    curr.cutsceneTimer = 0;
    curr.cutsceneStartMs = performance.now();
    setGameStatus('SLENDER_SPACE_ARRIVE_CUTSCENE');
  }, []);

  // Complete Space Arrival Throw Cutscene -> Player regains balance near edge & starts Space Trial!
  const handleSlenderSpaceArriveComplete = useCallback(() => {
    const curr = engineRef.current;
    if (!curr) return;

    curr.cutsceneMode = 'NONE';
    curr.character.resetPose();
    curr.character.group.rotation.order = 'XYZ';
    curr.character.group.position.set(0, 0, 22.8);
    curr.character.group.rotation.set(0, 0, 0);
    curr.character.group.visible = true;

    curr.spaceWorld.slenderParts.leftArm.rotation.set(0, 0, 0);
    curr.spaceWorld.slenderParts.rightArm.rotation.set(0, 0, 0);

    curr.inSpaceWorld = true;
    curr.spaceHasPortalOpen = false;
    curr.physics.position.set(0, 0, 22.8);
    curr.physics.velocity.set(0, 0);
    curr.physics.rotationY = 0;
    curr.followCamera.yaw = 0;
    curr.followCamera.snap(curr.physics.position, []);

    curr.spaceSlenderPos.set(0, 0, -23.0);
    curr.spaceSlenderBlinkTimer = 0;
    curr.spaceSlenderHideTimer = 0;
    curr.spaceSlenderHp = SLENDER_SPACE_MAX_HP;
    curr.spaceSlenderBlinking = false;
    curr.isGameActive = true;

    setStats((prev) => ({
      ...prev,
      inSpaceWorld: true,
      spaceTimeLeft: SPACE_TRIAL_SECONDS,
      isSprintLocked: false,
      hasMysticStaff: false,
      isStaffEquipped: false,
      spaceHasPortalOpen: false,
      spaceSlenderHp: SLENDER_SPACE_MAX_HP,
      spaceSlenderMaxHp: SLENDER_SPACE_MAX_HP,
      spaceSlenderBlinking: false,
    }));
    setGameStatus('SPACE_WORLD');
    triggerAlertBanner(
      'TERLEMPAR KE DUNIA ANGKASA! Ambil Tongkat & serang Slenderman 10x dengan [KLIK KIRI / ENTER]!',
      4.5
    );
  }, [triggerAlertBanner]);

  // Trigger 3D Black Hole suction cutscene when Space Slenderman's HP reaches 0
  const handleSlenderBlackhole = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !eng.inSpaceWorld || eng.cutsceneMode !== 'NONE') return;

    eng.isGameActive = false;
    eng.physics.velocity.set(0, 0);
    eng.staffMuzzleTimer = 0;
    eng.staffMuzzleArc.visible = false;
    eng.lightningBolts.forEach((b) => {
      b.active = false;
      b.group.visible = false;
    });
    eng.blackHoleAnchor.copy(eng.spaceSlenderPos);
    eng.spaceWorld.slenderGroup.visible = true;
    eng.spaceWorld.slenderGroup.scale.set(1, 1, 1);
    eng.spaceWorld.blackHoleGroup.visible = true;
    eng.cutsceneMode = 'SLENDER_BLACKHOLE';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('SLENDER_BLACKHOLE_CUTSCENE');
  }, []);

  // Complete Black Hole Cutscene -> Spawn Backrooms-pictured Portal in Space World (player walks in to return!)
  const handleSlenderBlackholeComplete = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    eng.cutsceneMode = 'NONE';
    eng.spaceWorld.blackHoleGroup.visible = false;
    eng.spaceWorld.slenderGroup.visible = false;
    eng.spaceWorld.slenderGroup.scale.set(1, 1, 1);

    let px = eng.blackHoleAnchor.x;
    let pz = eng.blackHoleAnchor.z;
    const dx = px - eng.physics.position.x;
    const dz = pz - eng.physics.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4.5) {
      const dirX = dist > 0.05 ? dx / dist : -Math.sin(eng.physics.rotationY);
      const dirZ = dist > 0.05 ? dz / dist : -Math.cos(eng.physics.rotationY);
      px = eng.physics.position.x + dirX * 5.2;
      pz = eng.physics.position.z + dirZ * 5.2;
    }
    const maxPortalR = eng.spaceWorld.arenaRadius - 4.0;
    const pr = Math.hypot(px, pz);
    if (pr > maxPortalR) {
      px *= maxPortalR / pr;
      pz *= maxPortalR / pr;
    }

    eng.spaceWorld.portalPosition.set(px, 0, pz);
    eng.spaceWorld.portalMesh.position.set(px, 2.3, pz);
    eng.spaceWorld.portalMesh.lookAt(eng.physics.position.x, 2.3, eng.physics.position.z);
    eng.spaceWorld.portalMesh.visible = true;
    eng.spaceHasPortalOpen = true;

    eng.character.resetPose();
    eng.character.setStaffHeld(eng.isStaffEquipped);
    eng.character.group.rotation.order = 'XYZ';
    eng.character.group.position.set(eng.physics.position.x, 0, eng.physics.position.z);
    eng.character.group.rotation.set(0, eng.physics.rotationY, 0);
    eng.followCamera.snap(eng.physics.position, []);

    eng.isGameActive = true;
    sound.playDoorOpen();
    setStats((prev) => ({
      ...prev,
      inSpaceWorld: true,
      isHidingInLocker: false,
      spaceHasPortalOpen: true,
      spaceSlenderHp: 0,
      spaceSlenderBlinking: false,
    }));
    setGameStatus('SPACE_WORLD');
    triggerAlertBanner(
      '🌀 SLENDERMAN KALAH! Masuk ke PORTAL BACKROOMS untuk kembali ke lokasi sebelum diculik!',
      5.0
    );
  }, [triggerAlertBanner]);

  // Handle escaping or failing Space Dimension
  const handleSpaceOutcome = useCallback(
    (won: boolean) => {
      const eng = engineRef.current;
      if (!eng || !eng.inSpaceWorld) return;

      sound.stopSpaceAudio();
      eng.inSpaceWorld = false;
      eng.spaceHasPortalOpen = false;
      eng.spaceWorld.portalMesh.visible = false;
      eng.isSprintLocked = false;
      eng.cutsceneMode = 'NONE';
      eng.spaceWorld.blackHoleGroup.visible = false;
      eng.spaceWorld.slenderGroup.scale.set(1, 1, 1);
      eng.world.scene.add(eng.character.group);
      eng.world.scene.add(eng.staffMuzzleArc);
      eng.staffMuzzleTimer = 0;
      eng.staffMuzzleArc.visible = false;
      eng.lightningBolts.forEach((b) => {
        eng.world.scene.add(b.group);
        b.active = false;
        b.group.visible = false;
      });
      eng.character.resetPose();
      eng.character.group.rotation.order = 'XYZ';

      if (won) {
        sound.playDoorOpen();
        const { maze, mazeSize, cellSize, offset } = eng.world;
        eng.physics.position.copy(eng.preAbductPos);
        resolveEntityWallCollisions(eng.physics.position, 0.45, maze, cellSize, offset);
        eng.physics.velocity.set(0, 0);
        eng.physics.rotationY = eng.preAbductYaw;
        eng.character.group.position.set(eng.physics.position.x, 0, eng.physics.position.z);
        eng.character.group.rotation.y = eng.preAbductYaw;
        eng.followCamera.yaw = eng.preAbductYaw;
        eng.followCamera.snap(eng.physics.position, eng.world.walls);

        // Keep Staff sheathed until player presses [F] to hold in hand, then [KLIK KIRI / ENTER] for mini lightning!
        eng.hasMysticStaff = true;
        eng.isStaffEquipped = false;
        eng.playerStaffMesh.visible = false;
        eng.character.setStaffHeld(false);

        const spawnCell = worldToGrid(
          eng.physics.position.x,
          eng.physics.position.z,
          mazeSize,
          cellSize,
          offset
        );
        const slender = eng.enemies.find((e) => e.kind === 'SLENDER');
        if (slender) {
          const far = pickFarthestOpenCell(maze, spawnCell);
          const wp = gridToWorld(far.r, far.c, cellSize, offset);
          slender.position.set(wp.x, 0, wp.z);
          slender.group.position.set(wp.x, 0, wp.z);
          slender.mode = 'PATROL';
          slender.cooldownTimer = 11.0;
        }
        for (const en of eng.enemies) {
          if (en.kind !== 'SLENDER' && en.mode !== 'PACIFIED') {
            if (en.position.distanceTo(eng.physics.position) < 5.5) {
              en.cooldownTimer = Math.max(en.cooldownTimer, 4.5);
              en.mode = 'PATROL';
              en.chaseMemoryTimer = 0;
            }
          }
        }

        eng.isGameActive = true;
        setStats((prev) => ({
          ...prev,
          inSpaceWorld: false,
          hasMysticStaff: true,
          isStaffEquipped: false,
          spaceHasPortalOpen: false,
        }));
        setGameStatus('PLAYING');
        triggerAlertBanner(
          'Kembali ke lokasi sebelum diculik! Tekan [F] pegang Tongkat lalu [KLIK KIRI / ENTER] lawan Guru MTK!',
          4.5
        );
      } else {
        // Failed Space Dimension: -1.5 lives, reset player AND ALL entities back to initial spawns!
        sound.playTeacherHit();
        eng.hasMysticStaff = false;
        eng.isStaffEquipped = false;
        eng.playerStaffMesh.visible = false;
        eng.character.setStaffHeld(false);
        const nextLives = Math.max(0, eng.lives - 1.5);
        eng.lives = nextLives;
        setStats((prev) => ({
          ...prev,
          lives: nextLives,
          inSpaceWorld: false,
          hasMysticStaff: false,
          isStaffEquipped: false,
          spaceHasPortalOpen: false,
        }));

        if (nextLives <= 0) {
          eng.isGameActive = false;
          setGameStatus('DEFEAT');
          return;
        }

        const startX = (2 - eng.world.offset) * eng.world.cellSize;
        const startZ = (2 - eng.world.offset) * eng.world.cellSize;
        eng.physics.position.set(startX, 0, startZ);
        eng.physics.velocity.set(0, 0);
        eng.physics.rotationY = -Math.PI * 0.5;
        eng.character.group.position.set(startX, 0, startZ);
        eng.character.group.rotation.y = -Math.PI * 0.5;
        eng.followCamera.yaw = -Math.PI * 0.5;
        eng.followCamera.snap(eng.physics.position, eng.world.walls);

        // Reset ALL 3 entities back to their initial starting states & positions
        spawnAllEnemies(eng);

        eng.isGameActive = true;
        setGameStatus('PLAYING');
        triggerAlertBanner(
          `GAGAL DI DUNIA ANGKASA! Nyawa -1.5♥ (Sisa ${nextLives}♥) • Kembali awal & semua entitas reset!`,
          4.2
        );
      }
    },
    [spawnAllEnemies, triggerAlertBanner]
  );

  // Chubby Counter -> Wake Mash -> Hug -> Sacrifice -> Post-Escape Revive sequence handlers
  const handleChubbyCounterComplete = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.chubbyWokeUp = false;
    eng.chubbyShakeImpulse = 0;
    eng.chubbyWakeContext = 'COUNTER';
    setWakeMashMode('counter');
    eng.cutsceneMode = 'CHUBBY_WAKE_MASH';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('CHUBBY_WAKE_MASH');
  }, []);

  // Triggered when player approaches fainted Bang Biru after Guru MTK has moved far away & presses [Space]
  const handleReviveChubby = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || !eng.isGameActive || eng.inSpaceWorld || !eng.chubbyNeedsRevive) return;
    const chubby = eng.enemies.find((e) => e.kind === 'CHUBBY');
    if (!chubby) return;

    eng.isGameActive = false;
    eng.physics.velocity.set(0, 0);
    sound.setChaserAudio('NONE');

    const dx = chubby.position.x - eng.physics.position.x;
    const dz = chubby.position.z - eng.physics.position.z;
    const len = Math.hypot(dx, dz) || 1;
    eng.cutsceneAnchor.copy(eng.physics.position);
    eng.cutsceneDir.set(dx / len, dz / len);

    eng.chubbyWokeUp = false;
    eng.chubbyShakeImpulse = 0;
    eng.chubbyWakeContext = 'SACRIFICE_REVIVE';
    eng.canReviveChubby = false;
    setWakeMashMode('sacrifice_revive');
    eng.cutsceneMode = 'CHUBBY_WAKE_MASH';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('CHUBBY_WAKE_MASH');
  }, []);

  const handleChubbyWakeComplete = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    if (eng.chubbyWakeContext === 'SACRIFICE_REVIVE') {
      eng.cutsceneMode = 'NONE';
      eng.character.resetPose();
      eng.character.setStaffHeld(eng.isStaffEquipped);
      eng.character.group.rotation.order = 'XYZ';
      eng.character.group.position.set(eng.physics.position.x, 0, eng.physics.position.z);
      eng.character.group.rotation.set(0, eng.physics.rotationY, 0);
      eng.followCamera.snap(eng.physics.position, eng.world.walls);

      const chubby = eng.enemies.find((e) => e.kind === 'CHUBBY');
      if (chubby) {
        resetEnemyPose(chubby);
        chubby.mode = 'PACIFIED';
        chubby.cooldownTimer = 9999;
        resolveEntityWallCollisions(chubby.position, 0.48, eng.world.maze, eng.world.cellSize, eng.world.offset);
        chubby.group.position.set(chubby.position.x, 0, chubby.position.z);
        chubby.group.rotation.set(0, chubby.rotationY, 0);
        if (chubby.pacifiedHalo) chubby.pacifiedHalo.visible = true;
      }

      eng.chubbyCompanionActive = true;
      eng.chubbySacrificeDone = false;
      eng.chubbyNeedsRevive = false;
      eng.chubbySacrificeCooldown = 14.0;
      eng.canReviveChubby = false;
      eng.chubbyReviveBlockedReason = null;
      eng.isGameActive = true;
      setStats((prev) => ({
        ...prev,
        canReviveChubby: false,
        chubbyReviveBlockedReason: null,
      }));
      setGameStatus('PLAYING');
      triggerAlertBanner('Bang Biru bangun & berjalan tegak kembali menemanimu!', 3.8);
      return;
    }

    eng.cutsceneMode = 'HUG';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('HUG_CUTSCENE');
  }, [triggerAlertBanner]);

  // Finish Hug Cutscene -> Bang Biru becomes our companion walking upright alongside us!
  const handleHugCutsceneComplete = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    sound.stopSadCutsceneMusic();

    eng.cutsceneMode = 'NONE';
    eng.character.resetPose();
    eng.character.setStaffHeld(eng.isStaffEquipped);
    eng.character.group.rotation.order = 'XYZ';
    eng.character.group.position.set(eng.physics.position.x, 0, eng.physics.position.z);
    eng.character.group.rotation.set(0, eng.physics.rotationY, 0);
    eng.followCamera.snap(eng.physics.position, eng.world.walls);

    const chubby = eng.enemies.find((e) => e.kind === 'CHUBBY');
    if (chubby) {
      resetEnemyPose(chubby);
      chubby.mode = 'PACIFIED';
      chubby.cooldownTimer = 9999;
      chubby.position.set(
        eng.physics.position.x + Math.cos(eng.physics.rotationY) * 1.4,
        0,
        eng.physics.position.z - Math.sin(eng.physics.rotationY) * 1.4
      );
      resolveEntityWallCollisions(
        chubby.position,
        0.48,
        eng.world.maze,
        eng.world.cellSize,
        eng.world.offset
      );
      chubby.group.position.set(chubby.position.x, 0, chubby.position.z);
      chubby.group.rotation.set(0, eng.physics.rotationY, 0);
      if (chubby.pacifiedHalo) chubby.pacifiedHalo.visible = true;
    }

    eng.chubbyCompanionActive = true;
    eng.chubbySacrificeDone = false;
    eng.chubbyNeedsRevive = false;
    eng.chubbySacrificeCooldown = 0;
    eng.isGameActive = true;
    setGameStatus('PLAYING');
    triggerAlertBanner(
      'Bang Biru kini menemanimu jalan bersama! Hati-hati jika bertemu Guru MTK.',
      3.8
    );
  }, [triggerAlertBanner]);

  // Triggered naturally when Player + Companion Bang Biru encounter an awake Guru MTK in a corridor
  const handleTriggerChubbySacrifice = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.cutsceneMode !== 'NONE') return;
    const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
    const chubby = eng.enemies.find((e) => e.kind === 'CHUBBY');
    if (!teacher || !chubby) return;

    eng.isGameActive = false;
    eng.physics.velocity.set(0, 0);
    sound.setChaserAudio('NONE');

    const { maze, cellSize, offset } = eng.world;
    const px = eng.physics.position.x;
    const pz = eng.physics.position.z;
    const vx = teacher.position.x - px;
    const vz = teacher.position.z - pz;
    const len = Math.hypot(vx, vz) || 1;
    const dx = vx / len;
    const dz = vz / len;

    const kb = computeKnockbackTarget(px, pz, dx, dz, 5.2, maze, cellSize, offset);
    const clearDist = Math.hypot(kb.x - px, kb.z - pz);

    eng.sacrificeDistChubby = Math.max(1.8, Math.min(3.5, clearDist * 0.72));
    eng.sacrificeDistTeacher = Math.max(2.6, Math.min(4.6, clearDist * 0.94));
    eng.cutsceneAnchor.set(px, 0, pz);
    eng.cutsceneDir.set(dx, dz);

    eng.cutsceneMode = 'CHUBBY_SACRIFICE';
    eng.cutsceneTimer = 0;
    eng.cutsceneStartMs = performance.now();
    setGameStatus('CHUBBY_SACRIFICE_CUTSCENE');
  }, []);

  // Finish Sacrifice Cutscene -> Resume PLAYING while still running backward away from chasing Guru MTK!
  const handleChubbySacrificeComplete = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;

    eng.cutsceneMode = 'NONE';
    eng.chubbyCompanionActive = false;
    eng.chubbySacrificeDone = true;
    eng.chubbyNeedsRevive = true;
    eng.character.resetPose();
    eng.character.setStaffHeld(eng.isStaffEquipped);
    eng.character.group.rotation.order = 'XYZ';
    sound.setChaserAudio('TEACHER');

    const dx = eng.cutsceneDir.x;
    const dz = eng.cutsceneDir.y;
    const dirYaw = Math.atan2(-dx, -dz);

    // Put player at safe retreating position (verified open cell & wall collision resolved), facing Guru MTK!
    const { maze, mazeSize, cellSize, offset } = eng.world;
    const candX = eng.physics.position.x - dx * 1.25;
    const candZ = eng.physics.position.z - dz * 1.25;
    const candCell = worldToGrid(candX, candZ, mazeSize, cellSize, offset);
    const safeRetreatX = maze[candCell.r]?.[candCell.c] === 0 ? candX : eng.physics.position.x;
    const safeRetreatZ = maze[candCell.r]?.[candCell.c] === 0 ? candZ : eng.physics.position.z;
    eng.physics.position.set(safeRetreatX, 0, safeRetreatZ);
    resolveEntityWallCollisions(eng.physics.position, 0.45, maze, cellSize, offset);
    eng.physics.rotationY = dirYaw;
    eng.followCamera.yaw = dirYaw;
    eng.followCamera.snap(eng.physics.position, eng.world.walls);

    eng.backwardEscapeTimer = 1.25;
    eng.backwardEscapeDir.set(-dx, -dz);

    const chubby = eng.enemies.find((e) => e.kind === 'CHUBBY');
    if (chubby) {
      chubby.mode = 'PACIFIED';
      chubby.cooldownTimer = 9999;
      chubby.position.set(chubby.group.position.x, 0, chubby.group.position.z);
      resolveEntityWallCollisions(chubby.position, 0.48, maze, cellSize, offset);
      chubby.rotationY = dirYaw;
      chubby.group.rotation.order = 'YXZ';
      chubby.group.position.set(chubby.position.x, 0.36, chubby.position.z);
      chubby.group.rotation.set(Math.PI * 0.5, dirYaw, 0);
    }

    const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
    if (teacher) {
      resetEnemyPose(teacher);
      const tCandX = eng.physics.position.x + dx * Math.min(4.0, eng.sacrificeDistTeacher);
      const tCandZ = eng.physics.position.z + dz * Math.min(4.0, eng.sacrificeDistTeacher);
      const tCell = worldToGrid(tCandX, tCandZ, mazeSize, cellSize, offset);
      if (maze[tCell.r]?.[tCell.c] === 0) {
        teacher.position.set(tCandX, 0, tCandZ);
      } else {
        teacher.position.set(eng.physics.position.x + dx * 2.2, 0, eng.physics.position.z + dz * 2.2);
      }
      resolveEntityWallCollisions(teacher.position, 0.48, maze, cellSize, offset);
      teacher.group.position.set(teacher.position.x, 0, teacher.position.z);
      teacher.mode = 'CHASE';
      teacher.chaseMemoryTimer = 6.5;
      teacher.cooldownTimer = 0;
    }

    eng.isGameActive = true;
    setGameStatus('PLAYING');
    triggerAlertBanner(
      'BANG BIRU TERPUKUL! Menjauh dari Guru MTK dulu lalu tap [SPASI] dekat Bang Biru!',
      4.2
    );
  }, [triggerAlertBanner]);

  useEffect(() => {
    handlersRef.current = {
      onOpenTerminal: () => {
        if (engineRef.current) engineRef.current.isGameActive = false;
        setGameStatus('TERMINAL');
      },
      onToggleLocker: handleToggleLocker,
      onTriggerChubbyQuiz: handleTriggerChubbyQuiz,
      onTriggerChubbySacrifice: handleTriggerChubbySacrifice,
      onReviveChubby: handleReviveChubby,
      onSlenderJumpscare: handleSlenderJumpscare,
      onSlenderBlackhole: handleSlenderBlackhole,
      onTeacherCatch: handleTeacherCatch,
      onTeacherZap: handleTeacherZap,
      onVictory: () => {
        if (engineRef.current) engineRef.current.isGameActive = false;
        sound.setChaserAudio('NONE');
        setGameStatus('VICTORY');
      },
      onToggleShiftLock: handleToggleShiftLock,
      onUseMysticStaff: handleUseMysticStaff,
      onCastLightning: handleCastLightning,
      onSpaceOutcome: handleSpaceOutcome,
    };
    if (window.location.search.includes('verify=1')) {
      (window as unknown as Record<string, unknown>).__mcVerify = {
        getEngine: () => engineRef.current,
        enterNearestLocker: () => {
          const eng = engineRef.current;
          if (!eng || eng.world.lockers.length === 0) return false;
          const lk = eng.world.lockers[0];
          const rotY = lk.mesh.rotation.y;
          eng.physics.position.set(
            lk.position.x + Math.sin(rotY) * 1.1,
            0,
            lk.position.z + Math.cos(rotY) * 1.1
          );
          eng.physics.velocity.set(0, 0);
          handleToggleLocker();
          return eng.isHidingInLocker;
        },
        openSpacePortalFromSpot: (x: number, z: number, yaw: number) => {
          const eng = engineRef.current;
          if (!eng) return false;
          eng.isHidingInLocker = false;
          if (eng.activeLocker) {
            eng.activeLocker.mesh.visible = true;
            eng.activeLocker = null;
          }
          eng.lockerInteriorGroup.visible = false;
          eng.preAbductPos.set(x, 0, z);
          eng.preAbductYaw = yaw;
          eng.spaceWorld.resetSpaceTrial();
          eng.spaceWorld.staffMesh.visible = false;
          eng.spaceWorld.scene.add(eng.character.group);
          eng.spaceWorld.scene.add(eng.staffMuzzleArc);
          eng.inSpaceWorld = true;
          eng.hasMysticStaff = true;
          eng.isStaffEquipped = true;
          eng.playerStaffMesh.visible = true;
          eng.character.setStaffHeld(true);
          eng.physics.position.set(0, 0, 12);
          eng.physics.rotationY = 0;
          eng.followCamera.yaw = 0;
          eng.blackHoleAnchor.set(0, 0, 2.5);
          handleSlenderBlackholeComplete();
          return eng.spaceHasPortalOpen;
        },
        walkIntoSpacePortal: () => {
          const eng = engineRef.current;
          if (!eng || !eng.inSpaceWorld || !eng.spaceHasPortalOpen) return false;
          eng.physics.position.set(
            eng.spaceWorld.portalPosition.x,
            0,
            eng.spaceWorld.portalPosition.z
          );
          return true;
        },
        gotoExitDoor: () => {
          const eng = engineRef.current;
          if (!eng) return false;
          // Stand in Terminal room looking diagonally South-East (-3π/4 yaw) directly at the Exit Door screen
          const tx = eng.world.terminalPosition.x;
          const tz = eng.world.terminalPosition.z;
          eng.physics.position.set(tx, 0, tz);
          eng.physics.velocity.set(0, 0);
          eng.physics.rotationY = -Math.PI * 0.75;
          eng.followCamera.yaw = -Math.PI * 0.75;
          eng.followCamera.pitch = 0.14;
          eng.followCamera.snap(eng.physics.position, eng.world.walls);
          return true;
        },
        openTerminal: () => {
          handlersRef.current.onOpenTerminal();
          return true;
        },
      };
    }
  }, [
    handleToggleLocker,
    handleTriggerChubbyQuiz,
    handleTriggerChubbySacrifice,
    handleReviveChubby,
    handleSlenderJumpscare,
    handleSlenderBlackhole,
    handleSlenderBlackholeComplete,
    handleTeacherCatch,
    handleTeacherZap,
    handleToggleShiftLock,
    handleUseMysticStaff,
    handleCastLightning,
    handleSpaceOutcome,
  ]);

  // Quiz Resolution (Locker, Teacher Faint Revival, & Chubby -> Remove Sack + Punch Belly!)
  const handleQuizCorrect = () => {
    const eng = engineRef.current;
    if (!eng || !activeQuiz) return;

    if (activeQuiz.kind === 'locker') {
      eng.isHidingInLocker = false;
      if (eng.activeLocker) {
        eng.activeLocker.mesh.visible = true;
        eng.activeLocker = null;
      }
      eng.lockerInteriorGroup.visible = false;
      eng.lockerPeekYaw = 0;
      eng.lockerPeekPitch = 0;
      eng.character.group.visible = true;
      eng.followCamera.snap(eng.physics.position, eng.world.walls);
      sound.playLockerToggle(false);
      setStats((prev) => ({ ...prev, isHidingInLocker: false }));
      setActiveQuiz(null);
      eng.isGameActive = true;
      setGameStatus('PLAYING');
      triggerAlertBanner('Kunci lemari terbuka! Lanjutkan pelarianmu.', 2.5);
    } else if (activeQuiz.kind === 'teacher_faint') {
      // Wake up right where player fainted! Teacher already ran far away during catch animation.
      eng.character.resetPose();
      eng.character.setStaffHeld(eng.isStaffEquipped);
      eng.character.group.rotation.order = 'XYZ';
      eng.character.group.position.set(eng.physics.position.x, 0, eng.physics.position.z);
      eng.character.group.rotation.set(0, eng.physics.rotationY, 0);
      eng.followCamera.snap(eng.physics.position, eng.world.walls);

      const teacher = eng.enemies.find((e) => e.kind === 'TEACHER');
      if (teacher) {
        teacher.mode = 'PATROL';
        teacher.cooldownTimer = Math.max(teacher.cooldownTimer, 6.0);
        teacher.chaseMemoryTimer = 0;
      }
      setActiveQuiz(null);
      eng.isGameActive = true;
      setGameStatus('PLAYING');
      triggerAlertBanner('Kamu tersadar dan Guru MTK sudah lari menjauh!', 3.2);
    } else {
      // Chubby Quiz solved -> Remove sack, stand up, punch Chubby in the belly until fainted!
      setActiveQuiz(null);
      eng.sackMesh.visible = false;
      eng.cutsceneMode = 'CHUBBY_COUNTER';
      eng.cutsceneTimer = 0;
      eng.cutsceneStartMs = performance.now();
      setGameStatus('CHUBBY_COUNTER_CUTSCENE');
    }
  };

  const handleQuizWrong = () => {
    const eng = engineRef.current;
    if (!eng || !activeQuiz) return;

    if (activeQuiz.kind === 'teacher_faint') {
      // Wrong on faint revival quiz -> -1 heart & respawn at (2, 2) or Defeat
      const nextLives = Math.max(0, eng.lives - 1);
      eng.lives = nextLives;
      setStats((prev) => ({ ...prev, lives: nextLives }));

      window.setTimeout(() => {
        const curr = engineRef.current;
        if (!curr) return;
        setActiveQuiz(null);
        curr.character.resetPose();
        curr.character.setStaffHeld(curr.isStaffEquipped);
        curr.character.group.rotation.order = 'XYZ';

        if (nextLives <= 0) {
          curr.isGameActive = false;
          setGameStatus('DEFEAT');
          return;
        }

        const startX = (2 - curr.world.offset) * curr.world.cellSize;
        const startZ = (2 - curr.world.offset) * curr.world.cellSize;
        curr.physics.position.set(startX, 0, startZ);
        curr.physics.velocity.set(0, 0);
        curr.physics.rotationY = -Math.PI * 0.5;
        curr.character.group.position.set(startX, 0, startZ);
        curr.character.group.rotation.set(0, -Math.PI * 0.5, 0);
        curr.followCamera.yaw = -Math.PI * 0.5;
        curr.followCamera.snap(curr.physics.position, curr.world.walls);

        curr.isGameActive = true;
        setGameStatus('PLAYING');
        triggerAlertBanner(
          `GAGAL BANGUN! Nyawa -1♥ (Sisa ${nextLives}♥) • Kembali ke awal!`,
          3.5
        );
      }, 750);
      return;
    }

    // Locker or Chubby wrong answer: -0.5 heart and reload fresh question
    const nextLives = Math.max(0, eng.lives - 0.5);
    eng.lives = nextLives;
    setStats((prev) => ({ ...prev, lives: nextLives }));

    if (nextLives <= 0) {
      eng.isGameActive = false;
      eng.isHidingInLocker = false;
      if (eng.activeLocker) {
        eng.activeLocker.mesh.visible = true;
        eng.activeLocker = null;
      }
      eng.lockerInteriorGroup.visible = false;
      eng.character.group.visible = true;
      setActiveQuiz(null);
      setGameStatus('DEFEAT');
      return;
    }

    const nextQ = generateSimpleQuiz(activeQuiz.kind, askedQuizIdsRef.current);
    askedQuizIdsRef.current.add(nextQ.id);
    window.setTimeout(() => {
      setActiveQuiz(nextQ);
    }, 850);
  };

  // Terminal Puzzle Handlers
  const handleTerminalSolved = () => {
    if (engineRef.current) {
      engineRef.current.isExitUnlocked = true;
      engineRef.current.world.openExitDoor();
      engineRef.current.isGameActive = true;
    }
    sound.playDoorOpen();
    setStats((prev) => ({ ...prev, isExitUnlocked: true }));
    setGameStatus('PLAYING');
  };

  const handleTerminalWrong = () => {
    const eng = engineRef.current;
    if (!eng) return;
    const nextLives = Math.max(0, eng.lives - 1);
    eng.lives = nextLives;
    setStats((prev) => ({ ...prev, lives: nextLives }));
    if (nextLives <= 0) {
      eng.isGameActive = false;
      setTimeout(() => setGameStatus('DEFEAT'), 800);
    }
  };

  const handleCloseTerminal = () => {
    if (engineRef.current) engineRef.current.isGameActive = true;
    setGameStatus('PLAYING');
  };

  // Touch & HUD button handlers
  const handleTouchMove = (vx: number, vy: number) => {
    if (engineRef.current) engineRef.current.touchVector = { x: vx, y: vy };
  };

  const handleTouchSprint = (sprint: boolean) => {
    if (engineRef.current) engineRef.current.touchSprint = sprint;
    setStats((prev) => ({ ...prev, isSprinting: sprint }));
  };

  const handleInteract = () => {
    const eng = engineRef.current;
    if (stats.inSpaceWorld && stats.spaceHasPortalOpen && eng) {
      const dPortal = Math.hypot(
        eng.physics.position.x - eng.spaceWorld.portalPosition.x,
        eng.physics.position.z - eng.spaceWorld.portalPosition.z
      );
      if (dPortal < 3.6) {
        handleSpaceOutcome(true);
      }
      return;
    }
    if (stats.isHidingInLocker || stats.isNearLocker) {
      handleToggleLocker();
    } else if (stats.isNearTerminal && !stats.isExitUnlocked) {
      if (engineRef.current) engineRef.current.isGameActive = false;
      setGameStatus('TERMINAL');
    } else if (stats.isNearExit && stats.isExitUnlocked) {
      if (engineRef.current) engineRef.current.isGameActive = false;
      setGameStatus('VICTORY');
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0d0f0d] select-none font-sans">
      <div
        ref={mountRef}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 z-0 cursor-grab active:cursor-grabbing"
      />

      {gameStatus !== 'START' &&
        gameStatus !== 'OPENING_CUTSCENE' &&
        gameStatus !== 'CHUBBY_CAPTURE_CUTSCENE' &&
        gameStatus !== 'CHUBBY_COUNTER_CUTSCENE' &&
        gameStatus !== 'CHUBBY_WAKE_MASH' &&
        gameStatus !== 'HUG_CUTSCENE' &&
        gameStatus !== 'CHUBBY_SACRIFICE_CUTSCENE' &&
        gameStatus !== 'TEACHER_CATCH_CUTSCENE' &&
        gameStatus !== 'SLENDER_ABDUCT_CUTSCENE' &&
        gameStatus !== 'SLENDER_SPACE_ARRIVE_CUTSCENE' &&
        gameStatus !== 'SLENDER_BLACKHOLE_CUTSCENE' &&
        gameStatus !== 'TEACHER_ZAP_CUTSCENE' && (
          <HUD
            stats={stats}
            maze={mazeGrid.length > 0 ? mazeGrid : engineRef.current?.world.maze || []}
            mazeSize={engineRef.current?.world.mazeSize || 19}
            playerPos={playerCoordinates}
            playerYaw={playerYaw}
            enemyMarkers={enemyMarkers}
            lockerMarkers={lockerMarkers}
            onOpenMenu={() => {
              if (engineRef.current) {
                engineRef.current.isGameActive = false;
                engineRef.current.cutsceneMode = 'NONE';
                engineRef.current.inSpaceWorld = false;
                engineRef.current.spaceHasPortalOpen = false;
                engineRef.current.spaceWorld.portalMesh.visible = false;
                engineRef.current.isHidingInLocker = false;
                if (engineRef.current.activeLocker) {
                  engineRef.current.activeLocker.mesh.visible = true;
                  engineRef.current.activeLocker = null;
                }
                engineRef.current.lockerInteriorGroup.visible = false;
                engineRef.current.character.group.visible = true;
                engineRef.current.sackMesh.visible = false;
                engineRef.current.staffMuzzleTimer = 0;
                engineRef.current.staffMuzzleArc.visible = false;
                engineRef.current.lightningBolts.forEach((b) => {
                  engineRef.current?.world.scene.add(b.group);
                  b.active = false;
                  b.group.visible = false;
                });
                engineRef.current.world.scene.add(engineRef.current.staffMuzzleArc);
                engineRef.current.spaceWorld.blackHoleGroup.visible = false;
                engineRef.current.spaceWorld.slenderGroup.scale.set(1, 1, 1);
                engineRef.current.chubbyCompanionActive = false;
                engineRef.current.chubbySacrificeDone = false;
                engineRef.current.chubbyNeedsRevive = false;
                engineRef.current.character.resetPose();
                engineRef.current.character.setStaffHeld(false);
                engineRef.current.character.group.rotation.order = 'XYZ';
                engineRef.current.character.group.position.y = 0;
                engineRef.current.character.group.rotation.set(0, 0, 0);
                engineRef.current.world.scene.add(engineRef.current.character.group);
              }
              sound.setChaserAudio('NONE');
              sound.stopSpaceAudio();
              sound.stopSadCutsceneMusic();
              setGameStatus('START');
            }}
            onOpenTerminal={() => {
              if (engineRef.current) engineRef.current.isGameActive = false;
              setGameStatus('TERMINAL');
            }}
            onToggleLocker={handleToggleLocker}
            onInteract={handleInteract}
            onToggleShiftLock={handleToggleShiftLock}
            onUseMysticStaff={handleUseMysticStaff}
            onCastLightning={handleCastLightning}
            onReviveChubby={handleReviveChubby}
          />
        )}

      {(gameStatus === 'PLAYING' || gameStatus === 'SPACE_WORLD') && (
        <TouchControls
          onMoveVector={handleTouchMove}
          onSprintToggle={handleTouchSprint}
          onInteract={handleInteract}
          isSprinting={stats.isSprinting}
          canInteract={
            !stats.inSpaceWorld &&
            (stats.isHidingInLocker ||
              stats.isNearLocker ||
              stats.isNearTerminal ||
              (stats.isNearExit && stats.isExitUnlocked))
          }
        />
      )}

      {gameStatus === 'START' && (
        <StartScreen
          selectedDifficulty={difficulty}
          onSelectDifficulty={(d) => setDifficulty(d)}
          onStart={beginOpeningSequence}
        />
      )}

      {gameStatus === 'OPENING_CUTSCENE' && (
        <CutsceneOverlay
          variant="opening"
          onComplete={() => startGame(difficulty)}
        />
      )}

      {gameStatus === 'CHUBBY_CAPTURE_CUTSCENE' && (
        <CutsceneOverlay
          variant="chubby_capture"
          onComplete={handleChubbyCaptureComplete}
        />
      )}

      {gameStatus === 'CHUBBY_COUNTER_CUTSCENE' && (
        <CutsceneOverlay
          variant="chubby_counter"
          onComplete={handleChubbyCounterComplete}
        />
      )}

      {gameStatus === 'CHUBBY_WAKE_MASH' && (
        <ChubbyWakeMashOverlay
          mode={wakeMashMode}
          onShakeImpulse={() => {
            if (engineRef.current) {
              engineRef.current.chubbyShakeImpulse = 1.0;
            }
          }}
          onComplete={() => {
            if (engineRef.current) {
              engineRef.current.chubbyWokeUp = true;
            }
            handleChubbyWakeComplete();
          }}
        />
      )}

      {gameStatus === 'HUG_CUTSCENE' && (
        <HugCutscene onComplete={handleHugCutsceneComplete} />
      )}

      {gameStatus === 'CHUBBY_SACRIFICE_CUTSCENE' && (
        <CutsceneOverlay
          variant="chubby_sacrifice"
          onComplete={handleChubbySacrificeComplete}
        />
      )}

      {gameStatus === 'TEACHER_CATCH_CUTSCENE' && (
        <CutsceneOverlay
          variant="teacher_catch"
          onComplete={handleTeacherCatchCutsceneComplete}
        />
      )}

      {gameStatus === 'SLENDER_ABDUCT_CUTSCENE' && (
        <CutsceneOverlay
          variant="slender_abduct"
          onComplete={handleSlenderAbductComplete}
        />
      )}

      {gameStatus === 'SLENDER_SPACE_ARRIVE_CUTSCENE' && (
        <CutsceneOverlay
          variant="slender_space_arrive"
          onComplete={handleSlenderSpaceArriveComplete}
        />
      )}

      {gameStatus === 'SLENDER_BLACKHOLE_CUTSCENE' && (
        <CutsceneOverlay
          variant="slender_blackhole"
          onComplete={handleSlenderBlackholeComplete}
        />
      )}

      {gameStatus === 'TEACHER_ZAP_CUTSCENE' && (
        <CutsceneOverlay
          variant="teacher_zap"
          onComplete={handleTeacherZapComplete}
        />
      )}

      {gameStatus === 'TERMINAL' && (
        <TerminalModal
          puzzle={puzzle}
          lives={stats.lives}
          onClose={handleCloseTerminal}
          onSolve={handleTerminalSolved}
          onWrongAnswer={handleTerminalWrong}
        />
      )}

      {(gameStatus === 'LOCKER_QUIZ' ||
        gameStatus === 'CHUBBY_QUIZ' ||
        gameStatus === 'TEACHER_FAINT_QUIZ') &&
        activeQuiz && (
          <QuizModal
            quiz={activeQuiz}
            lives={stats.lives}
            onCorrect={handleQuizCorrect}
            onWrong={handleQuizWrong}
          />
        )}

      {(gameStatus === 'VICTORY' || gameStatus === 'DEFEAT') && (
        <EndScreen
          status={gameStatus}
          stats={stats}
          puzzle={puzzle}
          onRetry={() => startGame(difficulty)}
          onMenu={() => setGameStatus('START')}
        />
      )}
    </div>
  );
}
