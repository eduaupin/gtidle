// Geração da cidade: ruas em grade, quarteirões com calçada larga de cantos arredondados,
// prédios com altura (para a falsa perspectiva), árvores, postes e caminhos de pedestres.
// Tudo é determinístico por distrito: o mesmo distrito sempre gera a mesma cidade.
import { DISTRICTS, ROBBERIES, type DistrictId, type RobberyJob, type Terrain } from '@gti/shared';

export const TILE = 16;
export const COLS = 48;
export const ROWS = 30;
export const WIDTH = COLS * TILE;
export const HEIGHT = ROWS * TILE;
const ROAD = 2;              // ruas com 2 tiles (uma faixa por sentido)
export const ROAD_W = ROAD * TILE;
export const SIDEWALK = 13;  // largura da calçada em unidades do mundo
export const CURB_RADIUS = 14;

/** Nome curto que aparece na placa do alvo */
export const BUILDING_LABEL: Record<string, string> = {
  rua: 'Calçadão', banca: 'Banca', loja: 'Conveniência', posto: 'Posto',
  garagem: 'Estacionamento', porto: 'Cais', joalheria: 'Joalheria', banco: 'Banco',
};

export interface Rect { x: number; y: number; w: number; h: number }

export interface Building extends Rect {
  kind: 'generic' | 'target' | 'lab' | 'hideout';
  /** Altura em unidades do mundo (a perspectiva usa isto) */
  height: number;
  roof: string;
  wall: string;
  seed: number;
  jobId?: string;
  label?: string;
}

export interface Block extends Rect {
  /** Área interna (sem a calçada) */
  inner: Rect;
  ground: 'lot' | 'park' | 'plaza' | 'water' | 'beach' | 'field' | 'marsh' | 'runway' | 'containers';
}

export interface Prop { kind: 'tree' | 'lamp' | 'bin'; x: number; y: number; r: number }

export interface DistrictStyle {
  paving: string; asphalt: string; lot: string; roofs: string[]; walls: string[]; sign: string;
}

export const STYLES: Record<DistrictId, DistrictStyle> = {
  periferia: { paving: '#b9ae8c', asphalt: '#4b4f69', lot: '#8d877a', sign: '#e8c547',
    roofs: ['#8a6f55', '#a0826a', '#7a6a5c', '#9a8c7a', '#6f7a6a', '#a3754f'], walls: ['#7b4a36', '#8a6a52', '#6e5d4c'] },
  porto: { paving: '#a2a6a8', asphalt: '#3f4559', lot: '#7f8488', sign: '#3fb8c9',
    roofs: ['#6b7b88', '#7f8c96', '#5b6770', '#8e7f6a', '#a35f45'], walls: ['#4f5a63', '#5d5348', '#3f4a52'] },
  centro: { paving: '#cbc5b5', asphalt: '#474a61', lot: '#9b978d', sign: '#f25f5c',
    roofs: ['#9a9aa8', '#b3aea2', '#7d8190', '#a69584', '#8c8c8c'], walls: ['#5d6170', '#6b6358', '#4c5260'] },
  orla: { paving: '#dbc9a2', asphalt: '#4c4b62', lot: '#b3a58a', sign: '#ff4fb0',
    roofs: ['#e0b483', '#d99a8a', '#c9d1c3', '#f0d7a8', '#9fd3c7'], walls: ['#b98e6b', '#c98d7e', '#8fb3a8'] },
  marina: { paving: '#d9dfe1', asphalt: '#404b5e', lot: '#b6bcbf', sign: '#7cf2c9',
    roofs: ['#d9e2e6', '#bcc8cc', '#e8e0d0', '#9fb4c0'], walls: ['#9aa6ab', '#b7ab94', '#7f97a3'] },
  mansoes: { paving: '#c6a37d', asphalt: '#45473f', lot: '#a48f72', sign: '#ffd23f',
    roofs: ['#c9a46b', '#b5654a', '#d2b48c', '#a34f3a'], walls: ['#e2d3b5', '#d6c09a', '#c9b08e'] },
  aeroporto: { paving: '#b5b8bb', asphalt: '#3d4150', lot: '#8f9396', sign: '#ffb000',
    roofs: ['#9aa3ab', '#c4c9cd', '#7d868e', '#e0e3e5'], walls: ['#6b737a', '#8a9399', '#5b6268'] },
  pantano: { paving: '#a59a78', asphalt: '#4a4d48', lot: '#7d7a5a', sign: '#9bd14b',
    roofs: ['#7a6a4a', '#8a7a5a', '#6b5a3a', '#5a6a4a'], walls: ['#5a4a32', '#6a5a3a', '#4a4030'] },
  autodromo: { paving: '#b2ab8e', asphalt: '#45485a', lot: '#8d8a72', sign: '#ff6b2c',
    roofs: ['#c94c4c', '#e8e1d0', '#8a6f55', '#4c6b8a'], walls: ['#8a5a4a', '#a89a80', '#5a5a5a'] },
  lagoa: { paving: '#d0c3a0', asphalt: '#474b5c', lot: '#a8a088', sign: '#4fd1c5',
    roofs: ['#d9c7a6', '#e8d9b8', '#b8a68a', '#9fd3c7'], walls: ['#c0ab88', '#a89474', '#8fb3a8'] },
  vila_norte: { paving: '#bdb5a0', asphalt: '#454a5a', lot: '#94907e', sign: '#7cb7ff',
    roofs: ['#a8a090', '#8a8478', '#b5a58a', '#7a8a9a'], walls: ['#6b6558', '#7a7262', '#5a6068'] },
  porto_oeste: { paving: '#a8a49a', asphalt: '#3f4556', lot: '#857f74', sign: '#ff9f43',
    roofs: ['#8e7f6a', '#a35f45', '#6b7b88', '#b58a5a'], walls: ['#5d5348', '#4f5a63', '#6a5a48'] },
  mata: { paving: '#a8956e', asphalt: '#4a4840', lot: '#7a6a50', sign: '#e85d3c',
    roofs: ['#8a5a3a', '#6b4a2a', '#9a6a4a', '#5a4a3a'], walls: ['#5a3a2a', '#4a3a2a', '#6a4a32'] },
  ilhotas: { paving: '#e0d0a8', asphalt: '#4a4e60', lot: '#bcae8c', sign: '#3fe0ff',
    roofs: ['#f0d7a8', '#9fd3c7', '#e8b88a', '#c9d1c3'], walls: ['#c8b08a', '#a8c0b8', '#d8a888'] },
  ilha_sol: { paving: '#e8d8b0', asphalt: '#4a4e60', lot: '#c4b490', sign: '#ffd23f',
    roofs: ['#ffe0a8', '#f2c48a', '#e8e8e0', '#ffb8a8'], walls: ['#d8c098', '#e0b090', '#c8c8c0'] },
  farol: { paving: '#d0d4d4', asphalt: '#404a58', lot: '#a8b0b0', sign: '#ff5252',
    roofs: ['#e8e8e8', '#c94c4c', '#b8c4c8', '#d8d0c0'], walls: ['#a8b0b0', '#8a9498', '#b8a898'] },
};

/** Ajustes de cenário por tipo de terreno */
const TERRAIN: Record<Terrain, { height: number }> = {
  city: { height: 1 }, beach: { height: 0.85 }, port: { height: 0.75 }, airport: { height: 0.6 },
  swamp: { height: 0.45 }, rural: { height: 0.45 }, forest: { height: 0.4 }, island: { height: 0.7 },
};

export interface CityLayout {
  district: DistrictId;
  style: DistrictStyle;
  roadRows: number[]; // y (mundo) do centro de cada rua horizontal
  roadCols: number[]; // x (mundo) do centro de cada rua vertical
  blocks: Block[];
  buildings: Building[];
  props: Prop[];
  /** Caminhos fechados pelas calçadas para os pedestres */
  walkways: Rect[];
  hideout: Building;
  lab: Building;
}

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildCity(district: DistrictId): CityLayout {
  const style = STYLES[district];
  const rand = rng(district.split('').reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7));
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  // Ruas: linhas e colunas de 2 tiles
  const rowStarts = [2, 10, 18, 26];
  const colStarts = [2, 12, 22, 32, 42];
  const roadRows = rowStarts.map(r => (r + ROAD / 2) * TILE);
  const roadCols = colStarts.map(c => (c + ROAD / 2) * TILE);

  // Quarteirões = espaços entre ruas (inclui as bordas do mapa)
  const ys = [0, ...rowStarts.map(r => r + ROAD)], ye = [...rowStarts, ROWS];
  const xs = [0, ...colStarts.map(c => c + ROAD)], xe = [...colStarts, COLS];
  const blocks: Block[] = [];
  for (let i = 0; i < ys.length; i++) for (let j = 0; j < xs.length; j++) {
    const x = xs[j] * TILE, y = ys[i] * TILE, w = (xe[j] - xs[j]) * TILE, h = (ye[i] - ys[i]) * TILE;
    if (w <= 0 || h <= 0) continue;
    const inner = { x: x + SIDEWALK, y: y + SIDEWALK, w: w - SIDEWALK * 2, h: h - SIDEWALK * 2 };
    blocks.push({ x, y, w, h, inner, ground: inner.w < 30 || inner.h < 30 ? 'plaza' : 'lot' });
  }

  // Quarteirões "cheios" (que cabem prédio), na ordem de leitura
  const full = blocks.filter(b => b.ground === 'lot');
  const jobs = ROBBERIES.filter(r => r.district === district);
  const reserved = new Map<Block, RobberyJob | 'hideout' | 'lab'>();
  reserved.set(full[0], 'hideout');
  reserved.set(full[full.length - 1], 'lab');
  const targetSlots = [6, 2, 12, 8, 11, 7]; // evita a coluna estreita da borda
  jobs.forEach((j, i) => reserved.set(full[targetSlots[i % targetSlots.length] % full.length], j));
  // Cenário: cada tipo de terreno troca o chão de alguns quarteirões livres
  const terrain = DISTRICTS.find(d => d.id === district)?.terrain ?? 'city';
  const free = full.filter(b => !reserved.has(b));
  const maxX = Math.max(...blocks.map(b => b.x)), maxY = Math.max(...blocks.map(b => b.y));
  const east = (b: Block) => b.x === maxX, south = (b: Block) => b.y === maxY;
  const some = (list: Block[], frac: number, ground: Block['ground']) => {
    const pool = list.filter(b => b.ground === 'lot');
    for (let k = Math.round(pool.length * frac); k > 0 && pool.length; k--) pool.splice(Math.floor(rand() * pool.length), 1)[0].ground = ground;
  };
  // a borda leste e a sul também mudam, mesmo os quarteirões estreitos
  const edge = blocks.filter(b => !reserved.has(b));
  switch (terrain) {
    case 'beach': edge.filter(east).forEach(b => { b.ground = 'beach'; }); some(free, 0.15, 'park'); break;
    case 'port': edge.filter(south).forEach(b => { b.ground = 'water'; }); some(free, 0.3, 'containers'); break;
    case 'island': edge.filter(b => east(b) || south(b)).forEach(b => { b.ground = east(b) && !south(b) ? 'beach' : 'water'; }); some(free, 0.15, 'park'); break;
    case 'airport': some(free, 0.35, 'runway'); some(free, 0.2, 'containers'); break;
    case 'swamp': some(free, 0.6, 'marsh'); edge.filter(south).forEach(b => { if (b.ground === 'lot' || b.ground === 'plaza') b.ground = 'water'; }); break;
    case 'rural': some(free, 0.6, 'field'); some(free, 0.2, 'park'); break;
    case 'forest': some(free, 0.7, 'park'); some(free, 0.3, 'field'); break;
    default: some(free, 0.12, 'park');
  }
  const hMult = TERRAIN[terrain].height;

  const buildings: Building[] = [];
  let hideout!: Building, lab!: Building;
  const mk = (r: Rect, kind: Building['kind'], height: number, extra: Partial<Building> = {}): Building => ({
    ...r, kind, height, roof: pick(style.roofs), wall: pick(style.walls), seed: Math.floor(rand() * 1e9), ...extra,
  });

  for (const b of full) {
    if (b.ground !== 'lot') continue;
    const inner = b.inner;
    const r = reserved.get(b);
    if (r === 'hideout') {
      hideout = mk(inner, 'hideout', 16, { label: 'Esconderijo', roof: '#6b5a3a', wall: '#4a3b2a' });
      buildings.push(hideout);
      continue;
    }
    if (r === 'lab') {
      lab = mk(inner, 'lab', 13, { label: 'Galpão', roof: '#6f7378', wall: '#53575c' });
      buildings.push(lab);
      continue;
    }
    if (r) {
      const half = Math.floor(inner.w * 0.5);
      buildings.push(mk({ x: inner.x, y: inner.y, w: half - 3, h: inner.h }, 'target', Math.max(12, (18 + rand() * 6) * hMult),
        { jobId: r.id, label: BUILDING_LABEL[r.building] ?? r.name }));
      buildings.push(mk({ x: inner.x + half + 3, y: inner.y, w: inner.w - half - 3, h: inner.h }, 'generic', Math.max(10, (26 + rand() * 22) * hMult)));
      continue;
    }
    // 1 a 3 prédios por quarteirão, alturas variadas
    const n = 1 + Math.floor(rand() * 3);
    const w = inner.w / n;
    for (let k = 0; k < n; k++) {
      const gap = 3;
      buildings.push(mk({ x: inner.x + k * w + (k ? gap : 0), y: inner.y, w: w - (k ? gap : 0) - (k < n - 1 ? gap : 0), h: inner.h },
        'generic', Math.max(9, (18 + rand() * 34) * hMult)));
    }
  }

  // Enfeites nas calçadas: árvores, postes e lixeiras
  const props: Prop[] = [];
  const walkways: Rect[] = [];
  for (const b of blocks) {
    const m = SIDEWALK / 2;
    if (b.ground === 'water') continue;
    walkways.push({ x: b.x + m, y: b.y + m, w: b.w - 2 * m, h: b.h - 2 * m });
    // postes nos quatro cantos
    for (const [cx, cy] of [[b.x + m, b.y + m], [b.x + b.w - m, b.y + m], [b.x + m, b.y + b.h - m], [b.x + b.w - m, b.y + b.h - m]]) {
      if (rand() < 0.7) props.push({ kind: 'lamp', x: cx, y: cy, r: 2 });
    }
    // árvores ao longo do lado de cima e de baixo
    if ((b.ground === 'lot' || b.ground === 'park') && rand() < 0.6) {
      for (let x = b.x + 30; x < b.x + b.w - 24; x += 34 + rand() * 16) {
        props.push({ kind: 'tree', x, y: rand() < 0.5 ? b.y + m : b.y + b.h - m, r: 7 + rand() * 3 });
      }
    }
    if (rand() < 0.5) props.push({ kind: 'bin', x: b.x + b.w / 2 + (rand() - 0.5) * 20, y: b.y + b.h - m, r: 2.2 });
  }
  // Parques cheios de árvores
  for (const b of blocks.filter(x => x.ground === 'park' || x.ground === 'marsh')) {
    const density = b.ground === 'marsh' ? 1400 : terrain === 'forest' ? 260 : 450;
    for (let k = 0; k < Math.floor((b.inner.w * b.inner.h) / density); k++) {
      props.push({ kind: 'tree', x: b.inner.x + 8 + rand() * (b.inner.w - 16), y: b.inner.y + 8 + rand() * (b.inner.h - 16), r: 8 + rand() * 5 });
    }
  }

  return { district, style, roadRows, roadCols, blocks, buildings, props, walkways, hideout, lab };
}

export const center = (b: Rect) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

const nearest = (arr: number[], v: number) => arr.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));

/** Caminho pelas ruas do esconderijo até o alvo (3 trechos em L), na faixa da direita. */
export function routeBetween(city: CityLayout, from: Rect, to: Rect) {
  const a = center(from), b = center(to);
  const rowA = nearest(city.roadRows, a.y), rowB = nearest(city.roadRows, b.y);
  const colB = nearest(city.roadCols, b.x);
  return [
    { x: a.x, y: rowA },
    { x: colB, y: rowA },
    { x: colB, y: rowB },
    { x: b.x, y: rowB },
  ];
}

export function pointOnPath(path: { x: number; y: number }[], f: number) {
  const segs = path.slice(1).map((p, i) => ({ a: path[i], b: p, len: Math.hypot(p.x - path[i].x, p.y - path[i].y) }));
  const total = segs.reduce((s, x) => s + x.len, 0) || 1;
  let dist = Math.max(0, Math.min(1, f)) * total;
  for (const s of segs) {
    if (dist <= s.len && s.len > 0) {
      const k = dist / s.len;
      return { x: s.a.x + (s.b.x - s.a.x) * k, y: s.a.y + (s.b.y - s.a.y) * k, angle: Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x) };
    }
    dist -= s.len;
  }
  const last = [...segs].reverse().find(s => s.len > 0) ?? segs[segs.length - 1];
  return { ...last.b, angle: Math.atan2(last.b.y - last.a.y, last.b.x - last.a.x) };
}

/** Ponto a uma distância `d` percorrendo o contorno de um retângulo (para pedestres). */
export function pointOnLoop(r: Rect, d: number) {
  const per = 2 * (r.w + r.h);
  d = ((d % per) + per) % per;
  if (d < r.w) return { x: r.x + d, y: r.y };
  d -= r.w;
  if (d < r.h) return { x: r.x + r.w, y: r.y + d };
  d -= r.h;
  if (d < r.w) return { x: r.x + r.w - d, y: r.y + r.h };
  d -= r.w;
  return { x: r.x, y: r.y + r.h - d };
}
