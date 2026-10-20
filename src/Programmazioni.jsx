import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  AlertCircle,
  Calendar,
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
  Trash2,
} from 'lucide-react';
import './Programmazioni.css';
import ProgramDay from './ProgramDay';
import ProgramEndingWarning from './ProgramEndingWarning';
import { downloadTemplate, parseScheduleFile } from './utils/scheduleParser';
import {
  formatDateIt,
  isProgramEndingSoon,
  loadCompletions,
  loadPrograms,
  persistPrograms,
  todayIso,
  workoutKey,
} from './utils/programData';
import { formatNumber, getPrForLift, noteKeyFor } from './utils/programDisplay';

const makeEmptyForm = () => ({
  name: 'Scheda Maggio',
  startDate: todayIso(),
  durationWeeks: '4',
  usePrMax: true,
});

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

const buildNotesDraft = (program) => {
  const draft = {};
  program.weeks.forEach((week) => {
    week.sessions.forEach((session) => {
      session.lifts.forEach((lift, liftIndex) => {
        draft[noteKeyFor(week, session, liftIndex)] = lift.notes || '';
      });
    });
  });
  return draft;
};

const applyNotesDraft = (program, draft) => ({
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
});

const Programmazioni = ({ userId, prMaxes }) => {
  const [programs, setPrograms] = useState(() => loadPrograms(userId));
  const [completions, setCompletions] = useState(() => loadCompletions(userId));
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [form, setForm] = useState(makeEmptyForm);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedSchedule, setParsedSchedule] = useState(null);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [expandedProgramId, setExpandedProgramId] = useState(null);
  const [openWeeks, setOpenWeeks] = useState({});
  const [editingNotesProgramId, setEditingNotesProgramId] = useState(null);
  const [noteDraft, setNoteDraft] = useState({});
  const [noteEditError, setNoteEditError] = useState('');
  const parseRequestId = useRef(0);

  useEffect(() => {
    setPrograms(loadPrograms(userId));
    setCompletions(loadCompletions(userId));
    setExpandedProgramId(null);
    setOpenWeeks({});
    setEditingNotesProgramId(null);
    setNoteDraft({});
    setNoteEditError('');
  }, [userId]);

  const resetForm = () => {
    parseRequestId.current += 1;
    setForm(makeEmptyForm());
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

    const program = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name,
      startDate: form.startDate,
      durationWeeks,
      usePrMax: form.usePrMax,
      fileName: selectedFileName,
      sheetName: parsedSchedule.sheetName,
      createdAt: new Date().toISOString(),
      maxes: parsedSchedule.maxes,
      stats: parsedSchedule.stats,
      weeks: parsedSchedule.weeks,
    };

    const nextPrograms = [program, ...programs];
    if (!persistPrograms(userId, nextPrograms)) {
      setFormError('Salvataggio non riuscito: controlla lo spazio disponibile sul dispositivo.');
      return;
    }

    setPrograms(nextPrograms);
    setExpandedProgramId(program.id);
    setIsFormOpen(false);
    setPageError('');
    resetForm();
  };

  const handleDelete = (program) => {
    const confirmed = window.confirm(`Eliminare la programmazione "${program.name}"?`);
    if (!confirmed) return;

    const nextPrograms = programs.filter((item) => item.id !== program.id);
    if (!persistPrograms(userId, nextPrograms)) {
      setPageError('Eliminazione non riuscita: riprova.');
      return;
    }

    setPrograms(nextPrograms);
    setPageError('');
    if (expandedProgramId === program.id) setExpandedProgramId(null);
    if (editingNotesProgramId === program.id) handleCancelNoteEdit();
  };

  const toggleWeek = (programId, weekNumber) => {
    const key = `${programId}:${weekNumber}`;
    setOpenWeeks((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  const handleStartNoteEdit = (program) => {
    setExpandedProgramId(program.id);
    setEditingNotesProgramId(program.id);
    setNoteDraft(buildNotesDraft(program));
    setNoteEditError('');
  };

  const handleCancelNoteEdit = () => {
    setEditingNotesProgramId(null);
    setNoteDraft({});
    setNoteEditError('');
  };

  const handleSaveNotes = () => {
    const program = programs.find((item) => item.id === editingNotesProgramId);
    if (!program) {
      handleCancelNoteEdit();
      return;
    }

    const updatedProgram = applyNotesDraft(program, noteDraft);
    const nextPrograms = programs.map((item) =>
      (item.id === updatedProgram.id ? updatedProgram : item)
    );

    if (!persistPrograms(userId, nextPrograms)) {
      setNoteEditError('Salvataggio non riuscito: controlla lo spazio disponibile sul dispositivo.');
      return;
    }

    setPrograms(nextPrograms);
    setPageError('');
    handleCancelNoteEdit();
  };

  const handleNoteChange = (key, value) => {
    setNoteDraft((previous) => ({ ...previous, [key]: value }));
  };

  const renderProgramCard = (program) => {
    const isExpanded = expandedProgramId === program.id;
    const isEditingNotes = editingNotesProgramId === program.id;
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
            {isEndingSoon && <ProgramEndingWarning className="program-card-ending-warning" />}
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
              if (isEditingNotes) handleCancelNoteEdit();
              else handleStartNoteEdit(program);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            aria-label={isEditingNotes ? `Termina modifica note di ${program.name}` : `Modifica note di ${program.name}`}
            aria-pressed={isEditingNotes}
            title={isEditingNotes ? 'Termina modifica note' : 'Modifica note'}
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
                  Modifica note: apri una Week per intervenire sulle singole alzate.
                </span>
                <div className="program-note-edit-actions">
                  <button
                    type="button"
                    className="program-btn-secondary program-btn-small"
                    onClick={handleCancelNoteEdit}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    className="program-btn-primary program-btn-small"
                    onClick={handleSaveNotes}
                  >
                    Salva note
                  </button>
                </div>
              </div>
            )}

            {noteEditError && (
              <p className="program-error" role="alert">
                {noteEditError}
              </p>
            )}

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
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="programmazioni-page">
      <div className="programmazioni-container">
        <h1 className="programmazioni-title">Programmazioni</h1>

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
                  Formati supportati: .xls e .xlsx (max 5 MB). I complementari e i recuperi vengono
                  ignorati.
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
                    </div>
                    <div className="program-preview-maxes">{formatMaxes(parsedSchedule.maxes)}</div>

                    {Number.parseInt(form.durationWeeks, 10) !== parsedSchedule.stats.weeks && (
                      <p className="program-preview-warning">
                        <AlertCircle size={14} /> La scheda contiene {parsedSchedule.stats.weeks} settimane,
                        mentre la durata indicata è {form.durationWeeks || '0'}. Puoi salvare comunque.
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
          Le programmazioni sono salvate solo su questo dispositivo.
        </p>
      </div>
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
};

export default Programmazioni;
