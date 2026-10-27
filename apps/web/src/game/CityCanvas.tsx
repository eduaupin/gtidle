// Renderizador da cidade: câmera próxima que segue a gangue, chão com textura, prédios em falsa
// perspectiva (as paredes "tombam" a partir do centro da tela), trânsito, pedestres e minimapa.
// Arraste para mover, roda do mouse para zoom, clique num alvo para abrir o assalto.
import { useEffect, useMemo, useRef, useState } from 'react';
import { DIAMOND_ITEMS, DISTRICTS, HEIST_PLANS, ROBBERIES, RULES, isJailed, isNight, isTurbo, starsFor, type PlayerState } from '@gti/shared';
import {
  CURB_RADIUS, HEIGHT, ROAD_W, WIDTH, buildCity, type Block, type Rect, center, pointOnLoop, pointOnPath, routeBetween, type CityLayout,
} from './city';
import { asphalt, concrete, grass, gravel, paving, worldPattern } from './textures';
import {
  COP, SWAT_OP, drawBarrier, drawCone, drawHelicopter, drawHelicopterShadow,
  drawBuilding, drawCar, drawPerson, drawTreeCanopy, drawTreeShadow, eyeFor, project, scaleAt, setGravelPattern, setWorld,
  type Cam, type CarLook,
} from './draw';
import { equippedLook } from './look';
import { CIVILIANS, COPS, SWATS, THUGS, drawSpriteFit, hasSprite, pick } from './sprites';

interface Props {
  children?: React.ReactNode;
  player: PlayerState;
  fetchedAt: number;
  onSelectJob?: (jobId: string) => void;
}

interface Car { horizontal: boolean; road: number; dir: 1 | -1; pos: number; speed: number; look: CarLook }
interface Walker { loop: number; d: number; speed: number; shirt: string; hair: string; sprite: string }

const TRAFFIC: CarLook[] = [
  { color: '#c94c4c' }, { color: '#4c7ac9', shape: 'hatch' }, { color: '#e6e6e6', shape: 'van' }, { color: '#2f3238' },
  { color: '#e8b13b', kind: 'taxi' }, { color: '#4cc98a', shape: 'moto', rider: '#2b2b2b' }, { color: '#7d8a3c', shape: 'picape' },
  { color: '#e07a4c', shape: 'hatch' }, { color: '#6a5acd', shape: 'van' }, { color: '#b8c4cc' }, { color: '#d64545', shape: 'sport' },
  { color: '#2b6bff', shape: 'moto', rider: '#e8e1d0' },
];
const SHIRTS = ['#d64545', '#3f7fd6', '#e8e1d0', '#2b2b2b', '#e8a33b', '#5aa66a', '#9b59b6', '#f2f2f2'];
const HAIR = ['#2a1d14', '#4a3222', '#111', '#8a6a3a', '#bbb'];

const MAX_ZOOM = 6;

const MINIMAP_GROUND: Partial<Record<string, string>> = {
  park: '#4f7d33', water: '#2a6f97', beach: '#e3cf9a', field: '#8fa84a', marsh: '#4a5a32', runway: '#3a3d44', containers: '#8f8f8f',
};

/** Mar, rio ou canal: ocupa o quarteirão todo, com areia na borda e ondas. */
function drawWater(g: CanvasRenderingContext2D, b: Rect, t: number) {
  g.fillStyle = '#d8c48e'; g.fillRect(b.x, b.y, b.w, b.h);
  g.fillStyle = '#2a6f97'; g.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
  g.fillStyle = '#3a86b0'; g.fillRect(b.x + 5, b.y + 5, b.w - 10, 6);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
  for (let y = b.y + 14; y < b.y + b.h - 6; y += 12) {
    g.beginPath();
    for (let x = b.x + 8; x < b.x + b.w - 8; x += 4) g.lineTo(x, y + Math.sin(x * 0.12 + t * 1.6 + y) * 1.4);
    g.stroke();
  }
}

/** Chão especial dentro do quarteirão: praia, plantação, mangue, pista e pátio de contêineres. */
function drawGround(g: CanvasRenderingContext2D, b: Block, t: number) {
  const r = b.inner;
  switch (b.ground) {
    case 'beach': {
      g.fillStyle = '#e3cf9a'; g.fillRect(r.x, r.y, r.w, r.h);
      const wx = r.x + r.w * 0.5;
      g.fillStyle = '#2a7fa8'; g.fillRect(wx, b.y, b.x + b.w - wx, b.h);
      g.fillStyle = 'rgba(255,255,255,.55)';
      for (let y = b.y; y < b.y + b.h; y += 3) g.fillRect(wx + Math.sin(y * 0.2 + t * 2) * 2, y, 2, 2);
      const cols = ['#ff4f6d', '#ffd23f', '#3fb8c9', '#7cf2c9'];
      for (let k = 0; k < Math.floor(r.h / 26); k++) {
        const ux = r.x + 8 + (k % 2) * 14, uy = r.y + 10 + k * 26;
        g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.arc(ux + 2, uy + 2, 6, 0, 7); g.fill();
        g.fillStyle = cols[k % cols.length]; g.beginPath(); g.arc(ux, uy, 6, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(ux, uy, 2, 0, 7); g.fill();
      }
      break;
    }
    case 'field':
      g.fillStyle = '#7a8f3a'; g.fillRect(r.x, r.y, r.w, r.h);
      for (let y = r.y + 2; y < r.y + r.h; y += 6) { g.fillStyle = y % 12 < 6 ? '#9db04a' : '#c9b85a'; g.fillRect(r.x + 2, y, r.w - 4, 3); }
      break;
    case 'marsh':
      g.fillStyle = '#4a5a32'; g.fillRect(r.x, r.y, r.w, r.h);
      for (let k = 0; k < 6; k++) {
        const px = r.x + ((k * 37) % Math.max(1, r.w - 20)) + 10, py = r.y + ((k * 53) % Math.max(1, r.h - 16)) + 8;
        g.fillStyle = '#3d5a5a'; g.beginPath(); g.ellipse(px, py, 10 + (k % 3) * 4, 6, k, 0, 7); g.fill();
        g.fillStyle = 'rgba(160,200,200,.25)'; g.beginPath(); g.ellipse(px - 2, py - 1, 4, 2, k, 0, 7); g.fill();
      }
      break;
    case 'runway':
      g.fillStyle = '#34373e'; g.fillRect(r.x, r.y, r.w, r.h);
      g.fillStyle = '#f2f2f2';
      g.fillRect(r.x + 3, r.y + 3, r.w - 6, 1.2); g.fillRect(r.x + 3, r.y + r.h - 4.2, r.w - 6, 1.2);
      for (let x = r.x + 8; x < r.x + r.w - 10; x += 16) g.fillRect(x, r.y + r.h / 2 - 0.8, 9, 1.6);
      for (let k = 0; k < 6; k++) g.fillRect(r.x + 4, r.y + 8 + k * ((r.h - 16) / 6), 6, 2);
      break;
    case 'containers': {
      g.fillStyle = '#7d7f80'; g.fillRect(r.x, r.y, r.w, r.h);
      const cc = ['#c0392b', '#2f6fd6', '#e8a33b', '#3e7d4c', '#8e44ad', '#d35400'];
      let k = 0;
      for (let y = r.y + 4; y < r.y + r.h - 8; y += 10) for (let x = r.x + 4; x < r.x + r.w - 20; x += 22) {
        if ((k * 7) % 5 === 0) { k++; continue; }
        g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 1.5, y + 1.5, 19, 7);
        g.fillStyle = cc[k++ % cc.length]; g.fillRect(x, y, 19, 7);
        g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 2; i < 19; i += 3) g.fillRect(x + i, y, 0.6, 7);
      }
      break;
    }
  }
}
/** Objetos de calçada da folha (lixeiras, bancas de jornal, banco, caixa eletrônico...) */
const STREET_PROPS = ['o_trash_yellow', 'o_news_red', 'o_news_blue', 'o_bench', 'o_trash_tall', 'o_atm', 'o_phone', 'o_bag', 'o_crate', 'o_planter_small', 'o_bench_vip', 'o_box_yellow'];

export default function CityCanvas({ player, fetchedAt, onSelectJob, children }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const city = useMemo(() => buildCity(player.district), [player.district]);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [follow, setFollow] = useState(true);
  const followRef = useRef(true);
  followRef.current = follow;
  const cam = useRef({ x: WIDTH / 2, y: HEIGHT / 2, zoom: 3 });
  const zoomTouched = useRef(false);
  const playerRef = useRef(player);
  const fetchedRef = useRef(fetchedAt);
  playerRef.current = player;
  fetchedRef.current = fetchedAt;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);

  // O canvas ocupa todo o espaço do mapa
  useEffect(() => {
    const el = frameRef.current!;
    const fit = () => {
      const r = el.getBoundingClientRect();
      const mobile = window.innerWidth <= 900;
      const w = Math.max(240, Math.floor(r.width));
      const h = mobile ? Math.round(w * 0.78) : Math.max(240, Math.floor(r.height));
      setSize({ w, h });
      // zoom inicial proporcional à largura: perto no PC, um pouco mais aberto no celular
      if (!zoomTouched.current) cam.current.zoom = Math.max(1.3, Math.min(3.2, w / 420));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const traffic = useMemo<Car[]>(() => Array.from({ length: 26 }, (_, i) => {
    const horizontal = i % 2 === 0;
    const roads = horizontal ? city.roadRows : city.roadCols;
    return {
      horizontal, road: roads[i % roads.length], dir: (i % 4 < 2 ? 1 : -1) as 1 | -1,
      pos: (i * 137) % (horizontal ? WIDTH : HEIGHT), speed: 34 + (i * 13) % 36, look: TRAFFIC[i % TRAFFIC.length],
    };
  }), [city]);

  const walkers = useMemo<Walker[]>(() => Array.from({ length: 70 }, (_, i) => ({
    loop: i % city.walkways.length, d: i * 53, speed: (i % 2 ? 1 : -1) * (6 + (i % 5) * 1.5),
    shirt: SHIRTS[i % SHIRTS.length], hair: HAIR[i % HAIR.length], sprite: CIVILIANS.length ? CIVILIANS[(i * 7) % CIVILIANS.length] : '',
  })), [city]);

  // Minimapa (desenhado uma vez por distrito)
  const minimap = useMemo(() => {
    const scale = 0.25 * Math.min(dpr, 2);
    const c = document.createElement('canvas');
    c.width = Math.round(WIDTH * scale); c.height = Math.round(HEIGHT * scale);
    const g = c.getContext('2d')!;
    g.scale(scale, scale);
    g.fillStyle = city.style.asphalt; g.fillRect(0, 0, WIDTH, HEIGHT);
    for (const b of city.blocks) {
      g.fillStyle = MINIMAP_GROUND[b.ground] ?? city.style.paving;
      g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, CURB_RADIUS); g.fill();
    }
    for (const b of city.buildings) {
      g.fillStyle = b.kind === 'target' ? city.style.sign : b.kind === 'hideout' ? '#f2a93b' : b.roof;
      g.fillRect(b.x, b.y, b.w, b.h);
    }
    return { canvas: c, scale };
  }, [city, dpr]);

  useEffect(() => {
    const canvas = ref.current!;
    const g = canvas.getContext('2d')!;
    const st = city.style;
    const pat = {
      asphalt: worldPattern(g, asphalt(st.asphalt), 48),
      paving: worldPattern(g, paving(st.paving), 32),
      grass: worldPattern(g, grass(), 64),
      lot: worldPattern(g, concrete(st.lot), 40),
    };
    setGravelPattern(worldPattern(g, gravel(), 24));
    const district = DISTRICTS.find(x => x.id === city.district)!;
    let raf = 0, last = performance.now();

    const frame = (nowPerf: number) => {
      const dt = Math.min(0.05, (nowPerf - last) / 1000);
      last = nowPerf;
      const p = playerRef.current;
      const now = Date.now();
      const t = nowPerf / 1000;
      const jailed = isJailed(p, now);
      const speed = isTurbo(p, now) ? RULES.turboSpeedMult : 1;
      const sinceFetch = (now - fetchedRef.current) / 1000;
      // mesmo relógio do servidor (Brasília): a noite que paga mais é a mesma noite que se vê
      const night = isNight(Date.now());
      const W = canvas.width, H = canvas.height;

      // ----- posição da gangue (para a câmera e para desenhar) -----
      const { outfit, car: crewLook } = equippedLook(p);
      const crew = p.robberies.map((slot, i) => {
        if (!slot.jobId || jailed) return null;
        const job = ROBBERIES.find(r => r.id === slot.jobId) ?? HEIST_PLANS.find(h => h.id === slot.jobId);
        // plano de golpe não tem prédio próprio: a gangue vai até o alvo mais valioso do bairro
        const target = job && (city.buildings.find(b => b.jobId === job.id) ?? [...city.buildings].reverse().find(b => b.kind === 'target'));
        if (!job || !target) return null;
        const prog = ((slot.progressSec + sinceFetch * speed) % job.durationSec) / job.durationSec;
        const path = routeBetween(city, city.hideout, target);
        let pos;
        if (prog < 0.4) pos = pointOnPath(path, prog / 0.4);
        else if (prog < 0.6) pos = pointOnPath(path, 1);
        else { const q = pointOnPath(path, 1 - (prog - 0.6) / 0.4); pos = { ...q, angle: q.angle + Math.PI }; }
        // mantém o carro na faixa da direita
        const off = 7 + i * 2;
        pos = { ...pos, x: pos.x - Math.sin(pos.angle) * off, y: pos.y + Math.cos(pos.angle) * off };
        // durante o golpe, a gangue desce do carro, entra no alvo e volta
        const door = { x: target.x + target.w / 2, y: (pos.y > target.y + target.h / 2) ? target.y + target.h : target.y };
        return { pos, working: prog >= 0.4 && prog < 0.6, work: (prog - 0.4) / 0.2, door };
      }).filter(Boolean) as { pos: { x: number; y: number; angle: number }; working: boolean; parked?: boolean; work?: number; door?: { x: number; y: number } }[];

      // escondida: o carro fica estacionado na frente do esconderijo
      if (p.hideout && !jailed) {
        const hb = city.hideout;
        const below = city.roadRows.find(y => y > hb.y + hb.h) ?? city.roadRows[city.roadRows.length - 1];
        crew.push({ pos: { x: hb.x + hb.w / 2, y: below - 8, angle: Math.PI }, working: false, parked: true } as typeof crew[number]);
      }

      // ----- câmera -----
      const c = cam.current;
      // zoom mínimo: o mapa sempre cobre a tela inteira
      const minZoom = Math.max(W / dpr / WIDTH, H / dpr / HEIGHT);
      minZoomRef.current = minZoom;
      c.zoom = Math.max(minZoom, Math.min(MAX_ZOOM, c.zoom));
      if (followRef.current) {
        const focus = crew[0]?.pos ?? center(city.hideout);
        const k = Math.min(1, dt * 2.5);
        c.x += (focus.x - c.x) * k;
        c.y += (focus.y - c.y) * k;
      }
      const S = c.zoom * dpr;
      const halfW = W / 2 / S, halfH = H / 2 / S;
      c.x = halfW * 2 >= WIDTH ? WIDTH / 2 : Math.max(halfW, Math.min(WIDTH - halfW, c.x));
      c.y = halfH * 2 >= HEIGHT ? HEIGHT / 2 : Math.max(halfH, Math.min(HEIGHT - halfH, c.y));
      const view: Cam = { x: c.x, y: c.y, S, W, H, eye: eyeFor(halfW) };
      eyeRef.current = view.eye;
      const vx0 = c.x - halfW - 60, vx1 = c.x + halfW + 60, vy0 = c.y - halfH - 60, vy1 = c.y + halfH + 60;
      const visible = (r: { x: number; y: number; w: number; h: number }) => r.x < vx1 && r.x + r.w > vx0 && r.y < vy1 && r.y + r.h > vy0;

      // ----- chão -----
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#1a1d26';
      g.fillRect(0, 0, W, H);
      setWorld(g, view);
      g.fillStyle = pat.asphalt;
      g.fillRect(0, 0, WIDTH, HEIGHT);

      // faixas: linha central tracejada e faixa de pedestre nos cruzamentos
      g.fillStyle = 'rgba(235,225,190,.75)';
      for (const y of city.roadRows) for (let x = 0; x < WIDTH; x += 14) {
        if (city.roadCols.some(cx => Math.abs(cx - x - 3) < ROAD_W / 2 + 10)) continue;
        g.fillRect(x, y - 0.6, 7, 1.2);
      }
      for (const x of city.roadCols) for (let y = 0; y < HEIGHT; y += 14) {
        if (city.roadRows.some(cy => Math.abs(cy - y - 3) < ROAD_W / 2 + 10)) continue;
        g.fillRect(x - 0.6, y, 1.2, 7);
      }
      g.fillStyle = 'rgba(240,240,235,.8)';
      for (const y of city.roadRows) for (const x of city.roadCols) {
        for (let k = -ROAD_W / 2 + 2.5; k < ROAD_W / 2 - 2; k += 4.2) {
          g.fillRect(x - ROAD_W / 2 - 9, y + k, 6, 2.2);   // faixa de pedestre à esquerda do cruzamento
          g.fillRect(x + ROAD_W / 2 + 3, y + k, 6, 2.2);   // à direita
          g.fillRect(x + k, y - ROAD_W / 2 - 9, 2.2, 6);   // acima
          g.fillRect(x + k, y + ROAD_W / 2 + 3, 2.2, 6);   // abaixo
        }
      }

      // bueiros nos cruzamentos
      if (hasSprite('o_manhole')) {
        for (const y of city.roadRows) for (const x of city.roadCols) {
          if (x < vx0 || x > vx1 || y < vy0 || y > vy1) continue;
          drawSpriteFit(g, 'o_manhole', x + ROAD_W * 0.22, y - ROAD_W * 0.2 + 3, 6, 6);
        }
      }

      // quarteirões: calçada de pedra com meio-fio arredondado
      for (const b of city.blocks) {
        if (!visible(b)) continue;
        if (b.ground === 'water') { drawWater(g, b, t); continue; }
        g.beginPath(); g.roundRect(b.x + 1.2, b.y + 1.6, b.w, b.h, CURB_RADIUS);
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fill(); // sombra do meio-fio na rua
        g.beginPath(); g.roundRect(b.x, b.y, b.w, b.h, CURB_RADIUS);
        g.fillStyle = pat.paving; g.fill();
        g.lineWidth = 2.2; g.strokeStyle = '#d8d4c8'; g.stroke(); // meio-fio
        g.lineWidth = 0.6; g.strokeStyle = 'rgba(0,0,0,.35)';
        g.beginPath(); g.roundRect(b.x + 1.6, b.y + 1.6, b.w - 3.2, b.h - 3.2, CURB_RADIUS - 1.6); g.stroke();
        if (b.ground === 'park') {
          g.beginPath(); g.roundRect(b.inner.x, b.inner.y, b.inner.w, b.inner.h, 6);
          g.fillStyle = pat.grass; g.fill();
          g.lineWidth = 1.5; g.strokeStyle = '#8b8370'; g.stroke();
        } else if (b.ground === 'lot') {
          g.fillStyle = pat.lot; g.fillRect(b.inner.x, b.inner.y, b.inner.w, b.inner.h);
        } else if (b.ground !== 'plaza') {
          drawGround(g, b, t);
        }
      }

      // sombras dos prédios (sol no alto à esquerda)
      g.fillStyle = 'rgba(0,0,0,.28)';
      for (const b of city.buildings) {
        if (!visible(b)) continue;
        const dx = b.height * 0.35, dy = b.height * 0.45;
        g.beginPath();
        g.moveTo(b.x + b.w, b.y); g.lineTo(b.x + b.w + dx, b.y + dy); g.lineTo(b.x + b.w + dx, b.y + b.h + dy);
        g.lineTo(b.x + dx, b.y + b.h + dy); g.lineTo(b.x, b.y + b.h); g.lineTo(b.x + b.w, b.y + b.h); g.closePath();
        g.fill();
      }

      // enfeites no chão: sombras de árvores, postes, lixeiras
      for (const pr of city.props) {
        if (pr.x < vx0 || pr.x > vx1 || pr.y < vy0 || pr.y > vy1) continue;
        if (pr.kind === 'tree') drawTreeShadow(g, pr.x, pr.y, pr.r);
        else if (pr.kind === 'lamp' && hasSprite('o_lamp2')) {
          drawSpriteFit(g, (pr.x + pr.y) % 3 < 1 ? 'o_lamp' : 'o_lamp2', pr.x, pr.y + 1.5, 6, 18);
        } else if (pr.kind !== 'lamp' && hasSprite('o_bench')) {
          const name = pick(STREET_PROPS, pr.x * 3 + pr.y);
          drawSpriteFit(g, name, pr.x, pr.y + 2.5, 9, 9);
        } else if (pr.kind === 'lamp') {
          g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(pr.x, pr.y, 10, 1.2);
          g.fillStyle = '#3b3f45'; g.beginPath(); g.arc(pr.x, pr.y, 1.4, 0, 7); g.fill();
        } else {
          g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.arc(pr.x + 1, pr.y + 1, pr.r, 0, 7); g.fill();
          g.fillStyle = '#4d5a4a'; g.beginPath(); g.arc(pr.x, pr.y, pr.r, 0, 7); g.fill();
          g.fillStyle = '#2a302a'; g.beginPath(); g.arc(pr.x, pr.y, pr.r * 0.55, 0, 7); g.fill();
        }
      }

      // pedestres nas calçadas
      for (const w of walkers) {
        w.d += w.speed * dt;
        const loop = city.walkways[w.loop];
        const a = pointOnLoop(loop, w.d), b2 = pointOnLoop(loop, w.d + Math.sign(w.speed));
        if (a.x < vx0 || a.x > vx1 || a.y < vy0 || a.y > vy1) continue;
        drawPerson(g, a.x, a.y, Math.atan2(b2.y - a.y, b2.x - a.x), { shirt: w.shirt, pants: '#2b2f3a', sprite: w.sprite || undefined }, w.d * 0.8, w.hair);
      }
      // seu personagem na porta do esconderijo

      const hc = center(city.hideout);
      drawPerson(g, hc.x, city.hideout.y + city.hideout.h + 6, Math.PI / 2, outfit, t * 2);
      // aviõezinhos perto do galpão quando os pontos estão vendendo
      if (!jailed && p.dealing.drugId && p.product[p.dealing.drugId] > 0) {
        for (let k = 0; k < Math.min(p.dealing.points, 8); k++) {
          const lx = city.lab.x - 6 + (k % 4) * 9, ly = city.lab.y + city.lab.h + 5 + Math.floor(k / 4) * 5;
          drawPerson(g, lx, ly + Math.sin(t * 2 + k) * 0.8, Math.sin(t + k), { shirt: '#2f3640', pants: '#2b2f3a', sprite: THUGS.length ? pick(THUGS, k * 3 + 1) : undefined }, t * 3 + k);
        }
      }

      // trânsito
      for (const car of traffic) {
        car.pos += car.speed * car.dir * dt;
        const span = car.horizontal ? WIDTH : HEIGHT;
        if (car.pos > span + 20) car.pos = -20;
        if (car.pos < -20) car.pos = span + 20;
        const lane = car.dir * 8;
        if (car.horizontal) drawCar(g, car.pos, car.road + lane, car.dir > 0 ? 0 : Math.PI, car.look);
        else drawCar(g, car.road - lane, car.pos, car.dir > 0 ? Math.PI / 2 : -Math.PI / 2, car.look);
      }
      // ----- polícia: de 0 a 6 estrelas -----
      // 1★ policiais a pé · 2★ viatura · 3★ cerco · 4★ SWAT · 5★ helicóptero · 6★ bloqueio na rua
      const stars = jailed ? 0 : starsFor(p.heat);
      const sirens: { x: number; y: number }[] = [];
      const hiding = !crew.length || !!crew[0].parked;
      const focus = crew[0]?.pos ?? { x: hc.x, y: city.hideout.y + city.hideout.h + 6, angle: 0 };
      const nearBlock = city.blocks.reduce((best, bl) => {
        const dx = Math.max(bl.x - focus.x, 0, focus.x - bl.x - bl.w), dy = Math.max(bl.y - focus.y, 0, focus.y - bl.y - bl.h);
        const d = dx * dx + dy * dy;
        return d < best.d ? { bl, d } : best;
      }, { bl: city.blocks[0], d: Infinity }).bl;
      const ring = { x: nearBlock.x - 8, y: nearBlock.y - 8, w: nearBlock.w + 16, h: nearBlock.h + 16 };
      const perim = 2 * (ring.w + ring.h);
      if (stars >= 1) {
        const onFoot = stars >= 3 ? 3 : 2;
        for (let k = 0; k < onFoot; k++) {
          const a = k * 2.4 + t * (0.22 + k * 0.05) * (k % 2 ? 1 : -1);
          const r = (hiding ? 52 : 20) + Math.sin(t * 0.7 + k) * 5;
          const px = focus.x + Math.cos(a) * r, py = focus.y + Math.sin(a) * r * 0.8;
          drawPerson(g, px, py, a + (k % 2 ? Math.PI / 2 : -Math.PI / 2), { ...COP, sprite: COPS.length ? pick(COPS, k * 5) : undefined }, t * 6 + k, '#1a1a1a', 1.6);
        }
      }
      if (stars >= 4) {
        for (let k = 0; k < (stars >= 6 ? 4 : 2); k++) {
          const a = k * 1.6 + 0.8 + t * 0.15;
          const r = (hiding ? 40 : 15) + k * 2;
          const px = focus.x + Math.cos(a) * r, py = focus.y + Math.sin(a) * r * 0.8;
          drawPerson(g, px, py, Math.atan2(focus.y - py, focus.x - px), { ...SWAT_OP, sprite: SWATS.length ? pick(SWATS, k * 4) : undefined }, t * 4 + k, '#111', 1.65);
        }
      }
      const patrols = [0, 0, 1, 2, 2, 2, 3][stars];
      for (let k = 0; k < patrols; k++) {
        const d = t * 42 + (k * perim) / patrols;
        const a1 = pointOnLoop(ring, d), a2 = pointOnLoop(ring, d + 1);
        drawCar(g, a1.x, a1.y, Math.atan2(a2.y - a1.y, a2.x - a1.x), { color: '#fff', kind: 'police' });
        sirens.push(a1);
      }
      if (stars >= 4) {
        for (let k = 0; k < (stars >= 6 ? 2 : 1); k++) {
          const d = -t * 30 + perim * (0.25 + k * 0.5);
          const a1 = pointOnLoop(ring, d), a2 = pointOnLoop(ring, d - 1);
          drawCar(g, a1.x, a1.y, Math.atan2(a2.y - a1.y, a2.x - a1.x), { color: '#262c36', kind: 'swat', shape: 'van' });
          sirens.push(a1);
        }
      }
      if (stars >= 6) {
        // bloqueio no cruzamento mais perto: duas viaturas atravessadas, cavaletes e cones
        const ix = city.roadCols.reduce((b, x) => Math.abs(x - focus.x) < Math.abs(b - focus.x) ? x : b, city.roadCols[0]);
        const iy = city.roadRows.reduce((b, y) => Math.abs(y - focus.y) < Math.abs(b - focus.y) ? y : b, city.roadRows[0]);
        const bx = ix + ROAD_W / 2 + 16, by = iy;
        drawCar(g, bx, by - 6, Math.PI / 2 + 0.35, { color: '#fff', kind: 'police' });
        drawCar(g, bx + 3, by + 7, Math.PI / 2 - 0.35, { color: '#fff', kind: 'police' });
        drawBarrier(g, bx - 9, by, Math.PI / 2, ROAD_W - 4);
        for (let k = -2; k <= 2; k++) drawCone(g, bx - 14, by + k * 4.5);
        if (hasSprite('o_block')) { drawSpriteFit(g, 'o_block', bx - 20, by - 8, 8, 7); drawSpriteFit(g, 'o_block', bx - 20, by + 12, 8, 7); }
        sirens.push({ x: bx, y: by - 6 }, { x: bx + 3, y: by + 7 });
      }
      const heli = stars >= 5 ? (() => {
        const a = t * 0.35;
        const r = hiding ? 46 : 26;
        return { x: focus.x + Math.cos(a) * r, y: focus.y + Math.sin(a) * r * 0.7, angle: a + Math.PI / 2 };
      })() : null;
      if (heli) drawHelicopterShadow(g, heli.x + 12, heli.y + 15, heli.angle, 1);

      // alerta: viatura rondando o quarteirão do alvo monitorado
      if (p.alert && !jailed) {
        const target = city.buildings.find(b => b.jobId === p.alert!.jobId);
        const tc = target && center(target);
        const blk = tc && city.blocks.find(bl => tc.x >= bl.x && tc.x <= bl.x + bl.w && tc.y >= bl.y && tc.y <= bl.y + bl.h);
        if (blk) {
          const lane = { x: blk.x - 8, y: blk.y - 8, w: blk.w + 16, h: blk.h + 16 };
          const d = t * 45;
          const a1 = pointOnLoop(lane, d), a2 = pointOnLoop(lane, d + 1);
          drawCar(g, a1.x, a1.y, Math.atan2(a2.y - a1.y, a2.x - a1.x), { color: '#fff', kind: 'police' });
          sirens.push(a1);
        }
      }

      // carro(s) da gangue, com anel de destaque
      for (const cr of crew) {
        g.lineWidth = 1.4; g.strokeStyle = p.alert && Math.floor(t * 4) % 2 ? '#ff5252' : st.sign;
        g.beginPath(); g.arc(cr.pos.x, cr.pos.y, 13, 0, 7); g.stroke();
        drawCar(g, cr.pos.x, cr.pos.y, cr.pos.angle, crewLook, 1.1);
        // membros da gangue (com a roupa equipada) indo e voltando do alvo
        if (cr.working && cr.door && cr.work !== undefined) {
          const f = cr.work;
          const out = f < 0.3 ? f / 0.3 : f > 0.7 ? (1 - f) / 0.3 : -1; // -1 = lá dentro
          if (out >= 0) {
            const n = crewLook.shape === 'moto' ? 1 : 3;
            for (let m = 0; m < n; m++) {
              const sx = cr.pos.x + (m - 1) * 4, sy = cr.pos.y;
              const px = sx + (cr.door.x + (m - 1) * 3 - sx) * out, py = sy + (cr.door.y - sy) * out;
              const dir = Math.atan2(cr.door.y - sy, cr.door.x - sx) + (f > 0.7 ? Math.PI : 0);
              drawPerson(g, px, py, dir, outfit, t * 9 + m, '#2a1d14', 1.55);
            }
          }
        }
      }

      // copas das árvores: acima de carros e pedestres, mas abaixo dos prédios
      setWorld(g, view, 14);
      for (const pr of city.props) {
        if (pr.kind !== 'tree' || pr.x < vx0 || pr.x > vx1 || pr.y < vy0 || pr.y > vy1) continue;
        drawTreeCanopy(g, pr.x, pr.y, pr.r, pr.x * 0.37 + pr.y);
      }
      // ----- prédios em perspectiva (do mais longe para o mais perto) -----
      const emissive: ((e: CanvasRenderingContext2D) => void)[] = [];
      const hideoutRoof = p.equipped.hideout !== 'base_padrao' ? DIAMOND_ITEMS.find(i => i.id === p.equipped.hideout)?.color : undefined;
      const order = city.buildings.filter(visible)
        .map(b => ({ b, d: Math.hypot(b.x + b.w / 2 - c.x, b.y + b.h / 2 - c.y) }))
        .sort((a, z) => z.d - a.d);
      for (const { b } of order) {
        const job = b.jobId ? ROBBERIES.find(r => r.id === b.jobId) : undefined;
        const locked = job ? p.level < job.minLevel : false;
        const sign = b.kind === 'target'
          ? (locked ? { text: `Nível ${job!.minLevel}`, bg: '#2a2d35', fg: '#9aa0aa' } : { text: b.label!, bg: st.sign, fg: '#1a1408' })
          : b.kind === 'hideout' ? { text: 'Esconderijo', bg: '#f2a93b', fg: '#2a1a04' }
          : b.kind === 'lab' ? { text: 'Galpão', bg: '#e9e4d8', fg: '#22252b' } : undefined;
        drawBuilding(g, view, b, { night, sign, emissive, roofColor: b.kind === 'hideout' ? hideoutRoof : undefined });
      }

      // heliponto no telhado do esconderijo (cosmético VIP)
      const roofItem = DIAMOND_ITEMS.find(i => i.id === p.equipped.hideout);
      if (roofItem?.sprite && hasSprite(roofItem.sprite) && visible(city.hideout)) {
        const hb = city.hideout, hcx = hb.x + hb.w / 2, hcy = hb.y + hb.h / 2;
        setWorld(g, view, hb.height + 0.5);
        const r = Math.min(hb.w, hb.h) * 0.36;
        g.fillStyle = 'rgba(30,32,38,.85)'; g.beginPath(); g.arc(hcx, hcy, r, 0, 7); g.fill();
        g.strokeStyle = '#f2c14e'; g.lineWidth = 1.4; g.beginPath(); g.arc(hcx, hcy, r - 2, 0, 7); g.stroke();
        g.fillStyle = 'rgba(242,193,78,.6)'; g.font = `800 ${r}px "Barlow Condensed", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText('H', hcx, hcy + 1);
        drawHelicopter(g, hcx, hcy, -Math.PI / 2 + 0.3, 0, Math.min(1.1, (r * 2.2) / 34), roofItem.sprite);
      }

      // cabeças dos postes
      setWorld(g, view, 16);
      for (const pr of city.props) {
        if (pr.kind !== 'lamp' || pr.x < vx0 || pr.x > vx1 || pr.y < vy0 || pr.y > vy1) continue;
        if (!hasSprite('o_lamp2')) { g.fillStyle = '#2d3136'; g.beginPath(); g.arc(pr.x, pr.y, 1.8, 0, 7); g.fill(); }
        if (night) emissive.push(e => {
          setWorld(e, view, 16);
          const grd = e.createRadialGradient(pr.x, pr.y, 0, pr.x, pr.y, 18);
          grd.addColorStop(0, 'rgba(255,200,110,.55)'); grd.addColorStop(1, 'rgba(255,200,110,0)');
          e.fillStyle = grd; e.beginPath(); e.arc(pr.x, pr.y, 18, 0, 7); e.fill();
        });
      }

      // helicóptero voando acima dos prédios, com luzes de navegação
      if (heli) {
        setWorld(g, view, 50);
        drawHelicopter(g, heli.x, heli.y, heli.angle, t, 1);
        emissive.push(e => {
          setWorld(e, view, 50);
          const blink = Math.floor(t * 2) % 2;
          e.fillStyle = blink ? '#ff3030' : '#30ff60';
          e.beginPath(); e.arc(heli.x, heli.y, 1.4, 0, 7); e.fill();
        });
      }

      // fumaça do galpão
      if (!jailed && p.lab.lines.some(l => l.loaded)) {
        const lb = city.lab;
        for (let k = 0; k < 5; k++) {
          const ph = (t * 0.5 + k / 5) % 1;
          setWorld(g, view, lb.height + ph * 26);
          const sx = lb.x + lb.w - 10 + Math.sin(ph * 6 + k) * 3, sz = 6 + ph * 12;
          if (hasSprite('fx_smoke_0')) {
            g.globalAlpha = 0.75 * (1 - ph);
            drawSpriteFit(g, k % 2 ? 'fx_smoke_0' : 'fx_smoke_1', sx, lb.y + 8 + sz / 2, sz, sz);
            g.globalAlpha = 1;
          } else {
            g.fillStyle = `rgba(215,215,222,${0.55 * (1 - ph)})`;
            g.beginPath(); g.arc(sx, lb.y + 8, 3 + ph * 6, 0, 7); g.fill();
          }
        }
      }

      // noite: escurece tudo e redesenha o que brilha
      if (night) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.fillStyle = 'rgba(10,14,40,.5)';
        g.fillRect(0, 0, W, H);
        for (const f of emissive) f(g);
      }

      // holofote do helicóptero varrendo a gangue
      if (heli) {
        setWorld(g, view, 0);
        const lx = focus.x + Math.sin(t * 1.3) * 6, ly = focus.y + Math.cos(t * 1.1) * 5;
        const grd = g.createRadialGradient(lx, ly, 0, lx, ly, 26);
        grd.addColorStop(0, night ? 'rgba(255,248,215,.55)' : 'rgba(255,248,215,.3)');
        grd.addColorStop(0.7, night ? 'rgba(255,248,215,.25)' : 'rgba(255,248,215,.12)');
        grd.addColorStop(1, 'rgba(255,248,215,0)');
        g.fillStyle = grd; g.beginPath(); g.ellipse(lx, ly, 26, 22, 0, 0, 7); g.fill();
      }

      // sirene e "$" por cima de tudo
      setWorld(g, view, 4);
      for (const sp of sirens) {
        const on = Math.floor(t * 6) % 2;
        const grd = g.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, 22);
        grd.addColorStop(0, on ? 'rgba(255,40,40,.65)' : 'rgba(40,90,255,.65)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grd; g.beginPath(); g.arc(sp.x, sp.y, 22, 0, 7); g.fill();
      }
      setWorld(g, view, 10);
      g.font = '800 11px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const cr of crew) if (cr.working && Math.floor(t * 4) % 2 === 0) {
        g.fillStyle = '#0d1a05'; g.fillText('$', cr.pos.x + 0.6, cr.pos.y - 15.4);
        g.fillStyle = '#b6e35a'; g.fillText('$', cr.pos.x, cr.pos.y - 16);
      }
      for (const cr of crew) if (cr.parked) {
        const bob = Math.sin(t * 2) * 1.5;
        g.fillStyle = '#0d1a05'; g.fillText('Zz', cr.pos.x + 0.6, cr.pos.y - 15.4 + bob);
        g.fillStyle = '#32bcad'; g.fillText('Zz', cr.pos.x, cr.pos.y - 16 + bob);
      }

      // ----- interface sobre o mapa -----
      g.setTransform(1, 0, 0, 1, 0, 0);
      // minimapa no canto superior direito
      const mm = minimap.canvas, mw = Math.min(W * 0.22, 220 * dpr), mh = mw * HEIGHT / WIDTH;
      const mx = W - mw - 12 * dpr, my = 12 * dpr;
      g.fillStyle = 'rgba(10,12,18,.75)'; g.fillRect(mx - 4 * dpr, my - 4 * dpr, mw + 8 * dpr, mh + 8 * dpr);
      g.drawImage(mm, mx, my, mw, mh);
      const ms = mw / WIDTH;
      g.strokeStyle = '#fff'; g.lineWidth = 1.5 * dpr;
      g.strokeRect(mx + (c.x - halfW) * ms, my + (c.y - halfH) * ms, halfW * 2 * ms, halfH * 2 * ms);
      for (const cr of crew) {
        g.fillStyle = st.sign; g.beginPath(); g.arc(mx + cr.pos.x * ms, my + cr.pos.y * ms, 3.5 * dpr, 0, 7); g.fill();
      }
      minimapRect.current = { x: mx / dpr, y: my / dpr, w: mw / dpr, h: mh / dpr };

      if (jailed) {
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 0, W, H);
        g.fillStyle = '#9aa0a6';
        for (let x = 30 * dpr; x < W; x += 60 * dpr) g.fillRect(x, 0, 9 * dpr, H);
        const left = Math.ceil(((p.jailedUntil ?? now) - now) / 1000);
        g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.font = `800 ${48 * dpr}px "Barlow Condensed", sans-serif`;
        g.fillText('Preso', W / 2, H / 2 - 14 * dpr);
        g.font = `600 ${18 * dpr}px Barlow, sans-serif`;
        g.fillText(`Sai em ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`, W / 2, H / 2 + 22 * dpr);
      }
      void district; void scaleAt; void project;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); setGravelPattern(null); };
  }, [city, traffic, walkers, minimap, dpr]);

  // ----- interação: arrastar, zoom, clique -----
  const minimapRect = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const eyeRef = useRef(200);
  const minZoomRef = useRef(1);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);

  const toWorld = (clientX: number, clientY: number, h = 0) => {
    const r = ref.current!.getBoundingClientRect();
    const c = cam.current, s = c.zoom * scaleAt(h, eyeRef.current);
    return { x: c.x + (clientX - r.left - r.width / 2) / s, y: c.y + (clientY - r.top - r.height / 2) / s };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, cx: cam.current.x, cy: cam.current.y, moved: false };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) > 5) { d.moved = true; setFollow(false); }
    if (d.moved) { cam.current.x = d.cx - dx / cam.current.zoom; cam.current.y = d.cy - dy / cam.current.zoom; }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    const r = ref.current!.getBoundingClientRect();
    const lx = e.clientX - r.left, ly = e.clientY - r.top, m = minimapRect.current;
    if (lx >= m.x && lx <= m.x + m.w && ly >= m.y && ly <= m.y + m.h) {
      cam.current.x = ((lx - m.x) / m.w) * WIDTH; cam.current.y = ((ly - m.y) / m.h) * HEIGHT;
      setFollow(false);
      return;
    }
    // clique num alvo: testa o telhado (em perspectiva) e a base
    for (const b of city.buildings) {
      if (!b.jobId) continue;
      for (const h of [b.height, 0]) {
        const w = toWorld(e.clientX, e.clientY, h);
        if (w.x >= b.x && w.x <= b.x + b.w && w.y >= b.y && w.y <= b.y + b.h) { onSelectJob?.(b.jobId); return; }
      }
    }
  };

  useEffect(() => {
    const el = ref.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomTouched.current = true;
      const before = toWorld(e.clientX, e.clientY);
      const c = cam.current;
      c.zoom = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, c.zoom * Math.exp(-e.deltaY * 0.0015)));
      const after = toWorld(e.clientX, e.clientY);
      if (!followRef.current) { c.x += before.x - after.x; c.y += before.y - after.y; }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });

  const zoomBy = (f: number) => { zoomTouched.current = true; cam.current.zoom = Math.max(minZoomRef.current, Math.min(MAX_ZOOM, cam.current.zoom * f)); };
  const overview = () => {
    setFollow(false);
    cam.current = { x: WIDTH / 2, y: HEIGHT / 2, zoom: minZoomRef.current };
  };

  return (
    <div className="map-frame" ref={frameRef}>
      <div className="map-inner" style={{ width: size.w }}>
        <canvas
          ref={ref}
          width={Math.round(size.w * dpr)}
          height={Math.round(size.h * dpr)}
          className="city"
          role="img"
          aria-label="Mapa da cidade. Arraste para mover, use a roda do mouse para aproximar e clique num alvo para ver o assalto."
          style={{ width: size.w, height: size.h, touchAction: 'none' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        />
        <div className="map-controls">
          <button className="ghost small" onClick={() => zoomBy(1.25)} aria-label="Aproximar">+</button>
          <button className="ghost small" onClick={() => zoomBy(0.8)} aria-label="Afastar">−</button>
          {follow
            ? <button className="ghost small" onClick={overview}>Ver o bairro</button>
            : <button className="small" onClick={() => { cam.current.zoom = Math.max(1.3, Math.min(3.2, size.w / 420)); setFollow(true); }}>Seguir a gangue</button>}
        </div>
        {children}
      </div>
    </div>
  );
}
