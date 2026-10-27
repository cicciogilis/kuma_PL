// Sveglia del timer di recupero: suono + notifica di sistema.
//
// Il suono passa da un vero elemento <audio> (non dalla Web Audio API) perché
// solo la riproduzione di un media element fa richiedere il focus audio al
// sistema: su Android e iOS questo mette in pausa la musica in riproduzione e
// la fa riprendere quando l'elemento viene fermato.
//
// Limite noto della piattaforma web: a pagina/browser chiusi nessuno script può
// essere eseguito, quindi la sveglia può partire solo mentre l'app è viva
// (in primo piano o in background). Per l'app nativa serve un plugin di
// notifiche locali programmate (vedi nota in fondo al file).

const ALARM_TAG = 'kuma-rest-timer';
const SERVICE_WORKER_URL = '/sw.js';

let audioElement = null;
let alarmUrl = null;
let audioUnlocked = false;

// Beep di ~1 secondo (due impulsi a 880 Hz) generato come WAV: nessun asset
// da scaricare e il file resta valido anche offline.
const buildBeepUrl = () => {
  const rate = 22050;
  const beep = 0.14;
  const cycle = 0.5;
  const total = Math.round(rate * cycle * 2);
  const samples = new Int16Array(total);

  for (let index = 0; index < total; index += 1) {
    const time = index / rate;
    const position = time % cycle;
    if (position < beep) {
      const attack = Math.min(1, position / 0.012);
      const release = Math.min(1, (beep - position) / 0.025);
      const envelope = Math.max(0, Math.min(attack, release));
      samples[index] = Math.round(
        Math.sin(2 * Math.PI * 880 * time) * 0.32 * 32767 * envelope
      );
    }
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(44 + index * 2, samples[index], true);
  }

  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
};

const getAudioElement = () => {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;

  if (!audioElement) {
    audioElement = new Audio();
    audioElement.loop = true;
    audioElement.preload = 'auto';
    audioElement.setAttribute('playsinline', '');
  }

  return audioElement;
};

const attachSource = (audio) => {
  if (!audio.getAttribute('src')) {
    if (!alarmUrl) alarmUrl = buildBeepUrl();
    audio.src = alarmUrl;
  }
  return audio;
};

// Rilascio completo del focus audio. La sola pausa non basta: il media element
// resta "vivo" e il sistema tiene la musica delle altre app abbassata (ducking)
// anche dopo lo stop. Togliendo la sorgente il browser abbandona il focus.
const releaseAudioFocus = (audio) => {
  audio.pause();
  try {
    audio.currentTime = 0;
  } catch {
    // Sorgente già rimossa.
  }
  audio.removeAttribute('src');
  audio.load();

  if (typeof navigator !== 'undefined' && navigator.mediaSession) {
    try {
      navigator.mediaSession.playbackState = 'none';
      navigator.mediaSession.metadata = null;
    } catch {
      // Media Session non disponibile.
    }
  }
};

// Da chiamare su un gesto dell'utente (tap su "Avvia"): sblocca la
// riproduzione futura, altrimenti iOS blocca il suono quando arriva la sveglia.
// Resta muto di proposito: così non chiede il focus audio e non abbassa la
// musica già in riproduzione mentre l'utente sta solo impostando il recupero.
export const unlockAlarmAudio = () => {
  const audio = getAudioElement();
  if (!audio || audioUnlocked) return;

  attachSource(audio);
  audio.muted = true;
  const attempt = audio.play();
  if (!attempt || typeof attempt.then !== 'function') {
    audio.muted = false;
    return;
  }

  attempt
    .then(() => {
      audioUnlocked = true;
      audio.pause();
      audio.currentTime = 0;
      audio.muted = false;
      audio.volume = 1;
    })
    .catch(() => {
      audio.muted = false;
      audio.volume = 1;
    });
};

export const startAlarmAudio = () => {
  const audio = getAudioElement();
  if (!audio) return;

  attachSource(audio);
  audio.muted = false;
  audio.volume = 1;
  try {
    audio.currentTime = 0;
  } catch {
    // Sorgente non ancora pronta: la riproduzione parte comunque.
  }

  const attempt = audio.play();
  if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {});
};

export const stopAlarmAudio = () => {
  if (!audioElement) return;
  releaseAudioFocus(audioElement);
};

export const registerTimerServiceWorker = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;

  try {
    const existing = await navigator.serviceWorker.getRegistration();
    if (existing) return existing;
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL);
  } catch {
    return null;
  }
};

export const ensureNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;

  try {
    return (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
};

const notificationOptions = (body) => ({
  body,
  icon: '/logo192.png',
  badge: '/logo192.png',
  tag: ALARM_TAG,
  renotify: true,
  requireInteraction: true,
  // Il suono lo fa il beep dell'app: evita il doppio avviso di sistema.
  silent: true,
  vibrate: [220, 120, 220],
  data: { url: '/' },
});

export const showTimerNotification = async ({ minutes }) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const body = `Il recupero di ${minutes} min è terminato. Tocca per fermare la sveglia.`;

  try {
    const registration =
      (await navigator.serviceWorker?.getRegistration?.()) ||
      (await registerTimerServiceWorker());

    if (registration?.showNotification) {
      await registration.showNotification('Tempo scaduto', notificationOptions(body));
      return;
    }

    new Notification('Tempo scaduto', notificationOptions(body));
  } catch {
    // La notifica è un extra: se il sistema la rifiuta il timer suona comunque.
  }
};

export const closeTimerNotification = async () => {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    const pending = await registration?.getNotifications?.({ tag: ALARM_TAG });
    pending?.forEach((notification) => notification.close());
  } catch {
    // Nessuna notifica da chiudere.
  }
};

// Il service worker avvisa quando l'utente tocca la notifica: l'app ferma la
// sveglia come se si fosse premuto "Stop".
export const subscribeTimerNotificationClick = (handler) => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return () => {};
  }

  const listener = (event) => {
    if (event.data?.type === 'kuma-timer-stop') handler();
  };

  navigator.serviceWorker.addEventListener('message', listener);
  return () => navigator.serviceWorker.removeEventListener('message', listener);
};
