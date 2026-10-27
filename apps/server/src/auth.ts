// Login de convidado para desenvolvimento: o token é o id do jogador assinado com HMAC.
// Para produção, adicione login por e-mail, Google e Discord (ex.: Auth.js ou Supabase Auth)
// e verificação de idade além da autodeclaração (ECA Digital).
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.SESSION_SECRET ?? 'dev-secret-troque-isto';

const sign = (id: string) => createHmac('sha256', SECRET).update(id).digest('base64url');

export function issueToken() {
  const id = randomUUID();
  return { id, token: `${id}.${sign(id)}` };
}

export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  const [id, sig] = token.replace(/^Bearer\s+/i, '').split('.');
  if (!id || !sig) return null;
  const a = Buffer.from(sig), b = Buffer.from(sign(id));
  return a.length === b.length && timingSafeEqual(a, b) ? id : null;
}
