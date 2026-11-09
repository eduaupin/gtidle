// Encontro (janela de 30 s para convidar) e a escolha do primeiro capanga.
import { INVITES, RARITY_NAME, RECRUIT, STARTERS, powerClass, recruitChance, speciesById, type PlayerState } from '@gti/shared';
import { RecruitAvatar, SpecTag } from './RecruitBits';
import { useNow } from './Hud';

type Act = (a: import('@gti/shared').Action) => Promise<void> | void;

export function EncounterPopup({ p, act }: { p: PlayerState; act: Act }) {
  const now = useNow(250);
  const e = p.recruits?.encounter;
  if (!e || e.expiresAt <= now) return null;
  const s = speciesById(e.speciesId);
  if (!s) return null;
  const left = Math.max(0, (e.expiresAt - now) / 1000);
  const known = (p.recruits.album[s.id]?.caught ?? 0) > 0;
  return (
    <div className={`encounter ${e.lenda ? 'lenda' : ''}`} role="dialog" aria-label={`${s.name} quer entrar para a gangue`}>
      <div className="enc-timer"><div style={{ width: `${(left / RECRUIT.windowSec) * 100}%` }} /></div>
      <div className="enc-body">
        <RecruitAvatar speciesId={s.id} lenda={e.lenda} size={64} />
        <div className="enc-info">
          <strong>{e.lenda ? 'Lenda da Rua! ' : ''}{s.name} quer entrar</strong>
          <div className="recruit-meta"><SpecTag spec={s.spec} /><span>Nv {e.level}</span><span className={`pclass p${powerClass(e.ivs)}`}>P{powerClass(e.ivs)}</span><span className="muted">{RARITY_NAME[s.rarity]}</span>{!known && <span className="badge boost">Novo no álbum</span>}</div>
          <span className="small muted">{Math.ceil(left)} s para decidir</span>
        </div>
      </div>
      <div className="buy-row">
        {INVITES.map(i => (
          <button key={i.id} className="small" disabled={(p.recruits.invites[i.id] ?? 0) <= 0} onClick={() => act({ type: 'recruit', invite: i.id })}>
            {i.name.replace('Convite ', '').replace(/^./, c => c.toUpperCase())} · {Math.round(recruitChance(s, i.id, e.lenda) * 100)}% ({p.recruits.invites[i.id] ?? 0})
          </button>
        ))}
        <button className="small ghost" onClick={() => act({ type: 'skipEncounter' })}>Deixar ir</button>
      </div>
    </div>
  );
}

export function StarterPicker({ act }: { act: Act }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="starter-title">
      <div className="modal starter">
        <h2 id="starter-title">Quem é o seu primeiro capanga?</h2>
        <p className="muted">Ele sai com a gangue em todo assalto, ganha nível e promove. Depois você recruta mais gente na rua.</p>
        <div className="starter-grid">
          {STARTERS.map(id => {
            const s = speciesById(id)!;
            return (
              <button key={id} className="starter-card" onClick={() => act({ type: 'pickStarter', speciesId: id })}>
                <RecruitAvatar speciesId={id} size={88} />
                <strong>{s.name}</strong>
                <SpecTag spec={s.spec} />
                <span className="small muted">{{ pistoleiro: 'Bate forte. Bom em loja e posto.', motorista: 'O mais rápido. Bom em garagem e porto.', golpista: 'Esperto. Bom na rua e em banca.' }[s.spec as 'pistoleiro']}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
