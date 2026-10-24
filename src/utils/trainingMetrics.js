import { formatDateIt, formatIsoDate, parseLocalDate, workoutKey } from './programData.js';
import { getMaxForLift } from './programDisplay.js';

export const PHASE_DEFINITIONS = [
  { key: 'accumulo', label: 'Accumulo', color: '#3b82f6' },
  { key: 'intensificazione', label: 'Intensificazione', color: '#f59e0b' },
  { key: 'peaking', label: 'Peaking/Picco', color: '#ef4444' },
  { key: 'deload', label: 'Deload', color: '#94a3b8' },
];

const PHASE_THRESHOLDS = {
  intensificationIntensity: 80,
  peakingIntensity: 92,
  intensificationRpe: 8,
  peakingRpe: 9.5,
  deloadVolumeRatio: 0.5,
  lowVolumeRatio: 0.35,
  highVolumeRatio: 0.7,
};

const MAX_WEEKS = 52;

const toInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const round = (value, digits = 1) => {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const parseReps = (value) => {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value > 0 ? value : null;
  }

  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;

  const parsed = Number.parseInt(text, 10);
  return parsed > 0 ? parsed : null;
};

const parseRpe = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const parsePercent = (value) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getProgramDurationWeeks = (program) => {
  const configured = toInteger(program?.durationWeeks);
  if (configured != null && configured > 0) return clamp(configured, 1, MAX_WEEKS);

  const weekNumbers = (program?.weeks || [])
    .map((week) => toInteger(week?.week))
    .filter((week) => week != null && week >= 1);

  if (weekNumbers.length) return clamp(Math.max(...weekNumbers), 1, MAX_WEEKS);
  return 1;
};

/**
 * Stima la percentuale di 1RM di una serie partendo da RPE e ripetizioni.
 *
 * RIR = 10 - RPE (RPE 10 = 0 ripetizioni di riserva).
 * Le ripetizioni massime stimate sono reps + RIR; il carico viene ricavato
 * con Epley e il caso 1RM (una ripetizione a RPE 10) resta ancorato al 100%.
 * È una stima, non una conversione esatta: serve a non perdere i blocchi
 * pianificati solo con RPE.
 */
export const estimatePercentFromRpe = (reps, rpe) => {
  const parsedReps = parseReps(reps);
  const parsedRpe = parseRpe(rpe);
  if (parsedReps == null || parsedRpe == null) return null;

  const safeRpe = clamp(parsedRpe, 1, 10);
  const rir = Math.max(0, 10 - safeRpe);
  const estimatedMaxReps = parsedReps + rir;

  if (estimatedMaxReps <= 1) return 100;

  const percent = 100 / (1 + estimatedMaxReps / 30);
  return Number.isFinite(percent) && percent > 0 ? percent : null;
};

/**
 * Deduce le fasi del mesociclo dai dati settimanali dell'alzata selezionata.
 *
 * Soglie ispirate alla tabella della specifica:
 * - intensità < 80%: Accumulo
 * - intensità 80-92%: Intensificazione
 * - intensità >= 92%: Peaking/Picco
 * - volume <= 50% della media delle 3 settimane precedenti: Deload,
 *   a meno che l'intensità non sia già da Peaking.
 *
 * Se l'intensità manca si usa l'RPE; se manca anche quello si usa il volume
 * relativo al massimo della serie. Le fasi sono intervalli contigui e
 * vengono restituite nell'ordine delle settimane.
 */
export const detectProgramPhases = (weeklyData = []) => {
  const rows = Array.isArray(weeklyData) ? weeklyData : [];
  const volumes = rows
    .map((row) => row?.volume)
    .filter((volume) => Number.isFinite(volume) && volume > 0);
  const maxVolume = volumes.length ? Math.max(...volumes) : 0;
  const ranges = [];
  const previousVolumes = [];
  let current = null;

  rows.forEach((row) => {
    const week = toInteger(row?.week);
    const volume = Number.isFinite(row?.volume) ? row.volume : null;
    const intensity = Number.isFinite(row?.intensity) ? row.intensity : null;
    const rpe = Number.isFinite(row?.rpe) ? row.rpe : null;
    const reference = previousVolumes.length
      ? previousVolumes.reduce((sum, value) => sum + value, 0) / previousVolumes.length
      : null;
    const isDeload = (
      volume != null
      && reference != null
      && reference > 0
      && volume <= reference * PHASE_THRESHOLDS.deloadVolumeRatio
    );

    let phaseKey = null;

    if (week != null) {
      if (intensity != null) {
        if (intensity >= PHASE_THRESHOLDS.peakingIntensity) {
          phaseKey = 'peaking';
        } else if (isDeload) {
          phaseKey = 'deload';
        } else if (intensity >= PHASE_THRESHOLDS.intensificationIntensity) {
          phaseKey = 'intensificazione';
        } else {
          phaseKey = 'accumulo';
        }
      } else if (rpe != null) {
        if (isDeload) {
          phaseKey = 'deload';
        } else if (rpe >= PHASE_THRESHOLDS.peakingRpe) {
          phaseKey = 'peaking';
        } else if (rpe >= PHASE_THRESHOLDS.intensificationRpe) {
          phaseKey = 'intensificazione';
        } else {
          phaseKey = 'accumulo';
        }
      } else if (volume != null && maxVolume > 0) {
        if (isDeload) {
          phaseKey = 'deload';
        } else {
          const ratio = volume / maxVolume;
          if (ratio <= PHASE_THRESHOLDS.lowVolumeRatio) {
            phaseKey = 'peaking';
          } else if (ratio >= PHASE_THRESHOLDS.highVolumeRatio) {
            phaseKey = 'accumulo';
          } else {
            phaseKey = 'intensificazione';
          }
        }
      }
    }

    if (phaseKey == null) {
      current = null;
    } else if (current && current.key === phaseKey && week === current.to + 1) {
      current.to = week;
    } else {
      const definition = PHASE_DEFINITIONS.find((phase) => phase.key === phaseKey);
      if (definition) {
        current = { ...definition, from: week, to: week };
        ranges.push(current);
      }
    }

    if (volume != null) {
      previousVolumes.push(volume);
      if (previousVolumes.length > 3) previousVolumes.shift();
    }
  });

  return ranges;
};

export const getWeekStartDate = (program, weekNumber) => {
  const start = parseLocalDate(program?.startDate);
  const week = toInteger(weekNumber);
  if (!start || week == null || week < 1) return null;

  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + (week - 1) * 7
  );
};

const DAY_LABELS = {
  1: 'Lunedì',
  2: 'Martedì',
  3: 'Mercoledì',
  4: 'Giovedì',
  5: 'Venerdì',
  6: 'Sabato',
  7: 'Domenica',
};

const getSessionExposure = (lift) => {
  if (!lift || !Array.isArray(lift.blocks)) return false;

  return lift.blocks.some((block) => {
    const sets = toInteger(block?.sets);
    const hasReps = block?.reps != null && String(block.reps).trim() !== '';
    return sets != null && sets > 0 && hasReps;
  });
};

const getSessionLifts = (session, liftKey) =>
  (session?.lifts || []).filter((lift) => {
    if (!lift) return false;
    if (liftKey && lift.key !== liftKey) return false;
    return true;
  });

const appendProgramLines = (lines, lifts) => {
  lifts.forEach((lift) => {
    const raw = String(lift?.raw ?? '').trim();
    if (raw && !lines.includes(raw)) lines.push(raw);
  });
};

const createMetricsAccumulator = () => ({
  volume: 0,
  intensityWeighted: 0,
  intensityReps: 0,
  rpeWeighted: 0,
  rpeReps: 0,
  setsTotal: 0,
  repsTotal: 0,
  hasVolumeData: false,
  hasIntensityData: false,
  hasRpeData: false,
  hasEstimatedVolume: false,
  hasEstimatedIntensity: false,
});

const addBlockMetrics = (accumulator, block, max) => {
  const blockSets = toInteger(block?.sets);
  const blockReps = parseReps(block?.reps);
  if (!blockSets || blockSets < 1 || !blockReps) return;

  const blockRepsTotal = blockSets * blockReps;
  accumulator.setsTotal += blockSets;
  accumulator.repsTotal += blockRepsTotal;

  const rpe = parseRpe(block?.rpe);
  if (rpe != null) {
    accumulator.rpeWeighted += rpe * blockRepsTotal;
    accumulator.rpeReps += blockRepsTotal;
    accumulator.hasRpeData = true;
  }

  let percent = null;
  let isEstimated = false;

  if (block?.percentBase) {
    // La percentuale è relativa al carico di un blocco RPE, non al
    // massimale: stimiamo prima quel carico, poi applichiamo la
    // percentuale relativa.
    const baseReps = parseReps(block.percentBase.reps) ?? blockReps;
    const baseRpe = parseRpe(block.percentBase.rpe) ?? rpe;
    const basePercent = estimatePercentFromRpe(baseReps, baseRpe);
    const relativePercent = parsePercent(block?.percent);

    if (basePercent != null && relativePercent != null) {
      percent = (basePercent * relativePercent) / 100;
      isEstimated = true;
    }
  } else {
    const directPercent = parsePercent(block?.percent);

    if (directPercent != null) {
      percent = directPercent;
    } else if (rpe != null) {
      percent = estimatePercentFromRpe(blockReps, rpe);
      isEstimated = percent != null;
    }
  }

  if (percent == null) return;

  accumulator.intensityWeighted += percent * blockRepsTotal;
  accumulator.intensityReps += blockRepsTotal;
  accumulator.hasIntensityData = true;
  if (isEstimated) accumulator.hasEstimatedIntensity = true;

  if (max == null) return;
  accumulator.volume += (max * percent * blockRepsTotal) / 100;
  accumulator.hasVolumeData = true;
  if (isEstimated) accumulator.hasEstimatedVolume = true;
};

const addLiftMetrics = (accumulator, lift, max) => {
  (lift?.blocks || []).forEach((block) => {
    addBlockMetrics(accumulator, block, max);
  });
};

const finalizeMetrics = (accumulator) => ({
  volume: accumulator.hasVolumeData ? round(accumulator.volume) : null,
  intensity: accumulator.hasIntensityData
    ? round(accumulator.intensityWeighted / accumulator.intensityReps)
    : null,
  rpe: accumulator.hasRpeData
    ? round(accumulator.rpeWeighted / accumulator.rpeReps)
    : null,
  sets: accumulator.setsTotal,
  reps: accumulator.repsTotal,
  estimated: accumulator.hasEstimatedVolume || accumulator.hasEstimatedIntensity,
  estimatedVolume: accumulator.hasEstimatedVolume,
  estimatedIntensity: accumulator.hasEstimatedIntensity,
});

const getSessionDate = (program, weekNumber, dayNumber) => {
  const start = parseLocalDate(program?.startDate);
  const week = toInteger(weekNumber);
  const day = toInteger(dayNumber);
  if (!start || week == null || week < 1 || day == null || day < 1) return null;

  return new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + (week - 1) * 7 + (day - 1)
  );
};

const getSessionX = (weekNumber, dayNumber) => {
  const day = clamp(toInteger(dayNumber) || 1, 1, 7);
  return weekNumber - 0.5 + day / 7;
};

export const aggregateWeeklyMetrics = ({
  program,
  prMaxes = null,
  completions = {},
  liftKey = null,
}) => {
  const duration = getProgramDurationWeeks(program);
  const weeks = Array.isArray(program?.weeks) ? program.weeks : [];
  const rows = [];

  for (let weekNumber = 1; weekNumber <= duration; weekNumber += 1) {
    const week = weeks.find(
      (candidate) => toInteger(candidate?.week) === weekNumber
    );
    const sessions = (Array.isArray(week?.sessions) ? week.sessions : [])
      .slice()
      .sort((a, b) => (toInteger(a?.day) || 0) - (toInteger(b?.day) || 0));
    const accumulator = createMetricsAccumulator();
    const programLines = [];
    let sessionsCount = 0;
    let completedCount = 0;

    sessions.forEach((session) => {
      const lifts = getSessionLifts(session, liftKey);
      if (!lifts.length) return;
      if (!lifts.some(getSessionExposure)) return;

      sessionsCount += 1;
      if (completions?.[workoutKey(program?.id, weekNumber, session?.day)]) {
        completedCount += 1;
      }

      appendProgramLines(programLines, lifts);
      lifts.forEach((lift) => {
        addLiftMetrics(accumulator, lift, getMaxForLift(program, lift, prMaxes));
      });
    });

    const metrics = finalizeMetrics(accumulator);
    const weekStart = getWeekStartDate(program, weekNumber);
    const weekStartIso = weekStart ? formatIsoDate(weekStart) : '';

    rows.push({
      ...metrics,
      week: weekNumber,
      x: weekNumber,
      weekLabel: `W${weekNumber}`,
      weekTitle: `Week ${weekNumber}`,
      weekStartIso,
      weekStartLabel: weekStartIso ? formatDateIt(weekStartIso) : '',
      program: programLines.join('\n'),
      frequency: sessionsCount,
      sessions: sessionsCount,
      completed: completedCount,
    });
  }

  return rows;
};

export const aggregateSessionMetrics = ({
  program,
  prMaxes = null,
  completions = {},
  liftKey = null,
}) => {
  const duration = getProgramDurationWeeks(program);
  const weeks = Array.isArray(program?.weeks) ? program.weeks : [];
  const weeklyRows = aggregateWeeklyMetrics({
    program,
    prMaxes,
    completions,
    liftKey,
  });
  const weeklyByWeek = new Map(weeklyRows.map((row) => [row.week, row]));
  const rows = [];

  for (let weekNumber = 1; weekNumber <= duration; weekNumber += 1) {
    const week = weeks.find(
      (candidate) => toInteger(candidate?.week) === weekNumber
    );
    const sessions = (Array.isArray(week?.sessions) ? week.sessions : [])
      .slice()
      .sort((a, b) => (toInteger(a?.day) || 0) - (toInteger(b?.day) || 0));
    const weekly = weeklyByWeek.get(weekNumber);
    let weekRowsCount = 0;

    sessions.forEach((session) => {
      const lifts = getSessionLifts(session, liftKey);
      if (!lifts.length) return;
      if (!lifts.some(getSessionExposure)) return;

      const accumulator = createMetricsAccumulator();
      const programLines = [];
      appendProgramLines(programLines, lifts);
      lifts.forEach((lift) => {
        addLiftMetrics(accumulator, lift, getMaxForLift(program, lift, prMaxes));
      });

      const metrics = finalizeMetrics(accumulator);
      const sessionDay = toInteger(session?.day);
      const hasDay = sessionDay != null && sessionDay >= 1 && sessionDay <= 7;
      const sessionDate = hasDay
        ? getSessionDate(program, weekNumber, sessionDay)
        : null;
      const sessionDateIso = sessionDate ? formatIsoDate(sessionDate) : '';

      rows.push({
        ...metrics,
        week: weekNumber,
        x: hasDay ? getSessionX(weekNumber, sessionDay) : weekNumber,
        weekLabel: `W${weekNumber}`,
        weekTitle: `Week ${weekNumber}`,
        weekStartIso: weekly?.weekStartIso || '',
        weekStartLabel: weekly?.weekStartLabel || '',
        program: programLines.join('\n'),
        sessionDay: hasDay ? sessionDay : null,
        sessionLabel: hasDay ? DAY_LABELS[sessionDay] : 'Seduta',
        sessionDateIso,
        sessionDateLabel: sessionDateIso ? formatDateIt(sessionDateIso) : '',
        sessionCompleted: Boolean(
          completions?.[workoutKey(program?.id, weekNumber, session?.day)]
        ),
        frequency: weekly?.frequency ?? 0,
        weeklyFrequency: weekly?.frequency ?? 0,
        weeklyCompleted: weekly?.completed ?? 0,
        completed: weekly?.completed ?? 0,
        sessions: 1,
      });
      weekRowsCount += 1;
    });

    if (!weekRowsCount) {
      rows.push({
        week: weekNumber,
        x: weekNumber,
        weekLabel: `W${weekNumber}`,
        weekTitle: `Week ${weekNumber}`,
        weekStartIso: weekly?.weekStartIso || '',
        weekStartLabel: weekly?.weekStartLabel || '',
        program: '',
        volume: null,
        intensity: null,
        rpe: null,
        sets: 0,
        reps: 0,
        estimated: false,
        estimatedVolume: false,
        estimatedIntensity: false,
        frequency: 0,
        weeklyFrequency: 0,
        weeklyCompleted: 0,
        completed: 0,
        sessions: 0,
      });
    }
  }

  return rows;
};
