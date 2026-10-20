import PropTypes from 'prop-types';
import { AlertCircle } from 'lucide-react';
import './Programmazioni.css';

const ProgramEndingWarning = ({ className = '' }) => (
  <div
    className={`program-ending-warning${className ? ` ${className}` : ''}`}
    role="status"
  >
    <AlertCircle size={16} aria-hidden="true" />
    <span>Attenzione, stai per finire la tua scheda. Scrivi a Marco per informarlo</span>
  </div>
);

ProgramEndingWarning.propTypes = {
  className: PropTypes.string,
};

export default ProgramEndingWarning;
