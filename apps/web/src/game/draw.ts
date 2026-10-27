// Primitivas de desenho: carros vistos de cima, pedestres, árvores, postes e prédios em
// falsa perspectiva. Carros, pedestres e chão são desenhados em coordenadas do mundo (o
// contexto já está com a transformação da câmera). Prédios usam a projeção da câmera.
import { mix } from './textures';
import { CIVILIANS, drawSprite, drawSpriteFit, hasSprite, pick, spriteSize } from './sprites';
import type { Building } from './city';

export interface Cam {
  x: number; y: number;   // centro da câmera no mundo
  S: number;              // pixels de tela por unidade do mundo (já com devicePixelRatio)
  W: number; H: number;   // tamanho do canvas em pixels
  /** Altura do "olho" em unidades do mundo. Sobe com o zoom para a inclinação ficar constante na tela. */
  eye: number;
}

/** Quanto o olho fica acima do chão em relação à meia-largura visível. Menor = perspectiva mais forte. */
export const EYE_FACTOR = 0.95;
export const eyeFor = (halfViewWidthWorld: number) => Math.max(120, halfViewWidthWorld * EYE_FACTOR);
export const scaleAt = (h: number, eye: number) => eye / (eye - h);

export function project(cam: Cam, x: number, y: number, h: number) {
  const k = scaleAt(h, cam.eye);
  return [cam.W / 2 + (x - cam.x) * cam.S * k, cam.H / 2 + (y - cam.y) * cam.S * k] as const;
}

/** Coloca o contexto em coordenadas do mundo numa altura h (h = 0 é o chão). */
export function setWorld(g: CanvasRenderingContext2D, cam: Cam, h = 0) {
  const s = cam.S * scaleAt(h, cam.eye);
  g.setTransform(s, 0, 0, s, cam.W / 2 - cam.x * s, cam.H / 2 - cam.y * s);
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
}

// ---------------- carros ----------------
export type CarShape = 'sedan' | 'hatch' | 'sport' | 'moto' | 'picape' | 'van';
export interface CarLook {
  color: string;
  kind?: 'car' | 'police' | 'taxi' | 'van' | 'swat';
  /** Formato do veículo; padrão sedan (ou van quando kind = 'van') */
  shape?: CarShape;
  /** Moto: cor da roupa do piloto */
  rider?: string;
  /** Sprite do atlas (vista de cima, frente para cima) */
  sprite?: string;
  /** Raros: faixas de corrida no capô */
  stripe?: string;
  /** Oficina de tuning: pintura, neon embaixo e rodas */
  paint?: string;
  neon?: string;
  wheels?: string;
}

/** Neon embaixo do carro: brilho colorido em volta (desenhado antes da carroceria). */
function drawNeon(g: CanvasRenderingContext2D, L: number, W: number, color: string) {
  g.save();
  g.shadowColor = color; g.shadowBlur = W * 0.9;
  g.globalAlpha = 0.85;
  g.fillStyle = color;
  roundRect(g, -L / 2 - W * 0.08, -W / 2 - W * 0.08, L + W * 0.16, W + W * 0.16, W * 0.35); g.fill();
  g.restore();
}
/** Rodas coloridas: aparecem nas laterais (frente = +x no espaço já girado). */
function drawWheels(g: CanvasRenderingContext2D, L: number, W: number, color: string) {
  g.fillStyle = color;
  const ww = L * 0.16, wh = W * 0.13;
  for (const fx of [L / 2 - L * 0.3, -L / 2 + L * 0.12]) {
    g.fillRect(fx, -W / 2 - wh * 0.45, ww, wh);
    g.fillRect(fx, W / 2 - wh * 0.55, ww, wh);
  }
}

// Sedãs da folha (GRÁTIS) para o trânsito: escolhe o de cor mais parecida
const TRAFFIC_SPRITES: [string, number[]][] = [
  ['car_white', [230, 230, 230]], ['car_silver', [184, 192, 200]], ['car_red', [192, 57, 43]], ['car_blue', [47, 111, 214]],
  ['car_green', [62, 125, 76]], ['car_yellow', [232, 177, 59]], ['car_black', [42, 44, 49]],
];
function nearestCarSprite(color: string) {
  const h = toHex(color);
  const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  let best = TRAFFIC_SPRITES[0][0], bd = Infinity;
  for (const [n, rgb] of TRAFFIC_SPRITES) {
    const d = (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
function carSpriteFor(look: CarLook, shape: CarShape) {
  if (look.sprite) return look.sprite;
  if (look.kind === 'police') return 'car_white';
  if (look.kind === 'taxi') return 'car_yellow';
  if (look.kind === 'swat') return 'vip_black';
  if (shape === 'moto') return 'moto_red';
  return nearestCarSprite(look.color);
}

/** Carro com a arte da folha. Retorna false se o atlas ainda não carregou. */
function drawCarSprite(g: CanvasRenderingContext2D, x: number, y: number, angle: number, look: CarLook, shape: CarShape, scale: number) {
  const name = carSpriteFor(look, shape);
  if (!hasSprite(name)) return false;
  const [sw, sh] = spriteSize(name);
  const L = (shape === 'moto' ? 12.5 : 18.5) * scale;
  const W = L * sw / sh;
  g.save();
  g.translate(x, y);
  // sombra
  g.save(); g.translate(1.6 * scale, 2 * scale); g.rotate(angle);
  g.fillStyle = 'rgba(0,0,0,.32)'; roundRect(g, -L / 2, -W / 2, L, W, W * 0.3); g.fill();
  g.restore();
  if (look.neon) { g.save(); g.rotate(angle); drawNeon(g, L, W, look.neon); g.restore(); }
  g.rotate(angle + Math.PI / 2); // a folha desenha a frente para cima
  drawSprite(g, name, -W / 2, -L / 2, W, L, false, look.paint);
  if (look.wheels) { g.save(); g.rotate(-Math.PI / 2); drawWheels(g, L, W, look.wheels); g.restore(); }
  if (look.stripe) {
    g.fillStyle = look.stripe;
    const sw2 = W * (shape === 'moto' ? 0.12 : 0.08);
    g.fillRect(-sw2 * 1.6, -L * 0.47, sw2, L * 0.94);
    g.fillRect(sw2 * 0.6, -L * 0.47, sw2, L * 0.94);
  }
  if (look.kind === 'police' || look.kind === 'swat') {
    // giroflex no teto e faixa lateral
    const bw = W * 0.62, bh = L * 0.07;
    g.fillStyle = '#e8262c'; g.fillRect(-bw / 2, -bh / 2, bw / 2, bh);
    g.fillStyle = '#2a5cff'; g.fillRect(0, -bh / 2, bw / 2, bh);
    if (look.kind === 'police') {
      g.fillStyle = 'rgba(25,40,90,.9)';
      g.fillRect(-W / 2 + W * 0.04, -L * 0.18, W * 0.07, L * 0.4);
      g.fillRect(W / 2 - W * 0.11, -L * 0.18, W * 0.07, L * 0.4);
    } else {
      g.save(); g.fillStyle = '#e9edf2'; g.font = `800 ${W * 0.28}px "Barlow Condensed", sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SWAT', 0, L * 0.2); g.restore();
    }
  } else if (look.kind === 'taxi') {
    g.fillStyle = '#1d1d1d'; g.fillRect(-W * 0.18, -L * 0.04, W * 0.36, L * 0.08);
    g.fillStyle = '#ffd23f'; g.fillRect(-W * 0.14, -L * 0.025, W * 0.28, L * 0.05);
  }
  g.restore();
  return true;
}

const SIZE: Record<CarShape, [number, number]> = {
  sedan: [17, 9], hatch: [14, 8.6], sport: [18, 8.6], moto: [11, 4.2], picape: [19, 9.2], van: [20, 9.6],
};

export function drawCar(g: CanvasRenderingContext2D, x: number, y: number, angle: number, look: CarLook, scale = 1) {
  const shape: CarShape = look.shape ?? (look.kind === 'van' ? 'van' : 'sedan');
  if (drawCarSprite(g, x, y, angle, look, shape, scale)) return;
  const [l, w] = SIZE[shape];
  const L = l * scale, W = w * scale, k = scale;
  const body = look.kind === 'police' ? '#f4f4f2' : look.kind === 'swat' ? '#262c36' : look.paint ?? look.color;
  const hex = toHex(body);
  g.save();
  g.translate(x, y);
  // sombra (o sol vem do alto à esquerda)
  g.save();
  g.translate(1.6 * k, 2 * k); g.rotate(angle);
  g.fillStyle = 'rgba(0,0,0,.38)';
  roundRect(g, -L / 2, -W / 2, L, W, shape === 'moto' ? 2 * k : 3 * k); g.fill();
  g.restore();
  g.rotate(angle);
  if (look.neon) drawNeon(g, L, W, look.neon);

  if (shape === 'moto') {
    // rodas, tanque, banco e piloto
    g.fillStyle = '#1b1d22';
    roundRect(g, L / 2 - 3.2 * k, -0.9 * k, 3 * k, 1.8 * k, 0.8 * k); g.fill();
    roundRect(g, -L / 2 + 0.2 * k, -0.9 * k, 3 * k, 1.8 * k, 0.8 * k); g.fill();
    roundRect(g, -L / 2 + 2 * k, -W / 2 + 0.4 * k, L - 4 * k, W - 0.8 * k, 1.4 * k);
    g.fillStyle = body; g.fill();
    g.fillStyle = '#2a2a2a'; g.fillRect(L / 2 - 2.6 * k, -2.2 * k, 0.8 * k, 4.4 * k); // guidão
    g.fillStyle = look.rider ?? '#3b4252';
    g.beginPath(); g.ellipse(-0.6 * k, 0, 2 * k, 2.6 * k, 0, 0, 7); g.fill(); // ombros
    g.fillStyle = '#16181d'; g.beginPath(); g.arc(0.6 * k, 0, 1.5 * k, 0, 7); g.fill(); // capacete
    g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(0.9 * k, -0.5 * k, 0.5 * k, 0, 7); g.fill();
    g.fillStyle = '#fff8d0'; g.fillRect(L / 2 - 0.8 * k, -0.6 * k, 0.8 * k, 1.2 * k);
    g.restore();
    return;
  }

  // rodas aparecendo nas laterais
  g.fillStyle = '#121418';
  for (const fx of [L / 2 - 3.4 * k, -L / 2 + 1.4 * k]) {
    g.fillRect(fx, -W / 2 - 0.45 * k, 2.2 * k, 0.9 * k);
    g.fillRect(fx, W / 2 - 0.45 * k, 2.2 * k, 0.9 * k);
  }
  if (look.wheels) drawWheels(g, L, W, look.wheels);
  // carroceria
  roundRect(g, -L / 2, -W / 2, L, W, (shape === 'van' ? 1.6 : 2.8) * k);
  g.fillStyle = body; g.fill();
  g.lineWidth = 0.6 * k; g.strokeStyle = mix(hex, -70); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.18)';
  g.fillRect(-L / 2 + 1 * k, W / 2 - 1.6 * k, L - 2 * k, 1.2 * k);
  g.fillStyle = 'rgba(255,255,255,.22)';
  g.fillRect(-L / 2 + 1 * k, -W / 2 + 0.5 * k, L - 2 * k, 1 * k);

  // posição do para-brisa e do teto por formato (em unidades do carro, frente = +x)
  const glass = '#18222f';
  const cab = {
    sedan: { ws: 3.6, roofFrom: -3.8, roofTo: 3.6, rear: -5.4 },
    hatch: { ws: 2.6, roofFrom: -5.6, roofTo: 2.6, rear: -6.6 },
    sport: { ws: 1.2, roofFrom: -4.4, roofTo: 1.2, rear: -5.6 },
    picape: { ws: 4.4, roofFrom: 0.2, roofTo: 4.4, rear: -0.2 },
    van: { ws: 7.4, roofFrom: -9.2, roofTo: 7.4, rear: -9.6 },
  }[shape];

  if (look.kind === 'police') {
    g.fillStyle = '#1d2230';
    g.fillRect(L / 2 - 4.5 * k, -W / 2 + 0.6 * k, 4 * k, W - 1.2 * k);
    g.fillRect(-L / 2 + 0.6 * k, -W / 2 + 0.6 * k, 3 * k, W - 1.2 * k);
  }
  if (shape === 'picape') {
    // caçamba aberta
    g.fillStyle = mix(hex, -45);
    g.fillRect(-L / 2 + 1 * k, -W / 2 + 1 * k, 8.4 * k, W - 2 * k);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.4 * k;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(-L / 2 + (1 + i * 2.1) * k, -W / 2 + 1 * k); g.lineTo(-L / 2 + (1 + i * 2.1) * k, W / 2 - 1 * k); g.stroke(); }
  }
  // para-brisa
  g.fillStyle = glass;
  g.beginPath();
  g.moveTo(cab.ws * k, -W / 2 + 1.2 * k); g.lineTo((cab.ws + 2) * k, -W / 2 + 1.8 * k);
  g.lineTo((cab.ws + 2) * k, W / 2 - 1.8 * k); g.lineTo(cab.ws * k, W / 2 - 1.2 * k); g.closePath(); g.fill();
  g.fillStyle = 'rgba(150,200,255,.35)';
  g.fillRect((cab.ws + 0.6) * k, -W / 2 + 1.8 * k, 0.7 * k, W - 3.6 * k);
  // retrovisores e linha das portas
  g.fillStyle = mix(hex, -35);
  g.fillRect((cab.ws + 0.4) * k, -W / 2 - 0.8 * k, 1 * k, 0.9 * k);
  g.fillRect((cab.ws + 0.4) * k, W / 2 - 0.1 * k, 1 * k, 0.9 * k);
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 0.3 * k;
  const doorX = shape === 'van' ? [cab.ws - 1.2] : shape === 'picape' ? [cab.ws - 2] : [cab.ws - 1, (cab.ws + cab.roofFrom) / 2 - 0.4];
  g.beginPath();
  for (const dx of doorX) { g.moveTo(dx * k, -W / 2 + 0.2 * k); g.lineTo(dx * k, -W / 2 + 1.3 * k); g.moveTo(dx * k, W / 2 - 1.3 * k); g.lineTo(dx * k, W / 2 - 0.2 * k); }
  g.stroke();
  // vidro traseiro
  g.fillStyle = glass;
  g.fillRect(cab.rear * k, -W / 2 + 1.6 * k, 1.5 * k, W - 3.2 * k);
  // teto
  roundRect(g, cab.roofFrom * k, -W / 2 + 1.5 * k, (cab.roofTo - cab.roofFrom) * k, W - 3 * k, 1.2 * k);
  g.fillStyle = mix(hex, look.kind === 'police' ? -10 : 18); g.fill();
  if (shape === 'van') { // janelas laterais da van
    g.fillStyle = 'rgba(24,34,47,.55)';
    for (let i = 0; i < 3; i++) g.fillRect((-6 + i * 4.4) * k, -W / 2 + 0.4 * k, 3 * k, 0.9 * k);
  }
  if (shape === 'sport') { // aerofólio e faixa
    g.fillStyle = mix(hex, -55); g.fillRect(-L / 2 + 0.4 * k, -W / 2 + 0.8 * k, 1 * k, W - 1.6 * k);
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-L / 2 + 2 * k, -0.6 * k, L - 3 * k, 1.2 * k);
  }
  if (look.kind === 'police' || look.kind === 'swat') {
    // giroflex no teto: metade vermelha, metade azul
    const bw = 1.4 * k, bh = (W - 3.4 * k) / 2;
    g.fillStyle = '#e8262c'; g.fillRect(-bw / 2, -bh, bw, bh);
    g.fillStyle = '#2a5cff'; g.fillRect(-bw / 2, 0, bw, bh);
  }
  if (look.kind === 'swat') {
    g.fillStyle = 'rgba(255,255,255,.85)';
    g.fillRect(-L / 2 + 1.2 * k, -W / 2 + 0.3 * k, L - 2.4 * k, 0.5 * k);
    g.fillRect(-L / 2 + 1.2 * k, W / 2 - 0.8 * k, L - 2.4 * k, 0.5 * k);
    g.save(); g.fillStyle = '#e9edf2'; g.font = `800 ${2.6 * k}px "Barlow Condensed", sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.rotate(Math.PI / 2); g.fillText('SWAT', 0, 4.2 * k); g.restore();
  }
  if (look.kind === 'taxi') { g.fillStyle = '#222'; g.fillRect(-1 * k, -1.2 * k, 2 * k, 2.4 * k); }
  // faróis e lanternas
  g.fillStyle = '#fff8d0';
  g.fillRect(L / 2 - 1 * k, -W / 2 + 1 * k, 1 * k, 1.6 * k);
  g.fillRect(L / 2 - 1 * k, W / 2 - 2.6 * k, 1 * k, 1.6 * k);
  g.fillStyle = '#d43a2f';
  g.fillRect(-L / 2, -W / 2 + 1 * k, 0.8 * k, 1.6 * k);
  g.fillRect(-L / 2, W / 2 - 2.6 * k, 0.8 * k, 1.6 * k);
  g.restore();
}

/** Converte rgb(...) ou #hex em #hex (mix() precisa de hex). */
function toHex(c: string) {
  if (c.startsWith('#')) return c;
  const m = c.match(/\d+/g);
  if (!m) return '#888888';
  return '#' + m.slice(0, 3).map(v => Number(v).toString(16).padStart(2, '0')).join('');
}

// ---------------- pedestres e gangue ----------------
export type WeaponKind = 'taco' | 'soco' | 'faca' | 'pistola' | 'smg' | 'escopeta' | 'rifle';
export interface Outfit {
  shirt: string; pants: string; hat?: string;
  shoes?: string; skin?: string; glasses?: string;
  /** Joias */
  chain?: string; watch?: string; rings?: string;
  /** Arma na mão (só visual) */
  weapon?: { kind: WeaponKind; color: string; accent?: string };
  /** Arte da folha: personagem, acessório e arma */
  sprite?: string;
  acc?: { sprite: string; wear: 'face' | 'neck' | 'torso' | 'hand'; tint?: string };
  gun?: string;
  gunTint?: string;
}

/** Onde cada acessório fica no personagem (frações do sprite, visto de frente) */
const WEAR: Record<string, { u: number; v: number; w: number }> = {
  face: { u: 0.5, v: 0.17, w: 0.5 }, neck: { u: 0.5, v: 0.33, w: 0.42 }, torso: { u: 0.5, v: 0.43, w: 0.66 }, hand: { u: 0.2, v: 0.6, w: 0.24 },
};

const hashStr = (s: string) => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };

/** Pessoa com a arte da folha (vista de frente, espelhada quando anda para a esquerda). */
function drawPersonSprite(g: CanvasRenderingContext2D, x: number, y: number, angle: number, o: Outfit, step: number, scale: number, name: string) {
  const [sw, sh] = spriteSize(name);
  const H = 6.6 * scale, W = H * sw / sh;
  const flip = Math.cos(angle) < -0.2;
  const bob = Math.abs(Math.sin(step)) * H * 0.035;
  const left = x - W / 2, top = y + H * 0.3 - H - bob;
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(x + H * 0.05, y + H * 0.29, W * 0.46, H * 0.08, 0, 0, 7); g.fill();
  drawSprite(g, name, left, top, W, H, flip);
  const at = (u: number) => left + (flip ? 1 - u : u) * W;
  if (o.acc && hasSprite(o.acc.sprite)) {
    const p = WEAR[o.acc.wear];
    const [aw, ah] = spriteSize(o.acc.sprite);
    const w = W * p.w, h = w * ah / aw;
    drawSprite(g, o.acc.sprite, at(p.u) - w / 2, top + H * p.v - h / 2, w, h, flip, o.acc.tint);
  }
  if (o.gun && hasSprite(o.gun)) {
    const [gw, gh] = spriteSize(o.gun);
    const k = Math.min((H / sh) * 0.5, (W * 1.6) / gw);
    const w = gw * k, h = gh * k;
    g.save();
    g.translate(at(0.84), top + H * 0.6);
    g.rotate(flip ? 0.25 : -0.25);
    drawSprite(g, o.gun, flip ? -w * 0.8 : -w * 0.2, -h / 2, w, h, flip, o.gunTint);
    g.restore();
  }
}

/** Arma na mão direita, em coordenadas da pessoa (frente = +x). */
export function drawWeapon(g: CanvasRenderingContext2D, w: NonNullable<Outfit['weapon']>, x: number, y: number) {
  const acc = w.accent ?? mix(toHex(w.color), 50);
  g.save(); g.translate(x, y);
  switch (w.kind) {
    case 'taco':
      g.fillStyle = w.color; g.beginPath(); g.moveTo(0, -0.35); g.lineTo(4.6, -0.7); g.lineTo(4.6, 0.7); g.lineTo(0, 0.35); g.fill();
      g.fillStyle = acc; g.fillRect(-0.4, -0.35, 1, 0.7);
      break;
    case 'soco':
      g.fillStyle = w.color; g.fillRect(0.05, -0.85, 0.3, 1.7);
      g.strokeStyle = w.color; g.lineWidth = 0.16;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(0.55, -0.64 + i * 0.43, 0.2, 0, 7); g.stroke(); }
      break;
    case 'faca':
      g.fillStyle = '#2a2018'; g.fillRect(-0.2, -0.3, 1, 0.6);
      g.fillStyle = w.color; g.beginPath(); g.moveTo(0.8, -0.35); g.lineTo(2.8, 0); g.lineTo(0.8, 0.35); g.fill();
      break;
    case 'pistola':
      g.fillStyle = w.color; g.fillRect(0, -0.35, 2.4, 0.7);
      g.fillStyle = acc; g.fillRect(0.2, -0.2, 1.8, 0.2);
      break;
    case 'smg':
      g.fillStyle = w.color; g.fillRect(-0.6, -0.45, 3.6, 0.9);
      g.fillRect(0.8, 0.4, 0.6, 1.2); // carregador
      g.fillStyle = acc; g.fillRect(2.6, -0.25, 1, 0.5);
      break;
    case 'escopeta':
      g.fillStyle = '#5a3a22'; g.fillRect(-1.6, -0.45, 2, 0.9); // coronha
      g.fillStyle = w.color; g.fillRect(0.2, -0.38, 4.8, 0.76);
      g.fillStyle = acc; g.fillRect(1.2, -0.5, 1.4, 1);
      break;
    case 'rifle':
      g.fillStyle = w.color; g.fillRect(-1.4, -0.42, 6.4, 0.84);
      g.fillRect(1.4, 0.4, 0.7, 1.4);
      g.fillStyle = acc; g.fillRect(0.6, -0.7, 1.8, 0.4); // mira
      break;
  }
  g.restore();
}

export function drawPerson(g: CanvasRenderingContext2D, x: number, y: number, angle: number, look: string | Outfit, step: number, hair = '#2a1d14', scale = 1.45) {
  const o: Outfit = typeof look === 'string' ? { shirt: look, pants: '#2b2f3a' } : look;
  const spriteName = o.sprite ?? (typeof look === 'string' && CIVILIANS.length ? pick(CIVILIANS, hashStr(look + hair)) : undefined);
  if (hasSprite(spriteName)) { drawPersonSprite(g, x, y, angle, o, step, scale, spriteName); return; }
  const skin = o.skin ?? '#b77b52';
  const shirt = toHex(o.shirt);
  g.save();
  g.translate(x, y);
  g.scale(scale, scale);
  g.fillStyle = 'rgba(0,0,0,.3)';
  g.beginPath(); g.ellipse(1, 1.4, 2.8, 2.2, 0, 0, 7); g.fill();
  g.rotate(angle);
  // pernas balançando (cor da calça) e sapatos
  const swing = Math.sin(step) * 1.2;
  g.fillStyle = o.pants;
  g.fillRect(-0.7 + swing, -1.35, 1.7, 0.95);
  g.fillRect(-0.7 - swing, 0.4, 1.7, 0.95);
  g.fillStyle = o.shoes ?? '#1a1a1d';
  g.fillRect(0.7 + swing, -1.35, 0.6, 0.95);
  g.fillRect(0.7 - swing, 0.4, 0.6, 0.95);
  // braços (mangas) balançando ao contrário das pernas, mãos na ponta
  const arm = o.weapon ? 0 : -swing * 0.7;
  g.fillStyle = mix(shirt, -12);
  g.beginPath(); g.ellipse(0.2 + arm, -2.05, 1.05, 0.55, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(o.weapon ? 0.9 : 0.2 - arm, 2.05, 1.05, 0.55, 0, 0, 7); g.fill();
  g.fillStyle = skin;
  g.beginPath(); g.arc(1.2 + arm, -2.05, 0.48, 0, 7); g.fill();
  const handR = { x: o.weapon ? 1.9 : 1.2 - arm, y: 2.05 };
  g.beginPath(); g.arc(handR.x, handR.y, 0.48, 0, 7); g.fill();
  if (o.watch) { g.fillStyle = o.watch; g.fillRect(0.55 + arm, -2.45, 0.42, 0.8); }
  if (o.rings) { g.fillStyle = o.rings; g.beginPath(); g.arc(1.45 + arm, -1.8, 0.2, 0, 7); g.fill(); }
  // tronco (camisa) com luz e sombra
  g.fillStyle = o.shirt;
  g.beginPath(); g.ellipse(0, 0, 1.45, 2.45, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,.2)';
  g.beginPath(); g.ellipse(-0.35, 0.35, 1.05, 2, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,.14)';
  g.beginPath(); g.ellipse(0.45, -0.7, 0.6, 1.1, 0, 0, 7); g.fill();
  // corrente no pescoço com pingente
  if (o.chain) {
    g.strokeStyle = o.chain; g.lineWidth = 0.32;
    g.beginPath(); g.arc(0.3, 0, 1.35, -1.25, 1.25); g.stroke();
    g.fillStyle = o.chain; g.beginPath(); g.arc(1.62, 0, 0.36, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(1.55, -0.12, 0.12, 0, 7); g.fill();
  }
  if (o.weapon) drawWeapon(g, o.weapon, handR.x + 0.2, handR.y);
  // cabeça: cabelo ou boné, óculos
  g.fillStyle = skin;
  g.beginPath(); g.arc(0.45, 0, 1.12, 0, 7); g.fill();
  g.fillStyle = o.hat ?? hair;
  g.beginPath(); g.arc(0.15, 0, 1.12, 0, 7); g.fill();
  if (o.hat) {
    g.fillStyle = mix(toHex(o.hat), -40); g.beginPath(); g.ellipse(1.3, 0, 0.7, 1, 0, -Math.PI / 2, Math.PI / 2); g.fill(); // aba
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(-0.1, -0.35, 0.4, 0, 7); g.fill();
  }
  if (o.glasses) { g.fillStyle = o.glasses; g.fillRect(1.15, -0.85, 0.35, 1.7); }
  g.restore();
}

// ---------------- polícia ----------------
export const COP: Outfit = { shirt: '#1f3a6b', pants: '#16233f', hat: '#0f1e3a' };
export const SWAT_OP: Outfit = { shirt: '#2a2f38', pants: '#1c2027', hat: '#0d0f12', weapon: { kind: 'smg', color: '#15171b' } };

/** Helicóptero da polícia visto de cima. Desenhe no contexto já na altura de voo. */
export function drawHelicopter(g: CanvasRenderingContext2D, x: number, y: number, angle: number, t: number, k = 1, sprite = 'heli_police') {
  if (hasSprite(sprite)) {
    const [sw, sh] = spriteSize(sprite);
    const L = 34 * k, W = L * sw / sh;
    g.save(); g.translate(x, y); g.rotate(angle + Math.PI / 2);
    drawSprite(g, sprite, -W / 2, -L / 2, W, L);
    // hélice girando por cima das pás paradas da arte
    const cy = -L * 0.38;
    g.fillStyle = 'rgba(200,210,225,.14)'; g.beginPath(); g.arc(0, cy, W * 0.5, 0, 7); g.fill();
    g.strokeStyle = 'rgba(20,24,30,.55)'; g.lineWidth = 0.8 * k; g.lineCap = 'round';
    const ra = t * 22;
    for (const a of [ra, ra + Math.PI / 2]) {
      g.beginPath(); g.moveTo(Math.cos(a) * W * 0.5, cy + Math.sin(a) * W * 0.5); g.lineTo(-Math.cos(a) * W * 0.5, cy - Math.sin(a) * W * 0.5); g.stroke();
    }
    g.restore();
    return;
  }
  g.save();
  g.translate(x, y); g.rotate(angle);
  // esquis
  g.fillStyle = '#20242b';
  g.fillRect(-5 * k, -4.6 * k, 10 * k, 0.8 * k); g.fillRect(-5 * k, 3.8 * k, 10 * k, 0.8 * k);
  // cauda
  g.fillStyle = '#1b2640'; g.fillRect(-19 * k, -0.8 * k, 13 * k, 1.6 * k);
  g.fillStyle = '#f4f4f2'; g.fillRect(-19.5 * k, -2.6 * k, 2.2 * k, 5.2 * k);
  // rotor da cauda girando
  g.strokeStyle = 'rgba(210,220,230,.8)'; g.lineWidth = 0.5 * k;
  const ta = t * 40;
  g.beginPath(); g.moveTo(-18.4 * k + Math.cos(ta) * 2.6 * k, Math.sin(ta) * 2.6 * k); g.lineTo(-18.4 * k - Math.cos(ta) * 2.6 * k, -Math.sin(ta) * 2.6 * k); g.stroke();
  // fuselagem
  g.fillStyle = '#1b2640';
  g.beginPath(); g.ellipse(0, 0, 7.5 * k, 3.8 * k, 0, 0, 7); g.fill();
  g.fillStyle = '#f4f4f2'; g.fillRect(-5.5 * k, -3.6 * k, 6 * k, 7.2 * k);
  g.fillStyle = '#1b2640'; g.fillRect(-5.5 * k, -0.6 * k, 6 * k, 1.2 * k);
  // cabine de vidro
  g.fillStyle = '#7fc2ff';
  g.beginPath(); g.ellipse(4.2 * k, 0, 3.2 * k, 3 * k, 0, -Math.PI / 2, Math.PI / 2); g.fill();
  g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(5 * k, -1 * k, 1.2 * k, 0.7 * k, 0.4, 0, 7); g.fill();
  // holofote embaixo do nariz
  g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(6.8 * k, 0, 0.8 * k, 0, 7); g.fill();
  // rotor principal: disco borrado + duas pás
  g.fillStyle = 'rgba(200,210,225,.16)'; g.beginPath(); g.arc(0, 0, 14 * k, 0, 7); g.fill();
  g.strokeStyle = 'rgba(30,34,40,.7)'; g.lineWidth = 0.7 * k; g.lineCap = 'round';
  const ra = t * 22;
  for (const a of [ra, ra + Math.PI / 2]) {
    g.beginPath(); g.moveTo(Math.cos(a) * 14 * k, Math.sin(a) * 14 * k); g.lineTo(-Math.cos(a) * 14 * k, -Math.sin(a) * 14 * k); g.stroke();
  }
  g.fillStyle = '#0e1116'; g.beginPath(); g.arc(0, 0, 1.2 * k, 0, 7); g.fill();
  g.restore();
}

export function drawHelicopterShadow(g: CanvasRenderingContext2D, x: number, y: number, angle: number, k = 1) {
  g.save(); g.translate(x, y); g.rotate(angle);
  g.fillStyle = 'rgba(0,0,0,.28)';
  g.beginPath(); g.ellipse(0, 0, 7.5 * k, 3.8 * k, 0, 0, 7); g.fill();
  g.fillRect(-19 * k, -0.8 * k, 13 * k, 1.6 * k);
  g.fillStyle = 'rgba(0,0,0,.1)'; g.beginPath(); g.arc(0, 0, 14 * k, 0, 7); g.fill();
  g.restore();
}

/** Cone de trânsito laranja (bloqueio de 6 estrelas). */
export function drawCone(g: CanvasRenderingContext2D, x: number, y: number) {
  if (hasSprite('o_cone')) { drawSpriteFit(g, 'o_cone', x, y + 2, 5, 6); return; }
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(x + 0.8, y + 0.8, 1.9, 0, 7); g.fill();
  g.fillStyle = '#ff7a1a'; g.beginPath(); g.arc(x, y, 1.9, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 0.5; g.beginPath(); g.arc(x, y, 1.2, 0, 7); g.stroke();
  g.fillStyle = '#ff9a4a'; g.beginPath(); g.arc(x, y, 0.5, 0, 7); g.fill();
}

/** Cavalete listrado. */
export function drawBarrier(g: CanvasRenderingContext2D, x: number, y: number, angle: number, len = 14) {
  if (hasSprite('o_barrier')) {
    // cavalete em pé, de frente para a câmera: vários lado a lado ao longo da rua
    const n = Math.max(1, Math.round(len / 9));
    for (let i = 0; i < n; i++) {
      const d = (i - (n - 1) / 2) * 9;
      drawSpriteFit(g, 'o_barrier', x + Math.cos(angle) * d, y + Math.sin(angle) * d + 3, 10, 7);
    }
    return;
  }
  g.save(); g.translate(x, y); g.rotate(angle);
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-len / 2 + 0.8, -0.6, len, 2.4);
  for (let i = 0; i < len; i += 2) { g.fillStyle = (i / 2) % 2 ? '#f2f2f2' : '#e0262c'; g.fillRect(-len / 2 + i, -1.2, 2, 2.4); }
  g.restore();
}

// ---------------- árvores e postes ----------------
export function drawTreeShadow(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.fillStyle = 'rgba(0,0,0,.25)';
  g.beginPath(); g.ellipse(x + r * 0.5, y + r * 0.6, r, r * 0.85, 0, 0, 7); g.fill();
}

export function drawTreeCanopy(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  if (hasSprite('o_tree')) {
    const name = Math.floor(seed) % 5 === 0 ? 'f_plant_big' : 'o_tree';
    drawSpriteFit(g, name, x, y + r * 1.05, r * 2.6, r * 2.8);
    return;
  }
  g.fillStyle = '#2f5a24';
  g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
  const blobs = 5;
  for (let i = 0; i < blobs; i++) {
    const a = seed + i * 2.4, d = r * 0.45;
    g.fillStyle = i % 2 ? '#3f7a2e' : '#4a8a34';
    g.beginPath(); g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d, r * 0.55, 0, 7); g.fill();
  }
  g.fillStyle = 'rgba(190,230,120,.35)';
  g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.35, 0, 7); g.fill();
}

// ---------------- prédios ----------------
interface RoofDetail { kind: 'ac' | 'tank' | 'vent' | 'hut'; x: number; y: number; w: number; h: number }
const roofCache = new WeakMap<Building, RoofDetail[]>();

function roofDetails(b: Building): RoofDetail[] {
  let d = roofCache.get(b);
  if (d) return d;
  let s = b.seed;
  const r = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  d = [];
  if (b.kind === 'generic' || b.kind === 'hideout') {
    const n = Math.floor((b.w * b.h) / 900) + 1;
    for (let i = 0; i < n; i++) {
      const kind = (['ac', 'ac', 'vent', 'tank', 'hut'] as const)[Math.floor(r() * 5)];
      const w = kind === 'hut' ? 12 : kind === 'tank' ? 7 : kind === 'ac' ? 6 : 3;
      const h = kind === 'hut' ? 9 : w;
      d.push({ kind, w, h, x: b.x + 5 + r() * Math.max(1, b.w - w - 10), y: b.y + 5 + r() * Math.max(1, b.h - h - 10) });
    }
  }
  roofCache.set(b, d);
  return d;
}

export interface BuildingDrawOpts {
  night: boolean;
  sign?: { text: string; bg: string; fg: string };
  /** Cor de telhado sobrescrita (skin do esconderijo) */
  roofColor?: string;
  /** Desenhos que brilham e vão por cima do escuro da noite */
  emissive: ((g: CanvasRenderingContext2D) => void)[];
}

export function drawBuilding(g: CanvasRenderingContext2D, cam: Cam, b: Building, opts: BuildingDrawOpts) {
  const H = b.height;
  const base = [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]] as const;
  const B = base.map(([x, y]) => project(cam, x, y, 0));
  const R = base.map(([x, y]) => project(cam, x, y, H));
  const normals = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const wallBase = b.wall;

  g.setTransform(1, 0, 0, 1, 0, 0);
  const lit: [number, number][][] = [];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const [nx, ny] = normals[i];
    const mx = (base[i][0] + base[j][0]) / 2, my = (base[i][1] + base[j][1]) / 2;
    if (nx * (cam.x - mx) + ny * (cam.y - my) <= 0) continue; // parede de costas para a câmera
    // luz vem do alto à esquerda: paredes viradas para cima/esquerda mais claras
    const shadeAmt = nx < 0 || ny < 0 ? 10 : -28;
    g.fillStyle = mix(wallBase, shadeAmt);
    g.beginPath();
    g.moveTo(B[i][0], B[i][1]); g.lineTo(B[j][0], B[j][1]); g.lineTo(R[j][0], R[j][1]); g.lineTo(R[i][0], R[i][1]);
    g.closePath(); g.fill();

    // janelas: grade de andares, mapeada na parede por interpolação
    const len = Math.abs(base[j][0] - base[i][0]) + Math.abs(base[j][1] - base[i][1]);
    const cols = Math.max(1, Math.floor(len / 8));
    const floors = b.kind === 'lab' ? 1 : Math.max(1, Math.floor(H / 8));
    const P = (u: number, v: number) => {
      const bx = B[i][0] + (B[j][0] - B[i][0]) * u, by = B[i][1] + (B[j][1] - B[i][1]) * u;
      const rx = R[i][0] + (R[j][0] - R[i][0]) * u, ry = R[i][1] + (R[j][1] - R[i][1]) * u;
      return [bx + (rx - bx) * v, by + (ry - by) * v] as [number, number];
    };
    g.beginPath();
    let k = b.seed + i * 97;
    for (let c = 0; c < cols; c++) for (let f = 0; f < floors; f++) {
      const u0 = (c + 0.3) / cols, u1 = (c + 0.7) / cols;
      const v0 = (f + 0.3) / floors, v1 = (f + 0.75) / floors;
      const q = [P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)];
      k = (k * 1103515245 + 12345) & 0x7fffffff;
      if (opts.night && k % 3 === 0) { lit.push(q); continue; }
      g.moveTo(q[0][0], q[0][1]); g.lineTo(q[1][0], q[1][1]); g.lineTo(q[2][0], q[2][1]); g.lineTo(q[3][0], q[3][1]); g.closePath();
    }
    g.fillStyle = b.kind === 'lab' ? 'rgba(20,24,30,.55)' : 'rgba(22,32,48,.82)';
    g.fill();
    // linha da calçada na base da parede
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(B[i][0], B[i][1]); g.lineTo(B[j][0], B[j][1]); g.stroke();
  }
  if (lit.length) {
    opts.emissive.push(e => {
      e.setTransform(1, 0, 0, 1, 0, 0);
      e.fillStyle = 'rgba(255,214,130,.9)';
      e.beginPath();
      for (const q of lit) { e.moveTo(q[0][0], q[0][1]); for (let n = 1; n < 4; n++) e.lineTo(q[n][0], q[n][1]); e.closePath(); }
      e.fill();
    });
  }

  // Telhado: desenhado em coordenadas do mundo na altura do prédio
  setWorld(g, cam, H);
  const roof = opts.roofColor ?? b.roof;
  g.fillStyle = roof;
  g.fillRect(b.x, b.y, b.w, b.h);
  if (gravelPattern) { g.fillStyle = gravelPattern; g.fillRect(b.x, b.y, b.w, b.h); }
  // mureta
  g.lineWidth = 2;
  g.strokeStyle = mix(roof, -38);
  g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
  g.strokeStyle = 'rgba(255,255,255,.18)';
  g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(b.x + 0.4, b.y + b.h); g.lineTo(b.x + 0.4, b.y + 0.4); g.lineTo(b.x + b.w, b.y + 0.4); g.stroke();

  if (b.kind === 'lab') {
    // telhado de galpão em dente de serra
    for (let x = b.x + 3; x < b.x + b.w - 6; x += 9) {
      g.fillStyle = mix(roof, 18); g.fillRect(x, b.y + 3, 4, b.h - 6);
      g.fillStyle = mix(roof, -30); g.fillRect(x + 4, b.y + 3, 2, b.h - 6);
    }
  }
  for (const d of roofDetails(b)) {
    g.fillStyle = 'rgba(0,0,0,.3)';
    if (d.kind === 'tank') { g.beginPath(); g.arc(d.x + d.w / 2 + 1.5, d.y + d.h / 2 + 1.5, d.w / 2, 0, 7); g.fill(); }
    else g.fillRect(d.x + 1.5, d.y + 1.5, d.w, d.h);
    if (d.kind === 'tank') {
      g.fillStyle = '#7b8a96'; g.beginPath(); g.arc(d.x + d.w / 2, d.y + d.h / 2, d.w / 2, 0, 7); g.fill();
      g.fillStyle = '#9fb0bc'; g.beginPath(); g.arc(d.x + d.w / 2 - 0.8, d.y + d.h / 2 - 0.8, d.w / 3, 0, 7); g.fill();
    } else if (d.kind === 'ac') {
      g.fillStyle = '#c9ccce'; g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = '#7d8286'; g.beginPath(); g.arc(d.x + d.w / 2, d.y + d.h / 2, d.w / 3, 0, 7); g.fill();
    } else if (d.kind === 'vent') {
      g.fillStyle = '#3d4247'; g.fillRect(d.x, d.y, d.w, d.h);
    } else {
      g.fillStyle = mix(roof, -20); g.fillRect(d.x, d.y, d.w, d.h);
      g.fillStyle = '#3a2e24'; g.fillRect(d.x + d.w / 2 - 1.5, d.y + d.h - 1, 3, 1);
    }
  }

  // Placa no telhado (alvos, esconderijo, galpão)
  if (opts.sign) {
    const draw = (e: CanvasRenderingContext2D) => {
      setWorld(e, cam, H + 2);
      const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      e.font = '700 9px "Barlow Condensed", sans-serif';
      const tw = Math.min(b.w - 6, e.measureText(opts.sign!.text).width + 10);
      e.fillStyle = 'rgba(0,0,0,.35)'; e.fillRect(cx - tw / 2 + 1.5, cy - 6 + 1.5, tw, 12);
      e.fillStyle = opts.sign!.bg; e.fillRect(cx - tw / 2, cy - 6, tw, 12);
      e.fillStyle = opts.sign!.fg; e.textAlign = 'center'; e.textBaseline = 'middle';
      e.fillText(opts.sign!.text, cx, cy + 0.5, tw - 4);
    };
    // à noite a placa acende e fica por cima do escuro
    if (opts.night) opts.emissive.push(draw); else draw(g);
  }
}

let gravelPattern: CanvasPattern | null = null;
export function setGravelPattern(p: CanvasPattern | null) { gravelPattern = p; }
