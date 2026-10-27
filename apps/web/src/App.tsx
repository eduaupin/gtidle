import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BRAND, DRUGS, HEIST_PLANS, PARTS, RARE_ITEMS, ROBBERIES, RULES, currentMission, formatCash, isLookBurned, missionDone,
  type Action, type Currency, type GameEvent, type PlayerState, type RealMoneyProduct,
} from '@gti/shared';
import { api, ApiError, clearToken, getToken, initialCurrency, saveCurrency } from './api';
import CityCanvas from './game/CityCanvas';
import Hud, { useNow } from './ui/Hud';
import Chat from './ui/Chat';
import Objective from './ui/Objective';
import Intro from './ui/Intro';
import AlertCard from './ui/AlertCard';
import HideoutCard from './ui/HideoutCard';
import { initAds } from './ads';
import { dismissPushPrompt, enablePush, pushPermission, pushPromptDismissed, refreshPushIfGranted } from './notifications';
import CheckoutModal, { OrderReturnModal } from './ui/CheckoutModal';
import { LabPanel, PropertiesPanel, RobberiesPanel, ShopPanel } from './ui/Panels';
import { BasePanel, GangPanel, LookPanel } from './ui/GameTabs';
import LookBurnCard from './ui/LookBurnCard';
import ShareModal from './ui/ShareModal';
import WorldMap from './ui/WorldMap';
import MarketPanel from './ui/Market';
import Icon from './ui/Icon';
import CrewPanel from './ui/Crew';
import CityPanel from './ui/CityTab';
import { PhotoModal, ProfileModal } from './ui/Social';

type Tab = 'assaltos' | 'lab' | 'imoveis' | 'gangue' | 'visual' | 'base' | 'bonde' | 'cidade' | 'mercado' | 'loja' | 'chat';
const TABS: [Tab, string, string?][] = [
  ['assaltos', 'Assaltos', 'i_car'], ['lab', 'Galpão', 'i_lab'], ['imoveis', 'Imóveis', 'i_trophy'], ['gangue', 'Gangue', 'i_badge'],
  ['visual', 'Visual', 'i_crown'], ['base', 'Base', 'i_house'], ['bonde', 'Bonde'], ['cidade', 'Cidade'],
  ['mercado', 'Mercado', 'i_gem_badge'], ['loja', 'Loja', 'i_diamond'], ['chat', 'Chat'],
];

interface LogLine { id: number; at: number; text: string; kind: 'good' | 'bad' | 'info' }

/** Traduz os eventos do servidor em frases do diário da gangue. */
function describe(events: GameEvent[]): Omit<LogLine, 'id' | 'at'>[] {
  const out: Omit<LogLine, 'id' | 'at'>[] = [];
  const robbed = events.filter((e): e is Extract<GameEvent, { type: 'robbery_done' }> => e.type === 'robbery_done');
  if (robbed.length) {
    const cash = robbed.reduce((s, e) => s + e.cash, 0);
    const name = [...ROBBERIES, ...HEIST_PLANS].find(r => r.id === robbed[0].jobId)?.name ?? 'Assalto';
    const dirty = robbed.some(e => e.dirty);
    out.push({ kind: 'good', text: (robbed.length > 1 ? `${robbed.length} assaltos renderam ${formatCash(cash)}` : `${name}: ${formatCash(cash)}`) + (dirty ? ' (grana suja)' : '') });
  }
  const sold = events.filter((e): e is Extract<GameEvent, { type: 'sold' }> => e.type === 'sold');
  if (sold.length) {
    const units = sold.reduce((s, e) => s + e.units, 0), cash = sold.reduce((s, e) => s + e.cash, 0);
    out.push({ kind: 'good', text: `Pontos venderam ${units} unidades por ${formatCash(cash)}` });
  }
  for (const e of events) {
    if (e.type === 'level_up') out.push({ kind: 'info', text: `Você subiu para o nível ${e.level}` });
    if (e.type === 'laundered') out.push({ kind: 'good', text: `Lavou ${formatCash(e.amount)} na hora` });
    if (e.type === 'confiscated') out.push({ kind: 'bad', text: `A polícia apreendeu ${formatCash(e.amount)} de grana suja${e.insured ? ' (o seguro segurou o resto)' : ''}` });
    if (e.type === 'jailed') out.push({ kind: 'bad', text: 'A polícia te pegou. 10 minutos preso.' });
    if (e.type === 'released') out.push({ kind: 'info', text: 'Você saiu da cadeia' });
    if (e.type === 'batch_done') out.push({ kind: 'good', text: `Lote de ${DRUGS.find(d => d.id === e.drugId)?.name} pronto` });
    if (e.type === 'look_burned') out.push({ kind: 'bad', text: 'Quatro estrelas: a polícia queimou seu visual' });
    if (e.type === 'heat_warning') out.push({ kind: 'bad', text: 'Três estrelas: hora de se esconder' });
    if (e.type === 'hideout_start') out.push({ kind: 'info', text: 'Gangue escondida no esconderijo' });
    if (e.type === 'hideout_ready') out.push({ kind: 'good', text: 'A barra esfriou: pode voltar ao corre' });
    if (e.type === 'hideout_done') out.push({ kind: 'good', text: e.auto ? 'A gangue voltou ao corre sozinha' : 'De volta ao corre' });
    if (e.type === 'alert') out.push({ kind: 'bad', text: 'A polícia começou a monitorar seu roubo' });
    if (e.type === 'alert_missed') out.push({ kind: 'bad', text: 'Você não despistou: golpe fraco' });
    if (e.type === 'drop') {
      if (e.kind === 'rare') {
        const item = RARE_ITEMS.find(i => i.id === e.id);
        out.push({ kind: 'good', text: `ITEM RARO! ${item?.name ?? e.id} #${String(e.serial ?? 0).padStart(4, '0')} de ${item?.rare?.supply ?? '?'}` });
      } else if (e.kind === 'plan') out.push({ kind: 'good', text: `Caiu: ${HEIST_PLANS.find(h => h.id === e.id)?.planName ?? e.id}` });
      else out.push({ kind: 'info', text: `Caiu: ${e.qty}× ${PARTS.find(x => x.id === e.id)?.name ?? e.id}` });
    }
    if ((e as { type: string }).type === 'market_bought') out.push({ kind: 'good', text: 'Compra no mercado concluída' });
    if (e.type === 'alert_resolved') out.push({ kind: 'good', text: e.mode === 'boosted' ? 'Despistou com bônus do Clube Rockeiro' : 'Polícia despistada, golpe normal de volta' });
  }
  return out;
}

const ago = (at: number, now: number) => {
  const s = Math.max(0, Math.floor((now - at) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}min`;
};

/** Convite para ativar as notificações: aparece quando o alerta de polícia já pode acontecer. */
function NotifyPrompt({ show }: { show: boolean }) {
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'denied' | 'hidden'>(
    () => pushPermission() === 'default' && !pushPromptDismissed() ? 'idle' : 'hidden');
  if (!show || state === 'hidden' || state === 'done') return null;
  return (
    <div className="notify-prompt">
      {state === 'denied'
        ? <p>As notificações estão bloqueadas. Libere nas configurações do site no navegador para ser avisado.</p>
        : <p>Ative os avisos: quando a polícia monitorar seu roubo, você tem {Math.round(RULES.alertWindowSec / 60)} minutos para voltar e despistar.</p>}
      <div className="row">
        {state !== 'denied' && (
          <button className="small" disabled={state === 'busy'} onClick={async () => {
            setState('busy');
            const r = await enablePush(getToken());
            setState(r === 'granted' ? 'done' : r === 'denied' ? 'denied' : 'hidden');
          }}>Ativar avisos</button>
        )}
        <button className="ghost small" onClick={() => { dismissPushPrompt(); setState('hidden'); }}>Agora não</button>
      </div>
    </div>
  );
}

function Diary({ lines }: { lines: LogLine[] }) {
  const now = useNow(1000);
  return (
    <aside className="diary" aria-live="polite">
      <h3>O que está acontecendo</h3>
      {lines.length === 0 && <p className="muted">A gangue saiu para o primeiro corre. O carro com o anel amarelo é o seu.</p>}
      {lines.slice(-5).reverse().map(l => (
        <p key={l.id} className={l.kind}><span>{l.text}</span><time>{ago(l.at, now)}</time></p>
      ))}
    </aside>
  );
}

export default function App() {
  const [player, setPlayer] = useState<PlayerState | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [tab, setTab] = useState<Tab>('assaltos');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(!getToken());
  const [nick, setNick] = useState('');
  const [showIntro, setShowIntro] = useState(false);
  const [buying, setBuying] = useState<RealMoneyProduct | null>(null);
  const [sharing, setSharing] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [photo, setPhoto] = useState(false);
  // ?ficha=CODIGO abre a ficha de alguém (funciona até sem conta); ?ref=CODIGO é o convite
  const [query] = useState(() => new URLSearchParams(window.location.search));
  const [profileCode, setProfileCode] = useState<string | null>(() => query.get('ficha'));
  const [ref] = useState(() => {
    const r = query.get('ref');
    try { if (r) localStorage.setItem('gti_ref', r); return r ?? localStorage.getItem('gti_ref'); } catch { return r; }
  });
  useEffect(() => {
    if (query.get('ficha') || query.get('ref')) window.history.replaceState(null, '', window.location.pathname);
  }, [query]);
  const [currency, setCurrencyState] = useState<Currency>(initialCurrency);
  const [shopInfo, setShopInfo] = useState({ pixLive: false, cardLive: false, products: [] as RealMoneyProduct[] });
  // Volta da página do Stripe: ?pedido=<id>[&cancelado=1]
  const [returning, setReturning] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    const id = q.get('pedido');
    return id ? { orderId: id, cancelled: q.get('cancelado') === '1' } : null;
  });
  useEffect(() => {
    if (returning) window.history.replaceState(null, '', window.location.pathname);
  }, [returning]);
  const setCurrency = (c: Currency) => { setCurrencyState(c); saveCurrency(c); };

  useEffect(() => { initAds(); refreshPushIfGranted(getToken()); }, []);

  // Com a aba em segundo plano e a polícia de olho, o título pisca para chamar atenção
  const urgent = player && isLookBurned(player, Date.now()) ? '(!) Troque de visual'
    : player?.alert?.status === 'pending' ? '(!) Roubo monitorado'
    : player?.heatWarning ? '(!) Barra suja: se esconda'
    : player?.hideout && player.hideout.until <= Date.now() ? '(!) Pode voltar ao corre'
    : null;
  useEffect(() => {
    const base = BRAND.name;
    if (!urgent) { document.title = base; return; }
    let on = false;
    const id = setInterval(() => {
      on = !on;
      document.title = document.hidden && on ? urgent : base;
    }, 1000);
    return () => { clearInterval(id); document.title = base; };
  }, [urgent]);
  const logId = useRef(0);

  const pushLog = useCallback((items: Omit<LogLine, 'id' | 'at'>[]) => {
    if (!items.length) return;
    const at = Date.now();
    setLog(prev => [...prev, ...items.map(t => ({ ...t, at, id: ++logId.current }))].slice(-30));
  }, []);

  const seenInbox = useRef<Set<string> | null>(null);
  const apply = useCallback((r: { player: PlayerState; events: GameEvent[] }) => {
    // recados novos (bonde, golpe em equipe, presentes, leilão) entram no diário
    const ids = new Set((r.player.inbox ?? []).map(m => m.id));
    if (seenInbox.current) {
      const fresh = (r.player.inbox ?? []).filter(m => !seenInbox.current!.has(m.id) && !m.read).reverse();
      if (fresh.length) pushLog(fresh.map(m => ({ kind: 'info' as const, text: m.text })));
    }
    seenInbox.current = ids;
    setPlayer(r.player);
    setFetchedAt(Date.now());
    pushLog(describe(r.events));
    if (!r.player.seenIntro) setShowIntro(true);
  }, [pushLog]);

  const refresh = useCallback(async () => {
    try { apply(await api.state()); }
    catch (e) { if (e instanceof ApiError && e.status === 401) { clearToken(); setNeedsLogin(true); } }
  }, [apply]);

  useEffect(() => {
    if (needsLogin) return;
    api.shop().then(setShopInfo).catch(() => {});
  }, [needsLogin]);

  useEffect(() => {
    if (needsLogin) return;
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [needsLogin, refresh]);

  const act = useCallback(async (a: Action) => {
    try { apply(await api.act(a)); }
    catch (e) {
      setToast((e as Error).message);
      setTimeout(() => setToast(null), 3500);
    }
  }, [apply]);

  const closeIntro = () => { setShowIntro(false); if (player && !player.seenIntro) act({ type: 'dismissIntro' }); };
  const onPaid = useCallback(() => { refresh(); }, [refresh]);

  if (needsLogin) {
    return (
      <main className="login">
        <h1>{BRAND.name}<span>{BRAND.tagline}</span></h1>
        <p>Comece com $50 na Periferia, monte sua gangue e atravesse a cidade até as Mansões. Ela trabalha até quando você fecha o jogo.</p>
        {ref && <p className="invite-note">Você chegou por convite ({ref}): entra com bônus de grana e diamantes.</p>}
        <form onSubmit={async e => { e.preventDefault(); await api.guest(nick, ref); try { localStorage.removeItem('gti_ref'); } catch { /* ok */ } setNeedsLogin(false); }}>
          <input autoFocus value={nick} maxLength={16} onChange={e => setNick(e.target.value)} placeholder="Seu apelido" aria-label="Seu apelido, de 3 a 16 letras" />
          <button disabled={nick.trim().length < 3}>Entrar</button>
        </form>
        <p className="small">Para maiores de 18 anos.</p>
        {profileCode && <ProfileModal code={profileCode} onClose={() => setProfileCode(null)} />}
      </main>
    );
  }

  if (!player) return <main className="loading">Carregando a cidade…</main>;

  const mission = currentMission(player);
  const missionTab = mission && !missionDone(player) ? mission.tab : null;

  return (
    <div className="app">
      <Hud player={player} onLawyer={() => act({ type: 'payLawyer' })} onShop={() => setTab('loja')} onHelp={() => setShowIntro(true)} onShare={() => setSharing(true)} onMap={() => setShowMap(true)}
        onPhoto={() => setPhoto(true)} onProfile={() => setProfileCode(player.referral.code)} onDirty={() => setTab('imoveis')} />
      <div className="layout">
        <section className="map" aria-label="Mapa">
          <CityCanvas player={player} fetchedAt={fetchedAt}
            onSelectJob={id => { setSelectedJob(id); setTab('assaltos'); }}>
            <Diary lines={log} />
            <div className="map-top">
              <AlertCard p={player} onState={apply} onVip={() => act({ type: 'resolveAlertVip' })} onShop={() => setTab('loja')} />
              <LookBurnCard p={player} act={act} onLook={() => setTab('visual')} />
              <HideoutCard p={player} act={act} onShop={() => setTab('loja')} />
              {!player.alert && !player.heatWarning && !player.hideout && <NotifyPrompt show={player.level >= RULES.alertMinLevel} />}
              {import.meta.env.DEV && (
                <div className="dev-tools">
                  {([
                    ['+$100.000', api.devCash, true],
                    ['+$50.000 sujo', api.devDirty, true],
                    ['+ itens de mercado', api.devLoot, true],
                    ['Nível 90', api.devLevel, player.level < 90],
                    ['Testar alerta', api.devAlert, !player.alert],
                    ['Testar 3 estrelas', api.devHeat, !player.hideout && !player.heatWarning],
                    ['Testar 4 estrelas', api.devBurn, !isLookBurned(player, Date.now())],
                    ['Testar 5 estrelas', () => api.devWanted(5), true],
                    ['Testar 6 estrelas', () => api.devWanted(6), true],
                    ['Zerar estrelas', () => api.devWanted(0), player.heat > 0],
                    ['Pular espera do esconderijo', api.devHideoutSkip, !!player.hideout && player.hideout.until > Date.now()],
                  ] as const).filter(([, , show]) => show).map(([label, fn]) => (
                    <button key={label} className="ghost small" onClick={async () => {
                      try { apply(await fn()); } catch (e) { setToast((e as Error).message); setTimeout(() => setToast(null), 3500); }
                    }}>{label}</button>
                  ))}
                  <small>só em desenvolvimento</small>
                </div>
              )}
            </div>
          </CityCanvas>
        </section>
        <div className="side">
          <Objective p={player} onClaim={() => act({ type: 'claimMission' })} onGo={t => setTab(t)} />
          <div className="sheet">
            <nav className="tabs" aria-label="Seções">
              {TABS.map(([id, label, icon]) => (
                <button key={id} className={tab === id ? 'tab on' : 'tab'} onClick={() => setTab(id)} aria-current={tab === id}>
                  {icon && <Icon name={icon} size={1.15} />}{label}{missionTab === id && tab !== id && <span className="dot" aria-label="objetivo aqui" />}
                </button>
              ))}
            </nav>
            {tab === 'assaltos' && <RobberiesPanel p={player} act={act} fetchedAt={fetchedAt} selected={selectedJob} onMap={() => setShowMap(true)} />}
            {tab === 'lab' && <LabPanel p={player} act={act} fetchedAt={fetchedAt} />}
            {tab === 'imoveis' && <PropertiesPanel p={player} act={act} />}
            {tab === 'loja' && <ShopPanel p={player} act={act} onBuy={setBuying} products={shopInfo.products}
              currency={currency} onCurrency={setCurrency} anyLive={shopInfo.pixLive || shopInfo.cardLive} />}
            {tab === 'mercado' && <MarketPanel p={player} onState={apply} onVip={() => setTab('loja')} />}
            {tab === 'gangue' && <GangPanel p={player} act={act} onShare={() => setSharing(true)} />}
          {tab === 'visual' && <LookPanel p={player} act={act} />}
          {tab === 'base' && <BasePanel p={player} act={act} />}
            {tab === 'bonde' && <CrewPanel p={player} onState={apply} />}
            {tab === 'cidade' && <CityPanel p={player} onState={apply} onProfile={setProfileCode} />}
            {tab === 'chat' && <Chat />}
          </div>
        </div>
      </div>
      {toast && <div className="toasts" role="alert"><div className="toast bad">{toast}</div></div>}
      {showIntro && <Intro onClose={closeIntro} />}
      {sharing && <ShareModal p={player} onClose={() => setSharing(false)} />}
      {photo && <PhotoModal p={player} onClose={() => setPhoto(false)} />}
      {profileCode && <ProfileModal code={profileCode} onClose={() => setProfileCode(null)} />}
      {showMap && <WorldMap p={player} onTravel={d => act({ type: 'travel', district: d })} onClose={() => setShowMap(false)} />}
      {buying && <CheckoutModal product={buying} currency={currency} pixLive={shopInfo.pixLive} cardLive={shopInfo.cardLive}
        onClose={() => setBuying(null)} onPaid={onPaid} />}
      {returning && <OrderReturnModal orderId={returning.orderId} cancelled={returning.cancelled}
        onClose={() => setReturning(null)} onPaid={onPaid} />}
    </div>
  );
}
