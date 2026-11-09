// Peças visuais dos capangas: retrato, etiqueta de especialidade e linha de atributos.
import { RARITY_NAME, SPECS, powerClass, recruitStats, recruitXpToNext, speciesById, type Recruit } from '@gti/shared';
import { THUGS, drawSpriteFit } from '../game/sprites';
import { DrawCanvas } from './Preview';

export function RecruitAvatar({ speciesId, lenda = false, size = 56, silhouette = false }: { speciesId: string; lenda?: boolean; size?: number; silhouette?: boolean }) {
  const s = speciesById(speciesId);
  const name = s ? THUGS[s.sprite % Math.max(1, THUGS.length)] : undefined;
  return (
    <DrawCanvas w={size} h={size} deps={[speciesId, lenda, size, silhouette]} className={`avatar r-${s?.rarity ?? 'comum'} ${lenda ? 'lenda' : ''}`} label={s?.name ?? 'Capanga'}
      draw={g => {
        g.fillStyle = lenda ? '#3a2b10' : '#18202d'; g.fillRect(0, 0, size, size);
        if (!name) return;
        drawSpriteFit(g, name, size / 2, size - 2, size * 0.9, size * 0.92, false, silhouette ? '#05070b' : lenda ? '#f2c14e' : s?.tint);
        if (silhouette) { g.fillStyle = 'rgba(5,7,11,.55)'; g.fillRect(0, 0, size, size); }
      }} />
  );
}

export function SpecTag({ spec }: { spec: string }) {
  const s = SPECS.find(x => x.id === spec);
  return <span className="spec-tag" style={{ ['--spec' as string]: s?.color ?? '#888' }}>{s?.name ?? spec}</span>;
}

export function RecruitLine({ r, specBonus = 0 }: { r: Recruit; specBonus?: number }) {
  const s = speciesById(r.speciesId)!;
  const st = recruitStats(r, specBonus);
  const need = recruitXpToNext(r.level);
  const pw = powerClass(r.ivs);
  return (
    <div className="recruit-line">
      <RecruitAvatar speciesId={r.speciesId} lenda={r.lenda} size={52} />
      <div className="recruit-info">
        <div className="recruit-name">
          <strong>{s.name}</strong>
          {r.lenda && <span className="badge lenda-badge">Lenda da Rua</span>}
        </div>
        <div className="recruit-meta">
          <SpecTag spec={s.spec} />
          <span>Nv {r.level}</span>
          <span className={`pclass p${pw}`} title="Potência pelos atributos individuais">P{pw}</span>
          <span className="muted">{RARITY_NAME[s.rarity]}</span>
        </div>
        <div className="stat-mini" aria-label="Atributos">
          <span title="Vida">♥ {st.hp}</span><span title="Ataque">⚔ {st.atk}</span><span title="Defesa">⛨ {st.def}</span><span title="Velocidade">➤ {st.spd}</span>
        </div>
        {r.level < 100 && <div className="xp-thin"><div style={{ width: `${Math.min(100, (r.xp / need) * 100)}%` }} /></div>}
      </div>
    </div>
  );
}
