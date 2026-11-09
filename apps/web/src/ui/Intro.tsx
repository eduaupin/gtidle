import { DISTRICTS, RULES } from '@gti/shared';

/** Explica o jogo em 30 segundos e o que focar em cada fase. Aparece no primeiro acesso e pelo botão "Como jogar". */
export default function Intro({ onClose, onTour }: { onClose: () => void; onTour: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="intro-title">
      <div className="modal intro">
        <h2 id="intro-title">Você chegou na Periferia com $50 no bolso.</h2>
        <p className="muted">
          A Costa Dourada tem {DISTRICTS.length} regiões. Cada uma paga mais que a anterior, e no fim da costa mora o Chefão.
          Seu trabalho é montar a gangue, fazer o dinheiro girar e atravessar o estado.
        </p>

        <ol className="intro-steps">
          <li>
            <b>A gangue trabalha sozinha</b>
            <p>Escolha um alvo e ela repete o assalto sem parar, até com o jogo fechado (por até {RULES.offlineCapHoursFree} horas). Cada assalto dá grana e XP de Respeito.</p>
          </li>
          <li>
            <b>Bala e kit médico mantêm a gangue na rua</b>
            <p>Golpe de 2★ ou mais gasta bala e machuca. Sem bala só 1% dá certo; sem kit, ou com a vida zerada, a gangue volta para o esconderijo e para de farmar até você mandar de volta.</p>
          </li>
          <li>
            <b>Itens com status caem nos assaltos</b>
            <p>Armas, roupas, acessórios, carros e motos vêm com raridade e status. Use os melhores e venda o resto no Mercador ou no Mercado.</p>
          </li>
          <li>
            <b>Cuidado com as estrelas</b>
            <p>Todo crime sobe o procurado, de 0 a 6 estrelas. Com 3 se esconda, com 4 a roupa e o carro queimam, e no topo é cadeia.</p>
          </li>
        </ol>

        <div className="goal-line">
          <b>No que focar</b>
          <ul className="focus-list">
            <li><b>Nível 1 a 10:</b> bater carteira e assaltar banca, cumprir os objetivos da placa amarela e comprar o primeiro imóvel. Ligue sua conta para não perder o jogo.</li>
            <li><b>Nível 10 a 30:</b> deixar munição e kits sempre cheios (ou "Repor sozinha"), equipar os melhores itens, entrar num bonde com amigos e usar a lavanderia.</li>
            <li><b>Nível 30 em diante:</b> golpes grandes de 6★ com seguro, golpe em equipe, guerra de território, corrida no Autódromo e vender itens raros.</li>
          </ul>
        </div>

        <div className="row">
          <button className="ghost" onClick={onTour}>Ver o tutorial guiado</button>
          <button onClick={onClose}>Começar o primeiro corre</button>
        </div>
      </div>
    </div>
  );
}
