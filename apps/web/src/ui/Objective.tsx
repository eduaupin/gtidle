import { DISTRICTS, MISSIONS, currentMission, formatCash, nextDistrictGoal, type PlayerState } from '@gti/shared';

type Tab = 'assaltos' | 'lab' | 'imoveis' | 'loja' | 'visual';

const TAB_NAME: Record<Tab, string> = {
  assaltos: 'Assaltos', lab: 'Galpão', imoveis: 'Imóveis', loja: 'Loja', visual: 'Visual',
};

/** A placa âmbar: diz o que fazer agora, quanto falta e quanto paga. */
export default function Objective({ p, onClaim, onGo }: { p: PlayerState; onClaim: () => void; onGo: (t: Tab) => void }) {
  const m = currentMission(p);
  const reached = DISTRICTS.filter(d => p.level >= d.minLevel).length;
  const next = nextDistrictGoal(p);

  const journey = (
    <>
      <div className="journey" aria-hidden="true">
        {DISTRICTS.map(d => <span key={d.id} className={p.level >= d.minLevel ? 'on' : ''} />)}
      </div>
      <p className="journey-label">
        Jornada: {reached} de {DISTRICTS.length} distritos.{' '}
        {next ? `${next.name} abre no nível ${next.minLevel}.` : 'Você chegou às Mansões.'}
      </p>
    </>
  );

  if (!m) {
    return (
      <section className="objective" aria-label="Objetivo">
        <header><small>Objetivo</small></header>
        <h2>{next ? `Chegar ao ${next.name}` : 'Dono da cidade'}</h2>
        <p className="why">{next ? next.description : 'Todos os distritos abertos. Temporada 2 traz o Chefão.'}</p>
        {journey}
      </section>
    );
  }

  const [cur, goal] = m.progress(p);
  const done = cur >= goal;
  const reward = [
    m.reward.cash ? `+${formatCash(m.reward.cash)}` : '',
    m.reward.diamonds ? `+${m.reward.diamonds} diamantes` : '',
    m.reward.xp ? `+${m.reward.xp} XP` : '',
  ].filter(Boolean).join(', ');

  return (
    <section className={`objective ${done ? 'done' : ''}`} aria-label="Objetivo atual">
      <header>
        <small>Objetivo {p.missionIndex + 1} de {MISSIONS.length}</small>
        <small>{cur}/{goal}</small>
      </header>
      <h2>{m.title}</h2>
      <p className="task">{m.task}</p>
      <div className="bar"><div style={{ width: `${(cur / goal) * 100}%` }} /></div>
      <p className="why">{m.why}</p>
      <div className="row">
        <span className="reward">Recompensa: {reward}</span>
        {done
          ? <button onClick={onClaim}>Receber</button>
          : <button onClick={() => onGo(m.tab)}>Abrir {TAB_NAME[m.tab]}</button>}
      </div>
      {journey}
    </section>
  );
}
