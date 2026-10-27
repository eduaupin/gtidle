// Conteúdo do mundo: distritos, assaltos, laboratório e imóveis.
// Tudo aqui é balanceamento — ajuste os números sem mexer no motor.
import type { District, DistrictId, Drug, Property, RobberyJob } from '../types';

/**
 * Estado fictício de Costa Dourada. A estrutura segue a de uma península tropical:
 * metrópole na costa leste com praias em ilhas-barreira, porto e aeroporto; lagoa no meio;
 * pântano no centro-sul; interior rural e mata no norte; cidade portuária no oeste;
 * e um arquipélago de ilhotas no sul até a Ilha do Sol. Nomes e traçado são originais.
 */
export const DISTRICTS: District[] = [
  { id: 'periferia', name: 'Periferia', minLevel: 1, streetPriceMult: 1.0, terrain: 'city', map: { x: 60, y: 94 },
    palette: { ground: '#3a3f2c', roof: '#8a6f55', accent: '#e8c547' },
    description: 'Onde todo mundo começa. Banca, mercadinho e muita moto.' },
  { id: 'porto', name: 'Porto da Baía', minLevel: 10, streetPriceMult: 1.15, terrain: 'port', map: { x: 81, y: 106 },
    palette: { ground: '#2f3a44', roof: '#6b7b88', accent: '#3fb8c9' },
    description: 'Contêineres, guindastes e carga sem dono.' },
  { id: 'aeroporto', name: 'Aeroporto Internacional', minLevel: 18, streetPriceMult: 1.2, terrain: 'airport', map: { x: 47, y: 108 },
    palette: { ground: '#3a3d40', roof: '#9aa3ab', accent: '#ffb000' },
    description: 'Bagagem extraviada e carga que ninguém confere.' },
  { id: 'centro', name: 'Centro', minLevel: 25, streetPriceMult: 1.3, terrain: 'city', map: { x: 70, y: 112 },
    palette: { ground: '#3b3b44', roof: '#9a9aa8', accent: '#f25f5c' },
    description: 'Bancos, joalherias e gente engravatada.' },
  { id: 'pantano', name: 'Pântano dos Jacarés', minLevel: 30, streetPriceMult: 1.25, terrain: 'swamp', map: { x: 34, y: 100 },
    palette: { ground: '#3a4a2a', roof: '#7a6a4a', accent: '#9bd14b' },
    description: 'Lanchas, palafitas e fazendeiros desconfiados.' },
  { id: 'autodromo', name: 'Autódromo', minLevel: 35, streetPriceMult: 1.35, terrain: 'rural', map: { x: 40, y: 42 },
    palette: { ground: '#4a5a32', roof: '#c94c4c', accent: '#ff6b2c' },
    description: 'Box de corrida cheio de peça cara.' },
  { id: 'orla', name: 'Orla', minLevel: 40, streetPriceMult: 1.5, terrain: 'beach', map: { x: 90, y: 66 },
    palette: { ground: '#4a4231', roof: '#e0b483', accent: '#ff4fb0' },
    description: 'Neon, boate e corrida na avenida da praia.' },
  { id: 'lagoa', name: 'Lagoa Grande', minLevel: 45, streetPriceMult: 1.45, terrain: 'beach', map: { x: 56, y: 58 },
    palette: { ground: '#3f5a3a', roof: '#d9c7a6', accent: '#4fd1c5' },
    description: 'Clube náutico e mansões na beira da lagoa.' },
  { id: 'vila_norte', name: 'Vila Norte', minLevel: 50, streetPriceMult: 1.55, terrain: 'city', map: { x: 50, y: 14 },
    palette: { ground: '#3a4038', roof: '#a8a090', accent: '#7cb7ff' },
    description: 'Cidade do interior com aeroporto e shopping.' },
  { id: 'porto_oeste', name: 'Porto do Poente', minLevel: 55, streetPriceMult: 1.6, terrain: 'port', map: { x: 14, y: 56 },
    palette: { ground: '#2f3a44', roof: '#8e7f6a', accent: '#ff9f43' },
    description: 'O porto do lado do pôr do sol. Navio cargueiro toda semana.' },
  { id: 'marina', name: 'Marina', minLevel: 60, streetPriceMult: 1.75, terrain: 'island', map: { x: 88, y: 92 },
    palette: { ground: '#25404a', roof: '#d9e2e6', accent: '#7cf2c9' },
    description: 'Iates, leilões e dinheiro velho.' },
  { id: 'mata', name: 'Mata Vermelha', minLevel: 65, streetPriceMult: 1.7, terrain: 'forest', map: { x: 20, y: 26 },
    palette: { ground: '#2d4030', roof: '#8a5a3a', accent: '#e85d3c' },
    description: 'Madeireira, estrada de terra e pista de pouso escondida.' },
  { id: 'ilhotas', name: 'Ilhotas', minLevel: 70, streetPriceMult: 1.8, terrain: 'island', map: { x: 50, y: 136 },
    palette: { ground: '#2a4a50', roof: '#f0d7a8', accent: '#3fe0ff' },
    description: 'Ponte longa, pousadas e pedágio.' },
  { id: 'ilha_sol', name: 'Ilha do Sol', minLevel: 75, streetPriceMult: 1.9, terrain: 'island', map: { x: 16, y: 148 },
    palette: { ground: '#2a4a50', roof: '#ffe0a8', accent: '#ffd23f' },
    description: 'O fim da estrada. Resort de luxo e nenhuma delegacia.' },
  { id: 'mansoes', name: 'Ilha das Mansões', minLevel: 80, streetPriceMult: 2.0, terrain: 'beach', map: { x: 88, y: 28 },
    palette: { ground: '#2d4030', roof: '#c9a46b', accent: '#ffd23f' },
    description: 'O topo. Aqui mora o Chefão.' },
  { id: 'farol', name: 'Ilha do Farol', minLevel: 85, streetPriceMult: 2.1, terrain: 'island', map: { x: 80, y: 124 },
    palette: { ground: '#25404a', roof: '#e8e8e8', accent: '#ff5252' },
    description: 'Dizem que tem um tesouro embaixo do farol.' },
];

const job = (id: string, name: string, district: DistrictId, minLevel: number, durationSec: number, cash: [number, number],
  xp: number, heat: number, maxStars: number, building: RobberyJob['building']): RobberyJob =>
  ({ id, name, district, minLevel, durationSec, cash, xp, heat, maxStars, building });

export const ROBBERIES: RobberyJob[] = [
  { id: 'carteira', name: 'Bater carteira', district: 'periferia', minLevel: 1, durationSec: 20,
    cash: [8, 14], xp: 3, heat: 1, maxStars: 1, building: 'rua' },
  { id: 'banca', name: 'Assaltar banca de jornal', district: 'periferia', minLevel: 2, durationSec: 60,
    cash: [30, 50], xp: 8, heat: 3, maxStars: 2, building: 'banca' },
  { id: 'conveniencia', name: 'Roubar loja de conveniência', district: 'periferia', minLevel: 4, durationSec: 180,
    cash: [120, 180], xp: 20, heat: 6, maxStars: 3, building: 'loja' },
  { id: 'posto', name: 'Roubar posto de gasolina', district: 'periferia', minLevel: 7, durationSec: 480,
    cash: [400, 600], xp: 45, heat: 10, maxStars: 3, building: 'posto' },
  { id: 'carro', name: 'Roubar carro no estacionamento', district: 'porto', minLevel: 10, durationSec: 300,
    cash: [450, 700], xp: 50, heat: 8, maxStars: 4, building: 'garagem' },
  { id: 'carga', name: 'Desviar carga no cais', district: 'porto', minLevel: 13, durationSec: 900,
    cash: [1500, 2200], xp: 110, heat: 14, maxStars: 5, building: 'porto' },
  job('bagagem', 'Desviar bagagem extraviada', 'aeroporto', 18, 600, [2500, 3500], 160, 12, 4, 'garagem'),
  job('carga_aerea', 'Roubar carga aérea', 'aeroporto', 22, 1800, [9000, 13000], 420, 20, 5, 'porto'),
  { id: 'joalheria', name: 'Assaltar joalheria', district: 'centro', minLevel: 25, durationSec: 1800,
    cash: [6000, 9000], xp: 300, heat: 22, maxStars: 6, building: 'joalheria' },
  { id: 'banco', name: 'Grande golpe no banco', district: 'centro', minLevel: 30, durationSec: 7200,
    cash: [40000, 60000], xp: 1200, heat: 45, maxStars: 6, building: 'banco' },
  job('lancha', 'Roubar lancha no atracadouro', 'pantano', 30, 1200, [7000, 10000], 380, 14, 4, 'porto'),
  job('fazenda', 'Esvaziar o cofre da fazenda', 'pantano', 33, 3600, [25000, 35000], 900, 26, 5, 'banco'),
  job('box', 'Levar peças do box de corrida', 'autodromo', 35, 900, [6000, 9000], 330, 12, 4, 'garagem'),
  job('supercarro', 'Roubar supercarro do autódromo', 'autodromo', 38, 5400, [50000, 70000], 1500, 35, 6, 'garagem'),
  job('boate', 'Levar o caixa da boate', 'orla', 40, 1800, [25000, 35000], 900, 20, 5, 'loja'),
  job('hotel', 'Abrir o cofre do hotel', 'orla', 43, 5400, [90000, 120000], 2600, 36, 6, 'banco'),
  job('clube', 'Assaltar o clube náutico', 'lagoa', 45, 2400, [30000, 45000], 1100, 22, 5, 'loja'),
  job('mansao_lago', 'Invadir mansão do lago', 'lagoa', 48, 7200, [120000, 160000], 3200, 40, 6, 'banco'),
  job('shopping', 'Joalheria do shopping', 'vila_norte', 50, 3600, [70000, 90000], 2200, 28, 6, 'joalheria'),
  job('cofre_norte', 'Cofre do aeroporto do norte', 'vila_norte', 53, 7200, [180000, 240000], 4500, 45, 6, 'banco'),
  job('conteiner', 'Esvaziar contêiner', 'porto_oeste', 55, 2400, [60000, 80000], 1900, 24, 5, 'porto'),
  job('navio', 'Tomar o navio cargueiro', 'porto_oeste', 58, 9000, [300000, 400000], 7000, 50, 6, 'porto'),
  job('iate', 'Levar o iate atracado', 'marina', 60, 3600, [150000, 200000], 4000, 30, 6, 'porto'),
  job('leilao', 'Golpe no leilão de arte', 'marina', 63, 10800, [500000, 650000], 9000, 50, 6, 'joalheria'),
  job('madeireira', 'Cofre da madeireira', 'mata', 65, 3600, [180000, 230000], 4500, 26, 5, 'garagem'),
  job('pista', 'Pista de pouso clandestina', 'mata', 68, 10800, [600000, 800000], 10000, 52, 6, 'garagem'),
  job('pedagio', 'Pedágio da ponte', 'ilhotas', 70, 1800, [120000, 150000], 3000, 18, 4, 'posto'),
  job('pousada', 'Cofre da pousada', 'ilhotas', 72, 3600, [250000, 320000], 5200, 26, 5, 'loja'),
  job('resort', 'Cofre do resort', 'ilha_sol', 75, 7200, [700000, 900000], 11000, 44, 6, 'banco'),
  job('garagem_luxo', 'Garagem de carros de luxo', 'mansoes', 80, 5400, [900000, 1100000], 12000, 40, 6, 'garagem'),
  job('mansao', 'Mansão do Chefão', 'mansoes', 82, 14400, [2500000, 3000000], 25000, 60, 6, 'banco'),
  job('farol_tesouro', 'Tesouro do farol', 'farol', 85, 21600, [6000000, 8000000], 50000, 70, 6, 'joalheria'),
];

// Nomes fictícios de propósito. O jogo só mostra timers e números — nada de "como fazer".
export const DRUGS: Drug[] = [
  { id: 'folha', name: 'Folha Verde', minLevel: 3, supplyCost: 20, refineSec: 600, batchYield: 10,
    basePrice: 6, heatPerUnit: 0.2, color: '#5bd16b' },
  { id: 'po_neon', name: 'Pó Neon', minLevel: 15, supplyCost: 150, refineSec: 1800, batchYield: 10,
    basePrice: 40, heatPerUnit: 0.5, color: '#ff4fb0' },
  { id: 'cristal', name: 'Cristal Azul', minLevel: 35, supplyCost: 800, refineSec: 7200, batchYield: 10,
    basePrice: 220, heatPerUnit: 1.0, color: '#4fc3ff' },
];

/** Renda passiva estilo Idle Mafia: negócios de fachada que pingam dinheiro sozinhos. */
export const PROPERTIES: Property[] = [
  { id: 'lanchonete', name: 'Lanchonete de fachada', minLevel: 2, baseCost: 500, incomePerSec: 0.5, maxLevel: 25 },
  { id: 'lava_rapido', name: 'Lava-rápido', minLevel: 8, baseCost: 5000, incomePerSec: 4, maxLevel: 25 },
  { id: 'desmanche', name: 'Oficina de desmanche', minLevel: 15, baseCost: 30000, incomePerSec: 20, maxLevel: 25 },
  { id: 'boate', name: 'Boate', minLevel: 30, baseCost: 200000, incomePerSec: 100, maxLevel: 25 },
  { id: 'cassino', name: 'Cassino clandestino', minLevel: 55, baseCost: 2000000, incomePerSec: 700, maxLevel: 25 },
];

export const RULES = {
  /** Segundos simulados por passo do motor */
  stepSec: 5,
  offlineCapHoursFree: 8,
  offlineCapHoursVip: 16,
  robberySlotsFree: 1,
  robberySlotsVip: 2,
  labLinesBase: 1,
  labLinesVipBonus: 1,
  labMaxLevel: 10,
  labUpgradeBaseCost: 2000,
  /** Cada nível do laboratório acelera o refino em 8% */
  labSpeedPerLevel: 0.08,
  dealingPointBaseCost: 300,
  dealingMaxPoints: 20,
  /** Segundos para cada ponto vender 1 unidade */
  sellSecPerUnit: 30,
  heatDecayPerSec: 0.02,
  jailSec: 600,
  heatAfterJail: 40,
  lawyerBaseCost: 250,
  lawyerHeatReduction: 50,
  vipCashMult: 1.15,
  vipXpMult: 1.15,
  turboSpeedMult: 2,
  /** VIP paga o advogado sozinho quando o procurado passa disso */
  vipAutoLawyerAt: 90,
  dailyDiamondsCap: 10,

  // ---- Evento "seu roubo está sendo monitorado" ----
  /** Só a partir deste nível (não assusta quem acabou de chegar) */
  alertMinLevel: 2,
  /** Intervalo sorteado entre um alerta e o próximo, em minutos */
  alertGapMinMinutes: 12,
  alertGapMaxMinutes: 25,
  /** Tempo para voltar e despistar */
  alertWindowSec: 120,
  /** Golpe fraco: fração da recompensa enquanto não despistar */
  weakMult: 0.35,
  /** VIP despistou: bônus sobre a recompensa normal, por um tempo */
  boostMult: 1.5,
  boostMinutes: 30,
  /** Anúncio recompensado: tempo mínimo entre começar e concluir, e limite por dia */
  adMinSec: 8,
  adsPerDay: 30,

  // ---- "Barra suja": 3 estrelas pedem para a gangue se esconder na base ----
  /** Procurado que dispara o aviso (3 estrelas, ver STAR_HEAT) */
  hideoutTriggerHeat: 40,
  /** O aviso some se o procurado cair abaixo disto (lá ou por advogado) */
  hideoutClearHeat: 30,
  /** 5 estrelas: com helicóptero no ar, a espera no esconderijo multiplica por isto */
  heliHideoutMult: 2,
  /** Tempo escondido antes de poder voltar ao corre */
  hideoutMinutes: 5,
  /** Clube Rockeiro: espera menor e volta sozinho */
  hideoutMinutesVip: 3,
  /** Quanto o procurado cai por segundo enquanto escondido (além do normal) */
  hideoutHeatDecayPerSec: 0.17,
  /** Quem não é VIP e não voltou: a gangue volta sozinha depois disto (para o idle offline não morrer) */
  hideoutAutoResumeMinutes: 20,

  // ---- 4 estrelas: a polícia reconhece o visual (roupa + carro) ----
  lookBurnHeat: 60,
  lookCooldownHours: 8,
  lookCooldownHoursVip: 4,
} as const;
