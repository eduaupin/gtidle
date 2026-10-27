import { useEffect, useState } from 'react';
import type { PlayerState } from '@gti/shared';
import { renderShareCard, shareText } from '../game/shareCard';

/** Gera o card do perfil e oferece compartilhar (celular), baixar e copiar o texto. */
export default function ShareModal({ p, onClose }: { p: PlayerState; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    renderShareCard(p).then(c => c.toBlob(b => {
      if (!alive || !b) return;
      setBlob(b); setUrl(URL.createObjectURL(b));
    }, 'image/png'));
    return () => { alive = false; };
    // gera uma vez por abertura
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const file = blob ? new File([blob], `gangue-${p.nick}.png`, { type: 'image/png' }) : null;
  const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));

  const share = async () => {
    if (!file) return;
    try { await navigator.share({ files: [file], text: shareText(p) }); }
    catch { /* o jogador cancelou */ }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(shareText(p)); setMsg('Texto copiado.'); }
    catch { setMsg('Não deu para copiar.'); }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="share-title" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal share">
        <div className="row">
          <h2 id="share-title">Compartilhar perfil</h2>
          <button className="ghost small" onClick={onClose}>Fechar</button>
        </div>
        {url ? <img src={url} alt="Card do seu perfil" className="share-img" /> : <p className="muted">Gerando a imagem…</p>}
        <div className="alert-actions">
          {canShareFile && <button onClick={share}>Compartilhar</button>}
          {url && <a className="btn" href={url} download={`gangue-${p.nick}.png`}>Baixar imagem</a>}
          <button className="ghost" onClick={copy}>Copiar texto</button>
        </div>
        {msg && <p className="small muted">{msg}</p>}
        <p className="hint">No celular, "Compartilhar" abre direto Instagram, WhatsApp e afins. No computador, baixe a imagem e poste onde quiser.</p>
      </div>
    </div>
  );
}
