// Calçadão: praça compartilhada. Todo mundo aparece com o visual da gangue; o que se fala no chat sobe num balão.
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { DIAMOND_ITEMS, type PlayerState } from '@gti/shared';
import { getToken } from '../api';
import { drawCar, drawPerson, drawTreeCanopy } from '../game/draw';
import { carOf, outfitOf } from '../game/look';
import { asphalt, paving } from '../game/textures';
import { spritesReady } from '../game/sprites';

interface Guy { id: string; nick: string; x: number; y: number; character: string; vehicle: string; vip: boolean }
interface Bubble { nick: string; text: string; at: number }
const W = 1200, H = 700;
const byId = (id: string) => DIAMOND_ITEMS.find(i => i.id === id);

export default function Plaza({ p }: { p: PlayerState }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const sock = useRef<Socket | null>(null);
  const guys = useRef<Map<string, Guy & { dx: number; dy: number }>>(new Map());
  const bubbles = useRef<Bubble[]>([]);
  const [count, setCount] = useState(0);
  const [text, setText] = useState('');

  useEffect(() => {
    const s = io({ auth: { token: getToken() } });
    sock.current = s;
    s.on('connect', () => s.emit('plaza:join'));
    s.on('plaza:state', (list: Guy[]) => {
      const m = guys.current;
      const seen = new Set<string>();
      for (const g of list) {
        seen.add(g.id);
        const old = m.get(g.id);
        m.set(g.id, { ...g, dx: old?.dx ?? g.x, dy: old?.dy ?? g.y });
      }
      for (const k of [...m.keys()]) if (!seen.has(k)) m.delete(k);
      setCount(list.length);
    });
    s.on('chat', (b: Bubble) => { bubbles.current = [...bubbles.current.filter(x => Date.now() - x.at < 6000), { ...b, at: Date.now() }]; });
    return () => { s.emit('plaza:leave'); s.disconnect(); };
  }, []);

  useEffect(() => {
    let raf = 0, alive = true;
    const pav = paving('#8c8577', 21), asp = asphalt('#3d4150', 22);
    spritesReady.then(() => {
      const draw = () => {
        if (!alive) return;
        const c = ref.current; if (!c) { raf = requestAnimationFrame(draw); return; }
        const g = c.getContext('2d')!;
        g.fillStyle = g.createPattern(pav, 'repeat')!; g.fillRect(0, 0, W, H);
        g.fillStyle = g.createPattern(asp, 'repeat')!; g.fillRect(0, 0, W, 90); g.fillRect(0, H - 70, W, 70);
        g.fillStyle = 'rgba(235,225,190,.7)'; for (let x = 20; x < W; x += 90) { g.fillRect(x, 42, 50, 5); g.fillRect(x, H - 38, 50, 5); }
        // ondas do calçadão
        g.strokeStyle = 'rgba(30,30,30,.25)'; g.lineWidth = 6;
        for (let y = 120; y < H - 90; y += 46) { g.beginPath(); for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x / 40) * 10); g.stroke(); }
        for (const [x, y] of [[90, 140], [1110, 150], [600, 610], [300, 600], [900, 610]]) drawTreeCanopy(g, x, y, 38, x);
        const now = Date.now();
        for (const gy of guys.current.values()) {
          gy.dx += (gy.x - gy.dx) * 0.08; gy.dy += (gy.y - gy.dy) * 0.08;
          const ch = byId(gy.character), car = byId(gy.vehicle);
          if (car) drawCar(g, gy.dx + 150, gy.dy + 14, 0, carOf(car), 9);
          drawPerson(g, gy.dx, gy.dy, Math.PI / 2, outfitOf(ch), now / 300, '#2a1d14', 15);
          g.font = '700 30px Barlow, sans-serif'; g.textAlign = 'center';
          g.fillStyle = gy.vip ? '#f2a93b' : '#ece6da';
          g.strokeStyle = 'rgba(0,0,0,.8)'; g.lineWidth = 4; g.strokeText(gy.nick, gy.dx, gy.dy + 78); g.fillText(gy.nick, gy.dx, gy.dy + 78);
          const b = [...bubbles.current].reverse().find(x => x.nick === gy.nick && now - x.at < 6000);
          if (b) {
            g.font = '500 30px Barlow, sans-serif';
            const t = b.text.length > 40 ? b.text.slice(0, 38) + '…' : b.text;
            const w = g.measureText(t).width + 30;
            g.fillStyle = 'rgba(245,241,232,.96)'; g.beginPath(); g.roundRect(gy.dx - w / 2, gy.dy - 130, w, 52, 16); g.fill();
            g.beginPath(); g.moveTo(gy.dx - 10, gy.dy - 79); g.lineTo(gy.dx + 10, gy.dy - 79); g.lineTo(gy.dx, gy.dy - 64); g.fill();
            g.fillStyle = '#1c2433'; g.fillText(t, gy.dx, gy.dy - 94);
          }
        }
        raf = requestAnimationFrame(draw);
      };
      draw();
    });
    return () => { alive = false; cancelAnimationFrame(raf); };
  }, []);

  const click = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    sock.current?.emit('plaza:move', { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H });
  };
  const send = (e: React.FormEvent) => { e.preventDefault(); if (text.trim()) { sock.current?.emit('chat', text); setText(''); } };

  return (
    <section className="section plaza">
      <div className="section-head"><h3>Calçadão</h3><span className="meta">{count} na praça</span></div>
      <p className="section-note">A praça da cidade: todo mundo aparece com o visual e o carro da gangue. Toque no chão para andar; o que você escreve aparece num balão e no chat.</p>
      <canvas ref={ref} width={W} height={H} onClick={click} className="plaza-canvas" aria-label="Calçadão com os jogadores online" />
      <form className="row" onSubmit={send}>
        <input value={text} maxLength={200} onChange={e => setText(e.target.value)} placeholder={`Falar como ${p.nick}`} aria-label="Mensagem" style={{ flex: 1 }} />
        <button className="small">Falar</button>
      </form>
    </section>
  );
}
