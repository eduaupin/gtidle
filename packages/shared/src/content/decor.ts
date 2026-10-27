// Decoração do esconderijo: puramente visual (aparece na sala e no card de compartilhar).
// Times são fictícios de propósito: nome e escudo de clube real são marca registrada.
import type { DecorItem, DecorSlot } from '../types';

export const DECOR_SLOTS: { id: DecorSlot; name: string }[] = [
  { id: 'piso', name: 'Piso' },
  { id: 'parede', name: 'Parede' },
  { id: 'cama', name: 'Cama' },
  { id: 'sofa', name: 'Sofá' },
  { id: 'tapete', name: 'Tapete' },
  { id: 'mesa', name: 'Mesa' },
  { id: 'tv', name: 'TV' },
  { id: 'bar', name: 'Bebidas' },
  { id: 'canto', name: 'Canto' },
  { id: 'quadro', name: 'Na parede' },
];

// Móveis com sprite seguem a folha: o que está em GRÁTIS custa grana, o que está em VIP custa diamantes.
const s = (id: string, name: string, slot: DecorSlot, sprite: string, price: { cash?: number; dia?: number; starter?: boolean }, description: string): DecorItem => ({
  id, name, slot, sprite, colors: [], style: 'sprite', description,
  ...(price.cash !== undefined ? { priceCash: price.cash } : {}),
  ...(price.dia !== undefined ? { priceDiamonds: price.dia } : {}),
  ...(price.starter ? { starter: true } : {}),
});

export const DECOR_ITEMS: DecorItem[] = [
  // Piso
  { id: 'piso_cimento', name: 'Cimento queimado', slot: 'piso', starter: true, colors: ['#8c8a84', '#7d7b75'], style: 'plain', description: 'Frio e honesto.' },
  { id: 'piso_taco', name: 'Taco de madeira', slot: 'piso', priceCash: 1500, colors: ['#9a6a3e', '#875a32'], style: 'planks', description: 'Rangendo do jeito certo.' },
  { id: 'piso_xadrez', name: 'Xadrez preto e branco', slot: 'piso', priceCash: 4000, colors: ['#f1efe8', '#1d1f24'], style: 'checker', description: 'Cara de lanchonete dos anos 80.' },
  { id: 'piso_marmore', name: 'Mármore', slot: 'piso', priceDiamonds: 120, colors: ['#e9e6df', '#cfc9bd'], style: 'marble', description: 'Chão de chefão.' },
  // Parede
  { id: 'parede_reboco', name: 'Reboco', slot: 'parede', starter: true, colors: ['#b8ab96'], style: 'plain', description: 'Falta pintar.' },
  { id: 'parede_tijolo', name: 'Tijolinho', slot: 'parede', priceCash: 1000, colors: ['#9b4f36', '#7f3f2b'], style: 'brick', description: 'Estilo galpão.' },
  { id: 'parede_rosa', name: 'Rosa neon anos 80', slot: 'parede', priceCash: 3500, colors: ['#ff6fb5'], style: 'plain', description: 'Combina com pôr do sol na orla.' },
  { id: 'parede_miami', name: 'Verde-água da orla', slot: 'parede', priceCash: 3500, colors: ['#4fd1c5'], style: 'plain', description: 'Clima de cidade de praia.' },
  { id: 'parede_dourada', name: 'Dourado', slot: 'parede', priceDiamonds: 200, colors: ['#d4a73c'], style: 'plain', description: 'Ninguém vai esquecer.' },
  // Cama
  s('cama_simples', 'Cama de casal', 'cama', 'f_bed', { cash: 2500 }, 'Colcha azul e criado-mudo.'),
  s('cama_king', 'Cama king', 'cama', 'f_bed_king', { dia: 220 }, 'Travesseiro de pena e lençol de cetim.'),
  // Sofá
  s('sofa_rasgado', 'Sofá de couro gasto', 'sofa', 'f_sofa', { starter: true }, 'Achado na calçada.'),
  s('sofa_branco', 'Sofá branco', 'sofa', 'f_sofa_white', { cash: 6000 }, 'Proibido sentar sujo.'),
  s('poltronas_azuis', 'Poltronas de veludo', 'sofa', 'f_chairs_blue', { dia: 120 }, 'Duas, para o chefe e o braço direito.'),
  // Tapete
  { id: 'tapete_persa', name: 'Tapete persa', slot: 'tapete', priceCash: 2000, colors: ['#8e2b2b', '#d9a441'], style: 'persian', description: 'Veio de uma carga desviada.' },
  s('tapete_vermelho', 'Tapete vermelho com mesa', 'tapete', 'f_rug_red', { dia: 90 }, 'Tapete de festa e mesa de madeira.'),
  // Mesa
  s('mesa_centro', 'Mesa de centro com som', 'mesa', 'f_coffee_table', { cash: 1500 }, 'Rádio sempre ligado.'),
  s('escrivaninha', 'Escrivaninha com computador', 'mesa', 'f_desk_pc', { cash: 5000 }, 'Onde se planeja o golpe.'),
  s('mesa_sinuca', 'Mesa de sinuca', 'mesa', 'f_pool', { dia: 250 }, 'Quem perde paga a gasolina.'),
  // TV
  s('tv_tubo', 'TV pequena', 'tv', 'e_tv_small', { cash: 800 }, 'Pega três canais.'),
  s('tv_rack', 'TV no rack', 'tv', 'f_tv_stand', { cash: 2500 }, 'Com videogame do lado.'),
  s('tv_telao', 'Telão', 'tv', 'e_tv', { cash: 9000 }, 'Para ver o jogo do seu time.'),
  s('tv_neon', 'Telão neon', 'tv', 'f_tv_neon', { dia: 150 }, 'Imagem que brilha no escuro.'),
  s('tv_gamer', 'Estação gamer', 'tv', 'e_gamer', { dia: 220 }, 'Dois monitores e teclado iluminado.'),
  // Bebidas
  s('bar_isopor', 'Frigobar', 'bar', 'f_fridge_small', { starter: true }, 'Gelo e refrigerante.'),
  s('bar_geladeira', 'Geladeira duplex', 'bar', 'f_fridge', { cash: 2500 }, 'Cabe o churrasco da gangue.'),
  s('bar_balcao', 'Balcão de bar', 'bar', 'f_bar', { dia: 160 }, 'Open bar para a gangue.'),
  // Canto
  s('canto_planta', 'Vaso de planta', 'canto', 'f_plant', { cash: 500 }, 'Precisa de pouca água.'),
  s('canto_palmeira', 'Planta grande', 'canto', 'f_plant_big', { cash: 900 }, 'Clima de orla.'),
  s('canto_som', 'Torre de som', 'canto', 'e_tower', { cash: 3000 }, 'O vizinho que lute.'),
  s('canto_cofre', 'Cofre', 'canto', 'e_safe', { cash: 20000 }, 'Para guardar o que não pode aparecer.'),
  s('canto_tropical', 'Planta tropical', 'canto', 'f_plant_vip', { dia: 60 }, 'Flores laranja o ano todo.'),
  s('canto_som_ouro', 'Caixa de som dourada', 'canto', 'e_speaker_gold', { dia: 90 }, 'Grave que treme o copo.'),
  s('canto_estante', 'Estante dourada', 'canto', 'f_shelf_gold', { dia: 100 }, 'Troféus de procedência duvidosa.'),
  s('canto_neon', 'Torre neon', 'canto', 'f_neon_tower', { dia: 140 }, 'Roxo de balada.'),
  s('canto_fliperama', 'Fliperama', 'canto', 'f_arcade', { dia: 160 }, 'Ficha infinita.'),
  s('canto_cofre_cromado', 'Cofre cromado', 'canto', 'e_safe_big', { dia: 180 }, 'Abre com duas chaves.'),
  // Na parede (times fictícios)
  { id: 'quadro_tricolor', name: 'Bandeira do Tricolor da Orla', slot: 'quadro', priceCash: 1200, colors: ['#c8102e', '#ffffff', '#1d1d1d'], style: 'flag3', description: 'Time fictício do bairro.' },
  { id: 'quadro_rubronegro', name: 'Bandeira do Rubro-Negro do Porto', slot: 'quadro', priceCash: 1200, colors: ['#c8102e', '#111111'], style: 'stripes', description: 'Time fictício do cais.' },
  { id: 'quadro_alvinegro', name: 'Bandeira do Alvinegro do Centro', slot: 'quadro', priceCash: 1200, colors: ['#111111', '#f4f4f4'], style: 'stripes', description: 'Time fictício do centro.' },
  { id: 'quadro_alviverde', name: 'Bandeira do Alviverde da Periferia', slot: 'quadro', priceCash: 1200, colors: ['#1f7a3a', '#f4f4f4'], style: 'flag2', description: 'Time fictício da quebrada.' },
  { id: 'quadro_neon', name: 'Letreiro neon "Aberto 24h"', slot: 'quadro', priceCash: 4000, colors: ['#ff4fb0', '#3fe0ff'], style: 'neon', description: 'O esconderijo nunca fecha.' },
  { id: 'quadro_poster', name: 'Pôster de carro esportivo', slot: 'quadro', priceCash: 900, colors: ['#ffd23f', '#e84a4a'], style: 'poster', description: 'O sonho de todo motorista de fuga.' },
  { id: 'quadro_disco', name: 'Disco de ouro', slot: 'quadro', priceDiamonds: 100, colors: ['#d4a73c', '#1d1d2b'], style: 'disc', description: 'Ninguém sabe de qual música.' },
];

export const STARTER_DECOR = DECOR_ITEMS.filter(d => d.starter).map(d => d.id);
export const DEFAULT_PLACED: Partial<Record<DecorSlot, string>> = {
  piso: 'piso_cimento', parede: 'parede_reboco', sofa: 'sofa_rasgado', bar: 'bar_isopor',
};
