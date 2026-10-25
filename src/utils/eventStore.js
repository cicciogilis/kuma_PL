import { onValue, ref, remove, set } from 'firebase/database';
import { db } from './firebase';

export const FEDERATIONS = ['FIPL', 'FIPE', 'WPC', 'WDFPF', 'FIAP', 'WRPF'];

export const EVENT_TYPES = [
  { key: 'full', label: 'Gara completa' },
  { key: 'single', label: 'Single lift' },
];

export const SINGLE_LIFTS = [
  { key: 'squat', label: 'Squat' },
  { key: 'panca', label: 'Panca' },
  { key: 'stacco', label: 'Stacco' },
];

const sanitize = (value) => JSON.parse(JSON.stringify(value ?? null));

const normalizeMap = (raw) =>
  raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};

const athleteKeysOf = (event) => Object.keys(normalizeMap(event?.athletes));

const normalizeEvent = (id, value) => {
  if (!value || typeof value !== 'object') return null;
  return {
    ...value,
    id: value.id || id,
    athletes: normalizeMap(value.athletes),
    federation: value.federation || '',
    type: value.type === 'single' ? 'single' : 'full',
    singleLift: value.singleLift || null,
  };
};

export const normalizeEvents = (raw) => {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([id, value]) => normalizeEvent(id, value))
    .filter(Boolean);
};

export const subscribeEvents = (onData, onError) =>
  onValue(
    ref(db, 'events'),
    (snapshot) => onData(normalizeEvents(snapshot.val())),
    (error) => {
      console.error('Errore durante la lettura degli eventi:', error);
      onError?.(error);
    }
  );

export const subscribeEvent = (eventId, onData, onError) => {
  if (!eventId) return () => {};
  return onValue(
    ref(db, `events/${eventId}`),
    (snapshot) => onData(snapshot.val() ? normalizeEvent(eventId, snapshot.val()) : null),
    (error) => {
      console.error('Errore durante la lettura dell\'evento:', error);
      onError?.(error);
    }
  );
};

export const eventAthleteKeys = athleteKeysOf;

// Salva l'evento. Gli atleti convocati sono la sola fonte di verità: non serve
// più duplicare gli inviti sotto `users/<key>/eventInvites`.
export const saveEvent = (event) =>
  set(ref(db, `events/${event.id}`), sanitize(event));

export const deleteEvent = (eventId) => {
  if (!eventId) return Promise.resolve();
  return remove(ref(db, `events/${eventId}`));
};

// Eventi in cui l'atleta è convocato. Un solo listener su `events` così la
// convocazione compare anche per gli eventi creati prima degli inviti.
export const subscribeAthleteEvents = (athleteKey, onData, onError) => {
  if (!athleteKey) return () => {};
  return onValue(
    ref(db, 'events'),
    (snapshot) => {
      const events = normalizeEvents(snapshot.val())
        .filter((event) => Boolean(event.athletes && event.athletes[athleteKey]));
      onData(events);
    },
    (error) => {
      console.error("Errore durante la lettura delle convocazioni:", error);
      onError?.(error);
    }
  );
};
