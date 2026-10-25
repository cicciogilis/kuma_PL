import { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { get, onValue, ref } from 'firebase/database';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { db } from './utils/firebase';
import TeamEvents from './TeamEvents';
import TeamProgramForm from './TeamProgramForm';
import TeamCharts from './TeamCharts';
import TeamProgramViewer from './TeamProgramViewer';
import ProgramEventNotices from './ProgramEventNotice';
import {
  deleteProgramFully,
  normalizePrograms,
  programAthleteActivity,
  saveProgram,
  subscribeCompletions,
  subscribeProgramNotes,
  subscribePrograms,
} from './utils/programStore';
import { subscribeAthleteEvents } from './utils/eventStore';
import {
  formatDateIt,
  getDaysUntilProgramEnd,
  getProgramEndDate,
  selectActiveProgram,
  updateLiftVariant,
} from './utils/programData';
import {
  COACH_AGE_FILTERS,
  MEN_WEIGHT_LABELS,
  WOMEN_WEIGHT_LABELS,
  getAge,
  getCoachAgeLabel,
  getWeightClass,
  isOpenCategory,
  matchesCoachAgeFilter,
} from './utils/athleteCategories';
import './TeamDashboard.css';

const normalizeUsername = (value = '') => value.toLowerCase().replace(/\s/g, '');

const calculateIPFPoints = (total, bw, gender) => {
  if (!gender || (gender !== 'M' && gender !== 'F') || !total || !bw) return null;
  let A;
  let B;
  let C;
  if (gender === 'M') {
    A = 1199.72839;
    B = 1025.18162;
    C = 0.00921;
  } else {
    A = 610.32796;
    B = 1045.59282;
    C = 0.03048;
  }
  const points = (100 / (A - B * Math.exp(-C * bw))) * total;
  return points > 0 ? points : null;
};

const num = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const displayName = (athlete) =>
  [athlete.firstName, athlete.lastName].filter(Boolean).join(' ')
  || athlete.username
  || athlete.key;

// Alzate opzionali: l'indice corrisponde alla posizione in users/<key>/otherPR
// e users/<key>/otherPRActive (stesso ordine della pagina Personal Record).
const OPTIONAL_LIFTS = [
  { key: 'dips', label: 'Dips', index: 0 },
  { key: 'chinup', label: 'Chin Up', index: 1 },
  { key: 'military', label: 'Military Press', index: 2 },
  { key: 'trazioni', label: 'Trazioni', index: 3 },
];

const RANGE_FILTERS = [
  { key: 'all', label: 'Tutte' },
  { key: 'w1', label: 'Tra 1 settimana' },
  { key: 'w2', label: 'Tra 2 settimane' },
  { key: 'w3', label: 'Tra 3 settimane' },
  { key: 'expired', label: 'Scadute' },
  { key: 'expired1', label: 'Scadute da 1 settimana' },
  { key: 'expired2', label: 'Scadute da 2 settimane' },
];

const matchesRange = (days, range) => {
  if (days == null) return false;
  switch (range) {
    case 'w1': return days >= 0 && days <= 7;
    case 'w2': return days >= 0 && days <= 14;
    case 'w3': return days >= 0 && days <= 21;
    case 'expired': return days < 0;
    case 'expired1': return days <= -7;
    case 'expired2': return days <= -14;
    default: return true;
  }
};

const countCompletions = (completions, programId) =>
  Object.keys(completions || {}).filter((key) => key.startsWith(`${programId}:`)).length;

const countProgramSessions = (program) =>
  (program.weeks || []).reduce(
    (total, week) => total + (week?.sessions?.length || 0),
    0
  );

const buildAthletes = (snapshot, coachKey) => {
  const athletes = [];
  snapshot.forEach((child) => {
    const data = child.val() || {};
    const key = child.key;
    if (key === coachKey) return;
    if (data.role === 'coach') return;
    if (normalizeUsername(data.coachKey || '') !== coachKey) return;
    athletes.push({
      key,
      username: data.username || key,
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      birthDate: data.birthDate || '',
      birthCity: data.birthCity || '',
      birthProvince: data.birthProvince || '',
      gender: data.gender || '',
      bw: data.bw ?? '',
      s: data.s ?? '',
      b: data.b ?? '',
      d: data.d ?? '',
      profilePhoto: data.profilePhoto || '',
      otherPR: data.otherPR || [],
      otherPRActive: data.otherPRActive || [],
      otherPRGoalValues: data.otherPRGoalValues || [],
      prNotes: data.prNotes || [],
    });
  });
  return athletes.sort((a, b) => displayName(a).localeCompare(displayName(b), 'it'));
};

const TeamDashboard = ({ coachKey, coachName }) => {
  const normalizedCoachKey = normalizeUsername(coachKey);
  const [athletes, setAthletes] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [weightFilter, setWeightFilter] = useState('all');
  const [sexFilter, setSexFilter] = useState('all');
  const [ageFilter, setAgeFilter] = useState('all');
  const [rangeFilter, setRangeFilter] = useState('all');
  const [selectedKey, setSelectedKey] = useState(null);
  const [showEvents, setShowEvents] = useState(false);
  const [programFormOpen, setProgramFormOpen] = useState(false);
  const [viewingProgramId, setViewingProgramId] = useState(null);
  const [variantError, setVariantError] = useState('');

  const [rosterPrograms, setRosterPrograms] = useState({});
  const [selectedCompletions, setSelectedCompletions] = useState({});
  const [selectedNotes, setSelectedNotes] = useState({});
  const [selectedAthleteEvents, setSelectedAthleteEvents] = useState([]);

  // Elenco atleti assegnati al coach in tempo reale.
  useEffect(() => {
    if (!normalizedCoachKey) return undefined;
    const usersRef = ref(db, 'users');
    const unsubscribe = onValue(
      usersRef,
      (snapshot) => {
        setAthletes(buildAthletes(snapshot, normalizedCoachKey));
        setLoadError('');
      },
      (error) => {
        console.error('Errore durante il caricamento degli atleti:', error);
        setLoadError('Impossibile caricare gli atleti. Verifica la connessione.');
      }
    );
    return () => unsubscribe();
  }, [normalizedCoachKey]);

  // Eventi dell'atleta selezionato.
  useEffect(() => {
    if (!selectedKey) {
      setSelectedAthleteEvents([]);
      return undefined;
    }
    const unsubscribe = subscribeAthleteEvents(
      selectedKey,
      (events) => setSelectedAthleteEvents(events),
      () => {}
    );
    return () => unsubscribe();
  }, [selectedKey]);

  const athleteKeys = useMemo(() => athletes.map((athlete) => athlete.key).join(','), [athletes]);

  // Colonne "In scadenza": caricamento una tantum dei programmi del roster.
  useEffect(() => {
    if (!athleteKeys) {
      setRosterPrograms({});
      return undefined;
    }
    let cancelled = false;
    const keys = athleteKeys.split(',');
    Promise.all(
      keys.map((key) =>
        get(ref(db, `users/${key}/programs`))
          .then((snapshot) => [key, normalizePrograms(snapshot.val())])
          .catch(() => [key, []])
      )
    ).then((entries) => {
      if (cancelled) return;
      setRosterPrograms((previous) => {
        const next = { ...previous };
        entries.forEach(([key, programs]) => {
          next[key] = programs;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [athleteKeys]);

  // Un solo listener realtime: quello dell'atleta selezionato.
  useEffect(() => {
    if (!selectedKey) return undefined;
    return subscribePrograms(
      selectedKey,
      (programs) => setRosterPrograms((previous) => ({ ...previous, [selectedKey]: programs })),
      () => {}
    );
  }, [selectedKey]);

  // Dettaglio dell'atleta selezionato: completamenti e note.
  useEffect(() => {
    // Cambiando atleta le viste aperte vanno chiuse, altrimenti mostrerebbero
    // dati dell'atleta precedente.
    setViewingProgramId(null);
    setProgramFormOpen(false);

    if (!selectedKey) {
      setSelectedCompletions({});
      setSelectedNotes({});
      return undefined;
    }
    const unsubCompletions = subscribeCompletions(selectedKey, setSelectedCompletions, () => {});
    const unsubNotes = subscribeProgramNotes(selectedKey, setSelectedNotes, () => {});
    return () => {
      unsubCompletions();
      unsubNotes();
    };
  }, [selectedKey]);

  const weightOptions = sexFilter === 'M'
    ? MEN_WEIGHT_LABELS
    : sexFilter === 'F'
      ? WOMEN_WEIGHT_LABELS
      : [...new Set([...MEN_WEIGHT_LABELS, ...WOMEN_WEIGHT_LABELS])];

  const handleSexChange = (value) => {
    setSexFilter(value);
    if (value !== 'all' && weightFilter !== 'all') {
      const allowed = value === 'M' ? MEN_WEIGHT_LABELS : WOMEN_WEIGHT_LABELS;
      if (!allowed.includes(weightFilter)) setWeightFilter('all');
    }
  };

  const handleWeightChange = (value) => {
    setWeightFilter(value);
    if (value === 'all') return;
    if (MEN_WEIGHT_LABELS.includes(value)) setSexFilter('M');
    else if (WOMEN_WEIGHT_LABELS.includes(value)) setSexFilter('F');
  };

  const filteredAthletes = athletes.filter((athlete) => {
    const haystack = [
      displayName(athlete),
      athlete.username,
      athlete.firstName,
      athlete.lastName,
    ].join(' ').toLowerCase();
    if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
    if (sexFilter !== 'all' && athlete.gender !== sexFilter) return false;
    if (weightFilter !== 'all') {
      if (getWeightClass(athlete.bw, athlete.gender) !== weightFilter) return false;
    }
    if (ageFilter !== 'all' && !matchesCoachAgeFilter(athlete.birthDate, ageFilter)) return false;
    return true;
  });

  const expiringRows = useMemo(() => {
    const rows = [];
    athletes.forEach((athlete) => {
      const programs = rosterPrograms[athlete.key] || [];
      const active = selectActiveProgram(programs);
      if (!active) return;
      const days = getDaysUntilProgramEnd(active);
      if (days == null) return;
      if (!matchesRange(days, rangeFilter)) return;
      rows.push({ athlete, program: active, days });
    });
    return rows.sort((a, b) => a.days - b.days);
  }, [athletes, rosterPrograms, rangeFilter]);

  const selectedAthlete = athletes.find((athlete) => athlete.key === selectedKey) || null;
  const athletePrMaxes = selectedAthlete ? {
    squat: num(selectedAthlete.s),
    bench: num(selectedAthlete.b),
    deadlift: num(selectedAthlete.d),
  } : {};
  const selectedPrograms = useMemo(
    () => (selectedKey ? (rosterPrograms[selectedKey] || []) : []),
    [selectedKey, rosterPrograms]
  );
  const activeProgram = selectActiveProgram(selectedPrograms);
  const viewingProgram = useMemo(
    () => (viewingProgramId
      ? selectedPrograms.find((program) => program.id === viewingProgramId) || null
      : null),
    [viewingProgramId, selectedPrograms]
  );

  // L'allenatore può cambiare la variante dello stacco (Classico/Sumo) su
  // qualsiasi scheda dell'atleta, sia che l'abbia creata lui sia l'atleta.
  const handleVariantChange = async (program, week, session, liftIndex, variant) => {
    if (!selectedKey || !program) return;

    const withVariant = (list, value) =>
      updateLiftVariant(list, program.id, week.week, session.day, liftIndex, value);

    const updated = withVariant([program], variant)[0];
    if (!updated) return;

    setVariantError('');
    // Aggiornamento immediato della vista, poi salvataggio sulla scheda.
    setRosterPrograms((previous) => ({
      ...previous,
      [selectedKey]: withVariant(previous[selectedKey] || [program], variant),
    }));

    try {
      await saveProgram(selectedKey, updated);
    } catch {
      setVariantError('Modifica della variante non riuscita: riprova.');
      setRosterPrograms((previous) => ({
        ...previous,
        [selectedKey]: (previous[selectedKey] || []).map((item) =>
          (item.id === program.id ? program : item)
        ),
      }));
    }
  };

  const sortedPrograms = useMemo(() => {
    const today = new Date();
    return [...selectedPrograms].sort((a, b) => {
      const aEnd = getProgramEndDate(a);
      const bEnd = getProgramEndDate(b);
      const aActive = a === activeProgram ? 1 : 0;
      const bActive = b === activeProgram ? 1 : 0;
      if (aActive !== bActive) return bActive - aActive;
      const aEnded = aEnd && aEnd < today ? 1 : 0;
      const bEnded = bEnd && bEnd < today ? 1 : 0;
      if (aEnded !== bEnded) return aEnded - bEnded;
      return (bEnd?.getTime() || 0) - (aEnd?.getTime() || 0);
    });
  }, [selectedPrograms, activeProgram]);

  const renderAthleteRow = (athlete) => (
    <button
      type="button"
      key={athlete.key}
      className={`team-athlete${selectedKey === athlete.key ? ' selected' : ''}`}
      onClick={() => setSelectedKey(athlete.key)}
    >
      <span className="team-athlete-avatar">
        {athlete.profilePhoto ? (
          <img src={athlete.profilePhoto} alt="" />
        ) : (
          (athlete.firstName || athlete.username || '?').charAt(0).toUpperCase()
        )}
      </span>
      <span className="team-athlete-copy">
        <strong>{displayName(athlete)}</strong>
        <small>
          @{athlete.username}
          {getWeightClass(athlete.bw, athlete.gender)
            ? ` · ${getWeightClass(athlete.bw, athlete.gender)}`
            : ''}
          {getCoachAgeLabel(athlete.birthDate) ? ` · ${getCoachAgeLabel(athlete.birthDate)}` : ''}
          {isOpenCategory(athlete.birthDate) ? ' · Open' : ''}
        </small>
      </span>
    </button>
  );

  const handleDeleteProgram = async (program) => {
    if (!selectedKey) return;
    const activity = programAthleteActivity(program, selectedCompletions);
    const warnings = [];
    if (activity.completions) {
      warnings.push(`${activity.completions} allenamenti completati dall'atleta`);
    }
    if (activity.modified) {
      warnings.push('modifiche dell\'atleta a complementari/note');
    }
    if (selectedNotes[program.id]?.text) {
      warnings.push('una nota scritta per te');
    }

    let message = `Eliminare la programmazione "${program.name}"?`;
    if (warnings.length) {
      message += `\n\nAttenzione: l'atleta ha ${warnings.join(', ')}. Confermando, queste informazioni verranno eliminate.`;
    }
    if (!window.confirm(message)) return;

    try {
      await deleteProgramFully(selectedKey, program.id);
    } catch {
      window.alert('Eliminazione non riuscita: riprova.');
    }
  };

  const renderDetail = () => {
    if (!selectedAthlete) {
      return (
        <div className="team-detail-empty">
          <Users size={44} />
          <h3>Seleziona un atleta</h3>
          <p>Scegli un atleta dalla lista per vedere dati, massimali e programmazioni.</p>
        </div>
      );
    }

    const total = num(selectedAthlete.s) + num(selectedAthlete.b) + num(selectedAthlete.d);
    const ipf = calculateIPFPoints(total, num(selectedAthlete.bw), selectedAthlete.gender);
    const age = getAge(selectedAthlete.birthDate);
    const activeOptionalLifts = OPTIONAL_LIFTS.filter((lift) => {
      const isActive = Boolean(selectedAthlete.otherPRActive?.[lift.index]);
      const value = num(selectedAthlete.otherPR?.[lift.index]);
      return isActive && value > 0;
    });

    return (
      <>
        <div className="team-detail-header">
          <button
            type="button"
            className="team-detail-back"
            onClick={() => setSelectedKey(null)}
            aria-label="Torna alla lista atleti"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="team-detail-avatar">
            {selectedAthlete.profilePhoto ? (
              <img src={selectedAthlete.profilePhoto} alt="" />
            ) : (
              (selectedAthlete.firstName || selectedAthlete.username || '?').charAt(0).toUpperCase()
            )}
          </span>
          <div className="team-detail-title">
            <h3>{displayName(selectedAthlete)}</h3>
            <p>
              @{selectedAthlete.username}
              {age != null ? ` · ${age} anni` : ''}
            </p>
          </div>
          <ProgramEventNotices events={selectedAthleteEvents} className="team-detail-event-coach-badge" />
        </div>

        <section className="team-detail-section">
          <h4>Note per l&apos;allenatore</h4>
          {Object.keys(selectedNotes).length === 0 ? (
            <p className="team-empty-line">Nessuna nota.</p>
          ) : (
            <div className="team-note-list">
              {Object.entries(selectedNotes).map(([programId, note]) => {
                const program = selectedPrograms.find((item) => item.id === programId);
                return (
                  <div className="team-note" key={programId}>
                    <p className="team-note-line">
                      <span className="team-note-program">
                        {program?.name || 'Programmazione'}
                      </span>
                      <span className="team-note-arrow" aria-hidden="true">→</span>
                      <span className="team-note-text">{note?.text || ''}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="team-detail-section">
          <h4>Informazioni personali</h4>
          <div className="team-info-grid">
            <div className="team-info-item">
              <span>Data di nascita</span>
              <strong>{formatDateIt(selectedAthlete.birthDate) || '—'}</strong>
            </div>
            <div className="team-info-item">
              <span>Città di nascita</span>
              <strong>{selectedAthlete.birthCity || '—'}</strong>
            </div>
            <div className="team-info-item">
              <span>Provincia</span>
              <strong>{selectedAthlete.birthProvince || '—'}</strong>
            </div>
            <div className="team-info-item">
              <span>Genere</span>
              <strong>{selectedAthlete.gender || '—'}</strong>
            </div>
            <div className="team-info-item">
              <span>Peso corporeo</span>
              <strong>{selectedAthlete.bw ? `${selectedAthlete.bw} kg` : '—'}</strong>
            </div>
            <div className="team-info-item">
              <span>Categoria</span>
              <strong>{getWeightClass(selectedAthlete.bw, selectedAthlete.gender) || '—'}</strong>
            </div>
          </div>
        </section>

        <section className="team-detail-section">
          <h4>Massimali e totali</h4>
          <div className="team-info-grid">
            <div className="team-info-item">
              <span>Squat</span>
              <strong>{num(selectedAthlete.s) ? `${num(selectedAthlete.s)} kg` : '—'}</strong>
            </div>
            <div className="team-info-item">
              <span>Panca</span>
              <strong>{num(selectedAthlete.b) ? `${num(selectedAthlete.b)} kg` : '—'}</strong>
            </div>
            <div className="team-info-item">
              <span>Stacco</span>
              <strong>{num(selectedAthlete.d) ? `${num(selectedAthlete.d)} kg` : '—'}</strong>
            </div>
            <div className="team-info-item">
              <span>Totale</span>
              <strong>{total ? `${total} kg` : '—'}</strong>
            </div>
            <div className="team-info-item">
              <span>IPF Points</span>
              <strong>{ipf ? ipf.toFixed(2) : '—'}</strong>
            </div>
            {activeOptionalLifts.map((lift) => (
              <div className="team-info-item team-info-item-optional" key={lift.key}>
                <span>{lift.label}</span>
                <strong>{num(selectedAthlete.otherPR[lift.index])} kg</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="team-detail-section">
          <div className="team-section-head">
            <h4>Programmazioni</h4>
            {selectedKey === selectedAthlete.key && (
              <button
                type="button"
                className="team-program-new"
                onClick={() => setProgramFormOpen(true)}
              >
                <Plus size={15} /> Nuova programmazione
              </button>
            )}
          </div>
          {sortedPrograms.length === 0 ? (
            <p className="team-empty-line">Nessuna programmazione disponibile.</p>
          ) : (
            <div className="team-program-list">
              {sortedPrograms.map((program) => {
                const completionsCount = countCompletions(selectedCompletions, program.id);
                const sessionsCount = countProgramSessions(program);
                const days = getDaysUntilProgramEnd(program);
                const isActive = program.id === activeProgram?.id;
                const isCoachProgram = program.authorRole === 'coach';
                return (
                  <div
                  className={`team-program${isActive ? ' active' : ''}`}
                  key={program.id}
                  onClick={() => {
                    setVariantError('');
                    setViewingProgramId(viewingProgramId === program.id ? null : program.id);
                  }}
                >
                    <div className="team-program-head">
                      <span className="team-program-name">{program.name}</span>
                      <span className="team-program-head-actions">
                        <span className={`team-program-author ${isCoachProgram ? 'coach' : 'athlete'}`}>
                          {isCoachProgram ? 'Allenatore' : 'Atleta'}
                        </span>
                        {isCoachProgram && (
                    <button
                      type="button"
                      className="team-program-delete"
                      onClick={(event) => { event.stopPropagation(); handleDeleteProgram(program); }}
                      aria-label={`Elimina ${program.name}`}
                      title="Elimina programmazione"
                    >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </span>
                    </div>
                    <div className="team-program-meta">
                      <span><Calendar size={12} /> dal {formatDateIt(program.startDate) || '—'}</span>
                      <span><Clock size={12} /> {program.durationWeeks} week</span>
                      {days != null && (
                        <span className={days < 0 ? 'team-program-expired' : ''}>
                          {days < 0 ? `Scaduta da ${Math.abs(days)} gg` : `${days} gg alla fine`}
                        </span>
                      )}
                    </div>
                    <div className="team-program-progress">
                      <div className="team-program-progress-bar">
                        <div
                          className="team-program-progress-fill"
                          style={{
                            width: `${sessionsCount ? Math.min(100, (completionsCount / sessionsCount) * 100) : 0}%`,
                          }}
                        />
                      </div>
                      <span>{completionsCount}/{sessionsCount} sedute</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="team-detail-section">
          <h4>Grafici</h4>
          {sortedPrograms.length === 0 ? (
            <p className="team-empty-line">Nessuna programmazione per i grafici.</p>
          ) : (
            <TeamCharts
              programs={sortedPrograms}
              prMaxes={athletePrMaxes}
              completions={selectedCompletions}
            />
          )}
        </section>

      </>
    );
  };

  return (
    <div className="team-page">
      <header className="team-header">
        <div className="team-header-copy">
          <h1>Team</h1>
          <p>{coachName ? `Allenatore ${coachName}` : 'Dashboard allenatore'}</p>
        </div>
        <div className="team-header-actions">
          <span className="team-header-stats"><strong>{athletes.length}</strong> atleti</span>
          <button type="button" className="team-events-open" onClick={() => setShowEvents(true)}>
            <Calendar size={16} /> Eventi
          </button>
        </div>
      </header>

      {loadError && <div className="team-error" role="alert">{loadError}</div>}

      <div className={`team-body${selectedAthlete ? ' has-detail' : ''}`}>
        <aside className="team-list-pane">
          <label className="team-search">
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca per nome o username"
              aria-label="Cerca atleta"
            />
          </label>

          <div className="team-filters">
            <label className="team-filter">
              <span>Categoria</span>
              <select value={weightFilter} onChange={(event) => handleWeightChange(event.target.value)}>
                <option value="all">Tutte</option>
                {weightOptions.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="team-filter">
              <span>Sesso</span>
              <select value={sexFilter} onChange={(event) => handleSexChange(event.target.value)}>
                <option value="all">Tutti</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </label>
            <label className="team-filter">
              <span>Età</span>
              <select value={ageFilter} onChange={(event) => setAgeFilter(event.target.value)}>
                <option value="all">Tutte</option>
                {COACH_AGE_FILTERS.map((option) => (
                  <option value={option} key={option}>{option}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="team-athlete-list">
            {athletes.length === 0 && (
              <p className="team-list-state">Nessun atleta assegnato.</p>
            )}
            {athletes.length > 0 && filteredAthletes.length === 0 && (
              <p className="team-list-state">Nessun atleta corrisponde ai filtri.</p>
            )}
            {filteredAthletes.map(renderAthleteRow)}
          </div>
        </aside>

        <section className="team-detail-pane">
          {renderDetail()}
        </section>

        <aside className="team-expiring-pane">
          <div className="team-expiring-head">
            <h3>Scheda in scadenza</h3>
          </div>
          <div className="team-expiring-filters">
            {RANGE_FILTERS.map((range) => (
              <button
                type="button"
                key={range.key}
                className={`team-range-chip${rangeFilter === range.key ? ' active' : ''}`}
                onClick={() => setRangeFilter(range.key)}
              >
                {range.label}
              </button>
            ))}
          </div>
          <div className="team-expiring-list">
            {expiringRows.length === 0 ? (
              <p className="team-list-state">Nessuna scheda in scadenza.</p>
            ) : (
              expiringRows.map(({ athlete, program, days }) => (
                <button
                  type="button"
                  key={`${athlete.key}-${program.id}`}
                  className="team-expiring-row"
                  onClick={() => setSelectedKey(athlete.key)}
                >
                  <span className="team-expiring-name">{displayName(athlete)}</span>
                  <span className="team-expiring-program">{program.name}</span>
                  <span className={`team-expiring-days${days < 0 ? ' expired' : ''}`}>
                    {days < 0 ? `Scaduta da ${Math.abs(days)} gg` : `${days} gg`}
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      </div>

      {showEvents && (
        <TeamEvents
          coachKey={normalizedCoachKey}
          coachName={coachName}
          athletes={athletes}
          onClose={() => setShowEvents(false)}
        />
      )}

      {programFormOpen && selectedAthlete && (
        <TeamProgramForm
          athleteKey={selectedAthlete.key}
          coachKey={normalizedCoachKey}
          onClose={() => setProgramFormOpen(false)}
          onSaved={() => setProgramFormOpen(false)}
        />
      )}
      {viewingProgram && (
        <TeamProgramViewer
          program={viewingProgram}
          prMaxes={athletePrMaxes}
          completions={selectedCompletions}
          variantError={variantError}
          onVariantChange={(week, session, liftIndex, variant) =>
            handleVariantChange(viewingProgram, week, session, liftIndex, variant)
          }
          onClose={() => {
            setVariantError('');
            setViewingProgramId(null);
          }}
        />
      )}
    </div>
  );
};

TeamDashboard.propTypes = {
  coachKey: PropTypes.string.isRequired,
  coachName: PropTypes.string,
};

export default TeamDashboard;
