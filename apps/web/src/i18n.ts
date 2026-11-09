// Idiomas: português (padrão), inglês e espanhol. O texto em português é a própria chave:
// o que ainda não tem tradução aparece em português.
export type Lang = 'pt' | 'en' | 'es';
const KEY = 'gti_lang';
const detect = (): Lang => {
  try { const s = localStorage.getItem(KEY) as Lang | null; if (s) return s; } catch { /* sem storage */ }
  const n = (navigator.language || 'pt').slice(0, 2);
  return n === 'en' ? 'en' : n === 'es' ? 'es' : 'pt';
};
export let lang: Lang = detect();
export function setLang(l: Lang) { lang = l; try { localStorage.setItem(KEY, l); } catch { /* ok */ } location.reload(); }

const D: Record<string, [string, string]> = {
  // abas
  'Assaltos': ['Heists', 'Asaltos'], 'Capangas': ['Crew', 'Secuaces'], 'Inventário': ['Inventory', 'Inventario'], 'Arena': ['Arena', 'Arena'],
  'Galpão': ['Warehouse', 'Galpón'], 'Imóveis': ['Properties', 'Inmuebles'], 'Gangue': ['Gang', 'Pandilla'], 'Visual': ['Look', 'Estilo'],
  'Base': ['Hideout', 'Guarida'], 'Bonde': ['Squad', 'Banda'], 'Cidade': ['City', 'Ciudad'], 'Mercado': ['Market', 'Mercado'], 'Loja': ['Shop', 'Tienda'], 'Chat': ['Chat', 'Chat'],
  // topo
  'Grana': ['Cash', 'Plata'], 'Diamantes': ['Diamonds', 'Diamantes'], 'Procurado': ['Wanted', 'Buscado'], 'Mapa': ['Map', 'Mapa'],
  'Compartilhar': ['Share', 'Compartir'], 'Foto': ['Photo', 'Foto'], 'Ficha': ['Record', 'Ficha'], 'Conta': ['Account', 'Cuenta'], 'Como jogar': ['How to play', 'Cómo jugar'],
  // entrada
  'Idle de crime na cidade grande': ['Crime idle in the big city', 'Idle de crimen en la gran ciudad'],
  'Comece com $50 na Periferia, monte sua gangue e atravesse a cidade até as Mansões. Ela trabalha até quando você fecha o jogo.':
    ['Start with $50 in the Outskirts, build your gang and cross the city to the Mansions. It keeps working even when you close the game.',
     'Empieza con $50 en la Periferia, arma tu pandilla y cruza la ciudad hasta las Mansiones. Trabaja incluso con el juego cerrado.'],
  'Entrar com Google': ['Sign in with Google', 'Entrar con Google'], 'Entrar com Discord': ['Sign in with Discord', 'Entrar con Discord'],
  'ou jogue como convidado (dá para ligar a conta depois)': ['or play as a guest (you can link an account later)', 'o juega como invitado (puedes vincular una cuenta después)'],
  'Seu apelido': ['Your nickname', 'Tu apodo'], 'Entrar': ['Play', 'Entrar'], 'Para maiores de 18 anos.': ['18+ only.', 'Solo para mayores de 18.'],
  // tutorial
  'Pular': ['Skip', 'Saltar'], 'Voltar': ['Back', 'Atrás'], 'Próximo': ['Next', 'Siguiente'], 'Bora!': ["Let's go!", '¡Vamos!'],
};
export const t = (pt: string) => (lang === 'pt' ? pt : D[pt]?.[lang === 'en' ? 0 : 1] ?? pt);
export const LANGS: [Lang, string][] = [['pt', 'PT'], ['en', 'EN'], ['es', 'ES']];
