// Imagens para compartilhar: manchete do Jornal da Costa Dourada, ficha criminal e o modo foto.
// Tudo desenhado no canvas com a mesma arte do jogo e sempre com o código de convite no rodapé.
import { BRAND, DIAMOND_ITEMS, DISTRICTS, TROPHIES, formatCash, type PlayerState } from '@gti/shared';
import type { NewsItem, Profile } from '../api';
import { drawCar, drawPerson, drawTreeCanopy, drawTreeShadow, type CarLook, type Outfit } from './draw';
import { carOf, equippedLook, outfitOf, type TuningSet } from './look';
import { spritesReady } from './sprites';
import { asphalt, grass, paving } from './textures';

const display = (size: number, weight = 800) => `${weight} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
const body = (size: number, weight = 500) => `${weight} ${size}px Barlow, system-ui, sans-serif`;
const byId = (id?: string | null) => (id ? DIAMOND_ITEMS.find(i => i.id === id) : undefined);

export const inviteUrl = (code: string) => `${location.origin}/?ref=${code}`;
export const profileUrl = (code: string) => `${location.origin}/?ficha=${code}`;

async function canvas(w: number, h: number) {
  await document.fonts?.ready;
  await spritesReady;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d')!;
  g.textBaseline = 'top';
  return [c, g] as const;
}

/** Faixa de rodapé com o convite: quem vê a imagem sabe onde entrar e com qual código. */
function footer(g: CanvasRenderingContext2D, w: number, h: number, code: string, line = 'Monte sua gangue.') {
  g.fillStyle = '#f2a93b'; g.fillRect(0, h - 120, w, 120);
  g.fillStyle = '#2a1a04'; g.font = display(46); g.textAlign = 'left';
  g.fillText(line, 60, h - 100);
  g.font = body(28, 700);
  g.fillText(`Código de convite: ${code}`, 60, h - 50);
  g.textAlign = 'right'; g.font = display(40);
  g.fillText(BRAND.name.toUpperCase(), w - 60, h - 96);
  g.font = body(26, 600); g.fillText(location.host || 'grandtradeidle', w - 60, h - 50);
  g.textAlign = 'left';
}

function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number, maxLines = 5) {
  const words = text.split(' ');
  let line = '', lines = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y + lines * lineH); line = w; lines++;
      if (lines >= maxLines) return lines;
    } else line = test;
  }
  if (line) { g.fillText(line, x, y + lines * lineH); lines++; }
  return lines;
}

// ---------------- Jornal da Costa Dourada ----------------
const KIND_TAG: Record<string, string> = {
  rare: 'ACHADO RARO', heist: 'GOLPE DO DIA', level: 'SUBIU NA VIDA', territory: 'GUERRA DE BONDES',
  team: 'GOLPE EM EQUIPE', race: 'AUTÓDROMO', auction: 'LEILÃO', crew: 'NOVO BONDE',
};

export async function renderHeadline(n: NewsItem, code: string) {
  const W = 1080, H = 1080;
  const [c, g] = await canvas(W, H);
  // papel de jornal
  g.fillStyle = '#efe7d6'; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(80,60,30,.06)';
  for (let i = 0; i < 1400; i++) g.fillRect((i * 7919) % W, (i * 104729) % (H - 120), 2, 2);
  g.fillStyle = '#16120c';
  g.font = display(92, 900); g.textAlign = 'center';
  g.fillText('JORNAL DA COSTA DOURADA', W / 2, 50, W - 100);
  g.fillRect(60, 160, W - 120, 6); g.fillRect(60, 172, W - 120, 2);
  g.font = body(26, 600);
  g.fillText(new Date(n.at).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase(), W / 2, 188);
  g.textAlign = 'left';
  g.fillStyle = '#b3261e'; g.fillRect(60, 250, 340, 56);
  g.fillStyle = '#fff'; g.font = display(38); g.fillText(KIND_TAG[n.kind] ?? 'URGENTE', 80, 256, 300);
  g.fillStyle = '#16120c'; g.font = display(84, 900);
  const lines = wrap(g, n.text.toUpperCase(), 60, 340, W - 120, 92, 5);
  g.font = body(30, 500); g.fillStyle = '#4a4033';
  g.fillText('A polícia não comenta. A cidade inteira comenta.', 60, 360 + lines * 92, W - 120);
  // foto "granulada" do lugar
  const y0 = 440 + lines * 92;
  const ph = H - 140 - y0;
  if (ph > 120) {
    g.save();
    g.fillStyle = '#2b2b2b'; g.fillRect(60, y0, W - 120, ph);
    g.beginPath(); g.rect(60, y0, W - 120, ph); g.clip();
    g.filter = 'grayscale(1) contrast(1.2)';
    g.translate(60, y0);
    sceneCity(g, W - 120, ph);
    g.filter = 'none';
    g.restore();
  }
  footer(g, W, H, code, 'Seja a próxima manchete.');
  return c;
}

// ---------------- ficha criminal ----------------
export function profileLook(pr: Pick<Profile, 'equipped' | 'tuning'>) {
  const outfit = outfitOf(byId(pr.equipped.character), byId(pr.equipped.jewelry), byId(pr.equipped.weapon));
  const car = carOf(byId(pr.equipped.vehicle), outfit.shirt, pr.tuning as TuningSet);
  return { outfit, car };
}

export async function renderProfile(pr: Profile) {
  const W = 1080, H = 1350;
  const [c, g] = await canvas(W, H);
  const { outfit, car } = profileLook(pr);
  g.fillStyle = '#e9e2cf'; g.fillRect(0, 0, W, H);
  // cabeçalho da delegacia
  g.fillStyle = '#1e2633'; g.fillRect(0, 0, W, 150);
  g.fillStyle = '#ece6da'; g.font = display(70, 900); g.fillText('FICHA CRIMINAL', 60, 36);
  g.font = body(26, 600); g.fillStyle = '#9aa6ba'; g.textAlign = 'right';
  g.fillText(`Nº ${pr.code}`, W - 60, 50); g.fillText('Polícia da Costa Dourada', W - 60, 86); g.textAlign = 'left';
  // foto de frente com régua de altura
  g.fillStyle = '#c9c1aa'; g.fillRect(60, 190, 400, 470);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
  for (let y = 210; y < 650; y += 40) { g.beginPath(); g.moveTo(60, y); g.lineTo(100, y); g.stroke(); }
  g.save(); g.beginPath(); g.rect(60, 190, 400, 470); g.clip();
  drawPerson(g, 260, 420, Math.PI / 2, outfit, 0, '#2a1d14', 30);
  g.restore();
  g.fillStyle = '#16120c'; g.fillRect(140, 600, 240, 46);
  g.fillStyle = '#ece6da'; g.font = display(32); g.textAlign = 'center'; g.fillText(pr.nick.toUpperCase(), 260, 606, 220); g.textAlign = 'left';
  // dados
  g.fillStyle = '#16120c'; g.font = display(92, 900); g.fillText(pr.nick, 500, 180, W - 560);
  g.font = body(30, 600); g.fillStyle = '#4a4033';
  const district = DISTRICTS.find(d => d.id === pr.district)?.name ?? '';
  const facts = [
    `Nível ${pr.level}${pr.vip ? '  ·  ★ Clube Rockeiro' : ''}${pr.founder ? '  ·  Fundador' : ''}`,
    pr.crew ? `Bonde: ${pr.crew.name} [${pr.crew.tag}]` : 'Sem bonde',
    `Visto por último: ${district}`,
    `Na ativa há ${pr.stats.playDays} dia${pr.stats.playDays > 1 ? 's' : ''}`,
  ];
  facts.forEach((f, i) => g.fillText(f, 500, 290 + i * 46, W - 560));
  g.save(); g.translate(760, 560); drawCar(g, 0, 0, 0, car, 9); g.restore();
  // números
  const nums: [string, string][] = [
    ['Grana ganha', formatCash(pr.stats.cashEarned)], ['Maior golpe', formatCash(pr.stats.biggestHeist)],
    ['Assaltos', pr.stats.robberies.toLocaleString('pt-BR')], ['Vezes preso', String(pr.stats.jailed)],
    ['Lavado', formatCash(pr.stats.laundered)], ['Golpes em equipe', String(pr.stats.teamHeists)],
    ['Recorde no Autódromo', `${pr.stats.raceBest} m`], ['Territórios', String(pr.stats.territories)],
  ];
  nums.forEach(([k, v], i) => {
    const x = 60 + (i % 4) * 245, y = 700 + Math.floor(i / 4) * 120;
    g.fillStyle = '#d8cfb6'; g.fillRect(x, y, 230, 104);
    g.fillStyle = '#6b604c'; g.font = body(22, 600); g.fillText(k, x + 16, y + 14, 200);
    g.fillStyle = '#16120c'; g.font = display(44); g.fillText(v, x + 16, y + 44, 200);
  });
  // troféus e raros
  g.fillStyle = '#16120c'; g.font = display(40); g.fillText('Troféus', 60, 960);
  const got = TROPHIES.filter(t => pr.trophies.includes(t.id));
  g.font = body(24, 700);
  let tx = 60, ty = 1014;
  for (const t of got.slice(0, 10)) {
    const w = g.measureText(t.name).width + 36;
    if (tx + w > W - 60) { tx = 60; ty += 50; }
    if (ty > 1080) break;
    g.fillStyle = '#f2a93b'; g.beginPath(); g.roundRect(tx, ty, w, 40, 20); g.fill();
    g.fillStyle = '#2a1a04'; g.fillText(t.name, tx + 18, ty + 8);
    tx += w + 10;
  }
  if (!got.length) { g.fillStyle = '#6b604c'; g.fillText('Ficha limpa… por enquanto.', 60, ty + 6); }
  if (pr.rares.length) {
    g.fillStyle = '#16120c'; g.font = body(26, 700);
    g.fillText(`Raros: ${pr.rares.slice(0, 3).map(r => `${r.name} #${String(r.serial).padStart(4, '0')}`).join(' · ')}`, 60, 1140, W - 120);
  }
  // carimbo
  g.save(); g.translate(880, 1000); g.rotate(-0.22);
  g.strokeStyle = 'rgba(179,38,30,.75)'; g.lineWidth = 8; g.strokeRect(-120, -44, 240, 88);
  g.fillStyle = 'rgba(179,38,30,.75)'; g.font = display(54, 900); g.textAlign = 'center'; g.fillText('PROCURADO', 0, -30);
  g.restore();
  footer(g, W, H, pr.code, 'Veja quem manda na Costa.');
  return c;
}

// ---------------- modo foto ----------------
export type PhotoScene = 'farol' | 'praia' | 'autodromo' | 'centro' | 'ilha';
export const PHOTO_SCENES: { id: PhotoScene; name: string }[] = [
  { id: 'farol', name: 'Farol da Ponta' }, { id: 'praia', name: 'Praia da Orla' }, { id: 'autodromo', name: 'Autódromo' },
  { id: 'centro', name: 'Centro' }, { id: 'ilha', name: 'Ilha do Iate' },
];
export type PhotoPose = 'roda' | 'fila' | 'capo';
export const PHOTO_POSES: { id: PhotoPose; name: string }[] = [{ id: 'roda', name: 'Em volta do carro' }, { id: 'fila', name: 'Em fila' }, { id: 'capo', name: 'No capô' }];

const pat = (g: CanvasRenderingContext2D, tex: HTMLCanvasElement, scale = 1) => {
  const p = g.createPattern(tex, 'repeat')!;
  p.setTransform(new DOMMatrix().scale(scale));
  return p;
};

function water(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const grd = g.createLinearGradient(x, y, x + w, y + h);
  grd.addColorStop(0, '#1f6e8c'); grd.addColorStop(1, '#0f3f5c');
  g.fillStyle = grd; g.fillRect(x, y, w, h);
  g.strokeStyle = 'rgba(255,255,255,.18)'; g.lineWidth = 3;
  for (let i = 0; i < 40; i++) {
    const wx = x + ((i * 397) % w), wy = y + ((i * 211) % h);
    g.beginPath(); g.moveTo(wx, wy); g.quadraticCurveTo(wx + 14, wy - 6, wx + 28, wy); g.stroke();
  }
}

function palms(g: CanvasRenderingContext2D, pts: [number, number, number][]) {
  for (const [x, y, r] of pts) drawTreeShadow(g, x, y, r);
  for (const [x, y, r] of pts) drawTreeCanopy(g, x, y, r, x + y);
}

function sceneCity(g: CanvasRenderingContext2D, w: number, h: number) {
  g.fillStyle = pat(g, paving('#8c8577', 11), 0.5); g.fillRect(0, 0, w, h);
  g.fillStyle = pat(g, asphalt('#3d4150', 12), 0.5); g.fillRect(0, h * 0.42, w, h * 0.3);
  g.fillStyle = 'rgba(235,225,190,.75)';
  for (let x = 20; x < w; x += 90) g.fillRect(x, h * 0.57, 50, 6);
  const roofs = ['#6b5b4b', '#5a6270', '#8a6f55', '#4f5d4a', '#7a5c6b'];
  for (let i = 0; i < 6; i++) {
    g.fillStyle = roofs[i % roofs.length];
    g.fillRect(i * (w / 6) + 10, 10, w / 6 - 20, h * 0.36);
    g.fillRect(i * (w / 6) + 10, h * 0.76, w / 6 - 20, h * 0.24);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(i * (w / 6) + 22, 22, 30, 20);
  }
}

function drawScene(g: CanvasRenderingContext2D, s: PhotoScene, w: number, h: number) {
  if (s === 'centro') { sceneCity(g, w, h); return; }
  if (s === 'autodromo') {
    g.fillStyle = pat(g, grass(13), 0.5); g.fillRect(0, 0, w, h);
    g.fillStyle = pat(g, asphalt('#33363f', 14), 0.5); g.fillRect(0, h * 0.25, w, h * 0.5);
    // zebras e largada
    for (let x = 0; x < w; x += 40) {
      g.fillStyle = (x / 40) % 2 ? '#e8262c' : '#f4f4f2';
      g.fillRect(x, h * 0.25 - 16, 40, 16); g.fillRect(x, h * 0.75, 40, 16);
    }
    for (let y = 0; y < h * 0.5; y += 24) for (let i = 0; i < 2; i++) {
      g.fillStyle = ((y / 24) + i) % 2 ? '#111' : '#f4f4f2';
      g.fillRect(w * 0.82 + i * 24, h * 0.25 + y, 24, 24);
    }
    g.fillStyle = '#c9c1aa'; g.fillRect(0, 0, w, h * 0.12);
    g.fillStyle = '#e8262c'; for (let x = 10; x < w; x += 70) g.fillRect(x, h * 0.04, 50, h * 0.05);
    return;
  }
  if (s === 'praia' || s === 'farol') {
    water(g, 0, 0, w, h);
    g.fillStyle = '#e6d3a3';
    g.beginPath(); g.moveTo(0, h * 0.42); g.bezierCurveTo(w * 0.3, h * 0.36, w * 0.6, h * 0.5, w, h * 0.4); g.lineTo(w, h); g.lineTo(0, h); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(0, h * 0.42); g.bezierCurveTo(w * 0.3, h * 0.36, w * 0.6, h * 0.5, w, h * 0.4); g.stroke();
    if (s === 'praia') {
      g.fillStyle = pat(g, asphalt('#3d4150', 15), 0.5); g.fillRect(0, h * 0.8, w, h * 0.2);
      palms(g, [[w * 0.1, h * 0.62, 40], [w * 0.88, h * 0.6, 46], [w * 0.7, h * 0.72, 34]]);
      // guarda-sol
      for (const [x, y, col] of [[w * 0.3, h * 0.55, '#e8262c'], [w * 0.55, h * 0.58, '#2563eb']] as const) {
        g.fillStyle = col; g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill();
        g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x, y); g.arc(x, y, 30, i * 1.57, i * 1.57 + 0.6); g.fill(); }
      }
    } else {
      // pedras e o farol visto de cima
      g.fillStyle = '#6f6a63';
      for (const [x, y, r] of [[w * 0.78, h * 0.3, 90], [w * 0.68, h * 0.36, 60], [w * 0.9, h * 0.4, 70]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
      g.fillStyle = '#f4f4f2'; g.beginPath(); g.arc(w * 0.8, h * 0.3, 52, 0, 7); g.fill();
      g.fillStyle = '#e8262c'; g.beginPath(); g.arc(w * 0.8, h * 0.3, 52, 0, 7); g.lineWidth = 16; g.strokeStyle = '#e8262c'; g.stroke();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(w * 0.8, h * 0.3, 18, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,240,170,.25)';
      g.beginPath(); g.moveTo(w * 0.8, h * 0.3); g.arc(w * 0.8, h * 0.3, w * 0.7, 3.4, 3.9); g.fill();
      g.fillStyle = pat(g, asphalt('#3d4150', 16), 0.5); g.fillRect(0, h * 0.8, w, h * 0.2);
    }
    return;
  }
  // ilha: água por toda parte, píer e iate
  water(g, 0, 0, w, h);
  g.fillStyle = '#e6d3a3'; g.beginPath(); g.ellipse(w * 0.45, h * 0.6, w * 0.42, h * 0.33, 0, 0, 7); g.fill();
  g.fillStyle = pat(g, grass(17), 0.5); g.beginPath(); g.ellipse(w * 0.45, h * 0.62, w * 0.34, h * 0.24, 0, 0, 7); g.fill();
  g.fillStyle = '#8a6f55'; g.fillRect(w * 0.82, h * 0.48, w * 0.18, 30);
  g.fillStyle = '#f4f4f2'; g.beginPath(); g.ellipse(w * 0.9, h * 0.32, 110, 36, 0, 0, 7); g.fill();
  g.fillStyle = '#18222f'; g.fillRect(w * 0.86, h * 0.3, 70, 18);
  palms(g, [[w * 0.18, h * 0.5, 40], [w * 0.7, h * 0.78, 44]]);
}

export async function renderPhoto(p: PlayerState, scene: PhotoScene, pose: PhotoPose, caption: string) {
  const W = 1080, H = 1080;
  const [c, g] = await canvas(W, H);
  const { outfit, car } = equippedLook(p);
  const photoH = H - 120 - 40;
  // moldura de polaroid
  g.fillStyle = '#f5f1e8'; g.fillRect(0, 0, W, H);
  g.save(); g.beginPath(); g.rect(40, 40, W - 80, photoH - 90); g.clip(); g.translate(40, 40);
  const w = W - 80, h = photoH - 90;
  drawScene(g, scene, w, h);
  poseGang(g, w, h, outfit, car, pose);
  // luz de fim de tarde
  const grd = g.createLinearGradient(0, 0, w, h);
  grd.addColorStop(0, 'rgba(255,180,90,.18)'); grd.addColorStop(1, 'rgba(120,40,140,.12)');
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  g.restore();
  g.fillStyle = '#2a2a2a'; g.font = display(52, 700);
  g.textAlign = 'center';
  g.fillText(caption || `${p.nick} · ${PHOTO_SCENES.find(s => s.id === scene)?.name}`, W / 2, photoH - 30, W - 120);
  g.textAlign = 'left';
  footer(g, W, H, p.referral.code);
  return c;
}

function poseGang(g: CanvasRenderingContext2D, w: number, h: number, outfit: Outfit, car: CarLook, pose: PhotoPose) {
  const cx = w * 0.48, cy = h * 0.6, k = 11;
  drawCar(g, cx, cy, -0.12, car, k);
  const hair = ['#2a1d14', '#111', '#4a3222', '#6b3e1f'];
  const S = 11;
  const spots: [number, number, number][] = pose === 'fila'
    ? [[-330, 150, -Math.PI / 2], [-110, 160, -Math.PI / 2], [110, 160, -Math.PI / 2], [330, 150, -Math.PI / 2]]
    : pose === 'capo'
      ? [[120, -10, Math.PI], [40, -10, Math.PI], [-260, 120, -Math.PI / 2], [260, 130, -Math.PI / 2]]
      : [[-200, -110, 0.6], [210, -120, 2.4], [-210, 130, -0.6], [220, 140, -2.4]];
  spots.forEach(([dx, dy, a], i) => drawPerson(g, cx + dx, cy + dy, a, outfit, 0, hair[i], S));
}
