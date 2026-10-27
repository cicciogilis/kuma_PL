import { useState } from 'react';
import PropTypes from 'prop-types';
import { CheckCircle2, Circle, ChevronDown, ChevronUp } from 'lucide-react';
import ProgramBlocks from './ProgramBlocks';
import {
  getMaxForLift,
  getStaccoVariant,
  noteKeyFor,
} from './utils/programDisplay';
import { workoutKey } from './utils/programData';
import './ProgramMatrix.css';

// Ordine fisso delle colonne: è il senso della vista a tre colonne.
const LIFT_COLUMNS = [
  { key: 'squat', label: 'Squat' },
  { key: 'panca', label: 'Panca' },
  { key: 'stacco', label: 'Stacco' },
];

const ProgramMatrix = ({
  program,
  prMaxes = {},
  completions = {},
  isEditingNotes = false,
  noteDraft = {},
  onNoteChange = () => {},
  onVariantChange,
  onToggleCompleted,
  collapsibleWeeks = false,
  defaultWeeksOpen = true,
}) => {
  const [openWeeks, setOpenWeeks] = useState(() => {
    if (!collapsibleWeeks) return {};
    const initial = {};
    (program.weeks || []).forEach((week) => {
      initial[week.week] = defaultWeeksOpen;
    });
    return initial;
  });

  const toggleWeek = (weekNumber) => {
    setOpenWeeks((prev) => ({ ...prev, [weekNumber]: !prev[weekNumber] }));
  };

  const isWeekOpen = (weekNumber) => {
    if (!collapsibleWeeks) return true;
    return openWeeks[weekNumber] ?? defaultWeeksOpen;
  };

  return (
    <div className="program-matrix-wrap">
      <table className="program-matrix">
        <thead>
          <tr>
            <th scope="col" className="program-matrix-day-head">Giorno</th>
            {LIFT_COLUMNS.map((column) => (
              <th scope="col" key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>

        {(program.weeks || []).map((week) => {
          const weekOpen = isWeekOpen(week.week);

          return (
            <tbody key={`${program.id}-week-${week.week}`}>
              <tr className="program-matrix-week">
                <th scope="colgroup" colSpan={LIFT_COLUMNS.length + 1}>
                  <div className="program-matrix-week-head">
                    {collapsibleWeeks && (
                      <button
                        type="button"
                        className="program-matrix-week-toggle"
                        onClick={() => toggleWeek(week.week)}
                        aria-expanded={weekOpen}
                      >
                        <span className="program-matrix-week-chevron" aria-hidden="true">
                          {weekOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </span>
                      </button>
                    )}
                    <span className="program-matrix-week-title">Week {week.week}</span>
                    <span className="program-matrix-week-meta">{week.sessions.length} day</span>
                  </div>
                </th>
              </tr>

              {weekOpen && week.sessions.map((session, sessionIndex) => {
                const completed = Boolean(
                  completions[workoutKey(program.id, week.week, session.day)]
                );
                const lifts = (session.lifts || []).map((lift, liftIndex) => ({ lift, liftIndex }));

                return (
                  <tr
                    key={`${program.id}-${week.week}-${session.day}`}
                    className={`program-matrix-row${completed ? ' completed' : ''}`}
                  >
                    <th scope="row" className="program-matrix-day">
                      <span className="program-matrix-day-label">Day {sessionIndex + 1}</span>
                      {session.weekday && (
                        <span className="program-matrix-weekday">{session.weekday}</span>
                      )}
                      {onToggleCompleted ? (
                        <button
                          type="button"
                          className={`program-day-completion${completed ? ' completed' : ''}`}
                          onClick={() => onToggleCompleted(week, session)}
                          aria-label={completed ? 'Segna come non completato' : 'Segna come completato'}
                          aria-pressed={completed}
                          title={completed ? 'Segna come non completato' : 'Segna come completato'}
                        >
                          {completed
                            ? <CheckCircle2 size={18} aria-hidden="true" />
                            : <Circle size={18} aria-hidden="true" />}
                        </button>
                      ) : (
                        completed && (
                          <span
                            className="program-matrix-done"
                            title="Day completato dall'atleta"
                            aria-label="Day completato dall'atleta"
                          >
                            <CheckCircle2 size={16} aria-hidden="true" />
                          </span>
                        )
                      )}
                    </th>

                    {LIFT_COLUMNS.map((column) => {
                      const entry = lifts.find(({ lift }) => lift.key === column.key);

                      if (!entry) {
                        return (
                          <td
                            key={column.key}
                            className="program-matrix-cell is-empty"
                            data-label={column.label}
                          >
                            <span className="program-matrix-dash" aria-label="Nessuna alzata">—</span>
                          </td>
                        );
                      }

                      const { lift, liftIndex } = entry;
                      const max = getMaxForLift(program, lift, prMaxes);
                      const noteKey = noteKeyFor(week, session, liftIndex);
                      const isStacco = lift.key === 'stacco';
                      const staccoVariant = isStacco ? getStaccoVariant(program, lift) : '';

                      return (
                        <td
                          key={column.key}
                          className="program-matrix-cell"
                          data-label={column.label}
                        >
                          <ProgramBlocks blocks={lift.blocks || []} max={max} />

                          {isStacco && (onVariantChange ? (
                            <label className="program-matrix-variant">
                              <span className="program-variant-label">Variante</span>
                              <select
                                className="program-variant-select"
                                value={staccoVariant}
                                onChange={(event) =>
                                  onVariantChange(week, session, liftIndex, event.target.value)
                                }
                                aria-label={`Variante stacco, Day ${sessionIndex + 1}, Week ${week.week}`}
                              >
                                <option value="classico">Classico</option>
                                <option value="sumo">Sumo</option>
                              </select>
                            </label>
                          ) : (
                            <span className="program-matrix-variant-badge">
                              {staccoVariant === 'sumo' ? 'Sumo' : 'Classico'}
                            </span>
                          ))}

                          {isEditingNotes ? (
                            <textarea
                              className="program-note-input"
                              rows={2}
                              value={noteDraft[noteKey] ?? ''}
                              onChange={(event) => onNoteChange(noteKey, event.target.value)}
                              placeholder="Aggiungi una nota"
                              aria-label={`Nota ${lift.label || column.label}, Day ${sessionIndex + 1}, Week ${week.week}`}
                              maxLength={300}
                            />
                          ) : (
                            lift.notes && <div className="program-lift-notes">{lift.notes}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          );
        })}
      </table>
    </div>
  );
};

ProgramMatrix.propTypes = {
  program: PropTypes.shape({
    id: PropTypes.string,
    weeks: PropTypes.array.isRequired,
  }).isRequired,
  prMaxes: PropTypes.shape({
    squat: PropTypes.number,
    bench: PropTypes.number,
    deadlift: PropTypes.number,
  }),
  completions: PropTypes.object,
  isEditingNotes: PropTypes.bool,
  noteDraft: PropTypes.object,
  onNoteChange: PropTypes.func,
  onVariantChange: PropTypes.func,
  onToggleCompleted: PropTypes.func,
  collapsibleWeeks: PropTypes.bool,
  defaultWeeksOpen: PropTypes.bool,
};

export default ProgramMatrix;