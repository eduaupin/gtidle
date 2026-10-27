// Card de perfil para redes sociais (1080x1350, formato de post do Instagram).
// Desenhado no canvas com a mesma arte do jogo: gangue, carro, esconderijo e números.
import {
  BRAND, DISTRICTS, PROPERTIES, UPGRADE_MAX, UPGRADE_TRACKS, formatCash, isVip, type PlayerState,
} from '@gti/shared';
import { drawCar, drawPerson } from './draw';
import { ROOM_H, ROOM_W, drawRoom } from './room';
import { equippedLook } from './look';
import { spritesReady } from './sprites';

export const SHARE_W = 1080, SHARE_H = 1350;

export async function renderShareCard(p: PlayerState): Promise<HTMLCanvasElement> {
  await document.fonts?.ready;
  await spritesReady;
  const c = document.createElement('canvas');
  c.width = SHARE_W; c.height = SHARE_H;
  const g = c.getContext('2d')!;
  const { outfit, car, outfitItem, carItem, jewelryItem, weaponItem } = equippedLook(p);
  const vip = isVip(p, Date.now());
  const district = DISTRICTS.find(d => d.id === p.district)!;
  const display = (size: number, weight = 800) => `${weight} ${size}px "Barlow Condensed", "Arial Narrow", sans-serif`;
  const body = (size: number, weight = 500) => `${weight} ${size}px Barlow, system-ui, sans-serif`;

  // fundo: asfalto com faixa de rua
  g.fillStyle = '#141a26'; g.fillRect(0, 0, SHARE_W, SHARE_H);
  g.fillStyle = '#4b4f69'; g.fillRect(0, 560, SHARE_W, 250);
  g.fillStyle = 'rgba(235,225,190,.7)';
  for (let x = 20; x < SHARE_W; x += 90) g.fillRect(x, 682, 50, 6);

  // cabeçalho
  g.fillStyle = '#f2a93b'; g.font = display(54); g.textBaseline = 'top';
  g.fillText(BRAND.name.toUpperCase(), 70, 60);
  g.fillStyle = '#ece6da'; g.font = display(120);
  g.fillText(p.nick, 70, 130, SHARE_W - 140);
  g.font = body(36); g.fillStyle = '#8e97a8';
  g.fillText(`${district.name}${vip ? '  ·  ★ Clube Rockeiro' : ''}${p.flags.founder ? '  ·  Fundador' : ''}`, 70, 270);

  // placa de nível
  g.fillStyle = '#f2a93b';
  g.beginPath(); g.roundRect(70, 340, 380, 170, 22); g.fill();
  g.strokeStyle = '#2a1a04'; g.lineWidth = 8; g.beginPath(); g.roundRect(84, 354, 352, 142, 14); g.stroke();
  g.fillStyle = '#2a1a04'; g.font = display(40, 700); g.fillText('NÍVEL', 110, 405);
  g.font = display(118); g.fillText(String(p.level), 240, 366, 180);
  g.font = body(30, 600); g.fillStyle = '#ece6da';
  g.fillText(`Grana ganha: ${formatCash(p.stats.cashEarned)}`, 490, 360);
  g.fillText(`Assaltos: ${p.stats.robberiesDone.toLocaleString('pt-BR')}`, 490, 410);
  const props = PROPERTIES.reduce((s, x) => s + (p.properties[x.id] ?? 0), 0);
  g.fillText(`Imóveis: ${props} níveis`, 490, 460);

  // gangue e carro na rua
  g.save();
  drawCar(g, 760, 690, 0, car, 9);
  for (let m = 0; m < 3; m++) drawPerson(g, 150 + m * 120, 680, Math.PI / 2, outfit, 0, '#2a1d14', 22);
  g.restore();
  g.fillStyle = '#ece6da'; g.font = body(30, 600);
  g.fillText([outfitItem?.name, jewelryItem?.name, weaponItem?.name, carItem?.name].filter(Boolean).join('  +  '), 70, 830, SHARE_W - 140);

  // evolução
  // coluna da esquerda: evolução (nome, pips e nível atual)
  let y = 890;
  for (const t of UPGRADE_TRACKS) {
    const tier = p.upgrades[t.id];
    g.fillStyle = '#ece6da'; g.font = display(38, 700); g.fillText(t.name, 70, y);
    for (let i = 0; i < UPGRADE_MAX; i++) {
      g.fillStyle = i < tier ? '#f2a93b' : '#2f3a4f';
      g.beginPath(); g.roundRect(280 + i * 30, y + 8, 24, 24, 5); g.fill();
    }
    g.fillStyle = '#8e97a8'; g.font = body(24); g.fillText(tier ? t.tiers[tier - 1] : 'nada ainda', 70, y + 46, 440);
    y += 92;
  }

  // coluna da direita: esconderijo
  const rw = 440, rh = rw * ROOM_H / ROOM_W;
  const rx = SHARE_W - rw - 70, ry = 930;
  g.fillStyle = '#8e97a8'; g.font = body(28); g.fillText('O esconderijo', rx, 890);
  g.save();
  g.translate(rx, ry);
  g.fillStyle = '#000'; g.fillRect(-6, -6, rw + 12, rh + 12);
  g.scale(rw / ROOM_W, rh / ROOM_H);
  drawRoom(g, { placed: p.decor.placed, outfit, car, t: 1 });
  g.restore();

  // rodapé
  g.fillStyle = '#f2a93b'; g.fillRect(0, SHARE_H - 110, SHARE_W, 110);
  g.fillStyle = '#2a1a04'; g.font = display(48);
  g.fillText('Monte sua gangue.', 70, SHARE_H - 86);
  g.font = body(32, 700); g.textAlign = 'right';
  g.fillText(location.host || 'grandtradeidle', SHARE_W - 70, SHARE_H - 76);
  g.textAlign = 'left';
  return c;
}

export const shareText = (p: PlayerState) =>
  `Minha gangue no ${BRAND.name}: nível ${p.level} e ${formatCash(p.stats.cashEarned)} no bolso. Monta a sua: ${location.origin}`;
