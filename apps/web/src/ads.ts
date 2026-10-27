// Anúncio recompensado para despistar a polícia.
// Produção: Google H5 Games Ads (Ad Placement API, adBreak type 'reward'). Precisa de conta
// AdSense aprovada no programa H5 Games Ads e de VITE_ADSENSE_CLIENT=ca-pub-... no .env do site.
// Sem isso (ou sem anúncio disponível na hora), o jogo mostra uma espera curta no lugar,
// para o jogador nunca ficar travado.

type AdResult = 'viewed' | 'dismissed' | 'unavailable';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (o: Record<string, unknown>) => void;
    adConfig?: (o: Record<string, unknown>) => void;
  }
}

const CLIENT = import.meta.env.VITE_ADSENSE_CLIENT as string | undefined;
const TEST_MODE = (import.meta.env.VITE_ADS_TEST as string | undefined) !== 'off';
let ready = false;

export const adsConfigured = () => Boolean(CLIENT);

export function initAds() {
  if (!CLIENT || document.getElementById('h5-ads')) return;
  const s = document.createElement('script');
  s.id = 'h5-ads';
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT}`;
  if (TEST_MODE) s.setAttribute('data-adbreak-test', 'on'); // anúncios de teste até você desligar
  s.setAttribute('data-ad-frequency-hint', '30s');
  document.head.appendChild(s);
  window.adsbygoogle = window.adsbygoogle || [];
  window.adBreak = window.adConfig = (o) => { window.adsbygoogle!.push(o); };
  window.adConfig({ preloadAdBreaks: 'on', sound: 'on', onReady: () => { ready = true; } });
}

/** Mostra o anúncio recompensado. O jogador já aceitou no botão do jogo, então exibimos direto. */
export function showRewardedAd(): Promise<AdResult> {
  if (!CLIENT || !ready || !window.adBreak) return Promise.resolve('unavailable');
  return new Promise(resolve => {
    let done = false;
    const finish = (r: AdResult) => { if (!done) { done = true; resolve(r); } };
    window.adBreak!({
      type: 'reward',
      name: 'despistar-policia',
      beforeAd: () => {},
      afterAd: () => {},
      beforeReward: (showAdFn: () => void) => showAdFn(),
      adDismissed: () => finish('dismissed'),
      adViewed: () => finish('viewed'),
      adBreakDone: (info: { breakStatus?: string }) => finish(info?.breakStatus === 'viewed' ? 'viewed' : info?.breakStatus === 'dismissed' ? 'dismissed' : 'unavailable'),
    });
    setTimeout(() => finish('unavailable'), 60_000); // segurança: nunca trava
  });
}
