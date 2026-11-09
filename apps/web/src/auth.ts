// Login no navegador: Google pelo Firebase (o SDK só carrega quando a pessoa clica) e Discord pelo servidor.
import { api } from './api';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};
export const firebaseConfigured = Boolean(cfg.apiKey && cfg.projectId);

/** Abre o popup do Google e devolve o ID token do Firebase (em teste, sem chaves, um token falso). */
async function googleIdToken(): Promise<string> {
  if (!firebaseConfigured) {
    if (import.meta.env.DEV) return 'dev:TesteGoogle';
    throw new Error('Login do Google ainda não configurado.');
  }
  const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup, signOut }] =
    await Promise.all([import('firebase/app'), import('firebase/auth')]);
  const app = getApps()[0] ?? initializeApp(cfg);
  const auth = getAuth(app);
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const res = await signInWithPopup(auth, provider);
  const token = await res.user.getIdToken();
  await signOut(auth); // a sessão do jogo é a nossa; não precisa manter a do Firebase aberta
  return token;
}

export async function loginGoogle(opts: { nick?: string; ref?: string | null } = {}) {
  const idToken = await googleIdToken();
  return api.loginFirebase(idToken, opts.nick, opts.ref);
}

/** Vai para o Discord e volta para o jogo com o login no endereço (#login=...). */
export async function loginDiscord(opts: { nick?: string; ref?: string | null } = {}) {
  const { url } = await api.discordStart(opts.nick, opts.ref);
  window.location.href = url;
}

/** Volta do Discord: guarda a sessão e limpa o endereço. */
export function consumeLoginHash(): { result?: string; error?: string } | null {
  const h = new URLSearchParams(window.location.hash.slice(1));
  const token = h.get('login'), error = h.get('loginError');
  if (!token && !error) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  if (token) { api.useSession(token); return { result: h.get('result') ?? undefined }; }
  return { error: error ?? 'Não deu para entrar.' };
}
