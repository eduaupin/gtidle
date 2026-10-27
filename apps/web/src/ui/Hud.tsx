import { useEffect, useState } from 'react';
import Icon from './Icon';
import {
  FOUNDER_DEADLINE, MAX_STARS, NIGHT, isNight, STAR_LEVELS, formatCash, starsFor, isJailed, isTurbo, isVip, lawyerCost, totalDiamonds, xpToNext, type PlayerState,
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

export default function Hud({ player: p, onLawyer, onShop, onHelp, onShare, onMap, onPhoto, onProfile, onDirty }: {
  player: PlayerState; onLawyer: () => void; onShop: () => void; onHelp: () => void; onShare: () => void; onMap: () => void;
  onPhoto: () => void; onProfile: () => void; onDirty: () => void;
}) {
  const now = useNow();
  const stars = starsFor(p.heat);
  const level = STAR_LEVELS[stars];
  const need = xpToNext(p.level);
  const deadline = Date.parse(FOUNDER_DEADLINE);
  const jailed = isJailed(p, now);

  return (
    <header className="hud">
      <div className="hud-stat hud-who">
        <span className={`nick ${p.flags.founder ? 'founder' : ''}`}>{p.nick}</span>
 {isVip(p, now) && <Icon name="i_vip" size={1.6} title="Clube Rockeiro" />}
        {isVip(p, now) && <span className="badge vip" title={`Clube Rockeiro até ${new Date(p.vipUntil!).toLocaleDateString('pt-BR')}`}>★ Clube Rockeiro</span>}
        {isTurbo(p, now) && <span className="badge turbo">Turbo</span>}
      </div>

      <div className="hud-stat hud-level" title="Respeito sobe com assaltos e vendas. Cada nível libera alvos, negócios e distritos.">
        <small><Icon name="i_xp" size={0.9} /> Respeito {Math.floor(p.xp)}/{need} XP</small>
        <strong>Nível {p.level}</strong>
        <div className="bar"><div style={{ width: `${Math.min(100, (p.xp / need) * 100)}%` }} /></div>
      </div>

      <div className="hud-stat">
        <small>Grana</small>
        <strong className="cash with-icon"><Icon name="i_cash" size={1.25} />{formatCash(p.cash)}</strong>
        {p.dirtyCash >= 1 && <button className="dirty-chip" onClick={onDirty} title="Grana suja: os negócios lavam aos poucos (aba Imóveis)">+{formatCash(p.dirtyCash)} sujo</button>}
      </div>

      {isNight(now) && (
        <div className="hud-stat hud-night" title={`Das ${NIGHT.from} h às ${NIGHT.to} h (Brasília): assaltos pagam +${Math.round((NIGHT.cashMult - 1) * 100)}% e chamam +${Math.round((NIGHT.heatMult - 1) * 100)}% de polícia`}>
          <small>Noite</small>
          <strong>+{Math.round((NIGHT.cashMult - 1) * 100)}% grana</strong>
        </div>
      )}

      <button className="hud-stat hud-dia" onClick={onShop} title="Diamantes: compram skins e atalhos na loja">
        <small>Diamantes</small>
        <strong className="with-icon"><Icon name="i_diamond" size={1.25} />{totalDiamonds(p)}</strong>
      </button>

      <div className={`hud-stat hud-heat ${stars ? `wanted w${stars}` : ''}`} title={`Procurado ${Math.round(p.heat)} de 100. ${level.effect} Com 100 você vai preso por 10 minutos.`}>
        <small>{jailed ? 'Preso' : stars ? level.name : 'Procurado'}</small>
        <div className="row">
          <span className="stars" aria-label={`${stars} de ${MAX_STARS} estrelas`}>
            {Array.from({ length: MAX_STARS }, (_, i) => <span key={i} className={i < stars ? 'star on' : 'star'}>★</span>)}
          </span>
          {(stars >= 2 || jailed) && (
            <button className="small" onClick={onLawyer}>Advogado {formatCash(lawyerCost(p))}</button>
          )}
        </div>
      </div>

      {now < deadline && (
        <div className="hud-stat hud-event" title="Pacote Fundador e evento de login acabam no fim do dia 19/11">
          <small>Pacote Fundador acaba em</small>
          <strong>{countdown(deadline, now)}</strong>
        </div>
      )}
      <button className="help" onClick={onMap}>Mapa</button>
      <button className="help" onClick={onShare}>Compartilhar</button>
      <button className="help" onClick={onPhoto}>Foto</button>
      <button className="help" onClick={onProfile}>Ficha</button>
      <button className="help" onClick={onHelp}>Como jogar</button>
    </header>
  );
}
