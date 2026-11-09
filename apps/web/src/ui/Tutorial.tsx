// Tutorial guiado: destaca cada parte da tela e explica o que fazer, na ordem em que o jogador vai precisar.
// Abre sozinho depois da introdução (primeira vez) e pode ser revisto pelo "Como jogar".
import { useEffect, useLayoutEffect, useState } from 'react';

export interface TourStep {
  /** Elemento destacado (data-tour="..."). Sem alvo, o cartão aparece no centro. */
  target?: string;
  /** Aba que precisa estar aberta neste passo */
  tab?: string;
  title: string;
  text: string;
}

export const TOUR: TourStep[] = [
  { title: 'Bem-vindo à Costa Dourada', text: 'Você monta uma gangue que trabalha sozinha, até com o jogo fechado. Em 1 minuto eu te mostro o que importa. Dá para pular e rever depois em "Como jogar".' },
  { target: 'cash', title: 'Grana e nível', text: 'Cada assalto dá grana e XP de Respeito. Subir de nível libera alvos maiores e novos distritos no mapa.' },
  { target: 'tabs', tab: 'assaltos', title: '1º passo: escolher o assalto', text: 'Na aba Assaltos você escolhe o alvo. Comece com "Bater carteira": não precisa de bala e a gangue repete sozinha.' },
  { target: 'objective', title: 'Siga a placa amarela', text: 'O objetivo mostra o próximo passo e quanto paga. Terminou, toque em "Receber". É o caminho mais rápido no começo.' },
  { target: 'vitals', tab: 'inventario', title: '2º passo: vida, balas e kits', text: 'Golpe de 2 estrelas ou mais gasta bala e machuca. Sem bala, só 1% dá certo. Se a vida ou os kits acabarem, a gangue volta para o esconderijo e PARA de farmar.' },
  { target: 'sheet', tab: 'inventario', title: 'Mercador e mochila', text: 'Aqui você compra munição e kits com a grana do jogo (dá para deixar "Repor sozinha" ligado) e vê os itens que caem nos assaltos: armas, roupas, carros e motos com status.' },
  { target: 'heat', title: 'Cuidado com as estrelas', text: 'Todo crime sobe o procurado. Com 3 estrelas se esconda; com 4 a polícia queima sua roupa e carro; no topo é cadeia. Golpe pequeno chama pouca polícia.' },
  { target: 'sheet', tab: 'imoveis', title: '3º passo: renda parada', text: 'Com as primeiras centenas de dólares, compre imóveis: eles pingam grana o tempo todo e lavam o dinheiro sujo dos golpes grandes.' },
  { target: 'sheet', tab: 'mercado', title: 'Itens valem dinheiro', text: 'Item que você não usa vende no Mercador na hora, no Mercado por diamantes ou, quando liberado, para outros jogadores por dinheiro real.' },
  { target: 'account', title: 'Salve seu progresso', text: 'Jogando como convidado, limpar o navegador apaga tudo. Ligue Google ou Discord em "Conta" e jogue de qualquer aparelho.' },
  { title: 'No que focar agora', text: 'Nível 1 a 10: carteira e banca, objetivos e primeiros imóveis. Nível 10 a 30: arma com bala, kits, bonde com amigos e equipamento melhor. Nível 30+: golpes grandes, lavagem, golpe em equipe e território. Boa sorte, chefe.' },
];

export default function Tutorial({ step, onStep, onTab, onClose }: {
  step: number; onStep: (n: number) => void; onTab: (tab: string) => void; onClose: (done: boolean) => void;
}) {
  const s = TOUR[step];
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => { if (s?.tab) onTab(s.tab); }, [s, onTab]);
  useLayoutEffect(() => {
    if (!s?.target) { setRect(null); return; }
    const find = () => {
      const el = document.querySelector(`[data-tour="${s.target}"]`);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      setRect(el.getBoundingClientRect());
    };
    const id = window.setTimeout(find, 60); // espera a aba trocar
    window.addEventListener('resize', find);
    return () => { window.clearTimeout(id); window.removeEventListener('resize', find); };
  }, [s]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(false);
      if (e.key === 'ArrowRight') onStep(Math.min(TOUR.length - 1, step + 1));
      if (e.key === 'ArrowLeft') onStep(Math.max(0, step - 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [step, onStep, onClose]);
  if (!s) return null;

  const last = step === TOUR.length - 1;
  const pad = 6;
  // cartão abaixo do alvo; se não couber, acima; sem alvo, no centro
  const vw = window.innerWidth, vh = window.innerHeight;
  const cardW = Math.min(360, vw - 24);
  let style: React.CSSProperties = { left: (vw - cardW) / 2, top: Math.max(16, vh / 2 - 120), width: cardW };
  if (rect) {
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - cardW / 2), vw - cardW - 12);
    const below = rect.bottom + 12;
    style = below + 200 < vh ? { left, top: below, width: cardW } : { left, top: Math.max(12, rect.top - 212), width: cardW };
  }
  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect
        ? <div className="tour-spot" style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }} />
        : <div className="tour-dim" />}
      <div className="tour-card" style={style}>
        <small className="muted">Passo {step + 1} de {TOUR.length}</small>
        <h3 id="tour-title">{s.title}</h3>
        <p>{s.text}</p>
        <div className="tour-dots" aria-hidden="true">{TOUR.map((_, i) => <span key={i} className={i === step ? 'on' : ''} />)}</div>
        <div className="row">
          <button className="ghost small" onClick={() => onClose(false)}>Pular</button>
          <span style={{ flex: 1 }} />
          {step > 0 && <button className="ghost small" onClick={() => onStep(step - 1)}>Voltar</button>}
          <button className="small" autoFocus onClick={() => (last ? onClose(true) : onStep(step + 1))}>{last ? 'Bora!' : 'Próximo'}</button>
        </div>
      </div>
    </div>
  );
}
