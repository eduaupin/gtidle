import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { LANGS, lang, setLang, t } from '../i18n';
import {
  FOUNDER_DEADLINE, MAX_STARS, NIGHT, isNight, activeEvents, STAR_LEVELS, formatCash, starsFor, isJailed, isTurbo, isVip, lawyerCost, totalDiamonds, xpToNext, type PlayerState,
} from '@gti/shared';

export function useNow(ms = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}

function countdown(to: number, now: number) {
  const s = Math.max(0, Math.floor((to - now) / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}min` : `${h}h ${m}min ${s % 60}s`;
}

export default function Hud({ player: p, onLawyer, onShop, onHelp, onShare, onMap, onPhoto, onProfile, onDirty, onAccount, onInventory }: {
  player: PlayerState; onLawyer: () => void; onShop: () => void; onHelp: () => void; onShare: () => void; onMap: () => void;
  onPhoto: () => void; onProfile: () => void; onDirty: () => void; onAccount: () => void; onInventory: () => void;
}) {
  const now = useNow();
  const stars = starsFor(p.heat);
  const level = STAR_LEVELS[stars];
  const need = xpToNext(p.level);
  const deadline = Date.parse(FOUNDER_DEADLINE);
  const jailed = isJailed(p, now);
  const guest = !(p.accounts ?? []).length;
  const v = p.vitals;
  const vState = v?.down ? 'down' : v && (v.hp < 40 || v.ammo < 20 || v.kits === 0) ? 'low' : '';
  const events = activeEvents(now);
  const night = isNight(now);
  const founder = now < deadline;

  return (
    <header className="hud">
      <div className="hud-who" title="Respeito sobe com assaltos e vendas. Cada nível libera alvos, negócios e distritos.">
        <span className={`nick ${p.flags.founder ? 'founder' : ''}`}>{p.nick}</span>
        <div className="hud-level">
          <strong>Nível {p.level}</strong>
          {isVip(p, now) && <span className="badge vip" title={`Clube Rockeiro até ${new Date(p.vipUntil!).toLocaleDateString('pt-BR')}`}>Clube</span>}
          {isTurbo(p, now) && <span className="badge turbo">Turbo</span>}
          <div className="bar" aria-label={`${Math.floor(p.xp)} de ${need} XP`}><div style={{ width: `${Math.min(100, (p.xp / need) * 100)}%` }} /></div>
          <small>{Math.floor(p.xp)}/{need} XP</small>
        </div>
      </div>

      <div className="hud-stat hud-cash" data-tour="cash">
        <small>{t('Grana')}</small>
        <strong className="cash with-icon"><Icon name="i_cash" size={1.15} />{formatCash(p.cash)}</strong>
        {p.dirtyCash >= 1 && <button className="dirty-chip" onClick={onDirty} title="Grana suja: os imóveis lavam aos poucos">+{formatCash(p.dirtyCash)} sujo</button>}
      </div>

      <button className="hud-stat hud-dia" onClick={onShop} title="Diamantes: compram visuais e atalhos na Loja">
        <small>{t('Diamantes')}</small>
        <strong className="with-icon"><Icon name="i_diamond" size={1.15} />{totalDiamonds(p)}</strong>
      </button>

      {v && (
        <button data-tour="vitals" className={`hud-vitals ${vState}`} onClick={onInventory}
          title="Vida, munição e kits médicos da gangue. Toque para abrir o Inventário e comprar no Mercador.">
          {v.down
            ? <span className="vit-down"><small>Gangue</small><b>No esconderijo</b></span>
            : <>
                <span className={v.hp < 40 ? 'low' : ''}><small>Vida</small><b>{Math.round(v.hp)}</b></span>
                <span className={v.ammo < 20 ? 'low' : ''}><small>Balas</small><b>{Math.floor(v.ammo)}</b></span>
                <span className={v.kits === 0 ? 'low' : ''}><small>Kits</small><b>{v.kits}</b></span>
              </>}
        </button>
      )}

      <div data-tour="heat" className={`hud-stat hud-heat ${stars ? `wanted w${stars}` : ''}`} title={`Procurado ${Math.round(p.heat)} de 100. ${level.effect} Com 100 você vai preso por 10 minutos.`}>
        <small>{jailed ? 'Preso' : stars ? level.name : t('Procurado')}</small>
        <div className="row">
          <span className="stars" aria-label={`${stars} de ${MAX_STARS} estrelas`}>
            {Array.from({ length: MAX_STARS }, (_, i) => <span key={i} className={i < stars ? 'star on' : 'star'}>★</span>)}
          </span>
          {(stars >= 2 || jailed) && <button className="small" onClick={onLawyer}>Advogado {formatCash(lawyerCost(p))}</button>}
        </div>
      </div>

      {(events.length > 0 || night || founder) && (
        <div className="hud-chips">
          {events.map(ev => <span key={ev.id} className="hud-chip event" title={ev.text}>{ev.name}</span>)}
          {night && <span className="hud-chip night" title={`Das ${NIGHT.from} h às ${NIGHT.to} h (Brasília): assaltos pagam +${Math.round((NIGHT.cashMult - 1) * 100)}% e chamam +${Math.round((NIGHT.heatMult - 1) * 100)}% de polícia`}>Noite +{Math.round((NIGHT.cashMult - 1) * 100)}%</span>}
          {founder && <button className="hud-chip founder" onClick={onShop} title="Pacote Fundador e evento de login acabam no fim do dia 19/11">Fundador: {countdown(deadline, now)}</button>}
        </div>
      )}

      <HudMenu guest={guest} items={[
        ['Mapa da cidade', 'Viajar entre distritos', onMap],
        ['Minha ficha', 'Seu perfil público', onProfile],
        ['Foto', 'Retrato da gangue para postar', onPhoto],
        ['Compartilhar', 'Card com seu progresso', onShare],
        ['Conta', guest ? 'Convidado: ligue Google ou Discord' : 'Login e aparelhos', onAccount],
        ['Como jogar', 'Introdução e tutorial', onHelp],
      ]} />
    </header>
  );
}

/** Menu único com tudo que não é placar: abre por cima, fecha com Esc ou clique fora. */
function HudMenu({ guest, items }: { guest: boolean; items: [string, string, () => void][] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const out = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', out);
    document.addEventListener('keydown', key);
    box.current?.querySelector<HTMLButtonElement>('.menu-pop button')?.focus();
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', key); };
  }, [open]);
  return (
    <div className="hud-menu" ref={box}>
      <button data-tour="account" className={`menu-btn ${guest ? 'alert-dot' : ''}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(o => !o)}
        title={guest ? 'Convidado: ligue Google ou Discord para não perder o jogo' : 'Menu'}>
        <span className="burger" aria-hidden="true"><i /><i /><i /></span>Menu
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          {items.map(([label, note, run]) => (
            <button key={label} role="menuitem" className={label === 'Conta' && guest ? 'warn' : ''} onClick={() => { setOpen(false); run(); }}>
              <b>{t(label)}</b><small>{note}</small>
            </button>
          ))}
          <div className="menu-lang" role="group" aria-label="Idioma">
            {LANGS.map(([id, l]) => <button key={id} className={lang === id ? 'chip active' : 'chip'} onClick={() => setLang(id)}>{l}</button>)}
          </div>
        </div>
      )}
    </div>
  );
}
