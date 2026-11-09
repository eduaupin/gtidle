// Aba Capangas: time em campo, recrutamento (convites e automático), treino no esconderijo,
// depósito com ações e o álbum de tudo que já viu e recrutou.
import { useMemo, useState } from 'react';
import {
  INVITES, MARKET, RECRUIT, RARITY_NAME, ROBBERIES, SPECIES, SPECS, formatCash, incomePerHour, isVip, powerClass,
  recruitScore, recruitStats, speciesById, teamEffect, VIP_SUPPLY, type InviteId, type PlayerState, type Rarity, type Recruit,
} from '@gti/shared';
import { api, type StateResponse } from '../api';
import { RecruitAvatar, RecruitLine, SpecTag } from './RecruitBits';

type Act = (a: import('@gti/shared').Action) => Promise<void> | void;
type View = 'time' | 'deposito' | 'album';

export default function RecruitsPanel({ p, act, onState }: { p: PlayerState; act: Act; onState: (r: StateResponse) => void }) {
  const [view, setView] = useState<View>('time');
  const R = p.recruits;
  const byUid = (u: string) => R.depot.find(r => r.uid === u);
  const team = R.team.map(byUid).filter((r): r is Recruit => !!r);
  const running = p.robberies.map(s => ROBBERIES.find(j => j.id === s.jobId)).find(Boolean);
  const eff = running ? teamEffect(p, running) : null;

  return (
    <div className="panel recruits">
      <div className="chips" role="tablist" aria-label="Capangas">
        {([['time', `Time (${team.length}/${RECRUIT.teamSize})`], ['deposito', `Depósito (${R.depot.length})`], ['album', `Álbum (${Object.values(R.album).filter(a => a.caught).length}/${SPECIES.length})`]] as [View, string][])
          .map(([id, label]) => <button key={id} role="tab" aria-selected={view === id} className={view === id ? 'chip active' : 'chip'} onClick={() => setView(id)}>{label}</button>)}
      </div>

      {view === 'time' && <>
        <section className="section">
          <div className="section-head">
            <h3>Time em campo</h3>
            {eff && running && <span className="meta">No {running.name}: força {Math.round(eff.ratio * 100)}% do pedido</span>}
          </div>
          <p className="section-note">Até {RECRUIT.teamSize} capangas saem com a gangue. Time forte faz o assalto mais rápido, rende mais e leva menos dano. Cada especialidade rende +25% no alvo certo (hacker e arrombador em banco, motorista em garagem...).</p>
          {team.length === 0 && <p className="empty">Nenhum capanga no time. Escolha o primeiro no aviso da tela ou recrute depois de um assalto.</p>}
          <div className="recruit-list">
            {team.map(r => (
              <div key={r.uid} className="recruit-card">
                <RecruitLine r={r} />
                <div className="buy-row">
                  <button className="small ghost" disabled={team.length <= 1} onClick={() => act({ type: 'setTeam', uids: R.team.filter(u => u !== r.uid) })}>Tirar do time</button>
                </div>
              </div>
            ))}
          </div>
          {eff && (
            <div className="kv">
              <div><small>Velocidade</small><b>{Math.round((eff.speed - 1) * 100) >= 0 ? '+' : ''}{Math.round((eff.speed - 1) * 100)}%</b></div>
              <div><small>Grana</small><b>{Math.round((eff.cash - 1) * 100) >= 0 ? '+' : ''}{Math.round((eff.cash - 1) * 100)}%</b></div>
              <div><small>Dano levado</small><b>{Math.round((eff.damage - 1) * 100) >= 0 ? '+' : ''}{Math.round((eff.damage - 1) * 100)}%</b></div>
            </div>
          )}
        </section>

        <Recruiting p={p} act={act} />

        <section className="section">
          <div className="section-head"><h3>Treino no esconderijo</h3><span className="meta">{isVip(p, Date.now()) ? '50%' : '25%'} do XP</span></div>
          <p className="section-note">Um capanga fora do time treina no esconderijo e ganha uma parte do XP dos assaltos (o dobro no Clube Rockeiro).</p>
          <select value={R.trainee ?? ''} onChange={e => act({ type: 'setTrainee', uid: e.target.value || null })} aria-label="Capanga em treino">
            <option value="">Ninguém treinando</option>
            {R.depot.filter(r => !R.team.includes(r.uid)).map(r => <option key={r.uid} value={r.uid}>{speciesById(r.speciesId)?.name} · nv {r.level}</option>)}
          </select>
        </section>

        {Object.values(R.discs).some(n => (n ?? 0) > 0) && (
          <section className="section">
            <div className="section-head"><h3>Discos de treino</h3><span className="meta">caem dos chefões</span></div>
            <p className="section-note">Cada disco ensina +10% num atributo, para sempre. Até {RECRUIT.maxDiscs} por capanga. Use no Depósito.</p>
            <div className="kv">
              {(['hp', 'atk', 'def', 'spd'] as const).map(k => <div key={k}><small>{{ hp: 'Vida', atk: 'Ataque', def: 'Defesa', spd: 'Velocidade' }[k]}</small><b>{R.discs[k] ?? 0}</b></div>)}
            </div>
          </section>
        )}
      </>}

      {view === 'deposito' && <Depot p={p} act={act} onState={onState} />}
      {view === 'album' && <Album p={p} />}
    </div>
  );
}

function Recruiting({ p, act }: { p: PlayerState; act: Act }) {
  const R = p.recruits;
  const off = isVip(p, Date.now()) ? 1 - VIP_SUPPLY.merchantDiscount : 1;
  const price = (id: InviteId) => Math.max(5, Math.round(incomePerHour(p.level) * INVITES.find(i => i.id === id)!.priceHours * off));
  return (
    <section className="section">
      <div className="section-head"><h3>Recrutamento</h3><span className="meta">{RECRUIT.windowSec} s para convidar</span></div>
      <p className="section-note">Depois de um assalto às vezes aparece alguém querendo entrar. Você tem {RECRUIT.windowSec} segundos para mandar um convite. Convite melhor = mais chance. Muito raramente aparece uma Lenda da Rua.</p>
      <div className="invite-grid">
        {INVITES.map(i => (
          <div key={i.id} className="invite-card">
            <div className="row"><strong>{i.name}</strong><span className="count">{R.invites[i.id] ?? 0}</span></div>
            <span className="small muted">Chance ×{i.mult} · {formatCash(price(i.id))} cada</span>
            <div className="buy-row">
              {[5, 25].map(n => <button key={n} className="small" disabled={p.cash < price(i.id) * n} onClick={() => act({ type: 'buyInvite', invite: i.id, qty: n })}>+{n}</button>)}
            </div>
          </div>
        ))}
      </div>
      <div className="auto-box">
        <label className="check"><input type="checkbox" checked={R.auto.on} onChange={e => act({ type: 'setAutoRecruit', ...R.auto, on: e.target.checked })} /> Recrutar sozinho (para quando estiver fora)</label>
        <div className="auto-opts">
          <label className="field">Convite
            <select value={R.auto.invite} onChange={e => act({ type: 'setAutoRecruit', ...R.auto, invite: e.target.value as InviteId })}>
              {INVITES.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </label>
          <label className="field">Raridade mínima
            <select value={R.auto.minRarity} onChange={e => act({ type: 'setAutoRecruit', ...R.auto, minRarity: e.target.value as Rarity })}>
              {(['comum', 'raro', 'epico', 'lendario'] as Rarity[]).map(r => <option key={r} value={r}>{RARITY_NAME[r]}</option>)}
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={R.auto.onlyNew} onChange={e => act({ type: 'setAutoRecruit', ...R.auto, onlyNew: e.target.checked })} /> Só quem falta no álbum</label>
        </div>
      </div>
    </section>
  );
}

function Depot({ p, act, onState }: { p: PlayerState; act: Act; onState: (r: StateResponse) => void }) {
  const R = p.recruits;
  const [spec, setSpec] = useState<string>('todos');
  const [sel, setSel] = useState<string | null>(null);
  const [price, setPrice] = useState(200);
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null);
  const list = useMemo(() => [...R.depot].filter(r => spec === 'todos' || speciesById(r.speciesId)?.spec === spec)
    .sort((a, b) => recruitScore(recruitStats(b)) - recruitScore(recruitStats(a))), [R.depot, spec]);
  const r = R.depot.find(x => x.uid === sel);
  const inTeam = r ? R.team.includes(r.uid) : false;
  const inPvp = r ? R.pvpTeam.includes(r.uid) : false;
  const pw = r ? powerClass(r.ivs) : 0;
  const canMarket = r && !r.bound && (r.lenda || pw >= 5 || (r.level >= RECRUIT.marketMinLevel && pw >= RECRUIT.marketMinPower));
  const discs = (['hp', 'atk', 'def', 'spd'] as const).filter(k => (R.discs[k] ?? 0) > 0);
  return (
    <section className="section">
      <div className="section-head"><h3>Depósito</h3><span className="meta">sem limite</span></div>
      <div className="chips">
        <button className={spec === 'todos' ? 'chip active' : 'chip'} onClick={() => setSpec('todos')}>Todos</button>
        {SPECS.map(s => <button key={s.id} className={spec === s.id ? 'chip active' : 'chip'} onClick={() => setSpec(s.id)}>{s.name}</button>)}
      </div>
      {msg && <p className={msg.bad ? 'msg bad' : 'msg'}>{msg.text}</p>}
      {r && (
        <div className="detail-sheet">
          <RecruitLine r={r} />
          <div className="buy-row">
            {inTeam
              ? <button className="small ghost" disabled={R.team.length <= 1} onClick={() => act({ type: 'setTeam', uids: R.team.filter(u => u !== r.uid) })}>Tirar do time</button>
              : <button className="small" disabled={R.team.length >= RECRUIT.teamSize} onClick={() => act({ type: 'setTeam', uids: [...R.team, r.uid] })}>{R.team.length >= RECRUIT.teamSize ? 'Time cheio' : 'Pôr no time'}</button>}
            <button className="small ghost" onClick={() => act({ type: 'setPvpTeam', uids: inPvp ? R.pvpTeam.filter(u => u !== r.uid) : [...R.pvpTeam, r.uid].slice(0, RECRUIT.teamSize) })}>{inPvp ? 'Tirar do time de PvP' : 'Pôr no time de PvP'}</button>
            {discs.map(k => <button key={k} className="small ghost" disabled={(r.discs ?? []).length >= RECRUIT.maxDiscs} onClick={() => act({ type: 'teachDisc', uid: r.uid, stat: k })}>Disco de {{ hp: 'vida', atk: 'ataque', def: 'defesa', spd: 'velocidade' }[k]}</button>)}
          </div>
          {!r.bound && (
            <div className="buy-row">
              <label className="field">Preço no Mercado (◆)<input type="number" min={MARKET.minPrice} value={price} onChange={e => setPrice(Number(e.target.value))} /></label>
              <button className="small" disabled={!canMarket} title={canMarket ? '' : `Nível ${RECRUIT.marketMinLevel} e P${RECRUIT.marketMinPower} (Lenda e P5 em qualquer nível)`}
                onClick={async () => { try { onState(await api.marketList({ kind: 'recruit', uid: r.uid, price })); setSel(null); setMsg({ text: 'Anunciado no Mercado.' }); } catch (e) { setMsg({ text: (e as Error).message, bad: true }); } }}>Anunciar</button>
              <button className="small danger" onClick={() => { act({ type: 'releaseRecruit', uid: r.uid }); setSel(null); }}>Dispensar (vende o contrato)</button>
            </div>
          )}
          {!canMarket && !r.bound && <p className="small muted">Mercado: nível {RECRUIT.marketMinLevel} e potência P{RECRUIT.marketMinPower}, ou Lenda/P5 em qualquer nível.</p>}
        </div>
      )}
      {list.length === 0 && <p className="empty">Ninguém aqui ainda.</p>}
      <div className="recruit-list">
        {list.map(x => (
          <button key={x.uid} className={`recruit-card pick ${sel === x.uid ? 'sel' : ''}`} onClick={() => setSel(x.uid === sel ? null : x.uid)} aria-pressed={sel === x.uid}>
            <RecruitLine r={x} />
            <span className="recruit-flags">{R.team.includes(x.uid) && <span className="badge boost">Time</span>}{R.pvpTeam.includes(x.uid) && <span className="badge">PvP</span>}{R.trainee === x.uid && <span className="badge">Treino</span>}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function Album({ p }: { p: PlayerState }) {
  const A = p.recruits.album;
  return (
    <section className="section">
      <div className="section-head"><h3>Álbum da gangue</h3><span className="meta">{Object.values(A).filter(a => a.caught).length} de {SPECIES.length} recrutados</span></div>
      <p className="section-note">Todo mundo que já cruzou seu caminho. Quem você só viu aparece em sombra; quem nunca viu, só com o nível onde costuma aparecer.</p>
      <div className="album-grid">
        {SPECIES.map(s => {
          const a = A[s.id];
          const seen = (a?.seen ?? 0) > 0, caught = (a?.caught ?? 0) > 0;
          return (
            <div key={s.id} className={`album-cell ${caught ? 'caught' : seen ? 'seen' : 'unknown'}`}>
              {seen ? <RecruitAvatar speciesId={s.id} size={48} silhouette={!caught} /> : <div className="album-q">?</div>}
              <strong>{seen ? s.name : '???'}</strong>
              {seen ? <SpecTag spec={s.spec} /> : <span className="small muted">nível {s.minLevel}+</span>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
