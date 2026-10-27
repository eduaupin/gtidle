import { useEffect, useState, type ReactNode } from 'react';

/** Modal genérico de compartilhar imagem (PNG ou GIF): compartilhar no celular, baixar e copiar texto/link. */
export default function ShareImage({ title, make, filename, text, onClose, children, deps = [] }: {
  title: string;
  make: () => Promise<Blob | HTMLCanvasElement>;
  filename: string;
  text: string;
  onClose: () => void;
  children?: ReactNode;
  deps?: unknown[];
}) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    let alive = true;
    setBlob(null);
    make().then(r => {
      if (r instanceof Blob) return r;
      return new Promise<Blob | null>(res => r.toBlob(res, 'image/png'));
    }).then(b => {
      if (!alive || !b) return;
      setBlob(b); setUrl(URL.createObjectURL(b));
    }).catch(e => alive && setMsg((e as Error).message));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const file = blob ? new File([blob], filename, { type: blob.type }) : null;
  const canShareFile = Boolean(file && navigator.canShare?.({ files: [file] }));
  const share = async () => {
    if (!file) return;
    try { await navigator.share({ files: [file], text }); } catch { /* cancelou */ }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setMsg('Texto copiado.'); } catch { setMsg('Não deu para copiar.'); }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal share">
        <div className="row">
          <h2>{title}</h2>
          <button className="ghost small" onClick={onClose}>Fechar</button>
        </div>
        {children}
        {url && blob ? <img src={url} alt={title} className="share-img" /> : <p className="muted">Gerando a imagem…</p>}
        <div className="alert-actions">
          {canShareFile && <button onClick={share}>Compartilhar</button>}
          {url && <a className="btn" href={url} download={filename}>Baixar</a>}
          <button className="ghost" onClick={copy}>Copiar texto</button>
        </div>
        {msg && <p className="small muted">{msg}</p>}
      </div>
    </div>
  );
}
