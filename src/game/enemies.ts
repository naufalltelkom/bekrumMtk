import * as THREE from 'three';

export const PLAYER_WALK_SPEED = 3.8;
export const PLAYER_SPRINT_SPEED = 6.5;
// Nerfed from 100% down to 75% of player's sprint speed (faster than walk, slower than sprint)
export const TEACHER_CHASE_SPEED = PLAYER_SPRINT_SPEED * 0.75; // 4.875 m/s
export const SLENDER_SPRINT_LOCK_DIST = 2.0;
export const SLENDER_SPACE_CAPTURE_DIST = 0.55;
// Slenderman reduced to 50% of original speed
export const SLENDER_CREEP_SPEED = 0.7;
export const SLENDER_BLINK_HOP = 0.85;
// Space Slenderman +10% speed (still slower than player walk 3.8 & sprint 6.5) & blinks every 2.0s
export const SLENDER_SPACE_CREEP_SPEED = 1.21;
export const SLENDER_SPACE_BLINK_HOP = 0.64;
export const SLENDER_SPACE_BLINK_INTERVAL = 2.0;
export const SLENDER_SPACE_MAX_HP = 10;
export const SPACE_ARENA_RADIUS = 28.0;
export const TEACHER_ZAP_STUN_SECONDS = 20;

export type EnemyKind = 'TEACHER' | 'CHUBBY' | 'SLENDER';

export interface LockerSpot {
  id: number;
  row: number;
  col: number;
  position: THREE.Vector3;
  mesh: THREE.Group;
}

export interface EnemyState {
  kind: EnemyKind;
  group: THREE.Group;
  position: THREE.Vector3;
  rotationY: number;
  bodyBaseY: number;
  mode: 'PATROL' | 'CHASE' | 'PACIFIED' | 'COOLDOWN';
  targetCell: { r: number; c: number } | null;
  lastKnownPlayerPos: THREE.Vector3 | null;
  chaseMemoryTimer: number;
  walkPhase: number;
  blinkTimer: number;
  blinkHideTimer: number;
  cooldownTimer: number;
  pacifiedHalo?: THREE.Mesh;
  parts: {
    leftLeg: THREE.Object3D;
    rightLeg: THREE.Object3D;
    leftArm: THREE.Object3D;
    rightArm: THREE.Object3D;
    body: THREE.Object3D;
    head: THREE.Object3D;
  };
}

/**
 * Shared contact shadow helper for grounded actors & props
 */
function createContactShadow(radius: number): THREE.Mesh {
  const geo = new THREE.CircleGeometry(radius, 18);
  const mat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const shadow = new THREE.Mesh(geo, mat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  return shadow;
}

/**
 * Converts world (x, z) to maze grid (row, col)
 */
export function worldToGrid(
  x: number,
  z: number,
  mazeSize: number,
  cellSize: number,
  offset: number
): { r: number; c: number } {
  const c = Math.max(0, Math.min(mazeSize - 1, Math.round(x / cellSize + offset)));
  const r = Math.max(0, Math.min(mazeSize - 1, Math.round(z / cellSize + offset)));
  return { r, c };
}

/**
 * Converts maze grid (row, col) to world (x, z)
 */
export function gridToWorld(
  r: number,
  c: number,
  cellSize: number,
  offset: number
): { x: number; z: number } {
  return {
    x: (c - offset) * cellSize,
    z: (r - offset) * cellSize,
  };
}

/**
 * Fast grid line-of-sight check between two world positions (zero allocation)
 */
export function hasGridLineOfSight(
  x1: number,
  z1: number,
  x2: number,
  z2: number,
  maze: number[][],
  cellSize: number,
  offset: number,
  maxDist: number = 28
): boolean {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const distSq = dx * dx + dz * dz;
  if (distSq > maxDist * maxDist) return false;
  const dist = Math.sqrt(distSq);
  if (dist < 0.8) return true;

  const steps = Math.ceil(dist / 0.85);
  const rows = maze.length;
  const cols = maze[0]?.length ?? 0;

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const wx = x1 + dx * t;
    const wz = z1 + dz * t;
    const c = Math.round(wx / cellSize + offset);
    const r = Math.round(wz / cellSize + offset);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return false;
    if (maze[r][c] === 1) return false;
  }
  return true;
}

/**
 * Finds the next open cell step from (startR, startC) toward (goalR, goalC) using BFS
 */
export function findNextMazeStep(
  startR: number,
  startC: number,
  goalR: number,
  goalC: number,
  maze: number[][]
): { r: number; c: number } {
  const rows = maze.length;
  const cols = maze[0]?.length ?? 0;
  if (startR === goalR && startC === goalC) return { r: startR, c: startC };

  const visited = new Uint8Array(rows * cols);
  const parentR = new Int16Array(rows * cols).fill(-1);
  const parentC = new Int16Array(rows * cols).fill(-1);

  const queueR: number[] = [startR];
  const queueC: number[] = [startC];
  visited[startR * cols + startC] = 1;

  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  let found = false;
  let head = 0;
  while (head < queueR.length) {
    const cr = queueR[head];
    const cc = queueC[head];
    head++;

    if (cr === goalR && cc === goalC) {
      found = true;
      break;
    }

    for (let d = 0; d < 4; d++) {
      const nr = cr + dirs[d][0];
      const nc = cc + dirs[d][1];
      if (
        nr >= 0 &&
        nr < rows &&
        nc >= 0 &&
        nc < cols &&
        maze[nr][nc] === 0 &&
        !visited[nr * cols + nc]
      ) {
        visited[nr * cols + nc] = 1;
        parentR[nr * cols + nc] = cr;
        parentC[nr * cols + nc] = cc;
        queueR.push(nr);
        queueC.push(nc);
      }
    }
  }

  if (!found) {
    // Fallback to any open neighbor
    for (let d = 0; d < 4; d++) {
      const nr = startR + dirs[d][0];
      const nc = startC + dirs[d][1];
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && maze[nr][nc] === 0) {
        return { r: nr, c: nc };
      }
    }
    return { r: startR, c: startC };
  }

  // Backtrack from goal to find the immediate step after start
  let curR = goalR;
  let curC = goalC;
  while (true) {
    const idx = curR * cols + curC;
    const pr = parentR[idx];
    const pc = parentC[idx];
    if (pr === startR && pc === startC) {
      return { r: curR, c: curC };
    }
    if (pr === -1) break;
    curR = pr;
    curC = pc;
  }
  return { r: startR, c: startC };
}

/**
 * Picks a random open maze cell far from excluded coordinates
 */
export function pickOpenCell(
  maze: number[][],
  minRow: number,
  minCol: number,
  avoidCells: { r: number; c: number }[] = []
): { r: number; c: number } {
  const size = maze.length;
  const candidates: { r: number; c: number }[] = [];
  for (let r = 1; r < size - 1; r++) {
    for (let c = 1; c < size - 1; c++) {
      if (maze[r][c] !== 0) continue;
      if (r < minRow && c < minCol) continue;
      let tooClose = false;
      for (const av of avoidCells) {
        if (Math.abs(av.r - r) + Math.abs(av.c - c) < 4) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) candidates.push({ r, c });
    }
  }
  if (candidates.length === 0) return { r: Math.floor(size / 2), c: Math.floor(size / 2) };
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Picks the farthest open maze cell from a reference grid cell so fleeing Teacher stays far on the map
 */
export function pickFarthestOpenCell(
  maze: number[][],
  fromCell: { r: number; c: number }
): { r: number; c: number } {
  const size = maze.length;
  let best = { r: Math.floor(size / 2), c: Math.floor(size / 2) };
  let bestDistSq = -1;
  for (let r = 1; r < size - 1; r++) {
    for (let c = 1; c < size - 1; c++) {
      if (maze[r][c] !== 0) continue;
      const dr = r - fromCell.r;
      const dc = c - fromCell.c;
      const dSq = dr * dr + dc * dc;
      if (dSq > bestDistSq) {
        bestDistSq = dSq;
        best = { r, c };
      }
    }
  }
  return best;
}

/**
 * Resets an enemy's 3D group & limb transforms cleanly upright (prevents lying-while-walking bugs)
 */
export function resetEnemyPose(enemy: EnemyState): void {
  enemy.group.rotation.order = 'XYZ';
  enemy.group.position.set(enemy.position.x, 0, enemy.position.z);
  enemy.group.rotation.set(0, enemy.rotationY, 0);
  enemy.group.scale.set(1, 1, 1);
  enemy.parts.leftLeg.rotation.set(0, 0, 0);
  enemy.parts.rightLeg.rotation.set(0, 0, 0);
  enemy.parts.leftArm.rotation.set(0, 0, 0);
  enemy.parts.rightArm.rotation.set(0, 0, 0);
  enemy.parts.body.rotation.set(0, 0, 0);
  enemy.parts.body.position.set(0, enemy.bodyBaseY, 0);
  enemy.parts.head.rotation.set(0, 0, 0);
}

/**
 * Computes knockback destination along (dirX, dirZ) stopping safely before any maze wall.
 * Returns { x, z, hitWall, traveled } so lightning attacks slam Guru MTK into nearby walls.
 */
export function computeKnockbackTarget(
  startX: number,
  startZ: number,
  dirX: number,
  dirZ: number,
  maxDistance: number,
  maze: number[][],
  cellSize: number,
  offset: number
): { x: number; z: number; hitWall: boolean; traveled: number } {
  const len = Math.hypot(dirX, dirZ);
  if (len < 0.0001) {
    return { x: startX, z: startZ, hitWall: false, traveled: 0 };
  }
  const nx = dirX / len;
  const nz = dirZ / len;
  const stepSize = 0.25;
  const steps = Math.max(1, Math.floor(maxDistance / stepSize));
  const rows = maze.length;
  const cols = maze[0]?.length ?? 0;

  let safeX = startX;
  let safeZ = startZ;
  let traveled = 0;

  for (let i = 1; i <= steps; i++) {
    const d = Math.min(maxDistance, i * stepSize);
    const cx = startX + nx * d;
    const cz = startZ + nz * d;
    // Check slightly padded radius around teacher torso (0.45m) so he stops flush against the wall
    const probeX = startX + nx * (d + 0.45);
    const probeZ = startZ + nz * (d + 0.45);
    const col = Math.round(probeX / cellSize + offset);
    const row = Math.round(probeZ / cellSize + offset);

    if (row < 0 || row >= rows || col < 0 || col >= cols || maze[row][col] === 1) {
      return { x: safeX, z: safeZ, hitWall: true, traveled };
    }
    safeX = cx;
    safeZ = cz;
    traveled = d;
  }

  return { x: safeX, z: safeZ, hitWall: false, traveled };
}

/**
 * Resolves 2D circle-vs-AABB maze wall collisions so entities & allies never clip through walls.
 */
export function resolveEntityWallCollisions(
  pos: { x: number; z: number },
  radius: number,
  maze: number[][],
  cellSize: number,
  offset: number
): void {
  const rows = maze.length;
  const cols = maze[0]?.length ?? 0;
  if (rows === 0 || cols === 0) return;

  const half = cellSize / 2;

  for (let pass = 0; pass < 2; pass++) {
    const centerC = Math.round(pos.x / cellSize + offset);
    const centerR = Math.round(pos.z / cellSize + offset);

    for (let r = centerR - 1; r <= centerR + 1; r++) {
      for (let c = centerC - 1; c <= centerC + 1; c++) {
        if (r < 0 || r >= rows || c < 0 || c >= cols || maze[r][c] !== 1) continue;

        const wx = (c - offset) * cellSize;
        const wz = (r - offset) * cellSize;
        const minX = wx - half;
        const maxX = wx + half;
        const minZ = wz - half;
        const maxZ = wz + half;

        const closestX = Math.max(minX, Math.min(pos.x, maxX));
        const closestZ = Math.max(minZ, Math.min(pos.z, maxZ));
        const dx = pos.x - closestX;
        const dz = pos.z - closestZ;
        const distSq = dx * dx + dz * dz;

        if (distSq < radius * radius) {
          if (distSq > 1e-8) {
            const dist = Math.sqrt(distSq);
            const push = radius - dist;
            pos.x += (dx / dist) * push;
            pos.z += (dz / dist) * push;
          } else {
            // Inside wall box center fallback: push out along shallowest axis
            const penLeft = Math.abs(pos.x - minX);
            const penRight = Math.abs(maxX - pos.x);
            const penTop = Math.abs(pos.z - minZ);
            const penBottom = Math.abs(maxZ - pos.z);
            const minPen = Math.min(penLeft, penRight, penTop, penBottom);
            if (minPen === penLeft) pos.x = minX - radius;
            else if (minPen === penRight) pos.x = maxX + radius;
            else if (minPen === penTop) pos.z = minZ - radius;
            else pos.z = maxZ + radius;
          }
        }
      }
    }
  }
}

/**
 * 1. CREEPY MATH TEACHER (Guru Matematika)
 * Wears glasses with glowing eerie eyes + holds a long wooden ruler
 */
export function createMathTeacherMesh(): {
  group: THREE.Group;
  parts: EnemyState['parts'];
} {
  const group = new THREE.Group();
  group.add(createContactShadow(0.65));

  const coatMat = new THREE.MeshStandardMaterial({ color: 0x2c2723, roughness: 0.85 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x16161a, roughness: 0.9 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.7 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x7a1c1c, roughness: 0.55 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xbda892, roughness: 0.7 });
  const glassFrameMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.25 });
  // Glowing red-orange eyes (MeshBasicMaterial = luminous without extra GPU lights!)
  const glowEyeMat = new THREE.MeshBasicMaterial({ color: 0xff2b2b });
  const woodRulerMat = new THREE.MeshStandardMaterial({ color: 0xc89342, roughness: 0.45 });
  const rulerTickMat = new THREE.MeshStandardMaterial({ color: 0x261a08, roughness: 0.8 });

  // Legs (pivot at hip y = 0.92)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, 0.92, 0);
  const legGeo = new THREE.BoxGeometry(0.18, 0.9, 0.18);
  const llMesh = new THREE.Mesh(legGeo, pantsMat);
  llMesh.position.y = -0.45;
  leftLeg.add(llMesh);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, 0.92, 0);
  const rlMesh = new THREE.Mesh(legGeo, pantsMat);
  rlMesh.position.y = -0.45;
  rightLeg.add(rlMesh);
  group.add(rightLeg);

  // Gaunt Tall Torso
  const body = new THREE.Group();
  body.position.set(0, 1.35, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.86, 0.3), coatMat);
  body.add(torso);

  // Place white shirt V-front & red tie ONLY on the front (-Z, matching head/glasses direction)
  const shirtV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 0.03), shirtMat);
  shirtV.position.set(0, 0.18, -0.145);
  body.add(shirtV);

  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.42, 0.025), tieMat);
  tie.position.set(0, 0.14, -0.158);
  body.add(tie);
  group.add(body);

  // Left Arm
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.34, 1.72, 0);
  const armGeo = new THREE.BoxGeometry(0.14, 0.72, 0.14);
  const laMesh = new THREE.Mesh(armGeo, coatMat);
  laMesh.position.y = -0.32;
  leftArm.add(laMesh);
  group.add(leftArm);

  // Right Arm + LONG WOODEN RULER (Penggaris Kayu Panjang)
  const rightArm = new THREE.Group();
  rightArm.position.set(0.34, 1.72, 0);
  const raMesh = new THREE.Mesh(armGeo, coatMat);
  raMesh.position.y = -0.32;
  rightArm.add(raMesh);

  // Wooden Ruler held forward menacingly
  const rulerGroup = new THREE.Group();
  rulerGroup.position.set(0.02, -0.62, -0.48);
  const rulerStick = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 1.25), woodRulerMat);
  rulerGroup.add(rulerStick);
  const rulerEdge = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.025, 1.22), rulerTickMat);
  rulerEdge.position.y = 0.04;
  rulerGroup.add(rulerEdge);
  rightArm.add(rulerGroup);
  group.add(rightArm);

  // Creepy Stern Head + Glasses + Glowing Eyes
  const head = new THREE.Group();
  head.position.set(0, 1.98, 0);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.44, 0.36), skinMat);
  head.add(skull);

  // Hair fringe (stern slick teacher hair)
  const hair = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.12, 0.38),
    new THREE.MeshStandardMaterial({ color: 0x2b2927, roughness: 0.9 })
  );
  hair.position.set(0, 0.2, 0);
  head.add(hair);

  // Glasses Frames
  const lensFrameGeo = new THREE.BoxGeometry(0.13, 0.1, 0.03);
  const leftLens = new THREE.Mesh(lensFrameGeo, glassFrameMat);
  leftLens.position.set(-0.09, 0.04, -0.19);
  head.add(leftLens);

  const rightLens = new THREE.Mesh(lensFrameGeo, glassFrameMat);
  rightLens.position.set(0.09, 0.04, -0.19);
  head.add(rightLens);

  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.025, 0.03), glassFrameMat);
  bridge.position.set(0, 0.05, -0.19);
  head.add(bridge);

  // Glowing Piercing Red Eyes behind glasses
  const eyeGeo = new THREE.SphereGeometry(0.035, 10, 10);
  const leftEye = new THREE.Mesh(eyeGeo, glowEyeMat);
  leftEye.position.set(-0.09, 0.04, -0.205);
  head.add(leftEye);

  const rightEye = new THREE.Mesh(eyeGeo, glowEyeMat);
  rightEye.position.set(0.09, 0.04, -0.205);
  head.add(rightEye);

  group.add(head);

  return {
    group,
    parts: { leftLeg, rightLeg, leftArm, rightArm, body, head },
  };
}

/**
 * 2. CHUBBY ENTITY (Orang Gendut Kemeja Biru Celana Hitam)
 * Crisp Minecraft-style blocky chunky silhouette, blue shirt, black pants, becomes friendly when answered!
 */
export function createChubbyEntityMesh(): {
  group: THREE.Group;
  parts: EnemyState['parts'];
  pacifiedHalo: THREE.Mesh;
} {
  const group = new THREE.Group();
  group.add(createContactShadow(0.85));

  const blueShirtMat = new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.72 });
  const darkBlueTrimMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.78 });
  const collarMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 });
  const blackPantsMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.85 });
  const buckleMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.8 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe6b89c, roughness: 0.75 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1f1916, roughness: 0.9 });

  // Sturdy Blocky Legs in Black Pants (pivot at hip y = 0.74)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.20, 0.74, 0);
  const legBoxGeo = new THREE.BoxGeometry(0.26, 0.64, 0.26);
  const ll = new THREE.Mesh(legBoxGeo, blackPantsMat);
  ll.position.y = -0.32;
  leftLeg.add(ll);
  const lShoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.12, 0.33),
    new THREE.MeshStandardMaterial({ color: 0x090a0d, roughness: 0.8 })
  );
  lShoe.position.set(0, -0.68, -0.035);
  leftLeg.add(lShoe);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.20, 0.74, 0);
  const rl = new THREE.Mesh(legBoxGeo, blackPantsMat);
  rl.position.y = -0.32;
  rightLeg.add(rl);
  const rShoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.27, 0.12, 0.33),
    new THREE.MeshStandardMaterial({ color: 0x090a0d, roughness: 0.8 })
  );
  rShoe.position.set(0, -0.68, -0.035);
  rightLeg.add(rShoe);
  group.add(rightLeg);

  // Stocky Wide Blocky Torso & Blue Collared Shirt (centered at y = 1.16)
  const body = new THREE.Group();
  body.position.set(0, 1.16, 0);

  const torsoBox = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.84, 0.44), blueShirtMat);
  body.add(torsoBox);

  // Blocky plump front belly block on -Z so he still looks chubby in Minecraft style
  const bellyBlock = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.52, 0.10), blueShirtMat);
  bellyBlock.position.set(0, -0.10, -0.25);
  body.add(bellyBlock);

  // Shirt Collar & Front Placket Buttons on -Z
  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.34), collarMat);
  collar.position.set(0, 0.43, -0.02);
  body.add(collar);

  const placket = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.72, 0.02), darkBlueTrimMat);
  placket.position.set(0, 0.04, -0.295);
  body.add(placket);

  for (let b = 0; b < 3; b++) {
    const btn = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.025), collarMat);
    btn.position.set(0, 0.24 - b * 0.19, -0.305);
    body.add(btn);
  }

  // Black Belt Waistband + Buckle
  const belt = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.13, 0.46), blackPantsMat);
  belt.position.y = -0.37;
  body.add(belt);

  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.09, 0.04), buckleMat);
  buckle.position.set(0, -0.37, -0.245);
  body.add(buckle);
  group.add(body);

  // Blocky Arms (Blue Shirt Sleeves + Skin Forearms/Hands)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.49, 1.50, 0);
  const lSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.36, 0.20), blueShirtMat);
  lSleeve.position.y = -0.18;
  leftArm.add(lSleeve);
  const lForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.18), skinMat);
  lForearm.position.y = -0.52;
  leftArm.add(lForearm);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.49, 1.50, 0);
  const rSleeve = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.36, 0.20), blueShirtMat);
  rSleeve.position.y = -0.18;
  rightArm.add(rSleeve);
  const rForearm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.32, 0.18), skinMat);
  rForearm.position.y = -0.52;
  rightArm.add(rForearm);
  group.add(rightArm);

  // Blocky Minecraft-Style Head, Hair & Face (pivot at y = 1.84)
  const head = new THREE.Group();
  head.position.set(0, 1.84, 0);
  const cubeHead = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.46, 0.46), skinMat);
  head.add(cubeHead);

  const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.48), hairMat);
  hairTop.position.set(0, 0.21, 0);
  head.add(hairTop);

  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.22, 0.08), hairMat);
  hairBack.position.set(0, 0.07, 0.21);
  head.add(hairBack);

  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

  const lEyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.02), eyeWhiteMat);
  lEyeWhite.position.set(-0.11, 0.03, -0.232);
  head.add(lEyeWhite);
  const lEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.025), pupilMat);
  lEye.position.set(-0.10, 0.03, -0.235);
  head.add(lEye);

  const rEyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.02), eyeWhiteMat);
  rEyeWhite.position.set(0.11, 0.03, -0.232);
  head.add(rEyeWhite);
  const rEye = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.025), pupilMat);
  rEye.position.set(0.10, 0.03, -0.235);
  head.add(rEye);

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.035, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x7c4637, roughness: 0.9 })
  );
  mouth.position.set(0, -0.10, -0.232);
  head.add(mouth);

  // Pacified Friendly Halo (blocky diamond ring above head)
  const pacifiedHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.32, 0.035, 4, 4),
    new THREE.MeshBasicMaterial({ color: 0x42e6bf })
  );
  pacifiedHalo.rotation.x = Math.PI / 2;
  pacifiedHalo.rotation.z = Math.PI / 4;
  pacifiedHalo.position.y = 0.40;
  pacifiedHalo.visible = false;
  head.add(pacifiedHalo);

  group.add(head);

  return {
    group,
    parts: { leftLeg, rightLeg, leftArm, rightArm, body, head },
    pacifiedHalo,
  };
}

/**
 * 3. CEILING-HEIGHT SLENDERMAN (Super Tinggi se-Atap = ~3.95m)
 * Pitch black suit, tendrils, blank white faceless head, blinking teleport pursuit!
 */
export function createSlendermanMesh(): {
  group: THREE.Group;
  parts: EnemyState['parts'];
} {
  const group = new THREE.Group();
  group.add(createContactShadow(0.75));

  const suitMat = new THREE.MeshStandardMaterial({ color: 0x070709, roughness: 0.75 });
  const whiteHeadMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f4, roughness: 0.4 });
  const tieMat = new THREE.MeshStandardMaterial({ color: 0x8f1111, roughness: 0.5 });

  // Ultra-long legs (0 -> 2.1m)
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.15, 2.05, 0);
  const longLegGeo = new THREE.CylinderGeometry(0.075, 0.06, 2.05, 10);
  const ll = new THREE.Mesh(longLegGeo, suitMat);
  ll.position.y = -1.02;
  leftLeg.add(ll);
  group.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.15, 2.05, 0);
  const rl = new THREE.Mesh(longLegGeo, suitMat);
  rl.position.y = -1.02;
  rightLeg.add(rl);
  group.add(rightLeg);

  // Elongated Torso (2.05 -> 3.45m) + Tentacles
  const body = new THREE.Group();
  body.position.set(0, 2.75, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.35, 0.24), suitMat);
  body.add(torso);

  const tie = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.75, 0.025), tieMat);
  tie.position.set(0, 0.22, -0.122);
  body.add(tie);

  // 4 Back Tendrils reaching outward ominously
  const tendrilGeo = new THREE.CylinderGeometry(0.03, 0.015, 1.85, 8);
  const tendrilAngles = [
    { x: -0.2, y: 0.35, rz: 0.55, rx: 0.35 },
    { x: 0.2, y: 0.35, rz: -0.55, rx: 0.35 },
    { x: -0.15, y: 0.1, rz: 0.9, rx: 0.25 },
    { x: 0.15, y: 0.1, rz: -0.9, rx: 0.25 },
  ];
  for (const t of tendrilAngles) {
    const tendril = new THREE.Mesh(tendrilGeo, suitMat);
    tendril.position.set(t.x, t.y + 0.3, 0.25);
    tendril.rotation.set(t.rx, 0, t.rz);
    body.add(tendril);
  }
  group.add(body);

  // Long dangling arms reaching knees
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.32, 3.32, 0);
  const longArmGeo = new THREE.CylinderGeometry(0.055, 0.04, 1.65, 8);
  const la = new THREE.Mesh(longArmGeo, suitMat);
  la.position.y = -0.82;
  leftArm.add(la);
  group.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.32, 3.32, 0);
  const ra = new THREE.Mesh(longArmGeo, suitMat);
  ra.position.y = -0.82;
  rightArm.add(ra);
  group.add(rightArm);

  // Blank White Faceless Head reaching ~3.95m (right near 4.2m ceiling!)
  const head = new THREE.Group();
  head.position.set(0, 3.72, 0);
  const headGeo = new THREE.SphereGeometry(0.24, 14, 14);
  headGeo.scale(0.85, 1.2, 0.9);
  const faceless = new THREE.Mesh(headGeo, whiteHeadMat);
  head.add(faceless);
  group.add(head);

  return {
    group,
    parts: { leftLeg, rightLeg, leftArm, rightArm, body, head },
  };
}

/**
 * 4. HIDING LOCKER MESH (Lemari Persembunyian)
 * Multi-part tall steel/wood locker for escaping the Math Teacher
 */
export function createLockerMesh(): THREE.Group {
  const group = new THREE.Group();
  group.add(createContactShadow(0.85));

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x3a4a44,
    roughness: 0.55,
    metalness: 0.5,
  });
  const doorMat = new THREE.MeshStandardMaterial({
    color: 0x4b5e57,
    roughness: 0.45,
    metalness: 0.55,
  });
  const ventMat = new THREE.MeshStandardMaterial({ color: 0x151a18, roughness: 0.9 });
  const handleMat = new THREE.MeshStandardMaterial({ color: 0xd6c77a, metalness: 0.8, roughness: 0.25 });

  // Outer cabinet
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.4, 0.9), bodyMat);
  cabinet.position.y = 1.2;
  group.add(cabinet);

  // Front double door panel
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.06, 2.22, 0.06), doorMat);
  door.position.set(0, 1.2, 0.46);
  group.add(door);

  // Louver ventilation slots
  for (let i = 0; i < 3; i++) {
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.07, 0.08), ventMat);
    slot.position.set(0, 1.92 - i * 0.14, 0.47);
    group.add(slot);
  }

  // Brass Handle + Subtle Indicator Strip
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.26, 0.08), handleMat);
  handle.position.set(0.36, 1.15, 0.5);
  group.add(handle);

  const signStrip = new THREE.Mesh(
    new THREE.BoxGeometry(0.75, 0.14, 0.05),
    new THREE.MeshBasicMaterial({ color: 0x42e6bf })
  );
  signStrip.position.set(0, 2.28, 0.47);
  group.add(signStrip);

  return group;
}

/**
 * 4b. LOCKER INTERIOR RIG (First-person view from INSIDE a steel safe-locker)
 * Dark brushed steel walls enclosing the camera with narrow horizontal safe/louver viewing slits
 * at eye level (y = 1.44..1.80) so the player peers out into the Backrooms hallway!
 */
export function createLockerInteriorRig(): THREE.Group {
  const group = new THREE.Group();

  const innerSteelMat = new THREE.MeshStandardMaterial({
    color: 0x161c19,
    roughness: 0.55,
    metalness: 0.72,
    side: THREE.DoubleSide,
  });
  const doorSlitMat = new THREE.MeshStandardMaterial({
    color: 0x111513,
    roughness: 0.42,
    metalness: 0.85,
  });
  const brassLatchMat = new THREE.MeshStandardMaterial({
    color: 0xd6c77a,
    roughness: 0.3,
    metalness: 0.85,
  });

  // Back, left, right, roof, floor walls around locker cavity (width 1.16, depth 0.88, height 2.38)
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(1.18, 2.38, 0.04), innerSteelMat);
  backWall.position.set(0, 1.19, -0.43);
  group.add(backWall);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.38, 0.90), innerSteelMat);
  leftWall.position.set(-0.57, 1.19, 0.02);
  group.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.04, 2.38, 0.90), innerSteelMat);
  rightWall.position.set(0.57, 1.19, 0.02);
  group.add(rightWall);

  const topPanel = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.05, 0.90), innerSteelMat);
  topPanel.position.set(0, 2.36, 0.02);
  group.add(topPanel);

  const bottomPanel = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.05, 0.90), innerSteelMat);
  bottomPanel.position.set(0, 0.03, 0.02);
  group.add(bottomPanel);

  // Front Steel Safe Door (at z = +0.44) leaving a narrow horizontal slit window at eye level (1.44..1.80)
  const lowerDoor = new THREE.Mesh(new THREE.BoxGeometry(1.14, 1.40, 0.05), doorSlitMat);
  lowerDoor.position.set(0, 0.74, 0.44);
  group.add(lowerDoor);

  const upperDoor = new THREE.Mesh(new THREE.BoxGeometry(1.14, 0.56, 0.05), doorSlitMat);
  upperDoor.position.set(0, 2.08, 0.44);
  group.add(upperDoor);

  // Left & Right thick safe-door side jambs framing the viewing slits
  const leftJamb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.06), doorSlitMat);
  leftJamb.position.set(-0.46, 1.62, 0.44);
  group.add(leftJamb);

  const rightJamb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.38, 0.06), doorSlitMat);
  rightJamb.position.set(0.46, 1.62, 0.44);
  group.add(rightJamb);

  // 3 Angled Heavy Steel Louver Slats across the eye-level opening -> creates 4 narrow safe viewing slits!
  const slatYs = [1.50, 1.62, 1.74];
  for (let i = 0; i < slatYs.length; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.046, 0.075), doorSlitMat);
    slat.position.set(0, slatYs[i], 0.44);
    slat.rotation.x = 0.24;
    group.add(slat);
  }

  // Interior safe latch & bolt silhouette on right door edge
  const latchPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.04), brassLatchMat);
  latchPlate.position.set(0.40, 1.38, 0.40);
  group.add(latchPlate);

  const boltPin = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.035, 0.04), brassLatchMat);
  boltPin.position.set(0.45, 1.38, 0.39);
  group.add(boltPin);

  // Subtle dim interior light so metallic door frame & latch catch realistic highlights
  const innerLight = new THREE.PointLight(0x6fffea, 0.32, 1.6);
  innerLight.position.set(0, 1.92, 0.08);
  group.add(innerLight);

  group.visible = false;
  return group;
}

/**
 * Updates enemy animation limbs cleanly with zero allocations
 */
export function animateEnemyLimbs(enemy: EnemyState, dt: number, speed: number) {
  if (speed > 0.15) {
    const cycleRate = enemy.kind === 'TEACHER' ? 4.2 : enemy.kind === 'CHUBBY' ? 2.6 : 1.8;
    enemy.walkPhase += speed * dt * cycleRate;
    const swing = Math.sin(enemy.walkPhase) * (enemy.kind === 'CHUBBY' ? 0.45 : 0.65);

    enemy.parts.leftLeg.rotation.x = swing;
    enemy.parts.rightLeg.rotation.x = -swing;
    enemy.parts.leftArm.rotation.x = -swing * 0.7;

    if (enemy.kind === 'TEACHER') {
      // Teacher raises ruler arm forward when chasing!
      enemy.parts.rightArm.rotation.x =
        enemy.mode === 'CHASE' ? 0.55 + Math.sin(enemy.walkPhase * 1.4) * 0.35 : swing * 0.5;
    } else {
      enemy.parts.rightArm.rotation.x = swing * 0.7;
    }

    if (enemy.kind === 'CHUBBY') {
      // Jolly/comical side-to-side waddle
      enemy.parts.body.rotation.z = Math.sin(enemy.walkPhase) * 0.08;
    }
  } else {
    enemy.parts.leftLeg.rotation.x *= 0.85;
    enemy.parts.rightLeg.rotation.x *= 0.85;
    enemy.parts.leftArm.rotation.x *= 0.85;
    enemy.parts.rightArm.rotation.x *= 0.85;
  }
}

/**
 * 5. MYSTIC STAFF KEY (Tongkat Kunci Ghaib)
 * Found in Slenderman's Space Dimension, used inside Backrooms to fight Guru Matematika
 */
export function createMysticStaffMesh(scale: number = 1.0): THREE.Group {
  const staff = new THREE.Group();

  const shaftMat = new THREE.MeshStandardMaterial({
    color: 0x3b2314,
    roughness: 0.45,
    metalness: 0.3,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.25,
    metalness: 0.85,
  });
  const orbMat = new THREE.MeshBasicMaterial({ color: 0xc084fc });
  const keyRingMat = new THREE.MeshBasicMaterial({ color: 0x6fffea });

  // Ornate wooden-obsidian shaft
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.032, 1.55, 10),
    shaftMat
  );
  shaft.position.y = 0.78;
  staff.add(shaft);

  // Golden collar ring + key teeth guard at top
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.025, 8, 16), goldMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.52;
  staff.add(collar);

  const keyBlade1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.045, 0.04), goldMat);
  keyBlade1.position.set(0.11, 1.44, 0);
  staff.add(keyBlade1);

  const keyBlade2 = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.04, 0.04), goldMat);
  keyBlade2.position.set(0.08, 1.34, 0);
  staff.add(keyBlade2);

  // Luminous violet crystal orb & orbiting cyan halo
  const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.16, 1), orbMat);
  orb.position.y = 1.68;
  staff.add(orb);

  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.02, 8, 20), keyRingMat);
  halo.position.y = 1.68;
  halo.rotation.x = 0.5;
  staff.add(halo);

  staff.scale.setScalar(scale);
  return staff;
}

export interface SpaceDimensionObjects {
  scene: THREE.Scene;
  staffMesh: THREE.Group;
  staffPosition: THREE.Vector3;
  portalMesh: THREE.Group;
  portalPosition: THREE.Vector3;
  blackHoleGroup: THREE.Group;
  slenderGroup: THREE.Group;
  slenderParts: EnemyState['parts'];
  arenaRadius: number;
  resetSpaceTrial: () => { playerStartX: number; playerStartZ: number };
  updateSpace: (dt: number, hasStaff: boolean, portalOpen?: boolean) => void;
  updateBlackHole: (dt: number, scaleFactor: number) => void;
  dispose: () => void;
}

/**
 * 6. SLENDERMAN'S SPACE DIMENSION (Dunia Angkasa)
 * Deep starry cosmos with floating cosmic arena, glowing Tongkat Kunci Ghaib, boss combat & Black Hole banish
 */
export function buildSpaceDimension(): SpaceDimensionObjects {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x03020a);
  scene.fog = new THREE.FogExp2(0x050312, 0.012);

  const arenaRadius = SPACE_ARENA_RADIUS;

  // Ambient cosmic light
  const hemi = new THREE.HemisphereLight(0xa855f7, 0x0f172a, 1.15);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xe9d5ff, 1.0);
  keyLight.position.set(16, 26, 14);
  scene.add(keyLight);

  // 1100 Starfield points surrounding enlarged cosmos
  const starCount = 1100;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const r = 52 + Math.random() * 65;
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.cos(phi);
    starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xf8fafc, size: 0.48 });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  // Distant ringed cosmic planet landmark
  const planetGroup = new THREE.Group();
  planetGroup.position.set(-40, 24, -62);
  const planet = new THREE.Mesh(
    new THREE.SphereGeometry(9.5, 20, 16),
    new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.8 })
  );
  planetGroup.add(planet);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(12.0, 17.0, 32),
    new THREE.MeshBasicMaterial({ color: 0x8b5cf6, side: THREE.DoubleSide, transparent: true, opacity: 0.45 })
  );
  ring.rotation.set(1.15, 0.3, 0);
  planetGroup.add(ring);
  scene.add(planetGroup);

  // Walkable Enlarged Dark Cosmic Platform with glowing perimeter grid
  const platformGeo = new THREE.CylinderGeometry(arenaRadius, arenaRadius - 0.8, 0.9, 44);
  const platformMat = new THREE.MeshStandardMaterial({
    color: 0x0f0e1c,
    roughness: 0.65,
    metalness: 0.35,
  });
  const platform = new THREE.Mesh(platformGeo, platformMat);
  platform.position.y = -0.45;
  scene.add(platform);

  const ringBorder = new THREE.Mesh(
    new THREE.TorusGeometry(arenaRadius, 0.18, 8, 60),
    new THREE.MeshBasicMaterial({ color: 0x7c3aed })
  );
  ringBorder.rotation.x = Math.PI / 2;
  ringBorder.position.y = 0.03;
  scene.add(ringBorder);

  const gridHelper = new THREE.GridHelper(arenaRadius * 1.85, 28, 0x6d28d9, 0x1e1b4b);
  gridHelper.position.y = 0.02;
  scene.add(gridHelper);

  // Floating Crystal Pillars around outer edge as cosmic landmarks
  const crystalMat = new THREE.MeshStandardMaterial({
    color: 0x5b21b6,
    emissive: 0x3b0764,
    roughness: 0.3,
    metalness: 0.5,
  });
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const pillar = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), crystalMat);
    pillar.scale.set(1, 3.2, 1);
    pillar.position.set(
      Math.cos(angle) * (arenaRadius + 4.5),
      1.8 + (i % 2) * 1.6,
      Math.sin(angle) * (arenaRadius + 4.5)
    );
    scene.add(pillar);
  }

  // Tongkat Kunci Ghaib collectible
  const staffPosition = new THREE.Vector3(0, 0, -18);
  const staffMesh = createMysticStaffMesh(1.45);
  staffMesh.position.set(staffPosition.x, 0.35, staffPosition.z);
  scene.add(staffMesh);

  // Procedural Backrooms Hallway Image Texture for the Return Portal ("gambar backroom")
  function createBackroomsPortalTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Deep yellow Backrooms atmospheric background
    const bgGrad = ctx.createRadialGradient(256, 256, 20, 256, 256, 280);
    bgGrad.addColorStop(0, '#463f20');
    bgGrad.addColorStop(0.55, '#8c7e42');
    bgGrad.addColorStop(1, '#584e26');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 512, 512);

    // Ceiling perspective (top trapezoid)
    ctx.fillStyle = '#a49964';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(512, 0);
    ctx.lineTo(356, 178);
    ctx.lineTo(156, 178);
    ctx.closePath();
    ctx.fill();

    // Ceiling grid lines + fluorescent troffer lights
    ctx.strokeStyle = 'rgba(65, 58, 34, 0.55)';
    ctx.lineWidth = 2;
    for (let i = 1; i <= 4; i++) {
      const t = i / 5;
      const y = t * 178;
      const lx = t * 156;
      const rx = 512 - t * 156;
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(rx, y);
      ctx.stroke();
    }
    // Glowing fluorescent ceiling fixtures receding into corridor
    const lightLevels = [0.22, 0.52, 0.78];
    for (const t of lightLevels) {
      const y = t * 170;
      const w = THREE.MathUtils.lerp(130, 44, t);
      const h = THREE.MathUtils.lerp(24, 9, t);
      ctx.fillStyle = '#fff9d6';
      ctx.fillRect(256 - w / 2, y, w, h);
    }

    // Damp Backrooms carpet floor perspective (bottom trapezoid)
    const floorGrad = ctx.createLinearGradient(0, 334, 0, 512);
    floorGrad.addColorStop(0, '#5a4e26');
    floorGrad.addColorStop(1, '#7c6c38');
    ctx.fillStyle = floorGrad;
    ctx.beginPath();
    ctx.moveTo(156, 334);
    ctx.lineTo(356, 334);
    ctx.lineTo(512, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();

    // Left yellow wallpaper wall
    ctx.fillStyle = '#c5b46b';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(156, 178);
    ctx.lineTo(156, 334);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();

    // Right yellow wallpaper wall
    ctx.fillStyle = '#b1a059';
    ctx.beginPath();
    ctx.moveTo(512, 0);
    ctx.lineTo(356, 178);
    ctx.lineTo(356, 334);
    ctx.lineTo(512, 512);
    ctx.closePath();
    ctx.fill();

    // Vertical wallpaper stripes on left & right walls
    ctx.fillStyle = 'rgba(130, 114, 52, 0.34)';
    for (let s = 0; s < 5; s++) {
      const f = (s + 0.5) / 5;
      const lx = f * 156;
      const lyTop = f * 178;
      const lyBot = 512 - f * 178;
      ctx.fillRect(lx, lyTop, 6 * (1 - f * 0.5), lyBot - lyTop);
      const rx = 512 - lx;
      ctx.fillRect(rx - 6 * (1 - f * 0.5), lyTop, 6 * (1 - f * 0.5), lyBot - lyTop);
    }

    // Center far corridor wall + dark turn
    ctx.fillStyle = '#8b7b3e';
    ctx.fillRect(156, 178, 200, 156);
    ctx.fillStyle = '#2d2612';
    ctx.fillRect(216, 186, 76, 144);
    // Dark wooden baseboards
    ctx.fillStyle = '#261e14';
    ctx.fillRect(156, 324, 200, 10);

    // Subtle cyan/purple portal rim glow vignette
    const rim = ctx.createRadialGradient(256, 256, 150, 256, 256, 256);
    rim.addColorStop(0, 'rgba(111, 255, 234, 0)');
    rim.addColorStop(0.82, 'rgba(111, 255, 234, 0.22)');
    rim.addColorStop(1, 'rgba(168, 85, 247, 0.72)');
    ctx.fillStyle = rim;
    ctx.fillRect(0, 0, 512, 512);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const backroomsPortalTex = createBackroomsPortalTexture();

  // Backrooms Return Portal (Opens after Slenderman is defeated & sucked into Black Hole)
  const portalPosition = new THREE.Vector3(0, 0, 0);
  const portalMesh = new THREE.Group();

  const portalDisc = new THREE.Mesh(
    new THREE.CircleGeometry(1.92, 40),
    new THREE.MeshBasicMaterial({ map: backroomsPortalTex, side: THREE.DoubleSide })
  );
  portalMesh.add(portalDisc);

  const portalOuterRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.08, 0.14, 14, 48),
    new THREE.MeshBasicMaterial({ color: 0x6fffea })
  );
  portalMesh.add(portalOuterRing);

  const portalInnerRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.36, 0.08, 10, 44),
    new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.85 })
  );
  portalMesh.add(portalInnerRing);

  const portalRunes: THREE.Mesh[] = [];
  const runeGeo = new THREE.OctahedronGeometry(0.16, 0);
  const runeMat = new THREE.MeshBasicMaterial({ color: 0x6fffea });
  for (let i = 0; i < 8; i++) {
    const rune = new THREE.Mesh(runeGeo, runeMat);
    const a = (i / 8) * Math.PI * 2;
    rune.position.set(Math.cos(a) * 2.38, Math.sin(a) * 2.38, 0);
    portalMesh.add(rune);
    portalRunes.push(rune);
  }

  const portalGlow = new THREE.PointLight(0x6fffea, 2.6, 14);
  portalGlow.position.set(0, 0, 0.8);
  portalMesh.add(portalGlow);

  portalMesh.position.set(0, 2.3, 0);
  portalMesh.visible = false;
  scene.add(portalMesh);

  // Dramatic 3D Black Hole Vortex for Slenderman's 10-hit defeat animation
  const blackHoleGroup = new THREE.Group();
  const bhCore = new THREE.Mesh(
    new THREE.SphereGeometry(1.25, 22, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000 })
  );
  blackHoleGroup.add(bhCore);

  const bhInnerDisk = new THREE.Mesh(
    new THREE.TorusGeometry(1.75, 0.14, 12, 36),
    new THREE.MeshBasicMaterial({ color: 0xa855f7 })
  );
  blackHoleGroup.add(bhInnerDisk);

  const bhOuterDisk = new THREE.Mesh(
    new THREE.TorusGeometry(2.65, 0.09, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0x6fffea, transparent: true, opacity: 0.78 })
  );
  bhOuterDisk.rotation.x = 0.25;
  blackHoleGroup.add(bhOuterDisk);

  const bhAura = new THREE.Mesh(
    new THREE.RingGeometry(1.3, 3.3, 32),
    new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.45,
    })
  );
  blackHoleGroup.add(bhAura);

  const bhShards: THREE.Mesh[] = [];
  const shardGeo = new THREE.OctahedronGeometry(0.14, 0);
  const shardMatA = new THREE.MeshBasicMaterial({ color: 0xc084fc });
  const shardMatB = new THREE.MeshBasicMaterial({ color: 0x6fffea });
  for (let i = 0; i < 14; i++) {
    const sh = new THREE.Mesh(shardGeo, i % 2 === 0 ? shardMatA : shardMatB);
    const a = (i / 14) * Math.PI * 2;
    const rad = 1.9 + (i % 3) * 0.55;
    sh.position.set(Math.cos(a) * rad, Math.sin(a) * rad, ((i % 3) - 1) * 0.25);
    blackHoleGroup.add(sh);
    bhShards.push(sh);
  }

  blackHoleGroup.visible = false;
  scene.add(blackHoleGroup);

  // Slenderman stalking inside enlarged Space Dimension
  const slenderModel = createSlendermanMesh();
  scene.add(slenderModel.group);

  function resetSpaceTrial() {
    const angle = (Math.random() < 0.5 ? 1 : -1) * (0.5 + Math.random() * 1.35);
    const r = 16.5 + Math.random() * 5.0;
    staffPosition.set(Math.sin(angle) * r, 0, -Math.abs(Math.cos(angle)) * r);
    staffMesh.position.set(staffPosition.x, 0.4, staffPosition.z);
    staffMesh.visible = true;

    portalPosition.set(-staffPosition.x * 0.65, 0, 20.5);
    portalMesh.visible = false;
    blackHoleGroup.visible = false;
    blackHoleGroup.scale.setScalar(1);

    slenderModel.group.position.set(0, 0, -23.0);
    slenderModel.group.rotation.set(0, 0, 0);
    slenderModel.group.scale.set(1, 1, 1);
    slenderModel.group.visible = true;

    return { playerStartX: 0, playerStartZ: 21.5 };
  }

  let acc = 0;
  function updateSpace(dt: number, hasStaff: boolean, portalOpen: boolean = false) {
    acc += dt;
    stars.rotation.y += 0.012 * dt;
    planet.rotation.y += 0.04 * dt;

    if (!hasStaff) {
      staffMesh.rotation.y += 2.2 * dt;
      staffMesh.position.y = 0.45 + Math.sin(acc * 3.0) * 0.2;
    }

    portalMesh.visible = portalOpen;
    if (portalOpen) {
      portalMesh.position.y = 2.3 + Math.sin(acc * 2.4) * 0.14;
      portalInnerRing.rotation.z += 1.6 * dt;
      portalOuterRing.rotation.z -= 1.1 * dt;
      for (let i = 0; i < portalRunes.length; i++) {
        const a = acc * 1.4 + (i / portalRunes.length) * Math.PI * 2;
        portalRunes[i].position.set(Math.cos(a) * 2.38, Math.sin(a) * 2.38, Math.sin(acc * 4 + i) * 0.1);
        portalRunes[i].rotation.y += 3.0 * dt;
      }
    }
  }

  function updateBlackHole(dt: number, scaleFactor: number) {
    acc += dt;
    blackHoleGroup.scale.setScalar(Math.max(0.01, scaleFactor));
    bhInnerDisk.rotation.z += 5.2 * dt;
    bhOuterDisk.rotation.z -= 3.8 * dt;
    bhOuterDisk.rotation.x = 0.25 + Math.sin(acc * 4) * 0.15;
    bhAura.rotation.z += 2.5 * dt;
    for (let i = 0; i < bhShards.length; i++) {
      const a = acc * (3.2 + (i % 3)) + (i / bhShards.length) * Math.PI * 2;
      const rad = 1.65 + (i % 3) * 0.45 * (0.65 + 0.35 * Math.sin(acc * 4 + i));
      bhShards[i].position.set(Math.cos(a) * rad, Math.sin(a) * rad, Math.sin(acc * 6 + i) * 0.3);
      bhShards[i].rotation.x += 4 * dt;
    }
  }

  function dispose() {
    starGeo.dispose();
    starMat.dispose();
    platformGeo.dispose();
    platformMat.dispose();
    shardGeo.dispose();
    runeGeo.dispose();
    backroomsPortalTex.dispose();
  }

  return {
    scene,
    staffMesh,
    staffPosition,
    portalMesh,
    portalPosition,
    blackHoleGroup,
    slenderGroup: slenderModel.group,
    slenderParts: slenderModel.parts,
    arenaRadius,
    resetSpaceTrial,
    updateSpace,
    updateBlackHole,
    dispose,
  };
}
