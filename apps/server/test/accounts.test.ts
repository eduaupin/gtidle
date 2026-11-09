import { describe, expect, it } from 'vitest';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import { newPlayer } from '../src/engine/idle';
import { FileStore } from '../src/store/store';
import { verifyToken } from '../src/auth';
import {
  discordIdentity, loginWithIdentity, readState, sessionFor, setFirebaseKeys, signState, verifyFirebase, type Identity,
} from '../src/accounts';

const PROJECT = 'gti-teste';
async function firebaseToken(claims: Record<string, unknown>, opts: { aud?: string; exp?: string } = {}) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
  setFirebaseKeys(createLocalJWKSet({ keys: [jwk] }));
  return new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(`https://securetoken.google.com/${PROJECT}`).setAudience(opts.aud ?? PROJECT)
    .setSubject('uid-123').setIssuedAt().setExpirationTime(opts.exp ?? '1h').sign(privateKey);
}
const mk = () => new FileStore(`/tmp/gti-acc-${Math.random()}.json`);
const create = (s: FileStore) => (name: string) => { const p = newPlayer(`id-${Math.random()}`, name, Date.now()); s.savePlayer(p); return p; };

describe('login com Firebase', () => {
  it('aceita token assinado do projeto e lê uid, nome e método', async () => {
    const tok = await firebaseToken({ name: 'Edu', firebase: { sign_in_provider: 'google.com' } });
    const id = await verifyFirebase(tok, PROJECT);
    expect(id).toEqual({ provider: 'firebase', sub: 'uid-123', name: 'Edu', method: 'google.com' });
  });
  it('recusa token de outro projeto ou vencido', async () => {
    await expect(verifyFirebase(await firebaseToken({}, { aud: 'outro' }), PROJECT)).rejects.toThrow(/inválido/);
    await expect(verifyFirebase(await firebaseToken({}, { exp: '-1m' }), PROJECT)).rejects.toThrow(/inválido/);
    await expect(verifyFirebase('lixo', PROJECT)).rejects.toThrow(/inválido/);
  });
});

describe('ligar contas', () => {
  const google: Identity = { provider: 'firebase', sub: 'g1', name: 'Edu', method: 'google.com' };
  const discord: Identity = { provider: 'discord', sub: 'd1', name: 'edu#1', method: 'discord' };

  it('convidado faz login: leva o progresso; segundo login carrega o mesmo jogo', () => {
    const s = mk();
    const guest = create(s)('Convidado'); guest.cash = 9999; s.savePlayer(guest);
    const a = loginWithIdentity(s, google, { currentId: guest.id, create: create(s) });
    expect(a.result).toBe('linked');
    expect(a.player.id).toBe(guest.id);
    expect(a.player.accounts?.[0]).toMatchObject({ provider: 'firebase', method: 'Google' });
    const b = loginWithIdentity(s, google, { currentId: null, create: create(s) });
    expect(b).toMatchObject({ result: 'existing' });
    expect(b.player.cash).toBe(9999);
  });

  it('Google e Discord no mesmo jogador; conta nova quando não tem convidado', () => {
    const s = mk();
    const first = loginWithIdentity(s, google, { currentId: null, create: create(s) });
    expect(first.result).toBe('new');
    loginWithIdentity(s, discord, { currentId: first.player.id, create: create(s) });
    expect(loginWithIdentity(s, discord, { currentId: null, create: create(s) }).player.id).toBe(first.player.id);
    expect(first.player.accounts?.map(a => a.provider)).toEqual(['firebase', 'discord']);
  });

  it('token de sessão é aceito pelo servidor', () => {
    expect(verifyToken(sessionFor('abc'))).toBe('abc');
  });
});

describe('login com Discord', () => {
  it('state assinado: leva o convidado e vence em 10 min', () => {
    const st = signState({ link: 'p1', ref: 'ABC' }, 1000);
    expect(readState(st, 2000)).toMatchObject({ link: 'p1', ref: 'ABC' });
    expect(() => readState(st, 1000 + 11 * 60_000)).toThrow(/demorou/);
    expect(() => readState(st.replace(/.$/, 'x'), 2000)).toThrow(/inválido/);
  });
  it('troca o code pelo usuário do Discord', async () => {
    process.env.DISCORD_CLIENT_ID = 'cid'; process.env.DISCORD_CLIENT_SECRET = 'sec';
    const calls: string[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url.endsWith('/oauth2/token')) {
        expect(String(init?.body)).toContain('code=abc');
        return new Response(JSON.stringify({ access_token: 'tok' }));
      }
      return new Response(JSON.stringify({ id: '42', username: 'edu', global_name: 'Edu' }));
    }) as typeof fetch;
    expect(await discordIdentity('abc', fake)).toEqual({ provider: 'discord', sub: '42', name: 'Edu', method: 'discord' });
    expect(calls).toHaveLength(2);
    delete process.env.DISCORD_CLIENT_ID; delete process.env.DISCORD_CLIENT_SECRET;
  });
});
