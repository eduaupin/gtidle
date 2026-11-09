// Contas: login com Firebase (Google, e-mail etc.) e com Discord, ligados ao mesmo jogador.
//
// Como funciona:
//  - Firebase: o navegador faz o login com o SDK do Firebase e manda o ID token. O servidor confere a
//    assinatura com as chaves públicas do Google (sem precisar de conta de serviço) e lê o `uid`.
//  - Discord: OAuth2 clássico. O servidor manda o jogador para o Discord, recebe o `code` de volta,
//    troca pelo token e lê o `id` do usuário. O segredo do Discord nunca vai para o navegador.
//  - Cada identidade ("firebase:<uid>" ou "discord:<id>") aponta para um jogador. Quem já joga como
//    convidado e faz login pela primeira vez leva o progresso junto (a identidade é ligada ao convidado).
//    Se a identidade já tem jogo salvo, carrega esse jogo.
//
// Em desenvolvimento, sem as chaves, os dois botões funcionam num modo de teste (identidade falsa).
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { PlayerState } from '@gti/shared';

export type Provider = 'firebase' | 'discord';
export interface Identity { provider: Provider; sub: string; name: string; method: string }
export class AuthError extends Error { statusCode = 401; }

const DEV = process.env.NODE_ENV !== 'production';
const SECRET = process.env.SESSION_SECRET ?? 'dev-secret-troque-isto';

// ---------------- Firebase ----------------
const FIREBASE_PROJECT = () => process.env.FIREBASE_PROJECT_ID ?? '';
let firebaseKeys: JWTVerifyGetKey = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);
/** Testes: troca as chaves do Google por chaves locais */
export function setFirebaseKeys(k: JWTVerifyGetKey) { firebaseKeys = k; }
export const firebaseEnabled = () => !!FIREBASE_PROJECT();

export async function verifyFirebase(idToken: string, projectId = FIREBASE_PROJECT()): Promise<Identity> {
  if (!projectId) {
    // modo de teste: "dev:Nome"
    if (DEV && idToken.startsWith('dev:')) {
      const name = idToken.slice(4) || 'Teste';
      return { provider: 'firebase', sub: `dev-${name.toLowerCase()}`, name, method: 'google.com' };
    }
    throw new AuthError('Login do Firebase não configurado no servidor (FIREBASE_PROJECT_ID)');
  }
  try {
    const { payload } = await jwtVerify(idToken, firebaseKeys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    if (!payload.sub) throw new Error('sem uid');
    const fb = (payload.firebase ?? {}) as { sign_in_provider?: string };
    const name = String(payload.name ?? (payload.email as string | undefined)?.split('@')[0] ?? 'Jogador');
    return { provider: 'firebase', sub: payload.sub, name, method: fb.sign_in_provider ?? 'firebase' };
  } catch {
    throw new AuthError('Login do Google/Firebase inválido ou expirado. Tente de novo.');
  }
}

// ---------------- Discord ----------------
const DISCORD_ID = () => process.env.DISCORD_CLIENT_ID ?? '';
const DISCORD_SECRET = () => process.env.DISCORD_CLIENT_SECRET ?? '';
export const discordEnabled = () => !!(DISCORD_ID() && DISCORD_SECRET());
const discordRedirect = () => `${process.env.API_PUBLIC_URL ?? 'http://localhost:3001'}/api/auth/discord/callback`;

/** O "state" leva quem está ligando a conta, o convite e o nick, assinado e com validade de 10 min. */
export interface DiscordState { n: string; exp: number; link?: string; ref?: string; nick?: string }
export function signState(s: Omit<DiscordState, 'n' | 'exp'>, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...s, n: randomUUID().slice(0, 8), exp: now + 10 * 60_000 })).toString('base64url');
  return `${body}.${createHmac('sha256', SECRET).update(body).digest('base64url')}`;
}
export function readState(state: string, now = Date.now()): DiscordState {
  const [body, sig] = String(state ?? '').split('.');
  const good = body && sig && (() => {
    const a = Buffer.from(sig), b = Buffer.from(createHmac('sha256', SECRET).update(body).digest('base64url'));
    return a.length === b.length && timingSafeEqual(a, b);
  })();
  if (!good) throw new AuthError('Login do Discord inválido. Tente de novo.');
  const s = JSON.parse(Buffer.from(body, 'base64url').toString()) as DiscordState;
  if (s.exp < now) throw new AuthError('O login do Discord demorou demais. Tente de novo.');
  return s;
}

export function discordAuthUrl(state: string) {
  if (!discordEnabled()) {
    if (DEV) return `/api/auth/discord/callback?code=dev&state=${encodeURIComponent(state)}`; // modo de teste
    throw new AuthError('Login do Discord não configurado no servidor');
  }
  const q = new URLSearchParams({
    client_id: DISCORD_ID(), redirect_uri: discordRedirect(), response_type: 'code', scope: 'identify', state, prompt: 'none',
  });
  return `https://discord.com/oauth2/authorize?${q}`;
}

type Fetch = typeof fetch;
export async function discordIdentity(code: string, f: Fetch = fetch): Promise<Identity> {
  if (!discordEnabled()) {
    if (DEV && code === 'dev') return { provider: 'discord', sub: 'dev-discord', name: 'TesteDiscord', method: 'discord' };
    throw new AuthError('Login do Discord não configurado no servidor');
  }
  const tok = await f('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: DISCORD_ID(), client_secret: DISCORD_SECRET(), grant_type: 'authorization_code', code, redirect_uri: discordRedirect(),
    }),
  });
  if (!tok.ok) throw new AuthError('O Discord recusou o login. Tente de novo.');
  const { access_token } = await tok.json() as { access_token: string };
  const me = await f('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${access_token}` } });
  if (!me.ok) throw new AuthError('Não deu para ler sua conta do Discord.');
  const u = await me.json() as { id: string; username: string; global_name?: string | null };
  return { provider: 'discord', sub: u.id, name: u.global_name || u.username, method: 'discord' };
}

// ---------------- ligar identidade ao jogador ----------------
export interface AccountStore {
  getDoc<T>(key: string, init: () => T): T;
  touch(): void;
  getPlayer(id: string): PlayerState | undefined;
  savePlayer(p: PlayerState): void;
}

const key = (i: Identity) => `${i.provider}:${i.sub}`;
const map = (s: AccountStore) => s.getDoc<Record<string, string>>('identities', () => ({}));

export const METHOD_NAME: Record<string, string> = {
  'google.com': 'Google', password: 'E-mail', 'apple.com': 'Apple', 'microsoft.com': 'Microsoft', discord: 'Discord', firebase: 'Firebase',
};

/**
 * Entra com uma identidade.
 *  - já tem jogo salvo → carrega esse jogador ("existing")
 *  - chegou logado como convidado (ou já logado por outro meio) → liga a identidade a ele ("linked")
 *  - senão → cria um jogador novo ("new")
 */
export function loginWithIdentity(
  s: AccountStore, ident: Identity,
  opts: { currentId?: string | null; create: (name: string) => PlayerState },
  now = Date.now(),
): { player: PlayerState; result: 'existing' | 'linked' | 'new' } {
  const m = map(s);
  const owner = m[key(ident)];
  const ownerPlayer = owner ? s.getPlayer(owner) : undefined;
  if (ownerPlayer) return { player: ownerPlayer, result: 'existing' };

  const current = opts.currentId ? s.getPlayer(opts.currentId) : undefined;
  const label = { provider: ident.provider, method: METHOD_NAME[ident.method] ?? ident.method, name: ident.name.slice(0, 40), at: now };
  if (current) {
    m[key(ident)] = current.id;
    current.accounts = [...(current.accounts ?? []).filter(a => a.provider !== ident.provider), label];
    s.savePlayer(current); s.touch();
    return { player: current, result: 'linked' };
  }
  const p = opts.create(ident.name);
  p.accounts = [label];
  m[key(ident)] = p.id;
  s.savePlayer(p); s.touch();
  return { player: p, result: 'new' };
}

/** Token de sessão para um jogador que já existe (mesmo formato do convidado) */
export const sessionFor = (id: string) => `${id}.${createHmac('sha256', SECRET).update(id).digest('base64url')}`;
