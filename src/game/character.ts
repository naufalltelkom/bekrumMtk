import * as THREE from 'three';
import { sound } from './audio';

export interface CharacterParts {
  bodyRoot: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftShoulder: THREE.Group;
  rightShoulder: THREE.Group;
  leftElbow: THREE.Group;
  rightElbow: THREE.Group;
  leftHip: THREE.Group;
  rightHip: THREE.Group;
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  rightHand: THREE.Mesh;
}

export interface CharacterController {
  group: THREE.Group;
  flashlight: THREE.SpotLight;
  flashlightTarget: THREE.Object3D;
  parts: CharacterParts;
  setManualPose: (enabled: boolean) => void;
  setStaffHeld: (held: boolean) => void;
  resetPose: () => void;
  update: (
    dt: number,
    velocity: THREE.Vector2,
    isSprinting: boolean,
    angularVelocity: number
  ) => void;
  dispose: () => void;
}

export function createCharacter(): CharacterController {
  const root = new THREE.Group();

  // Reusable materials with crisp blocky Minecraft-style explorer look (matching Math Teacher)
  const jacketMat = new THREE.MeshStandardMaterial({
    color: 0x1f3d42,
    roughness: 0.78,
    metalness: 0.08,
  });
  const jacketTrimMat = new THREE.MeshStandardMaterial({
    color: 0x2f5a62,
    roughness: 0.72,
    metalness: 0.12,
  });
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xd8a87e,
    roughness: 0.8,
  });
  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x1e1916,
    roughness: 0.9,
  });
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111518 });
  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xf4f7f8 });
  const pantsMat = new THREE.MeshStandardMaterial({
    color: 0x192024,
    roughness: 0.85,
  });
  const bootsMat = new THREE.MeshStandardMaterial({
    color: 0x111315,
    roughness: 0.7,
    metalness: 0.18,
  });
  const gearMat = new THREE.MeshStandardMaterial({
    color: 0x82643a,
    roughness: 0.8,
  });
  const metalMat = new THREE.MeshStandardMaterial({
    color: 0xa8b4b7,
    roughness: 0.35,
    metalness: 0.8,
  });
  const lampGlowMat = new THREE.MeshBasicMaterial({ color: 0x6fffea });

  // 1. Soft contact shadow plane beneath player
  const shadowGeo = new THREE.PlaneGeometry(1.25, 1.25);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d')!;
  const grad = sctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  sctx.fillStyle = grad;
  sctx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  shadowTex.colorSpace = THREE.SRGBColorSpace;
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
  shadowMesh.rotation.x = -Math.PI / 2;
  shadowMesh.position.y = 0.02;
  root.add(shadowMesh);

  // 2. Base Character Pivot (for bobbing & sway)
  const bodyRoot = new THREE.Group();
  root.add(bodyRoot);

  // 3. Blocky Pelvis & Belt (aligned with Guru Matematika's crisp cube style)
  const pelvis = new THREE.Mesh(
    new THREE.BoxGeometry(0.50, 0.18, 0.28),
    pantsMat
  );
  pelvis.position.y = 0.87;
  bodyRoot.add(pelvis);

  const belt = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.08, 0.30),
    new THREE.MeshStandardMaterial({ color: 0x221d17, roughness: 0.7 })
  );
  belt.position.y = 0.94;
  bodyRoot.add(belt);

  const buckle = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.07, 0.03),
    metalMat
  );
  buckle.position.set(0, 0.94, -0.158);
  bodyRoot.add(buckle);

  // 4. Blocky Torso & Explorer Jacket (pivots at bottom waist y = 0.97)
  const torso = new THREE.Group();
  torso.position.y = 0.97;
  bodyRoot.add(torso);

  const chest = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.64, 0.28),
    jacketMat
  );
  chest.position.y = 0.32;
  chest.castShadow = true;
  torso.add(chest);

  // Jacket Trim / Lapels & Zipper on front (-Z)
  const zipper = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.60, 0.025),
    metalMat
  );
  zipper.position.set(0, 0.31, -0.148);
  torso.add(zipper);

  const leftPocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.025),
    jacketTrimMat
  );
  leftPocket.position.set(-0.14, 0.18, -0.148);
  torso.add(leftPocket);

  const rightPocket = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.14, 0.025),
    jacketTrimMat
  );
  rightPocket.position.set(0.14, 0.18, -0.148);
  torso.add(rightPocket);

  // Blocky Collar
  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.08, 0.26),
    jacketTrimMat
  );
  collar.position.set(0, 0.65, -0.01);
  torso.add(collar);

  // 5. Blocky Tactical Backpack
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 0.32, 0.23);
  torso.add(backpackGroup);

  const packMain = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.48, 0.18),
    gearMat
  );
  packMain.castShadow = true;
  backpackGroup.add(packMain);

  const bedroll = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.12, 0.14),
    new THREE.MeshStandardMaterial({ color: 0x4a4332, roughness: 0.9 })
  );
  bedroll.position.set(0, -0.28, 0.02);
  backpackGroup.add(bedroll);

  const antenna = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, 0.30, 0.02),
    metalMat
  );
  antenna.position.set(0.17, 0.36, 0.02);
  backpackGroup.add(antenna);

  const antennaTip = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.045, 0.045),
    lampGlowMat
  );
  antennaTip.position.set(0.17, 0.52, 0.02);
  backpackGroup.add(antennaTip);

  // 6. Blocky Minecraft-Style Head, Hair, Eyes & Explorer Cap
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.69, 0);
  torso.add(headGroup);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.42, 0.42),
    skinMat
  );
  head.position.y = 0.21;
  head.castShadow = true;
  headGroup.add(head);

  // Crisp blocky eyes on front (-Z)
  const lEyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.02), eyeWhiteMat);
  lEyeWhite.position.set(-0.10, 0.21, -0.212);
  headGroup.add(lEyeWhite);
  const lPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.025), eyeMat);
  lPupil.position.set(-0.09, 0.21, -0.215);
  headGroup.add(lPupil);

  const rEyeWhite = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.02), eyeWhiteMat);
  rEyeWhite.position.set(0.10, 0.21, -0.212);
  headGroup.add(rEyeWhite);
  const rPupil = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.025), eyeMat);
  rPupil.position.set(0.09, 0.21, -0.215);
  headGroup.add(rPupil);

  const mouth = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.03, 0.02),
    new THREE.MeshStandardMaterial({ color: 0x7b4c39, roughness: 0.9 })
  );
  mouth.position.set(0, 0.10, -0.212);
  headGroup.add(mouth);

  // Blocky Hair + Explorer Cap
  const capTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.14, 0.45),
    hairMat
  );
  capTop.position.set(0, 0.39, 0);
  headGroup.add(capTop);

  const backHair = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.22, 0.08),
    hairMat
  );
  backHair.position.set(0, 0.24, 0.19);
  headGroup.add(backHair);

  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.36, 0.04, 0.16),
    hairMat
  );
  visor.position.set(0, 0.34, -0.26);
  visor.rotation.x = 0.08;
  headGroup.add(visor);

  // Blocky Headlamp
  const headlamp = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.08, 0.06),
    metalMat
  );
  headlamp.position.set(0, 0.40, -0.24);
  headGroup.add(headlamp);

  const lampLens = new THREE.Mesh(
    new THREE.BoxGeometry(0.065, 0.05, 0.025),
    lampGlowMat
  );
  lampLens.position.set(0, 0.40, -0.275);
  headGroup.add(lampLens);

  // Dynamic Flashlight / Spotlight casting forward beam
  const flashlight = new THREE.SpotLight(0xfff6cf, 4.0, 18, Math.PI / 4.5, 0.5, 1.4);
  flashlight.position.set(0, 0.40, -0.28);
  flashlight.castShadow = false;

  const flashlightTarget = new THREE.Object3D();
  flashlightTarget.position.set(0, 0.30, -6);
  headGroup.add(flashlightTarget);
  flashlight.target = flashlightTarget;
  headGroup.add(flashlight);

  // 7. Blocky Articulated Arms (Left & Right)
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.35, 0.56, 0);
  torso.add(leftShoulder);

  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.35, 0.56, 0);
  torso.add(rightShoulder);

  function createBlockyArm() {
    const armGroup = new THREE.Group();

    const upperArm = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.32, 0.16),
      jacketMat
    );
    upperArm.position.y = -0.15;
    upperArm.castShadow = true;
    armGroup.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.y = -0.30;
    armGroup.add(elbow);

    const forearm = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.25, 0.15),
      jacketTrimMat
    );
    forearm.position.y = -0.125;
    forearm.castShadow = true;
    elbow.add(forearm);

    const hand = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.13, 0.14),
      skinMat
    );
    hand.position.y = -0.31;
    elbow.add(hand);

    return { armGroup, elbow, hand };
  }

  const leftArm = createBlockyArm();
  leftShoulder.add(leftArm.armGroup);

  const rightArm = createBlockyArm();
  rightShoulder.add(rightArm.armGroup);

  // Scanner / field tablet held in left hand
  const scanner = new THREE.Mesh(
    new THREE.BoxGeometry(0.16, 0.03, 0.22),
    metalMat
  );
  scanner.position.set(0, -0.04, -0.08);
  scanner.rotation.x = -0.3;
  leftArm.hand.add(scanner);

  const scannerScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.12, 0.16),
    new THREE.MeshBasicMaterial({ color: 0x4dffe3 })
  );
  scannerScreen.rotation.x = -Math.PI / 2;
  scannerScreen.position.set(0, 0.017, -0.08);
  leftArm.hand.add(scannerScreen);

  // 8. Blocky Articulated Legs (Left & Right)
  const leftHip = new THREE.Group();
  leftHip.position.set(-0.14, 0.84, 0);
  bodyRoot.add(leftHip);

  const rightHip = new THREE.Group();
  rightHip.position.set(0.14, 0.84, 0);
  bodyRoot.add(rightHip);

  function createBlockyLeg() {
    const legGroup = new THREE.Group();

    const thigh = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.40, 0.21),
      pantsMat
    );
    thigh.position.y = -0.20;
    thigh.castShadow = true;
    legGroup.add(thigh);

    const knee = new THREE.Group();
    knee.position.y = -0.39;
    legGroup.add(knee);

    const kneePad = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.10, 0.04),
      gearMat
    );
    kneePad.position.set(0, 0, -0.11);
    knee.add(kneePad);

    const shin = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.34, 0.20),
      pantsMat
    );
    shin.position.y = -0.17;
    shin.castShadow = true;
    knee.add(shin);

    const ankle = new THREE.Group();
    ankle.position.y = -0.36;
    knee.add(ankle);

    const boot = new THREE.Mesh(
      new THREE.BoxGeometry(0.21, 0.14, 0.28),
      bootsMat
    );
    boot.position.set(0, -0.02, -0.04);
    boot.castShadow = true;
    ankle.add(boot);

    return { legGroup, knee, ankle };
  }

  const leftLeg = createBlockyLeg();
  leftHip.add(leftLeg.legGroup);

  const rightLeg = createBlockyLeg();
  rightHip.add(rightLeg.legGroup);

  // Kinematic state accumulators
  let walkTimer = 0;
  let idleTimer = 0;
  let lastStepPhase = 0;
  let manualPose = false;
  let staffHeld = false;

  function setManualPose(enabled: boolean) {
    manualPose = enabled;
  }

  function setStaffHeld(held: boolean) {
    staffHeld = held;
  }

  function resetPose() {
    manualPose = false;
    staffHeld = false;
    bodyRoot.position.set(0, 0, 0);
    bodyRoot.rotation.set(0, 0, 0);
    torso.rotation.set(0, 0, 0);
    headGroup.rotation.set(0, 0, 0);
    leftShoulder.rotation.set(0, 0, 0);
    rightShoulder.rotation.set(0, 0, 0);
    leftArm.elbow.rotation.set(0, 0, 0);
    rightArm.elbow.rotation.set(0, 0, 0);
    leftHip.rotation.set(0, 0, 0);
    rightHip.rotation.set(0, 0, 0);
    leftLeg.knee.rotation.set(0, 0, 0);
    rightLeg.knee.rotation.set(0, 0, 0);
  }

  function update(
    dt: number,
    velocity: THREE.Vector2,
    isSprinting: boolean,
    _angularVelocity: number
  ) {
    if (manualPose) return;
    const speed = velocity.length();
    const isMoving = speed > 0.08;

    if (isMoving) {
      const strideFreq = (isSprinting ? 12.5 : 8.5) * Math.min(speed / 3.0, 1.8);
      walkTimer += dt * strideFreq;

      const strideAmp = isSprinting ? 0.72 : 0.52;
      const armAmp = isSprinting ? 0.85 : 0.6;
      const legSin = Math.sin(walkTimer);

      const currentPhase = Math.sin(walkTimer);
      if (
        (lastStepPhase <= 0 && currentPhase > 0) ||
        (lastStepPhase >= 0 && currentPhase < 0)
      ) {
        sound.playFootstep(isSprinting);
      }
      lastStepPhase = currentPhase;

      leftHip.rotation.x = legSin * strideAmp;
      rightHip.rotation.x = -legSin * strideAmp;

      leftLeg.knee.rotation.x = -Math.max(0, -leftHip.rotation.x * 1.15);
      rightLeg.knee.rotation.x = -Math.max(0, -rightHip.rotation.x * 1.15);

      leftShoulder.rotation.x = -legSin * armAmp;
      leftArm.elbow.rotation.x = 0.25;
      if (staffHeld) {
        rightShoulder.rotation.x = 1.18 + Math.sin(walkTimer) * 0.06;
        rightArm.elbow.rotation.x = 0.20;
      } else {
        rightShoulder.rotation.x = legSin * armAmp;
        rightArm.elbow.rotation.x = 0.25;
      }

      const bobAmount = isSprinting ? 0.04 : 0.025;
      bodyRoot.position.y = Math.abs(Math.sin(walkTimer)) * bobAmount;
      bodyRoot.rotation.z = 0;
      root.rotation.z = 0;
      bodyRoot.rotation.y = Math.sin(walkTimer) * (isSprinting ? 0.04 : 0.02);

      // Subtle forward lean toward -Z when moving
      const targetTorsoTilt = isSprinting ? -0.10 : -0.04;
      torso.rotation.x = THREE.MathUtils.damp(
        torso.rotation.x,
        targetTorsoTilt,
        10,
        dt
      );
    } else {
      idleTimer += dt;
      lastStepPhase = 0;

      leftHip.rotation.x = THREE.MathUtils.damp(leftHip.rotation.x, 0, 10, dt);
      rightHip.rotation.x = THREE.MathUtils.damp(rightHip.rotation.x, 0, 10, dt);
      leftLeg.knee.rotation.x = THREE.MathUtils.damp(leftLeg.knee.rotation.x, 0, 10, dt);
      rightLeg.knee.rotation.x = THREE.MathUtils.damp(rightLeg.knee.rotation.x, 0, 10, dt);

      leftShoulder.rotation.x = THREE.MathUtils.damp(leftShoulder.rotation.x, 0, 8, dt);
      leftArm.elbow.rotation.x = THREE.MathUtils.damp(leftArm.elbow.rotation.x, 0.15, 8, dt);
      if (staffHeld) {
        rightShoulder.rotation.x = THREE.MathUtils.damp(rightShoulder.rotation.x, 1.24, 10, dt);
        rightArm.elbow.rotation.x = THREE.MathUtils.damp(rightArm.elbow.rotation.x, 0.18, 10, dt);
      } else {
        rightShoulder.rotation.x = THREE.MathUtils.damp(rightShoulder.rotation.x, 0, 8, dt);
        rightArm.elbow.rotation.x = THREE.MathUtils.damp(rightArm.elbow.rotation.x, 0.15, 8, dt);
      }

      const breath = Math.sin(idleTimer * 2.2);
      bodyRoot.position.y = THREE.MathUtils.damp(
        bodyRoot.position.y,
        breath * 0.012,
        6,
        dt
      );
      torso.rotation.x = THREE.MathUtils.damp(torso.rotation.x, 0, 8, dt);
      bodyRoot.rotation.y = THREE.MathUtils.damp(bodyRoot.rotation.y, 0, 8, dt);
      bodyRoot.rotation.z = 0;
      root.rotation.z = 0;
    }
  }

  function dispose() {
    shadowTex.dispose();
  }

  return {
    group: root,
    flashlight,
    flashlightTarget,
    parts: {
      bodyRoot,
      torso,
      headGroup,
      leftShoulder,
      rightShoulder,
      leftElbow: leftArm.elbow,
      rightElbow: rightArm.elbow,
      leftHip,
      rightHip,
      leftKnee: leftLeg.knee,
      rightKnee: rightLeg.knee,
      rightHand: rightArm.hand,
    },
    setManualPose,
    setStaffHeld,
    resetPose,
    update,
    dispose,
  };
}
