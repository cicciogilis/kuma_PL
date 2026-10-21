import PropTypes from 'prop-types';
import { CheckCircle2, Circle } from 'lucide-react';
import './Programmazioni.css';
import ProgramBlocks from './ProgramBlocks';
import {
  compareLifts,
  getMaxForLift,
  getStaccoVariant,
  noteKeyFor,
} from './utils/programDisplay';

const StaccoVariantControl = ({ liftLabel, value, onChange }) => (
  <label className="program-variant">
    <span className="program-variant-label">Variante</span>
    <select
      className="program-variant-select"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      aria-label={`Variante ${liftLabel}`}
    >
      <option value="classico">Classico</option>
      <option value="sumo">Sumo</option>
    </select>
  </label>
);

StaccoVariantControl.propTypes = {
  liftLabel: PropTypes.string,
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

const ProgramDay = ({
  program,
  week,
  session,
  sessionIndex,
  prMaxes = {},
  title,
  completed = false,
  isEditingNotes = false,
  noteDraft = {},
  onNoteChange = () => {},
  onToggleCompleted,
  onVariantChange,
}) => (
  <div className="program-day">
    <div className="program-day-title">
      <span className="program-day-title-text">{title || `Day ${sessionIndex + 1}`}</span>
      {session.weekday && <span className="program-day-weekday">{session.weekday}</span>}
      {onToggleCompleted ? (
        <button
          type="button"
          className={`program-day-completion${completed ? ' completed' : ''}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleCompleted();
          }}
          aria-label={completed ? 'Segna come non completato' : 'Segna come completato'}
          aria-pressed={completed}
          title={completed ? 'Segna come non completato' : 'Segna come completato'}
        >
          {completed
            ? <CheckCircle2 size={20} aria-hidden="true" />
            : <Circle size={20} aria-hidden="true" />}
        </button>
      ) : (
        completed && (
          <span
            className="program-day-completed"
            role="img"
            aria-label="Allenamento completato"
            title="Allenamento completato"
          >
            <CheckCircle2 size={17} aria-hidden="true" />
          </span>
        )
      )}
    </div>

    {[...(session.lifts || [])]
      .map((lift, liftIndex) => ({ lift, liftIndex }))
      .sort((a, b) => compareLifts(a.lift, b.lift))
      .map(({ lift, liftIndex }) => {
        const max = getMaxForLift(program, lift, prMaxes);
        const noteKey = noteKeyFor(week, session, liftIndex);
        const isStacco = lift.key === 'stacco';
        const staccoVariant = isStacco ? getStaccoVariant(program, lift) : '';
        const hasVariantControl = isStacco && Boolean(onVariantChange);
        const headerClassName = `program-lift-head${hasVariantControl ? ' program-lift-head-variant' : ''}`;

        return (
          <div
            className="program-lift"
            key={`${program.id}-${week.week}-${session.day}-${lift.key}-${liftIndex}`}
          >
            <div className={headerClassName}>
              <span className={`program-lift-name${isStacco ? ' program-lift-name-stacco' : ''}`}>
                {isStacco ? (
                  <>
                    <span>Stacco</span>{' '}
                    <span className="program-lift-name-variant">
                      {staccoVariant === 'sumo' ? 'Sumo' : 'Classico'}
                    </span>
                  </>
                ) : lift.label}
              </span>
              <ProgramBlocks blocks={lift.blocks || []} max={max} />
              {hasVariantControl && (
                <StaccoVariantControl
                  liftLabel={lift.label}
                  value={staccoVariant}
                  onChange={(variant) => onVariantChange(liftIndex, variant)}
                />
              )}
            </div>

            {isEditingNotes ? (
              <textarea
                className="program-note-input"
                rows={2}
                value={noteDraft[noteKey] ?? ''}
                onChange={(event) => onNoteChange(noteKey, event.target.value)}
                placeholder="Aggiungi una nota"
                aria-label={`Nota ${lift.label}, Day ${sessionIndex + 1}, Week ${week.week}`}
                maxLength={300}
              />
            ) : (
              lift.notes && <div className="program-lift-notes">{lift.notes}</div>
            )}
          </div>
        );
      })}
  </div>
);

ProgramDay.propTypes = {
  program: PropTypes.shape({
    id: PropTypes.string,
    usePrMax: PropTypes.bool,
    maxes: PropTypes.shape({
      panca: PropTypes.number,
      squat: PropTypes.number,
      staccoSumo: PropTypes.number,
      staccoClassico: PropTypes.number,
    }),
  }).isRequired,
  week: PropTypes.shape({
    week: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    sessions: PropTypes.array,
  }).isRequired,
  session: PropTypes.shape({
    day: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    weekday: PropTypes.string,
    lifts: PropTypes.array,
  }).isRequired,
  sessionIndex: PropTypes.number.isRequired,
  prMaxes: PropTypes.shape({
    squat: PropTypes.number,
    bench: PropTypes.number,
    deadlift: PropTypes.number,
  }),
  title: PropTypes.string,
  completed: PropTypes.bool,
  isEditingNotes: PropTypes.bool,
  noteDraft: PropTypes.object,
  onNoteChange: PropTypes.func,
  onToggleCompleted: PropTypes.func,
  onVariantChange: PropTypes.func,
};

export default ProgramDay;
