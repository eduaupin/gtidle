// Ativa as notificações do navegador (Web Push). Precisa de um clique do jogador para pedir permissão.
// Funciona em https ou em localhost.

const DISMISS_KEY = 'gti_push_dismissed';

export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const pushPermission = (): NotificationPermission | 'unsupported' =>
  pushSupported() ? Notification.permission : 'unsupported';

export const pushPromptDismissed = () => { try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; } };
export const dismissPushPrompt = () => { try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* sem storage */ } };

function urlBase64ToUint8Array(base64: string) {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, c => c.charCodeAt(0));
}

/** Registra o service worker, pede permissão e manda a inscrição para o servidor. */
export async function enablePush(token: string | null): Promise<'granted' | 'denied' | 'unsupported' | 'error'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const { publicKey } = await (await fetch('/api/push/key')).json() as { publicKey: string };
    const sub = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return 'granted';
  } catch {
    return 'error';
  }
}

/** Se a permissão já foi dada antes, renova a inscrição em silêncio ao abrir o jogo. */
export async function refreshPushIfGranted(token: string | null) {
  if (pushSupported() && Notification.permission === 'granted') await enablePush(token);
}
