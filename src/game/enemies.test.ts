import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeKnockbackTarget,
  findNextMazeStep,
  hasGridLineOfSight,
  resolveEntityWallCollisions,
  TEACHER_ZAP_STUN_SECONDS,
  worldToGrid,
} from './enemies';

const SAMPLE_MAZE = [
  [1, 1, 1, 1, 1],
  [1, 0, 0, 0, 1],
  [1, 0, 1, 0, 1],
  [1, 0, 0, 0, 1],
  [1, 1, 1, 1, 1],
];

test('hasGridLineOfSight detects clear corridors vs blocking walls', () => {
  const cellSize = 4;
  const offset = 2; // (5-1)/2
  // Row 1 open from col 1 to col 3
  const x1 = (1 - offset) * cellSize;
  const z1 = (1 - offset) * cellSize;
  const x2 = (3 - offset) * cellSize;
  const z2 = (1 - offset) * cellSize;
  assert.equal(hasGridLineOfSight(x1, z1, x2, z2, SAMPLE_MAZE, cellSize, offset), true);

  // Diagonal from (1,1) to (3,3) cuts through center wall at (2,2)
  const x3 = (3 - offset) * cellSize;
  const z3 = (3 - offset) * cellSize;
  assert.equal(hasGridLineOfSight(x1, z1, x3, z3, SAMPLE_MAZE, cellSize, offset), false);
});

test('findNextMazeStep routes around walls to reach target cell', () => {
  const step = findNextMazeStep(1, 1, 3, 3, SAMPLE_MAZE);
  // Immediate step from (1,1) must be open neighbor (1,2) or (2,1)
  assert.equal(SAMPLE_MAZE[step.r][step.c], 0);
  const manhattan = Math.abs(step.r - 1) + Math.abs(step.c - 1);
  assert.equal(manhattan, 1);
});

test('worldToGrid clamps coordinates safely inside maze bounds', () => {
  const g = worldToGrid(-999, 999, 5, 4, 2);
  assert.deepEqual(g, { r: 4, c: 0 });
});

test('Teacher chase speed is nerfed to 75% of player sprint speed & Slenderman distances match spec', async () => {
  const mod = await import('./enemies');
  assert.equal(mod.TEACHER_CHASE_SPEED, mod.PLAYER_SPRINT_SPEED * 0.75);
  assert.ok(mod.TEACHER_CHASE_SPEED > mod.PLAYER_WALK_SPEED);
  assert.ok(mod.TEACHER_CHASE_SPEED < mod.PLAYER_SPRINT_SPEED);
  assert.equal(mod.SLENDER_SPRINT_LOCK_DIST, 2.0);
  assert.ok(mod.SLENDER_SPACE_CAPTURE_DIST <= 0.6);
  assert.ok(mod.SPACE_ARENA_RADIUS >= 28.0);
  assert.equal(mod.SLENDER_CREEP_SPEED, 0.7);
  assert.equal(mod.SLENDER_SPACE_CREEP_SPEED, 1.21);
  assert.equal(mod.SLENDER_SPACE_BLINK_HOP, 0.64);
  assert.equal(mod.SLENDER_SPACE_BLINK_INTERVAL, 2.0);
  assert.equal(mod.SLENDER_SPACE_MAX_HP, 10);
  assert.ok(mod.SLENDER_SPACE_CREEP_SPEED < mod.PLAYER_WALK_SPEED);
  assert.equal(TEACHER_ZAP_STUN_SECONDS, 20);
});

test('computeKnockbackTarget stops before walls when slamming Guru MTK backward', () => {
  const cellSize = 4;
  const offset = 2;
  // Open hallway along row 1 from c=1 (x=-4, z=-4) pushing +X up to 6m (stops cleanly in open space)
  const openRes = computeKnockbackTarget(-4, -4, 1, 0, 6.0, SAMPLE_MAZE, cellSize, offset);
  assert.equal(openRes.hitWall, false);
  assert.ok(openRes.traveled >= 5.5);
  assert.ok(openRes.x > 1.5);

  // Pushing -X from x=-4, z=-4 hits the left wall at c=0 (x=-8) early!
  const wallRes = computeKnockbackTarget(-4, -4, -1, 0, 7.5, SAMPLE_MAZE, cellSize, offset);
  assert.equal(wallRes.hitWall, true);
  assert.ok(wallRes.x > -6.0 && wallRes.traveled < 3.0);
});

test('resolveEntityWallCollisions pushes intersecting entities safely out of maze walls', () => {
  const cellSize = 4;
  const offset = 2;
  // Center wall sits at (r=2, c=2) -> x=0, z=0, extent [-2, +2] x [-2, +2]
  const pos = { x: 1.85, z: -3.2 };
  // Push diagonally near corner/edge overlapping center wall at (2, 2) or top wall (r=0)
  pos.x = 1.85;
  pos.z = 0.0;
  resolveEntityWallCollisions(pos, 0.5, SAMPLE_MAZE, cellSize, offset);
  // Wall center=(0,0), maxX=2.0 -> entity radius 0.5 must be pushed cleanly to x >= 2.5
  assert.ok(pos.x >= 2.49, `expected x >= 2.49, got ${pos.x}`);
});

test('createLockerInteriorRig encloses cavity behind front door with eye-level safe viewing slits', async () => {
  const { createLockerInteriorRig } = await import('./enemies');
  const rig = createLockerInteriorRig();
  assert.equal(rig.visible, false);
  // 5 cavity panels + lowerDoor + upperDoor + 2 jambs + 3 louver slats + 2 brass latch parts + 1 point light = 15 children
  assert.equal(rig.children.length, 15);
  // Check the 3 louver slats sit at eye height (y = 1.50, 1.62, 1.74) at door plane z = 0.44
  const slats = rig.children.filter((c) => Math.abs(c.position.z - 0.44) < 0.01 && Math.abs(c.rotation.x - 0.24) < 0.01);
  assert.equal(slats.length, 3);
});

