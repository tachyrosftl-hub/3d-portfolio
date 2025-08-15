import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/* ---------- DOM bits ---------- */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = new Date().getFullYear();

/* ---------- THREE: Scene setup ---------- */
const scene = new THREE.Scene();

// Night-space gradient background (canvas texture)
const bgTex = new THREE.CanvasTexture(makeGradientCanvas());
bgTex.colorSpace = THREE.SRGBColorSpace;
scene.background = bgTex;

function makeGradientCanvas() {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 1024;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 1024);
  grad.addColorStop(0, '#02050C');
  grad.addColorStop(1, '#0A1530');
  g.fillStyle = grad; g.fillRect(0,0,1024,1024);
  // subtle nebula haze
  const rad = g.createRadialGradient(780, 120, 50, 780, 120, 420);
  rad.addColorStop(0, 'rgba(0,229,255,0.10)');
  rad.addColorStop(1, 'transparent');
  g.fillStyle = rad; g.beginPath(); g.arc(780,120,420,0,Math.PI*2); g.fill();
  return c;
}

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.1, 1200);
camera.position.set(0, 0.2, 3);

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('bg'),
  antialias: true,
  powerPreference: 'high-performance'
});
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

/* ---------- Lighting (cinematic) ---------- */
const ambient = new THREE.AmbientLight(0xffffff, 0.42);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0x99ccff, 1.0);
keyLight.position.set(3, 4, 2);
scene.add(keyLight);

const rimLight = new THREE.DirectionalLight(0x00e5ff, 0.8);
rimLight.position.set(-3, 2, -2);
scene.add(rimLight);

const hemi = new THREE.HemisphereLight(0x88caff, 0x0b1533, 0.6);
scene.add(hemi);

/* ---------- Stars + Constellation Lines ---------- */
const stars = [];
const starGroup = new THREE.Group();
scene.add(starGroup);

function addStar() {
  const geo = new THREE.SphereGeometry(0.075, 10, 10);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x7fd0ff,
    emissiveIntensity: 0.35,
    metalness: 0.0,
    roughness: 0.9
  });
  const star = new THREE.Mesh(geo, mat);

  star.position.set(
    THREE.MathUtils.randFloatSpread(220),
    THREE.MathUtils.randFloatSpread(160),
    THREE.MathUtils.randFloat(-600, -60)
  );

  star.userData = {
    speed: THREE.MathUtils.randFloat(0.015, 0.04),
    driftX: THREE.MathUtils.randFloat(-0.003, 0.003),
    driftY: THREE.MathUtils.randFloat(-0.003, 0.003),
    twinklePhase: Math.random() * Math.PI * 2,
    twinkleSpeed: THREE.MathUtils.randFloat(0.6, 1.2)
  };

  stars.push(star);
  starGroup.add(star);
}
for (let i=0; i<320; i++) addStar();

// Constellation lines (sparse, short)
const lineMat = new THREE.LineBasicMaterial({ color: 0x6fe9ff, transparent:true, opacity:0.15 });
let lineGeo = new THREE.BufferGeometry();
let lineMesh = new THREE.LineSegments(lineGeo, lineMat);
starGroup.add(lineMesh);

function rebuildConstellations() {
  const pts = [];
  for (let i=0; i<stars.length; i+=8) {
    const a = stars[i].position;
    for (let j=i+8; j<stars.length; j+=8) {
      const b = stars[j].position;
      const d = a.distanceTo(b);
      if (d < 22 && Math.random() < 0.12) {
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
  }
  const pos = new Float32Array(pts);
  lineGeo.dispose();
  lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lineMesh.geometry = lineGeo;
}
rebuildConstellations();
setInterval(rebuildConstellations, 3000);

/* ---------- 3D Model ---------- */
const loader = new GLTFLoader();
let model;
loader.load(
  'https://drive.google.com/uc?export=download&id=1ttAhyQWznuOh05dKdNJYqJ9bdnODglhL',
  (gltf) => {
    model = gltf.scene;
    model.scale.set(0.35, 0.35, 0.35);
    model.position.set(0, -0.05, 0);
    scene.add(model);
  },
  undefined,
  (err) => console.error('Model load error:', err)
);

/* ---------- Controls ---------- */
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enableZoom = true;
controls.minDistance = 2;
controls.maxDistance = 6;
controls.enablePan = false;
controls.target.set(0, 0, 0);

let autoRotate = true;
controls.addEventListener('start', () => autoRotate = false);
controls.addEventListener('end',   () => autoRotate = true);

/* ---------- Mouse Parallax ---------- */
let mouseX = 0, mouseY = 0;
addEventListener('mousemove', (e) => {
  mouseX = (e.clientX / innerWidth) - 0.5;
  mouseY = (e.clientY / innerHeight) - 0.5;
});

/* ---------- Animate ---------- */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  // Model: mouse reactive + idle spin
  if (model) {
    const targetX = mouseY * 0.5;      // tilt up/down
    const targetY = mouseX * 0.6;      // turn left/right
    model.rotation.x += (targetX - model.rotation.x) * 0.05;
    model.rotation.y += (targetY - model.rotation.y) * 0.05;
    if (autoRotate) model.rotation.y += 0.0016;
  }

  // Stars update
  for (const s of stars) {
    s.position.z += s.userData.speed;
    s.position.x += s.userData.driftX;
    s.position.y += s.userData.driftY;

    // subtle parallax
    s.position.x += (mouseX * 0.05 - s.position.x * 0.0005);
    s.position.y += (-mouseY * 0.05 - s.position.y * 0.0005);

    // twinkle
    const tw = 0.25 + 0.25 * Math.sin(t * s.userData.twinkleSpeed + s.userData.twinklePhase);
    s.material.emissiveIntensity = 0.25 + tw;

    // recycle
    if (s.position.z > 6) {
      s.position.z = THREE.MathUtils.randFloat(-600, -80);
      s.position.x = THREE.MathUtils.randFloatSpread(220);
      s.position.y = THREE.MathUtils.randFloatSpread(160);
    }
  }

  controls.update();
  renderer.render(scene, camera);
}
animate();

/* ---------- Resize ---------- */
addEventListener('resize', () => {
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- Scroll reveal + active nav ---------- */
const sections = [...document.querySelectorAll('.panel')];
const navLinks = [...document.querySelectorAll('#navbar a')];

// Reveal
const io = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  }
}, { threshold: 0.2 });
sections.forEach(s => io.observe(s));

// Active link
addEventListener('scroll', () => {
  const y = scrollY + 80; // nav offset
  let current = sections[0].id;
  for (const sec of sections) {
    if (y >= sec.offsetTop && y < sec.offsetTop + sec.offsetHeight) {
      current = sec.id;
      break;
    }
  }
  navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${current}`));
});
