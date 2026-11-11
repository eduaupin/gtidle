// "Próximo passo": no topo da coluna, diz a coisa mais importante a fazer agora, com o botão que resolve.
// Problema que trava o farm (preso, gangue no esconderijo, sem bala, sem kit, parada) vem antes do objetivo.
import { useState } from 'react';
import {
  DIAMOND_ITEMS, DISTRICTS, HEIST_PLANS, MELEE, MISSIONS, ROBBERIES, SUPPLY, VIP_SUPPLY, bulletPrice, currentMission, formatCash, isJailed, isLookBurned,
  isMelee, isVip, jobNeeds, kitPrice, lawyerCost, nextDistrictGoal, type Action, type PlayerState,
} from '@gti/shared';
import { useNow } from './Hud';
import type { Tab } from './Nav';

const TAB_NAME: Partial<Record<Tab, string>> = { assaltos: 'Assaltos', lab: 'Galpão', imoveis: 'Imóveis', loja: 'Loja', visual: 'Visual', inventario: 'Inventário' };

interface Issue { tone: 'danger' | 'warn' | 'info'; title: string; text: string; cta: string; run: () => void }

function findIssue(p: PlayerState, now: number, act: (a: Action) => void, go: (t: Tab) => void, onLawyer: () => void, onAccount: () => void): Issue | null {
  const v = p.vitals;
  const unit = (item: 'ammo' | 'kit') => Math.max(1, Math.round((item === 'ammo' ? bulletPrice(p.level) : kitPrice(p.level)) * (isVip(p, now) ? 1 - VIP_SUPPLY.merchantDiscount : 1)));
  const buy = (item: 'ammo' | 'kit', want: number) => {
    const n = Math.min(want, Math.floor(p.cash / unit(item)));
    return { n, cost: n * unit(item) };
  };

  if (isJailed(p, now)) {
    return { tone: 'danger', title: 'Você está preso', text: 'Os assaltos param até você sair. O advogado solta na hora.', cta: `Pagar advogado ${formatCash(lawyerCost(p))}`, run: onLawyer };
  }
  if (v?.down) {
    if (v.hp < SUPPLY.returnHp) {
      if (v.kits > 0) return { tone: 'danger', title: 'Gangue no esconderijo', text: `Ela parou de farmar. Precisa de ${SUPPLY.returnHp} de vida para voltar: use um kit médico.`, cta: 'Usar kit médico', run: () => act({ type: 'useKit' }) };
      const k = buy('kit', 3);
      return k.n > 0
        ? { tone: 'danger', title: 'Gangue no esconderijo', text: 'Ela parou de farmar e não tem kit médico. Compre kits e use um para voltar.', cta: `Comprar ${k.n} kit${k.n > 1 ? 's' : ''} (${formatCash(k.cost)})`, run: () => act({ type: 'buyConsumable', item: 'kit', qty: k.n }) }
        : { tone: 'danger', title: 'Gangue no esconderijo', text: 'Sem kit e sem grana para comprar. A vida volta devagar sozinha; venda um item no Inventário para agilizar.', cta: 'Abrir Inventário', run: () => go('inventario') };
    }
    return { tone: 'danger', title: 'Gangue no esconderijo', text: 'A vida já dá para voltar. Enquanto ela estiver lá, nada é farmado.', cta: 'Voltar ao corre', run: () => act({ type: 'backToStreet' }) };
  }

  const jobs = p.robberies.map(s => [...ROBBERIES, ...HEIST_PLANS].find(j => j.id === s.jobId)).filter(Boolean) as typeof ROBBERIES;
  // a placa do objetivo já manda para Assaltos no começo: aí o aviso seria repetido
  const m = currentMission(p);
  const missionToRobberies = !!m && m.tab === 'assaltos' && m.progress(p)[0] < m.progress(p)[1];
  if (!jobs.length && !p.hideout && !isLookBurned(p, now) && !missionToRobberies) {
    return { tone: 'info', title: 'Gangue parada', text: 'Escolha um alvo: ela repete o assalto sozinha, até com o jogo fechado.', cta: 'Escolher alvo', run: () => go('assaltos') };
  }

  const weapon = p.equipped.weapon ? DIAMOND_ITEMS.find(i => i.id === p.equipped.weapon) : undefined;
  const melee = isMelee(weapon?.weapon?.kind);
  const gunJobs = jobs.filter(j => jobNeeds(j).needsGun);
  if (gunJobs.length && !weapon) {
    return { tone: 'warn', title: 'Golpe sem arma', text: 'Esse alvo pede arma. Sem ela, só 1% dá certo. Equipe uma no Inventário.', cta: 'Abrir Inventário', run: () => go('inventario') };
  }
  if (melee && gunJobs.some(j => j.maxStars > MELEE.maxStars)) {
    return { tone: 'warn', title: 'Arma branca não dá conta', text: `Taco e faca só servem até ${MELEE.maxStars} estrelas. Equipe uma arma de fogo ou escolha um alvo menor.`, cta: 'Abrir Inventário', run: () => go('inventario') };
  }
  if (gunJobs.length && !melee) {
    const need = Math.max(...gunJobs.map(j => jobNeeds(j).ammo));
    const auto = v.autoBuy && p.cash >= Math.ceil(need) * unit('ammo');
    if (v.ammo < need && !auto) {
      const b = buy('ammo', Math.max(100, Math.ceil(need * 10)));
      return b.n > 0
        ? { tone: 'warn', title: 'Acabou a bala', text: 'Sem munição, só 1% dos golpes dá certo.', cta: `Comprar ${b.n} balas (${formatCash(b.cost)})`, run: () => act({ type: 'buyConsumable', item: 'ammo', qty: b.n }) }
        : { tone: 'warn', title: 'Acabou a bala', text: 'Sem munição e sem grana: troque para um alvo de 1 estrela até juntar.', cta: 'Abrir Assaltos', run: () => go('assaltos') };
    }
  }
  if (jobs.some(j => jobNeeds(j).damage > 0) && v.kits === 0 && !(v.autoBuy && p.cash >= unit('kit'))) {
    const k = buy('kit', 3);
    if (k.n > 0) return { tone: 'warn', title: 'Sem kit médico', text: 'Quando a vida baixar, a gangue recua e para de farmar.', cta: `Comprar ${k.n} kit${k.n > 1 ? 's' : ''} (${formatCash(k.cost)})`, run: () => act({ type: 'buyConsumable', item: 'kit', qty: k.n }) };
  }

  const owned = Object.values(p.properties).reduce((s, n) => s + n, 0);
  if (p.dirtyCash >= 500 && owned === 0) {
    return { tone: 'info', title: 'Grana suja parada', text: `${formatCash(p.dirtyCash)} sujos não compram nada. Imóveis lavam aos poucos.`, cta: 'Abrir Imóveis', run: () => go('imoveis') };
  }
  if (!(p.accounts ?? []).length && p.level >= 5) {
    return { tone: 'info', title: 'Salve seu progresso', text: 'Como convidado, limpar o navegador apaga tudo. Ligue Google ou Discord.', cta: 'Ligar conta', run: onAccount };
  }
  return null;
}

export default function NextStep({ p, act, onGo, onLawyer, onAccount }: {
  p: PlayerState; act: (a: Action) => void; onGo: (t: Tab) => void; onLawyer: () => void; onAccount: () => void;
}) {
  const now = useNow(1000);
  const [open, setOpen] = useState(false);
  const issue = findIssue(p, now, act, onGo, onLawyer, onAccount);
  const m = currentMission(p);
  const next = nextDistrictGoal(p);
  const reached = DISTRICTS.filter(d => p.level >= d.minLevel).length;

  const journey = (
    <div className="journey-wrap">
      <div className="journey" aria-hidden="true">{DISTRICTS.map(d => <span key={d.id} className={p.level >= d.minLevel ? 'on' : ''} />)}</div>
      <p className="journey-label">{reached} de {DISTRICTS.length} distritos abertos. {next ? `${next.name} abre no nível ${next.minLevel}.` : 'Você chegou às Mansões.'}</p>
    </div>
  );

  let mission: React.ReactNode;
  if (!m) {
    mission = (
      <div className="mission">
        <div className="mission-head"><small>Meta</small></div>
        <div className="mission-main"><div><h2>{next ? `Chegar ao ${next.name}` : 'Dono da cidade'}</h2><p>{next ? next.description : 'Todos os distritos abertos.'}</p></div></div>
        {journey}
      </div>
    );
  } else {
    const [cur, goal] = m.progress(p);
    const done = cur >= goal;
    const reward = [m.reward.cash ? formatCash(m.reward.cash) : '', m.reward.diamonds ? `${m.reward.diamonds} diamantes` : '', m.reward.xp ? `${m.reward.xp} XP` : ''].filter(Boolean).join(' + ');
    mission = (
      <div className={`mission ${done ? 'done' : ''}`}>
        <div className="mission-head">
          <small>Objetivo {p.missionIndex + 1} de {MISSIONS.length}</small>
          <small className="mission-count">{Math.min(cur, goal)}/{goal}</small>
        </div>
        <div className="mission-main">
          <div>
            <h2>{m.title}</h2>
            <p>{m.task}</p>
          </div>
          {done
            ? <button onClick={() => act({ type: 'claimMission' })}>Receber {reward}</button>
            : <button onClick={() => onGo(m.tab as Tab)}>Ir para {TAB_NAME[m.tab as Tab] ?? m.tab}</button>}
        </div>
        <div className="bar"><div style={{ width: `${Math.min(100, (cur / goal) * 100)}%` }} /></div>
        <button className="mission-more" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {done ? 'Pronto para receber' : `Paga ${reward}`}<span>{open ? 'menos' : 'por que fazer'}</span>
        </button>
        {open && <><p className="mission-why">{m.why}</p>{journey}</>}
      </div>
    );
  }

  return (
    <section className="next-step" data-tour="objective" aria-label="Próximo passo">
      {issue && (
        <div className={`issue ${issue.tone}`} role={issue.tone === 'danger' ? 'alert' : undefined}>
          <div>
            <strong>{issue.title}</strong>
            <p>{issue.text}</p>
          </div>
          <button onClick={issue.run}>{issue.cta}</button>
        </div>
      )}
      {mission}
    </section>
  );
}
