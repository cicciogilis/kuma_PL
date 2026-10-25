import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  AlertCircle,
  BellRing,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Dumbbell,
  FileSpreadsheet,
  Paperclip,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
} from 'lucide-react';
import './Programmazioni.css';
import ProgramBlocks from './ProgramBlocks';
import ProgramDashboard from './ProgramDashboard';
import ProgramDay from './ProgramDay';
import ProgramEndingWarning from './ProgramEndingWarning';
import ProgramEventNotices from './ProgramEventNotice';
import {
  downloadTemplate,
  parseAccessoryText,
  parseScheduleFile,
} from './utils/scheduleParser';
import {
  formatDateIt,
  getDaysUntilProgramEnd,
  isProgramEndingSoon,
  parseLocalDate,
  todayIso,
  updateLiftVariant,
  workoutKey,
} from './utils/programData';
import {
  deleteProgramFully,
  migrateLocalPrograms,
  saveCompletions,
  saveProgramNote,
  saveProgram,
  sendExpiryNotice,
  subscribeCompletions,
  subscribeExpiryNotices,
  subscribeProgramNotes,
  subscribePrograms,
} from './utils/programStore';
import { subscribeAthleteEvents } from './utils/eventStore';
import {
  accessoryNoteKeyFor,
  formatNumber,
  getPrForLift,
  noteKeyFor,
} from './utils/programDisplay';

const EXPIRY_NOTICE_DAYS = 14;

const makeEmptyForm = () => ({
  name: 'Scheda Maggio',
  startDate: todayIso(),
  durationWeeks: '4',
  usePrMax: true,
  includeComplementari: true,
});

const makeEmptyCustomExercise = () => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  sets: '',
  reps: '',
  notes: '',
});

const makeEmptyCustomComplementari = () =>
  [1, 2, 3, 4].map((day) => ({
    day,
    weekday: '',
    exercises: [],
  }));

const isFundamentalAccessory = (exercise) => {
  const name = String(exercise?.name || '')
    .replace(/\s*\(programma\)\s*/i, '')
    .trim();
  return /^(?:squat|panca|stacco(?:\s+(?:sumo|classico))?)$/i.test(name);
};

const upgradeAccessoryExercise = (exercise) => {
  if (!exercise) return exercise;
  if (Array.isArray(exercise.blocks) && exercise.blocks.length > 0) return exercise;
  if (!exercise.raw) return exercise;

  const parsed = parseAccessoryText(exercise.raw);
  if (!parsed || !parsed.blocks.length) return exercise;

  const legacyNotes = String(exercise.notes || '').trim();
  const rawText = String(exercise.raw).trim();
  const notesArePrescription = Boolean(legacyNotes) && rawText.includes(legacyNotes);

  return {
    ...exercise,
    blocks: parsed.blocks,
    notes: notesArePrescription ? parsed.notes : (legacyNotes || parsed.notes),
  };
};

const cleanCustomComplementari = (days) =>
  days
    .map((day) => ({
      day: day.day,
      weekday: day.weekday || '',
      exercises: day.exercises
        .map((exercise) => ({
          name: exercise.name.trim(),
          sets: exercise.sets.trim(),
          reps: exercise.reps.trim(),
          notes: exercise.notes.trim(),
        }))
        .filter((exercise) =>
          exercise.name || exercise.sets || exercise.reps || exercise.notes
        )
        .map((exercise) => ({
          ...exercise,
          name: exercise.name || 'Complementare',
        })),
    }))
    .filter((day) => day.exercises.length > 0);

const WEEKDAY_OPTIONS = [
  'Lunedì',
  'Martedì',
  'Mercoledì',
  'Giovedì',
  'Venerdì',
  'Sabato',
  'Domenica',
];

const makeEmptyAccessoryDayForm = () => ({
  name: '',
  weekday: '',
});

const makeEmptyAccessoryExerciseForm = () => ({
  name: '',
  series: '',
  reps: '',
  notes: '',
});

const prepareComplementariForEdit = (days) =>
  (Array.isArray(days) ? days : [])
    .filter((day) => day && typeof day === 'object')
    .map((day, index) => ({
      ...day,
      day: Number.isFinite(Number(day.day)) ? Number(day.day) : index + 1,
      name: typeof day.name === 'string' ? day.name : '',
      weekday: typeof day.weekday === 'string' ? day.weekday : '',
      exercises: (Array.isArray(day.exercises) ? day.exercises : [])
        .map((exercise) => upgradeAccessoryExercise(exercise))
        .filter((exercise) => exercise && !isFundamentalAccessory(exercise)),
    }));

const splitAccessoryParts = (value) =>
  String(value || '')
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

const buildAccessoryBlocks = (seriesInput, repsInput) => {
  const seriesText = String(seriesInput || '').trim();
  const repsText = String(repsInput || '').trim();
  if (!seriesText) return [];

  if (/[x×]/i.test(seriesText)) {
    const parsed = parseAccessoryText(`Esercizio ${seriesText.replace(/×/g, 'x')}`);
    return parsed?.blocks || [];
  }

  const seriesParts = splitAccessoryParts(seriesText);
  const repsParts = splitAccessoryParts(repsText);
  if (!seriesParts.length || !repsParts.length) return [];

  const makeBlock = (setsPart, reps) => ({
    sets: Number.parseInt(setsPart, 10),
    reps: String(reps).trim(),
    rpe: null,
    percent: null,
    percentBase: null,
    note: '',
  });

  let blocks = [];
  if (seriesParts.length === 1) {
    blocks = repsParts.map((reps) => makeBlock(seriesParts[0], reps));
  } else if (repsParts.length === 1) {
    blocks = seriesParts.map((sets) => makeBlock(sets, repsParts[0]));
  } else if (seriesParts.length === repsParts.length) {
    blocks = seriesParts.map((sets, index) => makeBlock(sets, repsParts[index]));
  }

  return blocks.filter((block) =>
    Number.isFinite(block.sets) && block.sets > 0 && block.reps
  );
};

const formatMaxes = (maxes) => {
  if (!maxes) return 'Nessun massimale indicato nella scheda';

  const parts = [];
  if (maxes.panca > 0) parts.push(`Panca ${formatNumber(maxes.panca)} kg`);
  if (maxes.squat > 0) parts.push(`Squat ${formatNumber(maxes.squat)} kg`);

  const sumo = maxes.staccoSumo > 0 ? maxes.staccoSumo : null;
  const classic = maxes.staccoClassico > 0 ? maxes.staccoClassico : null;
  if (sumo && classic && sumo !== classic) {
    parts.push(`Stacco ${formatNumber(sumo)}/${formatNumber(classic)} kg`);
  } else if (sumo || classic) {
    parts.push(`Stacco ${formatNumber(sumo || classic)} kg`);
  }

  return parts.length ? parts.join(' · ') : 'Nessun massimale indicato nella scheda';
};

const buildNotesDraft = (program, complementari = program.complementari || []) => {
  const draft = {};
  program.weeks.forEach((week) => {
    week.sessions.forEach((session) => {
      session.lifts.forEach((lift, liftIndex) => {
        draft[noteKeyFor(week, session, liftIndex)] = lift.notes || '';
      });
    });
  });

  (complementari || []).forEach((day) => {
    (day.exercises || []).forEach((exercise, exerciseIndex) => {
      const upgraded = upgradeAccessoryExercise(exercise);
      draft[accessoryNoteKeyFor(day.day, exerciseIndex)] = upgraded.notes || '';
    });
  });

  return draft;
};

const applyProgramEdit = (program, draft, complementariDraft = program.complementari || []) => {
  const updated = {
    ...program,
    weeks: program.weeks.map((week) => ({
      ...week,
      sessions: week.sessions.map((session) => ({
        ...session,
        lifts: session.lifts.map((lift, liftIndex) => ({
          ...lift,
          notes: (draft[noteKeyFor(week, session, liftIndex)] ?? '').trim(),
        })),
      })),
    })),
    complementari: (complementariDraft || [])
      .map((day) => ({
        ...day,
        name: String(day.name || '').trim(),
        weekday: day.weekday || '',
        exercises: (day.exercises || [])
          .map((exercise, exerciseIndex) => {
            const upgraded = upgradeAccessoryExercise(exercise);
            return {
              ...upgraded,
              notes: (
                draft[accessoryNoteKeyFor(day.day, exerciseIndex)] ?? upgraded.notes ?? ''
              ).trim(),
            };
          })
          .filter((exercise) => exercise.name && !isFundamentalAccessory(exercise)),
      }))
      .filter((day) => day.exercises.length > 0)
      .map((day, index) => ({ ...day, day: index + 1 })),
    athleteUpdatedAt: new Date().toISOString(),
  };

  updated.stats = {
    ...(program.stats || {}),
    complementari: updated.complementari.reduce(
      (total, day) => total + day.exercises.length,
      0
    ),
  };

  return updated;
};

const Programmazioni = ({ userId, prMaxes, coachKey = null, coachName = '' }) => {
  const [programs, setPrograms] = useState([]);
  const [completions, setCompletions] = useState({});
  const [programNotes, setProgramNotes] = useState({});
  const [expiryNotices, setExpiryNotices] = useState({});
  const [coachNoteDrafts, setCoachNoteDrafts] = useState({});
  const [coachNoteStatus, setCoachNoteStatus] = useState({});
  const [coachNoteSaving, setCoachNoteSaving] = useState(null);
  const [expirySaving, setExpirySaving] = useState(null);
  const [athleteEvents, setAthleteEvents] = useState([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);
  const [customComplementari, setCustomComplementari] = useState(makeEmptyCustomComplementari);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedSchedule, setParsedSchedule] = useState(null);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [expandedProgramId, setExpandedProgramId] = useState(null);
  const [openWeeks, setOpenWeeks] = useState({});
  const [openAccessories, setOpenAccessories] = useState({});
  const [openAccessoryDays, setOpenAccessoryDays] = useState({});
  const [editingProgramId, setEditingProgramId] = useState(null);
  const [noteDraft, setNoteDraft] = useState({});
  const [programEditError, setProgramEditError] = useState('');
  const [accessoryDraft, setAccessoryDraft] = useState([]);
  const [isAddAccessoryDayOpen, setIsAddAccessoryDayOpen] = useState(false);
  const [accessoryDayForm, setAccessoryDayForm] = useState(makeEmptyAccessoryDayForm);
  const [accessoryDayError, setAccessoryDayError] = useState('');
  const [addAccessoryExerciseDay, setAddAccessoryExerciseDay] = useState(null);
  const [accessoryExerciseForm, setAccessoryExerciseForm] = useState(
    makeEmptyAccessoryExerciseForm
  );
  const [accessoryExerciseError, setAccessoryExerciseError] = useState('');
  const parseRequestId = useRef(0);

  useEffect(() => {
    setExpandedProgramId(null);
    setOpenWeeks({});
    setOpenAccessories({});
    setOpenAccessoryDays({});
    setEditingProgramId(null);
    setNoteDraft({});
    setProgramEditError('');
    setAccessoryDraft([]);
    setIsAddAccessoryDayOpen(false);
    setAccessoryDayForm(makeEmptyAccessoryDayForm());
    setAccessoryDayError('');
    setAddAccessoryExerciseDay(null);
    setAccessoryExerciseForm(makeEmptyAccessoryExerciseForm());
    setAccessoryExerciseError('');
    setCoachNoteDrafts({});
    setCoachNoteStatus({});
  }, [userId]);

  // Programmazioni, completamenti, note e avvisi vivono su Firebase e si
  // aggiornano in tempo reale (condivisi tra atleta e coach).
  useEffect(() => {
    if (!userId) return undefined;

    migrateLocalPrograms(userId).catch(() => {});

    const unsubPrograms = subscribePrograms(userId, setPrograms, () => {
      setPageError('Impossibile aggiornare le programmazioni. Verifica la connessione.');
    });
    const unsubCompletions = subscribeCompletions(userId, setCompletions, () => {});
    const unsubNotes = subscribeProgramNotes(userId, setProgramNotes, () => {});
    const unsubNotices = subscribeExpiryNotices(userId, setExpiryNotices, () => {});
    const unsubEvents = subscribeAthleteEvents(userId, setAthleteEvents, () => {});

    return () => {
      unsubPrograms();
      unsubCompletions();
      unsubNotes();
      unsubNotices();
      unsubEvents();
    };
  }, [userId]);

  const resetForm = () => {
    parseRequestId.current += 1;
    setForm(makeEmptyForm());
    setCustomComplementari(makeEmptyCustomComplementari());
    setSelectedFileName('');
    setParsedSchedule(null);
    setParseError('');
    setFormError('');
    setIsParsing(false);
  };

  const handleToggleForm = () => {
    if (isFormOpen) resetForm();
    setIsFormOpen((open) => !open);
  };

  const handleCancel = () => {
    resetForm();
    setIsFormOpen(false);
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const requestId = parseRequestId.current + 1;
    parseRequestId.current = requestId;

    setSelectedFileName(file.name);
    setParsedSchedule(null);
    setParseError('');
    setFormError('');

    if (!/\.(xls|xlsx)$/i.test(file.name)) {
      setParseError('Formato non supportato: carica un file .xls oppure .xlsx.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setParseError('Il file è troppo grande: il limite è 5 MB.');
      return;
    }

    setIsParsing(true);
    try {
      const buffer = await file.arrayBuffer();
      const result = await parseScheduleFile(new Uint8Array(buffer));
      if (parseRequestId.current !== requestId) return;
      setParsedSchedule(result);
    } catch (error) {
      if (parseRequestId.current !== requestId) return;
      console.error('Errore durante la lettura della scheda:', error);
      setParseError(error?.message || 'Non riesco a leggere la scheda. Controlla il formato del file.');
    } finally {
      if (parseRequestId.current === requestId) setIsParsing(false);
    }
  };

  const handleRemoveFile = () => {
    parseRequestId.current += 1;
    setSelectedFileName('');
    setParsedSchedule(null);
    setParseError('');
    setFormError('');
    setIsParsing(false);
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate();
    } catch (error) {
      console.error('Errore durante il download del template:', error);
      setParseError('Non riesco a generare il template. Riprova.');
    }
  };

  const clampDuration = () => {
    setForm((previous) => {
      const parsed = Number.parseInt(previous.durationWeeks, 10);
      const duration = Number.isInteger(parsed) ? Math.min(52, Math.max(1, parsed)) : 1;
      return { ...previous, durationWeeks: String(duration) };
    });
  };

  const changeDuration = (delta) => {
    setForm((previous) => {
      const parsed = Number.parseInt(previous.durationWeeks, 10);
      const current = Number.isInteger(parsed) ? parsed : 1;
      return { ...previous, durationWeeks: String(Math.min(52, Math.max(1, current + delta))) };
    });
  };

  const handleAddCustomAccessory = (dayNumber) => {
    const exercise = makeEmptyCustomExercise();
    setCustomComplementari((previous) =>
      previous.map((day) =>
        day.day === dayNumber
          ? { ...day, exercises: [...day.exercises, exercise] }
          : day
      )
    );
  };

  const handleChangeCustomAccessory = (dayNumber, exerciseId, field, value) => {
    setCustomComplementari((previous) =>
      previous.map((day) => {
        if (day.day !== dayNumber) return day;
        return {
          ...day,
          exercises: day.exercises.map((exercise) =>
            exercise.id === exerciseId ? { ...exercise, [field]: value } : exercise
          ),
        };
      })
    );
  };

  const handleRemoveCustomAccessory = (dayNumber, exerciseId) => {
    setCustomComplementari((previous) =>
      previous.map((day) =>
        day.day === dayNumber
          ? {
              ...day,
              exercises: day.exercises.filter((exercise) => exercise.id !== exerciseId),
            }
          : day
      )
    );
  };

  const handleSave = (event) => {
    event.preventDefault();
    setFormError('');

    const name = form.name.trim();
    if (!name) {
      setFormError('Inserisci un nome per la programmazione.');
      return;
    }
    if (!form.startDate) {
      setFormError('Inserisci la data di inizio.');
      return;
    }

    const durationWeeks = Number.parseInt(form.durationWeeks, 10);
    if (!Number.isInteger(durationWeeks) || durationWeeks < 1 || durationWeeks > 52) {
      setFormError('La durata deve essere compresa tra 1 e 52 settimane.');
      return;
    }

    if (!parsedSchedule) {
      setFormError('Allega una scheda Excel e attendi che venga letta prima di salvare.');
      return;
    }

    const complementari = form.includeComplementari
      ? (parsedSchedule.complementari || [])
      : cleanCustomComplementari(customComplementari);

    const program = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      startDate: form.startDate,
      durationWeeks,
      usePrMax: form.usePrMax,
      includeComplementari: form.includeComplementari,
      fileName: selectedFileName,
      sheetName: parsedSchedule.sheetName,
      createdAt: new Date().toISOString(),
      maxes: parsedSchedule.maxes,
      stats: parsedSchedule.stats,
      weeks: parsedSchedule.weeks,
      complementari,
      authorRole: 'athlete',
      authorKey: userId,
    };

    const nextPrograms = [program, ...programs];
    setPrograms(nextPrograms);
    setExpandedProgramId(program.id);
    setIsFormOpen(false);
    setPageError('');
    resetForm();
    saveProgram(userId, program).catch(() => {
      setPageError('Salvataggio non riuscito. Verifica la connessione e riprova.');
    });
  };

  const handleDelete = async (program) => {
    const confirmed = window.confirm(`Eliminare la programmazione "${program.name}"?`);
    if (!confirmed) return;

    try {
      await deleteProgramFully(userId, program.id);
      setPageError('');
      if (expandedProgramId === program.id) setExpandedProgramId(null);
      if (editingProgramId === program.id) handleCancelProgramEdit();
    } catch {
      setPageError('Eliminazione non riuscita: riprova.');
    }
  };

  const toggleWeek = (programId, weekNumber) => {
    const key = `${programId}:${weekNumber}`;
    setOpenWeeks((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const toggleAccessories = (programId) => {
    setOpenAccessories((previous) => ({
      ...previous,
      [programId]: !previous[programId],
    }));
  };

  const toggleAccessoryDay = (programId, dayNumber) => {
    const key = `${programId}:${dayNumber}`;
    setOpenAccessoryDays((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const handleStartProgramEdit = (program) => {
    const complementariDraft = prepareComplementariForEdit(program.complementari);

    setExpandedProgramId(program.id);
    setEditingProgramId(program.id);
    setAccessoryDraft(complementariDraft);
    setNoteDraft(buildNotesDraft(program, complementariDraft));
    setProgramEditError('');
    setOpenAccessories((previous) => ({ ...previous, [program.id]: true }));
    setIsAddAccessoryDayOpen(false);
    setAccessoryDayForm(makeEmptyAccessoryDayForm());
    setAccessoryDayError('');
    setAddAccessoryExerciseDay(null);
    setAccessoryExerciseForm(makeEmptyAccessoryExerciseForm());
    setAccessoryExerciseError('');
  };

  const handleCancelProgramEdit = () => {
    setEditingProgramId(null);
    setNoteDraft({});
    setProgramEditError('');
    setAccessoryDraft([]);
    setIsAddAccessoryDayOpen(false);
    setAccessoryDayForm(makeEmptyAccessoryDayForm());
    setAccessoryDayError('');
    setAddAccessoryExerciseDay(null);
    setAccessoryExerciseForm(makeEmptyAccessoryExerciseForm());
    setAccessoryExerciseError('');
  };

  const handleSaveProgramEdit = () => {
    const program = programs.find((item) => item.id === editingProgramId);
    if (!program) {
      handleCancelProgramEdit();
      return;
    }

    const updatedProgram = applyProgramEdit(program, noteDraft, accessoryDraft);
    const nextPrograms = programs.map((item) =>
      (item.id === updatedProgram.id ? updatedProgram : item)
    );

    setPrograms(nextPrograms);
    setPageError('');
    handleCancelProgramEdit();
    saveProgram(userId, updatedProgram).catch(() => {
      setProgramEditError('Salvataggio non riuscito. Verifica la connessione e riprova.');
    });
  };

  const handleNoteChange = (key, value) => {
    setNoteDraft((previous) => ({ ...previous, [key]: value }));
  };

  const handleAccessoryExerciseChange = (field, value) => {
    setAccessoryExerciseForm((previous) => ({ ...previous, [field]: value }));
    setAccessoryExerciseError('');
  };

  const handleOpenAddAccessoryDay = () => {
    setAccessoryDayForm(makeEmptyAccessoryDayForm());
    setAccessoryDayError('');
    setIsAddAccessoryDayOpen(true);
  };

  const handleCloseAddAccessoryDay = () => {
    setIsAddAccessoryDayOpen(false);
    setAccessoryDayError('');
  };

  const handleAddAccessoryDay = (event) => {
    event.preventDefault();
    const name = accessoryDayForm.name.trim();

    if (!name) {
      setAccessoryDayError('Inserisci il nome del giorno complementari.');
      return;
    }

    if (!editingProgramId) return;

    const nextDay = accessoryDraft.reduce(
      (max, day) => Math.max(max, Number(day.day) || 0),
      0
    ) + 1;

    setAccessoryDraft((previous) => [
      ...previous,
      {
        day: nextDay,
        name,
        weekday: accessoryDayForm.weekday,
        exercises: [],
      },
    ]);
    setOpenAccessoryDays((previous) => ({
      ...previous,
      [`${editingProgramId}:${nextDay}`]: true,
    }));
    setAccessoryDayForm(makeEmptyAccessoryDayForm());
    setAccessoryDayError('');
    setIsAddAccessoryDayOpen(false);
  };

  const handleToggleAddAccessoryExercise = (dayNumber) => {
    if (addAccessoryExerciseDay === dayNumber) {
      setAddAccessoryExerciseDay(null);
      setAccessoryExerciseError('');
      return;
    }

    setAccessoryExerciseForm(makeEmptyAccessoryExerciseForm());
    setAccessoryExerciseError('');
    setAddAccessoryExerciseDay(dayNumber);
  };

  const handleCancelAddAccessoryExercise = () => {
    setAddAccessoryExerciseDay(null);
    setAccessoryExerciseError('');
  };

  const handleAddAccessoryExercise = (event, dayNumber) => {
    event.preventDefault();
    const name = accessoryExerciseForm.name.trim();
    const series = accessoryExerciseForm.series.trim();
    const reps = accessoryExerciseForm.reps.trim();

    if (!Number.isFinite(dayNumber) || dayNumber <= 0) {
      setAccessoryExerciseError('Giorno non valido: riprova.');
      return;
    }

    if (!name) {
      setAccessoryExerciseError("Inserisci il nome dell'esercizio.");
      return;
    }

    if (!series) {
      setAccessoryExerciseError('Indica le serie: puoi scrivere 3 + 4 oppure 3x4 + 4x2.');
      return;
    }

    const blocks = buildAccessoryBlocks(series, reps);
    if (!blocks.length) {
      setAccessoryExerciseError(
        'Serie e rep non sono valide. Usa ad esempio 3x4 + 4x2 oppure 3 + 4 e 4 + 2.'
      );
      return;
    }

    const targetDay = accessoryDraft.find((day) => Number(day.day) === dayNumber);
    if (!targetDay) {
      setAccessoryExerciseError('Giorno non trovato: riprova.');
      return;
    }

    const exerciseIndex = (targetDay.exercises || []).length;
    const newExercise = {
      name,
      blocks,
      notes: accessoryExerciseForm.notes.trim(),
    };

    setAccessoryDraft((previous) =>
      previous.map((day) =>
        Number(day.day) === dayNumber
          ? { ...day, exercises: [...(day.exercises || []), newExercise] }
          : day
      )
    );
    setNoteDraft((previous) => ({
      ...previous,
      [accessoryNoteKeyFor(dayNumber, exerciseIndex)]: newExercise.notes,
    }));

    if (editingProgramId) {
      setOpenAccessoryDays((previous) => ({
        ...previous,
        [`${editingProgramId}:${dayNumber}`]: true,
      }));
    }

    setAccessoryExerciseForm(makeEmptyAccessoryExerciseForm());
    setAccessoryExerciseError('');
    setAddAccessoryExerciseDay(null);
  };

  const handleToggleWorkoutCompleted = (programId, weekNumber, dayNumber) => {
    const key = workoutKey(programId, weekNumber, dayNumber);
    const nextCompletions = { ...completions };

    if (nextCompletions[key]) delete nextCompletions[key];
    else nextCompletions[key] = new Date().toISOString();

    setCompletions(nextCompletions);
    saveCompletions(userId, nextCompletions).catch(() => {
      setPageError('Salvataggio dei completamenti non riuscito. Verifica la connessione.');
    });
  };

  const handleChangeLiftVariant = (
    programId,
    weekNumber,
    dayNumber,
    liftIndex,
    variant
  ) => {
    const nextPrograms = updateLiftVariant(
      programs,
      programId,
      weekNumber,
      dayNumber,
      liftIndex,
      variant
    );

    const updatedProgram = nextPrograms.find((item) => item.id === programId);
    setPrograms(nextPrograms);
    setPageError('');
    if (updatedProgram) {
      saveProgram(userId, { ...updatedProgram, athleteUpdatedAt: new Date().toISOString() })
        .catch(() => setPageError('Salvataggio non riuscito: riprova.'));
    }
  };

  const handleSendExpiryNotice = (program) => {
    if (!coachKey || expirySaving) return;
    setExpirySaving(program.id);
    sendExpiryNotice(userId, program.id, coachKey, coachName)
      .catch(() => setPageError("Invio dell'avviso non riuscito. Riprova."))
      .finally(() => setExpirySaving(null));
  };

  const handleCoachNoteChange = (programId, value) => {
    setCoachNoteDrafts((previous) => ({ ...previous, [programId]: value }));
    setCoachNoteStatus((previous) => (
      previous[programId] ? { ...previous, [programId]: null } : previous
    ));
  };

  const handleSaveCoachNote = async (programId) => {
    const text = coachNoteDrafts[programId] ?? programNotes[programId]?.text ?? '';
    setCoachNoteSaving(programId);
    try {
      await saveProgramNote(userId, programId, text, userId);
      setCoachNoteStatus((previous) => ({ ...previous, [programId]: 'saved' }));
    } catch {
      setCoachNoteStatus((previous) => ({ ...previous, [programId]: 'error' }));
    } finally {
      setCoachNoteSaving(null);
    }
  };

  const renderProgramCard = (program) => {
    const isExpanded = expandedProgramId === program.id;
    const isEditingNotes = editingProgramId === program.id;
    const isEndingSoon = isProgramEndingSoon(program);

    const hasMissingPr = program.usePrMax && program.weeks.some((week) =>
      week.sessions.some((session) =>
        session.lifts.some((lift) => !getPrForLift(lift, prMaxes))
      )
    );

    const sessionCount = program.stats?.sessions
      ?? program.weeks.reduce((total, week) => total + week.sessions.length, 0);
    const weekCount = program.stats?.weeks ?? program.weeks.length;
    const liftCount = program.stats?.lifts
      ?? new Set(program.weeks.flatMap((week) =>
        week.sessions.flatMap((session) => session.lifts.map((lift) => lift.key))
      )).size;

    const complementariSource = isEditingNotes ? accessoryDraft : program.complementari;
    const complementari = (Array.isArray(complementariSource) ? complementariSource : [])
      .filter((day) => day && Array.isArray(day.exercises))
      .map((day) => ({
        ...day,
        name: typeof day.name === 'string' ? day.name : '',
        exercises: day.exercises
          .map((exercise, exerciseIndex) => ({
            exercise: upgradeAccessoryExercise(exercise),
            exerciseIndex,
          }))
          .filter(({ exercise }) => exercise && !isFundamentalAccessory(exercise)),
      }))
      .filter((day) => isEditingNotes || day.exercises.length > 0);
    const showAccessories = isEditingNotes || complementari.length > 0;
    const isAccessoriesOpen = Boolean(openAccessories[program.id]);
    const accessoriesContentId = `accessories-${program.id}`;
    const accessoryExercisePreview = buildAccessoryBlocks(
      accessoryExerciseForm.series,
      accessoryExerciseForm.reps
    );

    const programStart = parseLocalDate(program.startDate);
    const daysUntilEnd = getDaysUntilProgramEnd(program);
    const programStarted = Boolean(programStart && programStart <= new Date());
    const notice = expiryNotices[program.id] || null;
    const noticeSent = Boolean(notice?.sentAt) && !notice?.resolvedAt;
    const showExpiryAction = Boolean(coachKey)
      && !notice?.resolvedAt
      && programStarted
      && daysUntilEnd != null
      && daysUntilEnd >= 0
      && daysUntilEnd <= EXPIRY_NOTICE_DAYS;
    const coachDisplayName = coachName || 'Marco';

    return (
      <div className={`program-card ${isExpanded ? 'expanded' : ''}`} key={program.id}>
        <div
          className="program-card-header"
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          onClick={() => setExpandedProgramId(isExpanded ? null : program.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              setExpandedProgramId(isExpanded ? null : program.id);
            }
          }}
        >
          <div className="program-card-main">
            {showExpiryAction ? (
              <button
                type="button"
                className={`program-expiry-action${noticeSent ? ' sent' : ''}`}
                onClick={(event) => {
                  event.stopPropagation();
                  handleSendExpiryNotice(program);
                }}
                onKeyDown={(event) => event.stopPropagation()}
                disabled={noticeSent || expirySaving === program.id}
                aria-pressed={noticeSent}
              >
                {noticeSent
                  ? <Check size={15} aria-hidden="true" />
                  : <BellRing size={15} aria-hidden="true" />}
                <span>
                  {noticeSent
                    ? `Hai inviato a ${coachDisplayName} l'avviso di scheda finita`
                    : `Avvisa ${coachDisplayName} che la scheda sta finendo`}
                </span>
              </button>
            ) : (
              isEndingSoon && <ProgramEndingWarning className="program-card-ending-warning" />
            )}
            <span className="program-card-name">{program.name}</span>
            <span className="program-card-meta">
              <span>
                <Calendar size={12} /> dal {formatDateIt(program.startDate) || '—'}
              </span>
              <span>
                <Clock size={12} /> {program.durationWeeks} week
              </span>
              <span className="program-card-badge">
                {program.usePrMax ? 'Massimali PR' : 'Massimali scheda'}
              </span>
            </span>
          </div>

          <button
            type="button"
            className={`program-edit-btn${isEditingNotes ? ' active' : ''}`}
            onClick={(event) => {
              event.stopPropagation();
              if (isEditingNotes) handleCancelProgramEdit();
              else handleStartProgramEdit(program);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={isEditingNotes ? `Termina modifica programmazione di ${program.name}` : `Modifica programmazione di ${program.name}`}
            aria-pressed={isEditingNotes}
            title={isEditingNotes ? 'Termina modifica programmazione' : 'Modifica programmazione'}
          >
            <Pencil size={17} />
          </button>

          <button
            type="button"
            className="program-delete-btn"
            onClick={(event) => {
              event.stopPropagation();
              handleDelete(program);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={`Elimina ${program.name}`}
            title="Elimina programmazione"
          >
            <Trash2 size={17} />
          </button>

          <span className="program-card-chevron" aria-hidden="true">
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </span>
        </div>

        {isExpanded && (
          <div className="program-card-body">
            {isEditingNotes && (
              <div className="program-note-edit-bar">
                <span className="program-note-edit-title">
                  Modifica le informazioni dei complementari e le note dei fondamentali
                </span>
                <div className="program-note-edit-actions">
                  <button
                    type="button"
                    className="program-btn-secondary program-btn-small"
                    onClick={handleCancelProgramEdit}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    className="program-btn-primary program-btn-small"
                    onClick={handleSaveProgramEdit}
                  >
                    Salva le modifiche
                  </button>
                </div>
              </div>
            )}

            {isEditingNotes && programEditError && (
              <p className="program-error" role="alert">
                {programEditError}
              </p>
            )}

            <ProgramDashboard
              program={program}
              prMaxes={prMaxes}
              completions={completions}
            />

            <div className="program-card-summary">
              <span>
                <strong>{sessionCount}</strong> sedute
                {' · '}
                <strong>{weekCount}</strong> settimane
                {' · '}
                <strong>{liftCount}</strong> alzate
              </span>
              <span className="program-card-hint">
                Sono riportati i calcoli esatti, con accanto una proposta di arrotondamento
              </span>
              {program.fileName && (
                <span className="program-card-file">
                  <FileSpreadsheet size={12} /> {program.fileName}
                </span>
              )}
            </div>

            {hasMissingPr && (
              <p className="program-pr-warning">
                <AlertCircle size={14} /> Alcuni PR non sono impostati: i pesi mancanti non vengono calcolati.
              </p>
            )}

            {program.weeks.map((week) => {
              const weekKey = `${program.id}:${week.week}`;
              const isWeekOpen = Boolean(openWeeks[weekKey]);
              const weekContentId = `week-${program.id}-${week.week}`;

              return (
                <div className="program-week" key={`${program.id}-week-${week.week}`}>
                  <button
                    type="button"
                    className={`program-week-toggle${isWeekOpen ? ' open' : ''}`}
                    onClick={() => toggleWeek(program.id, week.week)}
                    aria-expanded={isWeekOpen}
                    aria-controls={weekContentId}
                  >
                    <span className="program-week-title">Week {week.week}</span>
                    <span className="program-week-meta">{week.sessions.length} Day</span>
                    <span className="program-week-chevron" aria-hidden="true">
                      {isWeekOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>

                  {isWeekOpen && (
                    <div className="program-week-content" id={weekContentId}>
                      {week.sessions.map((session, sessionIndex) => (
                        <ProgramDay
                          key={`${program.id}-${week.week}-${session.day}`}
                          program={program}
                          week={week}
                          session={session}
                          sessionIndex={sessionIndex}
                          prMaxes={prMaxes}
                          completed={Boolean(
                            completions[workoutKey(program.id, week.week, session.day)]
                          )}
                          isEditingNotes={isEditingNotes}
                          noteDraft={noteDraft}
                          onNoteChange={handleNoteChange}
                          onVariantChange={(liftIndex, variant) =>
                            handleChangeLiftVariant(
                              program.id,
                              week.week,
                              session.day,
                              liftIndex,
                              variant
                            )
                          }
                          onToggleCompleted={() => handleToggleWorkoutCompleted(
                            program.id,
                            week.week,
                            session.day
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {showAccessories && (
              <div className="program-accessories">
                <button
                  type="button"
                  className={`program-week-toggle${isAccessoriesOpen ? ' open' : ''}`}
                  onClick={() => toggleAccessories(program.id)}
                  aria-expanded={isAccessoriesOpen}
                  aria-controls={accessoriesContentId}
                >
                  <span className="program-week-title">Complementari</span>
                  <span className="program-week-meta">{complementari.length} giorni</span>
                  <span className="program-week-chevron" aria-hidden="true">
                    {isAccessoriesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {isAccessoriesOpen && (
                  <div className="program-accessories-content" id={accessoriesContentId}>
                    {isEditingNotes && (
                      <button
                        type="button"
                        className="program-accessory-add-tile"
                        onClick={handleOpenAddAccessoryDay}
                        aria-haspopup="dialog"
                      >
                        <span className="program-accessory-add-circle" aria-hidden="true">
                          <Plus size={20} />
                        </span>
                        <span className="program-accessory-add-label">Aggiungi giorno</span>
                      </button>
                    )}

                    {isEditingNotes && complementari.length === 0 && (
                      <p className="program-hint">
                        Aggiungi prima un giorno complementari, poi potrai inserire gli esercizi.
                      </p>
                    )}

                    {complementari.map((day) => {
                      const dayKey = `${program.id}:${day.day}`;
                      const isDayOpen = Boolean(openAccessoryDays[dayKey]);
                      const dayContentId = `accessories-${program.id}-${day.day}`;
                      const exercises = day.exercises || [];

                      return (
                        <div className="program-accessory-day" key={dayKey}>
                          <button
                            type="button"
                            className={`program-week-toggle program-accessory-day-toggle${isDayOpen ? ' open' : ''}`}
                            onClick={() => toggleAccessoryDay(program.id, day.day)}
                            aria-expanded={isDayOpen}
                            aria-controls={dayContentId}
                          >
                            <span className="program-accessory-day-title">
                              {day.name || `Day ${day.day}`}
                            </span>
                            {day.name && day.name !== `Day ${day.day}` && (
                              <span className="program-accessory-day-order">Day {day.day}</span>
                            )}
                            {day.weekday && (
                              <span className="program-day-weekday">{day.weekday}</span>
                            )}
                            <span className="program-week-meta">
                              {exercises.length} esercizi
                            </span>
                            <span className="program-week-chevron" aria-hidden="true">
                              {isDayOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </span>
                          </button>

                          {isDayOpen && (
                            <div className="program-accessory-list" id={dayContentId}>
                              {isEditingNotes && (
                                <>
                                  <button
                                    type="button"
                                    className="program-accessory-add-tile"
                                    onClick={() => handleToggleAddAccessoryExercise(day.day)}
                                    aria-expanded={addAccessoryExerciseDay === day.day}
                                  >
                                    <span className="program-accessory-add-circle" aria-hidden="true">
                                      <Plus size={20} />
                                    </span>
                                    <span className="program-accessory-add-label">
                                      Aggiungi complementare
                                    </span>
                                  </button>

                                  {addAccessoryExerciseDay === day.day && (
                                    <form
                                      className="program-accessory-add-card"
                                      id={`${dayContentId}-add-exercise`}
                                      onSubmit={(event) => handleAddAccessoryExercise(event, day.day)}
                                      noValidate
                                    >
                                      <div className="program-accessory-form-grid">
                                        <label className="program-field program-field-full">
                                          <span className="program-label">Nome esercizio</span>
                                          <input
                                            className="program-input"
                                            type="text"
                                            value={accessoryExerciseForm.name}
                                            onChange={(event) =>
                                              handleAccessoryExerciseChange('name', event.target.value)
                                            }
                                            placeholder="Es. Leg curl"
                                            maxLength={60}
                                          />
                                        </label>

                                        <label className="program-field">
                                          <span className="program-label">Serie</span>
                                          <input
                                            className="program-input"
                                            type="text"
                                            value={accessoryExerciseForm.series}
                                            onChange={(event) =>
                                              handleAccessoryExerciseChange('series', event.target.value)
                                            }
                                            placeholder="3 + 4 oppure 3x4 + 4x2"
                                            maxLength={80}
                                            aria-label="Serie"
                                          />
                                          <span className="program-hint program-accessory-field-hint">
                                            Scrivi 3 + 4, oppure l&apos;intera prescrizione 3x4 + 4x2.
                                          </span>
                                        </label>

                                        <label className="program-field">
                                          <span className="program-label">Rep</span>
                                          <input
                                            className="program-input"
                                            type="text"
                                            value={accessoryExerciseForm.reps}
                                            onChange={(event) =>
                                              handleAccessoryExerciseChange('reps', event.target.value)
                                            }
                                            placeholder="4 + 2"
                                            maxLength={80}
                                            aria-label="Rep"
                                          />
                                          <span className="program-hint program-accessory-field-hint">
                                            Una voce per ogni blocco di serie.
                                          </span>
                                        </label>

                                        <label className="program-field program-field-full">
                                          <span className="program-label">Note</span>
                                          <input
                                            className="program-input"
                                            type="text"
                                            value={accessoryExerciseForm.notes}
                                            onChange={(event) =>
                                              handleAccessoryExerciseChange('notes', event.target.value)
                                            }
                                            placeholder="Es. fermo 1 secondo"
                                            maxLength={200}
                                          />
                                        </label>
                                      </div>

                                      {accessoryExercisePreview.length > 0 && (
                                        <div className="program-accessory-add-preview">
                                          <span className="program-label">Anteprima</span>
                                          <div className="program-lift">
                                            <div className="program-lift-head">
                                              <span className="program-lift-name program-lift-name-accessory">
                                                {accessoryExerciseForm.name.trim() || 'Nuovo complementare'}
                                              </span>
                                              <ProgramBlocks
                                                blocks={accessoryExercisePreview}
                                                accessory
                                              />
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                      {accessoryExerciseError && (
                                        <p className="program-error" role="alert">
                                          {accessoryExerciseError}
                                        </p>
                                      )}

                                      <div className="program-accessory-add-actions">
                                        <button
                                          type="button"
                                          className="program-btn-secondary program-btn-small"
                                          onClick={handleCancelAddAccessoryExercise}
                                        >
                                          Annulla
                                        </button>
                                        <button
                                          type="submit"
                                          className="program-btn-primary program-btn-small"
                                        >
                                          Aggiungi complementare
                                        </button>
                                      </div>
                                    </form>
                                  )}
                                </>
                              )}

                              {exercises.length === 0 && (
                                <p className="program-hint program-accessory-empty">
                                  {isEditingNotes
                                    ? 'Nessun complementare: usa il riquadro rosso “Aggiungi complementare” qui sopra.'
                                    : 'Nessun complementare per questo giorno.'}
                                </p>
                              )}
                              {exercises.map(({ exercise, exerciseIndex }) => {
                                const noteKey = accessoryNoteKeyFor(day.day, exerciseIndex);
                                const blocks = Array.isArray(exercise.blocks) && exercise.blocks.length
                                  ? exercise.blocks
                                  : (exercise.sets || exercise.reps)
                                    ? [{
                                        sets: exercise.sets,
                                        reps: exercise.reps,
                                        rpe: null,
                                        percent: null,
                                        percentBase: null,
                                        note: '',
                                      }]
                                    : [];

                                return (
                                  <div
                                    className="program-lift"
                                    key={`${dayKey}-${exerciseIndex}`}
                                  >
                                    <div className="program-lift-head">
                                      <span className="program-lift-name program-lift-name-accessory">
                                        {exercise.name}
                                      </span>
                                      <ProgramBlocks blocks={blocks} accessory />
                                    </div>
                                    {isEditingNotes ? (
                                      <textarea
                                        className="program-note-input"
                                        rows={2}
                                        value={noteDraft[noteKey] ?? ''}
                                        onChange={(event) => handleNoteChange(noteKey, event.target.value)}
                                        placeholder="Aggiungi una nota"
                                        aria-label={`Nota ${exercise.name}, Day ${day.day}`}
                                        maxLength={300}
                                      />
                                    ) : (
                                      exercise.notes && (
                                        <div className="program-lift-notes">{exercise.notes}</div>
                                      )
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <section className="program-coach-note">
              <div className="program-coach-note-head">
                <span className="program-coach-note-title">
                  <StickyNote size={15} aria-hidden="true" /> Note per l&apos;allenatore
                </span>
                {coachNoteStatus[program.id] === 'saved' && (
                  <span className="program-coach-note-saved">Nota salvata</span>
                )}
                {coachNoteStatus[program.id] === 'error' && (
                  <span className="program-coach-note-error" role="alert">Salvataggio non riuscito</span>
                )}
              </div>
              <textarea
                className="program-coach-note-input"
                rows={3}
                maxLength={1000}
                placeholder="Scrivi una nota per il tuo allenatore..."
                value={coachNoteDrafts[program.id] ?? programNotes[program.id]?.text ?? ''}
                onChange={(event) => handleCoachNoteChange(program.id, event.target.value)}
                aria-label={`Note per l'allenatore, ${program.name}`}
              />
              <div className="program-coach-note-actions">
                <button
                  type="button"
                  className="program-btn-primary program-btn-small"
                  disabled={coachNoteSaving === program.id}
                  onClick={() => handleSaveCoachNote(program.id)}
                >
                  Salva nota
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="programmazioni-page">
      <div className="programmazioni-container">
        <h1 className="programmazioni-title">Programmazioni</h1>

        <ProgramEventNotices events={athleteEvents} />

        {pageError && (
          <div className="program-page-error" role="alert">
            {pageError}
          </div>
        )}

        <div className={`program-create-card ${isFormOpen ? 'open' : ''}`}>
          <button
            type="button"
            className="program-create-header"
            onClick={handleToggleForm}
            aria-expanded={isFormOpen}
            aria-controls="program-form"
          >
            <span className="program-create-plus" aria-hidden="true">
              <Plus size={18} />
            </span>
            <span className="program-create-title">Inserisci Programmazione</span>
            <span className="program-create-chevron" aria-hidden="true">
              {isFormOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </span>
          </button>

          {isFormOpen && (
            <form id="program-form" className="program-form" onSubmit={handleSave} noValidate>
              <div className="program-form-grid">
                <div className="program-field program-field-full">
                  <label className="program-label" htmlFor="program-name">
                    Nome Programmazione
                  </label>
                  <input
                    id="program-name"
                    className="program-input"
                    type="text"
                    value={form.name}
                    maxLength={60}
                    onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                    placeholder="Scheda Maggio"
                    required
                  />
                </div>

                <div className="program-field">
                  <label className="program-label" htmlFor="program-start-date">
                    Data Inizio
                  </label>
                  <input
                    id="program-start-date"
                    className="program-input"
                    type="date"
                    lang="it"
                    value={form.startDate}
                    onChange={(event) => setForm((previous) => ({ ...previous, startDate: event.target.value }))}
                    required
                  />
                </div>

                <div className="program-field">
                  <label className="program-label" htmlFor="program-duration">
                    Durata
                  </label>
                  <div className="program-stepper">
                    <button
                      type="button"
                      onClick={() => changeDuration(-1)}
                      aria-label="Riduci la durata di una settimana"
                    >
                      −
                    </button>
                    <input
                      id="program-duration"
                      className="program-input"
                      type="number"
                      min="1"
                      max="52"
                      step="1"
                      inputMode="numeric"
                      value={form.durationWeeks}
                      onChange={(event) => setForm((previous) => ({ ...previous, durationWeeks: event.target.value }))}
                      onBlur={clampDuration}
                    />
                    <button
                      type="button"
                      onClick={() => changeDuration(1)}
                      aria-label="Aumenta la durata di una settimana"
                    >
                      +
                    </button>
                    <span className="program-stepper-unit">week</span>
                  </div>
                </div>
              </div>

              <div className="program-toggle-row">
                <label className="toggle-switch">
                  <input
                    id="program-use-pr"
                    type="checkbox"
                    checked={form.usePrMax}
                    onChange={(event) => setForm((previous) => ({ ...previous, usePrMax: event.target.checked }))}
                  />
                  <span className="toggle-slider" />
                </label>
                <div className="program-toggle-text">
                  <label className="program-toggle-label" htmlFor="program-use-pr">
                    Usa i massimali dei Personal Record
                  </label>
                  <span className="program-toggle-desc">
                    Se attivo, i pesi reali vengono calcolati sui tuoi PR attuali.
                    <br />
                    Se disattivo, uso i massimali scritti nella scheda.
                  </span>
                </div>
              </div>

              <div className="program-toggle-row">
                <label className="toggle-switch">
                  <input
                    id="program-include-complementari"
                    type="checkbox"
                    checked={form.includeComplementari}
                    onChange={(event) =>
                      setForm((previous) => ({
                        ...previous,
                        includeComplementari: event.target.checked,
                      }))
                    }
                  />
                  <span className="toggle-slider" />
                </label>
                <div className="program-toggle-text">
                  <label className="program-toggle-label" htmlFor="program-include-complementari">
                    Includi anche i complementari
                  </label>
                  <span className="program-toggle-desc">
                    Se attivo, recupera anche i complementari che ha scritto Marco.
                    <br />
                    Se disattivo, è possibile inserirli custom.
                  </span>
                </div>
              </div>

              {!form.includeComplementari && (
                <div className="program-custom-complementari">
                  <div className="program-custom-complementari-head">
                    <span className="program-attach-title">Complementari custom</span>
                  </div>

                  {customComplementari.map((day) => (
                    <div className="program-custom-day" key={day.day}>
                      <div className="program-custom-day-head">
                        <span className="program-custom-day-title">Day {day.day}</span>
                        <button
                          type="button"
                          className="program-custom-add"
                          onClick={() => handleAddCustomAccessory(day.day)}
                        >
                          <Plus size={14} /> Aggiungi
                        </button>
                      </div>

                      {day.exercises.length === 0 ? (
                        <p className="program-hint">Nessun complementare per questo Day.</p>
                      ) : (
                        <div className="program-custom-list">
                          {day.exercises.map((exercise, exerciseIndex) => (
                            <div className="program-custom-item" key={exercise.id}>
                              <div className="program-custom-item-head">
                                <span className="program-custom-item-number">
                                  Esercizio {exerciseIndex + 1}
                                </span>
                                <button
                                  type="button"
                                  className="program-custom-remove"
                                  onClick={() =>
                                    handleRemoveCustomAccessory(day.day, exercise.id)
                                  }
                                  aria-label={`Rimuovi esercizio ${exerciseIndex + 1} del Day ${day.day}`}
                                  title="Rimuovi esercizio"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>

                              <div className="program-custom-grid">
                                <label className="program-field program-custom-name">
                                  <span className="program-label">Nome</span>
                                  <input
                                    className="program-input"
                                    type="text"
                                    value={exercise.name}
                                    onChange={(event) =>
                                      handleChangeCustomAccessory(
                                        day.day,
                                        exercise.id,
                                        'name',
                                        event.target.value
                                      )
                                    }
                                    placeholder="Es. Lat machine"
                                    maxLength={80}
                                  />
                                </label>
                                <label className="program-field">
                                  <span className="program-label">Serie</span>
                                  <input
                                    className="program-input"
                                    type="text"
                                    inputMode="numeric"
                                    value={exercise.sets}
                                    onChange={(event) =>
                                      handleChangeCustomAccessory(
                                        day.day,
                                        exercise.id,
                                        'sets',
                                        event.target.value
                                      )
                                    }
                                    placeholder="3"
                                    maxLength={12}
                                  />
                                </label>
                                <label className="program-field">
                                  <span className="program-label">Rep</span>
                                  <input
                                    className="program-input"
                                    type="text"
                                    value={exercise.reps}
                                    onChange={(event) =>
                                      handleChangeCustomAccessory(
                                        day.day,
                                        exercise.id,
                                        'reps',
                                        event.target.value
                                      )
                                    }
                                    placeholder="12/15"
                                    maxLength={20}
                                  />
                                </label>
                                <label className="program-field program-custom-notes">
                                  <span className="program-label">Note</span>
                                  <input
                                    className="program-input"
                                    type="text"
                                    value={exercise.notes}
                                    onChange={(event) =>
                                      handleChangeCustomAccessory(
                                        day.day,
                                        exercise.id,
                                        'notes',
                                        event.target.value
                                      )
                                    }
                                    placeholder="Es. fermo 1”"
                                    maxLength={200}
                                  />
                                </label>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="program-attach">
                <div className="program-attach-header">
                  <span className="program-attach-title">Allega</span>
                  <button type="button" className="program-template-btn" onClick={handleDownloadTemplate}>
                    <Download size={14} /> Scarica template
                  </button>
                </div>

                <input
                  id="program-file"
                  className="program-file-input"
                  type="file"
                  accept=".xls,.xlsx"
                  onChange={handleFileChange}
                  aria-label="Allega la scheda Excel"
                />
                <label className="program-file-label" htmlFor="program-file">
                  <Paperclip size={18} />
                  <span>{selectedFileName || 'Seleziona il file Excel della scheda'}</span>
                </label>

                {selectedFileName && (
                  <button type="button" className="program-remove-file" onClick={handleRemoveFile}>
                    Rimuovi file
                  </button>
                )}

                <p className="program-hint">
                  Formati supportati: .xls e .xlsx (max 5 MB). I complementari vengono letti dalla
                  sezione con i giorni; Squat, Panca e Stacco vengono esclusi.
                </p>

                {isParsing && <p className="program-hint">Lettura della scheda in corso...</p>}

                {parseError && (
                  <p className="program-error" role="alert">
                    {parseError}
                  </p>
                )}

                {parsedSchedule && (
                  <div className="program-preview">
                    <div className="program-preview-title">
                      <CheckCircle2 size={16} /> Scheda letta correttamente
                    </div>
                    <div className="program-preview-stats">
                      <span>{parsedSchedule.stats.weeks} settimane</span>
                      <span>{parsedSchedule.stats.sessions} sedute</span>
                      <span>{parsedSchedule.stats.lifts} alzate</span>
                      {parsedSchedule.stats.complementari > 0 && (
                        <span>{parsedSchedule.stats.complementari} complementari</span>
                      )}
                    </div>
                    <div className="program-preview-maxes">{formatMaxes(parsedSchedule.maxes)}</div>

                    {Number.parseInt(form.durationWeeks, 10) !== parsedSchedule.stats.weeks && (
                      <p className="program-preview-warning">
                        <AlertCircle size={14} /> La scheda contiene {parsedSchedule.stats.weeks} settimane,
                        mentre la durata indicata è {form.durationWeeks || '0'}. Puoi salvare comunque.
                      </p>
                    )}

                    {parsedSchedule.stats.complementari > 0 && !form.includeComplementari && (
                      <p className="program-preview-warning">
                        <AlertCircle size={14} /> I complementari della scheda non saranno inclusi.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {formError && (
                <p className="program-error" role="alert">
                  {formError}
                </p>
              )}

              <div className="program-form-actions">
                <button type="button" className="program-btn-secondary" onClick={handleCancel}>
                  Annulla
                </button>
                <button type="submit" className="program-btn-primary" disabled={isParsing}>
                  Salva Programmazione
                </button>
              </div>
            </form>
          )}
        </div>

        {programs.length === 0 ? (
          <div className="program-empty">
            <Dumbbell size={30} />
            <strong>Nessuna programmazione salvata</strong>
            <span>Apri “Inserisci Programmazione” e allega la tua scheda Excel.</span>
          </div>
        ) : (
          <div className="program-list">{programs.map(renderProgramCard)}</div>
        )}

        <p className="program-local-note">
          Le programmazioni sono sincronizzate sul tuo account e condivise con il tuo allenatore.
        </p>
      </div>

      {isAddAccessoryDayOpen && (
        <div
          className="program-modal-backdrop"
          role="presentation"
          onClick={handleCloseAddAccessoryDay}
        >
          <div
            className="program-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-accessory-day-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === 'Escape') handleCloseAddAccessoryDay();
            }}
          >
            <h2 className="program-modal-title" id="add-accessory-day-title">
              Aggiungi giorno complementari
            </h2>
            <form className="program-modal-form" onSubmit={handleAddAccessoryDay} noValidate>
              <label className="program-field">
                <span className="program-label">Nome giorno</span>
                <input
                  className="program-input"
                  type="text"
                  value={accessoryDayForm.name}
                  onChange={(event) => {
                    setAccessoryDayForm((previous) => ({
                      ...previous,
                      name: event.target.value,
                    }));
                    setAccessoryDayError('');
                  }}
                  placeholder="Es. Upper"
                  maxLength={60}
                  autoFocus
                />
              </label>

              <label className="program-field">
                <span className="program-label">Giorno della settimana</span>
                <select
                  className="program-input"
                  value={accessoryDayForm.weekday}
                  onChange={(event) => {
                    setAccessoryDayForm((previous) => ({
                      ...previous,
                      weekday: event.target.value,
                    }));
                    setAccessoryDayError('');
                  }}
                >
                  <option value="">Seleziona giorno</option>
                  {WEEKDAY_OPTIONS.map((weekday) => (
                    <option value={weekday} key={weekday}>
                      {weekday}
                    </option>
                  ))}
                </select>
              </label>

              {accessoryDayError && (
                <p className="program-error" role="alert">
                  {accessoryDayError}
                </p>
              )}

              <div className="program-modal-actions">
                <button
                  type="button"
                  className="program-btn-secondary program-btn-small"
                  onClick={handleCloseAddAccessoryDay}
                >
                  Annulla
                </button>
                <button type="submit" className="program-btn-primary program-btn-small">
                  Aggiungi giorno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

Programmazioni.propTypes = {
  userId: PropTypes.string.isRequired,
  prMaxes: PropTypes.shape({
    squat: PropTypes.number,
    bench: PropTypes.number,
    deadlift: PropTypes.number,
  }).isRequired,
  coachKey: PropTypes.string,
  coachName: PropTypes.string,
};

export default Programmazioni;
