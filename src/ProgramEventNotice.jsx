import PropTypes from 'prop-types';
import { Megaphone } from 'lucide-react';
import { formatDateIt, parseLocalDate, todayIso } from './utils/programData';
import './ProgramEventNotice.css';

const liftLabel = (lift) => {
  if (lift === 'squat') return 'Squat';
  if (lift === 'panca') return 'Panca';
  if (lift === 'stacco') return 'Stacco';
  return '';
};

// La convocazione resta visibile fino al giorno della gara compreso.
const isEventUpcoming = (event) => {
  if (!event?.date) return true;
  const eventDate = parseLocalDate(event.date);
  if (!eventDate) return true;
  const today = parseLocalDate(todayIso());
  return eventDate.getTime() >= today.getTime();
};

export const ProgramEventNotice = ({ event }) => {
  if (!event || !isEventUpcoming(event)) return null;

  const coach = event.coachName || 'Il tuo allenatore';
  const typeText = event.type === 'single'
    ? ['Single Lift', liftLabel(event.singleLift)].filter(Boolean).join(' · ')
    : 'Gara completa';

  return (
    <div className="program-event-notice" role="status">
      <span className="program-event-notice-icon" aria-hidden="true">
        <Megaphone size={18} />
      </span>
      <div className="program-event-notice-body">
        <span className="program-event-notice-kicker">{coach} ti ha convocato per</span>
        <strong className="program-event-notice-name">{event.name}</strong>
        <span className="program-event-notice-meta">
          {[event.federation, typeText].filter(Boolean).join(' · ')}
        </span>
        <span className="program-event-notice-place">
          {[formatDateIt(event.date), event.location].filter(Boolean).join(' · ')}
        </span>
      </div>
    </div>
  );
};

ProgramEventNotice.propTypes = {
  event: PropTypes.shape({
    id: PropTypes.string,
    name: PropTypes.string,
    federation: PropTypes.string,
    location: PropTypes.string,
    date: PropTypes.string,
    type: PropTypes.string,
    singleLift: PropTypes.string,
    coachName: PropTypes.string,
  }),
};

const ProgramEventNotices = ({ events, className = '' }) => {
  const visible = (Array.isArray(events) ? events : []).filter(isEventUpcoming);
  if (!visible.length) return null;

  return (
    <div className={['program-event-notices', className].filter(Boolean).join(' ')}>
      {visible.map((event) => (
        <ProgramEventNotice key={event.id} event={event} />
      ))}
    </div>
  );
};

ProgramEventNotices.propTypes = {
  events: PropTypes.array,
  className: PropTypes.string,
};

export default ProgramEventNotices;
