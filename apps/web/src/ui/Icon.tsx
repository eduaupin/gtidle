import { ATLAS_SIZE, ATLAS_URL, spriteRect } from '../game/sprites';

/** Ícone da folha de sprites (pixel art), recortado do atlas por CSS. Tamanho em rem. */
export default function Icon({ name, size = 1.2, title }: { name: string; size?: number; title?: string }) {
  const r = spriteRect(name);
  if (!r) return null;
  const [x, y, w, h] = r;
  const k = size / Math.max(w, h);
  return (
    <span
      className="icon"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      style={{
        width: `${w * k}rem`, height: `${h * k}rem`,
        backgroundImage: `url(${ATLAS_URL})`,
        backgroundPosition: `${-x * k}rem ${-y * k}rem`,
        backgroundSize: `${ATLAS_SIZE.w * k}rem ${ATLAS_SIZE.h * k}rem`,
      }}
    />
  );
}
