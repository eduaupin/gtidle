// Tipos compartilhados entre servidor e cliente.
// Tudo que é "regra do jogo" vive no servidor; o cliente só exibe.

export type DistrictId =
  | 'periferia' | 'porto' | 'aeroporto' | 'centro' | 'pantano' | 'autodromo' | 'orla' | 'lagoa'
  | 'vila_norte' | 'porto_oeste' | 'marina' | 'mata' | 'ilhotas' | 'ilha_sol' | 'mansoes' | 'farol';

/** Tipo de cenário que a cidade do distrito gera */
export type Terrain = 'city' | 'beach' | 'port' | 'airport' | 'swamp' | 'rural' | 'forest' | 'island';
export type DrugId = 'folha' | 'po_neon' | 'cristal';

export interface District {
  id: DistrictId;
  name: string;
  minLevel: number;
  /** Multiplicador do preço de venda no varejo neste distrito */
  streetPriceMult: number;
  /** Cor de base do bairro no mapa (tema visual) */
  palette: { ground: string; roof: string; accent: string };
  description: string;
  terrain: Terrain;
  /** Posição no mapa do estado (0..100 de largura, 0..160 de altura, norte para cima) */
  map: { x: number; y: number };
}

export interface RobberyJob {
  id: string;
  name: string;
  district: DistrictId;
  minLevel: number;
  durationSec: number;
  cash: [number, number];
  xp: number;
  /** Quanto de "procurado" (0–100) cada execução soma */
  heat: number;
  /** Teto de estrelas deste golpe: golpe pequeno só chama policial a pé, golpe grande chama SWAT e helicóptero */
  maxStars: number;
  /** Ícone de prédio desenhado no mapa */
  building: 'banca' | 'loja' | 'posto' | 'garagem' | 'porto' | 'joalheria' | 'banco' | 'rua';
}

export interface Drug {
  id: DrugId;
  name: string;
  minLevel: number;
  /** Custo de 1 lote de insumo */
  supplyCost: number;
  /** Tempo para o laboratório refinar 1 lote */
  refineSec: number;
  /** Unidades produzidas por lote */
  batchYield: number;
  /** Preço base de venda por unidade */
  basePrice: number;
  /** Procurado gerado por unidade vendida */
  heatPerUnit: number;
  color: string;
}

export interface Property {
  id: string;
  name: string;
  minLevel: number;
  baseCost: number;
  /** Renda passiva por segundo no nível 1 (cresce linear com o nível) */
  incomePerSec: number;
  maxLevel: number;
}

/** Como o assalto está rendendo: normal, fraco (ignorou a polícia) ou com bônus (VIP despistou). */
export type RobberyMode = 'normal' | 'weak' | 'boosted';

export interface RobberySlot {
  jobId: string | null;
  progressSec: number;
  /** Golpe de plano: roda uma vez só e libera o espaço */
  once?: boolean;
  mode?: RobberyMode;
  /** Até quando vale o bônus do modo 'boosted' */
  boostUntil?: number;
}

/** Evento "seu roubo está sendo monitorado" */
export interface HeatAlert {
  id: string;
  slot: number;
  jobId: string;
  createdAt: number;
  /** Prazo para despistar antes de o golpe ficar fraco */
  expiresAt: number;
  /** pending = dentro do prazo; missed = prazo passou, golpe fraco até despistar */
  status: 'pending' | 'missed';
  /** Já mandou a notificação push? */
  notified: boolean;
}

export interface LabLine {
  drugId: DrugId | null;
  progressSec: number;
  /** Já consumiu o insumo do lote atual? */
  loaded: boolean;
}

export interface PlayerState {
  id: string;
  nick: string;
  createdAt: number;
  level: number;
  xp: number;
  cash: number;
  /** Diamantes comprados (negociáveis no futuro) */
  diamondsPaid: number;
  /** Diamantes ganhos jogando (presos à conta) */
  diamondsEarned: number;
  heat: number;
  jailedUntil: number | null;
  district: DistrictId;
  lastTick: number;
  vipUntil: number | null;
  turboUntil: number | null;
  flags: { founder: boolean; starterPack: boolean; battlePassSeason: number | null };
  robberies: RobberySlot[];
  lab: { level: number; lines: LabLine[] };
  supplies: Record<DrugId, number>;
  product: Record<DrugId, number>;
  dealing: { points: number; drugId: DrugId | null; sellProgress: number };
  properties: Record<string, number>;
  cosmetics: string[];
  /** jewelry e weapon podem ficar vazios (null) */
  equipped: { character: string; vehicle: string; hideout: string; jewelry: string | null; weapon: string | null };
  stats: {
    robberiesDone: number; unitsSold: number; timesJailed: number; cashEarned: number;
    batchesDone: number; lawyerUses: number;
    /** Quantas vezes cada assalto foi concluído */
    jobCounts: Record<string, number>;
    biggestHeist?: number; raresFound?: number; laundered?: number; teamHeists?: number;
    raceBest?: number; racesRun?: number; territoriesWon?: number; giftsSent?: number;
  };
  /** Índice da missão atual na cadeia MISSIONS */
  missionIndex: number;
  /** Já viu a introdução do jogo */
  seenIntro: boolean;
  /** Alerta de polícia em andamento, se houver */
  alert: HeatAlert | null;
  /** Quando o próximo alerta vai aparecer (sorteado pelo servidor) */
  nextAlertAt: number | null;
  /** Aviso de 3 estrelas: a polícia está fechando o cerco */
  heatWarning: { at: number; notified: boolean } | null;
  /** Gangue escondida na base: sem roubar até `until`, procurado esfriando rápido */
  hideout: {
    since: number; until: number;
    /** Assaltos que estavam rodando, para retomar depois */
    resume: (string | null)[];
    /** Já avisou (push) que pode voltar ao corre? */
    readyNotified: boolean;
  } | null;
  /** Itens de visual queimados pela polícia: id → até quando não podem ser usados */
  burned: Record<string, number>;
  /** Aviso de visual queimado em aberto (até trocar de roupa e carro) */
  lookBurn: { at: number; notified: boolean } | null;
  /** Nível de cada trilha de evolução (0 = nada) */
  upgrades: Record<UpgradeTrack, number>;
  /** Decoração do esconderijo */
  decor: { owned: string[]; placed: Partial<Record<DecorSlot, string>> };
  /** Anúncios recompensados assistidos hoje (limite diário anti-abuso) */
  ads: { day: string; count: number };
  /** Itens que caem nos assaltos e podem ser vendidos no mercado */
  inventory: Inventory;
  /** Grana suja: vem dos golpes de 4 estrelas para cima; os negócios lavam aos poucos */
  dirtyCash: number;
  /** Seguro contra prisão (uso único, vale até `until`) */
  insurance: { until: number } | null;
  /** Oficina: opções compradas e o que está em cada carro */
  tuning: { owned: string[]; cars: Record<string, Partial<Record<'paint' | 'neon' | 'wheels', string>>> };
  /** Bonde (grupo de jogadores) */
  crewId: string | null;
  /** Avisos do jogo: presentes, golpe em equipe, territórios */
  inbox: { id: string; at: number; text: string; read: boolean }[];
  /** Convite: código próprio, quem convidou e quantos amigos já renderam recompensa */
  referral: { code: string; by: string | null; rewarded: number; paidOut: boolean };
  /** Corrida de rua: corridas premiadas hoje */
  race: { day: string; runs: number };
  /** Mercado: saldo de vendas (sacável no futuro) e vaga extra ganha com anúncio */
  market: { balance: number; adSlotUntil: number | null; sold: number; bought: number };
  rngSeed: number;
}

export type PartId = 'peca_arsenal' | 'peca_oficina' | 'peca_equipamento';

/** Um item raro numerado: o número de série é único no jogo inteiro */
export interface RareInstance { uid: string; itemId: string; serial: number }

export interface Inventory {
  parts: Record<PartId, number>;
  plans: Record<string, number>;
  rares: RareInstance[];
}

/** Plano de golpe: consumível que libera um golpe especial uma vez */
export interface HeistPlan extends RobberyJob {
  planName: string;
  /** Chance de cair um item raro ao terminar */
  rareChance: number;
  description: string;
}

export interface MissionReward { cash?: number; diamonds?: number; xp?: number }

export interface Mission {
  id: string;
  title: string;
  /** O que fazer, em uma frase */
  task: string;
  /** Por que importa — ensina o próximo sistema */
  why: string;
  /** Aba do jogo onde se faz a missão */
  tab: 'assaltos' | 'lab' | 'imoveis' | 'loja' | 'visual';
  reward: MissionReward;
  /** [atual, meta] */
  progress: (p: PlayerState) => [number, number];
}

export type Currency = 'BRL' | 'USD';

export type ShopProductKind = 'vip' | 'pack' | 'diamonds' | 'pass';

export interface RealMoneyProduct {
  id: string;
  kind: ShopProductKind;
  name: string;
  priceBRL: number;
  priceUSD: number;
  description: string;
  oneTime?: boolean;
  /** ISO — some da loja depois disso */
  availableUntil?: string;
  grants: Grant;
  highlight?: boolean;
}

export interface Grant {
  vipDays?: number;
  diamonds?: number;
  cash?: number;
  cosmetics?: string[];
  founder?: boolean;
  starterPack?: boolean;
  battlePassSeason?: number;
}

export type CosmeticSlot = 'character' | 'vehicle' | 'hideout' | 'jewelry' | 'weapon';

export type WeaponKind = 'taco' | 'soco' | 'faca' | 'pistola' | 'smg' | 'escopeta' | 'rifle';
export type Rarity = 'comum' | 'raro' | 'epico' | 'lendario';
/** Onde o acessório aparece no personagem */
export type AccessoryWear = 'face' | 'neck' | 'torso' | 'hand';

export type VehicleType = 'sedan' | 'hatch' | 'sport' | 'moto' | 'picape' | 'van';

export interface DiamondItem {
  id: string;
  name: string;
  /** Preço em diamantes (0 = não se compra com diamantes) */
  priceDiamonds: number;
  /** Preço em grana do jogo (ausente = não se compra com grana) */
  priceCash?: number;
  kind: 'cosmetic' | 'boost' | 'utility';
  slot?: CosmeticSlot;
  /** Para cosméticos: cor principal usada no mapa */
  color?: string;
  /** Roupas: cores de camisa, calça e boné */
  outfit?: { shirt: string; pants: string; hat?: string; shoes?: string; glasses?: string };
  /** Joias: cores da corrente, do relógio e dos anéis */
  jewelry?: { chain?: string; watch?: string; rings?: string };
  /** Arma (só visual): formato e cores */
  weapon?: { kind: WeaponKind; color: string; accent?: string };
  /** Carros: formato desenhado no mapa */
  vehicleType?: VehicleType;
  /** Nome do sprite no atlas (apps/web/src/assets/sprites) */
  sprite?: string;
  /** Acessórios: onde aparece no personagem */
  wear?: AccessoryWear;
  /** Item raro: só cai em golpes grandes, tem tiragem limitada e número de série */
  rare?: { supply: number };
  /** Raros: cor aplicada por cima do sprite (edição dourada, cromada...) */
  tint?: string;
  /** Raros (carros): cor das faixas de corrida */
  stripe?: string;
  description: string;
  exclusive?: boolean;
  /** Todo jogador já começa com este item */
  starter?: boolean;
}

export type UpgradeTrack = 'arsenal' | 'oficina' | 'equipamento';

export type DecorSlot = 'piso' | 'parede' | 'cama' | 'sofa' | 'tapete' | 'mesa' | 'tv' | 'bar' | 'canto' | 'quadro';

export interface DecorItem {
  id: string;
  name: string;
  slot: DecorSlot;
  priceCash?: number;
  priceDiamonds?: number;
  starter?: boolean;
  /** Cores usadas no desenho da sala */
  colors: string[];
  /** Variação de desenho dentro do slot (itens sem sprite) */
  style: string;
  /** Nome do sprite no atlas, quando o item usa a arte da folha */
  sprite?: string;
  description: string;
}

export type GameEvent =
  | { type: 'robbery_done'; jobId: string; cash: number; xp: number; dirty?: boolean }
  | { type: 'level_up'; level: number }
  | { type: 'jailed'; until: number }
  | { type: 'released' }
  | { type: 'batch_done'; drugId: DrugId; units: number }
  | { type: 'sold'; drugId: DrugId; units: number; cash: number }
  | { type: 'alert'; jobId: string; expiresAt: number }
  | { type: 'alert_missed'; jobId: string }
  | { type: 'alert_resolved'; jobId: string; mode: RobberyMode }
  | { type: 'heat_warning' }
  | { type: 'look_burned'; items: string[]; until: number }
  | { type: 'hideout_start'; until: number }
  | { type: 'hideout_ready' }
  | { type: 'hideout_done'; auto: boolean }
  | { type: 'drop'; kind: 'part' | 'plan' | 'rare'; id: string; qty: number; serial?: number }
  | { type: 'laundered'; amount: number }
  | { type: 'confiscated'; amount: number; insured: boolean };

export type Action =
  | { type: 'startRobbery'; slot: number; jobId: string }
  | { type: 'stopRobbery'; slot: number }
  | { type: 'buySupply'; drugId: DrugId; qty: number }
  | { type: 'setLabLine'; line: number; drugId: DrugId | null }
  | { type: 'upgradeLab' }
  | { type: 'buyDealingPoint' }
  | { type: 'setDealingDrug'; drugId: DrugId | null }
  | { type: 'buyProperty'; propertyId: string }
  | { type: 'payLawyer' }
  | { type: 'travel'; district: DistrictId }
  | { type: 'buyDiamondItem'; itemId: string }
  | { type: 'equip'; itemId: string }
  | { type: 'claimMission' }
  /** Só VIP: despista sem anúncio e ganha bônus. Quem não é VIP despista pela rota de anúncio. */
  | { type: 'resolveAlertVip' }
  | { type: 'dismissIntro' }
  | { type: 'buyCosmetic'; itemId: string; pay: 'cash' | 'diamonds' }
  | { type: 'buyUpgrade'; track: UpgradeTrack }
  | { type: 'buyDecor'; itemId: string; pay: 'cash' | 'diamonds' }
  | { type: 'placeDecor'; slot: DecorSlot; itemId: string | null }
  | { type: 'goHideout' }
  | { type: 'startPlan'; planId: string }
  | { type: 'launderNow'; amount: number }
  | { type: 'buyInsurance' }
  | { type: 'buyTuning'; optionId: string; pay: 'cash' | 'diamonds' }
  | { type: 'setTuning'; slot: 'paint' | 'neon' | 'wheels'; optionId: string | null }
  | { type: 'leaveHideout' };
