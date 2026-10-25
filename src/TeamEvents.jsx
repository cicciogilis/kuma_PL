import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { Calendar, Plus, Search, Trash2, X } from 'lucide-react';
import {
  EVENT_TYPES,
  FEDERATIONS,
  SINGLE_LIFTS,
  deleteEvent,
  eventAthleteKeys,
  saveEvent,
  subscribeEvents,
} from './utils/eventStore';
import { formatDateIt, parseLocalDate, todayIso } from './utils/programData';
import './TeamEvents.css';

const emptyForm = (coachKey, coachName) => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  name: '',
  federation: 'FIPL',
  federationCustom: '',
  location: '',
  date: todayIso(),
  type: 'full',
  singleLift: 'squat',
  coachKey,
  coachName,
  createdAt: new Date().toISOString(),
  athletes: {},
});

const displayName = (athlete) =>
  [athlete.firstName, athlete.lastName].filter(Boolean).join(' ')
  || athlete.username
  || athlete.key;

const formFromEvent = (event) => ({
  id: event.id,
  name: event.name || '',
  federation: FEDERATIONS.includes(event.federation) ? event.federation : (event.federation ? 'Altro' : 'FIPL'),
  federationCustom: FEDERATIONS.includes(event.federation) ? '' : (event.federation || ''),
  location: event.location || '',
  date: event.date || todayIso(),
  type: event.type === 'single' ? 'single' : 'full',
  singleLift: event.singleLift || 'squat',
  coachKey: event.coachKey,
  coachName: event.coachName || '',
  createdAt: event.createdAt || new Date().toISOString(),
  athletes: { ...(event.athletes || {}) },
});

const typeLabel = (event) => {
  if (event.type === 'single') {
    const lift = SINGLE_LIFTS.find((item) => item.key === event.singleLift)?.label || '';
    return ['Single Lift', lift].filter(Boolean).join(' · ');
  }
  return 'Gara completa';
};

const isPast = (event) => {
  const date = parseLocalDate(event.date);
  if (!date) return false;
  return date.getTime() < parseLocalDate(todayIso()).getTime();
};

const TeamEvents = ({ coachKey, coachName, athletes, selectedAthleteKey, onClose }) => {
  const [events, setEvents] = useState([]);
  const [view, setView] = useState('list');
  const [form, setForm] = useState(() => emptyForm(coachKey, coachName));
  const [athleteSearch, setAthleteSearch] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState('');

  useEffect(
    () =>
      subscribeEvents(
        (all) =>
          setEvents(
            all.filter((event) => {
              if (selectedAthleteKey) {
                return event.athletes && event.athletes[selectedAthleteKey];
              }
              return event.coachKey === coachKey;
            })
          ),
        () => setPageError('Impossibile caricare gli eventi. Verifica la connessione.')
      ),
      [coachKey, selectedAthleteKey]
    );

  // Cleanup: chiudi il modal se il componente si smonta mentre è aperto
  useEffect(() => {
    return () => {
      if (view !== 'list') {
        setView('list');
      }
    };
  }, []);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [events]
  );
  const upcoming = sortedEvents.filter((event) => !isPast(event));
  const past = sortedEvents.filter((event) => isPast(event));

  const filteredAthletes = athletes.filter((athlete) => {
    if (!athleteSearch.trim()) return true;
    return [
      displayName(athlete),
      athlete.username,
      athlete.firstName,
      athlete.lastName,
    ].join(' ').toLowerCase().includes(athleteSearch.trim().toLowerCase());
  });

  const updateField = (field, value) => setForm((previous) => ({ ...previous, [field]: value }));

  const toggleAthlete = (key) => {
    setForm((previous) => {
      const nextAthletes = { ...previous.athletes };
      if (nextAthletes[key]) delete nextAthletes[key];
      else nextAthletes[key] = true;
      return { ...previous, athletes: nextAthletes };
    });
  };

  const startCreate = () => {
    setForm(emptyForm(coachKey, coachName));
    setAthleteSearch('');
    setFormError('');
    setView('form');
  };

  const startEdit = (event) => {
    setForm(formFromEvent(event));
    setAthleteSearch('');
    setFormError('');
    setView('form');
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setFormError('');

    const name = form.name.trim();
    if (!name) {
      setFormError('Inserisci il nome dell\'evento.');
      return;
    }
    if (!form.date) {
      setFormError('Inserisci la data dell\'evento.');
      return;
    }

    const federation = form.federation === 'Altro'
      ? form.federationCustom.trim()
      : form.federation;
    if (!federation) {
      setFormError('Inserisci il nome della federazione.');
      return;
    }

    const payload = {
      id: form.id,
      name,
      federation,
      location: form.location.trim(),
      date: form.date,
      type: form.type,
      singleLift: form.type === 'single' ? form.singleLift : null,
      coachKey,
      coachName,
      createdAt: form.createdAt,
      updatedAt: new Date().toISOString(),
      athletes: form.athletes,
    };

    setSaving(true);
    try {
      await saveEvent(payload);
      setView('list');
      setPageError('');
    } catch {
      setFormError('Salvataggio non riuscito. Verifica la connessione e riprova.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (event) => {
    const confirmed = window.confirm(`Eliminare l'evento "${event.name}"?`);
    if (!confirmed) return;
    try {
      await deleteEvent(event.id);
      setPageError('');
    } catch {
      setPageError('Eliminazione non riuscita: riprova.');
    }
  };

  const renderEventRow = (event) => {
    const count = eventAthleteKeys(event).length;
    return (
      <div className="team-event-row" key={event.id}>
        <div className="team-event-main">
          <strong>{event.name}</strong>
          <span className="team-event-meta">
            {[event.federation, typeLabel(event)].filter(Boolean).join(' · ')}
          </span>
          <span className="team-event-meta">
            <Calendar size={12} /> {[formatDateIt(event.date), event.location].filter(Boolean).join(' · ')}
          </span>
        </div>
        <span className="team-event-count">{count} convocati</span>
        <div className="team-event-actions">
          <button type="button" className="team-event-btn" onClick={() => startEdit(event)}>Modifica</button>
          <button
            type="button"
            className="team-event-btn danger"
            onClick={() => handleDelete(event)}
            aria-label={`Elimina ${event.name}`}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="team-events-backdrop" role="presentation" onClick={onClose}>
      <div
        className="team-events-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Eventi"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="team-events-header">
          <h2>{view === 'form' ? (form.name ? 'Modifica evento' : 'Nuovo evento') : 'Eventi'}</h2>
          <button type="button" className="team-events-close" onClick={onClose} aria-label="Chiudi">
            <X size={20} />
          </button>
        </header>

        {pageError && <p className="team-events-error" role="alert">{pageError}</p>}

        {view === 'list' ? (
          <>
            <button type="button" className="program-btn-primary team-events-new" onClick={startCreate}>
              <Plus size={16} /> Nuovo evento
            </button>

            <section className="team-events-section">
              <h3>Prossimi</h3>
              {upcoming.length === 0
                ? <p className="team-events-empty">Nessun evento futuro.</p>
                : upcoming.map(renderEventRow)}
            </section>

            <section className="team-events-section">
              <h3>Passati</h3>
              {past.length === 0
                ? <p className="team-events-empty">Nessun evento passato.</p>
                : past.map(renderEventRow)}
            </section>
          </>
        ) : (
          <form className="team-events-form" onSubmit={handleSave} noValidate>
            <label className="team-events-field">
              <span>Nome evento</span>
              <input
                type="text"
                value={form.name}
                maxLength={80}
                onChange={(event) => updateField('name', event.target.value)}
                placeholder="Es. Campionati Italiani"
              />
            </label>

            <div className="team-events-grid">
              <label className="team-events-field">
                <span>Federazione</span>
                <select
                  value={form.federation}
                  onChange={(event) => updateField('federation', event.target.value)}
                >
                  {FEDERATIONS.map((federation) => (
                    <option value={federation} key={federation}>{federation}</option>
                  ))}
                  <option value="Altro">Altro</option>
                </select>
              </label>
              {form.federation === 'Altro' && (
                <label className="team-events-field">
                  <span>Nome federazione</span>
                  <input
                    type="text"
                    value={form.federationCustom}
                    maxLength={40}
                    onChange={(event) => updateField('federationCustom', event.target.value)}
                    placeholder="Nome federazione"
                  />
                </label>
              )}
              <label className="team-events-field">
                <span>Data</span>
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateField('date', event.target.value)}
                />
              </label>
              <label className="team-events-field">
                <span>Luogo</span>
                <input
                  type="text"
                  value={form.location}
                  maxLength={80}
                  onChange={(event) => updateField('location', event.target.value)}
                  placeholder="Città / palazzetto"
                />
              </label>
              <label className="team-events-field">
                <span>Tipologia</span>
                <select
                  value={form.type}
                  onChange={(event) => updateField('type', event.target.value)}
                >
                  {EVENT_TYPES.map((type) => (
                    <option value={type.key} key={type.key}>{type.label}</option>
                  ))}
                </select>
              </label>
              {form.type === 'single' && (
                <label className="team-events-field">
                  <span>Alzata</span>
                  <select
                    value={form.singleLift}
                    onChange={(event) => updateField('singleLift', event.target.value)}
                  >
                    {SINGLE_LIFTS.map((lift) => (
                      <option value={lift.key} key={lift.key}>{lift.label}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            <div className="team-events-field">
              <span>Atleti convocati ({Object.keys(form.athletes).length})</span>
              <label className="team-events-search">
                <Search size={15} />
                <input
                  type="search"
                  value={athleteSearch}
                  onChange={(event) => setAthleteSearch(event.target.value)}
                  placeholder="Cerca atleta"
                />
              </label>
              <div className="team-events-athletes">
                {filteredAthletes.length === 0 && (
                  <p className="team-events-empty">Nessun atleta disponibile.</p>
                )}
                {filteredAthletes.map((athlete) => (
                  <label className="team-events-athlete" key={athlete.key}>
                    <input
                      type="checkbox"
                      className="checkbox-dark"
                      checked={Boolean(form.athletes[athlete.key])}
                      onChange={() => toggleAthlete(athlete.key)}
                    />
                    <span>{displayName(athlete)} <small>@{athlete.username}</small></span>
                  </label>
                ))}
              </div>
            </div>

            {formError && <p className="team-events-error" role="alert">{formError}</p>}

            <div className="team-events-form-actions">
              <button type="button" className="program-btn-secondary" onClick={() => setView('list')}>
                Annulla
              </button>
              <button type="submit" className="program-btn-primary" disabled={saving}>
                Salva evento
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

TeamEvents.propTypes = {
  coachKey: PropTypes.string.isRequired,
  coachName: PropTypes.string,
  athletes: PropTypes.array.isRequired,
  selectedAthleteKey: PropTypes.string,
  onClose: PropTypes.func.isRequired,
};

export default TeamEvents;
