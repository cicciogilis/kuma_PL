// Crea (o sostituisce) una scheda di prova per l'utente QA, con due giorni di
// complementari, per verificare la UI di modifica in un browser reale.
const DB = 'https://sbd-ladder-default-rtdb.europe-west1.firebasedatabase.app';
const username = 'qa_switch_test';

const block = (sets, reps, percent = null) => ({
  sets,
  reps: String(reps),
  rpe: null,
  percent,
  percentBase: null,
  note: '',
});

const lift = (key, label, blocks) => ({ key, label, blocks, notes: '' });

const sessions = [
  {
    day: 1,
    weekday: 'Lunedì',
    lifts: [
      lift('squat', 'Squat', [block(5, 5, 75), block(3, 3, 85)]),
      lift('panca', 'Panca', [block(4, 6, 70)]),
    ],
  },
  {
    day: 2,
    weekday: 'Giovedì',
    lifts: [
      lift('stacco', 'Stacco', [block(4, 4, 80)]),
      lift('panca', 'Panca', [block(5, 5, 72)]),
    ],
  },
];

const weeks = [1, 2, 3, 4].map((week) => ({
  week,
  sessions: sessions.map((session) => ({
    ...session,
    lifts: session.lifts.map((item) => ({ ...item, blocks: item.blocks.map((b) => ({ ...b })) })),
  })),
}));

const complementari = [
  {
    day: 1,
    name: 'Upper',
    weekday: 'Lunedì',
    exercises: [
      { name: 'Leg curl', blocks: [block(3, 8), block(4, 6)], notes: '' },
      { name: 'Lat machine', blocks: [block(4, 10)], notes: 'nota lat' },
    ],
  },
  {
    day: 2,
    name: 'Lower',
    weekday: 'Giovedì',
    exercises: [{ name: 'Calf raise', blocks: [block(4, 12)], notes: '' }],
  },
];

const today = new Date();
const iso = (date) => date.toISOString().slice(0, 10);

const program = {
  id: 'qa-program-1',
  name: 'Scheda QA',
  startDate: iso(new Date(today.getTime() - 7 * 86400000)),
  durationWeeks: '4',
  usePrMax: true,
  weeks,
  complementari,
  stats: { weeks: 4, sessions: 8, lifts: 3, complementari: 3 },
  createdAt: new Date().toISOString(),
};

const res = await fetch(`${DB}/users/${username}/programs/${program.id}.json`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(program),
});
console.log('program seed', res.status);
