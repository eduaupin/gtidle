// Aba Arena: Pontos (dominar uma especialidade), PvP ranqueado e a guerra de bondes do dia.
import { useCallback, useEffect, useState } from 'react';
import { PVP, POINT_BONUS, SPECS, WAR, formatDuration, type PlayerState } from '@gti/shared';
import { api, type ArenaView, type StateResponse } from '../api';
import ReplayModal from './Replay';
import { SpecTag } from './RecruitBits';
import { useNow } from './Hud';

export default function ArenaPanel({ p, onState }: { p: PlayerState; onState: (r: StateResponse) => void }) {
  const now = useNow(1000);
  const [v, setV] = useState<ArenaView | null>(null);
  const [replay, setReplay] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => api.arena().then(r => { setV(r.data); onState(r); }).catch(() => {}), [onState]);
  useEffect(() => { load(); }, [load]);

  const fight = async (fn: () => Promise<{ data: { won: boolean; replayId: string; view: ArenaView } } & StateResponse>, ok: string, bad: string) => {
    setBusy(true); setMsg(null);
    try { const r = await fn(); onState(r); setV(r.data.view); setMsg({ text: r.data.won ? ok : bad, bad: !r.data.won }); setReplay(r.data.replayId); }
    catch (e) { setMsg({ text: (e as Error).message, bad: true }); }
    finally { setBusy(false); }
  };
  if (!v) return <div className="panel"><p className="muted">Abrindo a arena…</p></div>;
  const pvpReady = now - v.pvp.lastAt >= v.pvp.cooldownSec * 1000;
  const nextWar = (() => { const d = new Date(now); d.setUTCHours(WAR.hourUtc, 0, 0, 0); if (d.getTime() <= now) d.setUTCDate(d.getUTCDate() + 1); return d.getTime(); })();

  return (
    <div className="panel arena">
      {msg && <p className={msg.bad ? 'msg bad' : 'msg'}>{msg.text}</p>}

      <section className="section">
        <div className="section-head"><h3>Acerto de contas (PvP)</h3><span className="meta">Temporada {v.pvp.season}</span></div>
        <p className="section-note">Luta automática 1 contra 1 entre times de capangas, contra alguém com nota parecida. Monte o time de PvP no Depósito (se não montar, vai o time principal). A temporada vira todo mês com prêmio pelo rank.</p>
        <div className="kv">
          <div><small>Rank</small><b>{v.pvp.rank}</b></div>
          <div><small>Nota</small><b>{v.pvp.rating}</b></div>
          <div><small>Vitórias / derrotas</small><b>{v.pvp.wins} / {v.pvp.losses}</b></div>
          <div><small>Posição</small><b>{v.pvp.position ? `${v.pvp.position}º` : '—'}</b></div>
        </div>
        <div className="buy-row">
          <button disabled={busy || p.level < v.pvp.minLevel || !pvpReady} onClick={() => fight(api.arenaPvp, 'Vitória! Veja o replay.', 'Derrota. Veja o replay e ajuste o time.')}>
            {p.level < v.pvp.minLevel ? `Abre no nível ${v.pvp.minLevel}` : pvpReady ? 'Procurar luta' : `Próxima em ${Math.ceil((v.pvp.cooldownSec * 1000 - (now - v.pvp.lastAt)) / 1000)} s`}
          </button>
        </div>
        {v.pvp.top.length > 0 && (
          <ol className="ranking">
            {v.pvp.top.map((r, i) => <li key={i} className={r.me ? 'me' : ''}><span>{r.nick} <span className="muted small">{r.rank}</span></span><span>{r.rating}</span></li>)}
          </ol>
        )}
        <p className="small muted">Ranks: {PVP.ranks.map(r => r.name).join(', ')}. Mestre, Grão-Mestre e Desafiante só para o topo da tabela.</p>
      </section>

      <section className="section">
        <div className="section-head"><h3>Pontos da cidade</h3><span className="meta">a partir do nível {v.pointMinLevel}</span></div>
        <p className="section-note">Cada Ponto é de uma especialidade. Quem domina leva o título e +{Math.round(POINT_BONUS * 100)}% nos atributos dos capangas dessa especialidade, nos assaltos e nas lutas. Para desafiar, leve pelo menos um capanga dela no time.</p>
        <div className="grid-auto">
          {v.points.map(pt => {
            const cd = pt.cooldownUntil > now;
            return (
              <div key={pt.spec} className={`point-card ${pt.mine ? 'mine' : ''}`}>
                <div className="row"><strong>{pt.name}</strong><SpecTag spec={pt.spec} /></div>
                <span className="small">{pt.holder ? <>Dono: <b>{pt.holder}</b>{pt.mine ? ' (você)' : ''}</> : 'Sem dono: vença o líder da rua'}</span>
                {pt.holder && <span className="small muted">{pt.defenses} defesa{pt.defenses === 1 ? '' : 's'} · força {pt.strength}</span>}
                <button className="small" disabled={busy || pt.mine || p.level < v.pointMinLevel || cd}
                  onClick={() => fight(() => api.arenaPoint(pt.spec), `O ${pt.name} agora é seu.`, 'Não deu: o dono segurou. Tente com um time mais forte.')}>
                  {pt.mine ? 'Seu' : cd ? `Volte em ${formatDuration((pt.cooldownUntil - now) / 1000)}` : 'Desafiar'}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h3>Guerra de bondes</h3><span className="meta">próxima em {formatDuration((nextWar - now) / 1000)}</span></div>
        <p className="section-note">Todo dia às {WAR.hourUtc} h (UTC) o servidor coloca os bondes frente a frente: vai o melhor capanga de cada membro, até {WAR.membersPerSide}. Não precisa estar online. Quem vence ganha {WAR.winDiamonds} diamantes por membro.</p>
        {v.wars.length === 0 && <p className="empty">Nenhuma guerra ainda. Entre num bonde na aba Bonde.</p>}
        <ul className="war-list">
          {v.wars.map(w => (
            <li key={w.replayId}>
              <span>{w.day}</span>
              <span><b className={w.winner === 0 ? 'win' : ''}>[{w.a.tag}]</b> x <b className={w.winner === 1 ? 'win' : ''}>[{w.b.tag}]</b></span>
              <button className="small ghost" onClick={() => setReplay(w.replayId)}>Replay</button>
            </li>
          ))}
        </ul>
      </section>

      {v.recent.length > 0 && (
        <section className="section">
          <div className="section-head"><h3>Suas lutas</h3></div>
          <ul className="war-list">
            {v.recent.map(r => (
              <li key={r.id}>
                <span>{r.title}</span>
                <span className={r.sides[r.winner] === p.nick ? 'win' : 'lose'}>{r.sides[r.winner] === p.nick ? 'Vitória' : 'Derrota'} contra {r.sides[0] === p.nick ? r.sides[1] : r.sides[0]}</span>
                <button className="small ghost" onClick={() => setReplay(r.id)}>Replay</button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {replay && <ReplayModal id={replay} onClose={() => setReplay(null)} />}
      <p className="small muted">Especialidades: {SPECS.map(s => `${s.name} (${s.note.toLowerCase()})`).join('; ')}.</p>
    </div>
  );
}
