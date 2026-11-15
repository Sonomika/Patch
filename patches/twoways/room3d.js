/* TWO WAYS ROOM — the original three.js mirror room, unchanged, drawing into the ROOM screen of patch 12.
   Every hit is a tiny galaxy that gathers into its point and spreads out again (the same both ways), seen through
   a 3x3x3 hall of mirrored cells, with bloom. The camera is a pendulum that is still where the audio turns round. */
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
const DATA = TW_DATA, T = DATA.T;
const TCOL = [0x5ec962,0xff6b4a,0xff9a3d,0xff8fb1,0xbfe9ff,0x8f86ff,0xffd27a,0x9be7ff,0xffffff];
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05040f);
scene.fog = new THREE.FogExp2(0x05040f, 0.022);
const camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.05, 400);

// ---------- the mirror room ----------
const L = 10, R = 1;
const VIR = [[68,1,84],[59,82,139],[33,145,140],[94,201,98],[253,231,37]].map(c => c.map(v => v / 255));
function viridis(v){ v = Math.min(1, Math.max(0, v)) * 4; const i = Math.min(3, Math.floor(v)), f = v - i; return VIR[i].map((a, k) => a * (1 - f) + VIR[i + 1][k] * f); }
function rand(seed){ let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
// ---------- every hit is a tiny galaxy born from a point: it collapses in, flashes, and spirals out (a little big bang) ----------
// time-symmetric: the size grows with |time from the hit|, so it gathers exactly as it spreads; the spin flips with the twin,
// so the whole animation is still the same played backwards
const NPOP = [260, 150, 80], TAU = [0.34, 0.22, 0.13], GROW = [2.6, 2.0, 1.6], SIZE = [0.11, 0.085, 0.065];
const pos = [], uax = [], vax = [], prm = [], tcA = [], tauA = [], col = [], siz = [];
for (const [tc, band, s, g, id, sign, ty] of DATA.hits) {
  const r = rand(id + 1);
  const cx = (r() - 0.5) * L * 0.8, cz = (r() - 0.5) * L * 0.8, cy = -L * 0.42 + (band / 47) * L * 0.84;
  // a random tilt for this galaxy's disc
  const nz = new THREE.Vector3(r() - 0.5, r() * 0.8 + 0.2, r() - 0.5).normalize();
  const u = new THREE.Vector3().crossVectors(nz, new THREE.Vector3(0.3, 0.1, 1)).normalize(), v = new THREE.Vector3().crossVectors(nz, u);
  const arms = 2 + Math.floor(r() * 3), wind = 2.2 + r() * 2.5, spin = sign * (0.9 + r() * 1.6) * (r() < 0.5 ? 1 : -1);
  const GOLD = new THREE.Color(0xfde725), SKY = new THREE.Color(0x5ec9ff);
  const tint = new THREE.Color(TCOL[ty] ?? 0x8f86ff), core = new THREE.Color(0xfff3d6), blue = new THREE.Color(0x7aa8ff);
  const n = Math.round(NPOP[g] * (0.5 + s * 0.4) * 0.45);
  for (let i = 0; i <= n; i++) {
    let rr, th, c, sz;
    if (i === 0) { rr = 0; th = 0; c = core; sz = SIZE[g] * 7; }               // the bang itself
    else {
      rr = Math.pow(r(), 0.7);                                                // radius 0..1, denser at the centre
      const arm = Math.floor(r() * arms);
      th = arm * 2 * Math.PI / arms + wind * rr + (r() - 0.5) * 0.6 * (1 - rr * 0.5);   // spiral arms
      c = core.clone().lerp(r() < 0.5 ? GOLD : SKY, Math.min(1, rr * 1.6));   // gold and blue particles mixed in every galaxy (same draw for its twin)
      sz = SIZE[g] * (0.5 + r() * 0.9) * (1.2 - rr * 0.5);
    }
    pos.push(cx, cy, cz); uax.push(u.x, u.y, u.z); vax.push(v.x, v.y, v.z);
    prm.push(rr * GROW[g] * (0.6 + s * 0.5), th, spin, r() * 0.25);                      // radius scale, angle, spin, puff
    tcA.push(tc); tauA.push(TAU[g] * (i ? 0.9 + r() * 0.4 : 0.55)); col.push(c.r, c.g, c.b); siz.push(sz * (0.8 + s * 0.4));
  }
}
const geo = new THREE.BufferGeometry();
geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
geo.setAttribute("uax", new THREE.Float32BufferAttribute(uax, 3));
geo.setAttribute("vax", new THREE.Float32BufferAttribute(vax, 3));
geo.setAttribute("prm", new THREE.Float32BufferAttribute(prm, 4));
geo.setAttribute("tc", new THREE.Float32BufferAttribute(tcA, 1));
geo.setAttribute("tau", new THREE.Float32BufferAttribute(tauA, 1));
geo.setAttribute("col", new THREE.Float32BufferAttribute(col, 3));
geo.setAttribute("siz", new THREE.Float32BufferAttribute(siz, 1));
geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), L * 2);
const popMat = new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uT: { value: T }, uScale: { value: 1 } },
  vertexShader: `
    attribute vec3 uax; attribute vec3 vax; attribute vec4 prm; attribute float tc; attribute float tau; attribute vec3 col; attribute float siz;
    uniform float uTime, uT, uScale; varying vec3 vCol; varying float vA;
    void main(){
      float d = mod(uTime - tc + 0.5 * uT, uT) - 0.5 * uT;          // time from this galaxy's bang, wrapped round the loop
      float ad = abs(d);
      float a = exp(-ad / tau);
      float grow = 1.0 - exp(-ad * 3.0);                              // collapses into the point and bursts back out, same shape both ways
      float r = prm.x * grow * (1.0 + 2.5 * ad);
      float th = prm.y + prm.z * d;                                   // the disc turns as it grows
      vec3 p = position + (uax * cos(th) + vax * sin(th)) * r + cross(uax, vax) * prm.w * r * 0.3 * sin(prm.y * 7.0);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = a < 0.004 ? 0.0 : min(siz * uScale * (0.5 + 0.5 * a) / -mv.z, 46.0 * uScale / 900.0);
      vCol = col; vA = a;
    }`,
  fragmentShader: `
    varying vec3 vCol; varying float vA;
    void main(){ vec2 q = gl_PointCoord - 0.5; float r = dot(q, q) * 4.0; if (r > 1.0) discard;
      gl_FragColor = vec4(vCol * exp(-r * 3.0) * vA * 1.3, 1.0); }`,
  blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false
});
const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(L, L, L)), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.13, depthWrite: false, depthTest: false }));
const grid = new THREE.GridHelper(L, 10, 0x3a3a3a, 0x3a3a3a); grid.position.y = -L / 2; grid.material.transparent = true; grid.material.opacity = 0.35; grid.material.depthWrite = false; grid.material.depthTest = false;   // neighbouring mirror cells share these lines: no depth fighting
for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) for (let k = -R; k <= R; k++) {
  const cell = new THREE.Group(); cell.position.set(i * L, j * L, k * L); cell.scale.set(i % 2 ? -1 : 1, j % 2 ? -1 : 1, k % 2 ? -1 : 1);
  const pts = new THREE.Points(geo, popMat); pts.frustumCulled = false; cell.add(pts, edges.clone(), grid.clone()); scene.add(cell);
}
let composer = null, bloom = null;
function makeComposer(){
  composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));   // 4x MSAA: smooth grid lines
  composer.addPass(new RenderPass(scene, camera));
  bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.55, 0.08); composer.addPass(bloom);
}

// camera: a pendulum that is still at each end, and each end falls where the audio turns round
function placeCamera(passTime){                       // passTime: time along the forward pass, 0..T
  const swing = Math.cos(2 * Math.PI * passTime / T), az = 0.95 * swing, el = 0.16 + 0.1 * swing * swing, rad = 3.9;
  camera.position.set(Math.sin(az) * rad * Math.cos(el), Math.sin(el) * rad, Math.cos(az) * rad * Math.cos(el)); camera.lookAt(0, -0.2, 0);
}
function renderAt(passTime){ popMat.uniforms.uTime.value = passTime; placeCamera(passTime); composer.render(); }
// ---------- hooked to the patch: one renderer per ROOM canvas, sized to the screen it sits in ----------
let renderer = null, rcanvas = null, size = '';
function draw(canvas, passTime){
  if (canvas !== rcanvas) {
    try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }); }
    catch (e) { window.TW_ROOM.err = String(e); return; }
    rcanvas = canvas; size = ''; makeComposer();
  }
  const r = canvas.getBoundingClientRect(), pr = Math.min(2, devicePixelRatio || 1);
  const SW = Math.max(2, Math.round(r.width || canvas.clientWidth || 320)), SH = Math.max(2, Math.round(r.height || canvas.clientHeight || 180)), key = SW + 'x' + SH + '@' + pr;
  if (key !== size) {
    size = key;
    renderer.setPixelRatio(pr); renderer.setSize(SW, SH, false); composer.setSize(SW, SH); bloom.setSize(SW * pr, SH * pr);
    camera.aspect = SW / SH; camera.fov = SW >= SH ? 62 : 80; camera.updateProjectionMatrix();
    popMat.uniforms.uScale.value = SH * pr * 0.9;
  }
  renderAt(passTime);
}
window.TW_ROOM = { draw };
