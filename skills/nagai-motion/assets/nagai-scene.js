/*! nagai-scene.js v1.6.0 — 나가이 히로시 스타일 모션그래픽 (Canvas 2D, 의존성 없음)
 *
 * 블로그·웹페이지에 넣기
 *   <canvas id="art"></canvas>
 *   <div id="art-ctl"></div>
 *   <script src="nagai-scene.min.js"><\/script>
 *   <script>NagaiScene.mount({ canvas: '#art', controls: '#art-ctl', seed: 42, aspect: '3:2' });<\/script>
 *
 * 또는 속성만으로
 *   <canvas data-nagai data-seed="42" data-aspect="9:16" data-force='{"theme":"resort","sky":"violet"}' data-controls></canvas>
 *
 * 하늘: deep · bright (오후) · dusk (분홍 해질녘) · violet (연보라 저녁: 도시 불빛, 간판 가게, 검은 야자수)
 * 비율: aspect '3:2' | '9:16' | '1:1' (컨트롤의 가로/모바일/정사각 버튼으로도 전환)
 * 장면 코드: "83608-12 9:16 sky:violet" — 컨트롤 시드 칸에 붙여넣거나 api.setCode(), urlState:true 면 주소(#nagai=…)에 저장
 * 사진 저장: 컨트롤 "사진 저장" 또는 api.savePNG() — 가로 2400×1600, 모바일 1440×2560 PNG
 * 야자수: 기본은 가볍게(잎 도장), palmDetail:true 또는 컨트롤 "야자수 → 잎마다" 로 정밀하게 (휘고 떨림)
 *
 * 식물: 야자수, 꽃 덤불(꽃 색은 장면마다 분홍·빨강·흰색·노랑·보라), 둥근 나무, 용설란·유카, 수영장 가 화분
 *
 * 구성: 공통 유틸 · 야자수 · 바다 · 덤불 · 다른 식물 · 자동차 · 빌딩숲 · 건물 · 담장 · 수영장 · 구도(composer) · mount
 */
(function (global) {
'use strict';
/* nagai-util.js — 객체 모듈(palm.js, sea.js …)이 함께 쓰는 유틸
 * 다른 모듈보다 먼저 불러온다.
 */

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}
function mixColor(c1, c2, t) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`;
}
function withAlpha(hex, alpha) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${alpha})`;
}

// 시드 고정 난수: 같은 시드면 매 프레임 같은 값 → 모양·배치가 흔들리지 않는다
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 인쇄물 같은 입자감: 타일을 한 번 만들고, 매 프레임 장면 위에 덮는다
function createGrain(size = 160, strength = 22) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d'), img = g.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() < 0.5 ? 0 : 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * strength;
  }
  g.putImageData(img, 0, 0);
  return c;
}
// scale: 알갱이 한 개의 픽셀 크기. 화면은 1, 큰 사진으로 저장할 때는 화면보다 커진 배율만큼 키워서
//        저장본을 같은 크기로 볼 때 화면에서 보던 입자감과 같게 한다
function drawGrain(ctx, grain, width, height, scale = 1) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);   // 장면의 확대 변환 대신 알갱이 크기만큼만
  ctx.imageSmoothingEnabled = false;             // 키운 알갱이도 흐려지지 않게
  ctx.fillStyle = ctx.createPattern(grain, 'repeat');
  ctx.fillRect(0, 0, width / scale, height / scale);
  ctx.restore();
}

/* ───────── 장면 공통 빛 ─────────
 * 모든 객체가 그릴 때마다 이 값을 읽는다. 바꾼 뒤 정적 레이어만 다시 구우면 된다.
 *   x         -1 왼쪽에서 ~ 0 정면 ~ 1 오른쪽에서
 *   sunHeight  0 낮은 해(그림자 길게) ~ 1 높은 해(그림자 짧게)
 */
const SCENE_LIGHT = { x: -0.6, sunHeight: 0.5 };
const SHADOW_COLOR = '#17131d';

function setSceneLight(x, sunHeight) {
  if (x !== undefined) SCENE_LIGHT.x = Math.max(-1, Math.min(1, x));
  if (sunHeight !== undefined) SCENE_LIGHT.sunHeight = clamp01(sunHeight);
}
// 빛이 오는 쪽을 가리키는 단위 벡터 (화면 좌표, 왼쪽 위 = (-, -))
function lightVector() {
  const x = SCENE_LIGHT.x, y = -lerp(0.35, 1.3, SCENE_LIGHT.sunHeight);
  const m = Math.hypot(x, y);
  return { x: x / m, y: y / m };
}
// 땅에서 height 만큼 떠 있는 점의 그림자가 땅 위에서 밀리는 양
function shadowOffset(height) {
  const reach = lerp(1.6, 0.3, SCENE_LIGHT.sunHeight);
  return { dx: -SCENE_LIGHT.x * reach * height, dy: 0.05 * reach * height };
}

/* ───────── 장면 공통 원근 (한 점 투시) ─────────
 * 정면은 항상 똑바른 직사각형, 옆면·윗면만 소실점(vpX, horizonY) 쪽으로 줄어든다.
 * → 나가이 그림의 '직각인데 살짝 이상한' 원근
 *
 * persp(x, y, z): (x, y) = 깊이 0 평면에서의 화면 좌표, z = 안쪽으로 들어간 깊이(px)
 *   소실점 왼쪽 건물은 오른쪽 옆면이, 오른쪽 건물은 왼쪽 옆면이 보인다.
 *   눈높이(horizonY)보다 낮은 상자는 윗면이 보인다.
 */
const SCENE_VIEW = { vpX: 600, horizonY: 430, dist: 900 };

function setSceneView(v) { Object.assign(SCENE_VIEW, v); }
function perspScale(z) { return SCENE_VIEW.dist / (SCENE_VIEW.dist + z); }
function persp(x, y, z) {
  const f = perspScale(z);
  return { x: SCENE_VIEW.vpX + (x - SCENE_VIEW.vpX) * f, y: SCENE_VIEW.horizonY + (y - SCENE_VIEW.horizonY) * f };
}
function fillPoly(ctx, pts, color) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (color) { ctx.fillStyle = color; ctx.fill(); }
}
// 점들을 감싸는 볼록 다각형 (그림자 모양)
function convexHull(points) {
  const p = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  upper.pop(); lower.pop();
  return lower.concat(upper);
}

// 바닥에 놓인 상자 (x~x+w, 앞면 바닥 y=gy, 높이 h, 깊이 d)
function boxFaces(x, gy, w, h, d) {
  const P = (px, py, pz) => persp(px, py, pz);
  return {
    front: [P(x, gy - h, 0), P(x + w, gy - h, 0), P(x + w, gy, 0), P(x, gy, 0)],
    top: [P(x, gy - h, 0), P(x + w, gy - h, 0), P(x + w, gy - h, d), P(x, gy - h, d)],
    left: [P(x, gy - h, 0), P(x, gy - h, d), P(x, gy, d), P(x, gy, 0)],
    right: [P(x + w, gy - h, 0), P(x + w, gy - h, d), P(x + w, gy, d), P(x + w, gy, 0)],
    showTop: gy - h > SCENE_VIEW.horizonY,
    showLeft: x > SCENE_VIEW.vpX,
    showRight: x + w < SCENE_VIEW.vpX,
  };
}
// 상자의 땅 그림자: 바닥 네 귀퉁이 + 높이 h 에서 빛 반대쪽으로 밀린 귀퉁이를 감싼다
function drawBoxShadow(ctx, x, gy, w, h, d, color = SHADOW_COLOR) {
  const pts = [];
  for (const [px, pz] of [[x, 0], [x + w, 0], [x + w, d], [x, d]]) {
    const b = persp(px, gy, pz), f = perspScale(pz), o = shadowOffset(h);
    pts.push(b, { x: b.x + o.dx * f, y: b.y + o.dy * f });
  }
  fillPoly(ctx, convexHull(pts), color);
}
// 면 색: 정면은 기본색, 빛 쪽 옆면은 밝게, 반대쪽은 그늘, 윗면은 가장 밝게
function boxColors(base) {
  const lit = mixColor(base, '#ffffff', 0.28), shade = mixColor(base, '#3a4a78', 0.3);
  const fromRight = SCENE_LIGHT.x > 0;
  return {
    front: base,
    top: mixColor(base, '#ffffff', 0.4),
    left: fromRight ? shade : lit,
    right: fromRight ? lit : shade,
  };
}
function drawBox(ctx, x, gy, w, h, d, base, opts = {}) {
  const f = boxFaces(x, gy, w, h, d), c = { ...boxColors(base), ...(opts.colors || {}) };
  if (f.showLeft) fillPoly(ctx, f.left, c.left);
  if (f.showRight) fillPoly(ctx, f.right, c.right);
  if (f.showTop) fillPoly(ctx, f.top, c.top);
  fillPoly(ctx, f.front, c.front);
  return f;
}

/* palm.js — 나가이 히로시 스타일 야자수 (Canvas 2D, 함수형)
 *
 * 의존: nagai-util.js (lerp, smoothstep, mixColor, mulberry32, 장면 빛 SCENE_LIGHT …)
 *
 * 사용법
 *   const palm = createPalm({ seed: 3, height: 600, lean: -120 });   // 형태 데이터 (한 번만 생성)
 *   drawPalmShadow(ctx, palm, baseX, baseY, { time, wind });         // 땅 그림자 (선택, 야자수보다 먼저)
 *   drawPalm(ctx, palm, baseX, baseY, { time, wind });               // 매 프레임 그리기
 *
 *   wind: -1.5 ~ 1.5 정도 (+ 오른쪽으로 부는 바람)
 *
 * 그리는 순서 (뒤 → 앞)
 *   줄기 → 뒤쪽 잎 [어두운 층 → 밝은 층] → 앞쪽 잎 [어두운 층 → 밝은 층 → 하이라이트] → 코코넛
 *
 * 핵심 아이디어
 *   1) 어두운 층: 모든 소엽을 두껍게 그려서 잎 전체 실루엣을 짙은 녹색으로 깐다.
 *      색은 왕관 중심에서 방사형 그라데이션 → 줄기가 모이는 곳이 가장 어둡다.
 *   2) 밝은 층: 소엽 일부만(빛을 받는 쪽일수록 많이) 가늘고 짧게 덧그린다.
 *      잎줄기 쪽 시작점을 띄워서 어두운 중심맥과 틈이 보이게 한다.
 *   3) 하이라이트: 빛 받는 소엽 끝에 짧은 흰 획.
 */

const PALM_PALETTE = {
  trunk: '#6a4a30',
  trunkShade: '#3a2617',
  trunkLight: '#a3805a',
  trunkRing: 'rgba(28, 16, 8, 0.35)',
  collar: '#140f07',
  coconut: '#7a6a33',
  coconutShade: '#3e3416',
  coconutLight: '#b9a866',
  leafDarkest: '#03140a',
  leafDark: '#0c3b20',
  leafMidDark: '#1f6a2c',
  leafMid: '#3a8f37',
  leafBright: '#62b84c',
  leafHighlight: '#eef8df',
};

// 분홍 해질녘: 역광이라 잎·줄기가 어둡게 가라앉는다 (단계 음영은 남긴다)
const PALM_DUSK = {
  trunk: '#3e2c22', trunkShade: '#22170f', trunkLight: '#5e4636', trunkRing: 'rgba(14, 8, 4, 0.35)',
  coconut: '#3f3820', coconutShade: '#221e10', coconutLight: '#5c5432',
  leafDarkest: '#04100a', leafDark: '#0a2418', leafMidDark: '#143624', leafMid: '#20482e', leafBright: '#30583a', leafHighlight: '#8e9f8e',
};
// 저녁(연보라): 야자수는 검은 실루엣. 단계 음영이 모두 같은 색이 되어 한 덩어리로 보인다
const PALM_SILHOUETTE = {
  trunk: '#0f0a18', trunkShade: '#0f0a18', trunkLight: '#0f0a18', trunkRing: 'rgba(0,0,0,0)',
  collar: '#0f0a18', coconut: '#0f0a18', coconutShade: '#0f0a18', coconutLight: '#0f0a18',
  leafDarkest: '#0f0a18', leafDark: '#0f0a18', leafMidDark: '#0f0a18', leafMid: '#0f0a18', leafBright: '#0f0a18', leafHighlight: '#0f0a18',
};

/* ───────── 유틸 ───────── */

function palmNormalize(x, y) {
  const m = Math.hypot(x, y) || 1;
  return { x: x / m, y: y / m };
}
function cubicPoint(a, b, c, d, t) {
  const u = 1 - t;
  return {
    x: u * u * u * a.x + 3 * u * u * t * b.x + 3 * u * t * t * c.x + t * t * t * d.x,
    y: u * u * u * a.y + 3 * u * u * t * b.y + 3 * u * t * t * c.y + t * t * t * d.y,
  };
}
function cubicTangent(a, b, c, d, t) {
  const u = 1 - t;
  return palmNormalize(
    3 * u * u * (b.x - a.x) + 6 * u * t * (c.x - b.x) + 3 * t * t * (d.x - c.x),
    3 * u * u * (b.y - a.y) + 6 * u * t * (c.y - b.y) + 3 * t * t * (d.y - c.y)
  );
}

/* ───────── 형태 데이터 생성 ───────── */

function createPalm(opts = {}) {
  const rnd = mulberry32(opts.seed ?? 1);
  const height = opts.height ?? 500;
  const frondLength = opts.frondLength ?? height * 0.16;
  const leafletLength = opts.leafletLength ?? frondLength * 0.34;
  const frondCount = opts.frondCount ?? 8;

  const palm = {
    height,
    lean: opts.lean ?? 0,                 // 꼭대기의 수평 위치 (px, + 오른쪽)
    bow: opts.bow ?? 0,                   // 줄기 중간 휘어짐 (px)
    baseWidth: opts.baseWidth ?? Math.max(6, height * 0.03),
    topWidth: opts.topWidth ?? Math.max(4, height * 0.014),
    stiffness: opts.stiffness ?? 1,       // 클수록 줄기가 덜 흔들림
    crownTilt: opts.crownTilt ?? 0.4,     // 줄기 기울기를 왕관이 얼마나 따라갈지
    frondLength,
    leafletLength,
    phase: rnd() * Math.PI * 2,
    palette: { ...PALM_PALETTE, ...(opts.palette || {}) },
    fronds: [],
    coconuts: [],
  };

  // 잎은 위쪽 부채꼴(-165° ~ -15°)로 펼친다. 처짐은 중력으로 만든다
  const start = -Math.PI * 0.92, end = -Math.PI * 0.08;
  for (let i = 0; i < frondCount; i++) {
    const u = frondCount === 1 ? 0.5 : i / (frondCount - 1);
    const angle = lerp(start, end, u) + (rnd() - 0.5) * 0.25;
    const sideness = Math.abs(Math.cos(angle)); // 옆으로 뻗은 잎일수록 더 처짐
    palm.fronds.push({
      angle,
      length: frondLength * lerp(0.82, 1.08, rnd()),
      droop: lerp(0.55, 1.0, rnd()) * (0.4 + 0.8 * sideness),
      leafletCount: Math.round(lerp(18, 24, rnd())),
      leafletLength: leafletLength * lerp(0.9, 1.1, rnd()),
      depth: (i % 2 === 0) === (rnd() < 0.75) ? 1 : 0,   // 0 뒤쪽 / 1 앞쪽
      phase: rnd() * Math.PI * 2,
      speed: lerp(1.5, 2.6, rnd()),
      leafSeed: Math.floor(rnd() * 1e9),
    });
  }

  const n = opts.coconuts ?? 4 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    palm.coconuts.push({ dx: (rnd() - 0.5) * 1.6, dy: rnd() * 1.1 + 0.2, r: lerp(0.7, 1, rnd()) });
  }
  return palm;
}

/* ───────── 줄기 ───────── */

function trunkGeometry(palm, wind, time) {
  const H = palm.height;
  // 바람에 의한 기울기 + 잔잔한 흔들림. 위쪽만 휘도록 제어점 p2, p3에만 적용
  const sway = (wind * 0.045 + Math.sin(time * 1.3 + palm.phase) * 0.004 * (0.3 + Math.abs(wind)))
    * H / palm.stiffness;
  const p0 = { x: 0, y: 0 };
  const p1 = { x: palm.bow * 0.7 + palm.lean * 0.08, y: -H * 0.36 };
  const p2 = { x: palm.bow + palm.lean * 0.6 + sway * 0.4, y: -H * 0.72 };
  const p3 = { x: palm.lean + sway, y: -H + (sway * sway) / (2 * H) };

  const N = 48, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = cubicPoint(p0, p1, p2, p3, t);
    const d = cubicTangent(p0, p1, p2, p3, t);
    pts.push({ x: p.x, y: p.y, tx: d.x, ty: d.y, t });
  }
  const top = pts[N];
  return { pts, top, topAngle: Math.atan2(top.ty, top.tx) };
}

function drawTrunk(ctx, palm, trunk, light) {
  const P = palm.palette, pts = trunk.pts;
  const width = (t) =>
    lerp(palm.baseWidth, palm.topWidth, Math.pow(t, 0.6)) +
    palm.baseWidth * 0.35 * (1 - smoothstep(0, 0.05, t));

  // 빛 반대쪽 = 그림자 쪽 (+1이면 법선 방향)
  const mid = pts[pts.length >> 1];
  const shadeSign = (-mid.ty * light.x + mid.tx * light.y) < 0 ? 1 : -1;

  const edge = (k) => pts.map((p) => {
    const hw = width(p.t) / 2;
    return { x: p.x - p.ty * hw * k, y: p.y + p.tx * hw * k };
  });
  const ribbon = (k1, k2, color) => {
    const a = edge(k1), b = edge(k2).reverse();
    ctx.beginPath();
    ctx.moveTo(a[0].x, a[0].y);
    for (const q of a) ctx.lineTo(q.x, q.y);
    for (const q of b) ctx.lineTo(q.x, q.y);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  };

  ribbon(-1, 1, P.trunk);
  ribbon(shadeSign * 0.15, shadeSign * 1, P.trunkShade);
  ribbon(-shadeSign * 0.78, -shadeSign * 0.45, P.trunkLight);

  // 마디 무늬: 그림자 쪽에 짧은 가로 획
  let acc = 0, next = 0, idx = 0;
  const step = Math.max(3, palm.baseWidth * 0.4);
  ctx.strokeStyle = P.trunkRing;
  ctx.lineWidth = Math.max(0.7, palm.topWidth * 0.12);
  ctx.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    while (next <= acc + seg) {
      const f = (next - acc) / seg;
      const x = lerp(a.x, b.x, f), y = lerp(a.y, b.y, f);
      const hw = width(lerp(a.t, b.t, f)) / 2;
      const k1 = shadeSign * (idx % 2 ? 0.25 : -0.15), k2 = shadeSign * 0.95;
      ctx.moveTo(x - b.ty * hw * k1, y + b.tx * hw * k1);
      ctx.lineTo(x - b.ty * hw * k2, y + b.tx * hw * k2);
      next += step; idx++;
    }
    acc += seg;
  }
  ctx.stroke();
}

function drawCoconuts(ctx, palm, top, tilt) {
  const P = palm.palette, r0 = palm.topWidth * 0.6;
  ctx.save();
  ctx.translate(top.x, top.y);
  ctx.rotate(tilt);
  // 잎이 모이는 목 부분의 짙은 그늘
  ctx.fillStyle = P.collar;
  ctx.beginPath();
  ctx.ellipse(0, r0 * 0.3, r0 * 1.5, r0 * 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const c of palm.coconuts) {
    const cx = c.dx * r0 * 1.3, cy = (0.6 + c.dy) * r0, r = r0 * c.r;
    ctx.fillStyle = P.coconutShade;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.coconut;
    ctx.beginPath(); ctx.arc(cx - r * 0.18, cy - r * 0.18, r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = P.coconutLight;
    ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.35, r * 0.22, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

/* ───────── 잎 ───────── */

// 잎줄기(중심맥): 방향 벡터에 중력 + 바람 힘을 조금씩 누적해 휘게 만든다
function frondSpine(ox, oy, baseAngle, frond, wind, time, N = 16) {
  let dx = Math.cos(baseAngle), dy = Math.sin(baseAngle);
  const seg = frond.length / N;
  const gust = 0.25 + Math.abs(wind);
  const fx0 = Math.sin(time * frond.speed + frond.phase) * 0.35 * gust;
  const fy0 = Math.cos(time * frond.speed * 1.3 + frond.phase) * 0.25 * gust;
  let x = ox, y = oy;
  const pts = [{ x, y, tx: dx, ty: dy, s: 0 }];
  for (let i = 1; i <= N; i++) {
    const s = i / N;
    dx += (wind * 1.6 + fx0) / N;
    dy += (frond.droop * (0.4 + s) + fy0) / N;
    const d = palmNormalize(dx, dy);
    dx = d.x; dy = d.y;
    x += dx * seg; y += dy * seg;
    pts.push({ x, y, tx: dx, ty: dy, s });
  }
  return pts;
}

function sampleSpine(pts, s) {
  const f = s * (pts.length - 1);
  const i = Math.min(pts.length - 2, Math.floor(f));
  const t = f - i, a = pts[i], b = pts[i + 1];
  const d = palmNormalize(lerp(a.tx, b.tx, t), lerp(a.ty, b.ty, t));
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), tx: d.x, ty: d.y };
}

// 소엽(작은 잎) 배치 계산. 밝게 칠할지 여부는 '바람 없을 때' 방향 기준이라 깜빡이지 않는다
function buildLeaflets(spine, frond, wind, time, light) {
  const rng = mulberry32(frond.leafSeed);
  const out = [];
  const n = frond.leafletCount;
  const gust = Math.min(1.2, Math.abs(wind));
  const flutterAmp = 0.05 + 0.14 * gust;
  const droopSign = Math.cos(frond.angle) >= 0 ? 1 : -1;

  for (let i = 0; i < n; i++) {
    const s = lerp(0.12, 0.97, i / (n - 1));
    const p = sampleSpine(spine, s);
    const baseA = Math.atan2(p.ty, p.tx);
    const profile = Math.max(0.3, Math.sin(Math.PI * Math.min(1, 0.18 + s * 0.85)));

    for (let side = -1; side <= 1; side += 2) {
      const r1 = rng(), r2 = rng(), r3 = rng(), r4 = rng();
      const spread = lerp(1.05, 0.5, s) + (r1 - 0.5) * 0.18;   // 잎줄기와 이루는 각
      const flutter = Math.sin(time * (5 + r2 * 3) + s * 8 + frond.phase + side) * flutterAmp;
      const a = baseA + side * spread + flutter;
      const len = frond.leafletLength * profile * (side > 0 ? 1 : 0.88) * lerp(0.85, 1.12, r2);
      const dx = Math.cos(a), dy = Math.sin(a);
      const sag = len * (0.25 + 0.15 * gust);

      const restA = frond.angle + droopSign * s * frond.droop * 0.5 + side * spread;
      const lit = 0.5 + 0.5 * (Math.cos(restA) * light.x + Math.sin(restA) * light.y);
      const prob = smoothstep(0.08, 0.4, s) * lerp(0.3, 0.95, lit) * (frond.depth ? 1 : 0.65);
      const v = lit * 0.65 + r4 * 0.35;
      const tone = v < 0.4 ? 0 : v < 0.66 ? 1 : 2;

      out.push({
        x0: p.x, y0: p.y,
        cx: p.x + dx * len * 0.55, cy: p.y + dy * len * 0.55,
        ex: p.x + dx * len + wind * len * 0.2, ey: p.y + dy * len + sag,
        w: len * 0.2, s,
        bright: r3 < prob,
        tone,
        glint: r3 < prob && tone === 2 && r4 < 0.5 && s > 0.3,
      });
    }
  }
  return out;
}

function quadPoint(L, t) {
  const u = 1 - t;
  return {
    x: u * u * L.x0 + 2 * u * t * L.cx + t * t * L.ex,
    y: u * u * L.y0 + 2 * u * t * L.cy + t * t * L.ey,
  };
}

// 끝이 뾰족한 잎 모양. from: 잎줄기 쪽 시작 위치(0~1), lenScale: 끝 위치(0~1)
function leafletPath(ctx, L, wScale, lenScale, from) {
  const S = quadPoint(L, from), E = quadPoint(L, lenScale);
  const n = palmNormalize(-(L.cy - L.y0), L.cx - L.x0);
  const hw = L.w * wScale * 0.5;
  ctx.moveTo(S.x + n.x * hw * 0.5, S.y + n.y * hw * 0.5);
  ctx.quadraticCurveTo(L.cx + n.x * hw * 1.3, L.cy + n.y * hw * 1.3, E.x, E.y);
  ctx.quadraticCurveTo(L.cx - n.x * hw * 1.3, L.cy - n.y * hw * 1.3, S.x - n.x * hw * 0.5, S.y - n.y * hw * 0.5);
  ctx.closePath();
}

function drawFrondLayer(ctx, palm, group, c, isBack, layers) {
  if (!group.length) return;
  const P = palm.palette;
  const R = palm.frondLength * 1.1;
  const radial = (stops) => {
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R);
    for (const [o, col] of stops) g.addColorStop(o, col);
    return g;
  };

  // 1) 어두운 층 — 모든 소엽을 두껍게, 중심일수록 더 어둡게
  if (layers.dark !== false) {
    const g = radial([[0, P.leafDarkest], [0.3, P.leafDarkest], [0.8, P.leafDark], [1, P.leafDark]]);
    ctx.fillStyle = g;
    ctx.strokeStyle = g;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const b of group) for (const L of b.leaflets) leafletPath(ctx, L, 1.25, 1, 0);
    ctx.fill();
    for (const b of group) {
      const sp = b.spine;
      for (let i = 1; i < sp.length; i++) {
        ctx.lineWidth = lerp(R * 0.035, R * 0.008, sp[i].s);
        ctx.beginPath();
        ctx.moveTo(sp[i - 1].x, sp[i - 1].y);
        ctx.lineTo(sp[i].x, sp[i].y);
        ctx.stroke();
      }
    }
    if (isBack) {
      ctx.fillStyle = P.leafDarkest;
      ctx.beginPath();
      ctx.arc(c.x, c.y, R * 0.12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 2) 밝은 층 — 일부 소엽만 가늘고 짧게, 잎줄기에서 살짝 띄워서
  if (layers.bright !== false) {
    const tones = [P.leafMidDark, P.leafMid, P.leafBright];
    for (let k = 0; k < 3; k++) {
      const col = isBack ? mixColor(tones[k], P.leafDark, 0.45) : tones[k];
      ctx.fillStyle = radial([[0, P.leafDarkest], [0.18, P.leafDark], [0.5, col], [1, col]]);
      ctx.beginPath();
      let any = false;
      for (const b of group) for (const L of b.leaflets) {
        if (L.bright && L.tone === k) { leafletPath(ctx, L, 0.75, 0.93, 0.15); any = true; }
      }
      if (any) ctx.fill();
    }
  }

  // 3) 하이라이트 — 빛 받는 소엽 끝의 짧은 흰 획 (앞쪽 잎만)
  if (layers.highlight !== false && !isBack) {
    ctx.strokeStyle = P.leafHighlight;
    ctx.lineCap = 'round';
    ctx.lineWidth = Math.max(0.8, palm.leafletLength * 0.07);
    ctx.beginPath();
    for (const b of group) for (const L of b.leaflets) {
      if (!L.glint) continue;
      const a = quadPoint(L, 0.74), e = quadPoint(L, 0.9);
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(e.x, e.y);
    }
    ctx.stroke();
  }
}

/* ───────── 진입점 ───────── */

// 줄기와 잎줄기 위치 계산 (그리기와 그림자가 같이 쓴다)
function palmGeometry(palm, wind, time, light, withLeaflets) {
  const trunk = trunkGeometry(palm, wind, time);
  const top = trunk.top;
  const tilt = (trunk.topAngle + Math.PI / 2) * palm.crownTilt;
  const fronds = palm.fronds.map((f) => {
    const spine = frondSpine(top.x, top.y, f.angle + tilt, f, wind, time);
    return { f, spine, leaflets: withLeaflets ? buildLeaflets(spine, f, wind, time, light) : null };
  });
  return { trunk, top, tilt, fronds };
}

// 야자수 그리기 방식 (장면마다 그리기 직전에 정해진다 — mount 의 palmDetail / 컨트롤의 "야자수" 버튼)
//   false (기본, 가볍게): 잎마다 바람 없는 기본 자세를 한 번 그려 두고(도장), 매 프레임 잎줄기 방향에 맞춰 돌려 찍는다.
//                        잎이 통째로 흔들린다. 매 프레임 계산보다 약 6배 가볍다
//   true  (잎마다): 매 프레임 잎줄기가 휘고 소엽 하나하나가 떨린다 (정밀하지만 무겁다)
let PALM_DETAIL = false;
function frondSpineRest(f, N = 16) {                 // 바람·흔들림 없는 기본 자세의 잎줄기 (원점에서 시작)
  let dx = Math.cos(f.angle), dy = Math.sin(f.angle), x = 0, y = 0;
  const seg = f.length / N, pts = [{ x, y, tx: dx, ty: dy, s: 0 }];
  for (let i = 1; i <= N; i++) {
    const s = i / N;
    dy += (f.droop * (0.4 + s)) / N;
    const d = palmNormalize(dx, dy); dx = d.x; dy = d.y;
    x += dx * seg; y += dy * seg;
    pts.push({ x, y, tx: dx, ty: dy, s });
  }
  return pts;
}
function buildFrondSprites(palm, light) {
  const res = 2;
  return palm.fronds.map((f) => {
    const spine = frondSpineRest(f), leaflets = buildLeaflets(spine, f, 0, 0, light);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const grow = (x, y, r) => { x0 = Math.min(x0, x - r); y0 = Math.min(y0, y - r); x1 = Math.max(x1, x + r); y1 = Math.max(y1, y + r); };
    for (const p of spine) grow(p.x, p.y, palm.frondLength * 0.05);
    for (const L of leaflets) { grow(L.ex, L.ey, L.w * 2); grow(L.cx, L.cy, L.w * 2); }
    x0 = Math.min(x0, -palm.frondLength * 0.15); y0 = Math.min(y0, -palm.frondLength * 0.15);
    const c = document.createElement('canvas');
    c.width = Math.ceil((x1 - x0) * res); c.height = Math.ceil((y1 - y0) * res);
    const g = c.getContext('2d');
    g.scale(res, res); g.translate(-x0, -y0);
    drawFrondLayer(g, palm, [{ f, spine, leaflets }], { x: 0, y: 0 }, f.depth === 0, {});
    const tip = spine[spine.length - 1];
    return { c, x0, y0, w: x1 - x0, h: y1 - y0, a0: Math.atan2(tip.y, tip.x), l0: Math.hypot(tip.x, tip.y) };
  });
}
function drawPalmCached(ctx, palm, x, y, opts) {
  const time = opts.time ?? 0, wind = opts.wind ?? 0, light = lightVector();
  if (!palm._sprites) palm._sprites = buildFrondSprites(palm, light);
  ctx.save();
  ctx.translate(x, y);
  const g = palmGeometry(palm, wind, time, light, false);              // 잎줄기 방향만 (소엽 계산 없음)
  drawTrunk(ctx, palm, g.trunk, light);
  for (const depth of [0, 1]) {
    g.fronds.forEach((b, i) => {
      if (b.f.depth !== depth) return;
      const sp = palm._sprites[i], base = b.spine[0], tip = b.spine[b.spine.length - 1];
      const dx = tip.x - base.x, dy = tip.y - base.y;
      ctx.save();
      ctx.translate(base.x, base.y);
      ctx.rotate(Math.atan2(dy, dx) - sp.a0);
      const k = Math.hypot(dx, dy) / sp.l0; ctx.scale(k, k);
      ctx.drawImage(sp.c, sp.x0, sp.y0, sp.w, sp.h);
      ctx.restore();
    });
  }
  drawCoconuts(ctx, palm, g.top, g.tilt);
  ctx.restore();
}

function drawPalm(ctx, palm, x, y, opts = {}) {
  if (!PALM_DETAIL && (opts.scale ?? 1) === 1 && !opts.layers && typeof document !== 'undefined') return drawPalmCached(ctx, palm, x, y, opts);
  const time = opts.time ?? 0, wind = opts.wind ?? 0, scale = opts.scale ?? 1;
  const layers = opts.layers ?? {};
  const light = lightVector();
  ctx.save();
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);

  const g = palmGeometry(palm, wind, time, light, true);
  if (layers.trunk !== false) drawTrunk(ctx, palm, g.trunk, light);
  drawFrondLayer(ctx, palm, g.fronds.filter((b) => b.f.depth === 0), g.top, true, layers);
  drawFrondLayer(ctx, palm, g.fronds.filter((b) => b.f.depth === 1), g.top, false, layers);
  drawCoconuts(ctx, palm, g.top, g.tilt);
  ctx.restore();
}

// 땅 위 그림자: 줄기·잎줄기의 각 점을 높이에 따라 빛 반대쪽으로 눕혀서 굵은 선으로 칠한다.
// 야자수보다 먼저 그린다. 바람에 흔들리면 그림자도 같이 흔들린다.
function drawPalmShadow(ctx, palm, x, y, opts = {}) {
  const time = opts.time ?? 0, wind = opts.wind ?? 0, scale = opts.scale ?? 1;
  const g = palmGeometry(palm, wind, time, lightVector(), false);
  const proj = (p) => { const o = shadowOffset(-p.y); return { x: p.x + o.dx, y: o.dy }; };
  ctx.save();
  ctx.translate(x, y);
  if (scale !== 1) ctx.scale(scale, scale);
  ctx.strokeStyle = opts.color ?? SHADOW_COLOR;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const tp = g.trunk.pts;
  for (let i = 1; i < tp.length; i++) {
    const a = proj(tp[i - 1]), b = proj(tp[i]);
    ctx.lineWidth = lerp(palm.baseWidth, palm.topWidth, tp[i].t) * 0.9;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const b of g.fronds) {
    const sp = b.spine;
    for (let i = 1; i < sp.length; i++) {
      const s = sp[i].s;
      const p0 = proj(sp[i - 1]), p1 = proj(sp[i]);
      ctx.lineWidth = b.f.leafletLength * 1.3 * Math.max(0.25, Math.sin(Math.PI * Math.min(1, 0.2 + s * 0.85)));
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
  }
  ctx.restore();
}

/* sea.js — 나가이 히로시 스타일 바다 / 파도 (Canvas 2D, 함수형)
 * 의존: nagai-util.js
 *
 * 사용법
 *   const sea = createSea({ seed: 7, x: 0, width: 1200, horizonY: 410, shoreY: 712 });
 *   drawSea(ctx, sea, { time, wind });
 *
 * 그리는 순서 (먼 곳 → 가까운 곳)
 *   바탕 그라데이션 → 수평선 띠 → 가로 물결선 [옅은 선 → 흰 대시 → 윤슬 점]
 *   → 얕은 물 무늬 → 해변 포말 띠
 *
 * 원근: 수평선(u=0)에서 포말(u=1)까지 y = u^perspective 로 배치
 *       → 먼 곳은 줄 간격이 촘촘하고 선·점이 작고, 가까울수록 넓고 커진다.
 *
 * 움직임
 *   - 물결선은 일정한 속도로 해변 쪽으로 밀려온다 (수평선에서 생겨나 포말 앞에서 사라짐)
 *   - 바람(wind)은 '세기'로만 쓴다: 물결 출렁임, 윤슬 개수, 포말 두께
 *     (time × wind 를 쓰지 않으므로 바람이 바뀌어도 위치가 튀지 않는다)
 */

const SEA_PALETTE = {
  horizon: '#0d2f78',
  deep: '#1b55a8',
  mid: '#2a6fbe',
  near: '#3584cc',
  shallow: '#3f95d8',
  shallowLight: '#8ccaf0',
  shallowDark: '#2a72bf',
  line: '#6aaee6',
  foam: '#f4f8fb',
  glint: '#ffffff',
  dash: '#ffffff',
};
// 저녁(연보라) 바다: 짙은 남색, 흰 윤슬 대신 건너편 도시 불빛이 물에 비쳐 세로로 반짝인다
const SEA_NIGHT = {
  horizon: '#0a1038', deep: '#101a52', mid: '#142062', near: '#18276e', shallow: '#1c2c78',
  shallowLight: '#34489e', shallowDark: '#101a52', line: '#26388a', foam: '#a9b0dc', glint: '#ffe2a0', dash: '#4a5cb0',
};

function seaY(sea, u) {
  return sea.horizonY + (sea.foamY - sea.horizonY) * Math.pow(u, sea.perspective);
}

/* ───────── 형태 데이터 생성 ───────── */

function createSea(opts = {}) {
  const rnd = mulberry32(opts.seed ?? 7);
  const x = opts.x ?? 0, width = opts.width ?? 1200;
  const horizonY = opts.horizonY ?? 400, shoreY = opts.shoreY ?? 700;
  const depth = shoreY - horizonY;

  const sea = {
    x, width, horizonY, shoreY,
    foamY: opts.foamY ?? horizonY + depth * 0.78,          // 해변 포말 띠의 윗선
    foamThickness: opts.foamThickness ?? depth * 0.09,
    perspective: opts.perspective ?? 1.8,
    swellSpeed: opts.swellSpeed ?? 0.06,                    // 초당 밀려오는 줄 수
    night: !!opts.night, noFoam: !!opts.noFoam,
    palette: { ...SEA_PALETTE, ...(opts.night ? SEA_NIGHT : {}), ...(opts.palette || {}) },
    lines: [], foamTop: [], foamBottom: [], shallow: [], cityGlints: [],
  };

  // 가로 물결선: 줄마다 흰 대시 위치와 윤슬 점 무리를 미리 정해둔다
  const lineCount = opts.lineCount ?? 6;
  for (let k = 0; k < lineCount; k++) {
    const dashes = [];
    for (let px = rnd() * 80; px < width;) {
      const len = lerp(20, 120, rnd());
      if (rnd() < 0.45) dashes.push({ x: px, len });
      px += len + lerp(10, 90, rnd());
    }
    const dots = [];
    const clusters = 3 + Math.floor(rnd() * 5);
    for (let c = 0; c < clusters; c++) {
      const cx = rnd() * width, n = 5 + Math.floor(rnd() * 14), gap = lerp(4, 9, rnd());
      for (let j = 0; j < n; j++) {
        dots.push({
          x: cx + (j - n / 2) * gap * lerp(0.6, 1.4, rnd()),
          dy: rnd() - 0.5,
          size: lerp(0.6, 1.2, rnd()),
          phase: rnd() * Math.PI * 2,
          freq: lerp(1.5, 4, rnd()),
          thr: rnd(),                   // 바람이 셀수록 더 많은 점이 켜진다
        });
      }
    }
    sea.lines.push({ dashes, dots, phase: rnd() * Math.PI * 2, white: rnd() < 0.6 });
  }

  // 해변 포말 띠의 위·아래 가장자리 거품(원)
  for (let px = -10; px < width + 10; px += lerp(4, 9, rnd())) {
    sea.foamTop.push({ x: px, r: lerp(0.08, 0.22, rnd()), phase: rnd() * Math.PI * 2 });
  }
  for (let px = -10; px < width + 10; px += lerp(3, 7, rnd())) {
    sea.foamBottom.push({ x: px, r: lerp(0.05, 0.14, rnd()), phase: rnd() * Math.PI * 2 });
  }

  // 얕은 물의 짧은 가로 무늬
  const shallowCount = opts.shallowCount ?? Math.round(width / 5);
  for (let i = 0; i < shallowCount; i++) {
    sea.shallow.push({ x: rnd() * width, v: rnd(), len: lerp(4, 16, rnd()), light: rnd() < 0.6, phase: rnd() * Math.PI * 2 });
  }

  // 도시 불빛의 반사 (미니멀): 빌딩숲 아래 드문드문 세로 줄 몇 개, 줄마다 같은 색 짧은 가로 획이 고른 간격으로 쌓인다
  // (다른 모양 난수를 다 뽑은 뒤 따로 굴린다)
  if (opts.lights) {
    const r2 = mulberry32((opts.seed ?? 7) * 31 + 5);
    const [lx0, lx1] = opts.lights, span = Math.max(0, lx1 - lx0);
    const cols = Math.max(2, Math.round(span / 70));
    for (let i = 0; i < cols; i++) {
      const cx = lx0 + span * (i + 0.2 + r2() * 0.6) / cols - x;          // 고르게 흩되 살짝 어긋나게
      const n = 3 + Math.floor(r2() * 3), reach = lerp(0.45, 0.8, r2()), w = lerp(6, 12, r2()), phase = r2() * Math.PI * 2;
      for (let j = 0; j < n; j++) sea.cityGlints.push({ x: cx, u: reach * (j + 0.6) / n, w: w * (1 - j / (n + 2)), phase: phase + j * 0.9 });
    }
  }
  return sea;
}

// 물에 비친 도시 불빛: 한 가지 색의 짧은 가로 획. 천천히 밝아졌다 옅어질 뿐 움직이지 않는다
function drawCityGlints(ctx, sea, time) {
  ctx.fillStyle = SEA_NIGHT.glint;
  for (const g of sea.cityGlints) {
    ctx.globalAlpha = 0.55 + 0.4 * Math.sin(time * 0.6 + g.phase);
    const y = seaY(sea, g.u), h = lerp(1, 2.2, g.u);
    ctx.fillRect(sea.x + g.x - g.w / 2, y - h / 2, g.w, h);
  }
  ctx.globalAlpha = 1;
}

/* ───────── 그리기 ───────── */

function drawSeaBase(ctx, sea) {
  const P = sea.palette, { x, width, horizonY, foamY, shoreY } = sea;
  const g = ctx.createLinearGradient(0, horizonY, 0, foamY);
  g.addColorStop(0, P.horizon);
  g.addColorStop(0.08, P.deep);
  g.addColorStop(0.5, P.mid);
  g.addColorStop(1, P.near);
  ctx.fillStyle = g;
  ctx.fillRect(x, horizonY, width, foamY - horizonY);
  ctx.fillStyle = P.near;
  ctx.fillRect(x, foamY - 1, width, shoreY - foamY + 1);
  ctx.fillStyle = P.horizon;
  ctx.fillRect(x, horizonY, width, Math.max(2, (foamY - horizonY) * 0.014));
}

function drawSwellLines(ctx, sea, time, chop, layers) {
  const P = sea.palette, N = sea.lines.length;
  const flow = time * sea.swellSpeed;
  const density = 0.3 + 0.55 * Math.min(1, chop);

  for (let k = 0; k < N; k++) {
    const L = sea.lines[k];
    const u = (((k + flow) / N) % 1 + 1) % 1;
    const fade = smoothstep(0, 0.1, u) * (1 - smoothstep(0.85, 1, u));
    if (fade <= 0) continue;
    const y = seaY(sea, u);
    const amp = lerp(0.2, 2.2, u) * (0.4 + chop);
    const freq = lerp(0.03, 0.012, u);
    const wave = (px) => Math.sin(px * freq + time * 0.9 + L.phase) * amp;

    // 옅은 파란 가로선
    ctx.globalAlpha = fade * 0.8;
    ctx.strokeStyle = P.line;
    ctx.lineWidth = lerp(0.8, 2.4, u);
    ctx.beginPath();
    for (let px = 0; px <= sea.width; px += 16) {
      const X = sea.x + px, Y = y + wave(px);
      px === 0 ? ctx.moveTo(X, Y) : ctx.lineTo(X, Y);
    }
    ctx.stroke();

    // 흰 대시
    if (L.white) {
      ctx.globalAlpha = fade * lerp(0.9, 0.6, u);
      ctx.strokeStyle = P.dash;
      ctx.lineWidth = lerp(0.8, 2, u);
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const d of L.dashes) {
        ctx.moveTo(sea.x + d.x, y + wave(d.x));
        ctx.lineTo(sea.x + d.x + d.len, y + wave(d.x + d.len));
      }
      ctx.stroke();
    }

    // 윤슬: 줄 위의 작은 원이 반짝였다 사라진다
    if (layers.glitter !== false && !sea.night) {
      ctx.fillStyle = P.glint;
      for (const d of L.dots) {
        const tw = Math.sin(time * d.freq + d.phase);
        const a = smoothstep(0.1, 0.9, tw) * smoothstep(d.thr, d.thr + 0.15, density) * fade;
        if (a <= 0.02) continue;
        ctx.globalAlpha = a;
        const r = lerp(0.6, 2.2, u) * d.size * (0.6 + 0.4 * tw);
        ctx.beginPath();
        ctx.arc(sea.x + d.x, y + wave(d.x) + d.dy * lerp(1.5, 6, u), r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function drawShallow(ctx, sea, time, from) {
  const P = sea.palette, h = sea.shoreY - from;
  if (h <= 2) return;
  ctx.fillStyle = P.shallow;
  ctx.fillRect(sea.x, from, sea.width, h);
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1, h * 0.06);
  for (const light of [false, true]) {
    ctx.strokeStyle = light ? P.shallowLight : P.shallowDark;
    ctx.beginPath();
    for (const d of sea.shallow) {
      if (d.light !== light) continue;
      const X = sea.x + d.x + Math.sin(time * 0.8 + d.phase) * 3;
      const Y = from + 3 + d.v * (h - 6);
      ctx.moveTo(X, Y);
      ctx.lineTo(X + d.len, Y);
    }
    ctx.stroke();
  }
}

function drawShoreFoam(ctx, sea, time, chop) {
  const P = sea.palette;
  const T = sea.foamThickness * (0.85 + 0.25 * Math.min(1, chop));
  // 밀려왔다 빠지는 움직임
  const wash = Math.sin(time * 0.55) * T * 0.3 + Math.sin(time * 1.3 + 1) * T * 0.08;
  const top = sea.foamY + wash, bot = top + T;

  drawShallow(ctx, sea, time, bot);

  ctx.fillStyle = P.foam;
  ctx.beginPath();
  ctx.rect(sea.x, top, sea.width, T);
  for (const f of sea.foamTop) {
    const r = f.r * T * (0.85 + 0.15 * Math.sin(time * 2 + f.phase));
    ctx.moveTo(sea.x + f.x + r, top + r * 0.4);
    ctx.arc(sea.x + f.x, top + r * 0.4, r, 0, Math.PI * 2);
  }
  for (const f of sea.foamBottom) {
    const r = f.r * T * (0.85 + 0.15 * Math.sin(time * 2.4 + f.phase));
    ctx.moveTo(sea.x + f.x + r, bot - r * 0.3);
    ctx.arc(sea.x + f.x, bot - r * 0.3, r, 0, Math.PI * 2);
  }
  ctx.fill();

  // 포말 앞쪽 흩어진 물방울 점
  ctx.fillStyle = sea.night ? P.foam : P.glint;
  for (let i = 0; i < sea.foamTop.length; i += 3) {
    const f = sea.foamTop[i];
    const tw = Math.sin(time * 2.2 + f.phase * 3);
    if (tw < 0.3) continue;
    ctx.globalAlpha = (tw - 0.3) / 0.7;
    ctx.beginPath();
    ctx.arc(sea.x + f.x + 2, top - T * (0.2 + f.r * 2), 0.6 + f.r * 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ───────── 진입점 ───────── */

function drawSea(ctx, sea, opts = {}) {
  const time = opts.time ?? 0, wind = opts.wind ?? 0, layers = opts.layers ?? {};
  const chop = Math.min(1.5, Math.abs(wind));
  ctx.save();
  ctx.beginPath();
  ctx.rect(sea.x, sea.horizonY, sea.width, sea.shoreY - sea.horizonY);
  ctx.clip();

  drawSeaBase(ctx, sea);
  if (layers.lines !== false) drawSwellLines(ctx, sea, time, chop, layers);
  if (sea.cityGlints.length) drawCityGlints(ctx, sea, time);
  if (layers.foam !== false && !sea.noFoam) drawShoreFoam(ctx, sea, time, chop);

  ctx.restore();
}

/* bush.js — 나가이 히로시 스타일 덤불 / 꽃나무 (정적, Canvas 2D)
 * 의존: nagai-util.js
 *
 * 사용법
 *   const bush = createBush({ seed: 5, width: 300, height: 200 });
 *   drawBush(ctx, bush, x, groundY);        // (x, groundY) = 밑동 가운데
 *
 *   꽃 없는 덤불: createBush({ flowers: 0 })
 *
 * 그리는 순서
 *   0) 땅 그림자 (장면 빛 반대쪽)
 *   1) 바탕 + 잎 (createFoliage / drawFoliage, 둥근 나무와 같은 방식): 원 여러 개를 겹친 둥근 덩어리를
 *      작은 잎 송이와 고른 잎 점으로 채운다. 바탕은 짙은 녹색으로 잎 점 자리에만 → 테두리가 잎과 딱 맞다
 *   2) 꽃: 몇 군데 무리(패치) 중심으로 잎 점 자리에 꽃 원을 찍고, 일부에 밝은 점을 얹는다
 *   땅선 아래는 잘라서 바닥이 평평하다
 */

const BUSH_PALETTE = {
  mass: '#14401f',     // 바탕: 검정이 아니라 가장 어두운 잎보다 조금 짙은 녹색
  leaves: ['#1d6532', '#2c8443', '#48a85a', '#7cc98a'],   // 어두운 → 밝은
  flowers: ['#b8306a', '#dc5a96', '#f08cbc'],
  flowerHighlight: '#ffe6f2',
};

// 분홍 해질녘: 한 단계 어둡게 / 연보라 저녁: 더 어둡게 (꽃도 같이 가라앉는다)
const BUSH_DUSK = {
  mass: '#0c2b16',
  leaves: ['#123f22', '#1c5530', '#2c6c3c', '#4a8858'],
  flowers: ['#8e2654', '#b04878', '#c870a0'],
  flowerHighlight: '#f0c8dc',
};
const BUSH_NIGHT = {
  mass: '#08150f',
  leaves: ['#0b1f1a', '#122b22', '#1a3a2c', '#28503c'],
  flowers: ['#4e1c40', '#6a2c58', '#844070'],
  flowerHighlight: '#a87898',
};

// 푸아송 디스크 샘플링 (Bridson): 사각형 안을 서로 minD 이상 떨어진 점으로 고르게, 줄 없이 채운다. 시드 난수 사용
function poissonDisk(rnd, x0, y0, x1, y1, minD, tries = 12) {
  const cell = minD / Math.SQRT2, gw = Math.ceil((x1 - x0) / cell), gh = Math.ceil((y1 - y0) / cell);
  const grid = new Int32Array(gw * gh).fill(-1), pts = [], active = [];
  const put = (x, y) => { grid[Math.floor((y - y0) / cell) * gw + Math.floor((x - x0) / cell)] = pts.length; pts.push({ x, y }); active.push(pts.length - 1); };
  const ok = (x, y) => {
    if (x < x0 || x >= x1 || y < y0 || y >= y1) return false;
    const gx = Math.floor((x - x0) / cell), gy = Math.floor((y - y0) / cell);
    for (let j = Math.max(0, gy - 2); j <= Math.min(gh - 1, gy + 2); j++) {
      for (let i = Math.max(0, gx - 2); i <= Math.min(gw - 1, gx + 2); i++) {
        const k = grid[j * gw + i];
        if (k >= 0 && (pts[k].x - x) ** 2 + (pts[k].y - y) ** 2 < minD * minD) return false;
      }
    }
    return true;
  };
  put(lerp(x0, x1, rnd()), lerp(y0, y1, rnd()));
  while (active.length) {
    const ai = Math.floor(rnd() * active.length), a = pts[active[ai]];
    let found = false;
    for (let t = 0; t < tries; t++) {
      const ang = rnd() * Math.PI * 2, d = minD * (1 + rnd());
      const x = a.x + Math.cos(ang) * d, y = a.y + Math.sin(ang) * d;
      if (ok(x, y)) { put(x, y); found = true; break; }
    }
    if (!found) { active[ai] = active[active.length - 1]; active.pop(); }
  }
  return pts;
}

// ───────── 잎 점 (덤불·둥근 나무 공용) ─────────
// 큰 덩어리(inLobe) 안을 작은 잎 송이로 채우고, 송이 안을 고른 간격의 잎 점으로 채운다.
//   - 송이는 엇갈린 줄로 깔고 위 줄 송이가 아래 줄 위에 얹힌다 → 송이마다 위가 밝고 아래는 어두운 틈 (층 무늬)
//   - 점 자리는 푸아송 디스크(줄 없는 고른 간격), 크기를 조금씩 달리해 살짝 겹친다 → 벌집 무늬가 없다
//   - 바탕은 점 자리마다 점보다 조금 큰 원 → 바탕과 잎의 테두리가 정확히 같다 (삐져나온 바탕·떠 있는 점 없음)
// inLobe(x, y, m) → 그 자리를 덮는 가장 앞 덩어리 { x, y, r } 또는 null (m: 덩어리를 넓히는/줄이는 여유)
function createFoliage(rnd, { width, height, dot, cr, inLobe }) {
  const hw = width / 2, clumps = [];
  const rowH = cr * 1.25, colW = cr * 1.6;
  for (let row = 0, cy = -height; cy < 0; row++, cy += rowH) {
    for (let cx = -hw * 1.2 + (row % 2) * colW / 2; cx < hw * 1.2; cx += colW) {
      const x = cx + (rnd() - 0.5) * colW * 0.45, y = cy + (rnd() - 0.5) * rowH * 0.6;
      if (inLobe(x, y, -cr * 0.35)) clumps.push({ x, y, r: cr * lerp(0.9, 1.1, rnd()) });   // 가장자리 송이가 너무 튀어나오지 않게
    }
  }
  const clumpAt = (x, y) => {           // 가장 위(앞)에 얹힌 송이
    for (const c of clumps) if ((x - c.x) ** 2 + (y - c.y) ** 2 <= c.r * c.r) return c;
    // 송이 사이 빈자리가 덩어리 안이면 가장 가까운 송이에 붙인다 (안쪽에 구멍이 생기지 않게)
    if (!inLobe(x, y, -cr * 0.35)) return null;
    let best = null, bd = Infinity;
    for (const c of clumps) { const d = (x - c.x) ** 2 + (y - c.y) ** 2; if (d < bd) { bd = d; best = c; } }
    return best;
  };
  // 잎 점 자리: 푸아송 디스크 — 점끼리 최소 간격만 지키며 무작위로 채운다 → 간격은 고르되 격자의 줄·방향(벌집 무늬)이 없다
  const leaves = [];
  for (const p of poissonDisk(rnd, -hw * 1.25, -height * 1.06, hw * 1.25, 0, dot * 1.75)) {
      const px = p.x, py = p.y;
      const c = clumpAt(px, py);
      if (!c || py > -dot) continue;
      const l = inLobe(c.x, c.y) ?? { x: 0, y: -height / 2, r: Math.max(hw, height / 2) };
      leaves.push({
        x: px, y: py, r: dot * lerp(0.8, 1.4, rnd() ** 1.5),
        cx: (px - c.x) / c.r, cy: (py - c.y) / c.r, lx: (c.x - l.x) / l.r, ly: (c.y - l.y) / l.r,
        gx: px / hw, gy: 1 + 2 * py / height, keep: rnd(), toneR: rnd(),
      });
  }
  return leaves;
}

// 바탕 + 잎 점. 밝기 = 송이(빛 쪽 위가 밝다) + 큰 덩어리 + 전체. 어두운 쪽 점은 빠져서 송이 사이 틈이 생긴다
function drawFoliage(ctx, leaves, dot, mass, colors, light) {
  ctx.fillStyle = mass;
  ctx.beginPath();
  // 반지름은 점 사이 최대 빈자리(= 최소 간격 1.75점)보다 조금 크게 → 틈으로 하늘·땅이 비치지 않는다
  for (const l of leaves) { const r = Math.max(l.r * 1.35, dot * 1.85); ctx.moveTo(l.x + r, l.y); ctx.arc(l.x, l.y, r, 0, Math.PI * 2); }
  ctx.fill();
  const n = colors.length;
  // 송이 하나하나는 거의 위에서 빛을 받는다 (옆 빛을 그대로 쓰면 송이가 비스듬한 줄무늬처럼 보인다)
  const cm = Math.hypot(light.x * 0.5, light.y), clx = light.x * 0.5 / cm, cly = light.y / cm;
  for (const l of leaves) {
    const lit = clamp01(0.42 + 0.6 * (l.cx * clx + l.cy * cly) + 0.18 * (l.lx * light.x + l.ly * light.y) + 0.25 * (l.gx * light.x + l.gy * light.y));
    // 보일지는 거의 밝기로만 정한다 (무작위는 조금) → 송이마다 밝은 윗부분과 어두운 틈이 또렷하다
    l.tone = lit < 0.2 + l.keep * 0.16 ? -1 : Math.min(n - 1, Math.floor(clamp01((lit - 0.2) * 1.15 + (l.toneR - 0.5) * 0.08) * n));
  }
  colors.forEach((col, k) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const l of leaves) { if (l.tone !== k) continue; ctx.moveTo(l.x + l.r, l.y); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); }
    ctx.fill();
  });
}

function createBush(opts = {}) {
  const rnd = mulberry32(opts.seed ?? 5);
  const width = opts.width ?? 300, height = opts.height ?? 200;
  const hw = width / 2;
  const dot = opts.dotSize ?? Math.max(1.4, width / 110);    // 원 크기 기준
  const bush = {
    width, height,
    palette: { ...BUSH_PALETTE, ...(opts.palette || {}) },
    blobs: [], leaves: [], flowers: [],
  };

  // 1) 덩어리: 반타원 가장자리를 따라 원을 배치 + 안쪽을 채우는 큰 타원
  const n = opts.lumps ?? 9;
  for (let i = 0; i < n; i++) {
    const th = Math.PI - ((i + 0.5) / n) * Math.PI + (rnd() - 0.5) * 0.2;
    const ex = Math.cos(th) * hw, ey = -Math.sin(th) * height * lerp(0.82, 1.08, rnd());
    const r = lerp(0.1, 0.24, rnd()) * width;
    bush.blobs.push({ x: ex - Math.cos(th) * r * 0.8, y: ey + Math.sin(th) * r * 0.8, r });
  }
  bush.core = { x: 0, y: -height * 0.42, rx: hw * 0.86, ry: height * 0.46 };

  // 후보 점과 난수만 정해두고, 보일지·무슨 색일지는 그릴 때 장면 빛으로 정한다
  // 2) 잎: 둥근 나무와 같은 잎 송이 + 고른 점 (덩어리 = 몸통 타원·바닥 띠·둘레 원)
  const coreLobe = { x: bush.core.x, y: bush.core.y, r: Math.max(bush.core.rx, bush.core.ry) };
  const inLobe = (x, y, m = 0) => {
    if (y > 0) return null;
    const c = bush.core;
    let hit = ((x - c.x) / (c.rx + m)) ** 2 + ((y - c.y) / (c.ry + m)) ** 2 <= 1 || (y > -height * 0.3 && Math.abs(x) < hw * 0.9 + m) ? coreLobe : null;
    for (const b of bush.blobs) if ((x - b.x) ** 2 + (y - b.y) ** 2 <= (b.r + m) ** 2) hit = b;
    return hit;
  };
  bush.dot = dot;
  bush.leaves = createFoliage(rnd, { width, height, dot, cr: dot * lerp(5, 6.5, rnd()), inLobe });

  // 3) 꽃 후보: 잎 점 자리에서 고른다 (실루엣 밖에 뜨지 않게). 패치 중심은 덤불 윗부분에 치우친다
  const sample = () => bush.leaves[Math.floor(rnd() * bush.leaves.length)] ?? { x: 0, y: -height * 0.4 };
  const patchCount = opts.flowerPatches ?? 8;
  const patches = [];
  for (let i = 0; i < patchCount; i++) {
    let best = sample();
    for (let k = 0; k < 2; k++) { const c = sample(); if (c.y < best.y) best = c; }
    patches.push({ x: best.x, y: best.y, r: lerp(0.18, 0.32, rnd()) * width });
  }
  const flowerCount = opts.flowers ?? Math.round(width * height * 0.022);
  for (let i = 0; i < flowerCount && patches.length; i++) {
    const p = sample();
    let near = 0;
    for (const q of patches) near = Math.max(near, 1 - Math.hypot(p.x - q.x, p.y - q.y) / q.r);
    if (near <= 0) continue;
    bush.flowers.push({ x: p.x, y: p.y, r: dot * lerp(0.9, 1.5, rnd()), near, keep: rnd(), toneR: rnd(), hiR: rnd() });
  }
  return bush;
}

// 장면 빛 기준 밝기: 빛 쪽 윗부분이 밝고, 밑동은 어둡다
function bushLit(bush, light, x, y) {
  const nx = x / (bush.width / 2), ny = (y + bush.height * 0.5) / (bush.height * 0.5);
  return clamp01(0.55 + 0.5 * nx * light.x + 0.55 * ny * light.y);
}

function drawBush(ctx, bush, x, y) {
  const P = bush.palette;
  ctx.save();
  ctx.translate(x, y);

  const circles = (list, pick) => {
    ctx.beginPath();
    for (const c of list) {
      if (pick && !pick(c)) continue;
      ctx.moveTo(c.x + c.r, c.y);
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    }
    ctx.fill();
  };

  const light = lightVector();

  // 0) 땅 그림자: 빛 반대쪽으로 납작하게
  const so = shadowOffset(bush.height * 0.6);
  ctx.fillStyle = SHADOW_COLOR;
  ctx.beginPath();
  ctx.ellipse(so.dx * 0.5, 2, bush.width * 0.48 + Math.abs(so.dx) * 0.5, Math.max(4, bush.height * 0.05 + so.dy * 0.5), 0, 0, Math.PI * 2);
  ctx.fill();

  // 땅선 아래는 자른다: 양 끝 덩어리 원이 땅 밑으로 내려가 바퀴처럼 보이지 않게 (바닥은 평평하게)
  ctx.save();
  ctx.beginPath();
  ctx.rect(-bush.width, -bush.height * 2, bush.width * 2, bush.height * 2);
  ctx.clip();

  // 1) 바탕 + 잎 (둥근 나무와 같은 방식)
  drawFoliage(ctx, bush.leaves, bush.dot, P.mass, P.leaves, light);

  // 2) 꽃 + 밝은 점
  for (const f of bush.flowers) {
    const lit = bushLit(bush, light, f.x, f.y);
    f.tone = f.keep > f.near * lerp(0.35, 1, lit) + 0.04 ? -1 : Math.min(2, Math.floor(clamp01(lit * 0.7 + f.toneR * 0.4) * 3));
    f.hi = f.tone === 2 && f.hiR < 0.35;
  }
  P.flowers.forEach((col, k) => { ctx.fillStyle = col; circles(bush.flowers, (f) => f.tone === k); });
  ctx.fillStyle = P.flowerHighlight;
  ctx.beginPath();
  for (const f of bush.flowers) {
    if (!f.hi) continue;
    const r = f.r * 0.4;
    ctx.moveTo(f.x - f.r * 0.3 + r, f.y - f.r * 0.3);
    ctx.arc(f.x - f.r * 0.3, f.y - f.r * 0.3, r, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.restore();   // 땅선 자르기
  ctx.restore();
}

/* plants.js — 야자수·덤불 말고 다른 식물: 둥근 나무, 용설란·유카, 화분 (Canvas 2D)
 * 의존: nagai-util.js, bush.js (덤불 꽃 색)
 *
 * 사용법
 *   const t = createRoundTree({ seed, width: 260, height: 320, variant: 'green' });   drawRoundTree(ctx, t, x, groundY)
 *   const a = createAgave({ seed, size: 120 });              drawAgave(ctx, a, x, groundY)       // 용설란
 *   const y = createAgave({ seed, size: 80, stems: 2 });     drawAgave(ctx, y, x, groundY)       // 유카: 줄기 위에 잎 뭉치
 *   화분에 심기: create…({ pot: { w: 60, h: 50 } })
 *   하늘별 색: create…({ tone: 'day' | 'dusk' | 'night' })
 *
 * 화풍
 *   둥근 나무: 덤불처럼 거의 검은 녹색 덩어리를 먼저 깔고, 덩어리마다 빛 쪽 위에 잎 점을 촘촘하게
 *   용설란·유카: 잎마다 가운데 잎맥을 따라 접힌 두 면 → 빛 쪽 면은 밝게, 반대쪽은 어둡게 (단계 음영)
 */

const PLANT_BASE = {
  agave: { leaves: ['#1f4a50', '#33696d', '#56928a', '#96c6b1'], edge: '#e3d47e' },
  yucca: { leaves: ['#113c24', '#1d5730', '#367c3e', '#68a754'], edge: '#c9d98a', trunk: '#8a6a48', trunkShade: '#4a3424', dead: '#8a7148' },
  pot: { body: '#c8643c', light: '#e3895a', dark: '#8a3c22', rim: '#dc7a4e' },
  potWhite: { body: '#e6ded2', light: '#faf6f0', dark: '#b4a898', rim: '#f2ece2' },
};
// 분홍 해질녘은 한 단계, 연보라 저녁은 거의 실루엣까지 가라앉힌다 (덤불과 같은 정도)
const PLANT_TONE = { day: null, dusk: ['#06110a', 0.42], night: ['#05080c', 0.74] };
function plantPalette(name, tone = 'day') {
  const base = PLANT_BASE[name], t = PLANT_TONE[tone];
  if (!t) return base;
  const dim = (c) => (Array.isArray(c) ? c.map(dim) : mixColor(c, t[0], name.startsWith('pot') ? t[1] * 0.8 : t[1]));
  const out = {};
  for (const k in base) out[k] = dim(base[k]);
  return out;
}

// 덤불 꽃 색: 장면마다 한 가지 (부겐빌레아 분홍이 가장 흔하다)
const FLOWER_SETS = {
  pink: null,
  red: { flowers: ['#a8202c', '#d8423a', '#f2785a'], flowerHighlight: '#ffe2d2' },        // 히비스커스
  white: { flowers: ['#b9b8cc', '#e2e0ec', '#fbfaff'], flowerHighlight: '#ffffff' },      // 협죽도·치자
  yellow: { flowers: ['#c0861a', '#e4b22e', '#f4d65c'], flowerHighlight: '#fff6d2' },     // 알라만다
  purple: { flowers: ['#6e3296', '#9256bc', '#bc86de'], flowerHighlight: '#f2e4ff' },     // 보라 부겐빌레아
};
function bushPaletteFor(tone, flowerSet) {
  const base = tone === 'night' ? BUSH_NIGHT : tone === 'dusk' ? BUSH_DUSK : BUSH_PALETTE;
  const f = FLOWER_SETS[flowerSet];
  if (!f) return tone === 'day' ? undefined : base;
  const t = PLANT_TONE[tone];
  const dim = (c) => (t ? mixColor(c, '#2a0e22', t[1] * 0.75) : c);
  return { ...base, flowers: f.flowers.map(dim), flowerHighlight: dim(f.flowerHighlight) };
}

/* ───────── 화분 ───────── */

// (0,0) = 화분 밑 가운데. 위로 좁아지지 않고 넓어지는 토분 + 테두리 띠. 빛 쪽 절반이 밝다
function drawPot(ctx, pot, light) {
  const P = pot.palette, w = pot.w, h = pot.h, rimH = h * 0.2, bw = w * 0.74;
  const so = shadowOffset(h * 0.8);
  ctx.fillStyle = SHADOW_COLOR;
  ctx.beginPath();
  ctx.ellipse(so.dx * 0.5, 1, w * 0.5 + Math.abs(so.dx) * 0.5, Math.max(2, w * 0.06 + so.dy * 0.5), 0, 0, Math.PI * 2);
  ctx.fill();
  const lit = light.x < 0 ? -1 : 1;
  const half = (side, color) => fillPoly(ctx, [
    { x: 0, y: 0 }, { x: side * bw / 2, y: 0 }, { x: side * w * 0.47, y: -(h - rimH) }, { x: 0, y: -(h - rimH) },
  ], color);
  half(lit, P.light); half(-lit, P.body);
  fillPoly(ctx, [{ x: -lit * w * 0.47, y: -(h - rimH) }, { x: -lit * bw / 2, y: 0 }, { x: -lit * bw * 0.36, y: 0 }, { x: -lit * w * 0.33, y: -(h - rimH) }], P.dark);
  ctx.fillStyle = P.rim; ctx.fillRect(-w / 2, -h, w, rimH);
  ctx.fillStyle = P.dark; ctx.fillRect(lit > 0 ? -w / 2 : w / 2 - w * 0.16, -h, w * 0.16, rimH);
  ctx.fillStyle = P.light; ctx.fillRect(-w / 2, -h, w, Math.max(1, rimH * 0.22));
}
function createPotOpt(opts, rnd) {
  if (!opts.pot) return null;
  return { w: opts.pot.w ?? 60, h: opts.pot.h ?? 50, palette: plantPalette(opts.pot.white ?? rnd() < 0.35 ? 'potWhite' : 'pot', opts.tone) };
}

/* ───────── 둥근 나무 (활엽수) ─────────
 * 큰 원 덩어리(로브)를 아래는 넓게 위로는 좁게 쌓아 둥글둥글한 실루엣을 만들고, 온통 작은 잎 점으로 덮는다.
 * 잎 점의 밝기는 그 점이 속한 덩어리 기준으로 정한다 → 덩어리마다 빛 쪽 위가 밝고 아래가 어두워 울퉁불퉁해 보인다.
 * 색: green 보통 녹색, deep 짙은 청록, lime 밝은 연두. 바탕(mass)은 검정이 아니라 가장 어두운 잎보다 조금 짙은 녹색
 */
const TREE_LEAVES = {
  green: { mass: '#0f301b', leaves: ['#123f24', '#1d5a30', '#2f7a3c', '#55a04c', '#9ccc66'] },
  deep: { mass: '#0a2724', leaves: ['#0c332e', '#15493e', '#21624f', '#3a8266', '#6eae8c'] },
  lime: { mass: '#173f15', leaves: ['#1f5418', '#337622', '#559a2e', '#86c23c', '#c8e46a'] },
};

function createRoundTree(opts = {}) {
  const rnd = mulberry32(opts.seed ?? 3);
  const width = opts.width ?? 260, height = opts.height ?? width * 1.2, hw = width / 2;
  // 큰 나무도 잎 점은 너무 굵지 않게
  const dot = Math.max(1.3, Math.min(width / 110, 2.6));
  // 몸통: 큰 타원 하나 + 그 둘레를 따라 겹친 둥근 덩어리 (울퉁불퉁한 가장자리) + 안쪽 덩어리 몇 개
  const core = { x: 0, y: -height * 0.52, rx: hw * 0.8, ry: height * 0.44 };
  const lobes = [];
  const n = opts.lumps ?? 8 + Math.floor(rnd() * 4);
  for (let i = 0; i < n; i++) {
    const th = lerp(-0.25, Math.PI + 0.25, (i + lerp(0.25, 0.75, rnd())) / n);   // 오른쪽 아래 → 꼭대기 → 왼쪽 아래
    const r = lerp(0.2, 0.3, rnd()) * width;
    const ex = Math.cos(th) * core.rx, ey = core.y - Math.sin(th) * core.ry;
    lobes.push({ x: ex - Math.cos(th) * r * 0.55, y: Math.min(-r * 0.7, ey + Math.sin(th) * r * 0.55), r });
  }
  for (let i = 0; i < 2 + Math.floor(rnd() * 3); i++) {
    lobes.push({ x: (rnd() - 0.5) * hw * 0.9, y: core.y + (rnd() - 0.3) * core.ry * 0.9, r: lerp(0.18, 0.26, rnd()) * width });
  }
  // 앞(화면 아래쪽) 덩어리가 위 덩어리를 가린다
  lobes.sort((a, b) => a.y - b.y);
  // 몸통 타원은 맨 뒤 덩어리로 친다 (밝기 기준은 나무 전체)
  const coreLobe = { x: core.x, y: core.y, r: Math.max(core.rx, core.ry) };
  const inLobe = (x, y, m = 0) => {
    let hit = ((x - core.x) / (core.rx + m)) ** 2 + ((y - core.y) / (core.ry + m)) ** 2 <= 1 ? coreLobe : null;
    for (const l of lobes) if ((x - l.x) ** 2 + (y - l.y) ** 2 <= (l.r + m) ** 2) hit = l;   // 가장 앞의 것
    return hit;
  };
  const leaves = createFoliage(rnd, { width, height, dot, cr: dot * lerp(6, 7.5, rnd()), inLobe });
  const P = TREE_LEAVES[opts.variant] ?? TREE_LEAVES.green, t = PLANT_TONE[opts.tone ?? 'day'];
  const dim = (c) => (t ? mixColor(c, t[0], t[1]) : c);
  return { width, height, dot, lobes, leaves, trunk: rnd() < 0.5, palette: opts.palette ?? { mass: dim(P.mass), leaves: P.leaves.map(dim), trunk: dim('#4a3322') } };
}

function drawRoundTree(ctx, tr, x, y) {
  const P = tr.palette, light = lightVector();
  ctx.save();
  ctx.translate(x, y);
  // 그림자: 밑동 + 덩어리들을 땅에 눕힌 모양
  const pts = [{ x: -tr.width * 0.3, y: 0 }, { x: tr.width * 0.3, y: 0 }];
  for (const l of tr.lobes) for (const a of [-1, 1]) { const o = shadowOffset(-l.y); pts.push({ x: l.x + a * l.r * 0.9 + o.dx, y: o.dy }); }
  fillPoly(ctx, convexHull(pts), SHADOW_COLOR);
  // 밑동 줄기 (가끔 덩어리 아래로 살짝 보인다)
  if (tr.trunk) { ctx.fillStyle = P.trunk; ctx.fillRect(-tr.width * 0.035, -tr.height * 0.25, tr.width * 0.07, tr.height * 0.25); }
  drawFoliage(ctx, tr.leaves, tr.dot, P.mass, P.leaves, light);
  ctx.restore();
}

/* ───────── 용설란 · 유카 ───────── */

// 잎 하나: 땅과 이루는 각(el), 둘레 방향(az) → 화면에서는 앞쪽(az>0) 잎일수록 아래로 처져 보인다
function agaveLeaf(rnd, size, el, az, narrow, droop) {
  const ce = Math.cos(el);
  const d = { x: ce * Math.cos(az), y: -Math.sin(el) + ce * Math.sin(az) * 0.32 };
  const m = Math.hypot(d.x, d.y) || 1;
  const len = size * lerp(0.75, 1, rnd()) * (1 - 0.22 * Math.max(0, el) / 1.5) * Math.max(0.55, m);
  return {
    dx: d.x / m, dy: d.y / m, len, z: ce * Math.sin(az), el,
    w: len * (narrow ? lerp(0.06, 0.08, rnd()) : lerp(0.13, 0.17, rnd())),
    droop: len * droop * ce * lerp(0.6, 1.2, rnd()),
  };
}

function createAgave(opts = {}) {
  const rnd = mulberry32(opts.seed ?? 11);
  const size = opts.size ?? 120, stems = opts.stems ?? 0, yucca = stems > 0;
  const pot = createPotOpt(opts, rnd);
  const heads = [];
  if (!yucca) heads.push({ x: 0, y: 0, size });
  for (let i = 0; i < stems; i++) {
    // 유카: 굵고 짧은 줄기 끝마다 큼직한 뾰족 잎 뭉치 (야자수처럼 가늘고 길지 않게)
    const lean = (i - (stems - 1) / 2) * lerp(0.3, 0.5, rnd()) + (rnd() - 0.5) * 0.2;
    const h = size * lerp(0.8, 1.5, rnd()) * (i === Math.floor(stems / 2) ? 1.2 : 1);
    heads.push({ x: Math.sin(lean) * h, y: -Math.cos(lean) * h, size: size * lerp(0.8, 1, rnd()), stemW: size * lerp(0.14, 0.18, rnd()) });
  }
  for (const hd of heads) {
    const leaves = [];
    if (yucca) {
      const n = 26 + Math.floor(rnd() * 10);
      for (let i = 0; i < n; i++) leaves.push(agaveLeaf(rnd, hd.size, lerp(-0.25, 1.5, Math.pow(rnd(), 0.7)), rnd() * Math.PI * 2, true, 0.06));
      // 잎 뭉치 바로 아래 짧게 처진 마른 잎
      hd.dead = Array.from({ length: 7 + Math.floor(rnd() * 5) }, () => ({ a: lerp(-1, 1, rnd()), len: hd.size * lerp(0.18, 0.32, rnd()) }));
    } else {
      // 바깥 고리는 거의 눕고, 안쪽으로 갈수록 선다
      const rings = [[9, 10, 0.1, 0.32], [7, 8, 0.48, 0.7], [4, 5, 0.85, 1.12], [2, 3, 1.25, 1.45]];
      for (const [a, b, e0, e1] of rings) {
        const n = a + Math.floor(rnd() * (b - a + 1)), off = rnd() * Math.PI * 2;
        for (let i = 0; i < n; i++) leaves.push(agaveLeaf(rnd, size, lerp(e0, e1, rnd()), off + (i + (rnd() - 0.5) * 0.5) / n * Math.PI * 2, false, 0.08));
      }
    }
    leaves.sort((a, b) => a.z - b.z);       // 뒤쪽 잎부터
    hd.leaves = leaves;
    hd.edged = !yucca && rnd() < 0.45;      // 노란 테두리 용설란
  }
  heads.sort((a, b) => a.y - b.y);
  return { size, yucca, heads, pot, palette: opts.palette ?? plantPalette(yucca ? 'yucca' : 'agave', opts.tone) };
}

// 가운데 잎맥 + 양쪽 가장자리 (s = 0 밑동 → 1 끝)
function leafHalves(bx, by, dx, dy, len, w, droop, prof, segs) {
  const tx = bx + dx * len, ty = by + dy * len + droop;
  const cx = bx + dx * len * 0.6, cy = by + dy * len * 0.6;
  const mid = [], L = [], R = [];
  for (let i = 0; i <= segs; i++) {
    const s = i / segs, u = 1 - s;
    const px = u * u * bx + 2 * u * s * cx + s * s * tx, py = u * u * by + 2 * u * s * cy + s * s * ty;
    const gx = 2 * u * (cx - bx) + 2 * s * (tx - cx), gy = 2 * u * (cy - by) + 2 * s * (ty - cy);
    const gm = Math.hypot(gx, gy) || 1, nx = -gy / gm, ny = gx / gm, ww = w * prof(s);
    mid.push({ x: px, y: py, nx, ny, w: ww });
  }
  const edge = (side, out) => { for (const p of mid) out.push({ x: p.x + p.nx * p.w * side, y: p.y + p.ny * p.w * side }); };
  edge(1, L); edge(-1, R);
  return { mid, L, R };
}

function drawAgave(ctx, ag, x, y) {
  const P = ag.palette, light = lightVector();
  ctx.save();
  ctx.translate(x, y);
  if (ag.pot) { drawPot(ctx, ag.pot, light); ctx.translate(0, -ag.pot.h * 0.92); }
  // 그림자
  ctx.fillStyle = SHADOW_COLOR;
  if (!ag.pot) {
    for (const hd of ag.heads) {
      const o = shadowOffset(-hd.y + hd.size * 0.3);
      ctx.beginPath();
      ctx.ellipse(hd.x + o.dx * 0.6, o.dy * 0.6 + 1, hd.size * 0.85 + Math.abs(o.dx) * 0.25, Math.max(3, hd.size * 0.16), 0, 0, Math.PI * 2);
      ctx.fill();
      if (hd.stemW) {
        ctx.strokeStyle = SHADOW_COLOR; ctx.lineWidth = hd.stemW; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(hd.x + o.dx * 0.6, o.dy * 0.6); ctx.stroke();
      }
    }
  }
  // 유카 줄기: 빛 쪽 절반 밝게
  const ls = light.x < 0 ? -1 : 1;
  for (const hd of ag.heads) {
    if (!hd.stemW) continue;
    const m = Math.hypot(hd.x, hd.y), nx = -hd.y / m, ny = hd.x / m, w0 = hd.stemW * 0.75, w1 = hd.stemW * 0.5;
    const side = (s, col) => fillPoly(ctx, [{ x: 0, y: 0 }, { x: nx * w0 * s, y: ny * w0 * s }, { x: hd.x + nx * w1 * s, y: hd.y + ny * w1 * s }, { x: hd.x, y: hd.y }], col);
    side(-ls, P.trunkShade); side(ls, P.trunk);
  }
  for (const hd of ag.heads) {
    ctx.save();
    ctx.translate(hd.x, hd.y);
    if (hd.dead) {
      ctx.strokeStyle = P.dead; ctx.lineCap = 'round';
      for (const d of hd.dead) {
        ctx.lineWidth = hd.size * 0.05;
        ctx.beginPath(); ctx.moveTo(0, -hd.size * 0.05);
        ctx.quadraticCurveTo(Math.sin(d.a) * d.len * 0.6, d.len * 0.1, Math.sin(d.a) * d.len * 0.7, d.len);
        ctx.stroke();
      }
    }
    const prof = ag.yucca ? (s) => Math.min(1, 0.55 + s * 2) * Math.pow(1 - s, 0.6) : (s) => (s < 0.18 ? lerp(0.75, 1, s / 0.18) : Math.pow((1 - s) / 0.82, 0.85));
    for (const lf of hd.leaves) {
      const h = leafHalves(0, 0, lf.dx, lf.dy, lf.len, lf.w, lf.droop, prof, 6);
      const back = lf.z < -0.3 ? 1 : 0;
      const lay = 0.18 * (1 - Math.max(0, lf.el) / 1.5);     // 누운 잎일수록 윗면이 하늘을 본다
      const half = (pts, sgn) => {
        const p = h.mid[3];
        const lit = clamp01(0.45 + 0.5 * sgn * (p.nx * light.x + p.ny * light.y) + lay);
        const k = Math.max(0, Math.min(3, Math.floor(lit * 3.99) - back));
        fillPoly(ctx, [...pts, ...h.mid.slice().reverse()], P.leaves[k]);
      };
      half(h.L, 1); half(h.R, -1);
      if (hd.edged || ag.yucca) {
        ctx.strokeStyle = P.edge; ctx.lineWidth = Math.max(0.6, lf.w * (ag.yucca ? 0.12 : 0.14)); ctx.lineJoin = 'round';
        if (ag.yucca) ctx.globalAlpha = 0.5;
        for (const e of [h.L, h.R]) { ctx.beginPath(); e.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke(); }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
  }
  ctx.restore();
}

/* car.js — 나가이 히로시 스타일 클래식카 옆모습 (정적, Canvas 2D)
 * 의존: nagai-util.js (그림자 방향은 장면 빛 SCENE_LIGHT 를 따른다)
 *
 * 사용법
 *   const car = createCar({ length: 300, color: '#7cc7d0', roof: 'white', facing: 1 });
 *   drawCar(ctx, car, x, groundY);
 *     view '3/4'  → (x, groundY) = 차 가운데 바닥
 *     view 'side' → (x, groundY) = 차 뒤끝 아래 (facing 1 기준)
 *
 *   body: 'coupe' (2도어, 기본) | 'sedan' (각진 4도어)
 *   roof: 'white' (흰 지붕) | 'body' (차체색 지붕) | 'open' (컨버터블, 쿠페만)
 *   wheels: 'cap' (크롬 휠캡) | 'wire' (와이어 휠, 세단 기본)
 *   facing: 1 오른쪽을 봄 / -1 왼쪽을 봄
 *
 * 모든 좌표는 차 길이를 1로 둔 단위 좌표(위쪽이 +). 그릴 때 length 배로 확대한다.
 *
 * 그리는 순서
 *   바닥 그림자 → 휠하우스 어둠 → 타이어(흰 띠, 크롬 휠캡) → 차체 [기본색 → 윗면 밝은 띠 → 아랫면 그늘
 *   → 크롬 몰딩] → 지붕/유리 또는 컨버터블 실내 → 범퍼·라이트
 */

function createCar(opts = {}) {
  const color = opts.color ?? '#7cc7d0';
  return {
    length: opts.length ?? 300,
    facing: opts.facing ?? 1,
    view: opts.view ?? '3/4',               // '3/4' (비스듬히, 기본) | 'side' (옆모습)
    yaw: opts.yaw,                          // 3/4: 앞쪽이 보이는 정도 (기본 0.6)
    pitch: opts.pitch,                      // 3/4: 위에서 내려다보는 정도 (기본 0.2)
    body: opts.body ?? 'coupe',
    roof: opts.roof ?? 'white',
    wheels: opts.wheels ?? (opts.body === 'sedan' ? 'wire' : 'cap'),
    palette: {
      body: color,
      bodyLight: mixColor(color, '#ffffff', 0.4),
      bodyShade: mixColor(color, '#1c2a4a', 0.35),
      bodyDark: mixColor(color, '#1c2a4a', 0.6),
      roof: opts.roofColor ?? '#f3f1ea',
      glass: '#2a3b4f',
      glassGlint: '#8fb0c6',
      interior: '#7a2c1e',
      chrome: '#cfd5dc',
      chromeShade: '#8d96a3',
      chromeLight: '#ffffff',
      tire: '#131316',
      whitewall: '#f2f2ee',
      wheelWell: '#100e14',
      shadow: SHADOW_COLOR,
      tail: '#c2262e',
      lamp: '#f4f3e2',
      marker: '#e98a2e',
      ...(opts.palette || {}),
    },
  };
}

function drawCar(ctx, car, x, y) {
  if (car.view === '3/4') return drawCar3q(ctx, car, x, y);
  const P = car.palette, L = car.length;
  const Y = (v) => -v;                       // 단위 좌표: 위쪽이 + → 캔버스 y
  const poly = (pts) => {
    ctx.beginPath();
    pts.forEach(([px, py], i) => (i ? ctx.lineTo(px, Y(py)) : ctx.moveTo(px, Y(py))));
    ctx.closePath();
  };
  const circle = (cx, cy, r, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(cx, Y(cy), r, 0, Math.PI * 2);
    ctx.fill();
  };

  ctx.save();
  ctx.translate(x + (car.facing < 0 ? L : 0), y);
  ctx.scale(L * car.facing, L);

  // 바닥 그림자: 장면 빛 반대쪽으로 (차가 반대로 서 있어도 방향 유지)
  const so = shadowOffset(0.26);
  const s = so.dx * car.facing, d = 0.035 + so.dy * 3.6;
  ctx.fillStyle = P.shadow;
  ctx.beginPath();
  ctx.moveTo(-0.02, -0.002);
  ctx.lineTo(1.02, -0.002);
  ctx.lineTo(1.02 + s, d);
  ctx.lineTo(-0.02 + s, d);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(0.1, -0.06, 0.8, 0.06);                     // 차 밑 그늘

  // 바퀴
  const sedan = car.body === 'sedan';
  const wheels = sedan ? [0.215, 0.775] : [0.2, 0.78], wr = sedan ? 0.06 : 0.062;
  for (const wx of wheels) circle(wx, 0.068, sedan ? 0.088 : 0.092, P.wheelWell);
  for (const wx of wheels) {
    circle(wx, wr, wr, P.tire);
    circle(wx, wr, wr * (sedan ? 0.78 : 0.8), P.whitewall);   // 흰 띠
    circle(wx, wr, wr * (sedan ? 0.7 : 0.62), P.tire);
    circle(wx, wr, wr * 0.6, P.chrome);
    if (car.wheels === 'wire') {                              // 와이어 휠: 가는 방사선
      ctx.strokeStyle = P.chromeShade;
      ctx.lineWidth = 0.0016;
      ctx.beginPath();
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        ctx.moveTo(wx + Math.cos(a) * wr * 0.16, Y(wr) + Math.sin(a) * wr * 0.16);
        ctx.lineTo(wx + Math.cos(a + 0.35) * wr * 0.58, Y(wr) + Math.sin(a + 0.35) * wr * 0.58);
      }
      ctx.stroke();
      circle(wx, wr, wr * 0.2, P.chrome);
    }
    circle(wx - wr * 0.12, wr + wr * 0.12, wr * 0.16, P.chromeLight);
    circle(wx, wr, wr * 0.07, P.bodyDark);
  }

  if (car.body === 'sedan') drawSedanBody(ctx, car, P, Y, poly, circle);
  else drawCoupeBody(ctx, car, P, Y, poly, circle);

  ctx.restore();
}

function drawCoupeBody(ctx, car, P, Y, poly, circle) {
  // 차체 외곽선 (휠아치 포함)
  const bodyPath = () => {
    ctx.beginPath();
    ctx.moveTo(0.02, Y(0.055));
    ctx.lineTo(0.0, Y(0.11));
    ctx.lineTo(0.004, Y(0.175));
    ctx.lineTo(0.03, Y(0.2));
    ctx.lineTo(0.29, Y(0.205));
    ctx.lineTo(0.665, Y(0.205));
    ctx.lineTo(0.93, Y(0.196));
    ctx.quadraticCurveTo(0.99, Y(0.19), 0.997, Y(0.15));
    ctx.lineTo(1.0, Y(0.1));
    ctx.lineTo(0.98, Y(0.055));
    ctx.lineTo(0.875, Y(0.055));
    ctx.arc(0.78, Y(0.068), 0.095, 0, Math.PI, true);
    ctx.lineTo(0.295, Y(0.055));
    ctx.arc(0.2, Y(0.068), 0.095, 0, Math.PI, true);
    ctx.closePath();
  };

  // 지붕은 차체보다 먼저 (창틀 아래쪽이 차체에 덮이도록)
  if (car.roof !== 'open') {
    ctx.fillStyle = car.roof === 'white' ? P.roof : P.body;
    poly([[0.3, 0.2], [0.405, 0.318], [0.57, 0.321], [0.668, 0.2]]);
    ctx.fill();
    ctx.fillStyle = P.glass;
    poly([[0.33, 0.2], [0.412, 0.302], [0.468, 0.304], [0.468, 0.2]]);
    ctx.fill();
    poly([[0.486, 0.2], [0.486, 0.305], [0.562, 0.306], [0.638, 0.2]]);
    ctx.fill();
    // 유리에 비친 하늘 사선
    ctx.fillStyle = P.glassGlint;
    poly([[0.5, 0.2], [0.53, 0.2], [0.58, 0.29], [0.55, 0.29]]);
    ctx.fill();
  } else {
    // 컨버터블: 붉은 실내, 등받이, 핸들, 앞유리 틀
    ctx.fillStyle = P.interior;
    poly([[0.32, 0.2], [0.34, 0.232], [0.4, 0.236], [0.42, 0.262], [0.47, 0.262], [0.49, 0.236], [0.61, 0.234], [0.63, 0.2]]);
    ctx.fill();
    ctx.strokeStyle = P.tire;
    ctx.lineWidth = 0.006;
    ctx.beginPath();
    ctx.ellipse(0.565, Y(0.245), 0.012, 0.03, -0.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = withAlpha(P.glassGlint, 0.35);
    poly([[0.6, 0.2], [0.555, 0.292], [0.585, 0.292], [0.645, 0.2]]);
    ctx.fill();
    ctx.strokeStyle = P.chrome;
    ctx.lineWidth = 0.007;
    ctx.beginPath();
    ctx.moveTo(0.645, Y(0.2)); ctx.lineTo(0.585, Y(0.292)); ctx.lineTo(0.553, Y(0.292));
    ctx.stroke();
  }

  // 차체: 기본색 → 면 분할 음영 (차체 모양으로 잘라서)
  bodyPath();
  ctx.fillStyle = P.body;
  ctx.fill();
  ctx.save();
  bodyPath();
  ctx.clip();
  ctx.fillStyle = P.bodyLight;
  ctx.fillRect(-0.1, Y(0.215), 1.2, 0.032);                // 후드·트렁크 윗면
  ctx.fillStyle = P.bodyShade;
  ctx.fillRect(-0.1, Y(0.128), 1.2, 0.128);                // 옆면 아래쪽
  ctx.fillStyle = P.bodyDark;
  ctx.fillRect(-0.1, Y(0.09), 1.2, 0.09);                  // 로커 패널
  ctx.fillStyle = P.chrome;
  ctx.fillRect(0.05, Y(0.133), 0.9, 0.006);                // 사이드 몰딩
  ctx.fillStyle = P.bodyShade;
  ctx.fillRect(0.47, Y(0.198), 0.003, 0.11);               // 문틈
  ctx.fillStyle = P.chrome;
  ctx.fillRect(0.43, Y(0.172), 0.025, 0.006);              // 손잡이
  ctx.restore();

  // 범퍼, 라이트
  ctx.fillStyle = P.chrome;
  ctx.fillRect(-0.012, Y(0.102), 0.05, 0.03);
  ctx.fillRect(0.955, Y(0.102), 0.057, 0.03);
  ctx.fillStyle = P.chromeLight;
  ctx.fillRect(-0.012, Y(0.1), 0.05, 0.006);
  ctx.fillRect(0.955, Y(0.1), 0.057, 0.006);
  ctx.fillStyle = P.tail;
  ctx.fillRect(0.0, Y(0.172), 0.012, 0.04);
  circle(0.986, 0.152, 0.015, P.chrome);
  circle(0.988, 0.153, 0.01, P.lamp);
}

// 각진 4도어 세단: 평평한 후드·트렁크, 곧추선 지붕, 두꺼운 C필러, 문 두 쌍
function drawSedanBody(ctx, car, P, Y, poly, circle) {
  const bodyPath = () => {
    ctx.beginPath();
    ctx.moveTo(0.02, Y(0.055));
    ctx.lineTo(0.0, Y(0.1));
    ctx.lineTo(0.0, Y(0.19));
    ctx.lineTo(0.014, Y(0.218));
    ctx.lineTo(0.27, Y(0.222));
    ctx.lineTo(0.69, Y(0.222));
    ctx.lineTo(0.965, Y(0.214));
    ctx.lineTo(0.996, Y(0.198));
    ctx.lineTo(1.0, Y(0.1));
    ctx.lineTo(0.982, Y(0.055));
    ctx.lineTo(0.863, Y(0.055));
    ctx.arc(0.775, Y(0.068), 0.088, 0, Math.PI, true);
    ctx.lineTo(0.303, Y(0.055));
    ctx.arc(0.215, Y(0.068), 0.088, 0, Math.PI, true);
    ctx.closePath();
  };

  // 지붕과 유리 (차체보다 먼저)
  ctx.fillStyle = car.roof === 'white' ? P.roof : P.body;
  poly([[0.262, 0.218], [0.33, 0.338], [0.602, 0.341], [0.695, 0.218]]);
  ctx.fill();
  ctx.fillStyle = P.glass;
  poly([[0.365, 0.222], [0.365, 0.322], [0.468, 0.325], [0.468, 0.222]]);   // 뒷문 창
  ctx.fill();
  poly([[0.486, 0.222], [0.486, 0.326], [0.594, 0.327], [0.668, 0.222]]);   // 앞문 창
  ctx.fill();
  ctx.fillStyle = P.glassGlint;
  poly([[0.512, 0.222], [0.538, 0.222], [0.585, 0.31], [0.56, 0.31]]);
  ctx.fill();
  poly([[0.39, 0.222], [0.405, 0.222], [0.44, 0.3], [0.425, 0.3]]);
  ctx.fill();
  // 창틀 크롬
  ctx.strokeStyle = P.chrome;
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(0.365, Y(0.222)); ctx.lineTo(0.365, Y(0.324)); ctx.lineTo(0.596, Y(0.329)); ctx.lineTo(0.672, Y(0.222));
  ctx.stroke();

  // 차체
  bodyPath();
  ctx.fillStyle = P.body;
  ctx.fill();
  ctx.save();
  bodyPath();
  ctx.clip();
  ctx.fillStyle = P.bodyLight;
  ctx.fillRect(-0.1, Y(0.23), 1.2, 0.03);                  // 후드·트렁크 윗면
  ctx.fillStyle = P.bodyShade;
  ctx.fillRect(-0.1, Y(0.15), 1.2, 0.15);                  // 옆면 아래쪽 (각진 면 경계)
  ctx.fillStyle = P.bodyDark;
  ctx.fillRect(-0.1, Y(0.088), 1.2, 0.088);                // 로커 패널
  ctx.fillStyle = P.chrome;
  ctx.fillRect(0.0, Y(0.222), 1.0, 0.004);                 // 벨트라인 몰딩
  ctx.fillRect(0.02, Y(0.152), 0.96, 0.005);               // 사이드 몰딩
  ctx.fillRect(0.02, Y(0.07), 0.96, 0.006);                // 아래 몰딩
  ctx.fillStyle = P.bodyShade;                             // 문틈: 뒷문 뒤, 가운데, 앞문 앞
  for (const gx of [0.305, 0.476, 0.676]) ctx.fillRect(gx, Y(0.218), 0.003, 0.13);
  ctx.fillStyle = P.chrome;                                // 손잡이
  ctx.fillRect(0.44, Y(0.196), 0.024, 0.006);
  ctx.fillRect(0.64, Y(0.196), 0.024, 0.006);
  ctx.restore();

  // 범퍼 (두툼하게 감싸는 크롬)
  ctx.fillStyle = P.chrome;
  ctx.fillRect(-0.014, Y(0.112), 0.06, 0.042);
  ctx.fillRect(0.952, Y(0.112), 0.064, 0.042);
  ctx.fillStyle = P.chromeShade;
  ctx.fillRect(-0.014, Y(0.09), 0.06, 0.008);
  ctx.fillRect(0.952, Y(0.09), 0.064, 0.008);
  ctx.fillStyle = P.chromeLight;
  ctx.fillRect(-0.014, Y(0.11), 0.06, 0.006);
  ctx.fillRect(0.952, Y(0.11), 0.064, 0.006);
  // 뒤: 세로로 긴 테일램프 / 앞: 네모 헤드램프 + 주황 사이드 램프
  ctx.fillStyle = P.tail;
  ctx.fillRect(0.0, Y(0.205), 0.011, 0.085);
  ctx.fillStyle = P.chrome;
  ctx.fillRect(0.984, Y(0.196), 0.018, 0.036);
  ctx.fillStyle = P.lamp;
  ctx.fillRect(0.987, Y(0.192), 0.013, 0.028);
  ctx.fillStyle = P.marker;
  ctx.fillRect(0.986, Y(0.152), 0.014, 0.022);
}

/* ═════════════════ 3/4 각도 ═════════════════
 * 곡면 3D 모형을 비스듬히(조금 위에서) 보고 그린다.
 *   - 차체: 둥근 단면(볼록한 옆구리, 안으로 말린 아랫단, 둥근 어깨)을 차 길이를 따라 이어 붙인 곡면.
 *     앞뒤 끝은 평면도에서 둥글게 오므라든다
 *   - 캐빈: 위로 갈수록 좁아지는 단면(텀블홈), 부드러운 지붕선, 옆으로 감싸는 앞유리, 기둥과 나란한 옆창
 *   - 면마다 방향(법선)으로 빛 받는 정도를 구하고, 몇 단계로만 끊어서 칠한다 → 곡면이 납작한 색 띠로 나뉨
 *   - 크롬 범퍼는 차 끝을 감싸 돌고, 위를 보는 면은 밝게·옆은 중간·아래는 어둡게 (하늘·수평선·땅을 비춤)
 *   - 원근 없는 투영(평행 투영)이라 멀리 있어도 형태가 일그러지지 않는다
 *   - 면이 많아(수천 개) 한 대에 수십 ms 걸리지만 정적 객체라 장면을 만들 때 한 번만 그린다
 *
 * 좌표: X 차 길이(0 뒤 → 1 앞), Y 위, Z 폭(+가 보는 사람 쪽 옆면). 차 길이 = 1
 * drawCar 의 (x, y) = 차 가운데 바닥
 */


// 넘침 없는 부드러운 선 (단조 3차 보간): [[x, y], ...] → f(x)
function smoothLine(pts) {
  const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const d = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  const m = [d[0]];
  for (let i = 1; i < n - 1; i++) m.push(d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2);
  m.push(d[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], s = a * a + b * b;
    if (s > 9) { const t = 3 / Math.sqrt(s); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], t = (x - xs[i]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * ys[i] + (t3 - 2 * t2 + t) * h * m[i] + (-2 * t3 + 3 * t2) * ys[i + 1] + (t3 - t2) * h * m[i + 1];
  };
}

// 단면 반쪽: [폭 비율, 높이 비율] (가까운 옆면 아래 → 꼭대기 가운데)
const BODY_RING = [[0.9, 0], [0.962, 0.08], [0.99, 0.24], [1, 0.42], [0.996, 0.58], [0.985, 0.72], [0.962, 0.84], [0.925, 0.92], [0.87, 0.97], [0.78, 0.993], [0.55, 1], [0.25, 1], [0, 1]];
const CABIN_RING = [[1, 0], [0.986, 0.16], [0.958, 0.48], [0.92, 0.78], [0.89, 0.89], [0.84, 0.955], [0.76, 0.99], [0.55, 1], [0.25, 1], [0, 1]];
const fullRing = (half) => [...half, ...half.slice(0, -1).reverse().map(([z, y]) => [-z, y])];
// 단면 꼭짓점 사이를 곡선으로 촘촘히 (색 경계의 계단을 잘게)
const densify = (half, k) => {
  const out = [], n = half.length, at = (i) => half[Math.max(0, Math.min(n - 1, i))];
  for (let i = 0; i < n - 1; i++) for (let j = 0; j < k; j++) {
    const t = j / k, [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
    out.push([cr(p0[0], p1[0], p2[0], p3[0]), Math.min(1, cr(p0[1], p1[1], p2[1], p3[1]))]);
  }
  out.push(half[n - 1]);
  return out;
};
const BODY_FULL = fullRing(densify(BODY_RING, 3)), CABIN_FULL = fullRing(CABIN_RING);
// 옆면 높이 비율 → 폭 비율 (옆면 위 점의 z 를 구할 때)
const sideZf = (ring) => (yf) => {
  yf = clamp01(yf);
  for (let i = 0; i < ring.length - 1; i++) {
    const [z0, y0] = ring[i], [z1, y1] = ring[i + 1];
    if (yf <= y1 || i === ring.length - 2) return lerp(z0, z1, y1 > y0 ? clamp01((yf - y0) / (y1 - y0)) : 1);
  }
  return ring[ring.length - 1][0];
};
const bodySideZf = sideZf(BODY_RING), cabinSideZf = sideZf(CABIN_RING);

const CAR_MODELS = {
  // 60년대 2도어 하드톱: 긴 후드, 낮은 지붕, 감싸는 앞유리
  coupe: {
    width: 0.37, endW: 0.78, rRear: 0.07, rFront: 0.08, crown: 0.007,
    top: [[0, 0.168], [0.03, 0.19], [0.1, 0.199], [0.3, 0.204], [0.65, 0.206], [0.86, 0.201], [0.95, 0.193], [0.985, 0.184], [1, 0.171]],
    bottom: [[0, 0.082], [0.05, 0.064], [0.95, 0.064], [1, 0.084]],
    cabin: {
      x0: 0.3, x1: 0.672, base: 0.84, crown: 0.008,
      h: [[0.3, 0], [0.34, 0.038], [0.4, 0.097], [0.44, 0.11], [0.52, 0.114], [0.565, 0.109], [0.61, 0.07], [0.672, 0]],
      rearGlass: 0.43, windshield: 0.56, wrap: 3.6, posts: [[0.476, 0.004]],
    },
    wheels: [0.19, 0.785], wr: 0.064, arch: 0.073, archY: 0.066,
    spear: 0.5, seams: [0.43, 0.69], handles: [0.445], lamps: 'quad',
  },
  // 각진 4도어 세단: 곧게 선 캐빈, 평평한 지붕, B 기둥
  sedan: {
    width: 0.38, endW: 0.84, rRear: 0.05, rFront: 0.055, crown: 0.005,
    top: [[0, 0.178], [0.025, 0.205], [0.08, 0.214], [0.3, 0.218], [0.7, 0.219], [0.92, 0.214], [0.975, 0.205], [1, 0.182]],
    bottom: [[0, 0.08], [0.05, 0.062], [0.95, 0.062], [1, 0.08]],
    cabin: {
      x0: 0.262, x1: 0.7, base: 0.85, crown: 0.006,
      h: [[0.262, 0], [0.3, 0.052], [0.335, 0.104], [0.37, 0.116], [0.6, 0.12], [0.632, 0.106], [0.665, 0.062], [0.7, 0]],
      rearGlass: 0.345, windshield: 0.615, wrap: 4.2, posts: [[0.476, 0.016]],
    },
    wheels: [0.21, 0.775], wr: 0.062, arch: 0.071, archY: 0.064,
    spear: 0.56, seams: [0.3, 0.47, 0.68], handles: [0.315, 0.49], lamps: 'twin',
  },
};

function drawCar3q(ctx, car, x, y) {
  const P = car.palette, L = car.length, F = car.facing;
  const M = CAR_MODELS[car.body] ?? CAR_MODELS.coupe, C = M.cabin;
  const open = car.roof === 'open';
  const yaw = car.yaw ?? 0.6, pitch = car.pitch ?? 0.2;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);

  const proj = (X, Yv, Z) => {
    const x0 = X - 0.5;
    const xr = x0 * cy - Z * sy, zr = Z * cy + x0 * sy;
    return { x: xr, y: -(Yv * cp - zr * sp), d: Yv * sp + zr * cp };
  };
  const lv = lightVector();
  const light = palmNormalize3(lv.x * F, -lv.y, 0.75);
  const facing = (nx, ny, nz) => {
    const m = Math.hypot(nx, ny, nz) || 1;
    nx /= m; ny /= m; nz /= m;
    const xr = nx * cy - nz * sy, zr = nz * cy + nx * sy;
    const v = { x: xr, y: ny * cp - zr * sp, z: ny * sp + zr * cp };
    return { visible: v.z > 0.01, lit: clamp01(0.5 + 0.5 * (v.x * light.x + v.y * light.y + v.z * light.z)) };
  };
  const ramp = (base) => {                          // 빛 받는 정도별 6단계 색
    const dark = '#1c2a4a';
    return [mixColor(base, dark, 0.6), mixColor(base, dark, 0.4), mixColor(base, dark, 0.2), base, mixColor(base, '#ffffff', 0.2), mixColor(base, '#ffffff', 0.42)];
  };
  const bodyRamp = ramp(P.body), roofRamp = car.roof === 'white' ? ramp(P.roof) : bodyRamp;
  const chromeRamp = ['#3f4856', '#6f7b8a', '#a3aebb', '#cbd3dc', '#e6ebf0', '#fbfcfd'];
  const glassRamp = ['#18222f', '#1f2c3b', '#273748', '#304458', '#3d566e', '#55718c'];
  const interiorRamp = ramp(P.interior);
  const pick = (r, lit) => r[Math.min(r.length - 1, Math.floor(lit * r.length))];
  const hair = 1.1 / L;                              // 면 사이 실금을 막는 테두리 두께 (화면 약 1px)

  const path = (pts) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath(); };
  const fillPts = (pts, col) => { path(pts); ctx.fillStyle = col; ctx.fill(); };
  const fillFace = (pts, col) => { path(pts); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = hair; ctx.lineJoin = 'round'; ctx.stroke(); };
  const strokeLine = (pts, col, w) => { ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // 네 점 면 → 바깥(center 반대쪽)을 향한 법선
  const quadNormal = (q, center) => {
    let n = cross(sub(q[2], q[0]), sub(q[3], q[1]));
    const c = q.reduce((s, p) => [s[0] + p[0] / 4, s[1] + p[1] / 4, s[2] + p[2] / 4], [0, 0, 0]);
    if (dot(n, sub(c, center)) < 0) n = n.map((v) => -v);
    return n;
  };
  // 면 목록을 먼 것부터 칠하기
  const paint = (faces) => faces.sort((a, b) => a.d - b.d).forEach((f) => fillFace(f.pts, f.col));
  const chromeCol = (n) => {
    const ny = n[1] / (Math.hypot(...n) || 1);
    return ny > 0.55 ? '#f6f8fa' : ny > 0.2 ? '#d2dae3' : ny > -0.12 ? '#8e9aab' : ny > -0.5 ? '#5b6676' : '#353d4a';
  };
  const toFace = (q, n, r) => {
    const f = facing(...n);
    if (!f.visible) return null;
    const pts = q.map((p) => proj(...p));
    return { pts, d: pts.reduce((s, p) => s + p.d, 0) / pts.length, col: pick(r, f.lit) };
  };

  // ── 모양 함수
  const top = smoothLine(M.top), bot = smoothLine(M.bottom), cabH = smoothLine(C.h);
  const plan = (X) => {                               // 평면도에서 앞뒤 끝이 둥글게 오므라드는 정도
    const d = Math.min(X / M.rRear, (1 - X) / M.rFront);
    if (d >= 1) return 1;
    const u = Math.max(0, d);
    return M.endW + (1 - M.endW) * Math.sqrt(1 - (1 - u) * (1 - u));
  };
  const hw = (X) => (M.width / 2) * plan(X);
  const crownY = (zf, yf, k) => (yf >= 0.99 ? k * Math.max(0, 1 - zf * zf) : 0);
  const bodyPt = (X, zf, yf) => [X, lerp(bot(X), top(X), yf) + crownY(zf, yf, M.crown), zf * hw(X)];
  const bodySide = (X, Yv, out = 0.0015) => {          // 가까운 옆면 위의 점
    const yf = (Yv - bot(X)) / (top(X) - bot(X));
    return proj(X, Yv, bodySideZf(yf) * hw(X) + out);
  };
  const cabBase = (X) => top(X) + 0.002;
  const cabW = (X) => hw(X) * C.base;
  const cabPt = (X, zf, yf) => { const h = cabH(X); return [X, cabBase(X) + yf * h + crownY(zf, yf, C.crown * clamp01(h / 0.03)), zf * cabW(X)]; };
  const cabSide = (X, Yv, out = 0.0015) => {
    const h = Math.max(0.03, cabH(X));                   // 캐빈 끝(높이 0)에서 점이 가운데로 튀지 않게
    return proj(X, Yv, cabinSideZf((Yv - cabBase(X)) / h) * cabW(X) + out);
  };
  // 단면 띠 위의 연속 위치 s(꼭짓점 번호 사이를 보간) → 점
  const ringAt = (ring, s) => {
    const i = Math.max(0, Math.min(ring.length - 2, Math.floor(s))), t = s - i;
    return [lerp(ring[i][0], ring[i + 1][0], t), lerp(ring[i][1], ring[i + 1][1], t)];
  };
  // (X 구간 × 단면 구간) 영역의 테두리 → 화면 점들 (곡면 위에 붙인 스티커)
  const decal = (ptFn, ring, X0, X1, s0, s1, nx = 14, ns = 10) => {
    const out = [], at = (X, s) => { const [zf, yf] = ringAt(ring, s); return proj(...ptFn(X, zf, yf)); };
    for (let i = 0; i <= nx; i++) out.push(at(lerp(X0, X1, i / nx), s0));
    for (let j = 0; j <= ns; j++) out.push(at(X1, lerp(s0, s1, j / ns)));
    for (let i = nx; i >= 0; i--) out.push(at(lerp(X0, X1, i / nx), s1));
    for (let j = ns; j >= 0; j--) out.push(at(X0, lerp(s0, s1, j / ns)));
    return out;
  };
  const stations = (x0, x1, step, extra = []) => {
    const s = new Set(extra.filter((v) => v > x0 && v < x1).map((v) => +v.toFixed(5)));
    for (let X = x0; X < x1 - 1e-9; X += step) s.add(+X.toFixed(5));
    s.add(x1);
    return [...s].sort((a, b) => a - b);
  };

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(L * F, L);

  // ── 바닥 그림자: 바닥 네 귀퉁이 + 허리·지붕 높이에서 빛 반대쪽으로 밀린 점들의 볼록 껍질
  {
    const pts = [];
    const ring = (h, X0, X1, wk) => {
      const o = shadowOffset(h);
      for (const X of [X0, lerp(X0, X1, 0.1), lerp(X0, X1, 0.9), X1]) for (const s of [-1, 1]) {
        const p = proj(X, 0, s * hw(X) * wk);
        pts.push({ x: p.x + o.dx * F, y: p.y + o.dy });
      }
    };
    ring(0, 0, 1, 1);
    ring(top(0.5) * 0.9, 0.02, 0.98, 0.95);
    if (!open) ring(cabBase(0.5) + cabH((C.x0 + C.x1) / 2), lerp(C.x0, C.x1, 0.2), lerp(C.x0, C.x1, 0.85), C.base * 0.8);
    fillPts(convexHull(pts), P.shadow);
  }

  // ── 바퀴 (먼 쪽은 차체 전에, 가까운 쪽은 휠하우스 뒤에)
  const ellipsePts = (X, Yc, Z, r, n = 30) => {
    const out = [];
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push(proj(X + Math.cos(a) * r, Yc + Math.sin(a) * r, Z)); }
    return out;
  };
  const drawWheel = (wx, zo, near) => {
    const r = M.wr, zi = zo - 0.055 * Math.sign(zo);
    const o = ellipsePts(wx, r, zo, r), inn = ellipsePts(wx, r, zi, r);
    fillPts(inn, P.tire);
    for (let i = 0; i < o.length; i++) { const j = (i + 1) % o.length; fillFace([o[i], o[j], inn[j], inn[i]], P.tire); }
    fillPts(o, P.tire);
    if (!near) return;
    const s = Math.sign(zo), at = (dz) => zo + s * dz;
    fillPts(ellipsePts(wx, r, at(0.001), r * 0.8), P.whitewall);                  // 흰 띠 타이어
    fillPts(ellipsePts(wx, r, at(0.002), r * 0.62), P.tire);
    fillPts(ellipsePts(wx, r, at(0.003), r * 0.57), chromeRamp[2]);              // 휠캡
    fillPts(ellipsePts(wx, r, at(0.004), r * 0.5), chromeRamp[4]);
    if (car.wheels === 'wire') {                                                  // 와이어 휠: 가는 방사선
      ctx.strokeStyle = chromeRamp[1]; ctx.lineWidth = 0.0013; ctx.beginPath();
      for (let i = 0; i < 28; i++) {
        const a = (i / 28) * Math.PI * 2;
        const p0 = proj(wx + Math.cos(a) * r * 0.12, r + Math.sin(a) * r * 0.12, at(0.005));
        const p1 = proj(wx + Math.cos(a + 0.4) * r * 0.48, r + Math.sin(a + 0.4) * r * 0.48, at(0.005));
        ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
      }
      ctx.stroke();
    } else {
      fillPts(ellipsePts(wx, r, at(0.005), r * 0.36), chromeRamp[2]);           // 휠캡 가운데 둔덕
      fillPts(ellipsePts(wx, r, at(0.006), r * 0.3), chromeRamp[5]);
    }
    fillPts(ellipsePts(wx, r, at(0.007), r * 0.13), chromeRamp[1]);              // 가운데 캡
    // 빛 받는 쪽 반달 반사
    const lx = -Math.sign(light.x || 1) * 0.3;
    fillPts(ellipsePts(wx + lx * r, r * 1.22, at(0.008), r * 0.12, 16), withAlpha('#ffffff', 0.85));
  };
  for (const wx of M.wheels) drawWheel(wx, -hw(wx) * 0.9, false);

  // ── 범퍼: 차 끝 평면 윤곽을 따라 감싸 도는 크롬 띠
  const bumperFaces = (front) => {
    const xs = front ? stations(0.86, 1, 0.01) : stations(0, 0.14, 0.01);
    const yb = 0.1, side = xs.map((X) => [X, hw(X) * bodySideZf((yb - bot(X)) / (top(X) - bot(X)))]);
    const endX = front ? 1 : 0, endZ = side[front ? side.length - 1 : 0][1];
    const across = [];
    for (let k = 1; k < 8; k++) across.push([endX, lerp(endZ, -endZ, k / 8)]);
    let outline = front ? [...side, ...across, ...side.slice().reverse().map(([X, z]) => [X, -z])]
      : [...side.slice().reverse(), ...across, ...side.map(([X, z]) => [X, -z])];
    // 바깥쪽 방향 (평면도)
    const nrm = outline.map((p, i) => {
      const a = outline[Math.max(0, i - 1)], b = outline[Math.min(outline.length - 1, i + 1)];
      let nx = b[1] - a[1], nz = -(b[0] - a[0]);
      const m = Math.hypot(nx, nz) || 1; nx /= m; nz /= m;
      if (nx * (p[0] - 0.5) + nz * p[1] < 0) { nx = -nx; nz = -nz; }
      return [nx, nz];
    });
    const sec = [[-0.003, 0.066], [0.005, 0.072], [0.009, 0.082], [0.01, 0.094], [0.008, 0.103], [0.002, 0.109], [-0.006, 0.11]];
    const P3 = (i, j) => [outline[i][0] + nrm[i][0] * sec[j][0], sec[j][1], outline[i][1] + nrm[i][1] * sec[j][0]];
    const faces = [];
    for (let i = 0; i < outline.length - 1; i++) for (let j = 0; j < sec.length - 1; j++) {
      const q = [P3(i, j), P3(i + 1, j), P3(i + 1, j + 1), P3(i, j + 1)];
      const c = [outline[i][0] - nrm[i][0], 0.09, outline[i][1] - nrm[i][1]];
      const n = quadNormal(q, c);
      const f = toFace(q, n, chromeRamp);
      // side: 감싸 도는 부분이 가까운 쪽(1)인지 먼 쪽(-1)인지, 앞뒤 끝(0)인지
      if (f) { f.col = chromeCol(n); f.side = Math.abs(outline[i][1]) >= endZ * 0.97 && Math.abs(outline[i + 1][1]) >= endZ * 0.97 ? Math.sign(outline[i][1]) : 0; faces.push(f); }
    }
    return faces;
  };
  // 범퍼 중 차체에 가려질 부분(뒤 범퍼 대부분, 앞 범퍼의 먼 쪽 끝)은 차체보다 먼저
  const rearBumper = bumperFaces(false), frontBumper = bumperFaces(true);
  paint(rearBumper.filter((f) => f.side !== 1));
  paint(frontBumper.filter((f) => f.side === -1));

  // ── 차체: 단면을 길이 방향으로 이어 붙인 곡면
  {
    const ends = [];
    for (let k = 1; k <= 24; k++) { const u = (k / 24) ** 2; ends.push(u * M.rRear * 1.2, 1 - u * M.rFront * 1.2); }
    const xs = stations(0, 1, 1 / 150, ends);
    const faces = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const X0 = xs[i], X1 = xs[i + 1], Xm = (X0 + X1) / 2;
      const center = [Xm, (bot(Xm) + top(Xm)) / 2, 0];
      for (let j = 0; j < BODY_FULL.length - 1; j++) {
        const [za, ya] = BODY_FULL[j], [zb, yb] = BODY_FULL[j + 1];
        const q = [bodyPt(X0, za, ya), bodyPt(X1, za, ya), bodyPt(X1, zb, yb), bodyPt(X0, zb, yb)];
        const f = toFace(q, quadNormal(q, center), bodyRamp);
        if (f) faces.push(f);
      }
    }
    for (const [X, nx] of [[0, -1], [1, 1]]) {                 // 앞뒤 끝 면
      const f = facing(nx, 0, 0);
      if (!f.visible) continue;
      const pts = [...BODY_FULL.map(([zf, yf]) => proj(...bodyPt(X, zf, yf))), proj(...bodyPt(X, -BODY_FULL[0][0], 0)), proj(...bodyPt(X, BODY_FULL[0][0], 0))];
      faces.push({ pts, d: -1e9, col: pick(bodyRamp, f.lit) });
    }
    paint(faces);
  }
  // 뒤 범퍼 중 가까운 옆으로 감싸 도는 부분은 차체 위에
  paint(rearBumper.filter((f) => f.side === 1));

  // ── 앞면: 그릴, 헤드램프
  {
    const f = facing(1, 0, 0);
    if (f.visible) {
      const fx = 1.001, ew = hw(1);
      const at = (z, Yv) => proj(fx, Yv, z);
      const rect = (z0, z1, y0, y1, col) => fillPts([at(z0, y0), at(z1, y0), at(z1, y1), at(z0, y1)], col);
      const disc = (zc, yc, r, col, n = 20) => { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(at(zc + Math.cos(a) * r, yc + Math.sin(a) * r)); } fillPts(pts, col); };
      const gy0 = 0.112, gy1 = top(1) - 0.016, gz = ew * (M.lamps === 'quad' ? 0.56 : 0.6);
      rect(-gz - 0.004, gz + 0.004, gy0 - 0.004, gy1 + 0.004, chromeRamp[3]);    // 그릴 테
      rect(-gz, gz, gy0, gy1, '#1a1e26');
      ctx.strokeStyle = chromeRamp[2]; ctx.lineWidth = 0.0018; ctx.beginPath();
      for (let k = 1; k < 5; k++) { const yy = lerp(gy0, gy1, k / 5); const a = at(-gz, yy), b = at(gz, yy); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      for (let k = -6; k <= 6; k += 2) { const zz = (k / 7) * gz; const a = at(zz, gy0), b = at(zz, gy1); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
      ctx.stroke();
      rect(-0.008, 0.008, gy0 + 0.004, gy1 - 0.004, chromeRamp[4]);              // 가운데 엠블럼 띠
      const ly = (gy0 + gy1) / 2, lamps = M.lamps === 'quad' ? [[0.7, 0.0112], [0.885, 0.0112]] : [[0.8, 0.0165]];
      for (const sgn of [-1, 1]) for (const [k, r] of lamps) {
        disc(sgn * ew * k, ly, r + 0.003, chromeRamp[4]);
        disc(sgn * ew * k, ly, r, P.lamp);
        disc(sgn * ew * k - 0.003, ly + 0.003, r * 0.35, '#ffffff');
      }
    }
  }

  // ── 옆면 장식: 크롬 몰딩, 문틈, 손잡이, 테일램프, 옆 표시등
  {
    const line = (X0, X1, Yfn, col, w, n = 40) => {
      const pts = [];
      for (let i = 0; i <= n; i++) { const X = lerp(X0, X1, i / n); pts.push(bodySide(X, Yfn(X))); }
      strokeLine(pts, col, w);
    };
    const yAt = (yf) => (X) => lerp(bot(X), top(X), yf);
    const f = facing(0, 0, 1), idx = Math.min(5, Math.floor(f.lit * 6));
    line(0.03, 0.965, yAt(M.spear), chromeRamp[1], 0.0062);                 // 몰딩: 아래 그늘 + 위 반사
    line(0.03, 0.965, (X) => yAt(M.spear)(X) + 0.0018, chromeRamp[5], 0.0032);
    line(M.wheels[0] + M.arch + 0.01, M.wheels[1] - M.arch - 0.01, (X) => bot(X) + 0.013, chromeRamp[4], 0.004);   // 로커 크롬
    const seam = bodyRamp[Math.max(0, idx - 2)];
    for (const sx of M.seams) {
      const pts = [];
      for (let i = 0; i <= 10; i++) { const Yv = lerp(bot(sx) + 0.012, top(sx) - 0.003, i / 10); pts.push(bodySide(sx, Yv)); }
      strokeLine(pts, seam, 0.0024);
    }
    for (const hx of M.handles) line(hx, hx + 0.026, (X) => top(X) - 0.022, chromeRamp[4], 0.0055, 4);
    // 테일램프: 뒤 옆구리를 감싸는 빨간 등
    const tail = [];
    for (let i = 0; i <= 6; i++) { const X = lerp(0.002, 0.034, i / 6); tail.push(bodySide(X, top(X) - 0.012)); }
    for (let i = 6; i >= 0; i--) { const X = lerp(0.002, 0.034, i / 6); tail.push(bodySide(X, top(X) - 0.05)); }
    fillPts(tail, P.tail);
    const mark = [];
    for (let i = 0; i <= 4; i++) { const X = lerp(0.948, 0.972, i / 4); mark.push(bodySide(X, 0.142)); }
    for (let i = 4; i >= 0; i--) { const X = lerp(0.948, 0.972, i / 4); mark.push(bodySide(X, 0.128)); }
    fillPts(mark, P.marker);
  }

  // ── 휠하우스 어둠 + 가까운 바퀴
  for (const wx of M.wheels) {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI, X = wx + 0.004 + Math.cos(a) * M.arch;
      pts.push(bodySide(X, Math.max(bot(X), M.archY + Math.sin(a) * M.arch * 0.98), 0.003));
    }
    fillPts(pts, P.wheelWell);
  }
  for (const wx of M.wheels) drawWheel(wx, hw(wx) * 0.975, true);

  paint(frontBumper.filter((f) => f.side !== -1));

  // ── 캐빈 / 컨버터블 실내
  if (open) {
    const X0 = C.x0 + 0.015, X1 = C.x1 - 0.015, zk = 0.8;
    // 실내 구멍: 둥근 네모 (초타원)
    const tub = [], se = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.3);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2, X = lerp(X0, X1, 0.5 + 0.5 * se(Math.cos(a)));
      tub.push(proj(X, top(X) + 0.001, zk * se(Math.sin(a)) * hw(X)));
    }
    fillPts(tub, interiorRamp[1]);
    // 둥근 덩어리 (초타원체의 위쪽 반): 좌석 등받이, 접은 지붕
    const pod = (cx, y0, cz, ax, ay, az, r, e = 0.35) => {
      const fe = (t) => Math.sign(t) * Math.pow(Math.abs(t), e), nu = 20, nv = 6, faces = [];
      const pt = (u, v) => [cx + ax * fe(Math.cos(v)) * fe(Math.cos(u)), y0 + ay * fe(Math.sin(v)), cz + az * fe(Math.cos(v)) * fe(Math.sin(u))];
      for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
        const u0 = (i / nu) * Math.PI * 2, u1 = ((i + 1) / nu) * Math.PI * 2, v0 = (j / nv) * Math.PI / 2, v1 = ((j + 1) / nv) * Math.PI / 2;
        const q = [pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)];
        const f = toFace(q, quadNormal(q, [cx, y0, cz]), r);
        if (f) faces.push(f);
      }
      paint(faces);
    };
    const tb = top(C.x0 + 0.03);
    pod(C.x0 + 0.03, tb - 0.004, 0, 0.026, 0.026, hw(C.x0) * 0.78, roofRamp, 0.45);            // 접은 지붕 덮개
    const by = top(0.45) - 0.006;
    pod(0.39, by, 0, 0.012, 0.05, hw(0.4) * 0.7, interiorRamp);                                  // 뒷좌석 등받이
    for (const s of [-1, 1]) pod(0.512, by, s * hw(0.5) * 0.38, 0.012, 0.056, hw(0.5) * 0.3, interiorRamp);  // 앞좌석 (둘)
    // 운전대
    { const pts = []; for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; pts.push(proj(0.585 + Math.sin(a) * 0.006, by + 0.04 + Math.cos(a) * 0.022, hw(0.585) * 0.42 + Math.sin(a) * 0.022)); } path(pts); ctx.strokeStyle = '#1b1b20'; ctx.lineWidth = 0.003; ctx.stroke(); }
    // 앞유리: 크롬 테 + 옅은 유리
    const wb = top(C.x1 - 0.01);
    const ws = [proj(C.x1 - 0.008, wb, -hw(C.x1) * 0.8), proj(C.x1 - 0.05, wb + 0.082, -hw(C.x1) * 0.76), proj(C.x1 - 0.05, wb + 0.082, hw(C.x1) * 0.76), proj(C.x1 - 0.008, wb, hw(C.x1) * 0.8)];
    path(ws); ctx.fillStyle = withAlpha(P.glassGlint, 0.35); ctx.fill();
    ctx.strokeStyle = chromeRamp[4]; ctx.lineWidth = 0.005; ctx.stroke();
  } else {
    const xs = stations(C.x0, C.x1, 0.005, [C.rearGlass, C.windshield]);
    const faces = [];
    for (let i = 0; i < xs.length - 1; i++) {
      const X0 = xs[i], X1 = xs[i + 1], Xm = (X0 + X1) / 2;
      const center = [Xm, cabBase(Xm), 0];
      for (let j = 0; j < CABIN_FULL.length - 1; j++) {
        const [za, ya] = CABIN_FULL[j], [zb, yb] = CABIN_FULL[j + 1];
        const q = [cabPt(X0, za, ya), cabPt(X1, za, ya), cabPt(X1, zb, yb), cabPt(X0, zb, yb)];
        if (Math.abs(q[0][1] - q[3][1]) + Math.abs(q[1][1] - q[2][1]) + Math.abs(q[0][2] - q[3][2]) < 1e-6) continue;
        const f = toFace(q, quadNormal(q, center), roofRamp);
        if (f) faces.push(f);
      }
    }
    paint(faces);

    const nTop = CABIN_FULL.length - 1, wrap = C.wrap;
    // 앞유리 (옆으로 감싸 돈다) + 하늘 반사 사선
    {
      const X0 = C.windshield + 0.007, X1 = C.x1 - 0.004;
      const n = (() => { const a = cabPt(C.windshield, 0, 1), b = cabPt(C.x1, 0, 0); return [-(b[1] - a[1]), b[0] - a[0], 0]; })();
      const f = facing(...n);
      fillPts(decal(cabPt, CABIN_FULL, X0, X1, wrap, nTop - wrap, 16, 18), pick(glassRamp, f.lit));
      const g = (t, s) => { const [zf, yf] = ringAt(CABIN_FULL, s); return proj(...cabPt(lerp(X0, X1, t), zf, yf)); };
      fillPts([g(0.12, nTop * 0.36), g(0.32, nTop * 0.36), g(0.78, nTop * 0.6), g(0.58, nTop * 0.6)], withAlpha(P.glassGlint, 0.85));
      fillPts([g(0.4, nTop * 0.38), g(0.47, nTop * 0.38), g(0.9, nTop * 0.56), g(0.83, nTop * 0.56)], withAlpha(P.glassGlint, 0.6));
    }
    // 뒷유리 (위에서 보일 때만)
    {
      const a = cabPt(C.x0, 0, 0), b = cabPt(C.rearGlass, 0, 1);
      const f = facing(-(b[1] - a[1]), b[0] - a[0], 0);
      if (f.visible) fillPts(decal(cabPt, CABIN_FULL, C.x0 + 0.008, C.rearGlass - 0.008, wrap + 0.6, nTop - wrap - 0.6), pick(glassRamp, f.lit));
    }
    // 가까운 옆창: 지붕선을 따라가되 기둥 두께만큼 깎는다 → 기둥이 유리 끝과 나란히
    {
      const pillar = 0.026, sill = 0.01;
      const hE = (X) => Math.min(cabH(X - pillar), cabH(X), cabH(X + pillar)) * 0.9 - 0.006;
      const cuts = [C.x0, ...C.posts.flatMap(([px, pw]) => [px - pw / 2, px + pw / 2]), C.x1];
      for (let k = 0; k < cuts.length; k += 2) {
        const xa = cuts[k], xb = cuts[k + 1], topPts = [], botPts = [];
        for (let i = 0; i <= 60; i++) {
          const X = lerp(xa, xb, i / 60), h = hE(X);
          if (h <= sill + 0.004) continue;
          topPts.push(cabSide(X, cabBase(X) + h));
          botPts.push(cabSide(X, cabBase(X) + sill));
        }
        if (topPts.length < 2) continue;
        const win = [...topPts, ...botPts.reverse()];
        fillPts(win, P.glass);
        ctx.save(); path(win); ctx.clip();
        const gx = lerp(xa, xb, 0.3), b0 = cabBase(gx);
        fillPts([cabSide(gx, b0), cabSide(gx + 0.022, b0), cabSide(gx + 0.075, b0 + 0.12), cabSide(gx + 0.053, b0 + 0.12)], withAlpha(P.glassGlint, 0.8));
        ctx.restore();
        path(win); ctx.strokeStyle = chromeRamp[4]; ctx.lineWidth = 0.0028; ctx.stroke();
      }
      // 캐빈 아래 크롬 띠 (창틀)
      const sillPts = [];
      for (let i = 0; i <= 40; i++) { const X = lerp(C.x0 + 0.01, C.x1 - 0.01, i / 40); sillPts.push(cabSide(X, cabBase(X) + 0.003)); }
      strokeLine(sillPts, chromeRamp[4], 0.004);
    }
  }

  ctx.restore();
}

function palmNormalize3(x, y, z) {
  const m = Math.hypot(x, y, z) || 1;
  return { x: x / m, y: y / m, z: z / m };
}

/* skyline.js — 나가이 히로시 스타일 먼 빌딩숲 (정적, Canvas 2D)
 * 의존: nagai-util.js
 *
 * 사용법
 *   const city = createSkyline({ seed: 3, width: 420, maxHeight: 130 });
 *   drawSkyline(ctx, city, x, baseY);       // (x, baseY) = 빌딩숲 왼쪽 아래
 *
 * 구성
 *   - 네모 빌딩을 뒷줄(높고 흐릿함) / 앞줄(낮고 선명함) 두 줄로 겹친다
 *   - 빌딩마다 빛 반대쪽에 좁은 그늘 면 하나 → 입체감
 *   - 앞줄 빌딩이 뒷줄 빌딩 벽에 그림자를 드리운다 (빛 방향에 따라 좌우로 밀림)
 *
 *   빛: 기본은 장면 빛(SCENE_LIGHT)을 따른다. lightX / sunHeight 옵션을 주면 이 빌딩숲만 따로 지정
 *       depthGap  앞줄과 뒷줄 사이 거리(px) → 클수록 그림자가 멀리 밀림
 *   - 창문은 세 가지 중 하나: 긴 가로띠(bands) / 작은 네모(grid) / 세로 줄(slits)
 *   - 밑동은 짙은 녹색 원을 이어 붙인 가로수 줄
 */

const SKYLINE_PALETTE = {
  walls: ['#f2f3f1', '#e3e8ed', '#c9d4e0', '#dccab6', '#b99c92', '#a9b9cb'],
  window: '#5d7396',
  shade: '#3e5276',
  haze: '#a9c6e6',            // 뒷줄이 섞여 드는 하늘색
  trees: ['#1b3a27', '#28533a'],
};

function createSkyline(opts = {}) {
  const rnd = mulberry32(opts.seed ?? 3);
  const width = opts.width ?? 420, maxH = opts.maxHeight ?? 130;
  const unit = opts.unit ?? Math.max(1, maxH / 90);          // 창문 크기 기준
  const city = {
    width, maxH, unit,
    palette: { ...SKYLINE_PALETTE, ...(opts.palette || {}) },
    night: !!opts.night,                    // 해질녘: 벽은 어둡게, 창에는 둥근 불빛
    near: !!opts.near,                      // 연보라 저녁의 내려다보는 도시: 켜진 창만 + (가까운 줄은) 두꺼운 가로수 띠
    trees: opts.trees !== false,
    density: opts.density ?? 0.5,           // 가까운 도시: 빌딩이 서 있을 확률
    lightX: opts.lightX,                    // undefined 면 장면 빛
    sunHeight: opts.sunHeight,
    depthGap: opts.depthGap ?? maxH * 0.18,
    buildings: [], trees: [],
  };
  const styles = ['bands', 'grid', 'slits'];

  for (const row of [0, 1]) {                                 // 0 뒷줄, 1 앞줄
    for (let x = rnd() * 20 - 10; x < width - 15;) {
      const w = lerp(city.near ? 0.022 : 0.07, city.near ? 0.06 : 0.14, rnd()) * width;   // 가까운 도시는 가는 타워
      // 가까운 도시는 빌딩 사이를 더 띄워서, 틈으로 수평선의 바다와 불빛 벌판이 보이게
      if (rnd() < (city.near ? city.density * (row ? 1.15 : 0.9) : 0.82)) {
        const h = maxH * (row ? lerp(0.3, 0.7, rnd()) : lerp(0.55, 1, rnd()));
        city.buildings.push({
          row, x, w: Math.min(w, width - x), h,
          wall: city.palette.walls[Math.floor(rnd() * city.palette.walls.length)],
          style: styles[Math.floor(rnd() * styles.length)],
          sideRatio: lerp(0.14, 0.26, rnd()),
          cap: rnd() < 0.3 ? { w: lerp(0.3, 0.6, rnd()), h: lerp(3, 7, rnd()) * unit } : null,
          gapY: lerp(3.5, 6, rnd()) * unit,
        });
      }
      x += w * (row ? lerp(0.8, 1.2, rnd()) : lerp(0.65, 1.05, rnd()));
    }
  }

  // 가로수 줄
  for (let x = 0; x < width;) {
    const r = lerp(2.5, 6, rnd()) * unit;
    city.trees.push({ x, r, tone: rnd() < 0.5 ? 0 : 1, lift: rnd() * r * 0.6 });
    x += r * lerp(0.9, 1.6, rnd());
  }
  return city;
}

// 해질녘 빌딩숲 색: 벽은 보랏빛 그늘로 가라앉고, 불 켜진 창은 둥근 노란 점
const SKYLINE_NIGHT = { dusk: '#2d2a5c', haze: '#7a6fb4', window: '#1a1838', lights: ['#ffd98a', '#ffe9b8', '#ffc56e'], street: ['#ffe7a8', '#ff9fb3'], trees: ['#13261f', '#1c3529'] };

function drawBuilding(ctx, b, P, unit, lightX, night = false, near = false) {
  if (near) return drawBuildingNear(ctx, b, unit, lightX);
  if (night) return drawBuildingNight(ctx, b, P, unit, lightX);
  const top = -b.h;
  const sideW = b.w * b.sideRatio * Math.min(1, Math.abs(lightX) * 1.5 + 0.2), faceW = b.w - sideW;
  const shadeLeft = lightX > 0;                     // 빛이 오른쪽에서 오면 그늘 면은 왼쪽
  const fx = shadeLeft ? b.x + sideW : b.x;         // 정면 시작 x
  const sx = shadeLeft ? b.x : b.x + faceW;         // 그늘 면 시작 x
  const haze = b.row === 0 ? 0.32 : 0;
  const wall = haze ? mixColor(b.wall, P.haze, haze) : b.wall;
  const winCol = mixColor(b.wall, P.window, 0.55);
  const win = haze ? mixColor(rgbToHex(winCol), P.haze, haze) : winCol;
  const shade = mixColor(b.wall, P.shade, 0.32 + haze * 0.3);
  const shadeWin = mixColor(b.wall, P.shade, 0.6);

  // 옥상 구조물
  if (b.cap) {
    ctx.fillStyle = wall;
    const cw = faceW * b.cap.w;
    ctx.fillRect(fx + (faceW - cw) / 2, top - b.cap.h, cw, b.cap.h);
  }
  // 정면 + 그늘 면
  ctx.fillStyle = wall;
  ctx.fillRect(fx, top, faceW, b.h);
  ctx.fillStyle = shade;
  ctx.fillRect(sx, top, sideW, b.h);

  // 창문
  const m = Math.max(1.5 * unit, faceW * 0.1);
  const x0 = fx + m, x1 = fx + faceW - m;
  ctx.fillStyle = win;
  if (b.style === 'bands') {
    for (let y = top + b.gapY; y < -b.gapY * 0.8; y += b.gapY) ctx.fillRect(x0, y, x1 - x0, 1.3 * unit);
  } else if (b.style === 'grid') {
    const cw = 1.6 * unit, gx = 3.4 * unit;
    const cols = Math.max(1, Math.floor((x1 - x0 + gx - cw) / gx));
    const ox = x0 + ((x1 - x0) - ((cols - 1) * gx + cw)) / 2;
    for (let y = top + b.gapY; y < -b.gapY * 0.8; y += b.gapY)
      for (let c = 0; c < cols; c++) ctx.fillRect(ox + c * gx, y, cw, 1.8 * unit);
  } else {
    const gx = 3.2 * unit;
    for (let x = x0; x < x1 - unit; x += gx) ctx.fillRect(x, top + b.gapY * 0.8, 1.1 * unit, b.h - b.gapY * 1.6);
  }
  // 그늘 면의 창문은 더 어둡게, 단순한 가로띠로
  ctx.fillStyle = shadeWin;
  for (let y = top + b.gapY; y < -b.gapY * 0.8; y += b.gapY)
    ctx.fillRect(sx + sideW * 0.2, y, sideW * 0.6, 1.2 * unit);
}

// 내려다보는 도시의 빌딩 (참고: 나가이의 밤 도시): 빌딩은 거의 한 색의 짙은 실루엣, 표현은 노란 창 불빛만.
// 창은 격자가 아니라 빌딩마다 — 층을 따라 이어지는 불빛 띠 / 어긋나게 흩어진 창 / 거의 다 켜져 층 사이 틈만 보이는 빌딩.
// 불빛마다 옅은 번짐을 한 겹 깐다 (흐림 효과 없이 살짝 큰 사각형을 옅게)
const NEAR_NIGHT = { wall: '#252b5a', wallDeep: '#1b2049', haze: '#5c5394', lit: ['#ffd84a', '#ffe266', '#ffcc33', '#ffd84a', '#fff0a0'] };
function drawBuildingNear(ctx, b, unit, lightX) {
  const N = NEAR_NIGHT, rnd = mulberry32(Math.floor(b.x * 977 + b.h * 131 + b.row * 7));
  const top = -b.h, back = b.row === 0;
  const sideW = b.w * b.sideRatio * Math.min(1, Math.abs(lightX) * 1.5 + 0.2), faceW = b.w - sideW;
  const shadeLeft = lightX > 0;
  const fx = shadeLeft ? b.x + sideW : b.x, sx = shadeLeft ? b.x : b.x + faceW;
  const wall = mixColor(N.wall, N.wallDeep, rnd() * 0.5), wallC = back ? mixColor(rgbToHex(wall), N.haze, 0.22) : wall;
  const shade = back ? mixColor(N.wallDeep, N.haze, 0.18) : N.wallDeep;
  if (b.cap) { ctx.fillStyle = wallC; const cw = faceW * b.cap.w; ctx.fillRect(fx + (faceW - cw) / 2, top - b.cap.h, cw, b.cap.h); }
  ctx.fillStyle = wallC; ctx.fillRect(fx, top, faceW, b.h);
  ctx.fillStyle = shade; ctx.fillRect(sx, top, sideW, b.h);

  const m = faceW * 0.08, x0 = fx + m, x1 = fx + faceW - m;
  const cell = Math.max(1.6 * unit, faceW / 7), wh0 = Math.max(1, cell * 0.45);
  const lit = [];                                                    // [x, y, w, h]
  const pattern = rnd(), litness = pattern < 0.25 ? lerp(0.85, 0.97, rnd()) : lerp(0.5, 0.9, rnd());
  let y = top + wh0 * 1.6;
  {
    const bright = pattern < 0.25;                                     // 거의 다 켜진 빌딩: 층 사이 틈만 가늘게 보인다
    while (y < -wh0 * 1.3) {
      const wh = wh0 * (bright ? 1.5 : lerp(0.8, 1.25, rnd())), rowGap = bright ? wh * lerp(1.18, 1.35, rnd()) : wh * lerp(1.4, 2.1, rnd());
      if (rnd() > (bright ? 0.06 : 0.18)) {                            // 가끔 한 층 통째로 꺼짐
        if (pattern < 0.65) {
          // 불빛 띠: 길이가 제각각인 조각이 층을 따라 이어진다
          for (let x = x0 + rnd() * cell * 0.5; x < x1;) {
            const len = Math.min(x1 - x, cell * lerp(0.8, 4.5, rnd()));
            if (rnd() < litness) lit.push([x, y, len, wh]);
            x += len + cell * (bright ? lerp(0.08, 0.25, rnd()) : lerp(0.1, 0.9, rnd()));
          }
        } else {
          // 흩어진 창: 크기·위치가 조금씩 어긋난다
          for (let x = x0 + rnd() * cell * 0.4; x < x1 - cell * 0.3; x += cell * lerp(0.9, 1.6, rnd())) {
            if (rnd() < litness) { const w = cell * lerp(0.4, 0.95, rnd()); lit.push([x, y + (rnd() - 0.5) * wh * 0.3, Math.min(w, x1 - x), wh * lerp(0.75, 1.1, rnd())]); }
          }
        }
      }
      y += rowGap;
    }
  }
  const color = N.lit[Math.floor(rnd() * N.lit.length)], dim = back ? 0.8 : 1, g = Math.max(0.8, wh0 * 0.45);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.22 * dim;                                        // 번짐
  for (const r of lit) ctx.fillRect(r[0] - g, r[1] - g, r[2] + g * 2, r[3] + g * 2);
  ctx.globalAlpha = dim;                                               // 불빛
  for (const r of lit) ctx.fillRect(r[0], r[1], r[2], r[3]);
  ctx.globalAlpha = 1;
  // 그늘 면: 가끔 가는 불빛 한 줄
  if (rnd() < 0.4) { ctx.fillStyle = color; ctx.globalAlpha = 0.55 * dim; ctx.fillRect(sx + sideW * 0.3, top + b.h * lerp(0.1, 0.4, rnd()), sideW * 0.4, b.h * lerp(0.2, 0.5, rnd())); ctx.globalAlpha = 1; }
}

// 창 자리마다 시드로 정한 몇 곳에만 불을 켠다 (모양 랜덤은 빌딩 위치에서 뽑아 매번 같다)
function drawBuildingNight(ctx, b, P, unit, lightX) {
  const N = SKYLINE_NIGHT;
  const rnd = mulberry32(Math.floor(b.x * 977 + b.h * 131 + b.row * 7));
  const top = -b.h;
  const sideW = b.w * b.sideRatio * Math.min(1, Math.abs(lightX) * 1.5 + 0.2), faceW = b.w - sideW;
  const shadeLeft = lightX > 0;
  const fx = shadeLeft ? b.x + sideW : b.x, sx = shadeLeft ? b.x : b.x + faceW;
  const back = b.row === 0;
  const wall = mixColor(b.wall, back ? N.haze : N.dusk, back ? 0.66 : 0.68);
  const shade = mixColor(b.wall, N.dusk, back ? 0.82 : 0.85);
  if (b.cap) {
    ctx.fillStyle = wall;
    const cw = faceW * b.cap.w;
    ctx.fillRect(fx + (faceW - cw) / 2, top - b.cap.h, cw, b.cap.h);
  }
  ctx.fillStyle = wall; ctx.fillRect(fx, top, faceW, b.h);
  ctx.fillStyle = shade; ctx.fillRect(sx, top, sideW, b.h);

  // 창 자리 (낮과 같은 격자), 꺼진 창은 짙게, 켜진 창은 원
  const m = Math.max(1.5 * unit, faceW * 0.1);
  const x0 = fx + m, x1 = fx + faceW - m;
  const spots = [];
  const stepX = b.style === 'slits' ? 3.2 * unit : b.style === 'grid' ? 3.4 * unit : 2.6 * unit;
  for (let y = top + b.gapY; y < -b.gapY * 0.8; y += b.gapY)
    for (let x = x0 + stepX * 0.5; x < x1; x += stepX) spots.push([x, y + unit * 0.8]);
  const r = Math.max(0.9, unit * (back ? 0.7 : 0.9));
  ctx.fillStyle = mixColor(b.wall, N.window, 0.7);
  for (const [x, y] of spots) { ctx.beginPath(); ctx.arc(x, y, r * 0.8, 0, Math.PI * 2); ctx.fill(); }
  const litP = back ? 0.4 : 0.55;
  for (const [x, y] of spots) {
    if (rnd() > litP) continue;
    ctx.fillStyle = N.lights[Math.floor(rnd() * N.lights.length)];
    if (back) ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // 그늘 면에도 드문드문
  ctx.fillStyle = N.lights[0];
  for (let y = top + b.gapY; y < -b.gapY * 0.8; y += b.gapY)
    if (rnd() < 0.3) { ctx.beginPath(); ctx.arc(sx + sideW / 2, y + unit * 0.8, r * 0.8, 0, Math.PI * 2); ctx.fill(); }
}

// 앞줄 빌딩의 그림자를 뒷줄 빌딩 벽에만 드리운다
//   - 빛 반대쪽으로 depthGap × |lightX| 만큼 수평 이동
//   - 해가 낮을수록 그림자 윗선이 높게 (앞 빌딩 꼭대기에 가깝게) 올라온다
function drawCastShadows(ctx, city, back, front, lightX, sunHeight) {
  if (!back.length || !front.length) return;
  const dx = -lightX * city.depthGap * 1.3;
  const drop = city.depthGap * lerp(0.15, 1.1, sunHeight);
  ctx.save();
  ctx.beginPath();                                   // 뒷줄 빌딩 모양으로 잘라내기
  for (const b of back) {
    ctx.rect(b.x, -b.h, b.w, b.h);
    if (b.cap) ctx.rect(b.x, -b.h - b.cap.h, b.w, b.cap.h);
  }
  ctx.clip();
  ctx.fillStyle = withAlpha(city.palette.shade, 0.5);
  ctx.beginPath();
  for (const f of front) {
    const top = -f.h + drop;
    if (top >= 0) continue;
    ctx.rect(f.x + dx, top, f.w, -top);
  }
  ctx.fill();
  ctx.restore();
}

function rgbToHex(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).map(Number);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

function drawSkyline(ctx, city, x, y) {
  const P = city.palette;
  ctx.save();
  ctx.translate(x, y);
  const lightX = city.lightX ?? SCENE_LIGHT.x;
  const sunHeight = city.sunHeight ?? SCENE_LIGHT.sunHeight;
  const back = city.buildings.filter((b) => b.row === 0);
  const front = city.buildings.filter((b) => b.row === 1);
  const night = city.night, near = city.near;
  for (const b of back) drawBuilding(ctx, b, P, city.unit, lightX, night, near);
  if (!night) drawCastShadows(ctx, city, back, front, lightX, sunHeight);
  for (const b of front) drawBuilding(ctx, b, P, city.unit, lightX, night, near);
  if (near) {                                         // 밑동을 가리는 두꺼운 가로수 띠 (어두운 원 덩어리)
    if (!city.trees) { ctx.restore(); return; }
    const rnd = mulberry32(Math.floor(city.width * 13 + city.maxH * 7));
    for (const [col, lift] of [['#0c1a18', 0], ['#13261f', 0.35]]) {
      ctx.fillStyle = col; ctx.beginPath();
      for (let x = -10; x < city.width + 10;) {
        const r = lerp(5, 11, rnd()) * city.unit, cy = -r * lerp(0.2, 0.6, rnd()) - lift * r;
        ctx.moveTo(x + r, cy); ctx.arc(x, cy, r, 0, Math.PI * 2);
        x += r * lerp(0.8, 1.4, rnd());
      }
      ctx.fill();
    }
    ctx.fillStyle = '#0c1a18'; ctx.fillRect(-10, -3 * city.unit, city.width + 20, 3 * city.unit + 4);
    ctx.restore();
    return;
  }
  const trees = night ? SKYLINE_NIGHT.trees : P.trees;
  trees.forEach((col, k) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    for (const t of city.trees) {
      if (t.tone !== k) continue;
      const cy = -t.r * 0.7 - t.lift;
      ctx.moveTo(t.x + t.r, cy);
      ctx.arc(t.x, cy, t.r, 0, Math.PI * 2);
    }
    ctx.fill();
  });
  ctx.fillStyle = trees[0];
  ctx.fillRect(0, -2 * city.unit, city.width, 2 * city.unit + 1);
  if (night) {                                       // 물가를 따라 늘어선 가로등 불빛
    const rnd = mulberry32(Math.floor(city.width * 31 + city.maxH * 17));
    for (let x = rnd() * 3 * city.unit; x < city.width; x += lerp(2.2, 4.5, rnd()) * city.unit) {
      ctx.fillStyle = SKYLINE_NIGHT.street[rnd() < 0.8 ? 0 : 1];
      ctx.beginPath(); ctx.arc(x, -city.unit * lerp(0.6, 1.2, rnd()), Math.max(1, city.unit * 0.75), 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

/* house.js — 나가이 히로시 스타일 가까운 건물 (정적, Canvas 2D)
 * 의존: nagai-util.js (장면 원근 SCENE_VIEW, 장면 빛 SCENE_LIGHT)
 *
 * 사용법
 *   const house = createHouse({ seed: 2, x: 300, groundY: 560, width: 170, height: 130, depth: 110 });
 *   drawHouse(ctx, house);
 *
 *   style: 'house' (창 두 개 + 문) | 'shop' (넓은 쇼윈도 + 문)
 *   awning: true 면 차양 + 차양 그림자
 *
 * 형태
 *   - 파스텔 상자 하나. 정면은 똑바른 직사각형, 옆면은 소실점 쪽으로 줄어든다
 *   - 창·문은 거의 검정 + 얇은 흰 틀
 *   - 그림자: 땅 그림자, 차양 아래 벽 그림자
 */

const HOUSE_COLORS = ['#a9dcc0', '#f4b6c8', '#f6c79a', '#c9b8e8', '#f4e3a1', '#e98b78', '#a8d4ec', '#f2efe6'];
// 저녁(연보라) 건물: 벽은 보랏빛 그늘로, 켜진 창은 노란 빛, 간판 가게는 늘 불이 켜져 있다
const HOUSE_NIGHT = {
  dusk: '#2d2a5c', lit: '#ffd98a', litCore: '#fff1c4', floor: '#e3a85e', dark: '#0e0f1a', frame: '#a99cb8', spill: 'rgba(255,214,130,',
  sign: '#fdf0dc', signInk: ['#d23a55', '#2f5fb8', '#1f7a6a'],
  // 창 안 실내: 따뜻한 갈색 실루엣 두 단계 + 화분 초록 + 등 (원)
  wood: '#a8683a', woodDark: '#6e3f26', leaf: '#3f5f2c', lamp: '#fffbe8',
};
// 불 켜진 창 안에 보이는 것: 가게는 카운터·선반, 집은 책상·화분·소파
const INTERIORS = { shop: ['counter', 'shelf', 'counter', 'tables'], house: ['desk', 'plant', 'sofa', 'shelf'] };
const NIGHT_SIGNS = ['RECORDS', 'NIGHT CRUISE', 'DINER', 'SURF SHOP', 'CAFE', 'MOTEL', 'ICE CREAM', 'VIDEO', 'BAR', 'BOOKS'];
const HOUSE_PALETTE = {
  glass: '#14161f',
  glassGlint: '#2c3550',
  frame: '#f6f3ec',
  door: '#2a1f22',
  awning: ['#f5f3ee', '#3d5fb0', '#e9a0a8'],
};

function createHouse(opts = {}) {
  const rnd = mulberry32(opts.seed ?? 2);
  const width = opts.width ?? 170, height = opts.height ?? 130;
  const style = opts.style ?? (rnd() < 0.5 ? 'house' : 'shop');
  const house = {
    x: opts.x ?? 300, groundY: opts.groundY ?? 560,
    width, height, depth: opts.depth ?? width * 0.6,
    color: opts.color ?? HOUSE_COLORS[Math.floor(rnd() * HOUSE_COLORS.length)],
    style,
    palette: { ...HOUSE_PALETTE, ...(opts.palette || {}) },
    awning: opts.awning ?? (style === 'shop' ? rnd() < 0.7 : rnd() < 0.3),
    awningColor: null,
    openings: [],        // 정면의 창·문 (정면 기준 비율 좌표)
    sideWindows: opts.sideWindows ?? Math.floor(rnd() * 3),
  };
  house.awningColor = house.palette.awning[Math.floor(rnd() * house.palette.awning.length)];

  // 정면 배치: 바닥에서 위로 비율(0~1)
  const doorW = lerp(0.12, 0.16, rnd()), doorH = lerp(0.52, 0.6, rnd());
  if (style === 'shop') {
    const doorX = lerp(0.42, 0.5, rnd());
    house.openings.push({ kind: 'door', x: doorX, w: doorW, y: 0, h: doorH });
    house.openings.push({ kind: 'window', x: 0.08, w: doorX - 0.11, y: 0.12, h: doorH - 0.12, cols: 2 });
    house.openings.push({ kind: 'window', x: doorX + doorW + 0.03, w: 0.92 - (doorX + doorW + 0.03), y: 0.12, h: doorH - 0.12, cols: 2 });
  } else {
    const doorLeft = rnd() < 0.5;
    const doorX = doorLeft ? lerp(0.08, 0.14, rnd()) : lerp(0.74, 0.8, rnd());
    house.openings.push({ kind: 'door', x: doorX, w: doorW, y: 0, h: doorH });
    const wx0 = doorLeft ? doorX + doorW + 0.08 : 0.1;
    const wx1 = doorLeft ? 0.9 : doorX - 0.08;
    const n = rnd() < 0.5 ? 1 : 2, gap = 0.06, ww = (wx1 - wx0 - gap * (n - 1)) / n;
    for (let i = 0; i < n; i++) house.openings.push({ kind: 'window', x: wx0 + i * (ww + gap), w: ww, y: 0.22, h: doorH - 0.22, cols: ww > 0.25 ? 3 : 2 });
  }
  // 저녁: 아래 난수는 맨 끝에 추가로 뽑는다 → 낮 장면의 모양은 그대로
  house.night = !!opts.night;
  house.nightShop = !!opts.nightShop;
  if (house.night) {
    house.dayColor = house.color;
    house.color = rgbToHex(mixColor(house.color, HOUSE_NIGHT.dusk, 0.55));
    house.lit = house.openings.map(() => house.nightShop || rnd() < 0.7);
    house.sideLit = rnd() < 0.6;
    const pool = INTERIORS[house.style === 'shop' ? 'shop' : 'house'];
    house.interior = house.openings.map(() => ({ kind: pool[Math.floor(rnd() * pool.length)], flip: rnd() < 0.5, k: rnd() }));
    if (house.nightShop) {
      house.awning = false;
      house.sign = opts.sign ?? NIGHT_SIGNS[Math.floor(rnd() * NIGHT_SIGNS.length)];
      house.signInk = HOUSE_NIGHT.signInk[Math.floor(rnd() * HOUSE_NIGHT.signInk.length)];
    }
  }
  house.awningSpan = style === 'shop' ? [0.05, 0.95] : [house.openings[1].x - 0.03, house.openings[house.openings.length - 1].x + house.openings[house.openings.length - 1].w + 0.03];
  house.awningY = house.openings.reduce((m, o) => Math.max(m, o.y + o.h), 0) + 0.06;
  return house;
}

function drawHouse(ctx, house) {
  const { x, groundY: gy, width: w, height: h, depth: d, palette: P } = house;
  drawBoxShadow(ctx, x, gy, w, h, d);
  const faces = drawBox(ctx, x, gy, w, h, d, house.color);

  // 정면 좌표 변환: 비율(u: 왼→오, v: 바닥→위) → 화면
  const F = (u, v, z = 0) => persp(x + u * w, gy - v * h, z);
  const rectF = (u0, v0, u1, v1, color, z = 0) => fillPoly(ctx, [F(u0, v1, z), F(u1, v1, z), F(u1, v0, z), F(u0, v0, z)], color);

  if (house.night) return drawHouseNight(ctx, house, faces, F, rectF);
  // 꼭대기 테두리(파라펫) 띠
  rectF(0, 0.94, 1, 1, mixColor(house.color, '#ffffff', 0.3));
  rectF(0, 0.925, 1, 0.94, mixColor(house.color, '#3a4a78', 0.15));

  // 창과 문
  const t = 0.012;                                  // 틀 두께(정면 비율)
  for (const o of house.openings) {
    rectF(o.x - t, o.y - (o.y > 0 ? t * 1.3 : 0), o.x + o.w + t, o.y + o.h + t * 1.3, P.frame);
    rectF(o.x, o.y, o.x + o.w, o.y + o.h, o.kind === 'door' ? P.door : P.glass);
    if (o.kind === 'window') {
      for (let c = 1; c < o.cols; c++) { const u = o.x + (o.w * c) / o.cols; rectF(u - t * 0.4, o.y, u + t * 0.4, o.y + o.h, P.frame); }
      rectF(o.x, o.y + o.h * 0.62, o.x + o.w, o.y + o.h * 0.62 + t, P.frame);
      // 유리에 비친 희미한 사선
      const gx = o.x + o.w * 0.15;
      fillPoly(ctx, [F(gx, o.y + o.h * 0.1), F(gx + o.w * 0.08, o.y + o.h * 0.1), F(gx + o.w * 0.2, o.y + o.h * 0.55), F(gx + o.w * 0.12, o.y + o.h * 0.55)], P.glassGlint);
    } else {
      rectF(o.x + o.w * 0.15, o.y + o.h * 0.55, o.x + o.w * 0.85, o.y + o.h * 0.9, P.glass);
      rectF(o.x + o.w * 0.72, o.y + o.h * 0.42, o.x + o.w * 0.82, o.y + o.h * 0.45, P.frame);
    }
  }

  // 옆면 창 (보이는 옆면에만)
  if (house.sideWindows && (faces.showLeft || faces.showRight)) {
    const sx = faces.showRight ? x + w : x;
    for (let i = 0; i < house.sideWindows; i++) {
      const z0 = d * (0.18 + i * 0.4), z1 = z0 + d * 0.24;
      fillPoly(ctx, [persp(sx, gy - h * 0.62, z0), persp(sx, gy - h * 0.62, z1), persp(sx, gy - h * 0.25, z1), persp(sx, gy - h * 0.25, z0)], P.glass);
    }
  }

  // 차양: 벽에서 앞으로 튀어나온 경사 판 + 앞 띠, 그리고 벽에 드리운 그림자
  if (house.awning) {
    const [u0, u1] = house.awningSpan, v = house.awningY, drop = 0.12, out = h * 0.28;
    const shadowDepth = drop + clamp01(0.25 + 0.6 * SCENE_LIGHT.sunHeight) * 0.25;
    ctx.save();
    fillPoly(ctx, faces.front); ctx.clip();
    rectF(u0, v - shadowDepth, u1, v, withAlpha('#1c2340', 0.32));      // 차양 그림자
    ctx.restore();
    const ac = house.awningColor;
    fillPoly(ctx, [F(u0, v), F(u1, v), F(u1, v - drop, -out), F(u0, v - drop, -out)], mixColor(ac, '#ffffff', 0.15));
    fillPoly(ctx, [F(u0, v - drop, -out), F(u1, v - drop, -out), F(u1, v - drop - 0.05, -out), F(u0, v - drop - 0.05, -out)], mixColor(ac, '#3a4a78', 0.18));
  }
}

// 창 안 실내 (정면 비율 좌표, 창 안에서 u: 0~1 왼→오, v: 0~1 바닥→천장)
//   천장 쪽은 더 밝고, 바닥은 따뜻한 띠. 가구는 납작한 갈색 실루엣, 등은 작은 원
function drawInterior(ctx, house, o, it, F, rectF) {
  const N = HOUSE_NIGHT;
  const U = (u) => o.x + o.w * (it.flip ? 1 - u : u), V = (v) => o.y + o.h * v;
  const box = (u0, v0, u1, v1, c) => rectF(Math.min(U(u0), U(u1)), V(v0), Math.max(U(u0), U(u1)), V(v1), c);
  const dot = (u, v, r, c) => { const p = F(U(u), V(v)); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x, p.y, r * o.w * house.width, 0, Math.PI * 2); ctx.fill(); };
  box(0, 0.72, 1, 1, N.litCore);                       // 천장 조명이 비친 위쪽
  box(0, 0, 1, 0.12, N.floor);                         // 바닥
  if (it.kind === 'counter') {
    box(0.08, 0.12, 0.78, 0.4, N.wood); box(0.06, 0.38, 0.8, 0.44, N.woodDark);            // 카운터 + 상판
    for (const u of [0.22, 0.52]) { box(u - 0.003, 0.78, u + 0.003, 1, N.woodDark); dot(u, 0.76, 0.05, N.lamp); }   // 펜던트 등
    box(0.84, 0.12, 0.96, 0.62, N.woodDark);                                                 // 안쪽 문/냉장고
  } else if (it.kind === 'shelf') {
    for (const v of [0.3, 0.5, 0.7]) box(0.1, v, 0.9, v + 0.025, N.woodDark);               // 선반 세 칸
    for (let j = 0; j < 7; j++) { const u = 0.14 + j * 0.11; box(u, 0.5 + 0.025, u + 0.06, 0.5 + 0.1 + (j % 3) * 0.03, N.wood); box(u + 0.02, 0.3 + 0.025, u + 0.08, 0.3 + 0.09, N.wood); }
    box(0.1, 0.12, 0.13, 0.7, N.woodDark); box(0.87, 0.12, 0.9, 0.7, N.woodDark);
  } else if (it.kind === 'tables') {
    for (const u of [0.25, 0.65]) { box(u - 0.12, 0.3, u + 0.12, 0.35, N.woodDark); box(u - 0.015, 0.12, u + 0.015, 0.3, N.woodDark); dot(u, 0.86, 0.045, N.lamp); }
    box(0.04, 0.12, 0.1, 0.32, N.wood); box(0.9, 0.12, 0.96, 0.32, N.wood);                 // 의자
  } else if (it.kind === 'desk') {
    box(0.12, 0.3, 0.62, 0.35, N.woodDark); box(0.14, 0.12, 0.18, 0.3, N.woodDark); box(0.56, 0.12, 0.6, 0.3, N.woodDark);   // 책상
    box(0.5, 0.35, 0.52, 0.5, N.woodDark); dot(0.48, 0.5, 0.05, N.lamp);                     // 스탠드
    box(0.66, 0.12, 0.72, 0.42, N.wood); box(0.66, 0.12, 0.8, 0.22, N.wood);                 // 의자
    box(0.2, 0.55, 0.42, 0.72, N.wood);                                                      // 액자
  } else if (it.kind === 'plant') {
    box(0.18, 0.12, 0.3, 0.26, N.woodDark);                                                  // 화분
    for (const [u, v, r] of [[0.24, 0.34, 0.09], [0.17, 0.44, 0.08], [0.3, 0.46, 0.08], [0.24, 0.56, 0.08]]) dot(u, v, r, N.leaf);
    box(0.5, 0.3, 0.86, 0.34, N.woodDark); box(0.54, 0.12, 0.57, 0.3, N.woodDark); box(0.8, 0.12, 0.83, 0.3, N.woodDark);   // 탁자
    dot(0.68, 0.84, 0.05, N.lamp);
  } else {                                                                                    // sofa
    box(0.1, 0.12, 0.72, 0.28, N.wood); box(0.1, 0.28, 0.72, 0.42, N.woodDark);              // 소파
    box(0.1, 0.12, 0.16, 0.36, N.woodDark); box(0.66, 0.12, 0.72, 0.36, N.woodDark);
    box(0.82, 0.12, 0.84, 0.6, N.woodDark); dot(0.83, 0.62, 0.07, N.lamp);                   // 플로어 스탠드
  }
}

function drawHouseNight(ctx, house, faces, F, rectF) {
  const { x, groundY: gy, width: w, height: h, depth: d } = house, N = HOUSE_NIGHT;
  rectF(0, 0.94, 1, 1, mixColor(house.color, '#ffffff', 0.18));
  rectF(0, 0.925, 1, 0.94, mixColor(house.color, '#000000', 0.25));
  const t = 0.012, frame = N.frame;

  // 켜진 창에서 앞 바닥으로 번지는 빛 (창 아래 → 보는 쪽으로 넓어지는 사다리꼴)
  const spill = (o) => {
    const reach = h * (house.nightShop ? 0.9 : 0.5), spread = o.w * w * 0.35;
    const a = persp(x + o.x * w, gy, 0), b = persp(x + (o.x + o.w) * w, gy, 0);
    const c = persp(x + (o.x + o.w) * w + spread, gy, -reach), e = persp(x + o.x * w - spread, gy, -reach);
    const g = ctx.createLinearGradient(0, a.y, 0, c.y);
    const k = house.nightShop ? 0.55 : 0.3;
    g.addColorStop(0, N.spill + k + ')'); g.addColorStop(1, N.spill + '0)');
    fillPoly(ctx, [a, b, c, e], g);
  };
  house.openings.forEach((o, i) => { if (house.lit[i] && (o.y < 0.2)) spill(o); });

  house.openings.forEach((o, i) => {
    const lit = house.lit[i];
    rectF(o.x - t, o.y - (o.y > 0 ? t * 1.3 : 0), o.x + o.w + t, o.y + o.h + t * 1.3, frame);
    if (o.kind === 'door') {
      rectF(o.x, o.y, o.x + o.w, o.y + o.h, lit ? mixColor(N.lit, '#000000', 0.25) : N.dark);
      rectF(o.x + o.w * 0.15, o.y + o.h * 0.15, o.x + o.w * 0.85, o.y + o.h * 0.9, lit ? N.lit : '#191a28');
      return;
    }
    rectF(o.x, o.y, o.x + o.w, o.y + o.h, lit ? N.lit : N.dark);
    if (lit) drawInterior(ctx, house, o, house.interior[i], F, rectF);
    for (let c = 1; c < o.cols; c++) { const u = o.x + (o.w * c) / o.cols; rectF(u - t * 0.4, o.y, u + t * 0.4, o.y + o.h, frame); }
    rectF(o.x, o.y + o.h * 0.62, o.x + o.w, o.y + o.h * 0.62 + t, frame);
  });

  if (house.sideWindows && (faces.showLeft || faces.showRight)) {
    const sx = faces.showRight ? x + w : x;
    for (let i = 0; i < house.sideWindows; i++) {
      const z0 = d * (0.18 + i * 0.4), z1 = z0 + d * 0.24;
      fillPoly(ctx, [persp(sx, gy - h * 0.62, z0), persp(sx, gy - h * 0.62, z1), persp(sx, gy - h * 0.25, z1), persp(sx, gy - h * 0.25, z0)], house.sideLit && i === 0 ? mixColor(N.lit, '#000000', 0.2) : N.dark);
    }
  }

  // 간판: 정면 위쪽 판 + 글자. 늘 켜져 있어서 주변이 은은하게 밝다
  if (house.nightShop) {
    const v0 = 0.68, v1 = 0.88, u0 = 0.1, u1 = 0.9;
    const tl = F(u0, v1), br = F(u1, v0), pw = br.x - tl.x, ph = br.y - tl.y;
    const halo = ctx.createRadialGradient(tl.x + pw / 2, tl.y + ph / 2, ph * 0.3, tl.x + pw / 2, tl.y + ph / 2, pw * 0.65);
    halo.addColorStop(0, 'rgba(255,240,205,0.35)'); halo.addColorStop(1, 'rgba(255,240,205,0)');
    ctx.fillStyle = halo; ctx.fillRect(tl.x - pw * 0.2, tl.y - ph, pw * 1.4, ph * 3);
    rectF(u0 - 0.012, v0 - 0.02, u1 + 0.012, v1 + 0.02, frame);
    rectF(u0, v0, u1, v1, N.sign);
    const size = ph * 0.58;
    ctx.save();
    ctx.font = `800 ${size}px "Futura", "Avenir Next Condensed", "Arial Narrow", "Helvetica Neue", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const tw = ctx.measureText(house.sign).width, maxW = pw * 0.86;
    ctx.translate(tl.x + pw / 2, tl.y + ph * 0.54);
    if (tw > maxW) ctx.scale(maxW / tw, 1);
    ctx.fillStyle = house.signInk;
    ctx.fillText(house.sign, 0, 0);
    ctx.restore();
  }
}

/* wall.js — 낮은 담장 (정적, Canvas 2D)
 * 의존: nagai-util.js (장면 원근, 장면 빛)
 *
 * 사용법
 *   const wall = createWall({ x: 700, groundY: 640, length: 400, height: 26, dir: 'x' });
 *   drawWall(ctx, wall);
 *
 *   dir: 'x' 화면과 나란히 옆으로 뻗음 | 'z' 안쪽(소실점 쪽)으로 뻗음
 *   (x, groundY) = 담장 앞쪽 왼쪽 아래 모서리
 *
 * 구성: 파스텔 상자 + 밝은 갓돌(윗면 테두리) + 땅 그림자
 */

const WALL_COLORS = ['#f0b3a8', '#f4c6c0', '#f2e6da', '#e9a39b', '#f6d7b8'];

function createWall(opts = {}) {
  const rnd = mulberry32(opts.seed ?? 4);
  const dir = opts.dir ?? 'x';
  const length = opts.length ?? 300, thick = opts.thickness ?? 14;
  return {
    x: opts.x ?? 0, groundY: opts.groundY ?? 600,
    height: opts.height ?? 26,
    w: dir === 'x' ? length : thick,
    d: dir === 'x' ? thick : length,
    color: opts.color ?? WALL_COLORS[Math.floor(rnd() * WALL_COLORS.length)],
  };
}

function drawWall(ctx, wall) {
  const { x, groundY: gy, w, height: h, d, color } = wall;
  drawBoxShadow(ctx, x, gy, w, h, d);
  const f = drawBox(ctx, x, gy, w, h, d, color);
  // 갓돌: 정면 맨 위 얇은 밝은 띠
  const capH = Math.max(2, h * 0.12);
  fillPoly(ctx, [persp(x, gy - h, 0), persp(x + w, gy - h, 0), persp(x + w, gy - h + capH, 0), persp(x, gy - h + capH, 0)], mixColor(color, '#ffffff', 0.45));
  // 안쪽으로 뻗은 담장은 보이는 옆면 위에도 갓돌
  const sx = f.showRight ? x + w : f.showLeft ? x : null;
  if (sx !== null && d > w) {
    fillPoly(ctx, [persp(sx, gy - h, 0), persp(sx, gy - h, d), persp(sx, gy - h + capH, d), persp(sx, gy - h + capH, 0)], mixColor(color, '#ffffff', 0.35));
  }
}

/* pool.js — 수영장 (Canvas 2D)
 * 의존: nagai-util.js (장면 원근, 장면 빛)
 *
 * 사용법
 *   const pool = createPool({ x: 180, groundY: 770, width: 460, depth: 130 });
 *   drawPool(ctx, pool, { time });          // 윤슬이 반짝이므로 매 프레임 그린다
 *
 *   (x, groundY) = 수영장 앞쪽 왼쪽 모서리 (테두리 포함)
 *
 * 그리는 순서
 *   테두리(코핑) → 안쪽 벽 → 물(그늘 색) → 햇빛 드는 물 → 윤슬 점 → 사다리
 *   - 물결선은 없다. 물은 납작한 하늘색 면
 *   - 그림자는 항상 있다: 빛 쪽 벽과 안쪽(뒤) 벽이 물 위에 짙은 띠를 드리운다
 *     (빛 방향·해 높이에 따라 띠의 위치와 폭이 바뀐다)
 */

// 저녁 수영장: 어두운 물에 뒤쪽 풍경(하늘·빌딩숲·건물·야자수)이 비친다 (윤슬 없음)
// 저녁 수영장 (참고: 나가이의 밤 수영장): 물은 선명한 파랑, 표현은 어두운 물결 자국(윤슬의 반대)과
// 거의 검은 테두리 그림자뿐. 반사는 수영장 뒤 야자수 실루엣만 옅게
const POOL_NIGHT = {
  coping: '#b7a3b4', copingEdge: '#2a2650', wall: '#0c1034', water: '#3343c8', waterShade: '#0c1034',
  top: '#3c4ed8', bottom: '#2433ae', mark: '#131a5e', edge: '#080b2a', ghost: 0.35, rail: '#9aa3b4',
};
const REFLECT_KINDS = ['sky', 'skyline', 'house', 'palm'];
// 선베드 고정 치수 (설계 좌표, 깊이 0 기준) — 화면 비율과 상관없이 늘 같은 모양
const LOUNGER = { len: 120, wid: 40, h: 11, rise: 34, back: 0.3 };   // 길이·폭·판 높이·등받이 높이·등받이가 차지하는 길이 비율
// 수영장 둘레 갑판과 테두리 색 (하늘별): 오후 흰색, 분홍 해질녘 연분홍, 연보라 저녁 연어빛
const POOL_DECK = {
  deep: { color: '#faf6f0', line: 'rgba(120,105,90,0.2)' }, bright: { color: '#faf6f0', line: 'rgba(120,105,90,0.2)' },
  dusk: { color: '#f0c2bb', line: 'rgba(150,70,80,0.18)' }, violet: { color: '#c8868d', line: 'rgba(60,20,50,0.22)' },
};
const POOL_COPING = { deep: { coping: '#e9ddcf' }, bright: { coping: '#e9ddcf' }, dusk: { coping: '#fbe8e3' }, violet: {} };
const POOL_PALETTE = {
  coping: '#f3e6d6',
  copingEdge: '#d9c6b2',
  wall: '#9fd6e4',
  water: '#6cc3e3',
  waterShade: '#3f8fbf',
  glint: '#ffffff',
  rail: '#d8dee5',
};

function createPool(opts = {}) {
  const rnd = mulberry32(opts.seed ?? 9);
  const width = opts.width ?? 420, depth = opts.depth ?? 120;
  const pool = {
    x: opts.x ?? 180, groundY: opts.groundY ?? 760,
    width, depth,
    coping: opts.coping ?? 12,
    drop: opts.drop ?? 10,                 // 수면이 테두리보다 내려간 정도(화면 px)
    wallHeight: opts.wallHeight ?? 26,     // 그림자 계산용 벽 높이
    ladder: opts.ladder ?? true,
    night: !!opts.night,
    deck: opts.deck || null,               // 둘레 타일 갑판 {l, r, back, front, color, line} (세계 x, 깊이)
    palette: { ...POOL_PALETTE, ...(opts.night ? POOL_NIGHT : {}), ...(opts.palette || {}) },
    dots: [],
  };
  const n = opts.glints ?? Math.round(width * depth * 0.003);
  for (let i = 0; i < n; i++) {
    pool.dots.push({ u: rnd(), v: rnd(), r: lerp(0.8, 2, rnd()), phase: rnd() * Math.PI * 2, freq: lerp(1.2, 3.5, rnd()) });
  }
  if (pool.night) {
    // 짧고 불규칙한 어두운 물결 자국: 먼 쪽은 작고 촘촘, 가까울수록 크고 드문드문
    const r2 = mulberry32((opts.seed ?? 9) * 13 + 1);
    pool.marks = [];
    for (let v = 0.03; v < 1;) {
      for (let u = r2() * 0.03; u < 1; u += lerp(0.012, 0.05, v) * lerp(0.6, 1.6, r2())) {
        if (r2() < 0.35) continue;
        pool.marks.push({ u, v: v + (r2() - 0.5) * 0.02, len: lerp(0.008, 0.045, v) * lerp(0.5, 1.6, r2()), th: lerp(0.6, 3.2, v) * lerp(0.7, 1.3, r2()), phase: r2() * Math.PI * 2 });
      }
      v += lerp(0.018, 0.06, v);
    }
  }
  return pool;
}

function drawPool(ctx, pool, opts = {}) {
  const time = opts.time ?? 0;
  const { x, groundY: gy, width: w, depth: d, coping: c, drop, palette: P } = pool;
  const quad = (x0, x1, y, z0, z1) => [persp(x0, y, z0), persp(x1, y, z0), persp(x1, y, z1), persp(x0, y, z1)];

  // 0) 둘레 갑판 (단색)
  if (pool.deck) { const D = pool.deck; fillPoly(ctx, quad(D.l, D.r, gy, D.front, d + D.back), D.color); }
  // 1) 테두리
  fillPoly(ctx, quad(x, x + w, gy, 0, d), P.coping);
  const rim = quad(x + c, x + w - c, gy, c, d - c);
  const ix0 = x + c, ix1 = x + w - c, iz0 = c, iz1 = d - c;

  ctx.save();
  fillPoly(ctx, rim); ctx.clip();
  // 2) 안쪽 벽 (보이는 부분만 남는다)
  fillPoly(ctx, rim, P.wall);
  // 3) 물: 테두리 안쪽을 drop 만큼 내린 면. 먼저 전부 그늘 색
  const water = [persp(ix0, gy + drop, iz0), persp(ix1, gy + drop, iz0), persp(ix1, gy + drop, iz1), persp(ix0, gy + drop, iz1)];
  fillPoly(ctx, water, P.waterShade);
  fillPoly(ctx, water); ctx.clip();
  if (pool.night) { drawPoolReflection(ctx, pool, time, opts.wind ?? (() => 0), ix0, ix1, iz0, iz1, gy + drop); ctx.restore(); drawPoolRim(ctx, pool, rim, ix1, iz0, iz1, gy, drop); return; }
  // 4) 햇빛 드는 물: 테두리 모양을 (수면까지 내림 + 벽 그림자 길이)만큼 옮긴 곳
  const o = shadowOffset(pool.wallHeight);
  const lit = rim.map((p) => ({ x: p.x + o.dx, y: p.y + drop + o.dy + pool.wallHeight * 0.35 * (1 - SCENE_LIGHT.sunHeight) }));
  fillPoly(ctx, lit, P.water);
  ctx.save();
  fillPoly(ctx, lit); ctx.clip();
  // 5) 윤슬: 물결선 없이 점만 반짝인다 (햇빛 드는 곳에서만)
  ctx.fillStyle = P.glint;
  for (const dot of pool.dots) {
    const tw = Math.sin(time * dot.freq + dot.phase);
    if (tw < 0.15) continue;
    const z = lerp(iz0, iz1, dot.v), s = perspScale(z);
    const p = persp(lerp(ix0, ix1, dot.u), gy + drop, z);
    ctx.globalAlpha = smoothstep(0.15, 0.9, tw);
    ctx.beginPath();
    ctx.arc(p.x, p.y, dot.r * s * (0.6 + 0.4 * tw), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  ctx.restore();
  drawPoolRim(ctx, pool, rim, ix1, iz0, iz1, gy, drop);
}

// 저녁 물: 선명한 파랑 위에 어두운 물결 자국이 천천히 일렁이고, 안쪽 테두리는 거의 검은 그림자.
// 수영장 뒤 야자수만 실루엣으로 비친다 (밑동이 물의 먼 가장자리에 붙고, 위아래 뒤집혀 아래로 뻗는다)
function drawPoolReflection(ctx, pool, time, wind, ix0, ix1, iz0, iz1, wy) {
  const P = pool.palette;
  const back = persp(ix0, wy, iz1).y, front = persp(ix0, wy, iz0).y;
  const xb0 = persp(ix0, wy, iz1).x, xb1 = persp(ix1, wy, iz1).x, xf0 = persp(ix0, wy, iz0).x, xf1 = persp(ix1, wy, iz0).x;
  const W = pool.sceneWidth ?? 1200;
  const g = ctx.createLinearGradient(0, back, 0, front);
  g.addColorStop(0, P.top); g.addColorStop(1, P.bottom);
  const fillWater = () => { ctx.fillStyle = g; ctx.fillRect(-W, back - 2, W * 3, front - back + 4); };
  fillWater();
  // 야자수 반사
  const k = 0.75;
  let drew = false;
  for (const x of pool.scene || []) {
    if (x.it.kind !== 'palm' || x.it.y > back) continue;
    const bx = x.it.x;
    if (bx < xb0 - 40 || bx > xb1 + 40) continue;
    ctx.save();
    ctx.transform(1, 0, 0, -k, 0, back + k * x.it.y);                // 밑동 y → 물의 먼 가장자리
    drawPalm(ctx, x.obj, bx, x.it.y, { time, wind: wind(bx) });
    ctx.restore();
    drew = true;
  }
  if (drew) { ctx.globalAlpha = 1 - P.ghost; fillWater(); ctx.globalAlpha = 1; }
  // 어두운 물결 자국
  ctx.fillStyle = P.mark;
  for (const m of pool.marks || []) {
    const v = Math.min(1, Math.max(0, m.v)), y = lerp(back, front, Math.pow(v, 1.15));
    const xl = lerp(xb0, xf0, v), xr = lerp(xb1, xf1, v), w = (xr - xl) * m.len;
    const x = lerp(xl, xr, m.u) + Math.sin(time * 0.7 + m.phase) * w * 0.35;
    const th = m.th * (0.85 + 0.15 * Math.sin(time * 1.1 + m.phase * 2));
    ctx.beginPath(); ctx.ellipse(x, y, w / 2, th / 2, 0, 0, Math.PI * 2); ctx.fill();
  }
  // 안쪽 테두리 그림자: 먼 벽 아래 띠 + 양옆 가는 띠
  const band = Math.max(2, (front - back) * 0.07);
  const eg = ctx.createLinearGradient(0, back, 0, back + band * 1.6);
  eg.addColorStop(0, P.edge); eg.addColorStop(0.55, P.edge); eg.addColorStop(1, 'rgba(8,11,42,0)');
  ctx.fillStyle = eg; ctx.fillRect(-W, back - 2, W * 3, band * 1.6 + 2);
  ctx.fillStyle = P.edge;
  const side = (xa, xb, dir) => fillPoly(ctx, [{ x: xa, y: back }, { x: xa + dir * band * 0.9, y: back }, { x: xb + dir * band * 1.4, y: front }, { x: xb, y: front }]);
  side(xb0, xf0, 1); side(xb1, xf1, -1);
}

function drawPoolRim(ctx, pool, rim, ix1, iz0, iz1, gy, drop) {
  const P = pool.palette;
  // 테두리 안쪽 모서리 선
  ctx.strokeStyle = P.copingEdge; ctx.lineWidth = 1;
  fillPoly(ctx, rim); ctx.stroke();

  // 6) 사다리: 오른쪽 앞 모서리 근처에 크롬 손잡이 두 개
  if (pool.ladder) {
    ctx.strokeStyle = P.rail;
    ctx.lineCap = 'round';
    for (const k of [0, 1]) {
      const zx = iz0 + (iz1 - iz0) * 0.2 + k * 24;
      const s = perspScale(zx);
      const base = persp(ix1 - 8, gy, zx);
      ctx.lineWidth = 3.2 * s;
      ctx.beginPath();
      ctx.moveTo(base.x, base.y + drop * s * 0.8);
      ctx.lineTo(base.x, base.y - 28 * s);
      ctx.quadraticCurveTo(base.x, base.y - 40 * s, base.x + 13 * s, base.y - 37 * s);
      ctx.lineTo(base.x + 19 * s, base.y - 3 * s);
      ctx.stroke();
    }
  }
}

/* composer.js — 결정트리로 구도를 정하고, 시드에 따라 위치를 흔들어 장면 명세를 만든다
 * 의존: nagai-util.js 와 모든 객체 모듈 (palm, sea, bush, plants, car, skyline, house, wall, pool)
 *
 * 사용법
 *   const spec = composeScene(1234);                 // 구도 + 위치 (시드 하나로 재현)
 *   const spec2 = composeScene(1234, { jitter: 77 }); // 같은 구도, 위치만 다르게
 *   const spec3 = composeScene(1234, { force: { theme: 'resort', foreground: 'pool' } })
 *                                                    // 일부 선택만 직접 고정, 나머지는 시드대로
 *   choiceOptions('resort') → 그 테마에서 고를 수 있는 선택지 목록 (UI 만들 때)
 *   const scene = buildScene(spec);                  // 객체 생성 + 그리는 순서(runs) 계산
 *   scene.runs → [{ dynamic: false, items }, { dynamic: true, items }, ...]
 *     정적 묶음은 한 번 구워두고, 동적 묶음은 매 프레임 drawRun(ctx, run, time, wind)
 *
 * 난수 두 줄기
 *   tree   = mulberry32(seed)       → 트리 선택 (테마, 원경, 주인공 위치, 개수 …)
 *   jitter = mulberry32(jitterSeed) → 위치·크기·기울기 (같은 구도 안에서의 변주)
 *
 * 그리는 순서
 *   back(하늘·먼 빌딩·섬) → sea → flat(땅·잔디·도로) → pool → stand(서 있는 것, 바닥 y 순)
 *   바닥에 붙은 것은 서 있는 것보다 항상 먼저 → 그림자가 수영장·잔디 위에도 자연스럽게 떨어진다
 */

const COMPOSITION_TREE = {
  theme: [['beach', 3], ['resort', 4], ['poolside', 2], ['coastRoad', 3]],
  focal: [['left', 3], ['center', 2], ['right', 3]],
  sky: [['deep', 3], ['bright', 2], ['dusk', 1]],
  // 저녁 하늘이 나오면 따로 굴린 난수로 분홍(dusk) / 연보라(violet) 중 하나 → 낮 장면 시드는 그대로
  evening: [['dusk', 1], ['violet', 1]],
  themes: {
    beach: {
      horizon: [0.46, 0.55],
      far: [['sea', 2], ['sea+city', 2], ['sea+island', 1]],
      foreground: [['car', 3], ['empty', 2]],
      buildings: [[0, 1]],
      palms: [['pair', 2], ['cluster', 3], ['even', 1]],
    },
    resort: {
      horizon: [0.6, 0.67],
      far: [['sea', 1], ['sea+city', 3], ['sea+island', 1]],
      foreground: [['pool', 3], ['wall', 2], ['car', 1]],
      buildings: [[1, 1], [2, 2]],
      palms: [['behind', 3], ['cluster', 2], ['even', 2]],
    },
    poolside: {
      horizon: [0.56, 0.62],
      far: [['hedge', 3], ['sea', 1]],
      foreground: [['pool', 1]],
      buildings: [[1, 3], [0, 1]],
      palms: [['even', 2], ['cluster', 2], ['behind', 1]],
    },
    coastRoad: {
      horizon: [0.48, 0.56],
      far: [['sea', 2], ['sea+city', 2], ['sea+island', 1]],
      foreground: [['car', 1]],
      buildings: [[0, 1]],
      palms: [['even', 3], ['pair', 1]],
    },
  },
};

const SKY_COLORS = {
  deep: ['#163f8e', '#2f66b8', '#8fb8e4'],
  bright: ['#1f55ad', '#5a95d6', '#a3c7ec'],
  dusk: ['#e77fae', '#f29bc0', '#f9c6d3'],       // 분홍 해질녘
  violet: ['#6a4cc0', '#a67fdc', '#efb8e6'],     // 연보라 저녁 (도시에 불이 켜지는 시간)
};
// 바닥 색은 하늘이 정한다: 오후는 모래색, 분홍 해질녘은 산호빛, 연보라 저녁은 자줏빛
const GROUND_BY_SKY = { deep: 'sand', bright: 'sand', dusk: 'coral', violet: 'maroon' };
const SKY_OPTIONS = [['deep', 3], ['bright', 2], ['dusk', 1], ['violet', 1]];   // UI 에서 고를 수 있는 하늘
// 바닥·도로·잔디 색. sand 의 ground 는 테마별 기존 색을 그대로 쓴다
const GROUND_PALETTES = {
  sand: { ground: null, sidewalk: null, road: '#8e97aa', roadEdge: '#f4f1ea', roadDash: '#f2ead2', lawn: '#5aa84f', lawnFront: '#62b356' },
  coral: { ground: '#de5f6f', sidewalk: '#f0a0aa', road: '#b9475b', roadEdge: '#f6c9cf', roadDash: '#fbe3e6', lawn: '#4f9a4a', lawnFront: '#55a24f' },
  maroon: { ground: '#7d2c42', sidewalk: '#c4677c', road: '#6a2438', roadEdge: '#cf7088', roadDash: '#e9a7b6', lawn: '#2f6b44', lawnFront: '#357548' },
};
const CHOICE_LABELS = {
  beach: '해변', resort: '리조트', poolside: '수영장 마당', coastRoad: '해안 도로',
  sea: '바다', 'sea+city': '바다+빌딩숲', 'sea+island': '바다+섬', hedge: '생울타리',
  left: '주인공 왼쪽', center: '주인공 가운데', right: '주인공 오른쪽',
  car: '자동차', pool: '수영장', wall: '담장', empty: '비움',
  even: '야자수 고른 간격', cluster: '야자수 무리', pair: '야자수 한 쌍', behind: '야자수 건물 뒤',
  deep: '짙은 하늘', bright: '맑은 하늘', dusk: '분홍 해질녘', violet: '연보라 저녁',
  sand: '모래색 바닥', coral: '산호빛 바닥', maroon: '자줏빛 바닥',
};
const CHOICE_LABELS_EN = {
  beach: 'Beach', resort: 'Resort', poolside: 'Poolside yard', coastRoad: 'Coast road',
  sea: 'Sea', 'sea+city': 'Sea + city', 'sea+island': 'Sea + island', hedge: 'Hedge',
  left: 'Subject left', center: 'Subject center', right: 'Subject right',
  car: 'Car', pool: 'Pool', wall: 'Wall', empty: 'Empty',
  even: 'Palms evenly spaced', cluster: 'Palm cluster', pair: 'Pair of palms', behind: 'Palms behind buildings',
  deep: 'Deep blue sky', bright: 'Clear sky', dusk: 'Pink dusk', violet: 'Violet evening',
  sand: 'Sand ground', coral: 'Coral ground', maroon: 'Maroon ground',
};
const choiceLabel = (k, lang) => (lang === 'en' ? CHOICE_LABELS_EN : CHOICE_LABELS)[k] ?? k;
const buildingsLabel = (n, lang) => (lang === 'en' ? `${n} building${n === 1 ? '' : 's'}` : `${n}채`);

// 이웃한 시드(1, 2, 3 …)도 전혀 다른 난수열이 되도록 섞는다
function hashSeed(n) {
  let h = (n | 0) ^ 0x9e3779b9;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

function pickWeighted(rng, options) {
  const total = options.reduce((s, o) => s + o[1], 0);
  let r = rng() * total;
  for (const [v, w] of options) if ((r -= w) <= 0) return v;
  return options[options.length - 1][0];
}

// UI 용: 테마별로 고를 수 있는 선택지 (값, 표시 이름). lang: 'ko' | 'en'
function choiceOptions(theme, lang = 'ko') {
  const T = COMPOSITION_TREE.themes[theme] ?? {};
  const label = (o) => [o[0], typeof o[0] === 'number' ? buildingsLabel(o[0], lang) : choiceLabel(o[0], lang)];
  return {
    theme: COMPOSITION_TREE.theme.map(label),
    far: (T.far ?? []).map(label),
    focal: COMPOSITION_TREE.focal.map(label),
    foreground: (T.foreground ?? []).map(label),
    buildings: (T.buildings ?? []).map(label),
    palms: (T.palms ?? []).map(label),
    sky: SKY_OPTIONS.map(label),
  };
}

function describeChoice(choice, lang = 'ko') {
  return [choice.theme, choice.far, choice.focal, choice.foreground, choice.palms, choice.sky, choice.ground]
    .map((k) => choiceLabel(k, lang)).join(' · ')
    + (choice.buildings ? (lang === 'en' ? ` · ${buildingsLabel(choice.buildings, 'en')}` : ` · 건물 ${choice.buildings}채`) : '');
}

/* ═════════ 1) 구도 결정 + 배치 → 장면 명세 ═════════ */

function composeScene(seed, opts = {}) {
  const W = opts.width ?? 1200, H = opts.height ?? 800;
  const rt = mulberry32(hashSeed(seed));                         // 트리 선택
  const rp = mulberry32(hashSeed(opts.jitter ?? seed * 7919 + 13)); // 위치 흔들기
  const J = (a, b) => lerp(a, b, rp());
  const pickInt = (a, b) => a + Math.floor(rt() * (b - a + 1));  // 개수는 구도 쪽 난수

  // ── 트리 내려가기
  // 고정한 항목도 난수는 똑같이 한 번 뽑고 버린다 → 하나를 고정해도 나머지 선택은 그대로 유지
  const force = opts.force ?? {};
  const pick = (key, options) => {
    const v = pickWeighted(rt, options), f = force[key];
    return f !== undefined && f !== null && f !== '' && options.some((o) => String(o[0]) === String(f))
      ? options.find((o) => String(o[0]) === String(f))[0] : v;
  };
  let theme = pick('theme', COMPOSITION_TREE.theme);
  let T = COMPOSITION_TREE.themes[theme];
  const choice = {
    theme,
    far: pick('far', T.far),
    focal: pick('focal', COMPOSITION_TREE.focal),
    foreground: pick('foreground', T.foreground),
    buildings: pick('buildings', T.buildings),
    palms: pick('palms', T.palms),
    sky: (() => {
      let v = pickWeighted(rt, COMPOSITION_TREE.sky);              // 예전과 같은 횟수로 rt 를 쓴다
      if (v === 'dusk') v = pickWeighted(mulberry32(hashSeed(seed) ^ 0x6a09e667), COMPOSITION_TREE.evening);
      const f = force.sky;
      return f && SKY_OPTIONS.some((o) => o[0] === f) ? f : v;
    })(),
  };
  // 연보라 저녁: 도시가 주인공급 배경 → 항상 빌딩숲 (생울타리·섬 대신)
  if (choice.sky === 'violet') choice.far = 'sea+city';
  choice.ground = GROUND_BY_SKY[choice.sky];
  const GP = GROUND_PALETTES[choice.ground];
  // 연보라 저녁: 도시가 가까운 배경 (바다는 수평선의 얇은 띠, 그 앞에 불빛 깔린 도시, 그 앞에 건물·수영장).
  // 자동차는 나오지 않는다 (리조트는 수영장으로, 나머지는 비움)
  const nearCity = choice.sky === 'violet';
  if (nearCity && choice.foreground === 'car') choice.foreground = theme === 'resort' ? 'pool' : 'empty';
  if (nearCity) {
    // 저녁 구도 다듬기 (저녁 전용 난수 → 다른 하늘의 장면은 그대로). 직접 고정한 항목은 건드리지 않는다
    const rv = mulberry32(hashSeed(seed) ^ 0x3c6ef372), r1 = rv(), r2 = rv();
    const free = (k) => force[k] == null || force[k] === '';
    if (r1 < 0.25 && free('theme') && free('foreground') && free('buildings')) {
      // 수영장 테라스만: 건물 없이 테라스·수영장·야자수 너머로 도시 (참고: 나가이의 밤 수영장)
      theme = choice.theme = 'poolside'; T = COMPOSITION_TREE.themes[theme];
      choice.foreground = 'pool'; choice.buildings = 0;
      if (!T.palms.some((o) => o[0] === choice.palms)) choice.palms = 'cluster';
    } else if (choice.buildings > 0 && choice.foreground === 'pool' && r2 < 0.75) {
      // 건물 + 수영장은 드물게: 리조트는 담장으로, 수영장 마당은 건물을 빼고 수영장만
      if (theme === 'resort' && free('foreground')) choice.foreground = 'wall';
      else if (theme === 'poolside' && free('buildings')) choice.buildings = 0;
    }
  }
  const leanSign = rt() < 0.5 ? -1 : 1;

  // ── 큰 틀: 수평선, 주인공 위치, 소실점, 빛
  const horizonY = H * J(T.horizon[0], T.horizon[1]);
  const focalX = W * ({ left: 0.33, center: 0.5, right: 0.67 }[choice.focal] + J(-0.04, 0.04));
  // 빛은 주인공 바깥쪽에서 → 그림자가 화면 안쪽으로 뻗는다
  const lightSide = choice.focal === 'left' ? -1 : choice.focal === 'right' ? 1 : (rt() < 0.5 ? -1 : 1);
  const spec = {
    seed, jitter: opts.jitter ?? null, force, width: W, height: H, choice,
    view: { vpX: W / 2 + (focalX - W / 2) * 0.5, horizonY, dist: J(550, 750) },
    light: { x: lightSide * J(0.35, 0.8), sunHeight: J(0.3, 0.7) },
    items: [],
  };
  const add = (kind, phase, y, params = {}) => spec.items.push({ kind, phase, y, ...params });
  // 바닥 y 에서의 크기 배율: 수평선 0 → 화면 맨 아래 1 (땅 위 원근)
  const sAt = (y) => Math.max(0.05, (y - horizonY) / (H - horizonY));
  const childSeed = () => Math.floor(rp() * 1e9);
  // 덤불 말고 다른 식물(둥근 나무·용설란·유카)과 꽃 색은 따로 굴린 난수로 → 예전 시드의 다른 배치는 그대로
  //   rqt = 무슨 식물인지 (시드를 따른다), rqp = 위치·크기 (같은 구도의 변주를 따른다)
  const rqt = mulberry32(hashSeed(seed) ^ 0x2545f491);
  const rqp = mulberry32(hashSeed(opts.jitter ?? seed * 7919 + 13) ^ 0x2545f491);
  const Q = (a, b) => lerp(a, b, rqp());
  const plantTone = choice.sky === 'violet' ? 'night' : choice.sky === 'dusk' ? 'dusk' : 'day';
  const flowerSet = pickWeighted(rqt, [['pink', 5], ['red', 2], ['white', 1], ['yellow', 1], ['purple', 1]]);   // 장면 하나에 꽃 색 한 가지
  const bushPalette = bushPaletteFor(plantTone, flowerSet);
  const awayQ = (a, b) => (focalX < W / 2 ? W * Q(1 - b, 1 - a) : W * Q(a, b));

  // ── 하늘·원경
  add('sky', 'back', 0, { colors: SKY_COLORS[choice.sky], horizonY });
  let shoreY = {
    beach: horizonY + (H - horizonY) * J(0.26, 0.36),
    resort: horizonY + J(28, 40),
    poolside: horizonY + J(24, 34),
    coastRoad: horizonY + (H - horizonY) * J(0.14, 0.2),
  }[theme];
  // 가까운 도시: 바다는 얇게, 도시 밑동(가로수 띠) = cityBase, 그 앞이 땅(landTop)
  const cityBase = horizonY + (H - horizonY) * (theme === 'poolside' ? 0.36 : 0.4);   // 내려다보는 도시의 아래 끝
  if (nearCity) shoreY = horizonY + Math.max(5, (H - horizonY) * 0.03);
  const landTop = nearCity ? cityBase + 3 : shoreY;
  add('sea', 'sea', horizonY, {
    seed: childSeed(), horizonY, shoreY, width: W,
    foamThickness: Math.max(4, (shoreY - horizonY) * 0.09), lineCount: shoreY - horizonY > 100 ? 6 : 4,
    perspective: shoreY - horizonY > 100 ? 1.8 : 1.4,
    night: choice.sky === 'violet', noFoam: nearCity,
  });
  if (theme === 'beach' && (choice.sky === 'deep' || choice.sky === 'bright')) {
    // 오후 해변: 부서지는 파도 하나. 말리는 곳이 마루를 따라 옆으로 옮겨 간다 (따로 굴린 난수)
    const rw = mulberry32(hashSeed(seed) ^ 0x7f4a7c15), depth = shoreY - horizonY;
    add('breakingWave', 'sea', horizonY + 1, {
      seed: Math.floor(rw() * 1e9), width: W, y0: horizonY + depth * lerp(0.62, 0.68, rw()), hw: depth * lerp(0.28, 0.34, rw()),
      phase: rw() * 30, period: lerp(11, 14, rw()), top: horizonY, bottom: horizonY + depth * 0.78,
    });
  }
  const awayFromFocal = (a, b) => (focalX < W / 2 ? W * J(1 - b, 1 - a) : W * J(a, b));
  if (choice.far === 'sea+city') {
    // 난수 순서(seed → x → maxHeight)를 예전과 같게 유지해야 기존 시드의 배치가 그대로다
    let w = W * J(0.18, 0.32);
    const cs = childSeed();
    let x = awayFromFocal(0.02, 0.12) - (focalX < W / 2 ? w : 0), maxHeight = H * J(0.07, 0.12);
    // 같은 육지의 만 건너편 도시처럼 보이게, 빌딩숲은 자기 쪽 화면 끝까지 이어 붙인다 (섬처럼 떠 있지 않게)
    if (focalX < W / 2) w = W * 1.04 - x;            // 오른쪽 도시: 오른쪽 끝까지
    else { w = x + w + W * 0.04; x = -W * 0.04; }   // 왼쪽 도시: 왼쪽 끝부터
    if (nearCity) {
      // 내려다보는 도시: 수평선(바다) 아래로 불빛 벌판이 넓게 펼쳐지고, 빌딩은 3겹 — 먼 줄은 작게 수평선 근처,
      // 가까운 줄은 크게 아래쪽. 꼭대기는 대체로 수평선 언저리 (가장 높은 몇 채만 바다 위로 솟는다)
      add('cityLights', 'flat', shoreY + 0.5, { seed: cs ^ 0x51, y0: shoreY, y1: cityBase + 2, width: W, horizonY, vpX: spec.view.vpX });
      [0.32, 0.62, 1].forEach((f, r) => {
        const base = shoreY + (cityBase - shoreY) * f, depth = base - horizonY;
        add('skyline', 'flat', base, {
          seed: cs + r * 7919, x: -W * 0.04, width: W * 1.08, maxHeight: depth * J(0.8, 1.1) + H * 0.01,
          night: true, near: true, trees: r === 2,       // 가로수 띠는 가장 가까운 줄 밑동에만
          density: [0.6, 0.42, 0.28][r],                 // 가까울수록 드문드문 → 사이로 불빛 벌판
        });
      });
    } else {
      add('skyline', 'back', horizonY, { seed: cs, x, width: w, maxHeight, night: choice.sky === 'dusk' });
    }
  }
  if (choice.far === 'sea+island') {
    add('island', 'back', horizonY, { x: awayFromFocal(0.08, 0.25), w: W * J(0.08, 0.16), h: H * J(0.012, 0.022) });
  }
  const baseGround = theme === 'beach' ? (rp() < 0.6 ? '#f7dede' : '#f1e6cf') : '#efdccc';   // rp 는 항상 한 번 뽑는다
  add('ground', 'flat', shoreY, { color: (theme === 'coastRoad' ? GP.sidewalk : GP.ground) ?? baseGround });
  if (choice.far === 'hedge') {
    // 생울타리: 바다 바로 앞에 덤불을 촘촘히 이어 붙인다
    const hy = horizonY + (H - horizonY) * J(0.08, 0.12), s = sAt(hy) * 1.4;
    for (let x = J(-60, -10); x < W + 60;) {
      const w = J(500, 700) * s;
      add('bush', 'stand', hy + J(-3, 3), { seed: childSeed(), x, width: w, height: w * J(0.55, 0.7), flowers: rp() < 0.4 || rqt() < 0.8 ? undefined : 0, palette: bushPalette });   // 꽃 없는 덤불은 드물게 (화사하게)
      x += w * J(0.55, 0.8);
    }
  }

  // ── 야자수 배치 도우미
  const palmAt = (x, y) => {
    const s = sAt(y), height = Math.min(J(1000, 1450) * s, y - H * J(0.12, 0.2));   // 잎이 화면 밖으로 나가지 않게
    add('palm', 'stand', y, {
      seed: childSeed(), x, height,
      lean: leanSign * J(0, 0.12) * height, bow: J(-0.03, 0.03) * height,
      frondLength: height * J(0.13, 0.16),
      palette: choice.sky === 'violet' ? PALM_SILHOUETTE : choice.sky === 'dusk' ? PALM_DUSK : undefined,
    });
  };
  const placePalms = (rhythm, span, yRange, avoid = []) => {
    const ys = () => J(yRange[0], yRange[1]);
    if (rhythm === 'even') {
      const n = pickInt(4, 6);
      for (let i = 0; i < n; i++) palmAt(lerp(span[0], span[1], (i + 0.5) / n) + J(-0.25, 0.25) * (span[1] - span[0]) / n, ys());
    } else if (rhythm === 'pair') {
      const y = ys(), gap = J(50, 100) * sAt(y) * 2;
      palmAt(focalX - gap / 2, y); palmAt(focalX + gap / 2, y + J(-8, 8));
      if (rt() < 0.6) palmAt(awayFromFocal(0.1, 0.25), ys());
    } else {                          // cluster / behind: 무리 2~3개, 무리당 2~3그루
      const k = pickInt(2, 3);
      const centers = rhythm === 'behind' && avoid.length
        ? avoid.map((a) => lerp(a[0], a[1], J(0.15, 0.85)))
        : Array.from({ length: k }, (_, i) => lerp(span[0], span[1], (i + J(0.2, 0.8)) / k));
      for (const c of centers) {
        const n = pickInt(2, 3), y = ys();
        for (let i = 0; i < n; i++) palmAt(c + J(-60, 60) * sAt(y) * 1.5, y + J(-10, 10));
      }
    }
  };
  // 식물 하나 (덤불 자리에 덤불 대신 들어가기도 한다). w = 덤불이었다면 폭
  const plantAt = (kind, x, y, w, extra = {}) => {
    const seed = Math.floor(rqp() * 1e9);
    if (kind === 'agave') {
      const stems = rqt() < 0.35 ? 1 + Math.floor(rqt() * 3) : 0;                  // 셋 중 하나쯤은 유카
      const size = w * (stems ? Q(0.26, 0.32) : Q(0.3, 0.38));
      add('agave', 'stand', y, { seed, x, size, stems, tone: plantTone, ...extra });
      if (!stems && !extra.pot && rqt() < 0.5) add('agave', 'stand', y + 2, { seed: seed ^ 0x5bd1, x: x + (rqt() < 0.5 ? -1 : 1) * size * Q(0.9, 1.3), size: size * Q(0.5, 0.7), tone: plantTone });
    }
  };
  // 크고 둥근 나무: 주인공 반대쪽 화면 끝에 걸쳐 일부만 보인다 (액자처럼). 가끔 색이 다른 나무가 뒤에 하나 더
  const edgeTree = (y) => {
    const variants = [['green', 3], ['deep', 2], ['lime', 2]], side = focalX < W / 2 ? 1 : -1;
    const tw = W * Q(0.3, 0.4), th = Math.min(tw * Q(1.1, 1.35), y - H * 0.02);
    const xc = side > 0 ? W + tw * Q(0.05, 0.25) : -tw * Q(0.05, 0.25);
    if (rqt() < 0.4) {
      const bw = tw * Q(0.6, 0.8);
      add('tree', 'stand', y - Q(10, 30) * sAt(y), { seed: Math.floor(rqp() * 1e9), x: xc - side * tw * Q(0.3, 0.45), width: bw, height: Math.min(bw * Q(1.1, 1.4), y - H * 0.04), variant: pickWeighted(rqt, variants), tone: plantTone });
    }
    add('tree', 'stand', y, { seed: Math.floor(rqp() * 1e9), x: xc, width: tw, height: th, variant: pickWeighted(rqt, variants), tone: plantTone });
  };
  let edgeTreeY = null;
  // 덤불 자리: 대개 덤불이고, 가끔 용설란(유카)이 대신 선다
  const bushAt = (x, y, big = 1) => {
    const s = sAt(y), seed = childSeed(), width = J(280, 420) * s * big, height = J(170, 250) * s * big, flowers = rp() < 0.35 && rqt() < 0.3 ? 0 : undefined;
    const kind = pickWeighted(rqt, big >= 1 ? [['bush', 6], ['agave', 2]] : [['bush', 5], ['agave', 2]]);
    if (kind === 'bush') add('bush', 'stand', y, { seed, x, width, height, flowers, palette: bushPalette });
    else plantAt(kind, x, y, width);
  };
  const carAt = (x, y) => {
    const s = sAt(y), t = pickWeighted(rp, [[{ body: 'coupe', roof: 'white' }, 2], [{ body: 'coupe', roof: 'open' }, 2], [{ body: 'sedan', roof: 'white' }, 2], [{ body: 'sedan', roof: 'body' }, 1]]);
    const colors = ['#7cc7d0', '#93cbe8', '#f0d39c', '#e7949a', '#f2efe4', '#9fd3b5', '#7a1f2b', '#23382f'];
    add('car', 'stand', y, { ...t, x, length: J(480, 560) * s, color: colors[Math.floor(rp() * colors.length)], facing: x < W / 2 ? 1 : -1 });
  };

  // ── 테마별 중경·전경
  if (theme === 'beach') {
    placePalms(choice.palms, [W * 0.08, W * 0.92], [landTop + (H - landTop) * 0.08, H - (H - landTop) * 0.4]);
    if (choice.foreground === 'car') {
      const cx = choice.palms === 'pair' ? awayFromFocal(0.25, 0.35) : focalX;
      carAt(cx + J(-40, 40), H * J(0.86, 0.92));
    }
    if (rt() < 0.7) bushAt(awayFromFocal(0.02, 0.12), H * J(0.93, 1.0), 1.2);
    edgeTreeY = landTop + (H - landTop) * Q(0.2, 0.4);
    // 모래밭에 용설란·유카 한 무리
    if (rqt() < 0.55) { const y = landTop + (H - landTop) * Q(0.35, 0.55); plantAt('agave', awayQ(0.04, 0.2), y, 360 * sAt(y)); }
  }

  if (theme === 'resort' || theme === 'poolside') {
    let houseBase = horizonY + (H - horizonY) * (theme === 'resort' ? J(0.26, 0.34) : J(0.2, 0.26));
    if (nearCity) houseBase = landTop + (H - landTop) * 0.12;          // 내려다보는 구도: 건물은 도시 앞 테라스에
    const s = sAt(houseBase) * (nearCity ? 0.55 : 1);                  // 도시를 덜 가리게 작게
    add('lawn', 'flat', houseBase, { x0: -W * 0.5, x1: W * 1.5, y: houseBase + 2, depth: J(120, 220), color: GP.lawn });
    const spans = [];
    const n = choice.buildings;
    const order = n === 2 ? [focalX, awayFromFocal(0.12, 0.22)] : [focalX];
    order.slice(0, n).forEach((cx, i) => {
      const w = J(820, 960) * s * (i === 0 ? 1 : 0.85), h = J(560, 700) * s * (i === 0 ? 1 : 0.9);
      let x0 = cx - w / 2;
      for (const sp of spans) if (x0 < sp[1] + 30 && x0 + w > sp[0] - 30) x0 = cx < (sp[0] + sp[1]) / 2 ? sp[0] - 30 - w : sp[1] + 30;
      spans.push([x0, x0 + w]);
      const night = choice.sky === 'violet';
      let style = i === 0 ? (rt() < 0.6 ? 'shop' : 'house') : undefined;      // rt 는 예전처럼 뽑는다
      if (night && i === 0) style = 'shop';                                     // 저녁의 주인공 건물 = 늘 불 켜진 간판 가게
      add('house', 'stand', houseBase, { seed: childSeed(), x: x0, groundY: houseBase, width: w, height: h, depth: w * J(0.45, 0.6), style, night, nightShop: night && i === 0 });
    });
    placePalms(choice.palms, [W * 0.05, W * 0.95], [houseBase - J(25, 40), houseBase - J(2, 12)], spans);
    for (const sp of spans) if (rp() < 0.8) bushAt(rp() < 0.5 ? sp[0] - J(10, 40) * s : sp[1] + J(10, 40) * s, houseBase + J(6, 18), 0.6);
    edgeTreeY = houseBase + (H - houseBase) * Q(0.05, 0.2);

    const fgY = houseBase + (H - houseBase) * J(0.28, 0.4);
    if (choice.foreground === 'pool') {
      // 수영장: 가로로 넓고 얕은 사각형 + 둘레 타일 갑판. 한쪽 옆 갑판은 넓게 두고 선베드를 놓는다
      // (난수는 예전 순서대로 뽑고 값만 바꾼다 → 수영장 밖의 배치는 그대로)
      const pwOld = W * (theme === 'poolside' ? J(0.82, 0.94) : J(0.74, 0.88));
      const pxOld = Math.min(W - pwOld - 16, Math.max(16, (theme === 'poolside' ? W / 2 : awayFromFocal(0.3, 0.45)) - pwOld / 2 + J(-60, 60)));
      const pgy = H - J(12, 24), pd = (theme === 'poolside' ? J(230, 300) : J(200, 270)) * (H / 800);
      const pw = pwOld * 0.8, centerOld = pxOld + pwOld / 2, loungeRight = centerOld <= W / 2;   // 넓게 빈 쪽에 선베드
      const px = Math.max(W * 0.04, Math.min(W * 0.96 - pw, centerOld - pw / 2 + (loungeRight ? -1 : 1) * W * 0.05));
      const m = W * 0.045, side = Math.max(W * 0.17, LOUNGER.len * 1.35 + m);   // 옆 갑판은 선베드가 들어갈 만큼
      const deck = {
        l: Math.max(-W * 0.12, px - m - (loungeRight ? 0 : side)), r: Math.min(W * 1.12, px + pw + m + (loungeRight ? side : 0)),
        back: pd * 0.3, front: -pd * 0.8, ...POOL_DECK[choice.sky],
      };
      add('pool', 'pool', pgy - pd, { seed: childSeed(), x: px, groundY: pgy, width: pw, depth: pd, night: choice.sky === 'violet', deck, palette: POOL_COPING[choice.sky] });
      const rl = mulberry32(hashSeed(seed) ^ 0x1f83d9ab);                // 선베드는 따로 굴린 난수
      if (rl() < 0.85) {
        const dist = spec.view.dist, vx = spec.view.vpX;
        const P = (xw, z) => { const f = dist / (dist + z); return { x: vx + (xw - vx) * f, y: horizonY + (pgy - horizonY) * f }; };
        // 옆 갑판에 두 개를 앞뒤로, 발 쪽이 수영장을 향하게 (등받이는 수영장 반대쪽 끝). 크기는 고정 치수
        const toPool = loungeRight ? -1 : 1, L = LOUNGER;
        const xc = loungeRight ? px + pw + m + side * 0.5 : px - m - side * 0.5;
        for (const k of [1, 0]) {                                          // 먼 것부터
          const z0 = pd * 0.12 + k * L.wid * 2.2;
          add('lounger', 'stand', P(xc, z0).y, { xc, gy: pgy, z0, toPool, tone: choice.sky === 'violet' ? 'night' : choice.sky === 'dusk' ? 'dusk' : 'day' });
        }
      }
      // 옆 갑판 안쪽 귀퉁이에 용설란 화분 하나
      if (rqt() < 0.6) {
        const dist = spec.view.dist, z = pd * Q(0.78, 0.9), f = dist / (dist + z);
        const xw = loungeRight ? px + pw + m + side * Q(0.55, 0.8) : px - m - side * Q(0.55, 0.8);
        const pt = { x: spec.view.vpX + (xw - spec.view.vpX) * f, y: horizonY + (pgy - horizonY) * f };
        const pot = { w: 46 * f, h: 40 * f };
        plantAt('agave', pt.x, pt.y, 210 * f, { pot });
      }
      if (rt() < 0.6) add('wall', 'stand', fgY, { seed: childSeed(), x: px + pw + J(30, 80), groundY: fgY, length: W, height: 70 * sAt(fgY), dir: 'x' });
      if (theme === 'poolside' && rt() < 0.7) add('wall', 'stand', fgY, { seed: childSeed(), x: -W * 0.3, groundY: fgY, length: px + W * 0.3 - J(30, 80), height: 70 * sAt(fgY), dir: 'x' });
    } else if (choice.foreground === 'wall') {
      const fromLeft = focalX > W / 2;
      const x0 = fromLeft ? -W * 0.2 : W * J(0.45, 0.6), x1 = fromLeft ? W * J(0.4, 0.55) : W * 1.2;
      const color = ['#f0b3a8', '#f4c6c0', '#f2e6da'][Math.floor(rp() * 3)];
      add('wall', 'stand', fgY, { seed: childSeed(), x: x0, groundY: fgY, length: x1 - x0, height: 75 * sAt(fgY), dir: 'x', color });
      add('wall', 'stand', fgY - 0.5, { seed: childSeed(), x: fromLeft ? x1 - 40 * sAt(fgY) : x0, groundY: fgY, length: J(120, 200), thickness: 40 * sAt(fgY), height: 75 * sAt(fgY), dir: 'z', color });
      if (rp() < 0.7) bushAt(fromLeft ? x1 + J(40, 120) : x0 - J(40, 120), fgY + J(10, 40), 0.9);
    } else if (choice.foreground === 'car') {
      carAt(awayFromFocal(0.3, 0.42), H * J(0.86, 0.92));
    }
  }

  if (theme === 'coastRoad') {
    const roadTop = landTop + J(14, 26), roadH = (H - horizonY) * J(0.16, 0.22);
    add('road', 'flat', roadTop, { y: roadTop, h: roadH, colors: GP });
    add('lawn', 'flat', roadTop + roadH, { x0: -W * 0.5, x1: W * 1.5, y: H, depth: H - roadTop - roadH - 6, color: GP.ground ?? GP.lawnFront, front: true });
    if (rt() < 0.6) add('wall', 'stand', roadTop - 1, { seed: childSeed(), x: -W * 0.2, groundY: roadTop - 1, length: W * 1.4, height: 55 * sAt(roadTop), thickness: 12, dir: 'x', color: '#f2e6da' });
    placePalms(choice.palms, [W * 0.04, W * 0.96], [roadTop - J(6, 14), roadTop - J(0, 4)]);
    if (choice.foreground === 'car') carAt(focalX + J(-40, 40), roadTop + roadH + (H - roadTop - roadH) * J(0.35, 0.55));   // 도로 아래 공터에 세운다
    if (rt() < 0.8) bushAt(awayFromFocal(0.02, 0.15), H * J(0.95, 1.02), 1.1);
    // 도로 아래 공터 가장자리 (주인공 쪽 끝)에 용설란·유카
    if (rqt() < 0.5) {
      const y = roadTop + roadH + (H - roadTop - roadH) * Q(0.3, 0.6), x = focalX < W / 2 ? W * Q(0.02, 0.09) : W * Q(0.91, 0.98);
      plantAt('agave', x, y, 380 * sAt(y));
    }
    edgeTreeY = roadTop + roadH + (H - roadTop - roadH) * Q(0.15, 0.35);
  }
  if (edgeTreeY !== null && rqt() < 0.55) edgeTree(edgeTreeY);

  return spec;
}

/* ═════════ 2) 명세 → 객체 + 그리는 순서 ═════════ */

function windAt(t, x, strength, dir) {
  const tt = t - dir * x / 500;
  const g = 0.55 + 0.3 * Math.sin(tt * 0.6) + 0.2 * Math.sin(tt * 1.7 + 1.3) + 0.1 * Math.sin(tt * 3.9 + 0.4);
  return dir * strength * g;
}

// 종류별: 움직이는지, 만드는 법, 그리는 법
// 파도 거품: 작은 원 세 겹의 거품 띠를 파도마다 한 번만 그려 두고, 매 프레임 세로 조각으로 잘라 높이만 눌러 붙인다
// (원 ~1700개를 매 프레임 찍는 것보다 훨씬 가볍다)
const FOAM_TEX = { res: 2, slice: 12, left: 0.3, span: 1.6, above: 1.15, below: 2 };   // 해상도 배율, 조각 폭, 띠 범위(화면 폭 비율), 위·아래 여유
function buildFoamTexture(o, it, W) {
  const F = FOAM_TEX, hw = it.hw, top = hw * 0.95, y0 = hw * F.above;             // 띠 안 좌표: 수면 y0
  const c = document.createElement('canvas');
  c.width = Math.ceil(W * F.span * F.res); c.height = Math.ceil((hw * F.above + F.below) * F.res);
  const g = c.getContext('2d');
  g.scale(F.res, F.res); g.translate(W * F.left, 0);                                // 세계 x → 띠 x
  const x0 = -W * F.left, x1 = x0 + W * F.span;
  g.fillStyle = '#c6dcf2'; g.fillRect(x0, y0 - top * 0.55, x1 - x0, top * 0.55 + F.below);   // 연하늘 그림자
  g.fillStyle = '#f3f7fb'; g.fillRect(x0, y0 - top * 0.62, x1 - x0, top * 0.62 - hw * 0.15); // 흰 바탕
  const step = Math.max(2, hw * 0.09);
  g.beginPath();
  for (let i = Math.floor(x0 / step); i <= Math.ceil(x1 / step); i++) {
    for (let layer = 0; layer < 3; layer++) {
      const b = o.bumps[(((i * 3 + layer) % 1200) + 1200) % 1200], r = hw * b.r;
      const cy = y0 - top * (0.66 - layer * 0.18 + (b.dy - 0.5) * 0.14), cx = i * step + b.dx * step;
      g.moveTo(cx + r, cy); g.arc(cx, cy, r, 0, Math.PI * 2);
    }
  }
  g.fill();
  return c;
}

const SCENE_KINDS = {
  sky: {
    create: () => null,
    draw: (ctx, o, it, W) => {
      const g = ctx.createLinearGradient(0, 0, 0, it.horizonY);
      g.addColorStop(0, it.colors[0]); g.addColorStop(0.7, it.colors[1]); g.addColorStop(1, it.colors[2]);
      ctx.fillStyle = g; ctx.fillRect(-W * 2, -W * 2, W * 5, it.horizonY + W * 2);
    },
  },
  skyline: { create: (it) => createSkyline(it), draw: (ctx, o, it) => drawSkyline(ctx, o, it.x, it.y) },
  island: {
    create: () => null,
    draw: (ctx, o, it) => {
      ctx.fillStyle = '#1e3a35';
      ctx.beginPath();
      ctx.ellipse(it.x, it.y, it.w / 2, it.h, 0, Math.PI, 0);
      ctx.fill();
      for (let i = 0; i < 6; i++) { const cx = it.x - it.w * 0.35 + (i / 5) * it.w * 0.7; ctx.beginPath(); ctx.arc(cx, it.y - it.h * 0.7, it.h * 0.6, 0, Math.PI * 2); ctx.fill(); }
    },
  },
  sea: {
    dynamic: true,
    create: (it) => createSea({ seed: it.seed, x: 0, width: it.width, horizonY: it.horizonY, shoreY: it.shoreY, foamThickness: it.foamThickness, lineCount: it.lineCount, perspective: it.perspective, night: it.night, lights: it.lights, noFoam: it.noFoam }),
    draw: (ctx, o, it, W, t, wind) => {
      for (const ox of [-W, 0, W]) { o.x = ox; drawSea(ctx, o, { time: t, wind: wind(W / 2) }); }
      o.x = 0;
    },
  },
  ground: { create: () => null, draw: (ctx, o, it, W) => { ctx.fillStyle = it.color; ctx.fillRect(-W * 2, it.y, W * 5, W * 2); } },
  lawn: {
    create: () => null,
    draw: (ctx, o, it) => {
      const y = it.y, z0 = 0, z1 = it.depth;
      if (it.front) fillPoly(ctx, [{ x: it.x0, y: y - it.depth }, { x: it.x1, y: y - it.depth }, { x: it.x1, y }, { x: it.x0, y }], it.color);
      else fillPoly(ctx, [persp(it.x0, y, z0), persp(it.x1, y, z0), persp(it.x1, y, z1), persp(it.x0, y, z1)], it.color);
    },
  },
  road: {
    create: () => null,
    draw: (ctx, o, it, W) => {
      const c = it.colors ?? GROUND_PALETTES.sand;
      ctx.fillStyle = c.road; ctx.fillRect(-W * 2, it.y, W * 5, it.h);
      ctx.fillStyle = c.roadEdge; ctx.fillRect(-W * 2, it.y, W * 5, 3); ctx.fillRect(-W * 2, it.y + it.h - 3, W * 5, 3);
      ctx.fillStyle = c.roadDash;
      for (let x = -W; x < W * 2; x += 110) ctx.fillRect(x, it.y + it.h * 0.52, 60, Math.max(2, it.h * 0.04));
    },
  },
  breakingWave: {
    // (거품은 한 번 그려 둔 띠를 잘라 붙인다 — buildFoamTexture)
    // 부서지는 파도 (참고: 나가이의 해변): 말리기 전엔 가는 흰 마루선 + 파도 면의 물보라 점,
    // 말리는 곳은 짙은 파란 벽 위로 흰 입술, 부서진 쪽은 울퉁불퉁한 흰 거품 덩어리 + 연하늘 그림자 + 물보라.
    // 파도마다 A자(정점에서 양쪽으로 갈라져 부서짐) 50% / 왼쪽 25% / 오른쪽 25%. 말리는 곳이 마루를 따라 옆으로 옮겨 가고,
    // 한 파도가 끝나면 사라졌다가 다음 파도가 자란다
    dynamic: true,
    create: (it) => {
      const r = mulberry32(it.seed), bumps = [], spray = [], face = [], crest = [];
      // 거품: 작은 원이 여러 겹 (세계 x 에 붙은 자리마다)
      for (let i = 0; i < 1200; i++) bumps.push({ r: lerp(0.05, 0.16, r()), dy: r(), dx: r() - 0.5 });
      // 마루선: 짧은 획·점이 불규칙하게 (세계 x 기준, 화면 폭의 3배 길이)
      for (let x = 0; x < it.width * 3;) { const len = r() < 0.35 ? lerp(1, 2.5, r()) : lerp(3, 11, r()); crest.push({ x, len }); x += len + lerp(1, 7, r()); }
      for (let i = 0; i < 70; i++) spray.push({ s: lerp(-0.3, 2.2, r()), h: r(), size: lerp(0.5, 1.4, r()), phase: r() * 6.28, freq: lerp(1.5, 4, r()) });
      for (let i = 0; i < 60; i++) face.push({ s: lerp(-3.2, -0.15, r()), dy: (r() - 0.5) * 0.12, size: lerp(0.5, 1.1, r()), phase: r() * 6.28, freq: lerp(1, 3, r()) });
      return { bumps, spray, face, crest };
    },
    draw: (ctx, o, it, W, t) => {
      const C = { face: '#1f62bd', faceDeep: '#174c9e', tube: '#0f3b86', lip: '#f6f9fc', foam: '#f3f7fb', foamShade: '#c6dcf2', crest: '#eaf3fb' };
      const cyc = (t + it.phase) / it.period, n = Math.floor(cyc), p = cyc - n;
      const A = smoothstep(0, 0.12, p) * (1 - smoothstep(0.86, 1, p));       // 한 파도의 자라남·사라짐
      if (A <= 0.01) return;
      // 파도마다 모양을 고른다: A자(가운데서 양쪽으로) 50% · 왼쪽으로 25% · 오른쪽으로 25%
      const h = hashSeed((it.seed ^ Math.imul(n + 7, 0x9e3779b1)) | 0), u = (h % 1000) / 1000;
      const kind = u < 0.5 ? 'A' : u < 0.75 ? 'L' : 'R', Hw = it.hw * A, y0 = it.y0;
      // 말리는 곳: dir = 거품이 있는 쪽 (+1 오른쪽, -1 왼쪽)
      let curls, zone;                                                         // zone = 거품 구간 [왼, 오]
      if (kind === 'A') {
        const peak = W * (0.25 + 0.5 * ((h >>> 10) % 1000) / 1000), spread = lerp(0, W * 0.9, p);
        curls = [{ x: peak - spread, dir: 1 }, { x: peak + spread, dir: -1 }];
        zone = [peak - spread, peak + spread];
      } else if (kind === 'L') {
        const x = lerp(W * 1.2, -W * 0.25, p); curls = [{ x, dir: 1 }]; zone = [x, W * 3];
      } else {
        const x = lerp(-W * 0.2, W * 1.25, p); curls = [{ x, dir: -1 }]; zone = [-W * 2, x];
      }
      const ramp = W * 0.4, hU = (sv) => Hw * lerp(0.1, 1, smoothstep(-ramp, 0, sv));
      const s0 = Hw * 0.32;
      const foamDist = (x) => { let d = Infinity; for (const c of curls) { const sv = (x - c.x) * c.dir; if (sv >= 0) d = Math.min(d, sv); } return d; };
      const foamTop = (d) => Hw * (0.95 - 0.4 * smoothstep(0, W * 0.7, d));
      ctx.save();
      ctx.beginPath(); ctx.rect(-W, it.top, W * 3, it.bottom - it.top); ctx.clip();
      const g = ctx.createLinearGradient(0, y0 - Hw, 0, y0);
      g.addColorStop(0, C.face); g.addColorStop(1, C.faceDeep);
      // 1) 말리기 전 파도 면 + 튜브 + 흰 입술 (말리는 곳마다)
      for (const c of curls) {
        const X = (sv) => c.x + c.dir * sv;
        ctx.fillStyle = g; ctx.beginPath();
        ctx.moveTo(X(-W * 1.5), y0 + 1);
        for (let sv = -W * 1.5; sv <= 0; sv += 8) ctx.lineTo(X(sv), y0 - hU(sv));
        ctx.quadraticCurveTo(X(Hw * 0.36), y0 - Hw * 1.02, X(Hw * 0.4), y0 - Hw * 0.2);
        ctx.lineTo(X(Hw * 0.34), y0 + 1); ctx.closePath(); ctx.fill();
        ctx.fillStyle = C.tube; ctx.beginPath();
        ctx.moveTo(X(-Hw * 0.05), y0 - Hw * 0.92);
        ctx.quadraticCurveTo(X(Hw * 0.3), y0 - Hw * 0.9, X(Hw * 0.36), y0 - Hw * 0.25);
        ctx.lineTo(X(Hw * 0.3), y0 + 1); ctx.lineTo(X(-Hw * 0.12), y0 + 1);
        ctx.quadraticCurveTo(X(-Hw * 0.02), y0 - Hw * 0.5, X(-Hw * 0.05), y0 - Hw * 0.92);
        ctx.fill();
      }
      // 2) 마루선: 짧은 획·점이 불규칙하게 (말리기 전 구간에만)
      ctx.strokeStyle = C.crest; ctx.lineWidth = Math.max(1.1, Hw * 0.07); ctx.lineCap = 'round';
      ctx.beginPath();
      const crestY = (x) => { for (const c of curls) { const sv = (x - c.x) * c.dir; if (sv <= -Hw * 0.15 && sv > -W * 1.5 && !(x > zone[0] && x < zone[1])) return y0 - hU(sv); } return null; };
      for (const cs of o.crest) {
        const x = cs.x - W, ya = crestY(x), yb = crestY(x + cs.len);
        if (ya == null || yb == null) continue;
        ctx.moveTo(x, ya); ctx.lineTo(x + cs.len, yb);
      }
      ctx.stroke();
      // 3) 흰 입술
      ctx.strokeStyle = C.lip; ctx.lineWidth = Math.max(2, Hw * 0.13);
      for (const c of curls) {
        const X = (sv) => c.x + c.dir * sv;
        ctx.beginPath(); ctx.moveTo(X(-Hw * 0.25), y0 - Hw * 0.98);
        ctx.quadraticCurveTo(X(Hw * 0.34), y0 - Hw * 1.05, X(Hw * 0.4), y0 - Hw * 0.22); ctx.stroke();
      }
      // 4) 거품 구간 (연하늘 그림자 + 흰 바탕 + 작은 원 세 겹, 말리는 곳에서 멀수록 낮아짐)
      const xa = Math.max(zone[0], -W * 0.2), xb = Math.min(zone[1], W * 1.2);
      if (xb > xa) {
        // 미리 그려 둔 거품 띠(세계 x 기준)를 세로 조각으로 잘라, 조각마다 높이만 눌러 붙인다
        const tex = o.foamTex || (o.foamTex = buildFoamTexture(o, it, W)), F = FOAM_TEX;
        const full = it.hw * 0.95, Ht = it.hw * F.above + F.below;
        for (let x = Math.floor(xa / F.slice) * F.slice; x < xb; x += F.slice) {
          let x0 = Math.max(x, xa), x1 = Math.min(x + F.slice, xb);
          // 거품이 시작되는 자리(말리는 곳 + s0)에서 조각을 정확히 자른다 → 시작점이 조각 폭만큼 건너뛰지 않고 매끄럽게 따라간다
          for (const c of curls) {
            const edge = c.x + c.dir * s0;
            if (c.dir > 0 && x0 < edge && x1 > edge) x0 = edge;
            if (c.dir < 0 && x0 < edge && x1 > edge) x1 = edge;
          }
          if (x1 - x0 < 0.5) continue;
          const d = foamDist((x0 + x1) / 2);
          if (d < s0) continue;
          const vs = foamTop(d) / full, h = Ht * vs;                          // foamTop 에 자라남·사라짐(A)도 들어 있다
          const wob = Math.sin(t * 1.4 + x * 0.05) * it.hw * 0.02 * A;        // 조각마다 살짝 일렁임
          ctx.drawImage(tex, (x0 + W * F.left) * F.res, 0, (x1 - x0) * F.res, Ht * F.res, x0, y0 + F.below - h + wob, x1 - x0 + 0.6, h);
        }
      }
      // 5) 물보라 점: 말리는 곳마다 입술·거품 위, 그리고 말리기 전 파도 면에 한 줄
      ctx.fillStyle = '#ffffff';
      for (const c of curls) {
        const X = (sv) => c.x + c.dir * sv;
        for (const d of o.spray) {
          const tw = Math.sin(t * d.freq + d.phase); if (tw < 0) continue;
          const sv = d.s * Hw, x = X(sv);
          if (sv > 0 && !(x > zone[0] - 1 && x < zone[1] + 1)) continue;
          const top = sv < 0 ? Hw : foamTop(sv);
          ctx.globalAlpha = tw * A;
          ctx.beginPath(); ctx.arc(x, y0 - top * 0.95 - d.h * Hw * 0.55, d.size * Math.max(1, Hw * 0.05), 0, Math.PI * 2); ctx.fill();
        }
        for (const d of o.face) {
          const tw = Math.sin(t * d.freq + d.phase); if (tw < 0.2) continue;
          const sv = d.s * Hw, x = X(sv);
          if (x > zone[0] && x < zone[1]) continue;
          ctx.globalAlpha = tw * A * smoothstep(-3.2 * Hw, -1 * Hw, sv);
          ctx.beginPath(); ctx.arc(x, y0 - hU(sv) * (0.35 + d.dy), d.size * Math.max(0.8, Hw * 0.04), 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    },
  },
  lounger: {
    // 선베드: 거의 실루엣 — 길쭉한 판 + 수영장 반대쪽 끝에서 비스듬히 들린 등받이 + 진한 그림자.
    // 긴 쪽은 화면과 나란히(수영장을 향해), 크기는 LOUNGER 고정 치수. 색은 하늘에 맞춘 흰색 한두 단계
    create: () => null,
    draw: (ctx, o, it) => {
      const C = { day: ['#ffffff', '#dfe4ec'], dusk: ['#fff3f5', '#e9cbd4'], night: ['#e6e3f4', '#bfbad9'] }[it.tone || 'day'];
      const L = LOUNGER, { xc, gy, z0, toPool } = it, z1 = z0 + L.wid;
      const xFoot = xc + toPool * L.len / 2, xEnd = xc - toPool * L.len / 2, xBack = xEnd + toPool * L.len * L.back;
      const Q = (x, y, z) => persp(x, gy - y, z);
      const sh = (x, y, z) => { const p = persp(x, gy, z), so = shadowOffset(y); return { x: p.x + so.dx * perspScale(z), y: p.y + so.dy * perspScale(z) }; };
      ctx.fillStyle = withAlpha(SHADOW_COLOR, 0.42);
      fillPoly(ctx, convexHull([sh(xFoot, L.h, z0), sh(xFoot, L.h, z1), sh(xBack, L.h, z0), sh(xBack, L.h, z1), sh(xEnd, L.rise, z0), sh(xEnd, L.rise, z1)])); ctx.fill();
      // 판: 윗면 + 화면 쪽 두께
      fillPoly(ctx, [Q(xFoot, L.h, z0), Q(xBack, L.h, z0), Q(xBack, L.h, z1), Q(xFoot, L.h, z1)], C[0]);
      fillPoly(ctx, [Q(xFoot, L.h, z0), Q(xBack, L.h, z0), Q(xBack, L.h * 0.45, z0), Q(xFoot, L.h * 0.45, z0)], C[1]);
      // 등받이: 비스듬한 판 + 화면 쪽 옆면
      fillPoly(ctx, [Q(xBack, L.h, z0), Q(xBack, L.h, z1), Q(xEnd, L.rise, z1), Q(xEnd, L.rise, z0)], C[0]);
      fillPoly(ctx, [Q(xBack, L.h * 0.45, z0), Q(xBack, L.h, z0), Q(xEnd, L.rise, z0), Q(xEnd, L.rise - L.h * 0.55, z0)], C[1]);
    },
  },
  cityLights: {
    create: (it) => {
      const rnd = mulberry32(it.seed), dots = [], rows = [];
      for (let v = 0; v < 1;) { rows.push(v); v += lerp(0.035, 0.08, rnd()) * (0.4 + v); }
      for (const v of rows) {
        const y = lerp(it.y0, it.y1, v), r = lerp(0.6, 1.7, v), gap = lerp(3, 9, v);
        for (let x = rnd() * gap; x < it.width; x += gap * lerp(0.6, 1.8, rnd())) {
          if (rnd() < 0.12) { x += gap * lerp(3, 9, rnd()); continue; }                      // 길·공터
          dots.push({ x, y: y + (rnd() - 0.5) * gap * 0.3, r: r * lerp(0.7, 1.2, rnd()), c: rnd() < 0.78 ? 0 : rnd() < 0.6 ? 1 : 2 });
        }
      }
      // 큰길: 소실점(수평선) 쪽에서 아래로 퍼지는 불빛 줄
      const vx = it.vpX ?? it.width / 2, roads = 7;
      for (let k = 0; k < roads; k++) {
        const endX = lerp(-it.width * 0.6, it.width * 1.6, (k + 0.3 + rnd() * 0.4) / roads);
        for (let v = 0.04; v < 1; v += lerp(0.012, 0.03, v)) {
          const y = lerp(it.y0, it.y1, v), x = lerp(vx, endX, v);
          dots.push({ x, y, r: lerp(0.5, 1.6, v), c: rnd() < 0.7 ? 0 : 2 });
        }
      }
      return { dots };
    },
    draw: (ctx, o, it, W) => {
      const g = ctx.createLinearGradient(0, it.y0, 0, it.y1);
      g.addColorStop(0, '#1b2160'); g.addColorStop(1, '#0d1238');
      ctx.fillStyle = g; ctx.fillRect(-W * 2, it.y0, W * 5, it.y1 - it.y0);
      const cols = ['#ffdf6e', '#fff4c8', '#ffb0c0'];
      for (let k = 0; k < 3; k++) {
        ctx.fillStyle = cols[k]; ctx.beginPath();
        for (const d of o.dots) if (d.c === k) { ctx.moveTo(d.x + d.r, d.y); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); }
        ctx.fill();
      }
    },
  },
  pool: { dynamic: true, create: (it) => createPool(it), draw: (ctx, o, it, W, t, wind) => drawPool(ctx, o, { time: t, wind }) },
  palm: {
    dynamic: true,
    create: (it) => createPalm({ seed: it.seed, height: it.height, lean: it.lean, bow: it.bow, frondLength: it.frondLength, palette: it.palette }),
    draw: (ctx, o, it, W, t, wind) => {
      drawPalmShadow(ctx, o, it.x, it.y, { time: t, wind: wind(it.x) });
      drawPalm(ctx, o, it.x, it.y, { time: t, wind: wind(it.x) });
    },
  },
  house: { create: (it) => createHouse(it), draw: (ctx, o) => drawHouse(ctx, o) },
  wall: { create: (it) => createWall(it), draw: (ctx, o) => drawWall(ctx, o) },
  bush: { create: (it) => createBush(it), draw: (ctx, o, it) => drawBush(ctx, o, it.x, it.y) },
  tree: { create: (it) => createRoundTree(it), draw: (ctx, o, it) => drawRoundTree(ctx, o, it.x, it.y) },
  agave: { create: (it) => createAgave(it), draw: (ctx, o, it) => drawAgave(ctx, o, it.x, it.y) },
  car: { create: (it) => createCar({ ...it, view: '3/4' }), draw: (ctx, o, it) => drawCar(ctx, o, it.x, it.y) },
};

function buildScene(spec) {
  setSceneView(spec.view);
  setSceneLight(spec.light.x, spec.light.sunHeight);
  const phase = { back: 0, sea: 1, flat: 2, pool: 3, stand: 4 };
  const items = spec.items
    .map((it, i) => ({ it, i, obj: SCENE_KINDS[it.kind].create(it), dynamic: !!SCENE_KINDS[it.kind].dynamic }))
    .sort((a, b) => phase[a.it.phase] - phase[b.it.phase] || a.it.y - b.it.y || a.i - b.i);
  // 저녁 수영장은 장면의 다른 객체를 물에 비춰 그린다
  for (const x of items) if (x.it.kind === 'pool' && x.obj.night) { x.obj.scene = items; x.obj.sceneWidth = spec.width; }
  // 연속된 정적 객체끼리 묶는다 → 묶음 하나 = 구워둘 캔버스 하나
  const runs = [];
  for (const x of items) {
    const last = runs[runs.length - 1];
    if (last && last.dynamic === x.dynamic) last.items.push(x);
    else runs.push({ dynamic: x.dynamic, items: [x] });
  }
  return { spec, runs };
}

function drawRun(ctx, scene, run, t = 0, wind = () => 0) {
  const W = scene.spec.width;
  for (const x of run.items) SCENE_KINDS[x.it.kind].draw(ctx, x.obj, x.it, W, t, wind);
}

/* ═════════════════ NagaiScene.mount — 캔버스 + 컨트롤 묶음 ═════════════════ */

const NAGAI_CTL_CSS = `
.nagai-ctl{--nagai-fg:currentColor;--nagai-muted:color-mix(in srgb,currentColor 60%,transparent);--nagai-line:color-mix(in srgb,currentColor 22%,transparent);--nagai-accent:#2f66b8;
  display:flex;flex-direction:column;gap:8px;font:inherit;font-size:14px;color:var(--nagai-fg);margin:8px 0}
.nagai-ctl-info{color:var(--nagai-muted);font-size:13px}
.nagai-ctl-row{display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
.nagai-ctl button{font:inherit;color:inherit;background:transparent;border:1px solid var(--nagai-line);border-radius:8px;padding:4px 10px;cursor:pointer}
.nagai-ctl button:focus-visible,.nagai-ctl select:focus-visible,.nagai-ctl input:focus-visible{outline:2px solid var(--nagai-accent);outline-offset:2px}
.nagai-ctl label{display:flex;align-items:center;gap:6px;color:var(--nagai-muted);white-space:nowrap}
.nagai-ctl input[type=range]{width:110px;accent-color:var(--nagai-accent)}
.nagai-ctl-seed{color:var(--nagai-muted);white-space:nowrap}
.nagai-ctl-seed input{font:inherit;color:var(--nagai-fg);font-variant-numeric:tabular-nums;font-weight:600;background:transparent;border:1px solid var(--nagai-line);border-radius:8px;padding:3px 8px;max-width:min(60vw,320px)}
.nagai-ctl details summary{cursor:pointer}
.nagai-ctl-hint{margin:6px 0 8px;color:var(--nagai-muted);font-size:13px}
.nagai-ctl-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px 12px;margin-bottom:8px}
.nagai-ctl-grid label{flex-direction:column;align-items:stretch;gap:3px;font-size:13px;white-space:normal}
.nagai-ctl select{font:inherit;font-size:14px;color:inherit;background:transparent;border:1px solid var(--nagai-line);border-radius:8px;padding:4px 6px}
.nagai-ctl select.nagai-fixed{border-color:var(--nagai-accent);font-weight:600}
.nagai-ctl select option{color:#10223f;background:#fff}
.nagai-ctl-random{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.nagai-ctl-random-lbl{font-size:12px;letter-spacing:.08em;color:var(--nagai-muted);margin-right:4px}
.nagai-ctl .nagai-ctl-random button{background:var(--nagai-accent);border-color:var(--nagai-accent);color:#fff;font-weight:600;padding:6px 14px;border-radius:999px}
.nagai-ctl .nagai-ctl-random button:first-of-type{background:transparent;color:inherit;border-color:var(--nagai-line)}
.nagai-ctl-seg{display:inline-flex}
.nagai-ctl-seg button{border-radius:0}.nagai-ctl-seg button:first-child{border-radius:8px 0 0 8px}.nagai-ctl-seg button:last-child{border-radius:0 8px 8px 0;margin-left:-1px}
.nagai-ctl-seg button[aria-pressed=true]{background:var(--nagai-accent);border-color:var(--nagai-accent);color:#fff}
`;
function injectNagaiCss() {
  if (typeof document === 'undefined' || document.getElementById('nagai-ctl-style')) return;
  const s = document.createElement('style');
  s.id = 'nagai-ctl-style';
  s.textContent = NAGAI_CTL_CSS;
  document.head.appendChild(s);
}

const PICK_KEYS = ['theme', 'far', 'focal', 'foreground', 'buildings', 'palms', 'sky'];
// 화면 문구 (컨트롤·저장 창). mount 의 lang: 'ko' (기본) | 'en' | 'auto'
const NAGAI_TEXT = {
  ko: {
    randomGroup: '랜덤 장면', random: '랜덤', moods: ['아무거나', '맑은 오후', '해질녘', '저녁'],
    prevSeed: '이전 시드', nextSeed: '다음 시드', seed: '시드 ', seedTitle: '시드 또는 장면 코드 입력 후 Enter', seedAria: '시드 또는 장면 코드',
    newScene: '새 구도', copy: '복사', copyTitle: '이 장면을 다시 열 수 있는 링크(또는 장면 코드)를 복사', copied: '복사됨', selected: '선택됨',
    shuffle: '위치만 바꾸기', wind: '바람 ', pause: '일시정지', play: '재생',
    save: '사진 저장', saveTitle: '지금 장면을 고해상도 PNG 로 저장', saving: '저장 중…',
    palmGroup: '야자수 그리기', palms: '야자수 ', palmModes: ['가볍게', '잎마다'],
    palmTitles: ['잎을 미리 그려 두고 돌려 찍는다 (가벼움)', '잎줄기가 휘고 소엽이 떨린다 (무거움)'],
    aspectGroup: '화면 비율', aspects: ['가로', '모바일', '정사각'],
    pick: '상세 구도 고르기', pickHint: '자동은 시드대로, 고른 항목은 시드를 바꿔도 유지돼요', auto: '자동', allAuto: '모두 자동으로',
    pickKeys: { theme: '테마', far: '원경', focal: '주인공 위치', foreground: '전경', buildings: '건물', palms: '야자수', sky: '하늘' },
    langGroup: '언어', savedDialog: '저장한 사진', savedTip: '다운로드가 안 되면 사진을 길게 누르거나 우클릭해서 저장하세요', close: '닫기',
  },
  en: {
    randomGroup: 'Random scene', random: 'Random', moods: ['Any', 'Afternoon', 'Dusk', 'Evening'],
    prevSeed: 'Previous seed', nextSeed: 'Next seed', seed: 'Seed ', seedTitle: 'Type a seed or scene code, then press Enter', seedAria: 'Seed or scene code',
    newScene: 'New scene', copy: 'Copy', copyTitle: 'Copy a link (or scene code) that reopens this scene', copied: 'Copied', selected: 'Selected',
    shuffle: 'Shuffle layout', wind: 'Wind ', pause: 'Pause', play: 'Play',
    save: 'Save photo', saveTitle: 'Save this moment as a high-resolution PNG', saving: 'Saving…',
    palmGroup: 'Palm drawing', palms: 'Palms ', palmModes: ['Light', 'Per leaf'],
    palmTitles: ['Fronds drawn once and stamped (lighter)', 'Fronds bend and leaflets flutter (heavier)'],
    aspectGroup: 'Aspect ratio', aspects: ['Landscape', 'Mobile', 'Square'],
    pick: 'Choose composition', pickHint: 'Auto follows the seed; what you pick stays when you change the seed', auto: 'Auto', allAuto: 'All auto',
    pickKeys: { theme: 'Theme', far: 'Distance', focal: 'Subject', foreground: 'Foreground', buildings: 'Buildings', palms: 'Palms', sky: 'Sky' },
    langGroup: 'Language', savedDialog: 'Saved photo', savedTip: "If the download doesn't start, long-press or right-click the photo to save it", close: 'Close',
  },
};
// 'auto' → 주소의 ?lang= → 마지막으로 고른 언어 → 브라우저 언어 (한국어가 아니면 영어)
function resolveLang(v) {
  if (v === 'ko' || v === 'en') return v;
  if (v !== 'auto') return 'ko';
  try { const q = new URLSearchParams(location.search).get('lang'); if (q === 'ko' || q === 'en') return q; } catch (e) { /* 주소를 못 읽는 곳 */ }
  try { const st = localStorage.getItem('nagai-lang'); if (st === 'ko' || st === 'en') return st; } catch (e) { /* 저장소가 막힌 곳 */ }
  return typeof navigator !== 'undefined' && /^ko\b/i.test(navigator.language || '') ? 'ko' : 'en';
}
// 화면 비율: 세로는 설계 좌표 자체를 세로로 바꿔 구도를 새로 짠다
const ASPECTS = { '3:2': [1200, 800], '9:16': [720, 1280], '1:1': [1000, 1000] };
const EXPORT_SIZES = { '3:2': [2400, 1600], '9:16': [1440, 2560], '1:1': [3000, 3000] };   // 1:1 = 앨범 커버 (스트리밍 규격)

// 파일 저장: 저장 기능을 주는 곳(claude.ai 아티팩트의 downloads)이면 그걸로 (보는 사람이 확인 후 저장),
// 아니면 일반 다운로드. 다른 페이지 안(iframe)이면 다운로드가 막힐 수 있어 사진을 화면에 띄운다.
// 돌려주는 값: 'saved' | 'declined' | 'busy' | 'downloaded'
async function saveFile(blob, filename, lang = 'ko') {
  const dl = typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function'
    ? await window.claude.use('downloads').catch(() => null) : null;
  if (dl) {
    try { await dl.save({ filename, data: blob }); return 'saved'; }
    catch (e) {
      if (e && e.code === 'declined') return 'declined';
      if (e && e.code === 'rate_limited') return 'busy';
      /* 그 밖의 거절은 아래 방법으로 */
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  let framed = true;
  try { framed = window.top !== window; } catch (e) { /* 다른 출처의 iframe */ }
  if (framed && /^image\//.test(blob.type)) showSaved(url, filename, lang);
  else setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}

// 저장한 사진을 화면 위에 띄운다 (다운로드가 막힌 곳에서 길게 누르기·우클릭으로 저장)
function showSaved(url, name, lang = 'ko') {
  const L = NAGAI_TEXT[lang] || NAGAI_TEXT.ko;
  const wrap = document.createElement('div');
  wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', L.savedDialog);
  wrap.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(8,10,24,.86);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;padding:16px;box-sizing:border-box;font:14px system-ui,sans-serif;color:#fff';
  const img = new Image();
  img.src = url; img.alt = name;
  img.style.cssText = 'max-width:100%;max-height:calc(100% - 90px);object-fit:contain;border-radius:6px;box-shadow:0 8px 30px rgba(0,0,0,.5)';
  const tip = document.createElement('div');
  tip.textContent = L.savedTip;
  tip.style.cssText = 'text-align:center;opacity:.85';
  const close = document.createElement('button');
  close.textContent = L.close;
  close.style.cssText = 'font:inherit;color:#fff;background:transparent;border:1px solid rgba(255,255,255,.5);border-radius:8px;padding:6px 16px;cursor:pointer';
  const done = () => { wrap.remove(); URL.revokeObjectURL(url); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') done(); };
  close.onclick = done;
  wrap.onclick = (e) => { if (e.target === wrap) done(); };
  document.addEventListener('keydown', onKey);
  wrap.append(img, tip, close);
  document.body.appendChild(wrap);
  close.focus();
}

// 장면 코드: 장면 하나를 다시 만드는 데 필요한 모든 것을 한 줄로
//   "83608"  ·  "83608-12 9:16 sky:violet theme:resort"
//   시드[-위치] [비율] [고른 항목:값 …]   (빈칸으로 구분, 순서 무관)
function sceneCode({ seed, jitter, aspect, force }) {
  const parts = [String(seed) + (jitter != null ? `-${jitter}` : '')];
  if (aspect && aspect !== '3:2') parts.push(aspect);
  for (const [k] of PICK_KEYS) if (force && force[k] != null) parts.push(`${k}:${force[k]}`);
  return parts.join(' ');
}
function parseSceneCode(text) {
  const out = { force: {} };
  for (const tok of String(text || '').trim().split(/[\s,/+]+/)) {
    let m;
    if ((m = tok.match(/^(\d+)(?:-(\d+))?$/))) { out.seed = Math.max(1, +m[1]); out.jitter = m[2] != null ? +m[2] : null; }
    else if (ASPECTS[tok]) out.aspect = tok;
    else if ((m = tok.match(/^([a-z]+):(.+)$/)) && PICK_KEYS.some(([k]) => k === m[1])) out.force[m[1]] = m[2];
  }
  return out.seed ? out : null;
}

function mount(options = {}) {
  const o = {
    seed: 1, jitter: null, force: {}, wind: 0.6, windDir: null,
    autoplay: true, grain: true, maxPixelRatio: 2,
    designWidth: 1200, designHeight: 800,
    controls: null, ui: {}, extend: null, onChange: null,
    aspect: null,                             // '3:2' | '9:16' (주면 designWidth/Height 보다 우선)
    urlState: false,                          // true: 주소 끝(#nagai=장면코드)으로 장면을 열고, 바뀔 때마다 주소를 갱신
    palmDetail: false,                        // 야자수: false 가볍게(잎 도장, 기본) | true 잎마다(휘고 떨림, 무거움)
    fps: 30,                                  // 초당 그리는 횟수 (나가이 장면은 움직임이 느려 30 이면 충분, 발열·배터리 절약)
    exportSize: null,                         // 사진 저장 크기 { '3:2': [w, h], '9:16': [w, h] } (기본 2400×1600, 1440×2560)
    lang: 'ko',                               // 컨트롤 문구: 'ko' | 'en' | 'auto' (주소 ?lang= → 마지막 선택 → 브라우저 언어)
    ...options,
  };
  let lang = resolveLang(o.lang);
  const pageLang = o.lang === 'auto';        // auto 면 페이지 전체 언어로 보고 <html lang> 도 맞춘다
  const T = () => NAGAI_TEXT[lang];
  if (pageLang) try { document.documentElement.lang = lang; } catch (e) { /* 문서 없음 */ }
  let urlTouched = false, composedOnce = false;                     // 주소에 장면이 있었거나 사용자가 장면을 바꾼 뒤에만 주소를 고친다
  if (o.urlState) {                           // 주소에 장면 코드가 있으면 그 장면으로 시작
    try {
      const m = location.hash.match(/nagai=([^&]+)/), c = m && parseSceneCode(decodeURIComponent(m[1]));
      if (c) { Object.assign(o, { seed: c.seed, jitter: c.jitter, force: c.force, aspect: c.aspect || '3:2' }); urlTouched = true; }
    } catch (e) { /* 주소를 못 읽으면 기본값으로 */ }
  }
  if (o.aspect && ASPECTS[o.aspect]) [o.designWidth, o.designHeight] = ASPECTS[o.aspect];
  const pickEl = (v) => (typeof v === 'string' ? document.querySelector(v) : v);
  const canvas = pickEl(o.canvas);
  if (!canvas || !canvas.getContext) throw new Error('NagaiScene.mount: a canvas element is required (canvas 요소가 필요해요)');
  const ctx = canvas.getContext('2d');
  const controlsEl = pickEl(o.controls);
  const ui = { info: true, random: true, seed: true, jitter: true, wind: true, pause: true, pick: true, aspect: true, save: true, palm: true, lang: false, ...o.ui };
  const reduceMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { seed: o.seed, jitter: o.jitter, force: { ...o.force }, wind: o.wind, playing: o.autoplay && !reduceMotion, palmDetail: !!o.palmDetail };
  const grain = o.grain ? createGrain() : null;
  let scene = null, view = null, baked = [], t = 0, last = 0, raf = 0, onScreen = true, destroyed = false;

  // 캔버스 크기를 정하지 않았으면 라이브러리가 맡는다: 폭 100%, 설계 비율
  const ownsWidth = !canvas.style.width, ownsRatio = !canvas.style.height && !canvas.style.aspectRatio && !canvas.getAttribute('height');
  const aspectName = () => (o.designWidth < o.designHeight ? '9:16' : o.designWidth === o.designHeight ? '1:1' : '3:2');
  function applyAspectStyle() {
    canvas.dataset.aspect = aspectName();
    const tall = o.designWidth <= o.designHeight;          // 세로·정사각은 화면 높이에 맞춘다
    // 세로 장면이 넓은 화면에서 너무 길어지지 않게, 폭을 화면 높이의 80% 에 맞춘다
    if (ownsWidth) { canvas.style.width = tall ? `min(100%, calc(80vh * ${o.designWidth} / ${o.designHeight}))` : '100%'; canvas.style.marginInline = tall ? 'auto' : ''; }
    if (ownsRatio) canvas.style.aspectRatio = `${o.designWidth} / ${o.designHeight}`;
  }
  applyAspectStyle();
  canvas.style.display = 'block';

  // 한 페이지에 장면이 여러 개여도 서로의 빛·원근이 섞이지 않게, 그리기 직전마다 적용
  const applyEnv = () => { setSceneView(scene.spec.view); setSceneLight(scene.spec.light.x, scene.spec.light.sunHeight); PALM_DETAIL = state.palmDetail; };

  function computeView(W = canvas.width, H = canvas.height) {
    const k = Math.max(W / o.designWidth, H / o.designHeight);
    const narrow = W / H < (o.designWidth / o.designHeight) * 0.75;
    const fx = narrow ? scene.spec.view.vpX : o.designWidth / 2;
    return { W, H, k, ox: W / 2 - fx * k, oy: (H - o.designHeight * k) / 2 };
  }
  function bake() {
    if (!canvas.width || !canvas.height) return;
    applyEnv();
    view = computeView();
    baked = scene.runs.map((run) => {
      if (run.dynamic) return null;
      const c = document.createElement('canvas');
      c.width = view.W; c.height = view.H;
      const g = c.getContext('2d');
      g.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);
      drawRun(g, scene, run);
      return c;
    });
  }
  function draw() {
    if (!view) return;
    applyEnv();
    const dir = o.windDir ?? (scene.spec.light.x < 0 ? 1 : -1);
    const wind = (x) => windAt(t, x, state.wind, dir);
    scene.runs.forEach((run, i) => {
      if (baked[i]) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(baked[i], 0, 0); }
      else { ctx.setTransform(view.k, 0, 0, view.k, view.ox, view.oy); drawRun(ctx, scene, run, t, wind); }
    });
    if (grain) drawGrain(ctx, grain, view.W, view.H);
  }
  // 지금 순간을 W×H 새 캔버스에 통째로 그린다 (사진 저장용, 화면 캔버스와 별개)
  function renderTo(W, H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    applyEnv();
    const v = computeView(W, H);
    const dir = o.windDir ?? (scene.spec.light.x < 0 ? 1 : -1);
    const wind = (x) => windAt(t, x, state.wind, dir);
    for (const run of scene.runs) { g.setTransform(v.k, 0, 0, v.k, v.ox, v.oy); drawRun(g, scene, run, t, wind); }
    // 그레인은 화면에서 보던 결 그대로: 저장 그림이 화면 캔버스보다 큰 배율만큼 알갱이를 키운다
    if (grain) drawGrain(g, grain, W, H, view ? Math.max(1, v.k / view.k) : 1);
    return c;
  }
  const canRun = () => state.playing && onScreen && !document.hidden && !destroyed;
  // 초당 o.fps 번만 그린다 (기본 30). 움직임은 실제 흐른 시간으로 계산하므로 속도는 그대로, 그리는 횟수만 준다
  const frameMs = 1000 / Math.max(1, o.fps || 60);
  function loop(now) {
    raf = 0;
    if (!canRun()) return;
    if (last && now - last < frameMs - 2) { raf = requestAnimationFrame(loop); return; }   // 아직 차례가 아니면 건너뛴다
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    t += dt;
    draw();
    raf = requestAnimationFrame(loop);          // 다음 프레임 (시간 기준점은 유지)
  }
  // 멈춰 있다가 다시 시작할 때만 호출. 시간 기준점을 새로 잡아서 멈춘 동안의 시간이 한꺼번에 흐르지 않게 한다
  function schedule() {
    if (!raf && canRun()) { last = 0; raf = requestAnimationFrame(loop); }
  }
  function compose() {
    let spec = composeScene(state.seed, { jitter: state.jitter ?? undefined, force: state.force, width: o.designWidth, height: o.designHeight });
    if (o.extend) spec = o.extend(spec, { lerp, mulberry32, persp }) || spec;
    scene = buildScene(spec);
    bake();
    draw();
    renderUI();
    if (scene && composedOnce) urlTouched = true;
    composedOnce = true;
    if (o.urlState && urlTouched) {            // 주소를 지금 장면으로 (기록은 쌓지 않는다)
      try { history.replaceState(null, '', '#nagai=' + encodeURIComponent(api.code).replace(/%20/g, '+').replace(/%3A/g, ':')); } catch (e) { /* 막힌 환경 */ }
    }
    if (o.onChange) o.onChange(api.state);
  }
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(o.maxPixelRatio, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (w === canvas.width && h === canvas.height && view) return;
    canvas.width = w; canvas.height = h;
    if (scene) { bake(); draw(); }
  }

  // ── 컨트롤 UI
  const el = {};
  function buildUI() {
    if (!controlsEl) return;
    injectNagaiCss();
    controlsEl.classList.add('nagai-ctl');
    controlsEl.innerHTML = '';
    const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    if (ui.info) { el.info = mk('div', 'nagai-ctl-info'); el.info.setAttribute('aria-live', 'polite'); controlsEl.appendChild(el.info); }
    if (ui.random) {
      const g = mk('div', 'nagai-ctl-random'); g.setAttribute('role', 'group'); g.setAttribute('aria-label', T().randomGroup);
      g.appendChild(mk('span', 'nagai-ctl-random-lbl', T().random));
      [null, 'day', 'dusk', 'evening'].forEach((mood, i) => {
        const b = mk('button', null, T().moods[i]);
        b.onclick = () => (mood ? api.randomMood(mood) : api.randomize());
        g.appendChild(b);
      });
      controlsEl.appendChild(g);
    }
    const row = mk('div', 'nagai-ctl-row');
    if (ui.seed) {
      const prev = mk('button', null, '◀'); prev.setAttribute('aria-label', T().prevSeed); prev.onclick = () => api.prev();
      // 장면 코드 입력칸: 숫자만 넣어도 되고, 복사한 코드를 통째로 붙여넣어도 된다
      el.seed = document.createElement('input');
      Object.assign(el.seed, { type: 'text', inputMode: 'text', spellcheck: false, autocomplete: 'off', title: T().seedTitle });
      el.seed.setAttribute('aria-label', T().seedAria);
      const applyCode = () => { if (!api.setCode(el.seed.value)) renderUI(); };
      el.seed.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); el.seed.blur(); applyCode(); } };
      el.seed.onchange = applyCode;
      const seedWrap = mk('label', 'nagai-ctl-seed', T().seed); seedWrap.appendChild(el.seed);
      const next = mk('button', null, '▶'); next.setAttribute('aria-label', T().nextSeed); next.onclick = () => api.next();
      const rnd = ui.random ? null : mk('button', null, T().newScene);         // 랜덤 그룹이 있으면 거기로
      if (rnd) rnd.onclick = () => api.randomize();
      const copy = mk('button', null, T().copy);
      copy.title = T().copyTitle;
      copy.onclick = async () => {
        const text = api.shareText();
        let ok = false;
        try { await navigator.clipboard.writeText(text); ok = true; } catch (e) { /* 클립보드가 막힌 곳 */ }
        if (!ok) { el.seed.value = api.code; el.seed.select(); }        // 직접 복사할 수 있게 선택해 둔다
        copy.textContent = ok ? T().copied : T().selected;
        setTimeout(() => { copy.textContent = T().copy; }, 1400);
      };
      row.append(...[prev, seedWrap, next, rnd, copy].filter(Boolean));
    }
    if (ui.jitter) { const b = mk('button', null, T().shuffle); b.onclick = () => api.shuffleLayout(); row.appendChild(b); }
    controlsEl.appendChild(row);
    const row2 = mk('div', 'nagai-ctl-row');
    if (ui.wind) {
      const lab = mk('label', null, T().wind);
      const r = document.createElement('input');
      Object.assign(r, { type: 'range', min: 0, max: 1.5, step: 0.05, value: state.wind });
      r.oninput = () => api.setWind(+r.value);
      lab.appendChild(r); row2.appendChild(lab);
    }
    if (ui.pause) { el.pause = mk('button'); el.pause.onclick = () => api.toggle(); row2.appendChild(el.pause); }
    if (ui.save) {
      const b = mk('button', null, T().save);
      b.title = T().saveTitle;
      b.onclick = async () => { b.disabled = true; b.textContent = T().saving; try { await api.savePNG(); } finally { b.disabled = false; b.textContent = T().save; } };
      row2.appendChild(b);
    }
    if (ui.palm) {
      const seg = mk('span', 'nagai-ctl-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', T().palmGroup);
      const lab = mk('span', 'nagai-ctl-seed', T().palms);
      el.palm = {};
      for (const v of [false, true]) {
        const b = mk('button', null, T().palmModes[+v]);
        b.title = T().palmTitles[+v];
        b.onclick = () => api.setPalmDetail(v);
        el.palm[v] = b; seg.appendChild(b);
      }
      const wrap = mk('span'); wrap.style.cssText = 'display:inline-flex;align-items:center;gap:6px'; wrap.append(lab, seg);
      row2.appendChild(wrap);
    }
    if (ui.aspect) {
      const seg = mk('span', 'nagai-ctl-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', T().aspectGroup);
      el.aspect = {};
      ['3:2', '9:16', '1:1'].forEach((a, i) => {
        const b = mk('button', null, T().aspects[i]); b.onclick = () => api.setAspect(a);
        el.aspect[a] = b; seg.appendChild(b);
      });
      row2.appendChild(seg);
    }
    if (ui.lang) {                              // 언어 전환 (한 | EN)
      const seg = mk('span', 'nagai-ctl-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', T().langGroup);
      el.lang = {};
      for (const [v, name] of [['ko', '한'], ['en', 'EN']]) {
        const b = mk('button', null, name); b.lang = v; b.onclick = () => api.setLang(v);
        el.lang[v] = b; seg.appendChild(b);
      }
      row2.appendChild(seg);
    }
    if (row2.childNodes.length) controlsEl.appendChild(row2);
    if (ui.pick) {
      const det = mk('details');
      det.appendChild(mk('summary', null, T().pick));
      det.appendChild(mk('p', 'nagai-ctl-hint', T().pickHint));
      const grid = mk('div', 'nagai-ctl-grid');
      el.selects = {};
      for (const key of PICK_KEYS) {
        const lab = mk('label', null, T().pickKeys[key]);
        const sel = document.createElement('select');
        sel.onchange = () => api.setForce({ [key]: sel.value === '' ? null : sel.value });
        lab.appendChild(sel); grid.appendChild(lab);
        el.selects[key] = sel;
      }
      det.appendChild(grid);
      const reset = mk('button', null, T().allAuto); reset.onclick = () => api.clearForce();
      det.appendChild(reset);
      controlsEl.appendChild(det);
    }
  }
  function renderUI() {
    if (!controlsEl || !scene) return;
    if (el.info) el.info.textContent = describeChoice(scene.spec.choice, lang);
    if (el.seed && document.activeElement !== el.seed) { el.seed.value = api.code; el.seed.size = Math.max(6, Math.min(36, el.seed.value.length + 1)); }
    if (el.pause) el.pause.textContent = state.playing ? T().pause : T().play;
    if (el.lang) for (const [v, b] of Object.entries(el.lang)) b.setAttribute('aria-pressed', String(v === lang));
    if (el.aspect) for (const [a, b] of Object.entries(el.aspect)) b.setAttribute('aria-pressed', String(a === aspectName()));
    if (el.palm) for (const [v, b] of Object.entries(el.palm)) b.setAttribute('aria-pressed', String((v === 'true') === state.palmDetail));
    if (el.selects) {
      const opts = choiceOptions(scene.spec.choice.theme, lang);
      for (const key of PICK_KEYS) {
        const sel = el.selects[key], list = opts[key];
        if (state.force[key] != null && !list.some(([v]) => String(v) === String(state.force[key]))) delete state.force[key];
        const cur = scene.spec.choice[key];
        sel.innerHTML = '';
        const auto = document.createElement('option');
        auto.value = '';
        auto.textContent = `${T().auto} (${(list.find(([v]) => String(v) === String(cur)) || [, '—'])[1]})`;
        sel.appendChild(auto);
        for (const [v, name] of list) { const op = document.createElement('option'); op.value = String(v); op.textContent = name; sel.appendChild(op); }
        sel.value = state.force[key] != null ? String(state.force[key]) : '';
        sel.disabled = list.length <= 1 && key !== 'theme';
        sel.classList.toggle('nagai-fixed', state.force[key] != null);
      }
    }
  }

  // ── 바깥에서 쓰는 조작 함수
  const api = {
    get state() { return { seed: state.seed, jitter: state.jitter, force: { ...state.force }, wind: state.wind, playing: state.playing, aspect: aspectName(), palmDetail: state.palmDetail, lang, choice: scene && { ...scene.spec.choice } }; },
    get lang() { return lang; },
    // 컨트롤 문구 언어 바꾸기 ('ko' | 'en'). 고른 언어는 기억해 두었다가 lang: 'auto' 인 페이지가 다음에 쓴다
    setLang(v) {
      if (v !== 'ko' && v !== 'en') return api;
      lang = v;
      try { localStorage.setItem('nagai-lang', v); } catch (e) { /* 저장소가 막힌 곳 */ }
      if (pageLang) try {
        document.documentElement.lang = v;
        const u = new URL(location.href);                                       // 주소에 ?lang= 이 있으면 같이 바꿔서 새로고침해도 유지
        if (u.searchParams.has('lang')) { u.searchParams.set('lang', v); history.replaceState(history.state, '', u); }
      } catch (e) { /* 문서·주소 없음 */ }
      buildUI(); renderUI();
      if (o.onChange) o.onChange(api.state);
      return api;
    },
    get spec() { return scene && scene.spec; },
    get code() { return sceneCode({ seed: state.seed, jitter: state.jitter, aspect: aspectName(), force: state.force }); },
    // 장면 코드로 이동. 잘못된 코드면 false
    setCode(text) {
      const c = parseSceneCode(text);
      if (!c) return false;
      state.seed = c.seed; state.jitter = c.jitter; state.force = c.force;
      const a = c.aspect || '3:2';
      if (a !== aspectName()) { [o.designWidth, o.designHeight] = ASPECTS[a]; applyAspectStyle(); compose(); resize(); } else compose();
      return true;
    },
    // 사진 저장: 가로 2400×1600, 모바일 1440×2560 (o.exportSize 로 바꿀 수 있다). 파일 이름에 장면 코드
    get fileName() { return 'nagai-' + api.code.replace(/:(?=\d)/g, 'x').replace(/:/g, '-').replace(/\s+/g, '_') + '.png'; },
    // 지금 순간을 W×H 캔버스로 (커버 합성 등). 화면 캔버스와는 별개
    render(W, H) { return renderTo(W, H); },
    async savePNG() {
      const size = (o.exportSize && o.exportSize[aspectName()]) || EXPORT_SIZES[aspectName()];
      const blob = await new Promise((res) => renderTo(size[0], size[1]).toBlob(res, 'image/png'));
      const status = await saveFile(blob, api.fileName, lang);
      return { width: size[0], height: size[1], fileName: api.fileName, status };
    },
    // 공유할 글: 단독 페이지면 장면이 담긴 주소, 다른 페이지 안(iframe)이면 장면 코드
    shareText() {
      let framed = true;
      try { framed = window.top !== window; } catch (e) { /* 다른 출처의 iframe */ }
      return o.urlState && !framed ? location.href : api.code;
    },
    setSeed(n) { state.seed = Math.max(1, Math.floor(n)); state.jitter = null; compose(); return api; },
    next() { return api.setSeed(state.seed + 1); },
    prev() { return api.setSeed(state.seed - 1); },
    randomize() { delete state.force.sky; return api.setSeed(1 + Math.floor(Math.random() * 99999)); },
    // mood: 'day' (짙은·맑은 하늘) | 'dusk' (분홍 해질녘) | 'evening' (연보라 저녁)
    randomMood(mood) {
      const want = { day: ['deep', 'bright'], dusk: ['dusk'], evening: ['violet'] }[mood];
      if (!want) return api.randomize();
      const force = { ...state.force }; delete force.sky;               // 다른 고정 항목(테마 등)은 지킨다
      for (let i = 0; i < 400; i++) {
        const seed = 1 + Math.floor(Math.random() * 99999);
        if (want.includes(composeScene(seed, { force, width: o.designWidth, height: o.designHeight }).choice.sky)) {
          state.force = force; return api.setSeed(seed);
        }
      }
      state.force = { ...force, sky: want[want.length - 1] };          // 못 찾으면 하늘만 고정
      return api.setSeed(1 + Math.floor(Math.random() * 99999));
    },
    shuffleLayout(j) { state.jitter = j ?? 1 + Math.floor(Math.random() * 999); compose(); return api; },
    setForce(f) { for (const [k, v] of Object.entries(f)) { if (v == null || v === '') delete state.force[k]; else state.force[k] = v; } compose(); return api; },
    clearForce() { state.force = {}; compose(); return api; },
    setAspect(a) {
      if (!ASPECTS[a] || a === aspectName()) return api;
      [o.designWidth, o.designHeight] = ASPECTS[a];
      applyAspectStyle();
      compose();
      resize();
      return api;
    },
    setPalmDetail(v) { state.palmDetail = !!v; renderUI(); draw(); return api; },
    setWind(v) { state.wind = v; if (!state.playing) draw(); return api; },
    play() { state.playing = true; renderUI(); schedule(); return api; },
    pause() { state.playing = false; renderUI(); return api; },
    toggle() { return state.playing ? api.pause() : api.play(); },
    toPNG() { draw(); return canvas.toDataURL('image/png'); },
    destroy() { destroyed = true; if (raf) cancelAnimationFrame(raf); ro && ro.disconnect(); io && io.disconnect(); document.removeEventListener('visibilitychange', onVis); clearInterval(watchdog); for (const ev of ['pageshow', 'focus', 'pointerdown']) window.removeEventListener(ev, recheck); if (controlsEl) controlsEl.innerHTML = ''; },
  };

  // ── 크기·화면 밖·탭 전환 감지 (블로그에 여러 개 넣어도 보이는 것만 움직인다)
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  ro ? ro.observe(canvas) : window.addEventListener('resize', resize);
  const io = typeof IntersectionObserver !== 'undefined'
    ? new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; schedule(); }) : null;   // 한꺼번에 오면 마지막 것이 지금 상태
  if (io) io.observe(canvas);
  const onVis = () => schedule();
  document.addEventListener('visibilitychange', onVis);
  // 안전장치: iframe 안(아티팩트·임베드)에서 처음 열릴 때 화면 감지가 늦거나 빠지면 멈춘 채 남으므로,
  // 1초마다 실제 위치를 확인해 보이면 다시 돌린다. 이미 돌고 있으면 아무 일도 안 한다.
  const recheck = () => {
    if (raf || destroyed || document.hidden) return;
    const r = canvas.getBoundingClientRect();
    if (r.width && r.height && r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth) onScreen = true;
    schedule();
  };
  const watchdog = setInterval(recheck, 1000);
  for (const ev of ['pageshow', 'focus', 'pointerdown']) window.addEventListener(ev, recheck);

  buildUI();
  resize();
  compose();
  schedule();
  return api;
}

// <canvas data-nagai data-seed="42" data-force='{"theme":"resort"}' data-controls> 자동 장착
function mountAll(root = document) {
  const out = [];
  root.querySelectorAll('canvas[data-nagai]').forEach((cv) => {
    if (cv.__nagai) return;
    const d = cv.dataset;
    let controls = null;
    if (d.controls !== undefined) {
      controls = d.controls && d.controls !== 'true' ? document.querySelector(d.controls) : null;
      if (!controls) { controls = document.createElement('div'); cv.insertAdjacentElement('afterend', controls); }
    }
    cv.__nagai = mount({
      canvas: cv, controls,
      seed: d.seed ? +d.seed : 1,
      jitter: d.jitter ? +d.jitter : null,
      force: d.force ? JSON.parse(d.force) : {},
      wind: d.wind ? +d.wind : 0.6,
      autoplay: d.autoplay !== 'false',
      grain: d.grain !== 'false',
      aspect: d.aspect || null,
      urlState: d.urlState !== undefined && d.urlState !== 'false',
      palmDetail: d.palmDetail !== undefined && d.palmDetail !== 'false',
      lang: d.lang || 'ko',
    });
    out.push(cv.__nagai);
  });
  return out;
}

function registerKind(name, def) { SCENE_KINDS[name] = def; }

const NagaiScene = {
  version: '1.6.0',
  mount, mountAll, registerKind, saveFile, sceneCode, parseSceneCode,
  composeScene, buildScene, drawRun, choiceOptions, describeChoice,
  tree: COMPOSITION_TREE, kinds: SCENE_KINDS,
  // 새 객체를 만들 때 쓰는 도구들 (장면 빛·원근·그림자 규칙을 그대로 따르게)
  util: {
    lerp, clamp01, smoothstep, mixColor, withAlpha, mulberry32,
    persp, perspScale, shadowOffset, lightVector, fillPoly, convexHull, drawBoxShadow, drawBox,
    get light() { return { ...SCENE_LIGHT }; }, get view() { return { ...SCENE_VIEW }; },
    SHADOW_COLOR,
  },
};
global.NagaiScene = NagaiScene;
if (typeof document !== 'undefined') {
  const auto = () => mountAll(document);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
}
})(typeof window !== 'undefined' ? window : globalThis);
