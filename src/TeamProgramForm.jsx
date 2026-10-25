import { useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, CheckCircle2, FileSpreadsheet, Paperclip, X } from 'lucide-react';
import { downloadTemplate, parseScheduleFile } from './utils/scheduleParser';
import { resolveExpiryNoticesForCoachProgram, saveProgram } from './utils/programStore';
import { formatNumber } from './utils/programDisplay';
import { todayIso } from './utils/programData';
import './TeamProgramForm.css';

const makeEmptyForm = () => ({
  name: '',
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
  if (sumo && classic) parts.push(`Stacco ${formatNumber(sumo)} kg (sumo) / ${formatNumber(classic)} kg (classico)`);
  else if (sumo) parts.push(`Stacco ${formatNumber(sumo)} kg`);
  else if (classic) parts.push(`Stacco ${formatNumber(classic)} kg`);
  return parts.length ? parts.join(' · ') : 'Nessun massimale indicato nella scheda';
};

const TeamProgramForm = ({ athleteKey, coachKey, onClose, onSaved }) => {
  const [form, setForm] = useState(makeEmptyForm);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [parsedSchedule, setParsedSchedule] = useState(null);
  const [parseError, setParseError] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const parseRequestId = useRef(0);

  const updateField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  const changeDuration = (delta) => {
    setForm((previous) => {
      const current = Number.parseInt(previous.durationWeeks, 10);
      const base = Number.isInteger(current) ? current : 1;
      return { ...previous, durationWeeks: String(Math.min(52, Math.max(1, base + delta))) };
    });
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
  };

  const handleSave = async (event) => {
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
      includeComplementari: true,
      fileName: selectedFileName,
      sheetName: parsedSchedule.sheetName,
      createdAt: new Date().toISOString(),
      maxes: parsedSchedule.maxes,
      stats: parsedSchedule.stats,
      weeks: parsedSchedule.weeks,
      complementari: parsedSchedule.complementari || [],
      authorRole: 'coach',
      authorKey: coachKey,
    };

    setSaving(true);
    try {
      await saveProgram(athleteKey, program);
      await resolveExpiryNoticesForCoachProgram(athleteKey, program.createdAt, program.id);
      onSaved?.();
    } catch {
      setFormError('Salvataggio non riuscito. Verifica la connessione e riprova.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="team-program-backdrop" role="presentation" onClick={onClose}>
      <div
        className="team-program-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Nuova programmazione"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="team-program-header">
          <h2>Nuova programmazione</h2>
          <button type="button" className="team-program-close" onClick={onClose} aria-label="Chiudi">
            <X size={20} />
          </button>
        </header>

        <form className="team-program-form" onSubmit={handleSave} noValidate>
          <label className="team-program-field">
            <span>Nome programmazione</span>
            <input
              type="text"
              value={form.name}
              maxLength={60}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="Es. Scheda Maggio"
            />
          </label>

          <div className="team-program-grid">
            <label className="team-program-field">
              <span>Data inizio</span>
              <input
                type="date"
                value={form.startDate}
                onChange={(event) => updateField('startDate', event.target.value)}
              />
            </label>

            <div className="team-program-field">
              <span>Durata (settimane)</span>
              <div className="team-program-duration">
                <button type="button" onClick={() => changeDuration(-1)} aria-label="Diminuisci durata">−</button>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={form.durationWeeks}
                  onChange={(event) => updateField('durationWeeks', event.target.value)}
                />
                <button type="button" onClick={() => changeDuration(1)} aria-label="Aumenta durata">+</button>
              </div>
            </div>
          </div>

          <label className="team-program-toggle">
            <input
              type="checkbox"
              className="checkbox-dark"
              checked={form.usePrMax}
              onChange={(event) => updateField('usePrMax', event.target.checked)}
            />
            <span>Usa i massimali PR dell&apos;atleta</span>
          </label>

          <div className="team-program-attach">
            <label className="team-program-file">
              <Paperclip size={16} />
              <span>{selectedFileName || 'Seleziona il file Excel della scheda'}</span>
              <input
                type="file"
                accept=".xls,.xlsx"
                onChange={handleFileChange}
                aria-label="Allega la scheda Excel"
              />
            </label>
            {selectedFileName && (
              <button type="button" className="team-program-remove" onClick={handleRemoveFile}>
                <X size={14} /> Rimuovi
              </button>
            )}
            <button
              type="button"
              className="team-program-template"
              onClick={() => downloadTemplate()}
            >
              Scarica template
            </button>
          </div>

          {isParsing && <p className="team-program-hint">Lettura della scheda in corso...</p>}
          {parseError && <p className="team-program-error" role="alert">{parseError}</p>}

          {parsedSchedule && (
            <div className="team-program-preview">
              <div className="team-program-preview-title">
                <CheckCircle2 size={16} /> Scheda letta correttamente
              </div>
              <div className="team-program-preview-stats">
                <span><FileSpreadsheet size={12} /> {parsedSchedule.stats.weeks} settimane</span>
                <span>{parsedSchedule.stats.sessions} sedute</span>
                <span>{parsedSchedule.stats.lifts} alzate</span>
                {parsedSchedule.stats.complementari > 0 && (
                  <span>{parsedSchedule.stats.complementari} complementari</span>
                )}
              </div>
              <div className="team-program-preview-maxes">{formatMaxes(parsedSchedule.maxes)}</div>
              {Number.parseInt(form.durationWeeks, 10) !== parsedSchedule.stats.weeks && (
                <p className="team-program-warning">
                  <AlertCircle size={14} /> La scheda contiene {parsedSchedule.stats.weeks} settimane,
                  mentre la durata indicata è {form.durationWeeks || '0'}. Puoi salvare comunque.
                </p>
              )}
            </div>
          )}

          {formError && <p className="team-program-error" role="alert">{formError}</p>}

          <div className="team-program-actions">
            <button type="button" className="program-btn-secondary" onClick={onClose}>
              Annulla
            </button>
            <button type="submit" className="program-btn-primary" disabled={saving || isParsing}>
              Salva programmazione
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

TeamProgramForm.propTypes = {
  athleteKey: PropTypes.string.isRequired,
  coachKey: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onSaved: PropTypes.func,
};

export default TeamProgramForm;
