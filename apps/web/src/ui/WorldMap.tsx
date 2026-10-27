// Mapa do estado de Costa Dourada: península com metrópole na costa leste, ilhas-barreira,
// lagoa no meio, pântano, interior, porto no oeste e ilhotas no sul. Desenho original.
import { api } from '../api';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DISTRICTS, ROBBERIES, formatCash, type District, type DistrictId, type PlayerState } from '@gti/shared';

const MW = 100, MH = 160;

// Contorno da península (sentido horário, a partir do noroeste)
const LAND: [number, number][] = [
  [10, 8], [30, 4], [55, 3], [76, 6], [84, 13], [83, 28], [85, 44], [84, 60], [83, 76], [82, 90], [79, 104],
  [75, 116], [68, 126], [58, 130], [49, 125], [43, 115], [36, 108], [28, 101], [22, 89], [17, 77], [10, 69],
  [6, 62], [13, 56], [9, 49], [4, 37], [6, 20],
];
// Ilhas: barreiras da costa leste, marina, farol, ilhotas e Ilha do Sol
const ISLANDS: { x: number; y: number; rx: number; ry: number; rot?: number }[] = [
  { x: 88.5, y: 28, rx: 1.8, ry: 14 }, { x: 89.5, y: 66, rx: 2, ry: 15 }, { x: 89, y: 92, rx: 4, ry: 6 },
  { x: 83, y: 124, rx: 3.2, ry: 2.4 },
  { x: 55, y: 133, rx: 3, ry: 1.4, rot: -0.3 }, { x: 48, y: 136.5, rx: 3, ry: 1.3, rot: -0.2 }, { x: 41, y: 139, rx: 2.6, ry: 1.2 },
  { x: 34, y: 141.5, rx: 2.4, ry: 1.1 }, { x: 27, y: 144, rx: 2.2, ry: 1 }, { x: 16, y: 148, rx: 9, ry: 4, rot: -0.1 },
];
const LAKE = { x: 56, y: 56, rx: 13, ry: 9 };
const ROADS: [number, number][][] = [
  [[50, 14], [62, 9], [79, 12], [80, 40], [79, 70], [78, 96], [72, 116], [62, 126]], // litoral leste
  [[14, 56], [26, 48], [40, 42], [50, 14]],                                          // oeste ↔ norte
  [[40, 42], [44, 60], [50, 80], [60, 94], [72, 112]],                                // centro do estado
  [[16, 72], [26, 92], [36, 100], [47, 108], [60, 98], [79, 98]],                     // travessia sul
  [[62, 126], [55, 133], [48, 136.5], [41, 139], [34, 141.5], [27, 144], [18, 148]], // ponte das ilhotas
  [[80, 30], [88, 28]], [[79, 66], [89, 66]], [[80, 92], [88, 92]],                   // pontes para as ilhas
];
const SWAMP = { x: 36, y: 103, r: 12 };
const FOREST = { x: 20, y: 26, r: 12 };

function seeded(seed: number) {
  return () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
}

function drawMap(g: CanvasRenderingContext2D, k: number, p: PlayerState, hover: DistrictId | null, sel: DistrictId | null, t: number, owners: Owners = {}) {
  g.save();
  g.scale(k, k);
  // mar com gradiente e recife claro em volta da costa
  const sea = g.createLinearGradient(0, 0, MW, MH);
  sea.addColorStop(0, '#0b3a6e'); sea.addColorStop(1, '#0a2e5c');
  g.fillStyle = sea; g.fillRect(0, 0, MW, MH);
  const land = new Path2D();
  LAND.forEach(([x, y], i) => (i ? land.lineTo(x, y) : land.moveTo(x, y)));
  land.closePath();
  const isl = new Path2D();
  for (const i of ISLANDS) { isl.moveTo(i.x + i.rx, i.y); isl.ellipse(i.x, i.y, i.rx, i.ry, i.rot ?? 0, 0, Math.PI * 2); }
  for (const [w, c] of [[9, 'rgba(40,140,190,.35)'], [5, 'rgba(70,190,210,.45)'], [2.4, 'rgba(120,220,220,.55)']] as const) {
    g.lineJoin = 'round'; g.lineWidth = w; g.strokeStyle = c; g.stroke(land); g.stroke(isl);
  }
  // terra, areia na borda
  g.fillStyle = '#8fb874'; g.fill(land); g.fill(isl);
  g.lineWidth = 0.7; g.strokeStyle = '#e6d39a'; g.stroke(land); g.stroke(isl);
  // textura de vegetação
  g.save(); g.clip(land);
  const r = seeded(11);
  for (let n = 0; n < 900; n++) {
    g.fillStyle = r() < 0.5 ? 'rgba(60,110,50,.18)' : 'rgba(200,220,150,.14)';
    g.fillRect(r() * MW, r() * MH, 0.8 + r() * 1.4, 0.8 + r() * 1.4);
  }
  // mata (noroeste) e pântano (centro-sul)
  const forest = g.createRadialGradient(FOREST.x, FOREST.y, 0, FOREST.x, FOREST.y, FOREST.r);
  forest.addColorStop(0, 'rgba(30,80,40,.75)'); forest.addColorStop(1, 'rgba(30,80,40,0)');
  g.fillStyle = forest; g.beginPath(); g.arc(FOREST.x, FOREST.y, FOREST.r, 0, 7); g.fill();
  const sw = g.createRadialGradient(SWAMP.x, SWAMP.y, 0, SWAMP.x, SWAMP.y, SWAMP.r);
  sw.addColorStop(0, 'rgba(110,130,80,.85)'); sw.addColorStop(1, 'rgba(110,130,80,0)');
  g.fillStyle = sw; g.beginPath(); g.arc(SWAMP.x, SWAMP.y, SWAMP.r, 0, 7); g.fill();
  for (let n = 0; n < 40; n++) {
    const a = r() * 7, d = r() * SWAMP.r * 0.85;
    g.fillStyle = 'rgba(70,130,150,.55)';
    g.beginPath(); g.ellipse(SWAMP.x + Math.cos(a) * d, SWAMP.y + Math.sin(a) * d, 0.6 + r(), 0.4 + r() * 0.5, a, 0, 7); g.fill();
  }
  // plantações no interior
  for (let n = 0; n < 14; n++) {
    const x = 22 + r() * 40, y = 30 + r() * 40;
    if (Math.hypot(x - LAKE.x, (y - LAKE.y) * 1.4) < 16) continue;
    g.fillStyle = r() < 0.5 ? 'rgba(200,190,110,.5)' : 'rgba(150,180,90,.5)';
    g.fillRect(x, y, 3 + r() * 3, 2 + r() * 2);
  }
  g.restore();
  // lagoa
  g.fillStyle = '#3f8fc0'; g.beginPath(); g.ellipse(LAKE.x, LAKE.y, LAKE.rx, LAKE.ry, 0.15, 0, 7); g.fill();
  g.strokeStyle = 'rgba(200,240,255,.6)'; g.lineWidth = 0.5; g.stroke();
  // autódromo
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 0.9; g.beginPath(); g.ellipse(40, 42, 3.4, 1.8, -0.4, 0, 7); g.stroke();
  // estradas
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const road of ROADS) {
    const path = new Path2D(); road.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)));
    g.strokeStyle = 'rgba(20,20,25,.55)'; g.lineWidth = 1.1; g.stroke(path);
    g.strokeStyle = '#f2e6c4'; g.lineWidth = 0.45; g.stroke(path);
  }
  // manchas urbanas nas regiões de cidade, porto e aeroporto
  for (const d of DISTRICTS) {
    if (!['city', 'port', 'airport', 'beach'].includes(d.terrain) || d.id === 'lagoa') continue;
    const rr = seeded(d.id.length * 97 + d.map.x);
    for (let n = 0; n < 26; n++) {
      const a = rr() * 7, dd = rr() * (d.terrain === 'beach' ? 3 : 5.5);
      g.fillStyle = rr() < 0.5 ? 'rgba(120,120,130,.75)' : 'rgba(165,165,170,.75)';
      g.fillRect(d.map.x + Math.cos(a) * dd * 0.6, d.map.y + Math.sin(a) * dd, 1.2, 1.2);
    }
    if (d.terrain === 'airport') {
      g.fillStyle = '#3a3a40'; g.save(); g.translate(d.map.x, d.map.y); g.rotate(-0.5);
      g.fillRect(-5, -0.6, 10, 1.2); g.fillRect(-4, 2, 8, 1); g.restore();
    }
  }
  // farol
  g.fillStyle = '#fff'; g.fillRect(83.6, 122.6, 0.8, 1.6);
  g.fillStyle = `rgba(255,240,150,${0.5 + 0.5 * Math.sin(t * 3)})`; g.beginPath(); g.arc(84, 122.6, 1.2, 0, 7); g.fill();

  // regiões
  for (const d of DISTRICTS) {
    const locked = p.level < d.minLevel;
    const here = p.district === d.id;
    const { x, y } = d.map;
    const active = hover === d.id || sel === d.id;
    if (here) {
      const pr = 3 + (Math.sin(t * 3) + 1) * 1.2;
      g.strokeStyle = 'rgba(242,169,59,.8)'; g.lineWidth = 0.5; g.beginPath(); g.arc(x, y, pr, 0, 7); g.stroke();
    }
    g.fillStyle = locked ? '#3a3f4a' : here ? '#f2a93b' : d.palette.accent;
    g.strokeStyle = active ? '#fff' : 'rgba(0,0,0,.6)'; g.lineWidth = active ? 0.6 : 0.4;
    g.beginPath(); g.arc(x, y, active ? 2.1 : 1.7, 0, 7); g.fill(); g.stroke();
    // rótulo
    g.font = `700 ${active ? 3.1 : 2.7}px "Barlow Condensed", sans-serif`;
    const own = owners[d.id];
    const label = (locked ? `${d.name} · nv ${d.minLevel}` : d.name) + (own ? ` [${own.tag}]` : '');
    const tw = g.measureText(label).width;
    const left = x + 2.6 + tw > MW - 1;
    const lx = left ? x - 2.6 - tw : x + 2.6;
    g.fillStyle = 'rgba(8,14,26,.72)'; g.fillRect(lx - 0.8, y - 2, tw + 1.6, 3.6);
    g.fillStyle = own?.mine ? '#b6e35a' : locked ? '#9aa3b2' : here ? '#f2a93b' : '#f4efe4';
    g.textBaseline = 'middle'; g.fillText(label, lx, y - 0.1);
  }
  g.restore();
}

type Owners = Record<string, { tag: string; mine: boolean }>;

export default function WorldMap({ p, onTravel, onClose }: { p: PlayerState; onTravel: (d: DistrictId) => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<DistrictId | null>(null);
  const [sel, setSel] = useState<DistrictId | null>(p.district);
  const [size, setSize] = useState({ w: 400, h: 640 });
  // donos dos territórios da semana: sigla do bonde ao lado do nome
  const [owners, setOwners] = useState<Owners>({});
  useEffect(() => {
    api.crew().then(r => setOwners(Object.fromEntries(r.data.standings.filter(d => d.owner).map(d => [d.district, d.owner!])))).catch(() => {});
  }, []);
  const stateRef = useRef({ hover, sel, p, owners });
  stateRef.current = { hover, sel, p, owners };

  useEffect(() => {
    const fit = () => {
      const el = boxRef.current; if (!el) return;
      const maxH = Math.min(window.innerHeight * 0.8, 900);
      const w = Math.min(el.clientWidth, maxH * MW / MH);
      setSize({ w: Math.floor(w), h: Math.floor(w * MH / MW) });
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    c.width = size.w * dpr; c.height = size.h * dpr;
    const g = c.getContext('2d')!;
    let raf = 0;
    const loop = (ms: number) => {
      g.setTransform(1, 0, 0, 1, 0, 0);
      const s = stateRef.current;
      drawMap(g, (size.w * dpr) / MW, s.p, s.hover, s.sel, ms / 1000, s.owners);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [size]);

  const hit = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * MW, y = ((e.clientY - r.top) / r.height) * MH;
    let best: District | null = null, bd = 6;
    for (const d of DISTRICTS) {
      const dd = Math.hypot(d.map.x - x, d.map.y - y);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best?.id ?? null;
  };

  const selected = useMemo(() => DISTRICTS.find(d => d.id === sel) ?? null, [sel]);
  const jobs = selected ? ROBBERIES.filter(j => j.district === selected.id) : [];
  const unlocked = DISTRICTS.filter(d => p.level >= d.minLevel).length;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="map-title" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal world">
        <div className="row">
          <h2 id="map-title">Costa Dourada</h2>
          <span className="muted small">{unlocked} de {DISTRICTS.length} regiões abertas</span>
          <button className="ghost small" onClick={onClose}>Fechar</button>
        </div>
        <div className="world-body">
          <div className="world-map" ref={boxRef}>
            <canvas
              ref={ref}
              style={{ width: size.w, height: size.h, cursor: hover ? 'pointer' : 'default' }}
              role="img"
              aria-label="Mapa do estado com as regiões do jogo"
              onMouseMove={e => setHover(hit(e))}
              onMouseLeave={() => setHover(null)}
              onClick={e => { const id = hit(e); if (id) setSel(id); }}
            />
          </div>
          <aside className="world-side">
            {selected && (
              <div className="card">
                <div className="row"><strong>{selected.name}</strong><span className="badge">nível {selected.minLevel}</span></div>
                <p className="small muted">{selected.description}</p>
                {owners[selected.id] && <p className="small">Domínio da semana: <span className="tag">[{owners[selected.id].tag}]</span>{owners[selected.id].mine && ' — seu bonde ganha +15% aqui'}</p>}
                <p className="small">Produto do galpão vale <b>{Math.round(selected.streetPriceMult * 100)}%</b> aqui.</p>
                {jobs.length > 0 && (
                  <ul className="world-jobs">
                    {jobs.map(j => (
                      <li key={j.id}><span>{j.name}</span><span className="cash">{formatCash(j.cash[0])}+</span></li>
                    ))}
                  </ul>
                )}
                {p.district === selected.id
                  ? <button disabled>Você está aqui</button>
                  : <button disabled={p.level < selected.minLevel} onClick={() => { onTravel(selected.id); onClose(); }}>
                      {p.level < selected.minLevel ? `Abre no nível ${selected.minLevel}` : 'Levar a gangue para cá'}
                    </button>}
              </div>
            )}
            <div className="world-list">
              {DISTRICTS.map(d => (
                <button key={d.id} className={`chip ${d.id === sel ? 'active' : ''}`} onClick={() => setSel(d.id)}
                  onMouseEnter={() => setHover(d.id)} onMouseLeave={() => setHover(null)}>
                  {d.name}{p.level < d.minLevel ? ` · ${d.minLevel}` : ''}{p.district === d.id ? ' ●' : ''}
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
