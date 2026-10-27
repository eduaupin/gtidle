import { DISTRICTS } from '@gti/shared';

/** Explica o jogo em 30 segundos. Aparece no primeiro acesso e pelo botão "Como jogar". */
export default function Intro({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="modal">
        <h2 id="intro-title">Você chegou na Periferia com $50 no bolso.</h2>
        <p className="muted">
          A cidade é dividida em seis distritos. Cada um paga mais que o anterior, e no último mora o Chefão.
          Seu trabalho é montar a gangue, fazer o dinheiro girar e atravessar a cidade.
        </p>

        <ol className="intro-steps">
          <li>
            <b>A gangue trabalha sozinha</b>
            <p>Escolha um alvo e ela repete o assalto sem parar, até com o jogo fechado (por até 8 horas). Cada assalto dá grana e XP de Respeito.</p>
          </li>
          <li>
            <b>Respeito abre a cidade</b>
            <p>Subindo de nível você libera alvos maiores, o galpão, novos negócios e o próximo distrito.</p>
          </li>
          <li>
            <b>Grana vira renda</b>
            <p>Compre imóveis de fachada, que pingam dinheiro o tempo todo, e use o galpão para refinar e vender produto nos pontos.</p>
          </li>
          <li>
            <b>Cuidado com as estrelas</b>
            <p>Todo crime sobe o procurado, de 0 a 6 estrelas. Golpe pequeno só chama policial a pé; golpe grande chama SWAT e helicóptero. Com 3 estrelas se esconda, com 4 a roupa e o carro queimam, e no topo das 6 é cadeia.</p>
          </li>
        </ol>

        <div className="goal-line">
          <b>Sua jornada</b>
          <ol>
            {DISTRICTS.map(d => <li key={d.id}>{d.name}{d.minLevel > 1 ? ` (nível ${d.minLevel})` : ''}</li>)}
          </ol>
        </div>

        <p className="muted small">A placa amarela no canto mostra sempre o próximo passo e quanto ele paga.</p>
        <button onClick={onClose}>Começar o primeiro corre</button>
      </div>
    </div>
  );
}
