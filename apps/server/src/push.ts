// Notificações push do navegador (Web Push com chaves VAPID). Chegam mesmo com a aba do jogo
// fechada, desde que o navegador esteja aberto. Sem chaves no .env, gera um par na primeira vez
// e guarda em data/vapid.json (bom para desenvolvimento; em produção, defina no .env).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import webpush from 'web-push';
import type { PushSub } from './store/store';

let publicKey = process.env.VAPID_PUBLIC_KEY ?? '';
let privateKey = process.env.VAPID_PRIVATE_KEY ?? '';
const subject = process.env.VAPID_SUBJECT ?? 'mailto:contato@exemplo.com';

if (!publicKey || !privateKey) {
  const file = resolve(dirname(process.env.DATA_FILE ?? './data/dev-db.json'), 'vapid.json');
  if (existsSync(file)) ({ publicKey, privateKey } = JSON.parse(readFileSync(file, 'utf8')));
  else {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ publicKey, privateKey }));
  }
}
webpush.setVapidDetails(subject, publicKey, privateKey);

export const vapidPublicKey = () => publicKey;

export interface PushMessage { title: string; body: string; tag: string; url?: string }

/** Envia para todos os navegadores do jogador. Devolve as inscrições que continuam válidas. */
export async function sendPush(subs: PushSub[], msg: PushMessage): Promise<PushSub[]> {
  const alive: PushSub[] = [];
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(sub, JSON.stringify(msg), { TTL: 120, urgency: 'high' });
      alive.push(sub);
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      if (code !== 404 && code !== 410) alive.push(sub); // 404/410 = inscrição morta, descarta
    }
  }));
  return alive;
}
