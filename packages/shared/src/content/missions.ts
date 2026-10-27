// Cadeia de missões: é o "tutorial que paga". Cada missão ensina um sistema
// e a recompensa já empurra para o próximo. Depois da última, o objetivo vira
// o próximo distrito, até as Mansões.
import type { Mission, PlayerState } from '../types';
import { DISTRICTS } from './world';

const owns = (p: PlayerState, id: string) => (p.properties[id] ?? 0) > 0 ? 1 : 0;
const job = (p: PlayerState, id: string) => p.stats.jobCounts[id] ?? 0;
const lvl = (p: PlayerState, n: number): [number, number] => [Math.min(p.level, n), n];

export const MISSIONS: Mission[] = [
  { id: 'm1', title: 'Primeiro corre', tab: 'assaltos',
    task: 'Deixe sua gangue bater 3 carteiras.',
    why: 'Assaltos rodam sozinhos e repetem. Cada um dá grana e XP de Respeito.',
    reward: { cash: 40, xp: 10 }, progress: p => [Math.min(job(p, 'carteira'), 3), 3] },
  { id: 'm2', title: 'Ganhar respeito', tab: 'assaltos',
    task: 'Chegue ao nível 2.',
    why: 'Subir de nível libera assaltos maiores, negócios e novos distritos.',
    reward: { cash: 60, diamonds: 5 }, progress: p => lvl(p, 2) },
  { id: 'm3', title: 'Banca da esquina', tab: 'assaltos',
    task: 'Troque o alvo para a banca de jornal e roube 2 vezes.',
    why: 'Alvos maiores demoram mais, pagam mais e sobem mais o procurado.',
    reward: { cash: 100, xp: 40 }, progress: p => [Math.min(job(p, 'banca'), 2), 2] },
  { id: 'm4', title: 'Dinheiro limpo', tab: 'imoveis',
    task: 'Compre a Lanchonete de fachada.',
    why: 'Imóveis pingam grana o tempo todo, até com você offline ou preso.',
    reward: { cash: 150, diamonds: 5, xp: 40 }, progress: p => [owns(p, 'lanchonete'), 1] },
  { id: 'm5', title: 'Abrir o galpão', tab: 'lab',
    task: 'Chegue ao nível 3 e compre 1 lote de insumo de Folha Verde.',
    why: 'O galpão transforma insumo em produto por tempo. É a segunda fonte de renda.',
    reward: { cash: 100 }, progress: p => [Math.min(p.supplies.folha + p.stats.batchesDone + (p.lab.lines.some(l => l.loaded) ? 1 : 0), 1), 1] },
  { id: 'm6', title: 'Primeiro lote', tab: 'lab',
    task: 'Coloque uma linha do laboratório para refinar e espere 1 lote ficar pronto.',
    why: 'Cada lote leva alguns minutos e rende 10 unidades.',
    reward: { cash: 150, diamonds: 10, xp: 60 }, progress: p => [Math.min(p.stats.batchesDone, 1), 1] },
  { id: 'm7', title: 'Abrir o ponto', tab: 'lab',
    task: 'Escolha o produto nos pontos de venda e venda 10 unidades.',
    why: 'Os pontos vendem sozinhos. Mais pontos, mais rápido — e mais procurado.',
    reward: { cash: 250 }, progress: p => [Math.min(p.stats.unitsSold, 10), 10] },
  { id: 'm8', title: 'Esfriar a barra', tab: 'assaltos',
    task: 'Pague o advogado uma vez (botão ao lado das estrelas).',
    why: 'Com 5 estrelas você vai preso por 10 minutos e tudo para, menos os imóveis.',
    reward: { cash: 200, diamonds: 5 }, progress: p => [Math.min(p.stats.lawyerUses, 1), 1] },
  { id: 'm9', title: 'Loja de conveniência', tab: 'assaltos',
    task: 'Roube a loja de conveniência 3 vezes (nível 4).',
    why: 'É o salto de renda da Periferia. Evolua os imóveis com o lucro.',
    reward: { cash: 500, diamonds: 10 }, progress: p => [Math.min(job(p, 'conveniencia'), 3), 3] },
  { id: 'm10', title: 'Posto de gasolina', tab: 'assaltos',
    task: 'Chegue ao nível 7 e roube o posto uma vez.',
    why: 'O maior alvo da Periferia. Depois dele, o Porto.',
    reward: { cash: 1500, diamonds: 15 }, progress: p => [Math.min(job(p, 'posto'), 1), 1] },
  { id: 'm11', title: 'Rumo ao Porto', tab: 'assaltos',
    task: 'Chegue ao nível 10 e mude para o Porto.',
    why: 'Distritos novos têm alvos maiores e pagam mais pelo produto.',
    reward: { cash: 3000, diamonds: 25 }, progress: p => [p.district === 'periferia' ? Math.min(p.level, 9) : 10, 10] },
];

/** Objetivo de longo prazo: atravessar a cidade até as Mansões. */
export function nextDistrictGoal(p: PlayerState) {
  const next = DISTRICTS.find(d => d.minLevel > p.level);
  return next ?? null;
}

export function currentMission(p: PlayerState) {
  return MISSIONS[p.missionIndex] ?? null;
}

export function missionDone(p: PlayerState) {
  const m = currentMission(p);
  if (!m) return false;
  const [cur, goal] = m.progress(p);
  return cur >= goal;
}
