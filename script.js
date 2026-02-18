if (!window.THREE) {
  throw new Error("THREE is not available. loader.js must load Three.js before script.js.");
}

const THREE = window.THREE;

const LEVELS = [
  [0, 1, 3, 2, null],
  [0, 2, 1, 3, null],
  [0, 2, 3, 1, null],
  [1, 3, 0, null, 2],
  [3, 2, 0, null, 1],
  [3, 2, null, 1, 0],
];

const container = document.getElementById("scene");
const levelLabel = document.getElementById("levelLabel");
const crossingsLabel = document.getElementById("crossingsLabel");
const hintLabel = document.getElementById("hintLabel");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const nextBtn = document.getElementById("nextBtn");

const PEG_Y = [2.6, 1.35, 0.1, -1.15, -2.4];
const WRAP_Y = [1.2, 0.45, -0.3, -1.05];
const ROPE_ANCHOR_X = -4.82;
const ROPE_END_X = 4.72;

const pegNodes = [];
const ropeStates = [];
const ropeTextures = [];
const ropeBumpTextures = [];
const ropeMaterials = [];
const confettiPalette = ["#f6d38e", "#f1bc5e", "#e7904a", "#d26a39", "#fff0c2", "#ba6f43"];

let levelIndex = 0;
let slots = [];
let selectedPeg = -1;
let pendingComplete = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8dbc7);
scene.fog = new THREE.Fog(0xe8dbc7, 10, 28);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 80);
camera.position.set(0.3, 0.25, 15.8);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.04;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.style.touchAction = "manipulation";
container.appendChild(renderer.domElement);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();

function createCapsule(radius, length, capSegments = 6, radialSegments = 10) {
  if (THREE.CapsuleGeometry) {
    return new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments);
  }
  return new THREE.CylinderGeometry(radius, radius, length + radius * 2, radialSegments);
}

function makeWoodTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");

  const g = ctx.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, "#8c542f");
  g.addColorStop(0.5, "#7a4525");
  g.addColorStop(1, "#66391f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 180; i += 1) {
    const y = i * 3 + Math.random() * 2;
    const alpha = 0.05 + Math.random() * 0.05;
    ctx.strokeStyle = `rgba(40, 20, 8, ${alpha})`;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(130, y + 1, 250, y - 1, 512, y + 0.8);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1.6);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

function makeRopeMaps(seed = 0) {
  const w = 1024;
  const h = 128;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = w;
  colorCanvas.height = h;
  const c = colorCanvas.getContext("2d");

  const cg = c.createLinearGradient(0, 0, 0, h);
  cg.addColorStop(0, "#cba36f");
  cg.addColorStop(0.5, "#a97643");
  cg.addColorStop(1, "#81542f");
  c.fillStyle = cg;
  c.fillRect(0, 0, w, h);

  for (let i = -220 + seed * 3; i < w + 220; i += 26) {
    c.strokeStyle = "rgba(243, 222, 180, 0.34)";
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(i, h);
    c.lineTo(i + 84, 0);
    c.stroke();

    c.strokeStyle = "rgba(96, 63, 29, 0.27)";
    c.lineWidth = 7;
    c.beginPath();
    c.moveTo(i + 13, h);
    c.lineTo(i + 98, 0);
    c.stroke();
  }

  for (let i = 0; i < 420; i += 1) {
    const x = (i * 37 + seed * 73) % w;
    const y = (i * 53 + seed * 29) % h;
    c.fillStyle = i % 2 === 0 ? "rgba(252, 233, 191, 0.18)" : "rgba(70, 45, 21, 0.13)";
    c.fillRect(x, y, 2, 1);
  }

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const b = bumpCanvas.getContext("2d");
  b.fillStyle = "#7f7f7f";
  b.fillRect(0, 0, w, h);

  for (let i = -220 + seed * 3; i < w + 220; i += 26) {
    b.strokeStyle = "rgba(220, 220, 220, 0.42)";
    b.lineWidth = 8;
    b.beginPath();
    b.moveTo(i, h);
    b.lineTo(i + 84, 0);
    b.stroke();

    b.strokeStyle = "rgba(40, 40, 40, 0.38)";
    b.lineWidth = 8;
    b.beginPath();
    b.moveTo(i + 12, h);
    b.lineTo(i + 96, 0);
    b.stroke();
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.RepeatWrapping;
  colorTexture.repeat.set(6.8, 1.28);
  colorTexture.offset.x = seed * 0.003;
  colorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.RepeatWrapping;
  bumpTexture.repeat.set(6.8, 1.28);
  bumpTexture.offset.x = seed * 0.003;
  bumpTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return { colorTexture, bumpTexture };
}

function makeSkinMaps() {
  const w = 512;
  const h = 512;

  const colorCanvas = document.createElement("canvas");
  colorCanvas.width = w;
  colorCanvas.height = h;
  const c = colorCanvas.getContext("2d");

  const g = c.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#d9a781");
  g.addColorStop(0.5, "#c38e68");
  g.addColorStop(1, "#ae7a5b");
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);

  for (let i = 0; i < 2300; i += 1) {
    const x = (i * 37) % w;
    const y = (i * 71) % h;
    const a = i % 3 === 0 ? 0.045 : 0.028;
    c.fillStyle = `rgba(246, 213, 186, ${a})`;
    c.fillRect(x, y, 2, 2);
  }

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = w;
  bumpCanvas.height = h;
  const b = bumpCanvas.getContext("2d");
  b.fillStyle = "#7f7f7f";
  b.fillRect(0, 0, w, h);

  for (let i = 0; i < 2600; i += 1) {
    const x = (i * 41) % w;
    const y = (i * 97) % h;
    b.fillStyle = i % 2 === 0 ? "rgba(155,155,155,0.12)" : "rgba(95,95,95,0.11)";
    b.fillRect(x, y, 1, 1);
  }

  const colorTexture = new THREE.CanvasTexture(colorCanvas);
  colorTexture.colorSpace = THREE.SRGBColorSpace;
  colorTexture.wrapS = THREE.RepeatWrapping;
  colorTexture.wrapT = THREE.RepeatWrapping;
  colorTexture.repeat.set(1.2, 1.2);
  colorTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  const bumpTexture = new THREE.CanvasTexture(bumpCanvas);
  bumpTexture.wrapS = THREE.RepeatWrapping;
  bumpTexture.wrapT = THREE.RepeatWrapping;
  bumpTexture.repeat.set(1.2, 1.2);
  bumpTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();

  return { colorTexture, bumpTexture };
}

const woodTexture = makeWoodTexture();

function addLights() {
  const hemi = new THREE.HemisphereLight(0xffefd8, 0x7c5b3b, 0.74);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff1dc, 1.15);
  key.position.set(-5, 9, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 35;
  key.shadow.camera.left = -14;
  key.shadow.camera.right = 14;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -10;
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xf7d4aa, 0.48);
  rim.position.set(9, 2, -8);
  scene.add(rim);
}

function buildGround() {
  const geo = new THREE.PlaneGeometry(36, 18);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xe2d3bd,
    roughness: 0.98,
    metalness: 0,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, -0.1, -1.8);
  mesh.receiveShadow = true;
  scene.add(mesh);
}

function buildContactShadows() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const g = ctx.createRadialGradient(256, 128, 20, 256, 128, 220);
  g.addColorStop(0, "rgba(0,0,0,0.24)");
  g.addColorStop(0.5, "rgba(0,0,0,0.12)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.42,
  });

  const wristShadow = new THREE.Mesh(new THREE.PlaneGeometry(6.3, 4.1), mat);
  wristShadow.position.set(-4.85, -0.4, -1.34);
  scene.add(wristShadow);
}

function buildRopeMaterials() {
  const colors = [0xb8864f, 0xb17f49, 0xbe8c55, 0xae7a43];
  for (let i = 0; i < 4; i += 1) {
    const maps = makeRopeMaps(i * 11);
    ropeTextures.push(maps.colorTexture);
    ropeBumpTextures.push(maps.bumpTexture);

    const material = new THREE.MeshStandardMaterial({
      color: colors[i],
      map: maps.colorTexture,
      bumpMap: maps.bumpTexture,
      bumpScale: 0.16,
      roughness: 0.8,
      metalness: 0.02,
    });
    ropeMaterials.push(material);
  }
}

function buildPole() {
  const poleGeo = new THREE.BoxGeometry(2.35, 11.3, 1.25);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x7a4b2a,
    map: woodTexture,
    roughness: 0.84,
    metalness: 0.04,
  });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.set(6.05, 0.2, 0);
  pole.castShadow = true;
  pole.receiveShadow = true;
  scene.add(pole);

  for (let i = 0; i < 5; i += 1) {
    const y = PEG_Y[i];

    const outerMat = new THREE.MeshStandardMaterial({
      color: 0xd8b983,
      roughness: 0.42,
      metalness: 0.12,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.56, 0.36, 34), outerMat);
    outer.rotation.z = Math.PI / 2;
    outer.position.set(4.95, y, 0);
    outer.castShadow = true;
    outer.receiveShadow = true;
    outer.userData.pegIndex = i;
    scene.add(outer);

    const innerMat = new THREE.MeshStandardMaterial({
      color: 0x6b3f1d,
      roughness: 0.5,
      metalness: 0.1,
    });
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.38, 30), innerMat);
    inner.rotation.z = Math.PI / 2;
    inner.position.set(4.85, y, 0);
    inner.castShadow = true;
    scene.add(inner);

    pegNodes.push({ outer, inner, outerMat, innerMat });
  }
}

function buildWrist() {
  const skinMaps = makeSkinMaps();

  const skinBaseMat = new THREE.MeshStandardMaterial({
    color: 0xcb9b75,
    map: skinMaps.colorTexture,
    bumpMap: skinMaps.bumpTexture,
    bumpScale: 0.02,
    roughness: 0.69,
    metalness: 0,
  });
  const skinShadowMat = new THREE.MeshStandardMaterial({
    color: 0xb88665,
    map: skinMaps.colorTexture,
    bumpMap: skinMaps.bumpTexture,
    bumpScale: 0.016,
    roughness: 0.75,
    metalness: 0,
  });
  const skinLightMat = new THREE.MeshStandardMaterial({
    color: 0xe1b994,
    map: skinMaps.colorTexture,
    bumpMap: skinMaps.bumpTexture,
    bumpScale: 0.014,
    roughness: 0.6,
    metalness: 0,
  });

  const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.79, 6.55, 44), skinBaseMat);
  forearm.position.set(-5.94, -2.52, -0.04);
  forearm.rotation.z = 0.012;
  forearm.castShadow = true;
  forearm.receiveShadow = true;
  scene.add(forearm);

  const wristNeck = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.67, 1.1, 38), skinShadowMat);
  wristNeck.position.set(-5.92, 0.72, 0.02);
  wristNeck.castShadow = true;
  wristNeck.receiveShadow = true;
  scene.add(wristNeck);

  const fistMass = new THREE.Mesh(new THREE.SphereGeometry(0.89, 46, 30), skinBaseMat);
  fistMass.position.set(-5.78, 1.95, 0.17);
  fistMass.scale.set(1.17, 0.95, 0.88);
  fistMass.castShadow = true;
  fistMass.receiveShadow = true;
  scene.add(fistMass);

  const knucklePlate = new THREE.Mesh(createCapsule(0.22, 1.02, 8, 14), skinLightMat);
  knucklePlate.rotation.z = Math.PI / 2;
  knucklePlate.rotation.y = 0.08;
  knucklePlate.position.set(-5.8, 2.3, 0.46);
  knucklePlate.scale.set(1.02, 0.74, 0.74);
  knucklePlate.castShadow = true;
  scene.add(knucklePlate);

  const knuckleMat = new THREE.MeshStandardMaterial({
    color: 0xdcb593,
    map: skinMaps.colorTexture,
    bumpMap: skinMaps.bumpTexture,
    bumpScale: 0.012,
    roughness: 0.58,
  });

  for (let i = 0; i < 4; i += 1) {
    const k = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), knuckleMat);
    k.position.set(-6.18 + i * 0.27, 2.4 + i * 0.012, 0.58 - i * 0.015);
    k.scale.set(1.08, 0.82, 0.76);
    k.castShadow = true;
    scene.add(k);
  }

  const creaseMat = new THREE.MeshStandardMaterial({
    color: 0xa67054,
    roughness: 0.82,
    metalness: 0,
  });
  for (let i = 0; i < 3; i += 1) {
    const crease = new THREE.Mesh(createCapsule(0.045, 0.32, 6, 10), creaseMat);
    crease.rotation.z = Math.PI / 2;
    crease.rotation.y = 0.08;
    crease.position.set(-6.04 + i * 0.27, 2.25 + i * 0.01, 0.43);
    crease.castShadow = false;
    scene.add(crease);
  }

  const thumb = new THREE.Mesh(createCapsule(0.16, 0.56, 7, 12), skinLightMat);
  thumb.rotation.z = -0.95;
  thumb.rotation.x = 0.3;
  thumb.rotation.y = -0.26;
  thumb.position.set(-6.33, 1.92, 0.33);
  thumb.scale.set(1.0, 0.88, 0.76);
  thumb.castShadow = true;
  scene.add(thumb);

  const thumbTip = new THREE.Mesh(new THREE.SphereGeometry(0.13, 20, 16), skinLightMat);
  thumbTip.position.set(-6.45, 1.72, 0.41);
  thumbTip.castShadow = true;
  scene.add(thumbTip);

  const pressureMat = new THREE.MeshBasicMaterial({
    color: 0x6e4227,
    transparent: true,
    opacity: 0.11,
    depthWrite: false,
  });

  for (let i = 0; i < 4; i += 1) {
    const radius = 0.92 - i * 0.035;
    const loop = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.14, 22, 84), ropeMaterials[i]);
    loop.rotation.x = Math.PI / 2;
    loop.scale.y = 0.92;
    loop.position.set(-5.9, WRAP_Y[i], 0.02);
    loop.castShadow = true;
    scene.add(loop);

    const pressure = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.015, 0.16, 16, 72), pressureMat);
    pressure.rotation.x = Math.PI / 2;
    pressure.scale.y = 0.89;
    pressure.position.set(-5.9, WRAP_Y[i] - 0.05, -0.01);
    scene.add(pressure);

    const knot = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 14),
      new THREE.MeshStandardMaterial({ color: 0xa97643, roughness: 0.72 }),
    );
    knot.position.set(-4.9, WRAP_Y[i], 0.1 - i * 0.04);
    knot.castShadow = true;
    scene.add(knot);
  }
}

function buildRopes() {
  for (let i = 0; i < 4; i += 1) {
    const state = {
      mesh: null,
      startPos: new THREE.Vector3(),
      targetPos: new THREE.Vector3(),
      currentPos: new THREE.Vector3(),
      lerp: 1,
    };

    const dummyCurve = new THREE.LineCurve3(getAnchorPoint(i), getAnchorPoint(i));
    const dummyGeo = new THREE.TubeGeometry(dummyCurve, 4, 0.15, 14, false);
    const mesh = new THREE.Mesh(dummyGeo, ropeMaterials[i]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    state.mesh = mesh;
    ropeStates.push(state);
  }
}

function getAnchorPoint(ropeIdx) {
  return new THREE.Vector3(ROPE_ANCHOR_X, WRAP_Y[ropeIdx], 0.18 - ropeIdx * 0.05);
}

function getPegPoint(slotIdx) {
  return new THREE.Vector3(ROPE_END_X, PEG_Y[slotIdx], 0);
}

function setRopeTarget(ropeIdx, slotIdx, instant = false) {
  const state = ropeStates[ropeIdx];
  const target = getPegPoint(slotIdx);

  if (instant) {
    state.startPos.copy(target);
    state.targetPos.copy(target);
    state.currentPos.copy(target);
    state.lerp = 1;
    updateRopeGeometry(ropeIdx);
    return;
  }

  state.startPos.copy(state.currentPos);
  state.targetPos.copy(target);
  state.lerp = 0;
}

function updateRopeGeometry(ropeIdx) {
  const state = ropeStates[ropeIdx];
  const anchor = getAnchorPoint(ropeIdx);
  const end = state.currentPos;

  const rise = end.y - anchor.y;
  const zBias = (ropeIdx - 1.5) * 0.05;
  const c1 = new THREE.Vector3(anchor.x + 2.05, anchor.y + 0.6 + rise * 0.18, 0.44 + zBias);
  const c2 = new THREE.Vector3(end.x - 2.45, end.y - 0.34 - rise * 0.2, 0.34 + zBias * 0.5);

  const curve = new THREE.CatmullRomCurve3([
    anchor,
    new THREE.Vector3(anchor.x + 1.06, anchor.y, 0.4 + zBias),
    c1,
    c2,
    new THREE.Vector3(end.x - 0.58, end.y, 0.15 + zBias * 0.3),
    end,
  ]);

  const geometry = new THREE.TubeGeometry(curve, 88, 0.15, 16, false);
  state.mesh.geometry.dispose();
  state.mesh.geometry = geometry;
}

function getRopeToSlotMap() {
  const map = Array(4).fill(-1);
  slots.forEach((ropeId, slotIdx) => {
    if (ropeId !== null) map[ropeId] = slotIdx;
  });
  return map;
}

function countCrossings() {
  const map = getRopeToSlotMap();
  let crossings = 0;
  for (let i = 0; i < map.length; i += 1) {
    for (let j = i + 1; j < map.length; j += 1) {
      if (map[i] > map[j]) crossings += 1;
    }
  }
  return crossings;
}

function isAnimating() {
  return ropeStates.some((state) => state.lerp < 1);
}

function updateLevelLabel() {
  levelLabel.textContent = `Bana ${levelIndex + 1}/${LEVELS.length}`;
}

function updateCrossingsLabel() {
  const c = countCrossings();
  crossingsLabel.textContent = `Korsningar kvar: ${c}`;
  return c;
}

function setHint(text) {
  hintLabel.textContent = text;
}

function clearConfetti() {
  overlay.querySelectorAll(".confetti-piece").forEach((piece) => piece.remove());
}

function launchConfetti(pieceCount, isFinale) {
  const spread = isFinale ? 620 : 360;
  const duration = isFinale ? 2600 : 1500;

  for (let i = 0; i < pieceCount; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${6 + Math.random() * 88}%`;
    piece.style.backgroundColor = confettiPalette[i % confettiPalette.length];
    piece.style.animationDuration = `${duration + Math.random() * 700}ms`;
    piece.style.animationDelay = `${Math.random() * 240}ms`;
    piece.style.setProperty("--drift", `${(Math.random() - 0.5) * spread}px`);
    piece.style.setProperty("--spin", `${Math.random() * 900 - 450}deg`);
    piece.style.opacity = `${0.75 + Math.random() * 0.25}`;
    overlay.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove());
  }
}

function updatePegVisuals() {
  const emptyIdx = slots.indexOf(null);
  pegNodes.forEach((node, idx) => {
    const occupied = slots[idx] !== null;
    const selected = selectedPeg === idx;

    if (selected) {
      node.outerMat.color.setHex(0xf0cf95);
      node.outerMat.emissive.setHex(0x3d2a13);
      node.outerMat.emissiveIntensity = 0.24;
      node.outer.scale.setScalar(1.08);
    } else if (!occupied) {
      node.outerMat.color.setHex(0xb08f61);
      node.outerMat.emissive.setHex(0x4b3116);
      node.outerMat.emissiveIntensity = 0.12;
      node.outer.scale.setScalar(1);
    } else {
      node.outerMat.color.setHex(0xd8b983);
      node.outerMat.emissive.setHex(0x000000);
      node.outerMat.emissiveIntensity = 0;
      node.outer.scale.setScalar(1);
    }

    node.innerMat.color.setHex(occupied ? 0x6b3f1d : 0x4b2f17);
    if (idx === emptyIdx && selectedPeg === -1 && !isAnimating()) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.045;
      node.outer.scale.setScalar(pulse);
    }
  });

  const selectedRope = selectedPeg === -1 ? -1 : slots[selectedPeg];
  ropeMaterials.forEach((mat, idx) => {
    if (idx === selectedRope) {
      mat.emissive.setHex(0x3a250f);
      mat.emissiveIntensity = 0.24;
    } else {
      mat.emissive.setHex(0x000000);
      mat.emissiveIntensity = 0;
    }
  });
}

function showLevelComplete() {
  if (!overlay.classList.contains("hidden")) return;
  const isFinale = levelIndex === LEVELS.length - 1;
  clearConfetti();
  overlay.classList.toggle("finale", isFinale);

  if (isFinale) {
    overlayTitle.textContent = "Du klarade allt!";
    overlayText.textContent = "Grattis, ditt pris finns att hämtas i Alvesta";
    nextBtn.textContent = "Spela igen";
    launchConfetti(170, true);
  } else {
    overlayTitle.textContent = "Grattis!";
    overlayText.textContent = "Grattis, du är nu ett steg närmare...";
    nextBtn.textContent = "Nästa bana";
    launchConfetti(42, false);
  }
  overlay.classList.remove("hidden");
}

function loadLevel(index) {
  levelIndex = index;
  slots = [...LEVELS[index]];
  selectedPeg = -1;
  pendingComplete = false;
  overlay.classList.add("hidden");
  overlay.classList.remove("finale");
  clearConfetti();

  for (let ropeIdx = 0; ropeIdx < 4; ropeIdx += 1) {
    const slotIdx = slots.indexOf(ropeIdx);
    setRopeTarget(ropeIdx, slotIdx, true);
  }

  updateLevelLabel();
  updateCrossingsLabel();
  setHint("Tryck på en repände, sedan på den tomma punkten.");
  updatePegVisuals();
}

function handleNext() {
  if (levelIndex === LEVELS.length - 1) {
    loadLevel(0);
    return;
  }
  loadLevel(levelIndex + 1);
}

function onPegClicked(pegIdx) {
  if (!overlay.classList.contains("hidden")) return;
  if (isAnimating()) return;

  const ropeId = slots[pegIdx];
  const emptyIdx = slots.indexOf(null);

  if (ropeId !== null) {
    selectedPeg = pegIdx;
    setHint("Bra! Tryck nu på den tomma punkten.");
    updatePegVisuals();
    return;
  }

  if (selectedPeg === -1) {
    setHint("Välj först en repände.");
    return;
  }

  if (pegIdx !== emptyIdx) return;

  const movingRope = slots[selectedPeg];
  slots[pegIdx] = movingRope;
  slots[selectedPeg] = null;

  selectedPeg = -1;
  setRopeTarget(movingRope, pegIdx, false);

  const crossings = updateCrossingsLabel();
  pendingComplete = crossings === 0;
  setHint(pendingComplete ? "Snyggt!" : "Fortsätt tills inga rep korsar varandra.");
  updatePegVisuals();
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = (event.clientX ?? 0) - rect.left;
  const y = (event.clientY ?? 0) - rect.top;

  pointer.x = (x / rect.width) * 2 - 1;
  pointer.y = -(y / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const clickables = pegNodes.map((node) => node.outer);
  const hit = raycaster.intersectObjects(clickables, false)[0];
  if (hit) {
    onPegClicked(hit.object.userData.pegIndex);
  }
}

function resize() {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 1 / 20);

  ropeStates.forEach((state, ropeIdx) => {
    if (state.lerp >= 1) return;
    state.lerp = Math.min(1, state.lerp + dt * 3.3);
    const eased = 1 - (1 - state.lerp) ** 3;
    state.currentPos.lerpVectors(state.startPos, state.targetPos, eased);
    updateRopeGeometry(ropeIdx);
  });

  ropeTextures.forEach((tex, idx) => {
    tex.offset.x += dt * (0.17 + idx * 0.018);
  });
  ropeBumpTextures.forEach((tex, idx) => {
    tex.offset.x += dt * (0.17 + idx * 0.018);
  });

  if (pendingComplete && !isAnimating()) {
    pendingComplete = false;
    showLevelComplete();
  }

  updatePegVisuals();
  renderer.render(scene, camera);
}

function init() {
  buildRopeMaterials();
  addLights();
  buildGround();
  buildContactShadows();
  buildPole();
  buildWrist();
  buildRopes();
  loadLevel(0);
  resize();
  animate();

  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("resize", resize);
  nextBtn.addEventListener("click", handleNext);
}

init();
