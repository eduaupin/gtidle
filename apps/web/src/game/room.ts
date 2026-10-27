// Sala do esconderijo vista de cima. Cada slot de decoração tem um lugar fixo na sala;
// o carro equipado fica na garagem e a gangue aparece com a roupa em uso.
import { DECOR_ITEMS, type DecorItem, type DecorSlot } from '@gti/shared';
import { drawCar, drawPerson, type CarLook, type Outfit } from './draw';
import { mix } from './textures';
import { drawSpriteFit, hasSprite } from './sprites';

export const ROOM_W = 320, ROOM_H = 200;
const WALL = 12;

const get = (placed: Partial<Record<DecorSlot, string>>, slot: DecorSlot): DecorItem | undefined =>
  DECOR_ITEMS.find(d => d.id === placed[slot]);

function seeded(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
}

function floor(g: CanvasRenderingContext2D, item: DecorItem | undefined) {
  const [a, b] = item?.colors ?? ['#8c8a84', '#7d7b75'];
  const x0 = WALL, y0 = WALL, w = ROOM_W - 2 * WALL, h = ROOM_H - 2 * WALL;
  g.fillStyle = a; g.fillRect(x0, y0, w, h);
  const r = seeded(7);
  switch (item?.style) {
    case 'planks':
      for (let y = y0; y < y0 + h; y += 8) {
        g.fillStyle = b; g.fillRect(x0, y + 7, w, 1);
        for (let x = x0 + ((y / 8) % 2) * 20; x < x0 + w; x += 40) g.fillRect(x, y, 1, 8);
      }
      break;
    case 'checker':
      for (let y = y0, j = 0; y < y0 + h; y += 14, j++) for (let x = x0, i = 0; x < x0 + w; x += 14, i++) {
        if ((i + j) % 2) { g.fillStyle = b; g.fillRect(x, y, 14, 14); }
      }
      break;
    case 'marble':
      g.strokeStyle = b; g.lineWidth = 0.8;
      for (let k = 0; k < 14; k++) {
        g.beginPath(); let x = x0 + r() * w, y = y0 + r() * h; g.moveTo(x, y);
        for (let s = 0; s < 5; s++) { x += (r() - 0.3) * 30; y += (r() - 0.5) * 20; g.lineTo(x, y); }
        g.stroke();
      }
      g.strokeStyle = 'rgba(0,0,0,.08)';
      for (let x = x0; x < x0 + w; x += 40) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + h); g.stroke(); }
      break;
    default:
      for (let k = 0; k < 500; k++) { g.fillStyle = `rgba(0,0,0,${r() * 0.08})`; g.fillRect(x0 + r() * w, y0 + r() * h, 2, 2); }
  }
}

function walls(g: CanvasRenderingContext2D, item: DecorItem | undefined) {
  const [a, b] = item?.colors ?? ['#b8ab96'];
  g.fillStyle = a;
  g.fillRect(0, 0, ROOM_W, WALL); g.fillRect(0, ROOM_H - WALL, ROOM_W, WALL);
  g.fillRect(0, 0, WALL, ROOM_H); g.fillRect(ROOM_W - WALL, 0, WALL, ROOM_H);
  if (item?.style === 'brick' && b) {
    g.fillStyle = b;
    for (let y = 0; y < WALL; y += 4) for (let x = (y / 4) % 2 * 4; x < ROOM_W; x += 8) g.fillRect(x, y, 1, 4);
    for (let y = 0; y < WALL; y += 4) g.fillRect(0, y, ROOM_W, 0.6);
  }
  // borda interna e porta da garagem
  g.strokeStyle = mix(a.startsWith('#') ? a : '#b8ab96', -50); g.lineWidth = 1.5;
  g.strokeRect(WALL, WALL, ROOM_W - 2 * WALL, ROOM_H - 2 * WALL);
  g.fillStyle = '#5b5f66'; g.fillRect(ROOM_W - WALL, 134, WALL, 52);
  for (let y = 136; y < 186; y += 4) { g.fillStyle = '#4a4e55'; g.fillRect(ROOM_W - WALL, y, WALL, 1.5); }
}

function shadow(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 2, y + 2.5, w, h);
}

function wallArt(g: CanvasRenderingContext2D, item: DecorItem | undefined) {
  if (!item) return;
  const x = 66, y = 3, w = 46, h = 26;
  const c = item.colors;
  shadow(g, x, y, w, h);
  switch (item.style) {
    case 'flag3': { const s = w / 3; c.slice(0, 3).forEach((col, i) => { g.fillStyle = col; g.fillRect(x + i * s, y, s, h); }); break; }
    case 'flag2': g.fillStyle = c[0]; g.fillRect(x, y, w, h); g.fillStyle = c[1]; g.fillRect(x + w / 2 - 4, y, 8, h); g.beginPath(); g.arc(x + w / 2, y + h / 2, 7, 0, 7); g.fill(); break;
    case 'stripes': for (let i = 0; i < 6; i++) { g.fillStyle = c[i % 2]; g.fillRect(x + (w / 6) * i, y, w / 6, h); } break;
    case 'neon':
      g.fillStyle = '#14151d'; g.fillRect(x, y, w, h);
      g.shadowColor = c[0]; g.shadowBlur = 8; g.strokeStyle = c[0]; g.lineWidth = 1.6; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
      g.fillStyle = c[1]; g.font = '700 7px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ABERTO 24H', x + w / 2, y + h / 2); g.shadowBlur = 0; break;
    case 'poster':
      g.fillStyle = '#1d1d2b'; g.fillRect(x, y, w, h);
      g.fillStyle = c[0]; g.fillRect(x, y + h - 8, w, 8);
      drawCar(g, x + w / 2, y + h / 2 - 2, 0, { color: c[1], shape: 'sport' }, 1.6); break;
    case 'disc':
      g.fillStyle = '#2a2a33'; g.fillRect(x, y, w, h);
      g.fillStyle = c[0]; g.beginPath(); g.arc(x + w / 2, y + h / 2, 10, 0, 7); g.fill();
      g.fillStyle = c[1]; g.beginPath(); g.arc(x + w / 2, y + h / 2, 3, 0, 7); g.fill(); break;
  }
  g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 0.8; g.strokeRect(x, y, w, h);
}

function rug(g: CanvasRenderingContext2D, item: DecorItem | undefined) {
  if (!item) return;
  const x = 100, y = 62, w = 110, h = 66;
  const [a, b] = item.colors;
  if (item.style === 'zebra') {
    g.fillStyle = a; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); g.fill();
    g.save(); g.clip();
    g.strokeStyle = b; g.lineWidth = 4;
    for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(x + i * 10, y); g.quadraticCurveTo(x + i * 10 + 10, y + h / 2, x + i * 10 - 4, y + h); g.stroke(); }
    g.restore();
    return;
  }
  g.fillStyle = a; g.fillRect(x, y, w, h);
  g.strokeStyle = b; g.lineWidth = 3; g.strokeRect(x + 5, y + 5, w - 10, h - 10);
  g.lineWidth = 1; g.strokeRect(x + 11, y + 11, w - 22, h - 22);
  g.fillStyle = b; g.beginPath(); g.ellipse(x + w / 2, y + h / 2, 14, 9, 0, 0, 7); g.fill();
}

function tv(g: CanvasRenderingContext2D, item: DecorItem | undefined) {
  if (!item) return;
  const wide = item.style === 'wide';
  const w = wide ? 70 : 34, x = 155 - w / 2, y = WALL + 2;
  // rack
  g.fillStyle = '#4a3a2e'; g.fillRect(x - 6, y, w + 12, 12);
  shadow(g, x, y + 1, w, wide ? 5 : 12);
  g.fillStyle = '#18191f'; g.fillRect(x, y + 1, w, wide ? 5 : 12);
  g.fillStyle = 'rgba(80,140,255,.35)'; g.fillRect(x + 1, y + 1.6, w - 2, wide ? 2 : 6);
}

function sofa(g: CanvasRenderingContext2D, item: DecorItem | undefined) {
  if (!item) return;
  const x = 110, y = 146, w = 90, h = 26;
  const [a, b] = item.colors;
  shadow(g, x, y, w, h);
  g.fillStyle = mix(a, -30);
  g.beginPath(); g.roundRect(x, y, w, h, item.style === 'curved' ? 10 : 4); g.fill(); // encosto e braços
  g.fillStyle = a;
  g.beginPath(); g.roundRect(x + 6, y + 2, w - 12, h - 9, 3); g.fill(); // assentos
  g.strokeStyle = mix(a, -45); g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(x + w / 3, y + 3); g.lineTo(x + w / 3, y + h - 8); g.moveTo(x + (2 * w) / 3, y + 3); g.lineTo(x + (2 * w) / 3, y + h - 8); g.stroke();
  if (item.style === 'spots' && b) {
    const r = seeded(3); g.fillStyle = b;
    for (let k = 0; k < 26; k++) { g.beginPath(); g.ellipse(x + 4 + r() * (w - 8), y + 2 + r() * (h - 6), 1.6, 1.1, r() * 3, 0, 7); g.fill(); }
  }
}

function bar(g: CanvasRenderingContext2D, item: DecorItem | undefined) {
  if (!item) return;
  const c = item.colors;
  if (item.style === 'cooler') {
    shadow(g, 262, 40, 22, 16);
    g.fillStyle = c[0]; g.fillRect(262, 40, 22, 16);
    g.fillStyle = '#3f7fd6'; g.fillRect(262, 46, 22, 3);
    return;
  }
  const x = 250, y = 26, w = 46, h = 92;
  shadow(g, x, y, 16, h);
  g.fillStyle = item.style === 'neon' ? c[0] : c[0]; g.fillRect(x, y, 16, h); // balcão
  if (item.style === 'neon') {
    g.shadowColor = c[1]; g.shadowBlur = 8; g.strokeStyle = c[1]; g.lineWidth = 1.2; g.strokeRect(x + 1, y + 1, 14, h - 2);
    g.shadowColor = c[2]; g.strokeStyle = c[2]; g.strokeRect(x + 3, y + 3, 10, h - 6); g.shadowBlur = 0;
  } else {
    g.fillStyle = mix(c[0], 25); g.fillRect(x + 1, y + 1, 14, 3);
  }
  // prateleira com garrafas na parede
  g.fillStyle = '#3a2a1e'; g.fillRect(x + 26, y, 16, h);
  const cols = ['#7ab8d9', '#3f8a45', '#c9a46b', '#9b2d2d', '#e8e1d0'];
  for (let i = 0; i < 9; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(x + 31 + (i % 2) * 6, y + 6 + i * 9.5, 2.2, 0, 7); g.fill(); }
  // banquetas
  for (let i = 0; i < 3; i++) { g.fillStyle = '#2b2b2b'; g.beginPath(); g.arc(x - 8, y + 18 + i * 28, 4, 0, 7); g.fill(); g.fillStyle = '#c94c4c'; g.beginPath(); g.arc(x - 8, y + 18 + i * 28, 2.6, 0, 7); g.fill(); }
}

function corner(g: CanvasRenderingContext2D, item: DecorItem | undefined) {
  if (!item) return;
  const x = WALL + 6, y = WALL + 30;
  const c = item.colors;
  switch (item.style) {
    case 'palm':
      g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(x + 14, y + 16, 14, 0, 7); g.fill();
      g.fillStyle = c[1]; g.beginPath(); g.arc(x + 12, y + 12, 6, 0, 7); g.fill();
      g.strokeStyle = c[0]; g.lineWidth = 4; g.lineCap = 'round';
      for (let k = 0; k < 7; k++) { const a = k * 0.9; g.beginPath(); g.moveTo(x + 12, y + 12); g.quadraticCurveTo(x + 12 + Math.cos(a) * 10, y + 12 + Math.sin(a) * 10, x + 12 + Math.cos(a + 0.4) * 17, y + 12 + Math.sin(a + 0.4) * 17); g.stroke(); }
      g.lineCap = 'butt';
      break;
    case 'arcade':
      shadow(g, x, y, 22, 18);
      g.fillStyle = c[0]; g.fillRect(x, y, 22, 18);
      g.fillStyle = '#111'; g.fillRect(x + 3, y + 2, 16, 8);
      g.fillStyle = 'rgba(120,255,160,.6)'; g.fillRect(x + 4, y + 3, 14, 6);
      g.fillStyle = c[1]; g.beginPath(); g.arc(x + 7, y + 14, 1.8, 0, 7); g.fill();
      g.fillStyle = '#e84a4a'; g.beginPath(); g.arc(x + 14, y + 14, 1.4, 0, 7); g.arc(x + 17.5, y + 13, 1.4, 0, 7); g.fill();
      break;
    case 'jukebox':
      shadow(g, x, y, 22, 18);
      g.fillStyle = c[0]; g.beginPath(); g.roundRect(x, y, 22, 18, [10, 10, 2, 2]); g.fill();
      g.fillStyle = c[1]; g.fillRect(x + 4, y + 6, 14, 6);
      g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) g.fillRect(x + 5 + i * 3.4, y + 8, 1.6, 2);
      break;
    case 'safe':
      shadow(g, x, y, 22, 20);
      g.fillStyle = c[0]; g.fillRect(x, y, 22, 20);
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.strokeRect(x + 2, y + 2, 18, 16);
      g.fillStyle = c[1]; g.beginPath(); g.arc(x + 11, y + 10, 4, 0, 7); g.fill();
      g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(x + 11, y + 10, 1.5, 0, 7); g.fill();
      break;
  }
}

export interface RoomOpts {
  placed: Partial<Record<DecorSlot, string>>;
  outfit: Outfit;
  car: CarLook;
  /** Tempo em segundos (anima a gangue) */
  t: number;
}

/** Lugar de cada móvel com sprite: centro x, base y e o tamanho máximo (a sala tem 320 x 200). */
const SPOT: Partial<Record<DecorSlot, { cx: number; bottom: number; w: number; h: number }>> = {
  canto: { cx: 34, bottom: 72, w: 34, h: 54 },
  tv: { cx: 168, bottom: 54, w: 74, h: 42 },
  bar: { cx: 272, bottom: 74, w: 58, h: 58 },
  cama: { cx: 46, bottom: 180, w: 60, h: 96 },
  tapete: { cx: 160, bottom: 140, w: 96, h: 76 },
  mesa: { cx: 160, bottom: 124, w: 72, h: 48 },
  sofa: { cx: 160, bottom: 186, w: 100, h: 42 },
};

function furniture(g: CanvasRenderingContext2D, placed: Partial<Record<DecorSlot, string>>, slot: DecorSlot, fallback?: (g: CanvasRenderingContext2D, i: DecorItem | undefined) => void) {
  const item = get(placed, slot);
  if (!item) return;
  const spot = SPOT[slot];
  if (item.sprite && spot && hasSprite(item.sprite)) {
    // sombra no chão
    g.fillStyle = 'rgba(0,0,0,.22)';
    g.beginPath(); g.ellipse(spot.cx + 2, spot.bottom - 2, spot.w * 0.42, 4, 0, 0, 7); g.fill();
    drawSpriteFit(g, item.sprite, spot.cx, spot.bottom, spot.w, spot.h);
  } else fallback?.(g, item);
}

/** Desenha a sala inteira em coordenadas 0..ROOM_W x 0..ROOM_H (escale o contexto antes). */
export function drawRoom(g: CanvasRenderingContext2D, o: RoomOpts) {
  floor(g, get(o.placed, 'piso'));
  furniture(g, o.placed, 'tapete', rug);
  // garagem
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(232, 132, ROOM_W - WALL - 232, 56);
  g.strokeStyle = '#d9b84a'; g.lineWidth = 1; g.setLineDash([4, 3]);
  g.strokeRect(236, 136, ROOM_W - WALL - 240, 48); g.setLineDash([]);
  drawCar(g, 272, 160, 0, o.car, 2.2);
  walls(g, get(o.placed, 'parede'));
  wallArt(g, get(o.placed, 'quadro'));
  furniture(g, o.placed, 'canto', corner);
  furniture(g, o.placed, 'tv', tv);
  furniture(g, o.placed, 'bar', bar);
  furniture(g, o.placed, 'mesa');
  furniture(g, o.placed, 'cama');
  // gangue: um no bar, dois atrás do sofá
  drawPerson(g, 236, 96 + Math.sin(o.t * 0.8) * 4, Math.PI / 2, o.outfit, o.t * 4, '#111', 4.2);
  drawPerson(g, 132, 150, Math.PI / 2, o.outfit, 0, '#2a1d14', 4.2);
  drawPerson(g, 190, 150, Math.PI, o.outfit, 0, '#4a3222', 4.2);
  furniture(g, o.placed, 'sofa', sofa);
}
