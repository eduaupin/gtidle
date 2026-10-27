import {
  DIAMOND_ITEMS, DISTRICTS, DRUGS, PROPERTIES, ROBBERIES, RULES,
  costAt, dealingPointCost, formatCash, formatDuration, isJailed, isTurbo, isVip, labUpgradeCost, totalDiamonds,
  formatPrice, priceIn, INSURANCE, LAUNDER, insuranceCost, chaserFor, HEIST_PLANS, isLookBurned,
  type Action, type Currency, type DrugId, type PlayerState, type RealMoneyProduct,
} from '@gti/shared';
import { useNow } from './Hud';

type Act = (a: Action) => void;

/** Progresso exibido entre uma consulta e outra ao servidor (o valor real vem sempre do servidor). */
const liveProgress = (base: number, fetchedAt: number, speed: number, total: number, loop: boolean) => {
  const v = base + ((Date.now() - fetchedAt) / 1000) * speed;
  return loop ? v % total : Math.min(v, total);
};


// ---------------- Assaltos ----------------
export function RobberiesPanel({ p, act, fetchedAt, selected, onMap }: { p: PlayerState; act: Act; fetchedAt: number; selected: string | null; onMap: () => void }) {
  const now = useNow(250);
  const speed = isTurbo(p, now) ? RULES.turboSpeedMult : 1;
  const jailed = isJailed(p, now);
  const jobs = ROBBERIES.filter(r => r.district === p.district);
  const freeSlot = p.robberies.findIndex(s => !s.jobId);

  return (
    <div className="panel">
      <p className="lead">Escolha um alvo e a gangue repete o assalto sozinha. Alvos maiores pagam mais e demoram mais. Golpe pequeno só chama policial a pé; golpe grande chama SWAT e helicóptero (até 6 estrelas).</p>

      <h3>Na rua agora</h3>
      {p.hideout && (
        <div className="card">
          <strong>Gangue escondida</strong>
          <p className="small muted">
            {p.hideout.until > now
              ? `Pode voltar ao corre em ${formatDuration((p.hideout.until - now) / 1000)}. Os assaltos voltam de onde pararam.`
              : 'A barra esfriou. Use "Voltar ao corre" no mapa.'}
          </p>
        </div>
      )}
      {!p.hideout && p.robberies.map((s, i) => {
        const job = ROBBERIES.find(r => r.id === s.jobId) ?? HEIST_PLANS.find(h => h.id === s.jobId);
        const prog = job && !jailed ? liveProgress(s.progressSec, fetchedAt, speed, job.durationSec, true) : 0;
        return (
          <div key={i} className="card">
            <div className="row">
              <strong>
                {job ? job.name : 'Gangue parada'}
                {s.once && <span className="badge boost">Plano · uma vez</span>}
                {s.mode === 'weak' && <span className="badge weak">Golpe fraco {Math.round(RULES.weakMult * 100)}%</span>}
                {s.mode === 'boosted' && (s.boostUntil ?? 0) > now && <span className="badge boost">+{Math.round((RULES.boostMult - 1) * 100)}% até {new Date(s.boostUntil!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>}
              </strong>
              {job && <button className="ghost small" onClick={() => act({ type: 'stopRobbery', slot: i })}>Parar</button>}
            </div>
            {job ? <>
              <div className="bar"><div style={{ width: `${(prog / job.durationSec) * 100}%` }} /></div>
              <p className="small muted">{jailed ? 'Pausado enquanto você está preso.' : `Próximo loot em ${formatDuration((job.durationSec - prog) / speed)}. Repete sozinho.`}</p>
            </> : <p className="small muted">Escolha um alvo na lista abaixo.</p>}
          </div>
        );
      })}
      {!isVip(p, now) && <p className="hint">O Clube Rockeiro libera um segundo assalto ao mesmo tempo.</p>}

      {HEIST_PLANS.some(h => (p.inventory.plans[h.id] ?? 0) > 0) && <>
        <h3>Planos de golpe</h3>
        <p className="lead">Caem em golpes de 3 estrelas para cima. Rodam uma vez, pagam muito e podem render item raro. Também dá para vender no Mercado.</p>
        {HEIST_PLANS.filter(h => (p.inventory.plans[h.id] ?? 0) > 0).map(h => (
          <div key={h.id} className="card">
            <div className="row"><strong>{h.planName} <span className="badge">{p.inventory.plans[h.id]}×</span></strong><span className="muted small">{formatDuration(h.durationSec)}</span></div>
            <p className="small muted">{h.description}</p>
            <div className="tags">
              <span className="cash">{formatCash(h.cash[0])} a {formatCash(h.cash[1])}</span>
              <span>+{h.xp} XP</span>
              <span className="heat">até {h.maxStars} estrelas</span>
              <span>{Math.round(h.rareChance * 100)}% de chance de raro</span>
            </div>
            <button disabled={p.level < h.minLevel || jailed || !!p.hideout || freeSlot < 0 || isLookBurned(p, now)}
              onClick={() => act({ type: 'startPlan', planId: h.id })}>
              {p.level < h.minLevel ? `Abre no nível ${h.minLevel}` : freeSlot < 0 ? 'Pare um assalto para executar' : 'Executar o plano'}
            </button>
          </div>
        ))}
      </>}

      <h3>Alvos em {DISTRICTS.find(d => d.id === p.district)!.name}</h3>
      {jobs.map(j => {
        const locked = p.level < j.minLevel;
        const running = p.robberies.some(s => s.jobId === j.id);
        return (
          <div key={j.id} className={`card ${selected === j.id ? 'selected' : ''} ${locked ? 'locked' : ''}`}>
            <div className="row"><strong>{j.name}</strong><span className="muted small">a cada {formatDuration(j.durationSec)}</span></div>
            <div className="tags">
              <span className="cash">{formatCash(j.cash[0])} a {formatCash(j.cash[1])}</span>
              <span>+{j.xp} XP</span>
              <span className="heat">+{j.heat} procurado</span>
            </div>
            <div className="chase">
              <span className="chase-stars" aria-label={`Até ${j.maxStars} estrelas`}>
                {Array.from({ length: 6 }, (_, i) => <i key={i} className={i < j.maxStars ? 'on' : ''}>★</i>)}
              </span>
              <span className="small muted">Quem vem atrás: <b>{chaserFor(j.maxStars)}</b></span>
            </div>
            <button disabled={locked || running || jailed || !!p.hideout}
              onClick={() => act({ type: 'startRobbery', slot: freeSlot >= 0 ? freeSlot : 0, jobId: j.id })}>
              {locked ? `Abre no nível ${j.minLevel}` : p.hideout ? 'Gangue escondida' : running ? 'Em andamento' : freeSlot >= 0 ? 'Mandar a gangue' : 'Trocar para este alvo'}
            </button>
          </div>
        );
      })}

      <h3>Regiões de Costa Dourada</h3>
      <p className="lead">São {DISTRICTS.length} regiões, da Periferia à Ilha do Farol. Cada uma tem alvos próprios e paga mais pelo produto do galpão.</p>
      <div className="row">
        <span className="small">Você está em <b>{DISTRICTS.find(d => d.id === p.district)!.name}</b>. {(() => {
          const next = DISTRICTS.filter(d => d.minLevel > p.level).sort((a, b) => a.minLevel - b.minLevel)[0];
          return next ? `Próxima: ${next.name} no nível ${next.minLevel}.` : 'Todas abertas.';
        })()}</span>
        <button onClick={onMap}>Abrir o mapa</button>
      </div>
    </div>
  );
}

// ---------------- Galpão ----------------
export function LabPanel({ p, act, fetchedAt }: { p: PlayerState; act: Act; fetchedAt: number }) {
  const now = useNow(250);
  const jailed = isJailed(p, now);
  const labSpeed = (isTurbo(p, now) ? RULES.turboSpeedMult : 1) * (1 + RULES.labSpeedPerLevel * p.lab.level);
  const district = DISTRICTS.find(d => d.id === p.district)!;
  const unlocked = DRUGS.filter(d => p.level >= d.minLevel);

  if (!unlocked.length) {
    return (
      <div className="panel">
        <p className="lead">O galpão abre no nível {DRUGS[0].minLevel}. Ali você compra insumo, refina por tempo e vende nos pontos: uma segunda renda que roda junto com os assaltos.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <p className="lead">Três passos que rodam sozinhos: compre lotes de insumo, deixe uma linha refinando e escolha o que os pontos vendem.</p>

      <h3>1. Insumo e estoque</h3>
      {DRUGS.map(d => {
        const locked = p.level < d.minLevel;
        return (
          <div key={d.id} className={`card ${locked ? 'locked' : ''}`}>
            <div className="row">
              <strong><span className="swatch" style={{ background: d.color }} />{d.name}</strong>
              <span className="muted small">{locked ? `nível ${d.minLevel}` : `vende a ${formatCash(d.basePrice * district.streetPriceMult)} a unidade aqui`}</span>
            </div>
            {!locked && <>
              <div className="tags"><span>{p.supplies[d.id]} lote(s) de insumo</span><span>{p.product[d.id]} unidades prontas</span></div>
              <div className="row">
                <button onClick={() => act({ type: 'buySupply', drugId: d.id, qty: 1 })}>Comprar 1 lote ({formatCash(d.supplyCost)})</button>
                <button className="ghost" onClick={() => act({ type: 'buySupply', drugId: d.id, qty: 10 })}>10 lotes</button>
              </div>
            </>}
          </div>
        );
      })}

      <h3>2. Refino</h3>
      {p.lab.lines.map((l, i) => {
        const drug = DRUGS.find(d => d.id === l.drugId);
        const prog = drug && l.loaded && !jailed ? liveProgress(l.progressSec, fetchedAt, labSpeed, drug.refineSec, false) : 0;
        return (
          <div key={i} className="card">
            <label className="row">
              <span>Linha {i + 1}</span>
              <select value={l.drugId ?? ''} onChange={e => act({ type: 'setLabLine', line: i, drugId: (e.target.value || null) as DrugId | null })}>
                <option value="">Parada</option>
                {unlocked.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
            {drug && <>
              <div className="bar"><div style={{ width: `${(prog / drug.refineSec) * 100}%`, background: drug.color }} /></div>
              <p className="small muted">{!l.loaded && p.supplies[drug.id] === 0 ? 'Sem insumo. Compre lotes acima.'
                : `${drug.batchYield} unidades prontas em ${formatDuration((drug.refineSec - prog) / labSpeed)}.`}</p>
            </>}
          </div>
        );
      })}
      <button className="ghost" disabled={p.lab.level >= RULES.labMaxLevel} onClick={() => act({ type: 'upgradeLab' })}>
        Melhorar o galpão para o nível {p.lab.level + 1} ({formatCash(labUpgradeCost(p))})
      </button>
      <p className="hint">Cada nível refina 8% mais rápido. A cada 4 níveis abre uma linha nova.</p>

      <h3>3. Pontos de venda</h3>
      <div className="card">
        <label className="row">
          <span>Vender</span>
          <select value={p.dealing.drugId ?? ''} onChange={e => act({ type: 'setDealingDrug', drugId: (e.target.value || null) as DrugId | null })}>
            <option value="">Nada</option>
            {unlocked.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </label>
        <p className="small muted">{p.dealing.points} ponto(s). Cada ponto vende 1 unidade a cada {RULES.sellSecPerUnit} segundos e sobe o procurado.</p>
        <button disabled={p.dealing.points >= RULES.dealingMaxPoints} onClick={() => act({ type: 'buyDealingPoint' })}>
          Abrir mais um ponto ({formatCash(dealingPointCost(p))})
        </button>
      </div>
    </div>
  );
}

// ---------------- Imóveis ----------------
export function PropertiesPanel({ p, act }: { p: PlayerState; act: Act }) {
  const vipMult = isVip(p, Date.now()) ? RULES.vipCashMult : 1;
  const perHour = PROPERTIES.reduce((s, x) => s + x.incomePerSec * (p.properties[x.id] ?? 0), 0) * 3600 * vipMult;
  return (
    <div className="panel">
      <p className="lead">Negócios de fachada pingam grana sem parar, mesmo com você offline ou preso. Cada nível soma a mesma renda de novo.</p>
      <p>Renda dos imóveis: <span className="cash">{formatCash(perHour)} por hora</span></p>
      <LaunderCard p={p} act={act} perSec={perHour / 3600 / vipMult} />
      {PROPERTIES.map(x => {
        const lvl = p.properties[x.id] ?? 0;
        const locked = p.level < x.minLevel;
        return (
          <div key={x.id} className={`card ${locked ? 'locked' : ''}`}>
            <div className="row"><strong>{x.name}</strong><span className="muted small">nível {lvl} de {x.maxLevel}</span></div>
            <p className="small"><span className="cash">+{formatCash(x.incomePerSec * 3600)} por hora</span> a cada nível</p>
            <button disabled={locked || lvl >= x.maxLevel} onClick={() => act({ type: 'buyProperty', propertyId: x.id })}>
              {locked ? `Abre no nível ${x.minLevel}` : `${lvl ? 'Melhorar' : 'Comprar'} por ${formatCash(costAt(x.baseCost, lvl))}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Lavagem de dinheiro e seguro contra prisão. */
function LaunderCard({ p, act, perSec }: { p: PlayerState; act: Act; perSec: number }) {
  const now = Date.now();
  const vip = isVip(p, now);
  const rate = perSec * LAUNDER.perIncome;
  const fee = vip ? LAUNDER.feeVip : LAUNDER.fee;
  const insured = !!p.insurance && p.insurance.until > now;
  return (
    <div className="card launder">
      <div className="row">
        <strong>Lavanderia</strong>
        <span className="dirty">{formatCash(p.dirtyCash)} sujo</span>
      </div>
      <p className="small">
        Golpes de {LAUNDER.dirtyFromStars}+ estrelas, planos e golpes em equipe pagam em grana suja. Os negócios lavam sozinhos{' '}
        <b>{rate > 0 ? `${formatCash(rate * 3600)} por hora` : '(compre um imóvel primeiro)'}</b> com taxa de {Math.round(fee * 100)}%{vip ? ' (Clube Rockeiro)' : ''}.
        Se for preso, a polícia leva {Math.round(LAUNDER.confiscate * 100)}% do que estiver sujo.
      </p>
      <div className="row">
        <button className="small" disabled={p.dirtyCash < 1} onClick={() => act({ type: 'launderNow', amount: p.dirtyCash })}>
          Lavar tudo agora ({Math.round(LAUNDER.instantFee * 100)}% de taxa)
        </button>
        {insured
          ? <span className="badge boost">Seguro ativo por {formatDuration((p.insurance!.until - now) / 1000)}</span>
          : <button className="small ghost" disabled={p.cash < insuranceCost(p)} onClick={() => act({ type: 'buyInsurance' })}
              title={`Por ${INSURANCE.hours} h: se for preso, a polícia leva só ${Math.round(INSURANCE.confiscate * 100)}% da grana suja e você fica metade do tempo. Vale para uma prisão.`}>
              Seguro {INSURANCE.hours} h por {formatCash(insuranceCost(p))}
            </button>}
      </div>
      {!insured && <p className="small muted">Seguro: se for preso, perde só {Math.round(INSURANCE.confiscate * 100)}% da grana suja e cumpre metade do tempo. Vale para uma prisão.</p>}
    </div>
  );
}

// ---------------- Loja ----------------
export function ShopPanel({ p, act, onBuy, products, currency, onCurrency, anyLive }: {
  p: PlayerState; act: Act; onBuy: (prod: RealMoneyProduct) => void; products: RealMoneyProduct[];
  currency: Currency; onCurrency: (c: Currency) => void; anyLive: boolean;
}) {
  const hidden = (prod: RealMoneyProduct) =>
    (prod.id === 'founder_pack' && p.flags.founder) || (prod.id === 'starter_pack' && p.flags.starterPack);
  const price = (prod: RealMoneyProduct) => formatPrice(priceIn(prod, currency), currency);

  return (
    <div className="panel">
      <div className="row">
        <p className="lead">{currency === 'BRL' ? 'Pix ou cartão. O item entra na hora em que o pagamento é confirmado.' : 'Cartão internacional, Apple Pay ou Google Pay.'}</p>
        <div className="seg" role="group" aria-label="Moeda dos preços">
          <button className={currency === 'BRL' ? 'on' : ''} aria-pressed={currency === 'BRL'} onClick={() => onCurrency('BRL')}>R$</button>
          <button className={currency === 'USD' ? 'on' : ''} aria-pressed={currency === 'USD'} onClick={() => onCurrency('USD')}>US$</button>
        </div>
      </div>
      {!anyLive && <p className="hint warn">Modo de teste: nenhuma compra aqui cobra de verdade.</p>}

      <h3>Ofertas</h3>
      {products.filter(x => x.kind !== 'diamonds' && !hidden(x)).map(x => (
        <div key={x.id} className={`card ${x.highlight ? 'hot' : ''}`}>
          <div className="row"><strong>{x.name}</strong><span className="price">{price(x)}</span></div>
          <p className="small muted">{x.description}</p>
          <button onClick={() => onBuy(x)}>Comprar</button>
        </div>
      ))}

      <h3>Diamantes</h3>
      <p className="lead">Você tem {totalDiamonds(p)}. Também dá para ganhar jogando, nas missões.</p>
      <div className="grid">
        {products.filter(x => x.kind === 'diamonds').map(x => (
          <button key={x.id} className="tile" onClick={() => onBuy(x)}>
            <b>{x.grants.diamonds}</b>
            <span>{price(x)}</span>
            {x.description && <em>{x.description}</em>}
          </button>
        ))}
      </div>

      <h3>Trocar diamantes</h3>
      {DIAMOND_ITEMS.filter(i => !i.exclusive && i.priceDiamonds > 0 && i.id !== 'troca_nick').map(i => {
        const owned = i.kind === 'cosmetic' && p.cosmetics.includes(i.id);
        return (
          <div key={i.id} className="card">
            <div className="row">
              <strong>{i.color && <span className="swatch" style={{ background: i.color }} />}{i.name}</strong>
              <span className="muted">{i.priceDiamonds} diamantes</span>
            </div>
            <p className="small muted">{i.description}</p>
            <button disabled={owned} onClick={() => act({ type: 'buyDiamondItem', itemId: i.id })}>
              {owned ? 'Já é seu' : 'Trocar'}
            </button>
          </div>
        );
      })}
      <p className="hint">Sem caixa surpresa: você sempre vê exatamente o que está comprando.</p>
    </div>
  );
}
