// Nível de procurado de 0 a 6 estrelas. O procurado continua sendo um número de 0 a 100;
// as estrelas são faixas desse número. Cada golpe tem um teto: golpe pequeno só chama
// policial a pé, golpe grande chama SWAT e helicóptero.

export type PoliceUnit = 'nenhuma' | 'pe' | 'viatura' | 'cerco' | 'swat' | 'helicoptero' | 'total';

/** Procurado mínimo para cada quantidade de estrelas (índice = estrelas). */
export const STAR_HEAT = [0, 10, 25, 40, 60, 75, 90] as const;
export const MAX_STARS = 6;

export interface StarLevel {
  stars: number;
  unit: PoliceUnit;
  /** Quem vem atrás da gangue */
  name: string;
  /** O que muda no jogo */
  effect: string;
}

export const STAR_LEVELS: StarLevel[] = [
  { stars: 0, unit: 'nenhuma', name: 'Ninguém', effect: 'Barra limpa.' },
  { stars: 1, unit: 'pe', name: 'Policiais a pé', effect: 'Só olhando. Nada muda.' },
  { stars: 2, unit: 'viatura', name: 'Viatura', effect: 'Uma viatura rondando o bairro.' },
  { stars: 3, unit: 'cerco', name: 'Viaturas em cerco', effect: 'Hora de ir para o esconderijo.' },
  { stars: 4, unit: 'swat', name: 'SWAT', effect: 'Roupa e carro em uso ficam queimados.' },
  { stars: 5, unit: 'helicoptero', name: 'Helicóptero', effect: 'O esconderijo demora o dobro.' },
  { stars: 6, unit: 'total', name: 'Cerco total', effect: 'SWAT, helicóptero e bloqueio. No 100 é cadeia.' },
];

export const starsFor = (heat: number) => {
  let s = 0;
  for (let i = 1; i <= MAX_STARS; i++) if (heat >= STAR_HEAT[i]) s = i;
  return s;
};

/** Maior procurado que um golpe com esse teto consegue causar (fica logo abaixo da próxima estrela). */
export const heatCapFor = (maxStars: number) =>
  maxStars >= MAX_STARS ? 100 : STAR_HEAT[maxStars + 1] - 0.5;

/** Quem persegue um golpe com esse teto (para os cards de assalto). */
export const chaserFor = (maxStars: number) =>
  maxStars >= 6 ? 'SWAT e helicóptero' : STAR_LEVELS[Math.max(1, maxStars)].name;
