"use client";

// Dotted, slowly-rotating globe. Canvas-based.
// Land is sampled at every 2° by point-in-polygon against authored continent
// outlines. Three pulsing pins (San Clemente / Miami / Garden City) and two
// great-circle arcs (EC→MIA, MIA→MI) sweep across.
//
// Modes:
//   default (Home)        — autoRotate=true, interactive=false → pendulum around corridor
//   network page          — autoRotate=true, interactive=true  → drag to spin

import * as React from "react";

type Pin = { id: string; label: string; role: string; lat: number; lon: number; color: "green" | "amber" };

const CONTINENT_POLYGONS: number[][][] = [
  // North America
  [
    [-168, 66], [-164, 68], [-156, 71], [-148, 71], [-140, 70], [-130, 69], [-122, 69],
    [-112, 70], [-105, 69], [-95, 69], [-86, 68], [-78, 72], [-72, 72], [-66, 70],
    [-62, 66], [-60, 60], [-65, 55], [-67, 52], [-65, 49], [-67, 46], [-67, 44],
    [-69, 43], [-71, 42], [-74, 40], [-75, 38], [-77, 35], [-79, 33], [-81, 30],
    [-82, 28], [-82, 26], [-80, 25], [-81, 24], [-83, 28], [-86, 29], [-88, 30],
    [-90, 29], [-93, 29], [-94, 30], [-97, 28], [-97, 26], [-99, 26], [-101, 25],
    [-103, 23], [-105, 21], [-106, 23], [-110, 24], [-113, 28], [-115, 30],
    [-117, 32], [-118, 33], [-119, 34], [-121, 36], [-122, 38], [-123, 40],
    [-124, 42], [-124, 46], [-124, 48], [-127, 50], [-130, 53], [-132, 55],
    [-135, 57], [-140, 59], [-145, 60], [-150, 60], [-155, 58], [-160, 57],
    [-163, 55], [-166, 54], [-167, 57], [-165, 60], [-163, 63], [-166, 65], [-168, 66],
  ],
  // Mexico/Central America
  [
    [-117, 32], [-110, 24], [-105, 21], [-100, 18], [-97, 16], [-94, 16],
    [-91, 15], [-88, 15], [-87, 13], [-85, 11], [-83, 9], [-82, 8], [-79, 9],
    [-77, 8], [-78, 12], [-82, 14], [-85, 15], [-89, 17], [-92, 17], [-95, 17],
    [-98, 18], [-103, 19], [-106, 21], [-109, 23], [-112, 25], [-115, 29], [-117, 32],
  ],
  // Florida
  [[-83, 30], [-82, 28], [-81, 26], [-80, 25], [-80, 27], [-81, 29], [-82, 30], [-83, 30]],
  // Greenland
  [
    [-55, 60], [-50, 60], [-45, 60], [-40, 62], [-32, 64], [-25, 68], [-20, 72],
    [-22, 76], [-25, 80], [-32, 82], [-42, 83], [-55, 82], [-62, 80], [-65, 77],
    [-62, 72], [-58, 68], [-55, 64], [-55, 60],
  ],
  // South America
  [
    [-78, 12], [-72, 12], [-65, 11], [-60, 10], [-55, 7], [-52, 5], [-50, 2],
    [-48, -1], [-45, -3], [-42, -5], [-38, -7], [-36, -9], [-37, -12], [-39, -15],
    [-40, -19], [-42, -22], [-46, -24], [-48, -26], [-52, -30], [-56, -34],
    [-58, -38], [-62, -40], [-65, -42], [-68, -46], [-71, -50], [-73, -53],
    [-71, -55], [-67, -55], [-66, -52], [-69, -48], [-71, -44], [-72, -40],
    [-72, -36], [-72, -30], [-71, -25], [-71, -20], [-72, -16], [-74, -14],
    [-76, -12], [-78, -8], [-80, -5], [-80, -2], [-80, 2], [-78, 5], [-78, 8],
    [-77, 11], [-78, 12],
  ],
  // Cuba
  [[-85, 21], [-83, 22], [-80, 23], [-77, 21], [-74, 20], [-77, 20], [-80, 22], [-85, 21]],
  // Hispaniola
  [[-74, 19], [-71, 19], [-69, 19], [-68, 18], [-71, 17], [-74, 18], [-74, 19]],
  // Europe
  [
    [-9, 36], [-8, 38], [-9, 40], [-9, 42], [-8, 43], [-5, 43], [-2, 43], [1, 43],
    [3, 43], [5, 43], [7, 43], [9, 42], [10, 40], [12, 40], [14, 40], [16, 40],
    [18, 40], [20, 40], [22, 40], [24, 40], [26, 40], [27, 38], [28, 40], [30, 40],
    [32, 40], [34, 40], [36, 40], [39, 42], [40, 46], [42, 50], [42, 55], [40, 60],
    [35, 62], [30, 64], [25, 66], [20, 67], [15, 68], [12, 66], [8, 64], [5, 60],
    [3, 58], [5, 57], [10, 55], [10, 53], [7, 53], [4, 52], [2, 52], [1, 51],
    [-1, 50], [-3, 49], [-1, 46], [-2, 44], [-4, 43], [-7, 43], [-9, 42], [-9, 40],
    [-9, 38], [-9, 36],
  ],
  // British Isles
  [[-6, 50], [-5, 52], [-3, 54], [-3, 57], [-5, 58], [-7, 58], [-8, 55], [-7, 52], [-6, 50]],
  [[-10, 52], [-9, 54], [-8, 55], [-6, 55], [-6, 52], [-8, 52], [-10, 52]],
  // Iceland
  [[-24, 63], [-24, 66], [-13, 66], [-13, 63], [-24, 63]],
  // Scandinavia
  [
    [4, 58], [8, 58], [11, 58], [14, 58], [17, 60], [20, 63], [22, 65], [24, 66],
    [25, 68], [27, 69], [30, 70], [28, 67], [24, 64], [20, 62], [17, 60], [14, 58],
    [12, 55], [10, 55], [7, 55], [4, 58],
  ],
  // Africa
  [
    [-17, 15], [-17, 20], [-15, 25], [-10, 28], [-5, 30], [-2, 32], [2, 33],
    [5, 33], [8, 33], [11, 33], [14, 33], [18, 33], [22, 32], [25, 31], [28, 31],
    [31, 30], [34, 30], [35, 28], [37, 22], [38, 18], [40, 15], [42, 12], [44, 11],
    [46, 12], [51, 11], [51, 7], [48, 4], [43, 0], [41, -3], [40, -7], [39, -12],
    [37, -16], [35, -20], [33, -26], [28, -30], [24, -33], [20, -34], [17, -32],
    [16, -28], [14, -22], [12, -15], [10, -8], [8, -2], [6, 2], [3, 4], [0, 5],
    [-3, 5], [-7, 5], [-10, 7], [-13, 11], [-16, 13], [-17, 15],
  ],
  // Madagascar
  [[44, -12], [47, -15], [50, -19], [50, -25], [47, -25], [44, -22], [44, -15], [44, -12]],
  // Middle East / Arabia
  [
    [34, 15], [38, 14], [42, 13], [44, 12], [48, 12], [51, 16], [55, 18], [57, 21],
    [56, 25], [52, 27], [48, 29], [44, 29], [42, 29], [39, 30], [35, 32], [34, 30],
    [34, 25], [34, 20], [34, 15],
  ],
  // Russia / Siberia
  [
    [40, 46], [50, 46], [60, 48], [70, 50], [80, 52], [90, 53], [100, 54],
    [115, 54], [130, 55], [145, 57], [160, 60], [175, 65], [179, 70], [170, 72],
    [155, 73], [140, 74], [125, 75], [110, 76], [90, 76], [75, 75], [60, 72],
    [50, 70], [42, 68], [40, 64], [40, 58], [40, 54], [40, 50], [40, 46],
  ],
  // China / SE Asia / Indian subcontinent
  [
    [60, 28], [65, 32], [70, 35], [75, 36], [80, 33], [85, 30], [88, 28], [92, 28],
    [97, 28], [100, 28], [105, 30], [110, 32], [115, 33], [120, 33], [122, 30],
    [122, 26], [121, 22], [117, 22], [114, 22], [110, 20], [108, 17], [107, 12],
    [108, 8], [105, 8], [103, 5], [100, 4], [100, 8], [101, 12], [100, 16],
    [98, 18], [95, 15], [92, 21], [90, 22], [88, 21], [85, 20], [80, 15], [78, 11],
    [78, 8], [76, 9], [73, 15], [70, 20], [68, 24], [63, 25], [60, 28],
  ],
  // Japan
  [[131, 32], [133, 33], [136, 35], [140, 37], [142, 40], [145, 43], [143, 42], [140, 40], [137, 36], [133, 34], [131, 32]],
  // Korean peninsula
  [[126, 34], [128, 36], [129, 38], [127, 40], [125, 38], [126, 36], [126, 34]],
  // Indonesia
  [[95, 5], [100, 4], [105, 2], [108, -2], [112, -4], [110, -7], [105, -7], [100, -2], [97, 2], [95, 5]],
  [[110, 1], [115, 2], [118, 1], [117, -2], [114, -3], [110, -2], [110, 1]],
  [[120, 0], [125, -1], [127, -3], [124, -5], [120, -3], [120, 0]],
  [[131, -1], [140, -3], [140, -8], [135, -8], [131, -4], [131, -1]],
  // Philippines
  [[120, 7], [122, 10], [124, 13], [125, 16], [123, 18], [121, 17], [121, 13], [120, 10], [120, 7]],
  // Australia
  [
    [113, -22], [114, -26], [115, -30], [117, -34], [120, -34], [125, -32],
    [130, -32], [135, -35], [138, -37], [141, -38], [145, -39], [148, -37],
    [150, -35], [152, -32], [153, -28], [152, -25], [150, -23], [146, -19],
    [142, -17], [140, -17], [136, -14], [133, -13], [130, -12], [127, -14],
    [122, -17], [118, -20], [115, -21], [113, -22],
  ],
  // Tasmania
  [[145, -41], [148, -41], [148, -43], [145, -43], [145, -41]],
  // New Zealand
  [[166, -46], [170, -46], [174, -44], [174, -42], [170, -41], [166, -44], [166, -46]],
  [[173, -37], [176, -37], [178, -39], [176, -41], [174, -41], [173, -39], [173, -37]],
  // Antarctica
  [[-180, -72], [180, -72], [180, -78], [-180, -78], [-180, -72]],
];

function pointInPoly(lon: number, lat: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > lat) !== (yj > lat))
      && (lon < ((xj - xi) * (lat - yi)) / ((yj - yi) || 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function isLand(lon: number, lat: number): boolean {
  for (const poly of CONTINENT_POLYGONS) if (pointInPoly(lon, lat, poly)) return true;
  return false;
}

function buildLandPoints(): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const stepLat = 2.0;
  const baseLonStep = 2.0;
  for (let lat = -75; lat <= 80; lat += stepLat) {
    const radius = Math.cos((lat * Math.PI) / 180);
    const lonStep = Math.max(baseLonStep, baseLonStep / Math.max(0.1, radius));
    for (let lon = -180; lon < 180; lon += lonStep) {
      if (isLand(lon, lat)) pts.push([lon, lat]);
    }
  }
  return pts;
}

const PINS: Pin[] = [
  { id: "sanclemente", label: "San Clemente, EC", role: "farm",          lat: -0.92, lon: -80.43, color: "green" },
  { id: "miami",       label: "Miami, FL",         role: "port of entry", lat: 25.77, lon: -80.19, color: "amber" },
  { id: "gardencity",  label: "Garden City, MI",   role: "home base",     lat: 42.32, lon: -83.34, color: "green" },
];

const ARCS = [
  { from: PINS[0], to: PINS[1], duration: 6.5, delay: 0 },
  { from: PINS[1], to: PINS[2], duration: 4.0, delay: 3.2 },
];

function lonLatToVec3(lon: number, lat: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [
    -Math.sin(phi) * Math.cos(theta),
     Math.cos(phi),
     Math.sin(phi) * Math.sin(theta),
  ];
}

function rotateY(v: [number, number, number], a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}
function rotateX(v: [number, number, number], a: number): [number, number, number] {
  const c = Math.cos(a), s = Math.sin(a);
  return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
}

function readVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

let cachedLandPoints: Array<[number, number]> | null = null;

const CORRIDOR_LON = -82;
const CORRIDOR_YAW = (-CORRIDOR_LON * Math.PI) / 180;

export function Globe({
  size = 720,
  opacity = 0.55,
  tilt = -0.32,
  interactive = false,
  autoRotate = true,
}: {
  size?: number;
  opacity?: number;
  tilt?: number;
  interactive?: boolean;
  autoRotate?: boolean;
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const startRef = React.useRef<number>(0);
  const yawRef = React.useRef<number>(CORRIDOR_YAW);
  const tiltRef = React.useRef<number>(tilt);
  const draggingRef = React.useRef<boolean>(false);
  const [theme, setTheme] = React.useState<"dark" | "light">("dark");

  React.useEffect(() => {
    startRef.current = performance.now();
    setTheme((document.documentElement.dataset.theme as "dark" | "light") || "dark");
    const obs = new MutationObserver(() => {
      setTheme((document.documentElement.dataset.theme as "dark" | "light") || "dark");
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);

  if (!cachedLandPoints && typeof window !== "undefined") cachedLandPoints = buildLandPoints();

  React.useEffect(() => {
    if (!interactive) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let lastX = 0, lastY = 0;

    function getPoint(e: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
      if ("touches" in e) return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
      return { clientX: e.clientX, clientY: e.clientY };
    }
    function onDown(e: MouseEvent | TouchEvent) {
      draggingRef.current = true;
      const p = getPoint(e);
      lastX = p.clientX; lastY = p.clientY;
      if (canvas) canvas.style.cursor = "grabbing";
      e.preventDefault();
    }
    function onMove(e: MouseEvent | TouchEvent) {
      if (!draggingRef.current) return;
      const p = getPoint(e);
      const dx = p.clientX - lastX;
      const dy = p.clientY - lastY;
      lastX = p.clientX; lastY = p.clientY;
      yawRef.current += dx * 0.005;
      tiltRef.current = Math.max(-1.2, Math.min(1.2, tiltRef.current - dy * 0.005));
      e.preventDefault();
    }
    function onUp() {
      draggingRef.current = false;
      if (canvas) canvas.style.cursor = "grab";
    }

    canvas.style.cursor = "grab";
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchstart", onDown);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [interactive]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + "px";
    canvas.style.height = size + "px";
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    let raf = 0;
    let lastT = performance.now() / 1000;

    function draw() {
      if (!ctx) return;
      const t = (performance.now() - startRef.current) / 1000;
      const now = performance.now() / 1000;
      const dt = Math.min(0.05, now - lastT);
      lastT = now;

      if (autoRotate && !draggingRef.current) {
        if (interactive) {
          yawRef.current += dt * 0.05;
        } else {
          const swing = Math.sin(t * 0.18) * ((18 * Math.PI) / 180);
          yawRef.current = CORRIDOR_YAW + swing;
        }
      }
      const yaw = yawRef.current;
      const tiltVal = tiltRef.current;

      const cx = size / 2;
      const cy = size / 2;
      const R = size * 0.42;

      ctx.clearRect(0, 0, size, size);

      const isLight = theme === "light";
      const dotLand   = isLight ? "oklch(0.42 0.06 150)"  : "oklch(0.7 0.10 150)";
      const dotOcean  = isLight ? "oklch(0.82 0.015 150)" : "oklch(0.32 0.012 150)";
      const greenAccent = readVar("--green") || "oklch(0.74 0.16 145)";
      const amberAccent = readVar("--amber") || "oklch(0.82 0.15 78)";

      ctx.strokeStyle = isLight ? "oklch(0.78 0.012 150 / 0.35)" : "oklch(0.4 0.012 150 / 0.5)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = dotOcean;
      const stepLat = 4;
      const baseLonStep = 4;
      for (let lat = -78; lat <= 78; lat += stepLat) {
        const radius = Math.cos((lat * Math.PI) / 180);
        const lonStep = Math.max(baseLonStep, baseLonStep / Math.max(0.15, radius));
        for (let lon = -180; lon < 180; lon += lonStep) {
          let v = lonLatToVec3(lon, lat);
          v = rotateY(v, yaw);
          v = rotateX(v, tiltVal);
          if (v[2] < 0) continue;
          const x = cx + v[0] * R;
          const y = cy - v[1] * R;
          const depth = v[2] + 0.3;
          ctx.globalAlpha = 0.10 * depth;
          ctx.beginPath();
          ctx.arc(x, y, 0.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = dotLand;
      const pts = cachedLandPoints || [];
      for (let i = 0; i < pts.length; i++) {
        const [lon, lat] = pts[i];
        let v = lonLatToVec3(lon, lat);
        v = rotateY(v, yaw);
        v = rotateX(v, tiltVal);
        if (v[2] < -0.05) continue;
        const x = cx + v[0] * R;
        const y = cy - v[1] * R;
        const depth = Math.max(0, v[2] + 0.2);
        ctx.globalAlpha = Math.min(0.95, 0.45 + depth * 0.55);
        ctx.beginPath();
        ctx.arc(x, y, 0.95, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const arc of ARCS) drawArc(ctx, arc, cx, cy, R, yaw, tiltVal, t, greenAccent, amberAccent);

      for (const pin of PINS) {
        let v = lonLatToVec3(pin.lon, pin.lat);
        v = rotateY(v, yaw);
        v = rotateX(v, tiltVal);
        if (v[2] < -0.05) continue;
        const x = cx + v[0] * R;
        const y = cy - v[1] * R;
        const accent = pin.color === "amber" ? amberAccent : greenAccent;
        drawPin(ctx, x, y, accent, t, pin.id);
      }

      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, [size, theme, autoRotate, interactive]);

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        opacity,
        pointerEvents: interactive ? "auto" : "none",
        userSelect: "none",
        touchAction: interactive ? "none" : "auto",
      }}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

function drawPin(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, t: number, seed: string) {
  const phase = (t * 0.7 + (seed.charCodeAt(0) % 7) * 0.3) % 2.4;
  const pulseR = 3 + phase * 9;
  const pulseA = Math.max(0, 0.32 - phase * 0.14);
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.globalAlpha = pulseA;
  ctx.arc(x, y, pulseR, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.arc(x, y, 3.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
  ctx.beginPath();
  ctx.arc(x, y, 1.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "white";
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.arc(x, y, 0.8, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha = 1;
}

function drawArc(
  ctx: CanvasRenderingContext2D,
  arc: { from: Pin; to: Pin; duration: number; delay: number },
  cx: number, cy: number, R: number,
  yaw: number, tilt: number, t: number,
  green: string, amber: string,
) {
  const a = lonLatToVec3(arc.from.lon, arc.from.lat);
  const b = lonLatToVec3(arc.to.lon, arc.to.lat);
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const omega = Math.acos(Math.max(-1, Math.min(1, dot)));
  if (omega < 0.001) return;
  const sinO = Math.sin(omega);

  const STEPS = 64;
  const lift = 0.15;
  const localT = ((t - arc.delay) / arc.duration) % 1;
  const headT = Math.max(0, Math.min(1, localT));

  ctx.lineCap = "round";

  ctx.beginPath();
  let firstPoint = true;
  for (let s = 0; s <= STEPS; s++) {
    const u = s / STEPS;
    const w1 = Math.sin((1 - u) * omega) / sinO;
    const w2 = Math.sin(u * omega) / sinO;
    const px = a[0] * w1 + b[0] * w2;
    const py = a[1] * w1 + b[1] * w2;
    const pz = a[2] * w1 + b[2] * w2;
    const len = Math.sqrt(px * px + py * py + pz * pz);
    const liftFactor = 1 + lift * Math.sin(u * Math.PI);
    let v: [number, number, number] = [(px / len) * liftFactor, (py / len) * liftFactor, (pz / len) * liftFactor];
    v = rotateY(v, yaw);
    v = rotateX(v, tilt);
    if (v[2] < -0.05) { firstPoint = true; continue; }
    const sx = cx + v[0] * R;
    const sy = cy - v[1] * R;
    if (firstPoint) { ctx.moveTo(sx, sy); firstPoint = false; }
    else ctx.lineTo(sx, sy);
  }
  ctx.strokeStyle = green;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1;
  ctx.stroke();

  const headLen = 0.18;
  const headStart = Math.max(0, headT - headLen);
  ctx.beginPath();
  firstPoint = true;
  const HEAD_STEPS = 24;
  for (let s = 0; s <= HEAD_STEPS; s++) {
    const u = headStart + (headT - headStart) * (s / HEAD_STEPS);
    const w1 = Math.sin((1 - u) * omega) / sinO;
    const w2 = Math.sin(u * omega) / sinO;
    const px = a[0] * w1 + b[0] * w2;
    const py = a[1] * w1 + b[1] * w2;
    const pz = a[2] * w1 + b[2] * w2;
    const len = Math.sqrt(px * px + py * py + pz * pz);
    const liftFactor = 1 + lift * Math.sin(u * Math.PI);
    let v: [number, number, number] = [(px / len) * liftFactor, (py / len) * liftFactor, (pz / len) * liftFactor];
    v = rotateY(v, yaw);
    v = rotateX(v, tilt);
    if (v[2] < -0.05) { firstPoint = true; continue; }
    const sx = cx + v[0] * R;
    const sy = cy - v[1] * R;
    if (firstPoint) { ctx.moveTo(sx, sy); firstPoint = false; }
    else ctx.lineTo(sx, sy);
  }
  ctx.strokeStyle = amber;
  ctx.globalAlpha = 0.9;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  {
    const u = headT;
    const w1 = Math.sin((1 - u) * omega) / sinO;
    const w2 = Math.sin(u * omega) / sinO;
    const px = a[0] * w1 + b[0] * w2;
    const py = a[1] * w1 + b[1] * w2;
    const pz = a[2] * w1 + b[2] * w2;
    const len = Math.sqrt(px * px + py * py + pz * pz);
    const liftFactor = 1 + lift * Math.sin(u * Math.PI);
    let v: [number, number, number] = [(px / len) * liftFactor, (py / len) * liftFactor, (pz / len) * liftFactor];
    v = rotateY(v, yaw);
    v = rotateX(v, tilt);
    if (v[2] >= -0.05) {
      const sx = cx + v[0] * R;
      const sy = cy - v[1] * R;
      ctx.fillStyle = amber;
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(sx, sy, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.arc(sx, sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalAlpha = 1;
}
