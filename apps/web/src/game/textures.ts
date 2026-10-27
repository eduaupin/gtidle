// Texturas geradas por código (nada de imagens externas): calçada de pedra, asfalto, grama,
// concreto e cascalho de telhado. Cada uma é desenhada uma vez em alta resolução e repetida
// como padrão, em unidades do mundo, então fica nítida em qualquer zoom.

type Rand = () => number;
const rng = (seed: number): Rand => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
};
export const mix = (hex: string, amt: number) => {
  const [r, g, b] = hexToRgb(hex);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)));
  return `rgb(${c(r)},${c(g)},${c(b)})`;
};

function canvas(px: number) {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  return [c, c.getContext('2d')!] as const;
}

function speckle(g: CanvasRenderingContext2D, px: number, rand: Rand, n: number, alpha: number, size = 2) {
  for (let i = 0; i < n; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${alpha * rand()})`;
    const s = size * (0.5 + rand());
    g.fillRect(rand() * px, rand() * px, s, s);
  }
}

/** Calçada de pedras quadradas com rejunte, bisel e variação de cor (estilo pavimento antigo). */
export function paving(base: string, seed = 1) {
  const PX = 512, STONES = 4; // 4x4 pedras por bloco de textura
  const [c, g] = canvas(PX);
  const rand = rng(seed);
  const s = PX / STONES;
  g.fillStyle = mix(base, -55); // rejunte
  g.fillRect(0, 0, PX, PX);
  for (let i = 0; i < STONES; i++) for (let j = 0; j < STONES; j++) {
    const x = i * s + 3, y = j * s + 3, w = s - 6;
    const tint = (rand() - 0.5) * 22;
    g.fillStyle = mix(base, tint);
    g.fillRect(x, y, w, w);
    // bisel: luz em cima/esquerda, sombra embaixo/direita
    g.fillStyle = 'rgba(255,255,255,.22)';
    g.fillRect(x, y, w, 5); g.fillRect(x, y, 5, w);
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.fillRect(x, y + w - 5, w, 5); g.fillRect(x + w - 5, y, 5, w);
    // manchas de desgaste
    for (let k = 0; k < 6; k++) {
      g.fillStyle = `rgba(0,0,0,${0.04 + rand() * 0.06})`;
      g.beginPath();
      g.ellipse(x + rand() * w, y + rand() * w, 6 + rand() * 18, 4 + rand() * 10, rand() * 3, 0, 7);
      g.fill();
    }
    // rachadura ocasional
    if (rand() < 0.25) {
      g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 2;
      g.beginPath();
      let cx = x + rand() * w, cy = y + rand() * w;
      g.moveTo(cx, cy);
      for (let k = 0; k < 4; k++) { cx += (rand() - 0.5) * 40; cy += (rand() - 0.5) * 40; g.lineTo(cx, cy); }
      g.stroke();
    }
  }
  speckle(g, PX, rand, 2500, 0.18, 3);
  return c;
}

/** Asfalto: base com grão fino e manchas de óleo. */
export function asphalt(base: string, seed = 2) {
  const PX = 512;
  const [c, g] = canvas(PX);
  const rand = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, PX, PX);
  for (let k = 0; k < 14; k++) {
    g.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.07})`;
    g.beginPath();
    g.ellipse(rand() * PX, rand() * PX, 20 + rand() * 70, 10 + rand() * 40, rand() * 3, 0, 7);
    g.fill();
  }
  speckle(g, PX, rand, 9000, 0.22, 2.5);
  return c;
}

export function grass(seed = 3) {
  const PX = 512;
  const [c, g] = canvas(PX);
  const rand = rng(seed);
  g.fillStyle = '#4f7d33';
  g.fillRect(0, 0, PX, PX);
  for (let k = 0; k < 40; k++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '30,60,20' : '120,160,60'},${0.12 + rand() * 0.12})`;
    g.beginPath();
    g.ellipse(rand() * PX, rand() * PX, 20 + rand() * 60, 14 + rand() * 40, rand() * 3, 0, 7);
    g.fill();
  }
  for (let i = 0; i < 7000; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(25,55,15,.5)' : 'rgba(140,190,80,.45)';
    g.fillRect(rand() * PX, rand() * PX, 2, 4 + rand() * 4);
  }
  return c;
}

/** Concreto liso (estacionamento, pátio). */
export function concrete(base: string, seed = 4) {
  const PX = 512;
  const [c, g] = canvas(PX);
  const rand = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, PX, PX);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 3;
  g.strokeRect(0, 0, PX, PX); // juntas de dilatação
  speckle(g, PX, rand, 5000, 0.16, 2.5);
  return c;
}

/** Cascalho/manta para telhado, usado como camada por cima da cor do prédio. */
export function gravel(seed = 5) {
  const PX = 256;
  const [c, g] = canvas(PX);
  const rand = rng(seed);
  for (let i = 0; i < 6000; i++) {
    const v = rand() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${0.05 + rand() * 0.12})`;
    g.fillRect(rand() * PX, rand() * PX, 2 + rand() * 2, 2 + rand() * 2);
  }
  return c;
}

/** Cria um padrão repetível em que `worldSize` unidades do mundo = a textura inteira. */
export function worldPattern(g: CanvasRenderingContext2D, tex: HTMLCanvasElement, worldSize: number) {
  const p = g.createPattern(tex, 'repeat')!;
  const k = worldSize / tex.width;
  p.setTransform(new DOMMatrix([k, 0, 0, k, 0, 0]));
  return p;
}
