// Loja. Modelo inspirado no Idle Mafia (assinatura "Clube da Máfia" + pacote de boas-vindas
// + diamantes + skins) e no PokeIdle (VIP com automações, passe, Indique & Ganhe).
// Regra: nada de caixa aleatória paga (ECA Digital, Lei 15.211/2025). Item pago = item escolhido e visível.
import type { AccessoryWear, Currency, DiamondItem, Rarity, RealMoneyProduct, VehicleType, WeaponKind } from '../types';

/** Preço do produto na moeda escolhida. USD para quem paga de fora, BRL no Brasil. */
export const priceIn = (prod: RealMoneyProduct, currency: Currency) =>
  currency === 'USD' ? prod.priceUSD : prod.priceBRL;

export const formatPrice = (amount: number, currency: Currency) =>
  amount.toLocaleString(currency === 'USD' ? 'en-US' : 'pt-BR', { style: 'currency', currency });

export const FOUNDER_DEADLINE = '2026-11-20T02:59:59Z'; // 19/11 23:59 em Brasília

export const REAL_MONEY_PRODUCTS: RealMoneyProduct[] = [
  { id: 'founder_pack', kind: 'pack', name: 'Pacote Fundador', priceBRL: 29.9, priceUSD: 6.99, oneTime: true,
    availableUntil: FOUNDER_DEADLINE, highlight: true,
    description: 'Some da loja quando o 19/11 acabar. Skin Fundador que nunca volta, 30 dias de Clube Rockeiro e 500 diamantes.',
    grants: { vipDays: 30, diamonds: 500, cosmetics: ['skin_fundador', 'moldura_fundador'], founder: true } },
  { id: 'starter_pack', kind: 'pack', name: 'Bem-vindo à Quebrada', priceBRL: 9.9, priceUSD: 1.99, oneTime: true,
    description: 'Compra única. $5.000 para acelerar o começo, 200 diamantes e a "Moto Turbinada".',
    grants: { cash: 5000, diamonds: 200, cosmetics: ['moto_cinquentinha'], starterPack: true } },
  { id: 'vip_monthly', kind: 'vip', name: 'Clube Rockeiro — 30 dias', priceBRL: 14.9, priceUSD: 3.99,
    description: 'Despista a polícia sem anúncio (+50%), esconderijo de 3 min que volta sozinho, advogado automático, +1 assalto simultâneo, +1 linha no galpão, offline 16 h, +15% grana e XP.',
    grants: { vipDays: 30 } },
  { id: 'vip_quarterly', kind: 'vip', name: 'Clube Rockeiro — 90 dias', priceBRL: 34.9, priceUSD: 9.99,
    description: 'O mesmo do mensal, por três meses.', grants: { vipDays: 90 } },
  { id: 'pass_s1', kind: 'pass', name: 'Passe Temporada 1: Contagem Regressiva', priceBRL: 19.9, priceUSD: 4.99,
    description: 'Trilha premium do passe: skins, diamantes e turbos até 19/11.', grants: { battlePassSeason: 1 } },
  { id: 'dia_100', kind: 'diamonds', name: '100 diamantes', priceBRL: 4.9, priceUSD: 0.99, description: '', grants: { diamonds: 100 } },
  { id: 'dia_220', kind: 'diamonds', name: '220 diamantes', priceBRL: 9.9, priceUSD: 1.99, description: '+10% bônus', grants: { diamonds: 220 } },
  { id: 'dia_600', kind: 'diamonds', name: '600 diamantes', priceBRL: 24.9, priceUSD: 4.99, description: '+20% bônus', grants: { diamonds: 600 } },
  { id: 'dia_1300', kind: 'diamonds', name: '1.300 diamantes', priceBRL: 49.9, priceUSD: 9.99, description: '+30% bônus', grants: { diamonds: 1300 } },
  { id: 'dia_2800', kind: 'diamonds', name: '2.800 diamantes', priceBRL: 99.9, priceUSD: 19.99, description: '+40% bônus', grants: { diamonds: 2800 } },
];

/**
 * Visual (roupas, acessórios, armas, carros) e esconderijo, com a arte da folha de sprites.
 * Regra de negócio da folha: o que está em GRÁTIS se compra com grana do jogo (ou já vem no começo);
 * o que está em VIP custa diamantes. Tudo é visual — força vem das trilhas da aba Gangue.
 * Com 4 estrelas a polícia queima roupa e carro em uso, então há opções com grana em todas as faixas.
 */
type Price = { cash?: number; dia?: number; starter?: boolean; exclusive?: boolean };
const priced = (p: Price) => ({
  priceDiamonds: p.dia ?? 0, ...(p.cash !== undefined ? { priceCash: p.cash } : {}),
  ...(p.starter ? { starter: true } : {}), ...(p.exclusive ? { exclusive: true } : {}),
});
const outfit = (id: string, name: string, sprite: string, shirt: string, pants: string, p: Price, description: string, hat?: string): DiamondItem =>
  ({ id, name, kind: 'cosmetic', slot: 'character', sprite, color: shirt, outfit: { shirt, pants, ...(hat ? { hat } : {}) }, description, ...priced(p) });
const car = (id: string, name: string, sprite: string, color: string, vehicleType: VehicleType, p: Price, description: string): DiamondItem =>
  ({ id, name, kind: 'cosmetic', slot: 'vehicle', sprite, color, vehicleType, description, ...priced(p) });
const acc = (id: string, name: string, sprite: string, wear: AccessoryWear, color: string, p: Price, description: string): DiamondItem =>
  ({ id, name, kind: 'cosmetic', slot: 'jewelry', sprite, wear, color, description, ...priced(p),
     jewelry: wear === 'neck' ? { chain: color } : wear === 'hand' ? { watch: color } : {} });
const gun = (id: string, name: string, sprite: string, kind: WeaponKind, color: string, p: Price, description: string): DiamondItem =>
  ({ id, name, kind: 'cosmetic', slot: 'weapon', sprite, color, weapon: { kind, color }, description, ...priced(p) });

const rare = (id: string, name: string, slot: 'character' | 'vehicle' | 'weapon' | 'jewelry', sprite: string, supply: number, description: string, extra: Partial<DiamondItem> = {}): DiamondItem =>
  ({ id, name, kind: 'cosmetic', slot, sprite, priceDiamonds: 0, rare: { supply }, description, color: extra.outfit?.shirt ?? extra.color ?? '#f2c14e', ...extra });

export const DIAMOND_ITEMS: DiamondItem[] = [
  // ---- Roupas (personagens da folha) ----
  outfit('skin_padrao', 'Camiseta Branca', 'pf_00', '#e8e6e0', '#3a5a8c', { starter: true }, 'O de sempre.'),
  outfit('skin_regata', 'Camiseta Verde', 'pf_02', '#4c7a3a', '#2f4a2a', { starter: true }, 'Discreta no meio da praça.'),
  outfit('skin_sem_camisa', 'Sem Camisa', 'pf_06', '#b07a52', '#5a3a2a', { cash: 1200 }, 'Calor de 40 graus.'),
  outfit('skin_agasalho', 'Camiseta Preta e Boné', 'pf_04', '#2b2b2f', '#3a5a8c', { cash: 1500 }, 'Boné vinho virado pra trás.', '#6b2a2a'),
  outfit('skin_capacete', 'Bermuda e Boné Vermelho', 'gf_20', '#b07a52', '#3a5a8c', { cash: 2500 }, 'Chinelo, boné e coragem.', '#c0392b'),
  outfit('skin_jaqueta', 'Camisa e Boné Vermelhos', 'pf_24', '#b8302a', '#3a5a8c', { cash: 4500 }, 'Combinando dos pés à cabeça.', '#c0392b'),
  outfit('skin_motoboy', 'Motoboy', 'gf_00', '#c0392b', '#2b2f3a', { cash: 6000, dia: 50 }, 'Capacete e camisa vermelha.', '#7a7a7a'),
  outfit('skin_florida', 'Camisa Amarela de Capacete', 'gf_02', '#e8a33b', '#3a5a8c', { cash: 9000 }, 'Ninguém para um entregador.', '#e8a33b'),
  outfit('skin_macacao', 'Camisa Verde e Boné Azul', 'gf_13', '#3f8a45', '#2b2f3a', { cash: 14000 }, 'Uniforme do bonde do Porto.', '#2f6fd6'),
  outfit('skin_social', 'Camisa da Gangue', 'gf_21', '#c0392b', '#2b2f3a', { cash: 30000 }, 'Cor de quem manda no bairro.', '#c0392b'),
  outfit('skin_loira', 'Regata e Cabelo Loiro', 'pv_03', '#4a4a3a', '#3a5a8c', { dia: 120 }, 'Estilo surfista da orla.'),
  outfit('skin_terno_branco', 'Colete e Corrente de Ouro', 'gv_04', '#3a3a3f', '#2b2f3a', { dia: 150 }, 'Chefe de esquina.'),
  outfit('skin_jaqueta_vermelha', 'Jaqueta Vermelha', 'gv_23', '#a8302a', '#2b2f3a', { dia: 200 }, 'Couro vermelho de motoqueiro.'),
  outfit('skin_jaqueta_azul', 'Jaqueta Jeans e Gorro', 'gv_22', '#3a4a6a', '#2b2f3a', { dia: 250 }, 'Gorro até no verão.'),
  outfit('skin_bandana', 'Bandana Vermelha', 'gv_01', '#3a2a2a', '#2b2f3a', { dia: 300 }, 'O rosto ninguém vê.', '#c0392b'),
  outfit('skin_neon', 'Colete de Couro e Moicano', 'gv_14', '#2b2b2f', '#2b2f3a', { dia: 400 }, 'O mais temido da Orla.'),
  outfit('skin_fundador', 'Jaqueta do Fundador', 'gv_00', '#2a2420', '#2b2f3a', { exclusive: true }, 'Só quem estava lá antes do 19/11.'),

  // ---- Acessórios (aparecem no personagem) ----
  acc('acc_oculos', 'Óculos Escuros', 'a_shades', 'face', '#1d2026', { cash: 2000 }, 'Ninguém vê para onde você olha.'),
  acc('acc_relogio', 'Relógio de Bolso', 'a_watch', 'hand', '#c9ced3', { cash: 3000 }, 'Pontual para o golpe.'),
  acc('acc_oculos_redondos', 'Óculos Redondos', 'a_round_glasses', 'face', '#2a2d33', { cash: 4500 }, 'Cara de quem estuda o alvo.'),
  acc('acc_colete', 'Colete Tático', 'a_vest', 'torso', '#2b2d33', { cash: 15000 }, 'Visual de quem já viu tiroteio.'),
  acc('acc_oculos_dourados', 'Óculos Dourados', 'a_gold_shades', 'face', '#d4a73c', { dia: 120 }, 'Brilho no rosto.'),
  acc('acc_corrente_ouro', 'Corrente de Ouro', 'a_gold_chain', 'neck', '#f2c14e', { dia: 150 }, 'Grossa como corda de navio.'),
  acc('acc_colete_pesado', 'Colete Pesado', 'a_heavy_vest', 'torso', '#26282e', { dia: 220 }, 'Blindado e intimidador.'),
  acc('acc_pingente', 'Pingente de Diamante', 'a_diamond', 'neck', '#bff3ff', { dia: 300 }, 'Gelo no peito.'),

  // ---- Armas (só visual: quem dá grana extra é o Arsenal, na aba Gangue) ----
  gun('arma_taco', 'Taco de Beisebol', 'w_bat', 'taco', '#a0703f', { cash: 1200 }, 'Para o "esporte".'),
  gun('arma_cassetete', 'Bastão', 'w_club', 'taco', '#a0703f', { cash: 2000 }, 'Conversa curta.'),
  gun('arma_faca', 'Faca', 'w_knife', 'faca', '#d5dbe0', { cash: 2500 }, 'Cabe na meia.'),
  gun('arma_facao', 'Facão', 'w_machete', 'faca', '#c9ced3', { cash: 3500 }, 'Abre caminho no mato.'),
  gun('arma_revolver', 'Revólver Antigo', 'w_revolver', 'pistola', '#5a3a22', { cash: 6000 }, 'Herança do avô.'),
  gun('arma_pistola', 'Pistola', 'w_pistol', 'pistola', '#1d2026', { cash: 8000 }, 'A clássica.'),
  gun('arma_pistola_compacta', 'Pistola Compacta', 'w_pistol2', 'pistola', '#1d2026', { cash: 11000 }, 'Some na cintura.'),
  gun('arma_smg', 'Submetralhadora', 'w_smg', 'smg', '#23262c', { cash: 20000 }, 'Compacta e barulhenta.'),
  gun('arma_uzi', 'Metralhadora de Mão', 'w_uzi', 'smg', '#23262c', { cash: 25000 }, 'Rajada curta.'),
  gun('arma_escopeta', 'Escopeta Serrada', 'w_sawed', 'escopeta', '#5a3a22', { cash: 32000 }, 'Ninguém discute.'),
  gun('arma_fuzil', 'Fuzil', 'w_rifle', 'rifle', '#2b2e33', { cash: 50000 }, 'Para o grande golpe.'),
  gun('arma_carabina', 'Carabina', 'w_carbine', 'rifle', '#2b2e33', { cash: 60000 }, 'Mira e coronha curta.'),
  gun('arma_fuzil_longo', 'Fuzil Longo', 'w_rifle_long', 'rifle', '#2b2e33', { cash: 75000 }, 'Alcança o outro quarteirão.'),
  gun('arma_sniper', 'Rifle de Precisão', 'w_sniper', 'rifle', '#3a4a33', { cash: 90000 }, 'Do telhado.'),
  gun('arma_lancador', 'Lançador', 'w_flamer', 'escopeta', '#4a4f57', { dia: 250 }, 'Pesado e exagerado.'),
  gun('arma_canhao', 'Canhão de Mão', 'w_cannon', 'escopeta', '#a8302a', { dia: 300 }, 'Pintura de corrida.'),
  gun('arma_bazuca', 'Bazuca', 'w_bazooka', 'rifle', '#6b4a2a', { dia: 450 }, 'Só para a foto.'),
  gun('arma_minigun', 'Metralhadora Giratória', 'w_minigun', 'rifle', '#23262c', { dia: 600 }, 'O ápice da ostentação.'),

  // ---- Carros e motos (vista de cima) ----
  car('carro_padrao', 'Sedã Prata', 'car_silver', '#b8c0c8', 'sedan', { starter: true }, 'Anda. Às vezes.'),
  car('carro_branco', 'Sedã Branco', 'car_white', '#e6e6e6', 'sedan', { starter: true }, 'Igual a mil outros na rua.'),
  car('hatch_rebaixado', 'Sedã Vermelho', 'car_red', '#c0392b', 'sedan', { cash: 3000 }, 'Som no talo.'),
  car('picape_cabine', 'Sedã Azul', 'car_blue', '#2f6fd6', 'sedan', { cash: 8000 }, 'Azul de fábrica.'),
  car('van_furgao', 'Sedã Verde', 'car_green', '#3e7d4c', 'sedan', { cash: 16000 }, 'Cor de táxi de interior.'),
  car('sedan_amarelo', 'Sedã Amarelo', 'car_yellow', '#e8b13b', 'sedan', { cash: 24000 }, 'Chama atenção, mas é rápido.'),
  car('sedan_executivo', 'Sedã Executivo Preto', 'car_black', '#2a2c31', 'sedan', { cash: 45000 }, 'Vidro escuro e motorista calado.'),
  car('moto_entrega', 'Moto Vermelha', 'moto_red', '#c0392b', 'moto', { dia: 60 }, 'Some no trânsito.'),
  car('moto_esportiva', 'Moto Preta', 'moto_dark', '#2a2c31', 'moto', { dia: 120 }, 'Sem placa e sem pressa.'),
  car('moto_branca', 'Moto Branca', 'moto_white', '#e6e6e6', 'moto', { dia: 180 }, 'Carenagem de corrida.'),
  car('moto_cinquentinha', 'Moto Turbinada', 'moto_red2', '#e84a4a', 'moto', { exclusive: true }, 'Do pacote Bem-vindo à Quebrada.'),
  car('sedan_vip_vermelho', 'Sedã Esportivo Vermelho', 'vip_red', '#c0392b', 'sport', { dia: 200 }, 'Rodas grandes e teto baixo.'),
  car('esportivo_vermelho', 'Esportivo Vermelho', 'vip_red_sport', '#c0392b', 'sport', { dia: 250 }, 'Curvas de fábrica italiana fictícia.'),
  car('carro_neon', 'Esportivo Laranja', 'vip_orange', '#e07a2c', 'sport', { dia: 300 }, 'Chama a viatura de longe.'),
  car('sedan_vip_preto', 'Sedã Blindado Preto', 'vip_black', '#2a2c31', 'sport', { dia: 350 }, 'Pesado como cofre.'),
  car('esportivo_preto', 'Esportivo Preto Neon', 'vip_black_glow', '#2a2c31', 'sport', { dia: 450 }, 'Luz vermelha por baixo.'),
  car('carro_dourado', 'Esportivo Branco', 'vip_white', '#f2f2f2', 'sport', { dia: 600 }, 'O carro do pôster.'),

  // ---- Raros numerados: só caem em golpes de 5 e 6 estrelas e em planos. Não estão à venda na loja. ----
  rare('rare_rainha', 'Jaqueta da Rainha do Asfalto', 'character', 'pv_00', 300, 'Cabelo comprido e jaqueta de couro.', { outfit: { shirt: '#2a2420', pants: '#2b2f3a' } }),
  rare('rare_cinto', 'Regata do Cinto Dourado', 'character', 'pv_02', 500, 'Fivela que vale um carro.', { outfit: { shirt: '#2b2b2f', pants: '#2b2f3a' } }),
  rare('rare_rosa', 'Regata Rosa da Orla', 'character', 'gv_10', 500, 'Só a gangue da Orla usa.', { outfit: { shirt: '#e86fa0', pants: '#2b2f3a' } }),
  rare('rare_couro', 'Couro Pesado', 'character', 'gv_13', 300, 'Jaqueta que já passou por três tiroteios.', { outfit: { shirt: '#3a3530', pants: '#2b2f3a' } }),
  rare('rare_gorro', 'Jaqueta e Gorro Azul', 'character', 'gv_20', 800, 'Visual de inverno no calor.', { outfit: { shirt: '#2a3550', pants: '#2b2f3a' } }),
  rare('rare_cinza', 'Regata e Gorro Cinza', 'character', 'gv_03', 1000, 'O mais comum entre os raros.', { outfit: { shirt: '#e8e6e0', pants: '#2b2f3a' } }),
  rare('rare_marrom', 'Jaqueta Marrom e Boné', 'character', 'gv_12', 800, 'Boné vermelho de quem manda.', { outfit: { shirt: '#5a3a2a', pants: '#2b2f3a' } }),
  rare('rare_preta', 'Jaqueta Preta Lisa', 'character', 'gv_11', 1000, 'Sem marca, sem pista.', { outfit: { shirt: '#1d1d22', pants: '#2b2f3a' } }),
  rare('rare_sedan_ouro', 'Sedã Preto Faixa Dourada', 'vehicle', 'car_black', 200, 'Duas faixas douradas no capô.', { vehicleType: 'sedan', stripe: '#f2c14e', color: '#2a2c31' }),
  rare('rare_esportivo_corrida', 'Esportivo Branco de Corrida', 'vehicle', 'vip_white', 100, 'Faixas vermelhas de autódromo.', { vehicleType: 'sport', stripe: '#d63a2f', color: '#f2f2f2' }),
  rare('rare_moto_corrida', 'Moto Edição Corrida', 'vehicle', 'moto_red2', 300, 'Faixa branca no tanque.', { vehicleType: 'moto', stripe: '#ffffff', color: '#e84a4a' }),
  rare('rare_pistola_ouro', 'Pistola Dourada de Colecionador', 'weapon', 'w_pistol', 300, 'Banhada a ouro de verdade (dizem).', { tint: '#f2c14e', weapon: { kind: 'pistola', color: '#f2c14e' } }),
  rare('rare_fuzil_ouro', 'Fuzil Dourado', 'weapon', 'w_rifle', 150, 'Peça de museu do crime.', { tint: '#f2c14e', weapon: { kind: 'rifle', color: '#f2c14e' } }),
  rare('rare_taco_cromado', 'Taco Cromado', 'weapon', 'w_bat', 1000, 'Reflete a sirene.', { tint: '#d8e4ee', weapon: { kind: 'taco', color: '#d8e4ee' } }),
  rare('rare_faca_diamante', 'Faca de Diamante', 'weapon', 'w_knife', 500, 'Lâmina azul-gelo.', { tint: '#8fe8ff', weapon: { kind: 'faca', color: '#8fe8ff' } }),
  rare('rare_corrente_rubi', 'Corrente de Rubi', 'jewelry', 'a_gold_chain', 400, 'Ouro com pedras vermelhas.', { tint: '#e0263a', wear: 'neck', jewelry: { chain: '#e0263a' } }),
  rare('rare_oculos_neon', 'Óculos Neon', 'jewelry', 'a_shades', 800, 'Lente rosa de balada.', { tint: '#ff4fb0', wear: 'face' }),

  // ---- Telhado do esconderijo (no mapa) ----
  { id: 'base_padrao', name: 'Barraco', priceDiamonds: 0, kind: 'cosmetic', slot: 'hideout', color: '#8a6f55', starter: true, description: 'Teto e porta.' },
  { id: 'base_cobertura', name: 'Cobertura na Orla', priceDiamonds: 300, kind: 'cosmetic', slot: 'hideout', color: '#ff4fb0', description: 'Telhado rosa com vista para o mar.' },
  { id: 'heli_preto', name: 'Heliponto com Helicóptero Preto', priceDiamonds: 400, kind: 'cosmetic', slot: 'hideout', color: '#3a3f47', sprite: 'heli_black_gold', description: 'Fuga pelo alto, frisos dourados.' },
  { id: 'heli_amarelo', name: 'Heliponto com Helicóptero Amarelo', priceDiamonds: 450, kind: 'cosmetic', slot: 'hideout', color: '#4a4f57', sprite: 'heli_yellow', description: 'Parece de reportagem. Não é.' },
  { id: 'heli_vermelho', name: 'Heliponto com Helicóptero Vermelho', priceDiamonds: 500, kind: 'cosmetic', slot: 'hideout', color: '#5a5f67', sprite: 'heli_red_white', description: 'Branco e vermelho, de executivo.' },
  { id: 'moldura_fundador', name: 'Moldura Fundador', priceDiamonds: 0, kind: 'cosmetic', exclusive: true, description: 'Moldura dourada no perfil e no chat.' },

  // ---- Conveniência (sem poder bruto) ----
  { id: 'sair_cadeia', name: 'Fiança na hora', priceDiamonds: 10, kind: 'utility', description: 'Sai da cadeia agora.' },
  { id: 'rota_fuga', name: 'Rota de fuga', priceDiamonds: 8, kind: 'utility', description: 'Sai do esconderijo agora e volta ao corre.' },
  { id: 'turbo_1h', name: 'Turbo 1 h', priceDiamonds: 20, kind: 'boost', description: 'Assaltos e laboratório 2x mais rápidos por 1 hora.' },
  { id: 'troca_nick', name: 'Trocar apelido', priceDiamonds: 100, kind: 'utility', description: 'Escolhe um nick novo.' },
];

export const STARTER_ITEMS = DIAMOND_ITEMS.filter(i => i.starter).map(i => i.id);

/** Raridade só pela faixa de preço (é um rótulo de vitrine, não sorteio). */
export const RARE_ITEMS = DIAMOND_ITEMS.filter(i => i.rare);

export function rarityOf(i: DiamondItem): Rarity {
  if (i.rare) return i.rare.supply <= 300 ? 'lendario' : 'epico';
  if (i.exclusive || i.priceDiamonds >= 300 || (i.priceCash ?? 0) >= 50_000) return 'lendario';
  if (i.priceDiamonds >= 100 || (i.priceCash ?? 0) >= 15_000) return 'epico';
  if (i.priceDiamonds > 0 || (i.priceCash ?? 0) >= 4_000) return 'raro';
  return 'comum';
}
export const RARITY_NAME: Record<Rarity, string> = { comum: 'Comum', raro: 'Raro', epico: 'Épico', lendario: 'Lendário' };
