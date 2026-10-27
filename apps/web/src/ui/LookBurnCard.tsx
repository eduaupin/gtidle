import { DIAMOND_ITEMS, burnedUntil, isLookBurned, type Action, type PlayerState } from '@gti/shared';
import { useNow } from './Hud';
import { ItemPreview } from './Preview';

/** 4 estrelas: a polícia queimou o visual. Mostra o que dá para trocar agora. */
export default function LookBurnCard({ p, act, onLook }: { p: PlayerState; act: (a: Action) => void; onLook: () => void }) {
  const now = useNow(1000);
  if (!isLookBurned(p, now)) return null;
  const charBurnt = burnedUntil(p, p.equipped.character) > now;
  const carBurnt = burnedUntil(p, p.equipped.vehicle) > now;
  const free = (slot: 'character' | 'vehicle') =>
    DIAMOND_ITEMS.filter(i => i.slot === slot && p.cosmetics.includes(i.id) && burnedUntil(p, i.id) <= now && p.equipped[slot] !== i.id);
  const options = [...(charBurnt ? free('character') : []), ...(carBurnt ? free('vehicle') : [])].slice(0, 6);

  return (
    <section className="heat-card burn-card" role="alert">
      <div className="stars-big" aria-label="4 estrelas">★★★★</div>
      <div className="alert-body">
        <h3>A polícia conhece seu visual</h3>
        <p>
          {charBurnt && carBurnt ? 'Roupa e carro foram queimados.' : charBurnt ? 'A roupa foi queimada.' : 'O carro foi queimado.'}{' '}
          A gangue só volta a roubar com {charBurnt && carBurnt ? 'outra roupa e outro carro' : charBurnt ? 'outra roupa' : 'outro carro'}.
        </p>
        {options.length > 0 && (
          <div className="burn-options">
            {options.map(i => (
              <button key={i.id} className="burn-opt" onClick={() => act({ type: 'equip', itemId: i.id })} title={`Usar ${i.name}`}>
                <ItemPreview item={i} size={44} />
                <span>{i.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="alert-actions">
          <button onClick={onLook}>{options.length ? 'Ver todos os visuais' : 'Comprar roupa ou carro'}</button>
        </div>
      </div>
    </section>
  );
}
