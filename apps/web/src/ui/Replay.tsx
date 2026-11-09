// Replay de batalha: linha do tempo com pausa e velocidade até 8x.
import { useEffect, useMemo, useState } from 'react';
import type { Fighter } from '@gti/shared';
import { api, type Replay } from '../api';
import { RecruitAvatarRaw } from './RecruitAvatarRaw';

const SPEEDS = [1, 2, 4, 8];

export default function ReplayModal({ id, onClose }: { id: string; onClose: () => void }) {
  const [rep, setRep] = useState<Replay | null>(null);
  const [err, setErr] = useState('');
  const [i, setI] = useState(0);
  const [speed, setSpeed] = useState(2);
  const [playing, setPlaying] = useState(true);
  useEffect(() => { api.replay(id).then(setRep).catch(e => setErr((e as Error).message)); }, [id]);
  const turns = rep?.result.turns ?? [];
  useEffect(() => {
    if (!playing || !rep || i >= turns.length) return;
    const t = setTimeout(() => setI(x => x + 1), 600 / speed);
    return () => clearTimeout(t);
  }, [playing, rep, i, speed, turns.length]);

  // estado das vidas até o turno i
  const hp = useMemo(() => {
    if (!rep) return [[], []] as number[][];
    const h = [rep.result.teams[0].map(f => f.max), rep.result.teams[1].map(f => f.max)];
    for (const t of turns.slice(0, i)) h[t.a === 0 ? 1 : 0][t.di] = t.hp;
    return h;
  }, [rep, turns, i]);
  const last = i > 0 ? turns[i - 1] : null;
  const done = rep && i >= turns.length;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Replay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal replay">
        <div className="row"><h2>{rep?.title ?? 'Replay'}</h2><button className="ghost small" onClick={onClose}>Fechar</button></div>
        {err && <p className="msg bad">{err}</p>}
        {rep && <>
          <div className="replay-sides">
            {[0, 1].map(side => (
              <div key={side} className={`replay-side ${done && rep.result.winner === side ? 'won' : ''}`}>
                <strong>{rep.sides[side]}</strong>
                {rep.result.teams[side].map((f: Fighter, k: number) => {
                  const active = last && ((last.a === side && last.ai === k) || (last.a !== side && last.di === k));
                  return (
                    <div key={k} className={`replay-f ${hp[side][k] <= 0 ? 'ko' : ''} ${active ? 'active' : ''}`}>
                      <RecruitAvatarRaw sprite={f.sprite} tint={f.tint} size={36} />
                      <div className="replay-fi">
                        <span className="small">{f.name} <span className="muted">nv {f.level}</span></span>
                        <div className="hp-thin"><div style={{ width: `${(Math.max(0, hp[side][k]) / f.max) * 100}%` }} /></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <p className="replay-log" aria-live="polite">
            {last ? `${rep.result.teams[last.a][last.ai].name} acertou ${last.dmg}${last.crit ? ' (crítico)' : ''}${last.adv > 1 ? ' com vantagem' : last.adv < 1 ? ' em desvantagem' : ''}${last.ko ? ' e derrubou' : ''}.` : 'Começou.'}
            {done && ` Vitória de ${rep.sides[rep.result.winner]}.`}
          </p>
          <input type="range" min={0} max={turns.length} value={i} onChange={e => { setI(Number(e.target.value)); setPlaying(false); }} aria-label="Linha do tempo" />
          <div className="buy-row">
            <button className="small" onClick={() => { if (done) setI(0); setPlaying(x => !x || !!done); }}>{done ? 'Ver de novo' : playing ? 'Pausar' : 'Continuar'}</button>
            {SPEEDS.map(s => <button key={s} className={speed === s ? 'chip active' : 'chip'} onClick={() => setSpeed(s)}>{s}x</button>)}
            <button className="small ghost" onClick={() => setI(turns.length)}>Pular para o fim</button>
          </div>
        </>}
      </div>
    </div>
  );
}
