// Aba Bonde: o bonde (grupo fixo), o golpe em equipe de 4 e a guerra de territórios da semana.
import { useCallback, useEffect, useState } from 'react';
import { CREW, TEAM_HEISTS, TEAM_ROLES, formatCash, formatDuration, type PlayerState } from '@gti/shared';
import { api, type CrewView, type StateResponse, type TeamInfo, type With } from '../api';
import { useNow } from './Hud';
import { inviteUrl } from '../game/socialCards';

const ROLE_HINT: Record<string, string> = {
  motorista: 'Pilota a fuga', hacker: 'Desliga o alarme', arrombador: 'Abre o cofre', vigia: 'Fica de olho na viatura',
};

export default function CrewPanel({ p, onState }: { p: PlayerState; onState: (r: StateResponse) => void }) {
  const now = useNow(1000);
  const [v, setV] = useState<CrewView | null>(null);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [tag, setTag] = useState('');
  const [code, setCode] = useState('');
  const [teamCode, setTeamCode] = useState('');
  const [heist, setHeist] = useState(TEAM_HEISTS[0].id);
  const [role, setRole] = useState<string>('motorista');

  const load = useCallback(() => api.crew().then(r => { setV(r.data); onState(r); }).catch(e => setMsg({ text: (e as Error).message, bad: true })), [onState]);
  useEffect(() => { load(); const id = setInterval(load, 15_000); return () => clearInterval(id); }, [load]);

  const run = async (fn: () => Promise<With<unknown>>, ok: string) => {
    setBusy(true); setMsg(null);
    try { onState(await fn()); await load(); setMsg({ text: ok }); }
    catch (e) { setMsg({ text: (e as Error).message, bad: true }); }
    finally { setBusy(false); }
  };
  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); setMsg({ text: 'Copiado.' }); } catch { /* sem permissão */ } };

  if (!v) return <div className="panel"><p className="muted">Chamando o bonde…</p></div>;
  const c = v.crew;
  const team = v.team.mine;

  return (
    <div className="panel crew">
      <p className="lead">Junte até {v.maxMembers} amigos num bonde. Cada assalto soma pontos para a região onde aconteceu. Quem fizer mais pontos na semana domina a região na semana seguinte: <b>+{Math.round(v.bonus * 100)}% de grana</b> nos assaltos de lá para todo o bonde.</p>
      {msg && <p className={msg.bad ? 'msg bad' : 'msg'}>{msg.text}</p>}

      {c ? (
        <div className="card">
          <div className="row">
            <h3>{c.name} <span className="tag">[{c.tag}]</span></h3>
            <span className="badge">{c.weekPoints.toLocaleString('pt-BR')} pts na semana</span>
          </div>
          <ul className="members">
            {c.members.map(m => (
              <li key={m.code}>
                <span>{m.owner && '♛ '}{m.nick}{m.vip && ' ★'}</span>
                <span className="muted small">Nível {m.level}</span>
              </li>
            ))}
          </ul>
          <div className="row">
            <span className="small">Código do bonde: <b className="code">{c.code}</b></span>
            <button className="small ghost" onClick={() => copy(`Entra no meu bonde ${c.name} no ${location.host}: código ${c.code}. ${inviteUrl(p.referral.code)}`)}>Copiar convite</button>
            <button className="small ghost" disabled={busy} onClick={() => run(api.crewLeave, 'Você saiu do bonde.')}>Sair</button>
          </div>
        </div>
      ) : (
        <div className="card two-col">
          <form onSubmit={e => { e.preventDefault(); run(() => api.crewCreate(name, tag), 'Bonde fundado!'); }}>
            <h4>Fundar um bonde</h4>
            <input value={name} maxLength={CREW.nameMax} onChange={e => setName(e.target.value)} placeholder="Nome do bonde" aria-label="Nome do bonde" />
            <input value={tag} maxLength={CREW.tagMax} onChange={e => setTag(e.target.value.toUpperCase())} placeholder="Sigla (2 a 4)" aria-label="Sigla do bonde" />
            <button disabled={busy || name.trim().length < 3 || tag.length < CREW.tagMin || p.cash < v.cost}>Fundar por {formatCash(v.cost)}</button>
          </form>
          <form onSubmit={e => { e.preventDefault(); run(() => api.crewJoin(code), 'Você entrou no bonde!'); }}>
            <h4>Entrar com código</h4>
            <input value={code} maxLength={6} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="Código do bonde" aria-label="Código do bonde" />
            <button disabled={busy || code.length < 4}>Entrar</button>
          </form>
        </div>
      )}

      <h3>Golpe em equipe</h3>
      <p className="small muted">Quatro jogadores, quatro funções. Quando todas estiverem preenchidas o golpe começa e cada um recebe a parte dele em grana suja, peças e chance de raro. Equipe que não fecha em 2 h é desfeita.</p>
      {team ? <TeamCard t={team} now={now} busy={busy} onLeave={() => run(api.teamLeave, 'Você saiu da equipe.')} onCopy={() => copy(`Falta gente no ${TEAM_HEISTS.find(h => h.id === team.heistId)?.name}! Código da equipe: ${team.code} — ${location.origin}`)} /> : (
        <div className="card two-col">
          <form onSubmit={e => { e.preventDefault(); run(() => api.teamCreate(heist, role), 'Equipe montada. Chame mais três.'); }}>
            <h4>Montar equipe</h4>
            <select value={heist} onChange={e => setHeist(e.target.value)} aria-label="Golpe">
              {TEAM_HEISTS.map(h => <option key={h.id} value={h.id} disabled={p.level < h.minLevel}>{h.name} · nível {h.minLevel} · {h.minutes} min</option>)}
            </select>
            <RolePicker role={role} setRole={setRole} />
            <button disabled={busy || p.level < (TEAM_HEISTS.find(h => h.id === heist)?.minLevel ?? 0)}>Montar</button>
          </form>
          <form onSubmit={e => { e.preventDefault(); run(() => api.teamJoin(teamCode, role), 'Você entrou na equipe.'); }}>
            <h4>Entrar com código</h4>
            <input value={teamCode} maxLength={6} onChange={e => setTeamCode(e.target.value.toUpperCase())} placeholder="Código da equipe" aria-label="Código da equipe" />
            <RolePicker role={role} setRole={setRole} />
            <button disabled={busy || teamCode.length < 4}>Entrar</button>
          </form>
        </div>
      )}
      {!team && v.team.open.length > 0 && (
        <div className="open-teams">
          <h4>Equipes procurando gente</h4>
          {v.team.open.map(t => {
            const def = TEAM_HEISTS.find(h => h.id === t.heistId)!;
            return (
              <div key={t.id} className="open-team">
                <div><b>{def.name}</b> <span className="muted small">de {t.leader} · nível {def.minLevel}+ · fecha em {formatDuration((t.expiresAt - now) / 1000)}</span></div>
                <div className="roles">
                  {TEAM_ROLES.map(r => t.slots[r.id]
                    ? <span key={r.id} className="badge">{r.name}: {t.slots[r.id]!.nick}</span>
                    : <button key={r.id} className="small" disabled={busy || p.level < def.minLevel} onClick={() => run(() => api.teamJoin(t.code, r.id), 'Você entrou na equipe.')}>Ser {r.name.toLowerCase()}</button>)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3>Territórios da semana</h3>
      <div className="territories">
        {v.standings.map(d => (
          <div key={d.district} className={`terr ${d.owner?.mine ? 'mine' : ''}`}>
            <b>{d.name}</b>
            <span className="small">{d.owner ? <>Domínio: <span className="tag">[{d.owner.tag}]</span></> : <span className="muted">Sem dono</span>}</span>
            <span className="small muted">{d.top.length ? d.top.map(t => `${t.tag} ${t.points}`).join(' · ') : 'ninguém pontuou'}</span>
          </div>
        ))}
      </div>
      {v.ranking.length > 0 && (
        <>
          <h4>Ranking de bondes ({v.week})</h4>
          <ol className="ranking">
            {v.ranking.map(r => <li key={r.tag} className={r.mine ? 'me' : ''}><span>[{r.tag}] {r.name}</span><span>{r.points.toLocaleString('pt-BR')} pts</span></li>)}
          </ol>
        </>
      )}
    </div>
  );
}

function RolePicker({ role, setRole }: { role: string; setRole: (r: string) => void }) {
  return (
    <div className="chips" role="radiogroup" aria-label="Função">
      {TEAM_ROLES.map(r => (
        <button type="button" key={r.id} role="radio" aria-checked={role === r.id} className={role === r.id ? 'chip active' : 'chip'} onClick={() => setRole(r.id)} title={ROLE_HINT[r.id]}>{r.name}</button>
      ))}
    </div>
  );
}

function TeamCard({ t, now, busy, onLeave, onCopy }: { t: TeamInfo; now: number; busy: boolean; onLeave: () => void; onCopy: () => void }) {
  const def = TEAM_HEISTS.find(h => h.id === t.heistId)!;
  const running = t.startedAt && t.endsAt;
  const pct = running ? Math.min(100, ((now - t.startedAt!) / (t.endsAt! - t.startedAt!)) * 100) : 0;
  return (
    <div className="card team">
      <div className="row">
        <h4>{def.name}</h4>
        <span className="badge">{formatCash(def.cash[0])}–{formatCash(def.cash[1])} cada</span>
      </div>
      <p className="small muted">{def.description}</p>
      <div className="roles">
        {TEAM_ROLES.map(r => {
          const s = t.slots[r.id];
          return <div key={r.id} className={`role ${s ? 'filled' : ''} ${s?.me ? 'me' : ''}`}><b>{r.name}</b><span>{s ? s.nick : 'vaga'}</span></div>;
        })}
      </div>
      {running ? (
        <>
          <div className="bar"><div style={{ width: `${pct}%` }} /></div>
          <p className="small">Em andamento: volta em {formatDuration((t.endsAt! - now) / 1000)}.</p>
        </>
      ) : (
        <div className="row">
          <span className="small">Código: <b className="code">{t.code}</b> · fecha em {formatDuration((t.expiresAt - now) / 1000)}</span>
          <button className="small" onClick={onCopy}>Chamar a galera</button>
          <button className="small ghost" disabled={busy} onClick={onLeave}>Sair</button>
        </div>
      )}
    </div>
  );
}
