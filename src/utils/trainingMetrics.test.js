import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateSessionMetrics,
  aggregateWeeklyMetrics,
  detectProgramPhases,
  estimatePercentFromRpe,
  getProgramDurationWeeks,
} from './trainingMetrics.js';
import { workoutKey } from './programData.js';

const makeLift = (key, blocks, extra = {}) => ({ key, blocks, ...extra });

const makeSession = (day, lifts) => ({ day, lifts });

const makeWeek = (week, sessions = []) => ({ week, sessions });

const makeProgram = (overrides = {}) => ({
  id: 'program-1',
  name: 'Scheda test',
  startDate: '2026-10-21',
  durationWeeks: 1,
  usePrMax: false,
  maxes: {
    squat: 100,
    panca: 80,
    deadlift: 150,
    staccoClassico: 150,
    staccoSumo: 0,
  },
  weeks: [],
  ...overrides,
});

test('volume 4x6 al 100% con massimale 100 = 2400 kg', () => {
  const program = makeProgram({
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [{ sets: 4, reps: '6', percent: 100 }]),
        ]),
      ]),
    ],
  });

  const [row] = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });

  assert.equal(row.volume, 2400);
  assert.equal(row.intensity, 100);
  assert.equal(row.frequency, 1);
  assert.equal(row.sets, 4);
  assert.equal(row.reps, 24);
  assert.equal(row.density, undefined);
});

test('percentuali con virgola e massimale producono kg corretti', () => {
  const program = makeProgram({
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [{ sets: 2, reps: '2', percent: '82,5' }]),
        ]),
      ]),
    ],
  });

  const [row] = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });

  assert.equal(row.volume, 330);
  assert.equal(row.intensity, 82.5);
});

test('volume 80x5 + 100x3 = 700 kg e intensità pesata 87,5%', () => {
  const program = makeProgram({
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [
            { sets: 1, reps: '5', percent: 80 },
            { sets: 1, reps: '3', percent: 100 },
          ]),
        ]),
      ]),
    ],
  });

  const [row] = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });

  assert.equal(row.volume, 700);
  assert.equal(row.intensity, 87.5);
  assert.equal(row.sets, 2);
  assert.equal(row.reps, 8);
});

test('frequenza conta sedute distinte e completamenti nella stessa settimana', () => {
  const program = makeProgram({
    durationWeeks: 2,
    weeks: [
      makeWeek(1, [
        makeSession(1, [makeLift('squat', [{ sets: 3, reps: '5', percent: 80 }])]),
        makeSession(3, [makeLift('squat', [{ sets: 3, reps: '5', percent: 80 }])]),
      ]),
      makeWeek(2, []),
    ],
  });

  const rows = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {
      [workoutKey(program.id, 1, 1)]: true,
    },
    liftKey: 'squat',
  });

  assert.equal(rows[0].frequency, 2);
  assert.equal(rows[0].completed, 1);
  assert.equal(rows[1].frequency, 0);
  assert.equal(rows[1].volume, null);
  assert.equal(rows[1].intensity, null);
  assert.equal(rows[1].rpe, null);
});

test('senza massimale il volume è n.d. ma l\'intensità pianificata resta disponibile', () => {
  const program = makeProgram({
    maxes: { squat: 0 },
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [{ sets: 3, reps: '5', percent: 80 }]),
        ]),
      ]),
    ],
  });

  const [row] = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });

  assert.equal(row.volume, null);
  assert.equal(row.intensity, 80);
  assert.equal(row.frequency, 1);
  assert.ok(Number.isFinite(row.reps));
});

test('la stima RPE usa RIR = 10 - RPE e ancora il massimale al 100%', () => {
  assert.equal(estimatePercentFromRpe(1, 10), 100);
  assert.ok(Math.abs(estimatePercentFromRpe(1, 9) - 93.75) < 0.001);
  assert.ok(Math.abs(estimatePercentFromRpe(5, 8) - 81.081) < 0.01);
  assert.equal(estimatePercentFromRpe(0, 8), null);
  assert.equal(estimatePercentFromRpe(5, 0), null);
});

test('i blocchi con solo RPE producono volume e intensità stimati', () => {
  const program = makeProgram({
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [{ sets: 3, reps: '5', rpe: 8 }]),
        ]),
      ]),
    ],
  });

  const [row] = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });

  assert.equal(row.volume, 1216.2);
  assert.equal(row.intensity, 81.1);
  assert.equal(row.rpe, 8);
  assert.equal(row.estimated, true);
  assert.equal(row.estimatedVolume, true);
  assert.equal(row.estimatedIntensity, true);
});

test('i blocchi percentBase stimano il carico base dall\'RPE e poi applicano la percentuale', () => {
  const program = makeProgram({
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [
            { sets: 1, reps: '2', rpe: 8 },
            {
              sets: 3,
              reps: '3',
              percent: 85,
              percentBase: { sets: 1, reps: '2', rpe: 8 },
            },
          ]),
        ]),
      ]),
    ],
  });

  const [row] = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });

  assert.equal(row.volume, 851.5);
  assert.equal(row.intensity, 77.4);
  assert.equal(row.rpe, 8);
  assert.equal(row.sets, 4);
  assert.equal(row.reps, 11);
  assert.equal(row.estimated, true);
});

test('il selettore alzata usa il massimale corrispondente', () => {
  const program = makeProgram({
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [{ sets: 4, reps: '6', percent: 100 }]),
          makeLift('panca', [{ sets: 4, reps: '6', percent: 100 }]),
        ]),
      ]),
    ],
  });

  const [squatRow] = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });
  const [pancaRow] = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'panca',
  });

  assert.equal(squatRow.volume, 2400);
  assert.equal(pancaRow.volume, 1920);
});

test('lo stacco somma classico e sumo usando il massimale della variante', () => {
  const program = makeProgram({
    maxes: {
      squat: 100,
      panca: 80,
      staccoClassico: 200,
      staccoSumo: 180,
    },
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift(
            'stacco',
            [{ sets: 2, reps: '2', percent: 100 }],
            { variant: 'classico' }
          ),
        ]),
        makeSession(2, [
          makeLift(
            'stacco',
            [{ sets: 2, reps: '2', percent: 100 }],
            { variant: 'sumo' }
          ),
        ]),
      ]),
    ],
  });

  const [row] = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'stacco',
  });

  assert.equal(row.frequency, 2);
  assert.equal(row.volume, 1520);
  assert.equal(row.intensity, 100);
});

test('le fasi vengono dedotte da intensità, volume e cali di volume', () => {
  const phases = detectProgramPhases([
    { week: 1, volume: 10000, intensity: 70, rpe: 7 },
    { week: 2, volume: 11000, intensity: 75, rpe: 7.5 },
    { week: 3, volume: 7000, intensity: 85, rpe: 8.5 },
    { week: 4, volume: 4000, intensity: 95, rpe: 9.5 },
    { week: 5, volume: 2000, intensity: 80, rpe: 8 },
    { week: 6, volume: null, intensity: null, rpe: null },
  ]);

  assert.deepEqual(
    phases.map((phase) => ({ key: phase.key, from: phase.from, to: phase.to })),
    [
      { key: 'accumulo', from: 1, to: 2 },
      { key: 'intensificazione', from: 3, to: 3 },
      { key: 'peaking', from: 4, to: 4 },
      { key: 'deload', from: 5, to: 5 },
    ]
  );
});

test('una stessa fase può comparire in intervalli non contigui', () => {
  const phases = detectProgramPhases([
    { week: 1, volume: 10000, intensity: 70, rpe: 7 },
    { week: 2, volume: 11000, intensity: 70, rpe: 7 },
    { week: 3, volume: 7000, intensity: 85, rpe: 8.5 },
    { week: 4, volume: 9000, intensity: 75, rpe: 7.5 },
  ]);

  assert.deepEqual(
    phases.map((phase) => ({ key: phase.key, from: phase.from, to: phase.to })),
    [
      { key: 'accumulo', from: 1, to: 2 },
      { key: 'intensificazione', from: 3, to: 3 },
      { key: 'accumulo', from: 4, to: 4 },
    ]
  );
});

test('senza intensità la fase usa RPE e volume, compreso il Deload', () => {
  const phases = detectProgramPhases([
    { week: 1, volume: 10000, intensity: null, rpe: 7 },
    { week: 2, volume: 4000, intensity: null, rpe: 7 },
    { week: 3, volume: 3000, intensity: null, rpe: null },
    { week: 4, volume: 8000, intensity: null, rpe: null },
  ]);

  assert.deepEqual(
    phases.map((phase) => ({ key: phase.key, from: phase.from, to: phase.to })),
    [
      { key: 'accumulo', from: 1, to: 1 },
      { key: 'deload', from: 2, to: 3 },
      { key: 'accumulo', from: 4, to: 4 },
    ]
  );
});

test('senza dati non viene dedotta alcuna fase', () => {
  assert.deepEqual(
    detectProgramPhases([
      { week: 1, volume: null, intensity: null, rpe: null },
      { week: 2, volume: null, intensity: null, rpe: null },
    ]),
    []
  );
});

test('getProgramDurationWeeks usa la durata configurata o le settimane presenti', () => {
  assert.equal(getProgramDurationWeeks(makeProgram()), 1);
  assert.equal(
    getProgramDurationWeeks(makeProgram({ durationWeeks: 6, weeks: [makeWeek(1)] })),
    6
  );
  assert.equal(
    getProgramDurationWeeks(
      makeProgram({ durationWeeks: null, weeks: [makeWeek(2), makeWeek(5)] })
    ),
    5
  );
});

test('la data di inizio settimana avanza di sette giorni', () => {
  const program = makeProgram({
    durationWeeks: 2,
    weeks: [
      makeWeek(1, [
        makeSession(1, [makeLift('squat', [{ sets: 1, reps: '1', percent: 100 }])]),
      ]),
      makeWeek(2, []),
    ],
  });

  const rows = aggregateWeeklyMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });

  assert.equal(rows[0].weekStartIso, '2026-10-21');
  assert.equal(rows[1].weekStartIso, '2026-10-28');
});

test('i punti per seduta distinguono lunedì e giovedì dentro la stessa settimana', () => {
  const program = makeProgram({
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [{ sets: 3, reps: '5', percent: 80 }]),
        ]),
        makeSession(4, [
          makeLift('squat', [{ sets: 2, reps: '2', percent: 90 }]),
        ]),
      ]),
    ],
  });

  const rows = aggregateSessionMetrics({
    program,
    prMaxes: null,
    completions: {
      [workoutKey(program.id, 1, 1)]: true,
    },
    liftKey: 'squat',
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].week, 1);
  assert.equal(rows[0].sessionLabel, 'Lunedì');
  assert.equal(rows[0].volume, 1200);
  assert.equal(rows[0].intensity, 80);
  assert.equal(rows[0].sessionCompleted, true);
  assert.equal(rows[0].weeklyFrequency, 2);
  assert.equal(rows[0].weeklyCompleted, 1);
  assert.ok(Math.abs(rows[0].x - (1 - 0.5 + 1 / 7)) < 0.000001);

  assert.equal(rows[1].sessionLabel, 'Giovedì');
  assert.equal(rows[1].volume, 360);
  assert.equal(rows[1].intensity, 90);
  assert.equal(rows[1].sessionCompleted, false);
  assert.ok(Math.abs(rows[1].x - (1 - 0.5 + 4 / 7)) < 0.000001);
  assert.equal(rows[1].sessionDateLabel, '24/10/2026');
});

test('i punti per seduta ignorano le sedute senza l\'alzata selezionata', () => {
  const program = makeProgram({
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [{ sets: 3, reps: '5', percent: 80 }]),
        ]),
        makeSession(2, [
          makeLift('panca', [{ sets: 3, reps: '5', percent: 80 }]),
        ]),
      ]),
    ],
  });

  const rows = aggregateSessionMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].sessionLabel, 'Lunedì');
  assert.equal(rows[0].weeklyFrequency, 1);
});

test('le settimane senza sedute restano vuote anche nel grafico puntuale', () => {
  const program = makeProgram({
    durationWeeks: 2,
    weeks: [
      makeWeek(1, [
        makeSession(1, [
          makeLift('squat', [{ sets: 3, reps: '5', percent: 80 }]),
        ]),
      ]),
      makeWeek(2, [
        makeSession(2, [
          makeLift('panca', [{ sets: 3, reps: '5', percent: 80 }]),
        ]),
      ]),
    ],
  });

  const rows = aggregateSessionMetrics({
    program,
    prMaxes: null,
    completions: {},
    liftKey: 'squat',
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[1].week, 2);
  assert.equal(rows[1].x, 2);
  assert.equal(rows[1].volume, null);
  assert.equal(rows[1].intensity, null);
  assert.equal(rows[1].sessions, 0);
});
