import PropTypes from 'prop-types';
import { CheckCircle2 } from 'lucide-react';
import './Programmazioni.css';
import {
  compareLifts,
  formatBlock,
  formatRawWeight,
  formatRpeReference,
  formatSuggestedWeight,
  getMaxForLift,
  getSuggestedWeight,
  noteKeyFor,
} from './utils/programDisplay';

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
}) => (
  <div className="program-day">
    <div className="program-day-title">
      <span className="program-day-title-text">{title || `Day ${sessionIndex + 1}`}</span>
      {session.weekday && <span className="program-day-weekday">{session.weekday}</span>}
      {completed && (
        <span
          className="program-day-completed"
          role="img"
          aria-label="Allenamento completato"
          title="Allenamento completato"
        >
          <CheckCircle2 size={17} aria-hidden="true" />
        </span>
      )}
    </div>

    {[...(session.lifts || [])]
      .map((lift, liftIndex) => ({ lift, liftIndex }))
      .sort((a, b) => compareLifts(a.lift, b.lift))
      .map(({ lift, liftIndex }) => {
        const max = getMaxForLift(program, lift, prMaxes);
        const noteKey = noteKeyFor(week, session, liftIndex);

        return (
          <div
            className="program-lift"
            key={`${program.id}-${week.week}-${session.day}-${lift.key}-${liftIndex}`}
          >
            <div className="program-lift-head">
              <span className="program-lift-name">{lift.label}</span>
              <div className="program-lift-blocks">
                {(lift.blocks || []).map((block, blockIndex) => {
                  const rawWeight = !block.percentBase
                    && block.percent != null
                    && max
                    ? (max * block.percent) / 100
                    : null;
                  const suggestedWeight = getSuggestedWeight(rawWeight);
                  const hasSuggestion = suggestedWeight != null
                    && Math.abs(suggestedWeight - rawWeight) > 1e-6;

                  return (
                    <span
                      className="program-block"
                      key={`${lift.key}-block-${blockIndex}`}
                    >
                      {formatBlock(block)}
                      {rawWeight != null && (
                        <strong> → {formatRawWeight(rawWeight)} kg</strong>
                      )}
                      {hasSuggestion && (
                        <span className="program-block-suggestion">
                          ({formatSuggestedWeight(suggestedWeight)} kg)
                        </span>
                      )}
                      {block.percentBase && (
                        <span className="program-block-reference">
                          (calcolato sul {formatRpeReference(block.percentBase)})
                        </span>
                      )}
                    </span>
                  );
                })}
              </div>
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
};

export default ProgramDay;
