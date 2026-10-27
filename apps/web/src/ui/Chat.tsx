import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from '../api';

interface Msg { nick: string; text: string; at: number; vip: boolean; founder: boolean }

export default function Chat() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [online, setOnline] = useState(0);
  const [text, setText] = useState('');
  const sock = useRef<Socket | null>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const s = io({ auth: { token: getToken() } });
    sock.current = s;
    s.on('chat', (m: Msg) => setMsgs(prev => [...prev.slice(-99), m]));
    s.on('online', (n: number) => setOnline(n));
    return () => { s.disconnect(); };
  }, []);

  useEffect(() => { list.current?.scrollTo(0, list.current.scrollHeight); }, [msgs]);

  const send = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    sock.current?.emit('chat', text);
    setText('');
  };

  return (
    <div className="panel chat">
      <div className="muted small">{online} online agora. Links são removidos.</div>
      <div className="msgs" ref={list}>
        {msgs.length === 0 && <p className="hint">Ninguém falou nada ainda.</p>}
        {msgs.map((m, i) => (
          <p key={i}>
            <span className={`nick ${m.founder ? 'founder' : ''}`}>{m.nick}</span>
            {m.vip && <span className="badge vip">★ Rockeiro</span>}: {m.text}
          </p>
        ))}
      </div>
      <form onSubmit={send} className="row">
        <input value={text} maxLength={200} onChange={e => setText(e.target.value)} placeholder="Falar no global…" />
        <button>Enviar</button>
      </form>
    </div>
  );
}
