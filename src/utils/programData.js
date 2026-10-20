const pad2 = (value) => String(value).padStart(2, '0');
const DAY_MS = 24 * 60 * 60 * 1000;

export const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

export const parseLocalDate = (isoDate) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '');
  if (!match) return null;

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatDateIt = (isoDate) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate || '');
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

export const formatIsoDate = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date, days) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

const toInteger = (value) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
};

// Ogni week dura 7 giorni a partire dalla data di inizio. Il giorno della
// settimana della seduta viene cercato dentro quella finestra di 7 giorni.
export const getSessionDate = (program, week, session) => {
  const start = parseLocalDate(program?.startDate);
  const weekNumber = toInteger(week?.week);
  const sessionDay = toInteger(session?.day);

  if (
    !start ||
    weekNumber == null ||
    weekNumber < 1 ||
    sessionDay == null ||
    sessionDay < 1 ||
    sessionDay > 7
  ) {
    return null;
  }

  const startDay = start.getDay();
  const targetDay = sessionDay % 7;
  const offsetInWeek = (targetDay - startDay + 7) % 7;
  return addDays(start, (weekNumber - 1) * 7 + offsetInWeek);
};

export const getProgramWorkouts = (program) => {
  if (!program || !Array.isArray(program.weeks)) return [];

  const workouts = [];
  program.weeks.forEach((week) => {
    if (!week || !Array.isArray(week.sessions)) return;

    week.sessions.forEach((session, sessionIndex) => {
      if (!session) return;

      const date = getSessionDate(program, week, session);
      if (!date) return;

      workouts.push({
        program,
        week,
        session,
        sessionIndex,
        date,
        dateIso: formatIsoDate(date),
      });
    });
  });

  return workouts.sort((a, b) => {
    const difference = a.date.getTime() - b.date.getTime();
    if (difference !== 0) return difference;
    return a.sessionIndex - b.sessionIndex;
  });
};

export const getProgramEndDate = (program) => {
  const start = parseLocalDate(program?.startDate);
  if (!start || !Array.isArray(program?.weeks)) return null;

  const weekNumbers = program.weeks
    .filter((week) => week && Array.isArray(week.sessions) && week.sessions.length > 0)
    .map((week) => toInteger(week.week))
    .filter((number) => number != null && number >= 1);

  if (!weekNumbers.length) return null;

  const lastWeek = Math.max(...weekNumbers);
  return addDays(start, lastWeek * 7 - 1);
};

export const getDaysUntilProgramEnd = (program, today = new Date()) => {
  const end = getProgramEndDate(program);
  if (!end) return null;

  return Math.round((startOfDay(end).getTime() - startOfDay(today).getTime()) / DAY_MS);
};

export const isProgramEndingSoon = (program, today = new Date()) => {
  const start = parseLocalDate(program?.startDate);
  if (!start) return false;

  const todayStart = startOfDay(today);
  if (start.getTime() > todayStart.getTime()) return false;

  const days = getDaysUntilProgramEnd(program, todayStart);
  return days != null && days >= 0 && days <= 7;
};

export const getNextWorkout = (program, today = new Date()) => {
  const todayStart = startOfDay(today);
  return getProgramWorkouts(program).find(
    (workout) => workout.date.getTime() >= todayStart.getTime()
  ) || null;
};

export const selectActiveProgram = (programs, today = new Date()) => {
  const todayStart = startOfDay(today);
  const candidates = (programs || [])
    .map((program) => {
      const start = parseLocalDate(program?.startDate);
      const end = getProgramEndDate(program);
      if (!start || !end) return null;
      return { program, start, end };
    })
    .filter(Boolean);

  if (!candidates.length) return null;

  const active = candidates
    .filter(({ start, end }) =>
      start.getTime() <= todayStart.getTime() && todayStart.getTime() <= end.getTime()
    )
    .sort((a, b) => b.start.getTime() - a.start.getTime());

  if (active.length) return active[0].program;

  const upcoming = candidates
    .filter(({ start }) => start.getTime() > todayStart.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (upcoming.length) return upcoming[0].program;

  const ended = candidates.sort((a, b) => b.end.getTime() - a.end.getTime());
  return ended[0].program;
};

export const workoutKey = (programId, weekNumber, dayNumber) =>
  `${programId || 'program'}:${weekNumber}:${dayNumber}`;

const programStorageKey = (userId) => `kuma_programs_${userId || 'guest'}`;
const completionStorageKey = (userId) => `kuma_program_completions_${userId || 'guest'}`;

export const loadPrograms = (userId) => {
  try {
    const raw = window.localStorage.getItem(programStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (program) =>
        program &&
        typeof program === 'object' &&
        typeof program.id === 'string' &&
        Array.isArray(program.weeks)
    );
  } catch (error) {
    console.error('Impossibile leggere le programmazioni salvate:', error);
    return [];
  }
};

export const persistPrograms = (userId, programs) => {
  try {
    window.localStorage.setItem(programStorageKey(userId), JSON.stringify(programs));
    return true;
  } catch (error) {
    console.error('Impossibile salvare le programmazioni:', error);
    return false;
  }
};

export const loadCompletions = (userId) => {
  try {
    const raw = window.localStorage.getItem(completionStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error('Impossibile leggere gli allenamenti completati:', error);
    return {};
  }
};

export const persistCompletions = (userId, completions) => {
  try {
    window.localStorage.setItem(completionStorageKey(userId), JSON.stringify(completions));
    return true;
  } catch (error) {
    console.error('Impossibile salvare gli allenamenti completati:', error);
    return false;
  }
};

export const isWorkoutCompleted = (completions, program, week, session) =>
  Boolean(completions?.[workoutKey(program?.id, week?.week, session?.day)]);
