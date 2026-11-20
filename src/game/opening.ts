import * as THREE from 'three';

export interface OpeningSceneObjects {
  scene: THREE.Scene;
  phoneGroup: THREE.Group;
  phoneScreenMat: THREE.MeshBasicMaterial;
  doorPivot: THREE.Group;
  backroomsLight: THREE.PointLight;
  dispose: () => void;
}

/**
 * Real-World Twilight House Exterior + Inside-Door Backrooms Portal Corridor
 * Used for OPENING_CUTSCENE when player clicks "Masuk ke Backrooms (Mulai)"
 */
export function buildOpeningScene(): OpeningSceneObjects {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);
  scene.fog = new THREE.FogExp2(0x0f172a, 0.028);

  // Twilight hemisphere + warm moonlight + warm porch fill
  const hemi = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 0.95);
  scene.add(hemi);

  const moonLight = new THREE.DirectionalLight(0xcbd5e1, 0.85);
  moonLight.position.set(12, 20, 16);
  scene.add(moonLight);

  const porchLamp = new THREE.PointLight(0xfde68a, 2.2, 12, 1.5);
  porchLamp.position.set(0, 3.05, 1.45);
  scene.add(porchLamp);

  // Continuous Outdoor Lawn Terrain (never a floating void!)
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x1e3a24, roughness: 0.95 });
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), grassMat);
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.y = 0;
  scene.add(lawn);

  // Paved Stone Walkway from Z = 10 to house porch Z = 1.6
  const walkMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88 });
  const walkway = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.05, 9.0), walkMat);
  walkway.position.set(0, 0.025, 5.8);
  scene.add(walkway);

  // Porch Deck & Steps
  const porchMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.82 });
  const porchDeck = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 1.8), porchMat);
  porchDeck.position.set(0, 0.11, 0.9);
  scene.add(porchDeck);

  const stepMesh = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.11, 0.55), porchMat);
  stepMesh.position.set(0, 0.055, 1.98);
  scene.add(stepMesh);

  // Cozy Suburban House Exterior surrounding the doorway at (0, 0, 0)
  // Door opening is X in [-0.7, 0.7], Y in [0.22, 2.65] at Z = 0
  const sidingMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.78 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
  const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

  // Left & Right front walls framing the open doorway
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(3.3, 3.6, 0.4), sidingMat);
  leftWall.position.set(-2.35, 1.8, 0);
  scene.add(leftWall);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(3.3, 3.6, 0.4), sidingMat);
  rightWall.position.set(2.35, 1.8, 0);
  scene.add(rightWall);

  // Header wall above doorway
  const headerWall = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.95, 0.4), sidingMat);
  headerWall.position.set(0, 3.125, 0);
  scene.add(headerWall);

  // Side walls of house
  const sideLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 8.0), sidingMat);
  sideLeft.position.set(-3.8, 1.8, -4.0);
  scene.add(sideLeft);

  const sideRight = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.6, 8.0), sidingMat);
  sideRight.position.set(3.8, 1.8, -4.0);
  scene.add(sideRight);

  // Pitched Gable Roof + Porch Canopy
  const roofLeft = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.25, 8.8), roofMat);
  roofLeft.position.set(-2.1, 4.35, -4.0);
  roofLeft.rotation.z = 0.46;
  scene.add(roofLeft);

  const roofRight = new THREE.Mesh(new THREE.BoxGeometry(4.9, 0.25, 8.8), roofMat);
  roofRight.position.set(2.1, 4.35, -4.0);
  roofRight.rotation.z = -0.46;
  scene.add(roofRight);

  const porchCanopy = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.16, 2.0), roofMat);
  porchCanopy.position.set(0, 3.25, 0.95);
  scene.add(porchCanopy);

  const colGeo = new THREE.CylinderGeometry(0.09, 0.1, 3.0, 10);
  const colL = new THREE.Mesh(colGeo, trimMat);
  colL.position.set(-1.95, 1.72, 1.68);
  scene.add(colL);
  const colR = new THREE.Mesh(colGeo, trimMat);
  colR.position.set(1.95, 1.72, 1.68);
  scene.add(colR);

  // Lit House Front Windows
  [-2.35, 2.35].forEach((wx) => {
    const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.25, 0.45), trimMat);
    winFrame.position.set(wx, 1.9, 0);
    scene.add(winFrame);

    const winPane = new THREE.Mesh(new THREE.PlaneGeometry(1.12, 1.02), windowGlowMat);
    winPane.position.set(wx, 1.9, 0.235);
    scene.add(winPane);
  });

  // White Door Jamb + Hinged Wooden Front Door
  const jambL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.52, 0.46), trimMat);
  jambL.position.set(-0.75, 1.46, 0);
  scene.add(jambL);
  const jambR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.52, 0.46), trimMat);
  jambR.position.set(0.75, 1.46, 0);
  scene.add(jambR);
  const jambTop = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.14, 0.46), trimMat);
  jambTop.position.set(0, 2.68, 0);
  scene.add(jambTop);

  // Hinged at left edge x = -0.68, z = 0.08
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.68, 0.22, 0.08);
  scene.add(doorPivot);

  const woodDoorMat = new THREE.MeshStandardMaterial({ color: 0x5c361d, roughness: 0.6 });
  const doorSlab = new THREE.Mesh(new THREE.BoxGeometry(1.36, 2.4, 0.1), woodDoorMat);
  doorSlab.position.set(0.68, 1.2, 0);
  doorPivot.add(doorSlab);

  const knobMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, metalness: 0.85, roughness: 0.2 });
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 10), knobMat);
  knob.position.set(1.22, 1.08, 0.08);
  doorPivot.add(knob);

  // =========================================================================
  // BACKROOMS INTERIOR BEHIND THE FRONT DOOR (revealed as the door opens!)
  // =========================================================================
  const backroomWallMat = new THREE.MeshStandardMaterial({
    color: 0xd9ca7e,
    emissive: 0x3b3210,
    roughness: 0.9,
  });
  const backroomCarpetMat = new THREE.MeshStandardMaterial({
    color: 0x7c703f,
    emissive: 0x1a170a,
    roughness: 0.96,
  });
  const backroomCeilMat = new THREE.MeshStandardMaterial({ color: 0xa89d72, roughness: 0.95 });

  const brFloor = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 9.5), backroomCarpetMat);
  brFloor.rotation.x = -Math.PI / 2;
  brFloor.position.set(0, 0.22, -4.75);
  scene.add(brFloor);

  const brCeil = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 9.5), backroomCeilMat);
  brCeil.rotation.x = Math.PI / 2;
  brCeil.position.set(0, 3.6, -4.75);
  scene.add(brCeil);

  const brWallL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 9.2), backroomWallMat);
  brWallL.position.set(-2.3, 1.9, -4.6);
  scene.add(brWallL);

  const brWallR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 9.2), backroomWallMat);
  brWallR.position.set(2.3, 1.9, -4.6);
  scene.add(brWallR);

  const brBackWall = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.5, 0.3), backroomWallMat);
  brBackWall.position.set(0, 1.9, -9.2);
  scene.add(brBackWall);

  // Corner pillar inside Backrooms diorama for authentic maze feel
  const brPillar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.5, 1.6), backroomWallMat);
  brPillar.position.set(-1.1, 1.9, -6.2);
  scene.add(brPillar);

  // Glowing fluorescent light panel inside Backrooms doorway
  const brPanel = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.08, 0.65),
    new THREE.MeshBasicMaterial({ color: 0xfff8c9 })
  );
  brPanel.position.set(0, 3.55, -2.5);
  scene.add(brPanel);

  const brPanel2 = brPanel.clone();
  brPanel2.position.set(0.3, 3.55, -6.0);
  scene.add(brPanel2);

  const backroomsLight = new THREE.PointLight(0xfff0a0, 0.4, 16, 1.2);
  backroomsLight.position.set(0, 3.1, -2.4);
  scene.add(backroomsLight);

  // Perimeter trees & white picket fence (grounded outdoor perimeter)
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
  for (let fx = -14; fx <= 14; fx += 1.4) {
    if (Math.abs(fx) < 1.5) continue;
    const picket = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.08), fenceMat);
    picket.position.set(fx, 0.45, 9.5);
    scene.add(picket);
  }
  const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.9 });
  const treeLeafMat = new THREE.MeshStandardMaterial({ color: 0x163822, roughness: 0.85 });
  const treeCoords: [number, number][] = [
    [-7.5, 3.5],
    [7.8, 3.2],
    [-9.0, 8.2],
    [8.5, 8.0],
    [-6.2, -3.5],
    [6.5, -3.2],
  ];
  for (const [tx, tz] of treeCoords) {
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, 0, tz);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.2, 8), treeTrunkMat);
    trunk.position.y = 1.1;
    tGroup.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.5, 3.4, 8), treeLeafMat);
    crown.position.y = 3.4;
    tGroup.add(crown);
    scene.add(tGroup);
  }

  // =========================================================================
  // 3D SMARTPHONE WITH "THE LAST EXIT" START SCREEN TEXTURE (realistic normal size)
  // =========================================================================
  const phoneGroup = new THREE.Group();

  const phoneBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.115, 0.215, 0.016),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.7, roughness: 0.25 })
  );
  phoneGroup.add(phoneBody);

  const phoneCanvas = document.createElement('canvas');
  phoneCanvas.width = 512;
  phoneCanvas.height = 896;
  const pctx = phoneCanvas.getContext('2d')!;
  pctx.fillStyle = '#0a100c';
  pctx.fillRect(0, 0, 512, 896);

  // Border glow
  pctx.strokeStyle = '#d6c77a';
  pctx.lineWidth = 8;
  pctx.strokeRect(20, 20, 472, 856);

  pctx.fillStyle = '#ffffff';
  pctx.font = 'bold 58px sans-serif';
  pctx.textAlign = 'center';
  pctx.fillText('THE LAST', 256, 200);
  pctx.fillStyle = '#d6c77a';
  pctx.fillText('EXIT', 256, 272);

  pctx.fillStyle = '#6fffea';
  pctx.font = 'bold 24px monospace';
  pctx.fillText('MATHCIPHER 3D', 256, 330);

  // Mini description box
  pctx.fillStyle = '#141c17';
  pctx.fillRect(48, 390, 416, 170);
  pctx.fillStyle = '#d1d5db';
  pctx.font = '22px monospace';
  pctx.fillText('FUNGSI KOMPOSISI & INVERS', 256, 455);
  pctx.fillStyle = '#fde047';
  pctx.fillText('MEMUAT PORTAL BACKROOMS...', 256, 505);

  // Highlighted Start CTA button on phone screen
  pctx.fillStyle = '#d6c77a';
  pctx.fillRect(54, 650, 404, 88);
  pctx.fillStyle = '#090d0a';
  pctx.font = 'bold 28px monospace';
  pctx.fillText('MASUK KE BACKROOMS', 256, 704);

  const phoneTex = new THREE.CanvasTexture(phoneCanvas);
  phoneTex.colorSpace = THREE.SRGBColorSpace;
  const phoneScreenMat = new THREE.MeshBasicMaterial({ map: phoneTex });

  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.188), phoneScreenMat);
  phoneScreen.position.z = 0.009;
  phoneGroup.add(phoneScreen);

  scene.add(phoneGroup);

  function dispose() {
    phoneTex.dispose();
    grassMat.dispose();
    walkMat.dispose();
    porchMat.dispose();
    sidingMat.dispose();
    trimMat.dispose();
    roofMat.dispose();
    woodDoorMat.dispose();
    backroomWallMat.dispose();
    backroomCarpetMat.dispose();
    backroomCeilMat.dispose();
  }

  return {
    scene,
    phoneGroup,
    phoneScreenMat,
    doorPivot,
    backroomsLight,
    dispose,
  };
}
