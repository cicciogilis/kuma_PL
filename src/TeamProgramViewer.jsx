import PropTypes from 'prop-types';
import { Calendar, Clock, X } from 'lucide-react';
import ProgramBlocks from './ProgramBlocks';
import ProgramMatrix from './ProgramMatrix';
import { formatDateIt } from './utils/programData';
import './TeamProgramViewer.css';

const exerciseBlocks = (exercise) => {
  if (Array.isArray(exercise.blocks) && exercise.blocks.length) return exercise.blocks;
  if (exercise.sets || exercise.reps) {
    return [{
      sets: exercise.sets,
      reps: exercise.reps,
      rpe: null,
      percent: null,
      percentBase: null,
      note: '',
    }];
  }
  return [];
};

const TeamProgramViewer = ({
  program,
  prMaxes,
  completions,
  variantError = '',
  onVariantChange,
  onClose,
}) => {
  const complementari = Array.isArray(program.complementari) ? program.complementari : [];

  return (
    <div className="team-viewer-backdrop" role="presentation" onClick={onClose}>
      <div
        className="team-viewer"
        role="dialog"
        aria-modal="true"
        aria-label={`Programmazione ${program.name || ''}`}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="team-viewer-header">
          <h2>{program.name || 'Programmazione'}</h2>
          <button type="button" className="team-viewer-close" onClick={onClose} aria-label="Chiudi">
            <X size={20} />
          </button>
        </header>
        <div className="team-viewer-meta">
          <span><Calendar size={12} /> dal {formatDateIt(program.startDate) || '—'}</span>
          <span><Clock size={12} /> {program.durationWeeks} week</span>
          <span className="team-viewer-badge">
            {program.authorRole === 'coach' ? 'Creata dall\'allenatore' : 'Creata dall\'atleta'}
          </span>
          <span className="team-viewer-badge">
            {program.usePrMax ? 'Massimali PR' : 'Massimali scheda'}
          </span>
        </div>

        {variantError && (
          <p className="team-viewer-error" role="alert">{variantError}</p>
        )}

        <div className="team-viewer-matrix">
          <ProgramMatrix
            program={program}
            prMaxes={prMaxes}
            completions={completions}
            onVariantChange={onVariantChange}
          />
        </div>

        {complementari.length > 0 && (
          <section className="team-viewer-accessories">
            <h5>Complementari</h5>
            {complementari.map((day) => (
              <div className="team-viewer-accessory-day" key={day.day}>
                <span className="team-viewer-accessory-title">
                  {day.name || `Day ${day.day}`}
                  {day.weekday ? ` · ${day.weekday}` : ''}
                </span>
                {(day.exercises || []).map((exercise, index) => (
                  <div className="program-lift" key={`${day.day}-${index}`}>
                    <div className="program-lift-head">
                      <span className="program-lift-name program-lift-name-accessory">
                        {exercise.name}
                      </span>
                      <ProgramBlocks blocks={exerciseBlocks(exercise)} accessory />
                    </div>
                    {exercise.notes && <div className="program-lift-notes">{exercise.notes}</div>}
                  </div>
                ))}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
};

TeamProgramViewer.propTypes = {
  program: PropTypes.object.isRequired,
  prMaxes: PropTypes.object,
  completions: PropTypes.object,
  variantError: PropTypes.string,
  onVariantChange: PropTypes.func,
  onClose: PropTypes.func.isRequired,
};

export default TeamProgramViewer;
