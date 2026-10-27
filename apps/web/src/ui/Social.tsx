// Modo foto e ficha criminal.
import { useEffect, useState } from 'react';
import { DISTRICTS, TROPHIES, formatCash, type PlayerState } from '@gti/shared';
import { api, type Profile } from '../api';
import { PHOTO_POSES, PHOTO_SCENES, inviteUrl, profileLook, profileUrl, renderPhoto, renderProfile, type PhotoPose, type PhotoScene } from '../game/socialCards';
import { drawCar, drawPerson } from '../game/draw';
import { DrawCanvas } from './Preview';
import ShareImage from './ShareImage';

export function PhotoModal({ p, onClose }: { p: PlayerState; onClose: () => void }) {
  const [scene, setScene] = useState<PhotoScene>('farol');
  const [pose, setPose] = useState<PhotoPose>('roda');
  const [caption, setCaption] = useState('');
  const [typed, setTyped] = useState('');
  // só redesenha a legenda depois que a pessoa para de digitar
  useEffect(() => { const id = setTimeout(() => setCaption(typed), 500); return () => clearTimeout(id); }, [typed]);
  return (
    <ShareImage title="Modo foto" filename={`foto-${scene}.png`}
      text={`Minha gangue no ${PHOTO_SCENES.find(s => s.id === scene)?.name}. Entra também: ${inviteUrl(p.referral.code)}`}
      make={() => renderPhoto(p, scene, pose, caption)} onClose={onClose} deps={[scene, pose, caption]}>
      <div className="photo-controls">
        <div className="chips">
          {PHOTO_SCENES.map(s => <button key={s.id} className={scene === s.id ? 'chip active' : 'chip'} onClick={() => setScene(s.id)}>{s.name}</button>)}
        </div>
        <div className="chips">
          {PHOTO_POSES.map(s => <button key={s.id} className={pose === s.id ? 'chip active' : 'chip'} onClick={() => setPose(s.id)}>{s.name}</button>)}
        </div>
        <input value={typed} maxLength={40} onChange={e => setTyped(e.target.value)} placeholder="Legenda (opcional)" aria-label="Legenda" />
      </div>
    </ShareImage>
  );
}

export function ProfileModal({ code, onClose }: { code: string; onClose: () => void }) {
  const [pr, setPr] = useState<Profile | null>(null);
  const [err, setErr] = useState('');
  const [sharing, setSharing] = useState(false);
  useEffect(() => { api.profile(code).then(setPr).catch(e => setErr((e as Error).message)); }, [code]);

  if (sharing && pr) {
    return <ShareImage title="Ficha criminal" filename={`ficha-${pr.nick}.png`}
      text={`Ficha criminal de ${pr.nick} na Costa Dourada: nível ${pr.level}, ${formatCash(pr.stats.cashEarned)} ganhos. ${profileUrl(pr.code)}`}
      make={() => renderProfile(pr)} onClose={() => setSharing(false)} />;
  }
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Ficha criminal" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal profile">
        <div className="row">
          <h2>Ficha criminal</h2>
          <button className="ghost small" onClick={onClose}>Fechar</button>
        </div>
        {err && <p className="msg bad">{err}</p>}
        {!pr && !err && <p className="muted">Puxando a ficha…</p>}
        {pr && <ProfileBody pr={pr} />}
        {pr && (
          <div className="alert-actions">
            <button onClick={() => setSharing(true)}>Compartilhar ficha</button>
            <button className="ghost" onClick={() => navigator.clipboard?.writeText(profileUrl(pr.code))}>Copiar link</button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProfileBody({ pr }: { pr: Profile }) {
  const { outfit, car } = profileLook(pr);
  const stats: [string, string][] = [
    ['Grana ganha', formatCash(pr.stats.cashEarned)], ['Maior golpe', formatCash(pr.stats.biggestHeist)],
    ['Assaltos', pr.stats.robberies.toLocaleString('pt-BR')], ['Vezes preso', String(pr.stats.jailed)],
    ['Lavado', formatCash(pr.stats.laundered)], ['Golpes em equipe', String(pr.stats.teamHeists)],
    ['Recorde no Autódromo', `${pr.stats.raceBest} m`], ['Dias na ativa', String(pr.stats.playDays)],
  ];
  return (
    <div className="profile-body">
      <div className="profile-head">
        <DrawCanvas w={120} h={120} deps={[pr.code]} label={`Visual de ${pr.nick}`} draw={g => {
          g.fillStyle = '#c9c1aa'; g.fillRect(0, 0, 120, 120);
          drawCar(g, 78, 82, -0.3, car, 2.4);
          drawPerson(g, 40, 58, Math.PI / 2, outfit, 0, '#2a1d14', 9);
        }} />
        <div>
          <h3>{pr.nick} {pr.vip && <span className="badge vip">★ Clube</span>} {pr.founder && <span className="badge">Fundador</span>}</h3>
          <p className="small">Nível {pr.level} · {pr.crew ? `[${pr.crew.tag}] ${pr.crew.name}` : 'sem bonde'} · {DISTRICTS.find(d => d.id === pr.district)?.name}</p>
          <p className="small muted">Código {pr.code}</p>
        </div>
      </div>
      <div className="stat-grid">
        {stats.map(([k, v]) => <div key={k}><small>{k}</small><strong>{v}</strong></div>)}
      </div>
      <h4>Troféus ({pr.trophies.length}/{TROPHIES.length})</h4>
      <div className="trophies">
        {TROPHIES.map(t => <span key={t.id} className={pr.trophies.includes(t.id) ? 'trophy on' : 'trophy'} title={t.description}>{t.name}</span>)}
      </div>
      {pr.rares.length > 0 && (
        <>
          <h4>Raros</h4>
          <p className="small">{pr.rares.map(r => `${r.name} #${String(r.serial).padStart(4, '0')}`).join(' · ')}</p>
        </>
      )}
    </div>
  );
}
