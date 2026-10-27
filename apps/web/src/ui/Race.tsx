// Corrida de rua no Autódromo: 30 segundos desviando do trânsito em 3 faixas.
// O servidor sorteia a semente e confere tempo e distância (não dá para mandar qualquer número).
// No fim sai um GIF dos últimos segundos para compartilhar.
import { useEffect, useRef, useState } from 'react';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { RACE, formatCash, type PlayerState } from '@gti/shared';
import { api, type RaceResult, type StateResponse } from '../api';
import { drawCar, type CarLook } from '../game/draw';
import { equippedLook } from '../game/look';
import { spritesReady } from '../game/sprites';
import { inviteUrl } from '../game/socialCards';
import ShareImage from './ShareImage';

const W = 360, H = 560, ROAD_X = 30, ROAD_W = 300, LANE_W = ROAD_W / RACE.lanes;
const CAR_Y = H - 110, SCALE = 2.9, CAR_L = 18.5 * SCALE, CAR_W = CAR_L * 0.5;
/** Pixels por metro: a pista "anda" na tela nessa proporção */
const PX_PER_M = 4.2;
const GIF_W = 240, GIF_H = Math.round(H * GIF_W / W), GIF_FRAMES = 36, GIF_EVERY = 0.11;
const TRAFFIC = ['#c9c1aa', '#5a6270', '#2563eb', '#84cc16', '#e8262c', '#f4f4f2', '#16181d', '#f2c14e'];

const lcg = (seed: number) => () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const laneX = (lane: number) => ROAD_X + LANE_W * (lane + 0.5);

interface Car { lane: number; y: number; speed: number; look: CarLook }

export default function RaceModal({ p, onState, onClose }: { p: PlayerState; onState: (r: StateResponse) => void; onClose: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const input = useRef(0);
  const [phase, setPhase] = useState<'ready' | 'count' | 'run' | 'send' | 'done' | 'error'>('ready');
  const [count, setCount] = useState(3);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [error, setError] = useState('');
  const [gif, setGif] = useState<Blob | null>(null);
  const [sharing, setSharing] = useState(false);
  const live = useRef({ dist: 0, time: 0, speed: RACE.baseSpeed as number });
  const [hud, setHud] = useState({ dist: 0, time: 0, speed: 0 });

  // teclado: setas ou A/D
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'a', 'A'].includes(e.key)) { input.current = -1; e.preventDefault(); }
      if (['ArrowRight', 'd', 'D'].includes(e.key)) { input.current = 1; e.preventDefault(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // pista parada antes de começar
  useEffect(() => {
    if (phase !== 'ready') return;
    spritesReady.then(() => {
      const g = ref.current?.getContext('2d');
      if (g) paint(g, 0, 1, [], equippedLook(p).car, 0, 0, 0, false);
    });
  }, [phase, p]);

  const start = async () => {
    setError('');
    let race: { raceId: string; seed: number };
    try { const r = await api.raceStart(); onState(r); race = r.data; }
    catch (e) { setError((e as Error).message); setPhase('error'); return; }
    setPhase('count');
    for (let i = 3; i > 0; i--) { setCount(i); await new Promise(r => setTimeout(r, 700)); }
    setPhase('run');
    const frames = await runGame(race.seed);
    setPhase('send');
    try {
      const r = await api.raceFinish(race.raceId, Math.floor(live.current.dist));
      onState(r); setResult(r.data); setPhase('done');
    } catch (e) { setError((e as Error).message); setPhase('error'); }
    setGif(encodeGif(frames));
  };

  /** Loop do jogo. Devolve os quadros guardados para o GIF. */
  const runGame = (seed: number) => new Promise<ImageData[]>(resolve => {
    const g = ref.current!.getContext('2d')!;
    const rand = lcg(seed);
    const { car: look } = equippedLook(p);
    const traffic: Car[] = [];
    const frames: ImageData[] = [];
    const small = document.createElement('canvas'); small.width = GIF_W; small.height = GIF_H;
    const sg = small.getContext('2d', { willReadFrequently: true })!;
    let lane = 1, x = laneX(1), v: number = RACE.baseSpeed, dist = 0, t = 0, nextSpawn = 0.6, hitUntil = 0, lastGrab = 0;
    let prev = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      t += dt;
      if (input.current) { lane = Math.max(0, Math.min(RACE.lanes - 1, lane + input.current)); input.current = 0; }
      x += (laneX(lane) - x) * Math.min(1, dt * 14);
      v = Math.min(RACE.maxSpeed, v + RACE.accel * dt);
      dist += v * dt;
      // trânsito: carros mais lentos na mesma direção (descem na tela pela diferença de velocidade)
      nextSpawn -= dt;
      if (nextSpawn <= 0) {
        const busy = new Set(traffic.filter(c => c.y < 120).map(c => c.lane));
        const free = [0, 1, 2].filter(l => !busy.has(l));
        // nunca fecha as 3 faixas juntas
        if (free.length > 1) {
          const l = free[Math.floor(rand() * free.length)];
          traffic.push({ lane: l, y: -CAR_L, speed: 12 + rand() * 14, look: { color: TRAFFIC[Math.floor(rand() * TRAFFIC.length)], kind: rand() < 0.12 ? 'taxi' : 'car' } });
        }
        nextSpawn = Math.max(0.32, 0.9 - t * 0.018) * (0.7 + rand() * 0.6);
      }
      for (const c of traffic) c.y += (v - c.speed) * PX_PER_M * dt;
      for (let i = traffic.length - 1; i >= 0; i--) if (traffic[i].y > H + CAR_L) traffic.splice(i, 1);
      // batida
      if (t > hitUntil) {
        for (const c of traffic) {
          if (Math.abs(laneX(c.lane) - x) < CAR_W * 0.9 && Math.abs(c.y - CAR_Y) < CAR_L * 0.85) {
            v = Math.max(RACE.baseSpeed * 0.5, v * RACE.crashKeep);
            hitUntil = t + 1.2;
            c.y = H + CAR_L * 2; // tira o carro da frente
            break;
          }
        }
      }
      const left = Math.max(0, RACE.seconds - t);
      paint(g, dist, v, traffic, look, x, left, t < hitUntil ? t : 0, true);
      live.current = { dist, time: left, speed: v };
      if (Math.floor(t * 10) !== Math.floor((t - dt) * 10)) setHud({ dist, time: left, speed: v });
      if (t - lastGrab >= GIF_EVERY) {
        lastGrab = t;
        sg.drawImage(g.canvas, 0, 0, GIF_W, GIF_H);
        frames.push(sg.getImageData(0, 0, GIF_W, GIF_H));
        if (frames.length > GIF_FRAMES) frames.shift();
      }
      if (t >= RACE.seconds) {
        // quadro final com o placar
        paintFinish(g, dist, p.nick);
        sg.drawImage(g.canvas, 0, 0, GIF_W, GIF_H);
        const end = sg.getImageData(0, 0, GIF_W, GIF_H);
        for (let i = 0; i < 12; i++) frames.push(end);
        resolve(frames);
        return;
      }
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });

  // toque: metade esquerda/direita da pista
  const tap = (e: React.PointerEvent) => {
    const r = (e.target as HTMLElement).getBoundingClientRect();
    input.current = e.clientX - r.left < r.width / 2 ? -1 : 1;
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Corrida de rua" onClick={e => e.target === e.currentTarget && phase !== 'run' && onClose()}>
      <div className="modal race">
        <div className="row">
          <h2>Corrida no Autódromo</h2>
          {phase !== 'run' && phase !== 'count' && <button className="ghost small" onClick={onClose}>Fechar</button>}
        </div>
        <div className="race-stage">
          <canvas ref={ref} width={W} height={H} onPointerDown={tap} aria-label="Pista" />
          {phase === 'run' && (
            <div className="race-hud">
              <span>{Math.floor(hud.dist)} m</span><span>{Math.round(hud.speed * 3.6)} km/h</span><span>{hud.time.toFixed(1)} s</span>
            </div>
          )}
          {phase === 'count' && <div className="race-count">{count}</div>}
          {phase === 'ready' && (
            <div className="race-intro">
              <p>{RACE.seconds} segundos. Desvie do trânsito trocando de faixa: setas, A/D ou toque nos lados da pista. Bater derruba a velocidade.</p>
              <p className="small">As {RACE.rewardedRunsPerDay} primeiras corridas do dia pagam grana e XP. Seu recorde vale para o ranking da semana.</p>
              <button onClick={start}>Largar</button>
            </div>
          )}
        </div>
        {phase === 'send' && <p className="muted">Conferindo o tempo com a direção da prova…</p>}
        {phase === 'error' && <p className="msg bad">{error}</p>}
        {phase === 'done' && result && (
          <div className="race-result">
            <h3>{result.distance} m {result.newBest && <span className="badge boost">Novo recorde!</span>}</h3>
            <p>{result.rewarded ? `Prêmio: ${formatCash(result.cash)}. Corridas pagas restantes hoje: ${result.runsLeft}.` : 'Treino: as corridas pagas de hoje acabaram, mas o recorde vale.'}</p>
            {result.board.myRank && <p className="small">Você está em {result.board.myRank}º no ranking da semana.</p>}
            <div className="alert-actions">
              <button onClick={() => { setPhase('ready'); setResult(null); setGif(null); }}>Correr de novo</button>
              <button className="ghost" disabled={!gif} onClick={() => setSharing(true)}>{gif ? 'Compartilhar replay' : 'Gerando replay…'}</button>
            </div>
          </div>
        )}
      </div>
      {sharing && gif && result && (
        <ShareImage title="Replay da corrida" filename={`corrida-${result.distance}m.gif`}
          text={`Fiz ${result.distance} m em ${RACE.seconds} s no Autódromo do ${location.host}. Duvido você bater: ${inviteUrl(p.referral.code)}`}
          make={async () => gif} onClose={() => setSharing(false)} />
      )}
    </div>
  );
}

function paint(g: CanvasRenderingContext2D, dist: number, v: number, traffic: Car[], look: CarLook, x: number, left: number, hit: number, running: boolean) {
  const off = (dist * PX_PER_M) % 80;
  g.fillStyle = '#2f5a24'; g.fillRect(0, 0, W, H);
  // zebras
  for (let y = -40 + (off % 40); y < H; y += 40) {
    const red = Math.floor((y - off) / 40) % 2 === 0;
    g.fillStyle = red ? '#e8262c' : '#f4f4f2';
    g.fillRect(ROAD_X - 12, y, 12, 40); g.fillRect(ROAD_X + ROAD_W, y, 12, 40);
  }
  g.fillStyle = '#34373f'; g.fillRect(ROAD_X, 0, ROAD_W, H);
  g.fillStyle = 'rgba(255,255,255,.04)';
  for (let i = 0; i < 60; i++) g.fillRect(ROAD_X + ((i * 53) % ROAD_W), ((i * 97 + dist * PX_PER_M) % H), 3, 3);
  g.fillStyle = 'rgba(240,235,210,.8)';
  for (let l = 1; l < RACE.lanes; l++) for (let y = -80 + off; y < H; y += 80) g.fillRect(ROAD_X + LANE_W * l - 2, y, 4, 40);
  // largada no começo
  if (dist * PX_PER_M < H) {
    const y = CAR_Y + CAR_L + dist * PX_PER_M - 20;
    for (let i = 0; i < ROAD_W / 15; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f2'; g.fillRect(ROAD_X + i * 15, y + j * 15, 15, 15);
    }
  }
  for (const c of traffic) drawCar(g, laneX(c.lane), c.y, -Math.PI / 2, c.look, SCALE);
  if (!hit || Math.floor(hit * 12) % 2 === 0) drawCar(g, x, CAR_Y, -Math.PI / 2, look, SCALE);
  // rastro de velocidade
  if (running && v > 50) {
    g.strokeStyle = `rgba(255,255,255,${(v - 50) / 60})`; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const sx = ROAD_X + ((i * 61 + dist * 7) % ROAD_W); g.beginPath(); g.moveTo(sx, (i * 89) % H); g.lineTo(sx, (i * 89) % H + 40); g.stroke(); }
  }
  // placa do canto (aparece no GIF também)
  g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(8, 8, 150, 50);
  g.fillStyle = '#f2a93b'; g.font = '800 26px "Barlow Condensed", sans-serif'; g.textBaseline = 'top';
  g.fillText(`${Math.floor(dist)} m`, 16, 12);
  g.fillStyle = '#ece6da'; g.font = '600 14px Barlow, sans-serif';
  g.fillText(running ? `${left.toFixed(1)} s · ${Math.round(v * 3.6)} km/h` : 'Autódromo', 16, 40);
}

function paintFinish(g: CanvasRenderingContext2D, dist: number, nick: string) {
  g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < W / 20; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#f4f4f2'; g.fillRect(i * 20, 150 + j * 20, 20, 20); }
  g.textAlign = 'center';
  g.fillStyle = '#f2a93b'; g.font = '900 72px "Barlow Condensed", sans-serif'; g.fillText(`${Math.floor(dist)} m`, W / 2, 220);
  g.fillStyle = '#ece6da'; g.font = '700 26px Barlow, sans-serif'; g.fillText(`${nick} em ${RACE.seconds} s`, W / 2, 310);
  g.font = '600 18px Barlow, sans-serif'; g.fillText(`Bata essa marca: ${location.host}`, W / 2, 350);
  g.textAlign = 'left';
}

function encodeGif(frames: ImageData[]) {
  const gif = GIFEncoder();
  // paleta única tirada do meio da corrida: arquivo menor e cores estáveis
  const palette = quantize(frames[Math.floor(frames.length / 2)].data, 128);
  frames.forEach((f, i) => gif.writeFrame(applyPalette(f.data, palette), GIF_W, GIF_H, { palette, delay: i >= frames.length - 12 ? 160 : Math.round(GIF_EVERY * 1000) }));
  gif.finish();
  return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: 'image/gif' });
}
