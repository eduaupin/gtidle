import { useEffect, useRef } from 'react';
import { rarityOf, type DecorSlot, type DiamondItem, type Rarity } from '@gti/shared';
import { drawCar, drawPerson, drawWeapon, type CarLook, type Outfit } from '../game/draw';
import { carOf, outfitOf } from '../game/look';
import { drawSpriteFit, hasSprite, spritesReady } from '../game/sprites';
import { useState } from 'react';
import { ROOM_H, ROOM_W, drawRoom } from '../game/room';

/** Canvas nítido (com devicePixelRatio) que redesenha quando `deps` mudam ou a cada quadro se `animate`. */
export function DrawCanvas({ w, h, draw, deps, animate = false, className, label }: {
  w: number; h: number; draw: (g: CanvasRenderingContext2D, t: number) => void; deps: unknown[];
  animate?: boolean; className?: string; label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { let alive = true; spritesReady.then(() => alive && setLoaded(true)); return () => { alive = false; }; }, []);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d')!;
    let raf = 0;
    const paint = (now: number) => {
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      draw(g, now / 1000);
      if (animate) raf = requestAnimationFrame(paint);
    };
    raf = requestAnimationFrame(paint);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h, animate, loaded, ...deps]);
  return <canvas ref={ref} className={className} style={{ width: w, height: h }} role="img" aria-label={label} />;
}

export { carOf, outfitOf };

const RARITY_BG: Record<Rarity, [string, string]> = {
  comum: ['#4b4f69', '#3a3e55'],
  raro: ['#2f5d8a', '#22344f'],
  epico: ['#6a3d8f', '#2d2142'],
  lendario: ['#a8741a', '#3d2a10'],
};

/** Fundo com brilho no centro, na cor da raridade. */
function backdrop(g: CanvasRenderingContext2D, size: number, r: Rarity) {
  const [a, b] = RARITY_BG[r];
  const grd = g.createRadialGradient(size / 2, size * 0.42, size * 0.05, size / 2, size / 2, size * 0.75);
  grd.addColorStop(0, a); grd.addColorStop(1, b);
  g.fillStyle = grd; g.fillRect(0, 0, size, size);
  if (r === 'lendario' || r === 'epico') {
    g.save(); g.globalAlpha = 0.18; g.strokeStyle = '#fff'; g.lineWidth = size / 40;
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      g.beginPath(); g.moveTo(size / 2, size / 2); g.lineTo(size / 2 + Math.cos(ang) * size, size / 2 + Math.sin(ang) * size); g.stroke();
    }
    g.restore();
  }
}

/** Ícone grande de joia: corrente com pingente, relógio e anéis. */
function drawJewelryIcon(g: CanvasRenderingContext2D, j: NonNullable<DiamondItem['jewelry']>, size: number) {
  const c = size / 2, u = size / 64;
  if (j.chain) {
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 4 * u;
    g.beginPath(); g.arc(c + 1.5 * u, c - 6 * u + 1.5 * u, 17 * u, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    for (let i = 0; i <= 14; i++) {
      const a = 0.15 * Math.PI + (i / 14) * 0.7 * Math.PI;
      g.fillStyle = i % 2 ? j.chain : shade(j.chain);
      g.beginPath(); g.ellipse(c + Math.cos(a) * 17 * u, c - 6 * u + Math.sin(a) * 17 * u, 2.2 * u, 1.6 * u, a, 0, 7); g.fill();
    }
    g.fillStyle = j.chain; g.beginPath(); g.moveTo(c, c + 10 * u); g.lineTo(c + 5 * u, c + 16 * u); g.lineTo(c, c + 22 * u); g.lineTo(c - 5 * u, c + 16 * u); g.fill();
    g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(c, c + 11.5 * u); g.lineTo(c + 2.5 * u, c + 15 * u); g.lineTo(c, c + 16 * u); g.fill();
  }
  if (j.watch) {
    const x = j.chain ? c + 17 * u : c, y = j.chain ? c - 14 * u : c;
    const k = j.chain ? 0.55 : 1;
    g.fillStyle = shade(j.watch); g.fillRect(x - 5 * u * k, y - 16 * u * k, 10 * u * k, 32 * u * k);
    g.fillStyle = j.watch; g.beginPath(); g.arc(x, y, 9 * u * k, 0, 7); g.fill();
    g.fillStyle = '#0f1218'; g.beginPath(); g.arc(x, y, 6.5 * u * k, 0, 7); g.fill();
    g.strokeStyle = j.watch; g.lineWidth = 1.2 * u * k;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 4.5 * u * k); g.moveTo(x, y); g.lineTo(x + 3 * u * k, y); g.stroke();
  }
  if (j.rings) {
    const x0 = j.chain ? c - 22 * u : c - 12 * u, y = j.chain ? c - 16 * u : c + 2 * u, k = j.chain ? 0.6 : 1;
    for (let i = 0; i < 3; i++) {
      g.strokeStyle = j.rings; g.lineWidth = 2.6 * u * k;
      g.beginPath(); g.arc(x0 + i * 10 * u * k, y, 4.5 * u * k, 0, 7); g.stroke();
      g.fillStyle = '#e8fbff'; g.beginPath(); g.arc(x0 + i * 10 * u * k, y - 4.5 * u * k, 1.6 * u * k, 0, 7); g.fill();
    }
  }
}

function shade(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const f = (v: number) => Math.max(0, Math.round(v * 0.7));
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/** Miniatura de um item: roupa (pessoa de cima), carro, joia ou arma, com fundo da raridade. */
export function ItemPreview({ item, size = 72 }: { item: DiamondItem; size?: number }) {
  return (
    <DrawCanvas w={size} h={size} deps={[item.id, size]} className={`preview r-${rarityOf(item)}`} label={item.name} draw={g => {
      backdrop(g, size, rarityOf(item));
      if (item.slot === 'vehicle') {
        const L = item.vehicleType === 'moto' ? 12.5 : 18.5;
        drawCar(g, size / 2, size / 2, -Math.PI / 2, carOf(item, '#3b4252'), (size * 0.86) / L);
      } else if (item.slot === 'character') {
        const sc = size / 8.4, H = 6.6 * sc;
        drawPerson(g, size / 2, (size - H) / 2 + 0.7 * H, Math.PI / 2, outfitOf(item), 0, '#2a1d14', sc);
      } else if (item.sprite && hasSprite(item.sprite)) {
        drawSpriteFit(g, item.sprite, size / 2, size * 0.88, size * 0.8, size * 0.76, false, item.tint);
      } else if (item.slot === 'jewelry' && item.jewelry) {
        drawJewelryIcon(g, item.jewelry, size);
      } else if (item.slot === 'weapon' && item.weapon) {
        g.save(); g.translate(size / 2, size / 2); g.rotate(-Math.PI / 5);
        const len = { taco: 4.6, soco: 1.2, faca: 3, pistola: 2.4, smg: 4.2, escopeta: 6.6, rifle: 6.4 }[item.weapon.kind];
        const k = (size * 0.7) / len;
        g.scale(k, k);
        g.translate(-len / 2, 0);
        drawWeapon(g, item.weapon, 0, 0);
        g.restore();
      } else {
        g.fillStyle = item.color ?? '#888'; g.fillRect(size * 0.2, size * 0.2, size * 0.6, size * 0.6);
        g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(size * 0.2, size * 0.2, size * 0.6, size * 0.12);
      }
    }} />
  );
}

/** A gangue lado a lado com o carro, para a aba Gangue e o card de compartilhar. */
export function GangPreview({ outfit, car, w = 300, h = 120 }: { outfit: Outfit; car: CarLook; w?: number; h?: number }) {
  return (
    <DrawCanvas w={w} h={h} deps={[JSON.stringify(outfit), JSON.stringify(car)]} animate className="gang-preview" label="Sua gangue" draw={(g, t) => {
      g.fillStyle = '#4b4f69'; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(235,225,190,.6)';
      for (let x = 6; x < w; x += 22) g.fillRect(x, h - 18, 11, 2);
      drawCar(g, w * 0.7, h * 0.5, 0, car, h / 34);
      for (let m = 0; m < 3; m++) drawPerson(g, w * 0.12 + m * w * 0.13, h * 0.68, Math.PI / 2, outfit, t * 3 + m, '#2a1d14', h / 11);
    }} />
  );
}

/** A sala do esconderijo, animada. */
export function RoomView({ placed, outfit, car, width }: {
  placed: Partial<Record<DecorSlot, string>>; outfit: Outfit; car: CarLook; width: number;
}) {
  const h = Math.round(width * ROOM_H / ROOM_W);
  return (
    <DrawCanvas w={width} h={h} deps={[JSON.stringify(placed), JSON.stringify(outfit), JSON.stringify(car)]} animate className="room" label="Seu esconderijo" draw={(g, t) => {
      g.scale(width / ROOM_W, h / ROOM_H);
      drawRoom(g, { placed, outfit, car, t });
    }} />
  );
}

/** Miniatura de um móvel do esconderijo. */
export function DecorThumb({ sprite, size = 56, bg = '#3a3e55' }: { sprite: string; size?: number; bg?: string }) {
  return (
    <DrawCanvas w={size} h={size} deps={[sprite, size]} className="preview" label="" draw={g => {
      g.fillStyle = bg; g.fillRect(0, 0, size, size);
      drawSpriteFit(g, sprite, size / 2, size * 0.92, size * 0.86, size * 0.84);
    }} />
  );
}
