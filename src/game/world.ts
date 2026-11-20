import * as THREE from 'three';
import { LockerSpot, createLockerMesh, gridToWorld } from './enemies';

export interface WallBox {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
  halfSize: number;
}

export interface WorldObjects {
  scene: THREE.Scene;
  maze: number[][];
  mazeSize: number;
  cellSize: number;
  offset: number;
  walls: WallBox[];
  lockers: LockerSpot[];
  terminalGroup: THREE.Group;
  terminalPosition: THREE.Vector3;
  exitDoorGroup: THREE.Group;
  exitDoorMesh: THREE.Mesh;
  exitPosition: THREE.Vector3;
  lights: THREE.PointLight[];
  dustParticles: THREE.Points;
  openExitDoor: () => void;
  rebuildMaze: () => number[][];
  update: (dt: number, playerPos?: THREE.Vector3) => void;
  dispose: () => void;
}

export function generateMaze(size: number = 19): number[][] {
  const map: number[][] = Array.from({ length: size }, () => Array(size).fill(1));
  const innerSize = Math.floor((size - 1) / 2);
  const visited: boolean[][] = Array.from({ length: innerSize }, () =>
    Array(innerSize).fill(false)
  );

  function carve(r: number, c: number) {
    visited[r][c] = true;
    map[1 + r * 2][1 + c * 2] = 0;
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ].sort(() => Math.random() - 0.5);

    for (const [dr, dc] of dirs) {
      const nr = r + dr;
      const nc = c + dc;
      if (
        nr >= 0 &&
        nr < innerSize &&
        nc >= 0 &&
        nc < innerSize &&
        !visited[nr][nc]
      ) {
        map[1 + (r + nr)][1 + (c + nc)] = 0;
        carve(nr, nc);
      }
    }
  }

  carve(0, 0);

  // Extra loops for smoother gameplay navigation
  for (let i = 0; i < 16; i++) {
    const rx = 1 + Math.floor(Math.random() * (size - 2));
    const rz = 1 + Math.floor(Math.random() * (size - 2));
    if (map[rz][rx] === 1) {
      let openNeighbors = 0;
      if (map[rz - 1]?.[rx] === 0) openNeighbors++;
      if (map[rz + 1]?.[rx] === 0) openNeighbors++;
      if (map[rz]?.[rx - 1] === 0) openNeighbors++;
      if (map[rz]?.[rx + 1] === 0) openNeighbors++;
      if (openNeighbors >= 2) {
        map[rz][rx] = 0;
      }
    }
  }

  // Ensure spacious open start room (1,1)-(2,2) so player & chase camera never clip walls
  map[1][1] = 0;
  map[1][2] = 0;
  map[1][3] = 0;
  map[2][1] = 0;
  map[2][2] = 0;
  map[2][3] = 0;

  // Terminal room in bottom-right corner
  const endR = size - 3;
  const endC = size - 3;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (endR + dr < size - 1 && endC + dc < size - 1) {
        map[endR + dr][endC + dc] = 0;
      }
    }
  }

  // Exit corridor and gate
  map[size - 2][size - 2] = 0;
  map[size - 2][size - 3] = 0;

  return map;
}

/**
 * Creates High-Definition 1024x1024 procedural textures with bump & roughness maps
 */
function createHDProceduralTextures(maxAniso: number) {
  // ==========================================================
  // 1. HD MONO-YELLOW WALLPAPER (1024x1024) WITH BASEBOARDS & MOLDING
  // ==========================================================
  const wallCanvas = document.createElement('canvas');
  wallCanvas.width = 1024;
  wallCanvas.height = 1024;
  const wctx = wallCanvas.getContext('2d')!;

  // Grayscale bump map for wallpaper
  const wallBumpCanvas = document.createElement('canvas');
  wallBumpCanvas.width = 1024;
  wallBumpCanvas.height = 1024;
  const wbctx = wallBumpCanvas.getContext('2d')!;

  // Base authentic Backrooms dingy yellow wallpaper tone
  wctx.fillStyle = '#b7a868';
  wctx.fillRect(0, 0, 1024, 1024);

  wbctx.fillStyle = '#808080';
  wbctx.fillRect(0, 0, 1024, 1024);

  // Subtle vintage wallpaper vertical damask pinstripes
  for (let x = 0; x < 1024; x += 64) {
    // Alternating broad stripe
    wctx.fillStyle = x % 128 === 0 ? 'rgba(164, 150, 84, 0.35)' : 'rgba(206, 194, 126, 0.28)';
    wctx.fillRect(x, 0, 32, 1024);

    // Fine pinstripe groove
    wctx.fillStyle = 'rgba(128, 114, 58, 0.3)';
    wctx.fillRect(x + 28, 0, 4, 1024);

    wbctx.fillStyle = x % 128 === 0 ? '#909090' : '#707070';
    wbctx.fillRect(x, 0, 32, 1024);
    wbctx.fillStyle = '#505050';
    wbctx.fillRect(x + 28, 0, 4, 1024);
  }

  // Micro-woven vinyl texture grain
  const imgData = wctx.getImageData(0, 0, 1024, 1024);
  const data = imgData.data;
  const bData = wbctx.getImageData(0, 0, 1024, 1024);
  const bd = bData.data;

  for (let i = 0; i < data.length; i += 4) {
    const grain = (Math.random() - 0.5) * 20;
    data[i] = Math.min(255, Math.max(0, data[i] + grain));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + grain));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + grain));

    const bVal = Math.min(255, Math.max(0, bd[i] + grain * 1.5));
    bd[i] = bVal;
    bd[i + 1] = bVal;
    bd[i + 2] = bVal;
  }
  wctx.putImageData(imgData, 0, 0);
  wbctx.putImageData(bData, 0, 0);

  // Vertical seams every 256px
  for (let x = 256; x < 1024; x += 256) {
    wctx.fillStyle = 'rgba(70, 60, 30, 0.4)';
    wctx.fillRect(x - 1, 0, 3, 1024);
    wbctx.fillStyle = '#303030';
    wbctx.fillRect(x - 1, 0, 3, 1024);
  }

  // Damp water stains and mildew spots
  wctx.fillStyle = 'rgba(80, 70, 35, 0.14)';
  for (let i = 0; i < 18; i++) {
    const sx = Math.random() * 1024;
    const sy = Math.random() * 800 + 100;
    const sr = 30 + Math.random() * 60;
    wctx.beginPath();
    wctx.arc(sx, sy, sr, 0, Math.PI * 2);
    wctx.fill();
  }

  // HD BASEBOARD SKIRTING (bottom 60px of the wall)
  // Dark varnished wood baseboard
  wctx.fillStyle = '#261f18';
  wctx.fillRect(0, 964, 1024, 60);
  // Bevel highlight line
  wctx.fillStyle = '#4a3d31';
  wctx.fillRect(0, 962, 1024, 3);
  wctx.fillStyle = '#15110d';
  wctx.fillRect(0, 960, 1024, 2);

  wbctx.fillStyle = '#202020';
  wbctx.fillRect(0, 964, 1024, 60);
  wbctx.fillStyle = '#ffffff';
  wbctx.fillRect(0, 962, 1024, 3);

  // HD CROWN MOLDING TRIM (top 40px of the wall)
  wctx.fillStyle = '#7a704e';
  wctx.fillRect(0, 0, 1024, 35);
  wctx.fillStyle = '#4c4530';
  wctx.fillRect(0, 35, 1024, 5);

  wbctx.fillStyle = '#505050';
  wbctx.fillRect(0, 0, 1024, 35);
  wbctx.fillStyle = '#202020';
  wbctx.fillRect(0, 35, 1024, 5);

  const wallTexture = new THREE.CanvasTexture(wallCanvas);
  wallTexture.colorSpace = THREE.SRGBColorSpace;
  wallTexture.wrapS = THREE.RepeatWrapping;
  wallTexture.wrapT = THREE.RepeatWrapping;
  wallTexture.repeat.set(1, 1);
  wallTexture.anisotropy = maxAniso;

  const wallBumpMap = new THREE.CanvasTexture(wallBumpCanvas);
  wallBumpMap.wrapS = THREE.RepeatWrapping;
  wallBumpMap.wrapT = THREE.RepeatWrapping;
  wallBumpMap.repeat.set(1, 1);
  wallBumpMap.anisotropy = maxAniso;

  // ==========================================================
  // 2. HD MOIST CARPET TEXTURE (1024x1024) WITH NORMAL BUMP
  // ==========================================================
  const carpetCanvas = document.createElement('canvas');
  carpetCanvas.width = 1024;
  carpetCanvas.height = 1024;
  const cctx = carpetCanvas.getContext('2d')!;

  const carpetBumpCanvas = document.createElement('canvas');
  carpetBumpCanvas.width = 1024;
  carpetBumpCanvas.height = 1024;
  const cbctx = carpetBumpCanvas.getContext('2d')!;

  // Dingy musty brownish-yellow carpet tone
  cctx.fillStyle = '#5c522e';
  cctx.fillRect(0, 0, 1024, 1024);

  cbctx.fillStyle = '#808080';
  cbctx.fillRect(0, 0, 1024, 1024);

  // High-density looped carpet fiber noise
  const carpetImgData = cctx.getImageData(0, 0, 1024, 1024);
  const cd = carpetImgData.data;
  const cbData = cbctx.getImageData(0, 0, 1024, 1024);
  const cbd = cbData.data;

  for (let i = 0; i < cd.length; i += 4) {
    const fiber = (Math.random() - 0.5) * 44;
    cd[i] = Math.min(255, Math.max(0, cd[i] + fiber));
    cd[i + 1] = Math.min(255, Math.max(0, cd[i + 1] + fiber));
    cd[i + 2] = Math.min(255, Math.max(0, cd[i + 2] + fiber));

    const bVal = Math.min(255, Math.max(0, 128 + fiber * 1.8));
    cbd[i] = bVal;
    cbd[i + 1] = bVal;
    cbd[i + 2] = bVal;
  }
  cctx.putImageData(carpetImgData, 0, 0);
  cbctx.putImageData(cbData, 0, 0);

  // Carpet Tile Seams & Moisture Patches
  cctx.strokeStyle = 'rgba(30, 26, 14, 0.45)';
  cctx.lineWidth = 4;
  cbctx.strokeStyle = '#303030';
  cbctx.lineWidth = 4;

  for (let pos = 0; pos <= 1024; pos += 256) {
    cctx.beginPath();
    cctx.moveTo(pos, 0);
    cctx.lineTo(pos, 1024);
    cctx.stroke();

    cctx.beginPath();
    cctx.moveTo(0, pos);
    cctx.lineTo(1024, pos);
    cctx.stroke();

    cbctx.beginPath();
    cbctx.moveTo(pos, 0);
    cbctx.lineTo(pos, 1024);
    cbctx.stroke();

    cbctx.beginPath();
    cbctx.moveTo(0, pos);
    cbctx.lineTo(1024, pos);
    cbctx.stroke();
  }

  // Dark damp moldy spots on carpet
  cctx.fillStyle = 'rgba(25, 22, 10, 0.28)';
  for (let i = 0; i < 20; i++) {
    const sx = Math.random() * 1024;
    const sy = Math.random() * 1024;
    const sr = 40 + Math.random() * 80;
    cctx.beginPath();
    cctx.arc(sx, sy, sr, 0, Math.PI * 2);
    cctx.fill();
  }

  const carpetTexture = new THREE.CanvasTexture(carpetCanvas);
  carpetTexture.colorSpace = THREE.SRGBColorSpace;
  carpetTexture.wrapS = THREE.RepeatWrapping;
  carpetTexture.wrapT = THREE.RepeatWrapping;
  carpetTexture.repeat.set(16, 16);
  carpetTexture.anisotropy = maxAniso;

  const carpetBumpMap = new THREE.CanvasTexture(carpetBumpCanvas);
  carpetBumpMap.wrapS = THREE.RepeatWrapping;
  carpetBumpMap.wrapT = THREE.RepeatWrapping;
  carpetBumpMap.repeat.set(16, 16);
  carpetBumpMap.anisotropy = maxAniso;

  // ==========================================================
  // 3. HD ACOUSTIC CEILING TILES (512x512) WITH METALLIC T-BARS
  // ==========================================================
  const ceilCanvas = document.createElement('canvas');
  ceilCanvas.width = 512;
  ceilCanvas.height = 512;
  const ctx2 = ceilCanvas.getContext('2d')!;

  ctx2.fillStyle = '#8a8264';
  ctx2.fillRect(0, 0, 512, 512);

  // Metallic drop ceiling T-bar grid lines
  ctx2.fillStyle = '#4c4634';
  ctx2.fillRect(0, 0, 512, 8);
  ctx2.fillRect(0, 0, 8, 512);
  ctx2.fillRect(0, 504, 512, 8);
  ctx2.fillRect(504, 0, 8, 512);

  // Metallic highlight on T-bar edge
  ctx2.fillStyle = '#b3aa88';
  ctx2.fillRect(4, 4, 504, 2);
  ctx2.fillRect(4, 4, 2, 504);

  // Acoustic fissures & micro-pinholes
  ctx2.fillStyle = 'rgba(45, 40, 28, 0.6)';
  for (let i = 0; i < 500; i++) {
    const px = 12 + Math.random() * 488;
    const py = 12 + Math.random() * 488;
    ctx2.fillRect(px, py, 1.5, 2.5);
  }

  const ceilTexture = new THREE.CanvasTexture(ceilCanvas);
  ceilTexture.colorSpace = THREE.SRGBColorSpace;
  ceilTexture.wrapS = THREE.RepeatWrapping;
  ceilTexture.wrapT = THREE.RepeatWrapping;
  ceilTexture.repeat.set(18, 18);
  ceilTexture.anisotropy = maxAniso;

  return { wallTexture, wallBumpMap, carpetTexture, carpetBumpMap, ceilTexture };
}

/**
 * Creates floating dust motes / particulate atmospheric volume
 */
function createDustParticles(scene: THREE.Scene, worldSpan: number): THREE.Points {
  const particleCount = 650;
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(particleCount * 3);
  const velocities = new Float32Array(particleCount * 3);

  const half = worldSpan / 2;
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * worldSpan;
    positions[i * 3 + 1] = 0.4 + Math.random() * 3.6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * worldSpan;

    velocities[i * 3] = (Math.random() - 0.5) * 0.18;
    velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.12;
    velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.18;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));

  // Circular soft particle texture
  const pCanvas = document.createElement('canvas');
  pCanvas.width = 32;
  pCanvas.height = 32;
  const pctx = pCanvas.getContext('2d')!;
  const grad = pctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 248, 210, 0.95)');
  grad.addColorStop(0.35, 'rgba(230, 215, 160, 0.45)');
  grad.addColorStop(1, 'rgba(200, 180, 130, 0)');
  pctx.fillStyle = grad;
  pctx.fillRect(0, 0, 32, 32);

  const pTex = new THREE.CanvasTexture(pCanvas);
  const material = new THREE.PointsMaterial({
    size: 0.18,
    map: pTex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);
  return points;
}

export function buildWorld(renderer: THREE.WebGLRenderer): WorldObjects {
  const scene = new THREE.Scene();
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  // Atmospheric Backrooms Fog: Rich eerie yellow tone
  scene.background = new THREE.Color(0x6e6538);
  scene.fog = new THREE.FogExp2(0x6e6538, 0.026);

  const cellSize = 4.0;
  const mazeSize = 19;
  const offset = (mazeSize - 1) / 2;
  const maze = generateMaze(mazeSize);

  const textures = createHDProceduralTextures(maxAniso);

  // 1. Studio Lighting with Warm/Cool temperature contrast
  const hemiLight = new THREE.HemisphereLight(0xfff6cf, 0x36301d, 1.05);
  scene.add(hemiLight);

  const ambientLight = new THREE.AmbientLight(0xb4ad7c, 0.42);
  scene.add(ambientLight);

  // 2. Ultra-Fast PBR Materials (Zero specular overhead, locked 60 FPS)
  const floorMat = new THREE.MeshStandardMaterial({
    map: textures.carpetTexture,
    roughness: 1.0,
    metalness: 0.0,
  });

  const wallMat = new THREE.MeshStandardMaterial({
    map: textures.wallTexture,
    roughness: 1.0,
    metalness: 0.0,
  });

  const ceilingMat = new THREE.MeshStandardMaterial({
    map: textures.ceilTexture,
    roughness: 1.0,
    metalness: 0.0,
  });

  // 3. Ground & Ceiling
  const worldSpan = mazeSize * cellSize;
  const floorGeo = new THREE.PlaneGeometry(worldSpan + 8, worldSpan + 8);
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  scene.add(floor);

  const ceilGeo = new THREE.PlaneGeometry(worldSpan + 8, worldSpan + 8);
  const ceiling = new THREE.Mesh(ceilGeo, ceilingMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 4.2;
  scene.add(ceiling);

  // 4. Instanced Walls with WallBox Collision Bounds
  const walls: WallBox[] = [];
  const wallGeo = new THREE.BoxGeometry(cellSize, 4.2, cellSize);
  const wallInstancedMesh = new THREE.InstancedMesh(
    wallGeo,
    wallMat,
    mazeSize * mazeSize
  );

  const dummy = new THREE.Object3D();
  let wallCount = 0;

  for (let r = 0; r < mazeSize; r++) {
    for (let c = 0; c < mazeSize; c++) {
      if (maze[r][c] === 1) {
        const x = (c - offset) * cellSize;
        const z = (r - offset) * cellSize;

        dummy.position.set(x, 2.1, z);
        dummy.updateMatrix();
        wallInstancedMesh.setMatrixAt(wallCount++, dummy.matrix);

        const half = cellSize / 2;
        walls.push({
          minX: x - half,
          maxX: x + half,
          minZ: z - half,
          maxZ: z + half,
          centerX: x,
          centerZ: z,
          halfSize: half,
        });
      }
    }
  }

  wallInstancedMesh.count = wallCount;
  wallInstancedMesh.instanceMatrix.needsUpdate = true;
  wallInstancedMesh.computeBoundingSphere();
  scene.add(wallInstancedMesh);

  // 5. Detailed Fluorescent Troffer Fixtures (Luminous without shader overhead)
  const lights: THREE.PointLight[] = [];
  const fixtureBodyMat = new THREE.MeshStandardMaterial({
    color: 0x474233,
    roughness: 0.5,
    metalness: 0.65,
  });
  const diffuserMat = new THREE.MeshBasicMaterial({ color: 0xfff6cf });

  for (let r = 1; r < mazeSize - 1; r += 3) {
    for (let c = 1; c < mazeSize - 1; c += 3) {
      if (maze[r][c] === 0) {
        const x = (c - offset) * cellSize;
        const z = (r - offset) * cellSize;

        const fixture = new THREE.Group();
        fixture.position.set(x, 4.14, z);

        // Metal casing
        const housing = new THREE.Mesh(
          new THREE.BoxGeometry(2.0, 0.12, 0.65),
          fixtureBodyMat
        );
        fixture.add(housing);

        // Prismatic luminous diffuser panel (unlit basic material = 0 shader cost!)
        const diffuser = new THREE.Mesh(
          new THREE.BoxGeometry(1.85, 0.04, 0.52),
          diffuserMat
        );
        diffuser.position.y = -0.06;
        fixture.add(diffuser);

        scene.add(fixture);
      }
    }
  }

  // 2 Strategic Ambient Fill PointLights for the whole maze (instead of 36)
  const centerLight = new THREE.PointLight(0xffefb8, 1.4, 35, 1.2);
  centerLight.position.set(0, 3.8, 0);
  scene.add(centerLight);
  lights.push(centerLight);

  const startLight = new THREE.PointLight(0xffefb8, 1.2, 22, 1.2);
  startLight.position.set((1 - offset) * cellSize, 3.8, (1 - offset) * cellSize);
  scene.add(startLight);
  lights.push(startLight);

  // 6. Security Cipher Terminal (High-Detail Sci-Fi Retro Computer)
  const termR = mazeSize - 3;
  const termC = mazeSize - 3;
  const termX = (termC - offset) * cellSize;
  const termZ = (termR - offset) * cellSize;
  const terminalPosition = new THREE.Vector3(termX, 0, termZ);

  const terminalGroup = new THREE.Group();
  terminalGroup.position.copy(terminalPosition);

  // Desk with metallic trim and server tower
  const deskMat = new THREE.MeshStandardMaterial({
    color: 0x1f2622,
    roughness: 0.4,
    metalness: 0.7,
  });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.05, 0.85), deskMat);
  desk.position.y = 0.525;
  desk.castShadow = true;
  terminalGroup.add(desk);

  // CRT Monitor Housing with bevels
  const crtHousing = new THREE.Mesh(
    new THREE.BoxGeometry(1.1, 0.76, 0.6),
    new THREE.MeshStandardMaterial({
      color: 0x141a17,
      roughness: 0.55,
      metalness: 0.45,
    })
  );
  crtHousing.position.set(0, 1.45, 0);
  terminalGroup.add(crtHousing);

  // High-Res CRT Screen Canvas Texture (512x512)
  const crtCanvas = document.createElement('canvas');
  crtCanvas.width = 512;
  crtCanvas.height = 512;
  const crtCtx = crtCanvas.getContext('2d')!;
  crtCtx.fillStyle = '#04120f';
  crtCtx.fillRect(0, 0, 512, 512);

  // Glowing Retro Phosphor Terminal Lines
  crtCtx.fillStyle = '#6fffea';
  crtCtx.font = 'bold 34px monospace';
  crtCtx.fillText('SECURITY TERMINAL_01', 30, 70);
  crtCtx.font = '24px monospace';
  crtCtx.fillText('STATUS: LOCKED [E TO ACCESS]', 30, 130);
  crtCtx.fillText('SYSTEM: FUNGSI KOMPOSISI & INVERS', 30, 180);
  crtCtx.fillStyle = '#ffde69';
  crtCtx.fillText('> PECAHKAN KOMPOSISI & INVERS', 30, 240);
  crtCtx.fillText('> WAKTU BATAS: 10:00 (600 DETIK)', 30, 290);

  // Scanline overlay
  crtCtx.fillStyle = 'rgba(0, 0, 0, 0.38)';
  for (let y = 0; y < 512; y += 4) {
    crtCtx.fillRect(0, y, 512, 2);
  }

  const crtTex = new THREE.CanvasTexture(crtCanvas);
  crtTex.colorSpace = THREE.SRGBColorSpace;
  const screenMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.6),
    new THREE.MeshBasicMaterial({ map: crtTex })
  );
  screenMesh.position.set(0, 1.45, 0.31);
  terminalGroup.add(screenMesh);

  // Glowing indicator lamps & Hologram Emitter
  const terminalGlow = new THREE.PointLight(0x6fffea, 2.5, 9);
  terminalGlow.position.set(0, 1.55, 0.65);
  terminalGroup.add(terminalGlow);

  // Keyboard console with angle
  const keyboard = new THREE.Mesh(
    new THREE.BoxGeometry(0.85, 0.05, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x0d1210, roughness: 0.8 })
  );
  keyboard.position.set(0, 1.09, 0.28);
  keyboard.rotation.x = 0.15;
  terminalGroup.add(keyboard);

  scene.add(terminalGroup);

  // 7. Security Exit Door & Chamber with "Layar Halaman Luar Rumah Saya" Portal Screen
  const exitR = mazeSize - 2;
  const exitC = mazeSize - 2;
  const exitX = (exitC - offset) * cellSize;
  const exitZ = (exitR - offset) * cellSize;
  const exitPosition = new THREE.Vector3(exitX, 0, exitZ);

  function createHomeYardScreenTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 768;
    const ctx = canvas.getContext('2d')!;

    // Twilight-to-dawn sky over front yard (matching opening scene's real house exterior)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, 390);
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(0.55, '#1e3a5f');
    skyGrad.addColorStop(0.88, '#9a5b32');
    skyGrad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, 512, 390);

    // Stars & crescent moon
    ctx.fillStyle = '#e2e8f0';
    const starCoords = [
      [68, 52], [140, 88], [210, 44], [312, 72], [430, 58], [385, 128], [92, 134], [260, 108],
    ];
    for (const [sx, sy] of starCoords) {
      ctx.fillRect(sx, sy, 4, 4);
    }
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(412, 92, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#152540';
    ctx.beginPath();
    ctx.arc(422, 86, 22, 0, Math.PI * 2);
    ctx.fill();

    // Distant neighborhood rooftops & lush front-yard trees
    ctx.fillStyle = '#163822';
    const treeCenters = [68, 135, 382, 448];
    for (const tx of treeCenters) {
      ctx.beginPath();
      ctx.moveTo(tx, 165);
      ctx.lineTo(tx - 58, 378);
      ctx.lineTo(tx + 58, 378);
      ctx.closePath();
      ctx.fill();
    }

    // Green Front Lawn (Halaman Luar Rumah)
    const grassGrad = ctx.createLinearGradient(0, 378, 0, 768);
    grassGrad.addColorStop(0, '#1e3a24');
    grassGrad.addColorStop(0.5, '#275230');
    grassGrad.addColorStop(1, '#326b3d');
    ctx.fillStyle = grassGrad;
    ctx.fillRect(0, 378, 512, 390);

    // White Picket Fence across yard
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(0, 396, 178, 8);
    ctx.fillRect(334, 396, 178, 8);
    for (let px = 12; px < 504; px += 28) {
      if (px > 165 && px < 325) continue;
      ctx.fillRect(px, 344, 14, 72);
    }

    // Paved Stone Walkway leading from doorway out to the yard
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(192, 382);
    ctx.lineTo(320, 382);
    ctx.lineTo(418, 768);
    ctx.lineTo(94, 768);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = 'rgba(30, 41, 59, 0.45)';
    ctx.lineWidth = 4;
    for (let y = 420; y < 750; y += 58) {
      const t = (y - 382) / 386;
      const lx = THREE.MathUtils.lerp(192, 94, t);
      const rx = THREE.MathUtils.lerp(320, 418, t);
      ctx.beginPath();
      ctx.moveTo(lx, y);
      ctx.lineTo(rx, y);
      ctx.stroke();
    }

    // Cozy Porch Pillars & Overhead House Eave framing left/right
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 34, 768);
    ctx.fillRect(478, 0, 34, 768);
    ctx.fillStyle = '#334155';
    ctx.fillRect(0, 0, 512, 46);

    // Warm Porch Lantern Glow at top center
    const lanternGlow = ctx.createRadialGradient(256, 56, 6, 256, 72, 130);
    lanternGlow.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    lanternGlow.addColorStop(0.35, 'rgba(253, 224, 71, 0.35)');
    lanternGlow.addColorStop(1, 'rgba(253, 224, 71, 0)');
    ctx.fillStyle = lanternGlow;
    ctx.fillRect(100, 0, 312, 220);

    // Porch Roof Lamp Fixture
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(240, 46, 32, 18);

    // Subtle glowing screen bezel & label
    ctx.strokeStyle = '#42e6bf';
    ctx.lineWidth = 6;
    ctx.strokeRect(4, 4, 504, 760);

    ctx.fillStyle = 'rgba(4, 15, 11, 0.72)';
    ctx.fillRect(104, 698, 304, 44);
    ctx.fillStyle = '#6fffea';
    ctx.font = 'bold 21px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HALAMAN LUAR RUMAH', 256, 727);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  const homeYardTex = createHomeYardScreenTexture();

  const exitDoorGroup = new THREE.Group();
  exitDoorGroup.position.set(exitX + 0.35, 0, exitZ + 0.35);
  // Face North-West directly toward Terminal Room (16, 16) so player always sees the front screen cleanly
  exitDoorGroup.rotation.y = -Math.PI * 0.75;

  // Hollow Heavy Industrial Door Frame (Left Pillar, Right Pillar, Top Header)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x333832,
    roughness: 0.4,
    metalness: 0.75,
  });
  const leftPillar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.85, 0.52), frameMat);
  leftPillar.position.set(-1.25, 1.925, 0);
  exitDoorGroup.add(leftPillar);

  const rightPillar = new THREE.Mesh(new THREE.BoxGeometry(0.42, 3.85, 0.52), frameMat);
  rightPillar.position.set(1.25, 1.925, 0);
  exitDoorGroup.add(rightPillar);

  const topHeader = new THREE.Mesh(new THREE.BoxGeometry(2.92, 0.48, 0.52), frameMat);
  topHeader.position.set(0, 3.62, 0);
  exitDoorGroup.add(topHeader);

  // Full-Doorway Glowing "Halaman Luar Rumah Saya" Portal Screen revealed when door opens
  const exitYardScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.12, 3.38),
    new THREE.MeshBasicMaterial({ map: homeYardTex, side: THREE.DoubleSide })
  );
  exitYardScreen.position.set(0, 1.70, -0.08);
  exitDoorGroup.add(exitYardScreen);

  const backSeal = new THREE.Mesh(
    new THREE.BoxGeometry(2.26, 3.45, 0.08),
    frameMat
  );
  backSeal.position.set(0, 1.72, -0.16);
  exitDoorGroup.add(backSeal);

  // Warning Hazard Stripe Banner
  const hazardMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.75, 0.28, 0.54),
    new THREE.MeshStandardMaterial({
      color: 0xffd033,
      roughness: 0.5,
      metalness: 0.2,
    })
  );
  hazardMesh.position.set(0, 3.74, 0);
  exitDoorGroup.add(hazardMesh);

  // Sliding Heavy Blast Door with Built-in "Layar Halaman Luar Rumah" Viewport Screen
  const exitDoorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(2.12, 3.42, 0.22),
    new THREE.MeshStandardMaterial({
      color: 0x161e1b,
      roughness: 0.35,
      metalness: 0.85,
    })
  );
  exitDoorMesh.position.set(0, 1.71, 0.08);

  const doorScreenBezel = new THREE.Mesh(
    new THREE.BoxGeometry(1.44, 1.88, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x0b120f, roughness: 0.3, metalness: 0.8 })
  );
  doorScreenBezel.position.set(0, 0.42, 0.115);
  exitDoorMesh.add(doorScreenBezel);

  const doorScreenMat = new THREE.MeshBasicMaterial({
    map: homeYardTex,
    transparent: true,
    opacity: 1,
  });
  const doorScreenGlass = new THREE.Mesh(
    new THREE.PlaneGeometry(1.28, 1.72),
    doorScreenMat
  );
  doorScreenGlass.position.set(0, 0.42, 0.14);
  exitDoorMesh.add(doorScreenGlass);

  exitDoorGroup.add(exitDoorMesh);

  // Luminous Exit Sign
  const exitSign = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.34, 0.12),
    new THREE.MeshBasicMaterial({ color: 0x42e6bf })
  );
  exitSign.position.set(0, 3.36, 0.29);
  exitDoorGroup.add(exitSign);

  // Status Indicator Light above door
  const doorStatusLight = new THREE.PointLight(0xff4d5e, 1.9, 8);
  doorStatusLight.position.set(0, 3.22, 0.65);
  exitDoorGroup.add(doorStatusLight);

  scene.add(exitDoorGroup);

  // 7b. Hiding Lockers scattered across corridors (anchored flush against adjacent walls)
  const lockers: LockerSpot[] = [];
  function populateLockers() {
    for (const old of lockers) {
      scene.remove(old.mesh);
    }
    lockers.length = 0;

    const candidates: { r: number; c: number; wallDir: [number, number]; rotY: number }[] = [];
    for (let r = 2; r < mazeSize - 2; r++) {
      for (let c = 2; c < mazeSize - 2; c++) {
        if (maze[r][c] !== 0) continue;
        // Skip start area & terminal chamber
        if (r <= 3 && c <= 3) continue;
        if (r >= mazeSize - 4 && c >= mazeSize - 4) continue;

        // Find adjacent wall so locker sits flush against a wall facing the open corridor
        if (maze[r - 1]?.[c] === 1) {
          candidates.push({ r, c, wallDir: [0, -1], rotY: 0 });
        } else if (maze[r + 1]?.[c] === 1) {
          candidates.push({ r, c, wallDir: [0, 1], rotY: Math.PI });
        } else if (maze[r]?.[c - 1] === 1) {
          candidates.push({ r, c, wallDir: [-1, 0], rotY: Math.PI / 2 });
        } else if (maze[r]?.[c + 1] === 1) {
          candidates.push({ r, c, wallDir: [1, 0], rotY: -Math.PI / 2 });
        }
      }
    }

    // Shuffle and space out 7 lockers across the map
    candidates.sort(() => Math.random() - 0.5);
    const chosen: typeof candidates = [];
    for (const cand of candidates) {
      if (chosen.length >= 7) break;
      const farEnough = chosen.every(
        (ex) => Math.abs(ex.r - cand.r) + Math.abs(ex.c - cand.c) >= 5
      );
      if (farEnough) chosen.push(cand);
    }

    chosen.forEach((spot, idx) => {
      const base = gridToWorld(spot.r, spot.c, cellSize, offset);
      const wx = base.x + spot.wallDir[0] * 1.48;
      const wz = base.z + spot.wallDir[1] * 1.48;
      const lockerMesh = createLockerMesh();
      lockerMesh.position.set(wx, 0, wz);
      lockerMesh.rotation.y = spot.rotY;
      scene.add(lockerMesh);

      lockers.push({
        id: idx + 1,
        row: spot.r,
        col: spot.c,
        position: new THREE.Vector3(wx, 0, wz),
        mesh: lockerMesh,
      });
    });
  }
  populateLockers();

  // 8. Atmospheric Floating Dust Particles
  const dustParticles = createDustParticles(scene, worldSpan);

  let isDoorOpening = false;
  let doorOpenProgress = 0;

  function openExitDoor() {
    isDoorOpening = true;
    doorStatusLight.color.setHex(0x42e6bf);
    (exitDoorMesh.material as THREE.MeshStandardMaterial).color.setHex(
      0x255b4b
    );
  }

  function rebuildMaze(): number[][] {
    const newMaze = generateMaze(mazeSize);
    for (let r = 0; r < mazeSize; r++) {
      for (let c = 0; c < mazeSize; c++) {
        maze[r][c] = newMaze[r][c];
      }
    }

    walls.length = 0;
    let count = 0;

    for (let r = 0; r < mazeSize; r++) {
      for (let c = 0; c < mazeSize; c++) {
        if (maze[r][c] === 1) {
          const x = (c - offset) * cellSize;
          const z = (r - offset) * cellSize;

          dummy.position.set(x, 2.1, z);
          dummy.updateMatrix();
          wallInstancedMesh.setMatrixAt(count++, dummy.matrix);

          const half = cellSize / 2;
          walls.push({
            minX: x - half,
            maxX: x + half,
            minZ: z - half,
            maxZ: z + half,
            centerX: x,
            centerZ: z,
            halfSize: half,
          });
        }
      }
    }

    wallInstancedMesh.count = count;
    wallInstancedMesh.instanceMatrix.needsUpdate = true;
    wallInstancedMesh.computeBoundingSphere();

    // Re-scatter hiding lockers for the new randomized corridors
    populateLockers();

    // Reset exit door animation
    isDoorOpening = false;
    doorOpenProgress = 0;
    exitDoorMesh.position.x = 0;
    doorScreenMat.opacity = 1;
    doorScreenGlass.visible = true;
    doorStatusLight.color.setHex(0xff4d5e);
    (exitDoorMesh.material as THREE.MeshStandardMaterial).color.setHex(0x161e1b);

    return maze;
  }

  // Animation update loop for lights, dust motes, and sliding door
  let timeAcc = 0;
  function update(dt: number, playerPos?: THREE.Vector3) {
    timeAcc += dt;

    // Realistic fluorescent ballast flicker
    if (lights.length > 0) {
      const flicker1 = Math.sin(timeAcc * 16) * Math.sin(timeAcc * 8.5);
      if (flicker1 > 0.88) {
        lights[0].intensity = 0.5 + Math.random() * 0.9;
      } else {
        lights[0].intensity = 1.35;
      }
    }

    // Terminal glow pulse
    terminalGlow.intensity = 2.2 + Math.sin(timeAcc * 3.2) * 0.55;

    // Animate Floating Dust Motes (Zero CPU buffer upload, zero GPU bus stall)
    dustParticles.rotation.y += 0.02 * dt;
    dustParticles.position.y = Math.sin(timeAcc * 0.4) * 0.08;

    // Smooth door opening animation (slide to side & power off door viewport so single portal shines cleanly)
    if (isDoorOpening && doorOpenProgress < 1) {
      doorOpenProgress = Math.min(1, doorOpenProgress + dt * 0.85);
      const t = 1 - Math.pow(1 - doorOpenProgress, 3);
      exitDoorMesh.position.x = t * 2.0;
      const previewAlpha = Math.max(0, 1 - doorOpenProgress * 3.5);
      doorScreenMat.opacity = previewAlpha;
      doorScreenGlass.visible = previewAlpha > 0.02;
    }
  }

  function dispose() {
    textures.wallTexture.dispose();
    textures.wallBumpMap.dispose();
    textures.carpetTexture.dispose();
    textures.carpetBumpMap.dispose();
    textures.ceilTexture.dispose();
    crtTex.dispose();
    homeYardTex.dispose();
    dustParticles.geometry.dispose();
  }

  return {
    scene,
    maze,
    mazeSize,
    cellSize,
    offset,
    walls,
    lockers,
    terminalGroup,
    terminalPosition,
    exitDoorGroup,
    exitDoorMesh,
    exitPosition,
    lights,
    dustParticles,
    openExitDoor,
    rebuildMaze,
    update,
    dispose,
  };
}
