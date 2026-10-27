"""Recorta a folha de sprites (tools/sprites-source.png) e gera o atlas usado pelo jogo.

Uso:  python3 tools/build_atlas.py
Saída: apps/web/src/assets/sprites/atlas.png + atlas.json  ({rects: {nome: [x, y, w, h]}, groups: {...}})

A folha tem fundo escuro (não transparente). Cada sprite é recortado por uma caixa e o fundo é
removido comparando com a cor da borda da caixa. Pessoas são lidas em grade.
A separação GRÁTIS / VIP da folha vira regra de preço no jogo (grana do jogo / diamantes),
definida em packages/shared/src/content/shop.ts e decor.ts.
"""
import json, os
import numpy as np, cv2
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'tools', 'sprites-source.png')
OUT = os.path.join(ROOT, 'apps', 'web', 'src', 'assets', 'sprites')

IM = np.array(Image.open(SRC).convert('RGB'))
I = IM.astype(int)
LUM = I.mean(2)
SAT = I.max(2) - I.min(2)
small = cv2.resize(IM, (IM.shape[1] // 4, IM.shape[0] // 4), interpolation=cv2.INTER_AREA)
BG = cv2.resize(cv2.medianBlur(small, 15), (IM.shape[1], IM.shape[0]), interpolation=cv2.INTER_LINEAR).astype(int)
D = np.abs(I - BG).max(2)
GLOBAL = (LUM < 19) | (D > 12) | (SAT > 30)
GLOBAL = nd.binary_opening(nd.binary_fill_holes(nd.binary_closing(GLOBAL, iterations=1)), iterations=1)


def keep_big(m, frac=0.12):
    lab, n = nd.label(m)
    if n == 0:
        return m
    sizes = nd.sum(m, lab, range(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= sizes.max() * frac
    return keep[lab]


def cut(box, mode='mask', pad=2, frac=0.12):
    x0, y0, x1, y1 = box
    x0, y0, x1, y1 = max(0, x0 - pad), max(0, y0 - pad), min(IM.shape[1], x1 + pad), min(IM.shape[0], y1 + pad)
    reg = I[y0:y1, x0:x1]
    if mode == 'mask':
        m = GLOBAL[y0:y1, x0:x1].copy()
    elif mode == 'veh':  # carros sobre o "asfalto" escuro do painel de veículos
        lum, sat = LUM[y0:y1, x0:x1], SAT[y0:y1, x0:x1]
        m = (lum < 19) | (lum > 44) | (sat > 25)
        m = nd.binary_opening(nd.binary_fill_holes(nd.binary_closing(m, iterations=1)), iterations=2)
    else:  # 'local': fundo = mediana da borda da caixa (piso da mobília, sombras)
        border = np.concatenate([reg[0], reg[-1], reg[:, 0], reg[:, -1]])
        bc = np.median(border, 0)
        d = np.abs(reg - bc).max(2)
        lum = reg.mean(2)
        m = (d > 16) | (lum < bc.mean() - 12)
        m = nd.binary_opening(nd.binary_fill_holes(nd.binary_closing(m, iterations=1)), iterations=1)
    m = keep_big(m, frac)
    ys, xs = np.nonzero(m)
    if len(xs) == 0:
        raise ValueError(f'vazio: {box}')
    a, b, c, d2 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    rgba = np.zeros((b - a, d2 - c, 4), np.uint8)
    rgba[..., :3] = IM[y0 + a:y0 + b, x0 + c:x0 + d2]
    rgba[..., 3] = np.where(m[a:b, c:d2], 255, 0)
    return Image.fromarray(rgba, 'RGBA')


crops = {}

# ---------------- pessoas (grade) ----------------
ROWS = [(34, 95), (93, 155), (154, 224)]
PANELS = {
    'pf': [41, 88, 132, 180, 226, 270, 316],     # personagens GRÁTIS
    'pv': [370, 411, 452, 492, 534, 578],        # personagens VIP
    'cop': [642, 683, 724, 766],                 # polícia GRÁTIS
    'swat': [828, 882, 936],                     # polícia VIP (SWAT)
    'gf': [1012, 1056, 1098, 1141, 1184, 1230],  # gangues GRÁTIS
    'gv': [1298, 1348, 1401, 1452, 1496],        # gangues VIP
}
groups = {}
for key, cols in PANELS.items():
    groups[key] = []
    for r, (top, bot) in enumerate(ROWS):
        for c, cx in enumerate(cols):
            name = f'{key}_{r}{c}'
            # células logo abaixo das etiquetas GRÁTIS/VIP pegam a sombra da etiqueta: começa um pouco mais baixo
            under_label = r == 0 and (key, c) in {('pv', 0), ('gv', 0), ('gf', 3)}
            box = (cx - 22, top + (5 if under_label else 0), cx + 22, bot)
            crops[name] = cut(box, 'mask', pad=0, frac=0.3)
            groups[key].append(name)

# ---------------- veículos (vista de cima: frente para cima) ----------------
VEH = {
    'car_white': (20, 271, 72, 377), 'car_silver': (79, 270, 124, 367), 'car_red': (139, 268, 187, 372),
    'car_blue': (203, 267, 250, 374), 'car_green': (267, 268, 313, 373), 'car_yellow': (329, 268, 379, 374),
    'car_black': (393, 269, 441, 373),
    'vip_red_sport': (469, 271, 518, 378), 'vip_black_glow': (532, 271, 573, 372), 'vip_orange': (589, 271, 638, 368),
    'vip_red': (652, 270, 703, 375), 'vip_white': (714, 271, 771, 371), 'vip_black': (781, 271, 830, 373),
    'moto_red': (855, 268, 886, 335), 'moto_dark': (898, 268, 930, 335), 'moto_red2': (853, 347, 884, 411), 'moto_white': (898, 346, 930, 417),
}
for k, b in VEH.items():
    crops[k] = cut(b, 'veh', pad=0)

# ---------------- helicópteros ----------------
for k, b in {'heli_police': (962, 276, 1044, 366), 'heli_black_gold': (1188, 274, 1277, 370),
             'heli_red_white': (1297, 272, 1417, 371), 'heli_yellow': (1418, 273, 1524, 371)}.items():
    crops[k] = cut(b, 'mask', frac=0.05)

# ---------------- armas, acessórios, ícones e efeitos (fundo liso) ----------------
SIMPLE = {
    'w_pistol': (25, 490, 64, 518), 'w_pistol2': (79, 491, 117, 517), 'w_revolver': (132, 495, 184, 517),
    'w_rifle': (199, 489, 268, 520), 'w_rifle_long': (283, 487, 382, 522), 'w_smg': (26, 536, 74, 570),
    'w_uzi': (89, 531, 130, 570), 'w_sawed': (144, 537, 194, 562), 'w_carbine': (209, 531, 263, 572),
    'w_sniper': (278, 533, 385, 571), 'w_bat': (158, 579, 168, 619), 'w_knife': (191, 583, 200, 617),
    'w_machete': (215, 585, 234, 617), 'w_club': (251, 582, 261, 618),
    'w_bazooka': (405, 492, 533, 530), 'w_minigun': (409, 540, 538, 573), 'w_flamer': (487, 586, 537, 617), 'w_cannon': (546, 493, 597, 522),
    'a_watch': (785, 489, 806, 515), 'a_shades': (817, 531, 842, 545), 'a_round_glasses': (781, 530, 805, 545),
    'a_vest': (818, 488, 843, 518), 'a_gold_chain': (949, 535, 972, 561), 'a_diamond': (904, 530, 936, 561),
    'a_gold_shades': (948, 574, 974, 591), 'a_heavy_vest': (990, 484, 1023, 523),
    'i_cash': (625, 935, 641, 959), 'i_xp': (652, 939, 674, 955), 'i_heart': (684, 938, 704, 957), 'i_shield': (713, 938, 730, 958),
    'i_star': (739, 938, 757, 957), 'i_diamond': (905, 937, 927, 957), 'i_crown': (967, 937, 990, 959), 'i_house': (873, 935, 896, 958),
    'i_lab': (623, 973, 646, 999), 'i_car': (658, 973, 689, 1001), 'i_badge': (749, 971, 777, 1002), 'i_skull': (807, 972, 831, 1000),
    'i_gem_badge': (843, 974, 866, 998), 'i_trophy': (942, 972, 969, 1000), 'i_vip': (980, 975, 1010, 998), 'i_glass': (842, 936, 864, 958),
    'fx_smoke_0': (19, 978, 45, 1002), 'fx_smoke_1': (59, 978, 80, 1000), 'fx_flash': (61, 942, 82, 955), 'fx_flash_long': (17, 938, 53, 961),
    'fx_boom': (178, 938, 204, 966), 'fx_boom_big': (524, 931, 570, 981),
}
for k, b in SIMPLE.items():
    crops[k] = cut(b, 'mask', pad=1, frac=0.2)

# ---------------- mobília, eletrônicos e objetos de rua (sobre piso / sombra) ----------------
LOCAL = {
    # mobília GRÁTIS
    'f_bed': (36, 683, 88, 770), 'f_fridge_small': (112, 674, 139, 710), 'f_fridge': (178, 674, 205, 727),
    'f_dresser': (207, 682, 254, 723), 'f_stove': (256, 672, 285, 727), 'f_tv_stand': (294, 682, 336, 719),
    'f_desk_pc': (113, 720, 164, 768), 'f_sofa_white': (201, 732, 273, 775), 'f_plant_big': (289, 733, 338, 793),
    'f_sofa': (20, 778, 118, 826), 'f_cabinet': (135, 777, 164, 826), 'f_side_table': (172, 796, 194, 826),
    'f_coffee_table': (214, 784, 268, 826), 'f_toilet': (30, 832, 59, 877), 'f_plant': (68, 836, 105, 880),
    'f_sink': (116, 832, 167, 880), 'f_washer': (180, 835, 207, 880), 'f_tv_cabinet': (220, 834, 263, 880),
    # mobília VIP
    'f_bed_king': (383, 678, 455, 766), 'f_rug_red': (484, 708, 562, 802), 'f_tv_neon': (615, 674, 702, 737),
    'f_shelf_gold': (581, 671, 611, 737), 'f_pool': (608, 744, 700, 809), 'f_arcade_gold': (581, 746, 602, 799),
    'f_plant_vip': (360, 782, 398, 829), 'f_chairs_blue': (404, 787, 451, 820), 'f_plant_small': (454, 787, 483, 820),
    'f_arcade': (493, 807, 527, 872), 'f_bar': (536, 807, 603, 865), 'f_tv_media': (410, 823, 483, 881),
    'f_console_neon': (613, 820, 676, 876), 'f_neon_tower': (681, 820, 702, 876),
    # eletrônicos
    'e_tv': (730, 698, 802, 755), 'e_tv_stand': (815, 673, 892, 728), 'e_laptop': (827, 732, 882, 783),
    'e_tv_small': (758, 763, 808, 808), 'e_tower': (730, 757, 756, 825), 'e_safe': (813, 831, 849, 883),
    'e_safe2': (859, 831, 894, 883), 'e_monitor': (770, 835, 803, 869),
    'e_gamer': (919, 680, 1006, 775), 'e_speaker': (1017, 724, 1042, 763), 'e_speaker_gold': (1049, 724, 1076, 763),
    'e_console': (1016, 677, 1079, 719), 'e_boombox': (919, 777, 1006, 827), 'e_safe_big': (1027, 770, 1075, 828),
    # objetos de cidade
    'o_cone': (1111, 676, 1137, 709), 'o_cone2': (1145, 675, 1171, 709), 'o_barrier': (1180, 676, 1232, 709),
    'o_manhole': (1244, 677, 1278, 710), 'o_atm': (1286, 685, 1312, 757), 'o_news_red': (1112, 716, 1140, 775),
    'o_news_blue': (1153, 716, 1183, 775), 'o_trash_tall': (1195, 715, 1224, 777), 'o_block': (1236, 715, 1276, 757),
    'o_bench': (1112, 784, 1184, 829), 'o_bag': (1193, 783, 1228, 825), 'o_crate': (1235, 763, 1279, 824),
    'o_cone3': (1283, 790, 1312, 827), 'o_trash_yellow': (1108, 840, 1133, 883), 'o_fence': (1187, 833, 1238, 885),
    'o_dumpster': (1243, 832, 1312, 884),
    'o_bus_stop': (1330, 681, 1417, 759), 'o_lamp': (1427, 677, 1444, 760), 'o_barrier_vip': (1457, 677, 1518, 710),
    'o_tree': (1444, 713, 1484, 759), 'o_lamp_small': (1491, 713, 1513, 747), 'o_bench_vip': (1330, 766, 1375, 810),
    'o_box_yellow': (1383, 767, 1410, 810), 'o_planter': (1421, 766, 1484, 809), 'o_lamp2': (1491, 752, 1513, 839),
    'o_phone': (1331, 818, 1364, 885), 'o_phone2': (1371, 823, 1400, 885), 'o_planter_small': (1479, 843, 1521, 886),
}
for k, b in LOCAL.items():
    crops[k] = cut(b, 'local', pad=0, frac=0.15)

# ---------------- empacota ----------------
PAD = 2
W = 1024
x = y = shelf = 0
rects = {}
for name, c in sorted(crops.items(), key=lambda kv: -kv[1].height):
    if x + c.width + PAD > W:
        x, y, shelf = 0, y + shelf + PAD, 0
    rects[name] = [x, y, c.width, c.height]
    x += c.width + PAD
    shelf = max(shelf, c.height)
atlas = Image.new('RGBA', (W, y + shelf), (0, 0, 0, 0))
for name, c in crops.items():
    atlas.paste(c, tuple(rects[name][:2]))
os.makedirs(OUT, exist_ok=True)
atlas.save(os.path.join(OUT, 'atlas.png'), optimize=True)
json.dump({'rects': rects, 'groups': groups}, open(os.path.join(OUT, 'atlas.json'), 'w'))
print(f'{len(rects)} sprites, atlas {atlas.size}')
