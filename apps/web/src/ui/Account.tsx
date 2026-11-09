// Conta: entrar com Google ou Discord (no começo) e ligar/ver as contas dentro do jogo.
import { useEffect, useState } from 'react';
import { api } from '../api';
import { firebaseConfigured } from '../auth';
import { t } from '../i18n';
import type { PlayerState } from '@gti/shared';
import { loginDiscord, loginGoogle } from '../auth';

export const RESULT_TEXT: Record<string, string> = {
  linked: 'Conta ligada: seu progresso agora está salvo e abre em qualquer aparelho.',
  existing: 'Essa conta já tinha um jogo salvo: carregamos ele.',
  new: 'Conta criada. Bem-vindo à Costa Dourada!',
};

function GoogleIcon() {
  return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>;
}
function DiscordIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.6 1.3a18.3 18.3 0 0 0-5.5 0L8.6 3a19.7 19.7 0 0 0-4.9 1.5C.5 9.2-.3 13.8.1 18.3a19.9 19.9 0 0 0 6 3l1.3-2.1a12.9 12.9 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4c-.6.4-1.3.7-2 1l1.3 2.1a19.8 19.8 0 0 0 6-3c.5-5.2-.8-9.8-3.6-13.9ZM8 15.5c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4 2.2 1.1 2.2 2.4-1 2.4-2.2 2.4Z"/></svg>;
}

/** Botões de login. `onDone` recebe o resultado (Google volta na hora; Discord sai e volta pela página). */
export function LoginButtons({ nick, refCode, onDone, linking = false, has = [] }: {
  nick?: string; refCode?: string | null; onDone: (result: string) => void; linking?: boolean; has?: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // só mostra o que está configurado no servidor (e, no Google, também no site)
  const [cfg, setCfg] = useState<{ firebase: boolean; discord: boolean } | null>(null);
  useEffect(() => { api.authConfig().then(setCfg).catch(() => setCfg({ firebase: false, discord: false })); }, []);
  const google = !!cfg?.firebase && (firebaseConfigured || import.meta.env.DEV);
  const discord = !!cfg?.discord;
  if (cfg && !google && !discord) return null;
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr('');
    try { const r = await fn() as { result?: string } | undefined; if (r?.result) onDone(r.result); }
    catch (e) {
      const m = (e as Error).message ?? '';
      setErr(/popup-closed|cancelled/i.test(m) ? '' : m.replace(/^Firebase: /, ''));
    } finally { setBusy(false); }
  };
  return (
    <div className="login-buttons">
      {google && !has.includes('firebase') && (
        <button className="btn-google" disabled={busy} onClick={() => run(() => loginGoogle({ nick, ref: refCode }))}>
          <GoogleIcon /> {linking ? 'Ligar conta Google' : t('Entrar com Google')}
        </button>
      )}
      {discord && !has.includes('discord') && (
        <button className="btn-discord" disabled={busy} onClick={() => run(() => loginDiscord({ nick, ref: refCode }))}>
          <DiscordIcon /> {linking ? 'Ligar Discord' : t('Entrar com Discord')}
        </button>
      )}
      {err && <p className="msg bad">{err}</p>}
    </div>
  );
}

export function AccountModal({ p, onClose, onLinked, onLogout }: {
  p: PlayerState; onClose: () => void; onLinked: (result: string) => void; onLogout: () => void;
}) {
  const acc = p.accounts ?? [];
  const guest = acc.length === 0;
  const [confirm, setConfirm] = useState(false);
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Conta" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal account">
        <div className="row"><h2>Conta</h2><button className="ghost small" onClick={onClose}>Fechar</button></div>
        <p><b>{p.nick}</b> · nível {p.level}</p>
        {guest
          ? <p className="warn-box">Você está jogando como <b>convidado</b>. Se limpar o navegador ou trocar de aparelho, perde a gangue, os itens e o que comprou. Ligue uma conta para salvar.</p>
          : <ul className="accounts">{acc.map(a => <li key={a.provider}><b>{a.method}</b> <span className="muted">· {a.name}</span></li>)}</ul>}
        <LoginButtons linking has={acc.map(a => a.provider)} onDone={onLinked} />
        <div className="row">
          {!confirm
            ? <button className="ghost small" onClick={() => (guest ? setConfirm(true) : onLogout())}>Sair</button>
            : <><span className="small">Sem conta ligada, este jogo não volta. Sair mesmo?</span><button className="small danger" onClick={onLogout}>Sair e perder</button></>}
        </div>
      </div>
    </div>
  );
}
