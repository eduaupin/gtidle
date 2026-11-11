// Navegação: 5 seções (no celular, barra fixa embaixo) e as abas de cada seção.
// Antes eram 14 abas soltas com o mesmo peso; agora o jogador escolhe primeiro "onde" e depois "o quê".
import { PVP } from '@gti/shared';
import Icon from './Icon';
import { t } from '../i18n';

export type Tab = 'assaltos' | 'capangas' | 'arena' | 'inventario' | 'lab' | 'imoveis' | 'gangue' | 'visual' | 'base' | 'bonde' | 'cidade' | 'mercado' | 'loja' | 'chat';
export type SectionId = 'rua' | 'gangue' | 'disputas' | 'cidade' | 'loja';
export type Dot = 'mission' | 'news';

interface SubTab { id: Tab; label: string; minLevel?: number }
interface Section { id: SectionId; label: string; icon: string; tabs: SubTab[] }

export const SECTIONS: Section[] = [
  { id: 'rua', label: 'Rua', icon: 'i_car', tabs: [{ id: 'assaltos', label: 'Assaltos' }, { id: 'imoveis', label: 'Imóveis' }, { id: 'lab', label: 'Galpão' }] },
  { id: 'gangue', label: 'Gangue', icon: 'i_star', tabs: [
    { id: 'capangas', label: 'Capangas' }, { id: 'inventario', label: 'Inventário' }, { id: 'gangue', label: 'Melhorias' },
    { id: 'visual', label: 'Visual' }, { id: 'base', label: 'Base' },
  ] },
  { id: 'disputas', label: 'Disputas', icon: 'i_trophy', tabs: [{ id: 'bonde', label: 'Bonde' }, { id: 'arena', label: 'Arena', minLevel: PVP.minLevel }] },
  { id: 'cidade', label: 'Cidade', icon: 'i_glass', tabs: [{ id: 'cidade', label: 'Calçadão' }, { id: 'mercado', label: 'Mercado' }, { id: 'chat', label: 'Chat' }] },
  { id: 'loja', label: 'Loja', icon: 'i_diamond', tabs: [{ id: 'loja', label: 'Loja' }] },
];

export const sectionOf = (tab: Tab) => SECTIONS.find(s => s.tabs.some(x => x.id === tab)) ?? SECTIONS[0];
export const firstTabs = Object.fromEntries(SECTIONS.map(s => [s.id, s.tabs[0].id])) as Record<SectionId, Tab>;

/** Bolinha da seção: missão vence novidade */
const sectionDot = (s: Section, dots: Partial<Record<Tab, Dot>>): Dot | undefined => {
  const all = s.tabs.map(x => dots[x.id]).filter(Boolean) as Dot[];
  return all.includes('mission') ? 'mission' : all[0];
};

export function SectionNav({ tab, dots, onSection }: { tab: Tab; dots: Partial<Record<Tab, Dot>>; onSection: (s: SectionId) => void }) {
  const cur = sectionOf(tab).id;
  return (
    <nav className="sections" aria-label="Seções" data-tour="tabs">
      {SECTIONS.map(s => {
        const dot = sectionDot(s, dots);
        return (
          <button key={s.id} className={s.id === cur ? 'section-btn on' : 'section-btn'} aria-current={s.id === cur ? 'page' : undefined} onClick={() => onSection(s.id)}>
            <Icon name={s.icon} size={1.3} />
            <span>{t(s.label)}</span>
            {dot && s.id !== cur && <span className={`dot dot-${dot}`} aria-label={dot === 'mission' ? 'objetivo aqui' : 'novidade'} />}
          </button>
        );
      })}
    </nav>
  );
}

export function SubTabs({ tab, level, dots, onTab }: { tab: Tab; level: number; dots: Partial<Record<Tab, Dot>>; onTab: (t: Tab) => void }) {
  const s = sectionOf(tab);
  if (s.tabs.length < 2) return null;
  return (
    <div className="subtabs" role="tablist" aria-label={t(s.label)}>
      {s.tabs.map(x => (
        <button key={x.id} role="tab" aria-selected={x.id === tab} className={x.id === tab ? 'subtab on' : 'subtab'} onClick={() => onTab(x.id)}>
          {t(x.label)}
          {x.minLevel && level < x.minLevel && <span className="lv" title={`Abre no nível ${x.minLevel}`}>nv {x.minLevel}</span>}
          {dots[x.id] && x.id !== tab && <span className={`dot dot-${dots[x.id]}`} />}
        </button>
      ))}
    </div>
  );
}
