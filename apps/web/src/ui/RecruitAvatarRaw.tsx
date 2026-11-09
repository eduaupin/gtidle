import { THUGS, drawSpriteFit } from '../game/sprites';
import { DrawCanvas } from './Preview';

/** Retrato a partir do índice de sprite e cor (lutadores de replay, NPCs) */
export function RecruitAvatarRaw({ sprite, tint, size = 40 }: { sprite: number; tint?: string; size?: number }) {
  const name = THUGS[sprite % Math.max(1, THUGS.length)];
  return (
    <DrawCanvas w={size} h={size} deps={[sprite, tint, size]} className="avatar" draw={g => {
      g.fillStyle = '#18202d'; g.fillRect(0, 0, size, size);
      if (name) drawSpriteFit(g, name, size / 2, size - 1, size * 0.9, size * 0.92, false, tint);
    }} />
  );
}
