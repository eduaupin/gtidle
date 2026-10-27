// Atlas de sprites (gerado por tools/build_atlas.py a partir da folha de arte).
// Enquanto a imagem não carrega, o jogo usa o desenho procedural antigo como reserva.
import atlasUrl from '../assets/sprites/atlas.png';
import meta from '../assets/sprites/atlas.json';

type Rect = [number, number, number, number];
const RECTS = meta.rects as unknown as Record<string, Rect>;
export const SPRITE_GROUPS = meta.groups as Record<string, string[]>;
export const ATLAS_URL = atlasUrl;
export const ATLAS_SIZE = (() => {
  let w = 0, h = 0;
  for (const [x, y, rw, rh] of Object.values(RECTS)) { w = Math.max(w, x + rw); h = Math.max(h, y + rh); }
  return { w: Math.max(1024, w), h };
})();

const img = new Image();
let ready = false;
export const spritesReady: Promise<void> = new Promise(res => {
  img.onload = () => { ready = true; res(); };
  img.onerror = () => res();
  img.src = atlasUrl;
});

export const hasSprite = (name?: string | null): name is string => !!name && ready && name in RECTS;
export const spriteRect = (name: string): Rect | undefined => RECTS[name];
export const spriteSize = (name: string): [number, number] => {
  const r = RECTS[name];
  return r ? [r[2], r[3]] : [1, 1];
};

// Edições especiais (raros): o sprite com uma cor por cima, guardado em cache
const tintCache = new Map<string, HTMLCanvasElement>();
function tinted(name: string, color: string) {
  const key = name + color;
  let c = tintCache.get(key);
  if (c) return c;
  const r = RECTS[name];
  c = document.createElement('canvas');
  c.width = r[2]; c.height = r[3];
  const g = c.getContext('2d')!;
  g.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
  g.globalCompositeOperation = 'source-atop';
  g.globalAlpha = 0.55; g.fillStyle = color; g.fillRect(0, 0, r[2], r[3]);
  g.globalAlpha = 0.35; g.globalCompositeOperation = 'lighter';
  g.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
  g.globalCompositeOperation = 'destination-in'; g.globalAlpha = 1;
  g.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
  tintCache.set(key, c);
  return c;
}

/** Desenha o sprite no retângulo (x, y, w, h) do contexto atual. Pixel art: sem suavizar ao ampliar. */
export function drawSprite(g: CanvasRenderingContext2D, name: string, x: number, y: number, w: number, h: number, flip = false, tint?: string) {
  const r = RECTS[name];
  if (!r || !ready) return;
  if (tint) {
    const c = tinted(name, tint);
    g.save();
    if (flip) { g.translate(x + w, y); g.scale(-1, 1); g.drawImage(c, 0, 0, w, h); } else g.drawImage(c, x, y, w, h);
    g.restore();
    return;
  }
  const t = g.getTransform();
  const scale = Math.hypot(t.a, t.b) * (w / r[2]);
  const smooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = scale < 0.98; // reduzindo: suaviza; ampliando: pixel nítido
  g.imageSmoothingQuality = 'high';
  if (flip) {
    g.save();
    g.translate(x + w, y);
    g.scale(-1, 1);
    g.drawImage(img, r[0], r[1], r[2], r[3], 0, 0, w, h);
    g.restore();
  } else {
    g.drawImage(img, r[0], r[1], r[2], r[3], x, y, w, h);
  }
  g.imageSmoothingEnabled = smooth;
}

/** Cabe o sprite numa caixa (sem distorcer), apoiado embaixo e centralizado. */
export function drawSpriteFit(g: CanvasRenderingContext2D, name: string, cx: number, bottom: number, maxW: number, maxH: number, flip = false, tint?: string) {
  const [sw, sh] = spriteSize(name);
  const k = Math.min(maxW / sw, maxH / sh);
  const w = sw * k, h = sh * k;
  drawSprite(g, name, cx - w / 2, bottom - h, w, h, flip, tint);
  return { w, h };
}

/** Sprite centrado num ponto, girado (os veículos da folha apontam para cima). */
export function drawSpriteRotated(g: CanvasRenderingContext2D, name: string, cx: number, cy: number, w: number, h: number, angle: number) {
  g.save();
  g.translate(cx, cy);
  g.rotate(angle);
  drawSprite(g, name, -w / 2, -h / 2, w, h);
  g.restore();
}

/** Sorteio estável de um item de uma lista a partir de um número. */
export const pick = <T,>(list: T[], seed: number) => list[Math.abs(Math.floor(seed)) % list.length];

// Grupos de pessoas da folha
export const CIVILIANS = [...(SPRITE_GROUPS.pf ?? []), ...(SPRITE_GROUPS.pv ?? [])];
export const COPS = SPRITE_GROUPS.cop ?? [];
export const SWATS = SPRITE_GROUPS.swat ?? [];
export const THUGS = [...(SPRITE_GROUPS.gf ?? []), ...(SPRITE_GROUPS.gv ?? [])].filter(n => n !== 'gv_24');
