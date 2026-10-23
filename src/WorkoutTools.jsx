import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Calculator as CalculatorIcon,
  ChevronDown,
  CircleStop,
  Clock3,
  Dumbbell,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Timer as TimerIcon,
  X,
} from 'lucide-react';
import {
  BAR_WEIGHT,
  calculatePlateLoad,
} from './utils/plateLoading';
import { usePersistentState } from './utils/usePersistentState';
import './WorkoutTools.css';

const KG_FORMATTER = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 2,
});

const TIMER_PRESETS = [1, 2, 3, 4, 5];
const QUICK_PERCENTAGES = [50, 60, 70, 75, 80, 85, 90, 95];
const SET_NUMBERS = Array.from({ length: 10 }, (_, index) => index + 1);
const BAR_TYPES = [
  { id: 'bilanciere', label: 'Bilanciere 20 kg', weight: BAR_WEIGHT },
  { id: 'safety', label: 'Safety Bar 29 kg', weight: 29 },
  { id: 'cambered', label: 'Cambered & Bow Bar 25 kg', weight: 25 },
];
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const STORAGE_KEYS = {
  plateWeight: 'kuma_workout_tools_plate_weight',
  barType: 'kuma_workout_tools_bar_type',
  completedSets: 'kuma_workout_tools_completed_sets',
  clock: 'kuma_workout_tools_clock',
  calculator: 'kuma_workout_tools_calculator',
};

const createDefaultClockState = () => ({
  mode: 'timer',
  timerPreset: 3,
  timerRemaining: 3 * 60,
  timerRunning: false,
  timerEndsAt: null,
  stopwatchElapsed: 0,
  stopwatchRunning: false,
  stopwatchStartedAt: null,
  alarmRinging: false,
});

const formatKg = (value) => KG_FORMATTER.format(value);
const formatPlateList = (plates) =>
  plates.map((plate) => `${formatKg(plate.weight)} kg`).join(' + ');

const formatTimer = (seconds) => {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const formatStopwatch = (milliseconds) => {
  const totalTenths = Math.floor(Math.max(0, milliseconds) / 100);
  const minutes = Math.floor(totalTenths / 600);
  const seconds = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${tenths}`;
};

const createInitialCalculator = () => ({
  display: '0',
  stored: null,
  operator: null,
  waiting: false,
  expression: '',
  error: false,
});

const parseCalculatorValue = (text) => {
  const parsed = Number(String(text).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

const formatCalculatorValue = (value) => {
  if (!Number.isFinite(value)) return 'Errore';
  const rounded = Math.round((value + Number.EPSILON) * 1e10) / 1e10;
  const normalized = Object.is(rounded, -0) ? 0 : rounded;

  if (Math.abs(normalized) >= 1e12) {
    return normalized.toExponential(6).replace('.', ',');
  }

  return String(normalized).replace('.', ',');
};

const applyCalculatorOperator = (left, right, operator) => {
  switch (operator) {
    case '+':
      return left + right;
    case '−':
      return left - right;
    case '×':
      return left * right;
    case '÷':
      return right === 0 ? null : left / right;
    default:
      return null;
  }
};

const CALCULATOR_ROWS = [
  [
    { label: 'C', action: 'clear', tone: 'muted', ariaLabel: 'Cancella tutto' },
    { label: '⌫', action: 'backspace', tone: 'muted', ariaLabel: 'Cancella ultima cifra' },
    { label: '%', action: 'percent', tone: 'muted', ariaLabel: 'Percentuale' },
    { label: '÷', action: 'operator', value: '÷', tone: 'operator', ariaLabel: 'Dividi' },
  ],
  [
    { label: '7', action: 'digit', value: '7' },
    { label: '8', action: 'digit', value: '8' },
    { label: '9', action: 'digit', value: '9' },
    { label: '×', action: 'operator', value: '×', tone: 'operator', ariaLabel: 'Moltiplica' },
  ],
  [
    { label: '4', action: 'digit', value: '4' },
    { label: '5', action: 'digit', value: '5' },
    { label: '6', action: 'digit', value: '6' },
    { label: '−', action: 'operator', value: '−', tone: 'operator', ariaLabel: 'Sottrai' },
  ],
  [
    { label: '1', action: 'digit', value: '1' },
    { label: '2', action: 'digit', value: '2' },
    { label: '3', action: 'digit', value: '3' },
    { label: '+', action: 'operator', value: '+', tone: 'operator', ariaLabel: 'Somma' },
  ],
  [
    { label: '±', action: 'sign', tone: 'muted', ariaLabel: 'Cambia segno' },
    { label: '0', action: 'digit', value: '0' },
    { label: ',', action: 'decimal', ariaLabel: 'Virgola decimale' },
    { label: '=', action: 'equals', tone: 'equals', ariaLabel: 'Uguale' },
  ],
];

const PlateStack = ({ plates }) => (
  <div className="wt-plate-stack" aria-hidden="true">
    {plates.map((plate, index) => (
      <span
        className="wt-plate"
        key={`${plate.weight}-${index}`}
        data-weight={plate.weight}
        style={{
          '--wt-plate-color': plate.color,
          '--wt-plate-text': plate.textColor,
          '--wt-plate-height': `${plate.height}px`,
          '--wt-plate-width': `${plate.width}px`,
        }}
      >
        <span>{plate.label}</span>
      </span>
    ))}
  </div>
);

PlateStack.propTypes = {
  plates: PropTypes.array.isRequired,
};

const PlateCalculator = () => {
  const [weight, setWeight] = usePersistentState(
    STORAGE_KEYS.plateWeight,
    '110'
  );
  const [barTypeId, setBarTypeId] = usePersistentState(
    STORAGE_KEYS.barType,
    BAR_TYPES[0].id
  );
  const selectedBar =
    BAR_TYPES.find((barType) => barType.id === barTypeId) || BAR_TYPES[0];
  const load = useMemo(
    () => calculatePlateLoad(weight, { barWeight: selectedBar.weight }),
    [selectedBar.weight, weight]
  );
  const barbellLabel = load.error
    ? 'Bilanciere senza dischi'
    : load.plates.length
      ? `Dischi caricati: ${formatPlateList(load.plates)}`
      : 'Solo bilanciere';

  const adjustWeight = (delta) => {
    const current = Number(String(weight).replace(',', '.')) || 0;
    const next = Math.max(0, Math.round((current + delta) * 100) / 100);
    setWeight(String(next));
  };

  return (
    <section className="wt-card wt-plate-card" aria-labelledby="wt-plate-title">
      <div className="wt-card-head">
        <div>
          <span className="wt-eyebrow">Carico bilanciere</span>
          <h3 id="wt-plate-title">Dischi</h3>
        </div>
        <div className="wt-bar-picker">
          <select
            value={selectedBar.id}
            onChange={(event) => setBarTypeId(event.target.value)}
            aria-label="Tipo di bilanciere"
          >
            {BAR_TYPES.map((barType) => (
              <option key={barType.id} value={barType.id}>
                {barType.label}
              </option>
            ))}
          </select>
          <ChevronDown size={12} aria-hidden="true" />
        </div>
      </div>

      <div className="wt-weight-input-row">
        <button
          type="button"
          className="wt-step-button"
          onClick={() => adjustWeight(-2.5)}
          aria-label="Riduci il carico di 2,5 kg"
        >
          <Minus size={15} />
        </button>
        <label className="wt-weight-input">
          <input
            type="number"
            min="0"
            step="2.5"
            inputMode="decimal"
            value={weight}
            onChange={(event) => setWeight(event.target.value)}
            aria-label="Carico totale in kg"
          />
          <span>kg</span>
        </label>
        <button
          type="button"
          className="wt-step-button"
          onClick={() => adjustWeight(2.5)}
          aria-label="Aumenta il carico di 2,5 kg"
        >
          <Plus size={15} />
        </button>
      </div>

      <div
        className={`wt-barbell${load.error ? ' is-invalid' : ''}`}
        role="img"
        aria-label={barbellLabel}
      >
        <div className="wt-barbell-bar" aria-hidden="true">
          <span className="wt-barbell-rod" />
          <span className="wt-barbell-sleeve" />
        </div>
        <PlateStack plates={load.plates} />
        <span className="wt-barbell-tip" aria-hidden="true" />
      </div>

      {load.error && (
        <p className="wt-plate-note wt-summary-warn">{load.error}</p>
      )}
      {!load.error && !load.exact && (
        <p className="wt-plate-note wt-summary-warn">
          Caricabile {formatKg(load.loadedTotal)} kg · resto{' '}
          {formatKg(load.remainderTotal)} kg
        </p>
      )}
    </section>
  );
};

const SetCounter = () => {
  const [completedSets, setCompletedSets] = usePersistentState(
    STORAGE_KEYS.completedSets,
    0
  );
  const safeCompletedSets = Math.min(
    10,
    Math.max(0, Number(completedSets) || 0)
  );

  return (
    <section className="wt-card wt-set-card" aria-labelledby="wt-set-title">
      <div className="wt-card-head">
        <h3 id="wt-set-title">Conta serie</h3>
        <button
          type="button"
          className="wt-icon-button"
          onClick={() => setCompletedSets(0)}
          disabled={safeCompletedSets === 0}
          aria-label="Azzera conta serie"
        >
          <RotateCcw size={14} />
        </button>
      </div>

      <div className="wt-set-body">
        <div className="wt-set-row" role="group" aria-label="Numero di serie completate">
          {SET_NUMBERS.map((number) => (
            <button
              type="button"
              key={number}
              className={`wt-set-button${number <= safeCompletedSets ? ' done' : ''}${number === safeCompletedSets ? ' current' : ''}`}
              aria-pressed={number === safeCompletedSets}
              aria-label={`Imposta ${number}`}
              onClick={() => setCompletedSets(number)}
            >
              {number}
            </button>
          ))}
        </div>
        <div className="wt-set-count" aria-live="polite">
          <strong>{safeCompletedSets}</strong>
          <span>/{SET_NUMBERS.length}</span>
        </div>
      </div>
    </section>
  );
};

const ClockDial = ({ progress, time, label }) => {
  const safeProgress = Math.min(1, Math.max(0, progress));
  const dashOffset = RING_CIRCUMFERENCE * (1 - safeProgress);

  return (
    <div className="wt-dial-wrap">
      <svg className="wt-dial" viewBox="0 0 120 120" aria-hidden="true">
        <circle className="wt-dial-track" cx="60" cy="60" r={RING_RADIUS} />
        <circle
          className="wt-dial-progress"
          cx="60"
          cy="60"
          r={RING_RADIUS}
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="wt-dial-content">
        <span className="wt-dial-time" role="timer" aria-live="off">{time}</span>
        <span className="wt-dial-label">{label}</span>
      </div>
    </div>
  );
};

ClockDial.propTypes = {
  progress: PropTypes.number.isRequired,
  time: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
};

const ClockTools = () => {
  const [clock, setClock] = usePersistentState(
    STORAGE_KEYS.clock,
    createDefaultClockState
  );
  const [now, setNow] = useState(() => Date.now());
  const audioContextRef = useRef(null);
  const alarmIntervalRef = useRef(null);

  const ensureAudioContext = useCallback(() => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
      }

      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        context.resume().catch(() => {});
      }

      return context;
    } catch {
      return null;
    }
  }, []);

  const playAlarmBeep = useCallback((context) => {
    try {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime;

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.18);
    } catch {
      // Audio can be unavailable or blocked; the timer UI must keep working.
    }
  }, []);

  useEffect(() => {
    if (!clock.timerRunning && !clock.stopwatchRunning) return undefined;

    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(interval);
  }, [clock.timerRunning, clock.stopwatchRunning]);

  const timerPreset = Math.min(
    5,
    Math.max(1, Number(clock.timerPreset) || 3)
  );
  const timerRemaining = clock.timerRunning && clock.timerEndsAt
    ? Math.max(0, Math.ceil((clock.timerEndsAt - now) / 1000))
    : Math.max(0, Number(clock.timerRemaining) || 0);
  const stopwatchElapsed = clock.stopwatchRunning && clock.stopwatchStartedAt
    ? Math.max(0, now - clock.stopwatchStartedAt)
    : Math.max(0, Number(clock.stopwatchElapsed) || 0);

  useEffect(() => {
    if (!clock.timerRunning || timerRemaining > 0) return;

    setClock((previous) => {
      if (!previous.timerRunning) return previous;
      return {
        ...previous,
        timerRunning: false,
        timerEndsAt: null,
        timerRemaining: 0,
        alarmRinging: true,
      };
    });
  }, [clock.timerRunning, timerRemaining, setClock]);

  useEffect(() => {
    if (!clock.alarmRinging) return undefined;

    const context = ensureAudioContext();
    if (!context) return undefined;

    const beep = () => {
      if (audioContextRef.current?.state !== 'running') {
        audioContextRef.current?.resume().catch(() => {});
        return;
      }
      playAlarmBeep(context);
    };

    beep();
    alarmIntervalRef.current = window.setInterval(beep, 650);

    return () => {
      if (alarmIntervalRef.current) {
        window.clearInterval(alarmIntervalRef.current);
        alarmIntervalRef.current = null;
      }
    };
  }, [clock.alarmRinging, ensureAudioContext, playAlarmBeep]);

  useEffect(() => {
    if (!clock.timerRunning && !clock.alarmRinging) return undefined;

    const unlockAudio = () => ensureAudioContext();
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    return () => document.removeEventListener('pointerdown', unlockAudio);
  }, [clock.timerRunning, clock.alarmRinging, ensureAudioContext]);

  const selectTimerPreset = (minutes) => {
    setClock((previous) => ({
      ...previous,
      timerPreset: minutes,
      timerRemaining: minutes * 60,
      timerRunning: false,
      timerEndsAt: null,
      alarmRinging: false,
    }));
  };

  const toggleTimer = () => {
    ensureAudioContext();
    setNow(Date.now());
    setClock((previous) => {
      if (previous.timerRunning) {
        const remaining = previous.timerEndsAt
          ? Math.max(0, Math.ceil((previous.timerEndsAt - Date.now()) / 1000))
          : Math.max(0, Number(previous.timerRemaining) || 0);
        return {
          ...previous,
          timerRunning: false,
          timerEndsAt: null,
          timerRemaining: remaining,
        };
      }

      const previousPreset = Math.min(
        5,
        Math.max(1, Number(previous.timerPreset) || 3)
      );
      const storedRemaining = Math.max(
        0,
        Number(previous.timerRemaining) || 0
      );
      const remaining = storedRemaining <= 0 ? previousPreset * 60 : storedRemaining;

      return {
        ...previous,
        timerRunning: true,
        timerEndsAt: Date.now() + remaining * 1000,
        timerRemaining: remaining,
        alarmRinging: false,
      };
    });
  };

  const resetTimer = () => {
    setClock((previous) => {
      const preset = Math.min(
        5,
        Math.max(1, Number(previous.timerPreset) || 3)
      );
      return {
        ...previous,
        timerRunning: false,
        timerEndsAt: null,
        timerRemaining: preset * 60,
        alarmRinging: false,
      };
    });
  };

  const toggleStopwatch = () => {
    setNow(Date.now());
    setClock((previous) => {
      if (previous.stopwatchRunning) {
        const elapsed = previous.stopwatchStartedAt
          ? Math.max(0, Date.now() - previous.stopwatchStartedAt)
          : Math.max(0, Number(previous.stopwatchElapsed) || 0);
        return {
          ...previous,
          stopwatchRunning: false,
          stopwatchStartedAt: null,
          stopwatchElapsed: elapsed,
        };
      }

      const baseElapsed = Math.max(0, Number(previous.stopwatchElapsed) || 0);
      return {
        ...previous,
        stopwatchRunning: true,
        stopwatchStartedAt: Date.now() - baseElapsed,
        stopwatchElapsed: baseElapsed,
      };
    });
  };

  const resetStopwatch = () => {
    setClock((previous) => ({
      ...previous,
      stopwatchRunning: false,
      stopwatchStartedAt: null,
      stopwatchElapsed: 0,
    }));
  };

  const stopAlarm = () => {
    setClock((previous) => ({ ...previous, alarmRinging: false }));
  };

  const isTimerMode = clock.mode !== 'stopwatch';
  const isRunning = isTimerMode ? clock.timerRunning : clock.stopwatchRunning;
  const rawDialProgress = isTimerMode
    ? (timerPreset * 60 ? timerRemaining / (timerPreset * 60) : 0)
    : (stopwatchElapsed % 60000) / 60000;
  const dialProgress = Math.min(1, Math.max(0, rawDialProgress));
  const dialTime = isTimerMode
    ? formatTimer(timerRemaining)
    : formatStopwatch(stopwatchElapsed);
  const dialLabel = isTimerMode
    ? (timerRemaining === 0 ? 'Tempo scaduto' : `${timerPreset} min`)
    : 'Cronometro';

  return (
    <section className="wt-card wt-clock-card" aria-labelledby="wt-clock-title">
      <div className="wt-card-head">
        <div>
          <span className="wt-eyebrow">Recupero</span>
          <h3 id="wt-clock-title">Timer e cronometro</h3>
        </div>
      </div>

      <div className="wt-clock-tabs" role="group" aria-label="Tipo di timer">
        <button
          type="button"
          className={`wt-clock-tab${isTimerMode ? ' active' : ''}`}
          aria-pressed={isTimerMode}
          onClick={() => setClock((previous) => ({ ...previous, mode: 'timer' }))}
        >
          <TimerIcon size={14} />
          Timer
        </button>
        <button
          type="button"
          className={`wt-clock-tab${!isTimerMode ? ' active' : ''}`}
          aria-pressed={!isTimerMode}
          onClick={() => setClock((previous) => ({ ...previous, mode: 'stopwatch' }))}
        >
          <Clock3 size={14} />
          Cronometro
        </button>
      </div>

      <div className="wt-clock-body">
        <ClockDial progress={dialProgress} time={dialTime} label={dialLabel} />

        <div className="wt-clock-side">
          {isTimerMode && (
            <div className="wt-presets" role="group" aria-label="Durata timer">
              {TIMER_PRESETS.map((minutes) => (
                <button
                  type="button"
                  key={minutes}
                  className={`wt-preset${timerPreset === minutes ? ' active' : ''}`}
                  aria-pressed={timerPreset === minutes}
                  onClick={() => selectTimerPreset(minutes)}
                >
                  {minutes} min
                </button>
              ))}
            </div>
          )}

          <div className="wt-clock-actions">
            <button
              type="button"
              className="wt-action-button primary"
              onClick={isTimerMode ? toggleTimer : toggleStopwatch}
            >
              {isRunning ? <Pause size={15} /> : <Play size={15} />}
              {isRunning ? 'Pausa' : 'Avvia'}
            </button>
            <button
              type="button"
              className="wt-action-button"
              onClick={isTimerMode ? resetTimer : resetStopwatch}
            >
              <RotateCcw size={14} />
              Azzera
            </button>
            {clock.alarmRinging && (
              <button
                type="button"
                className="wt-action-button stop"
                onClick={stopAlarm}
              >
                <CircleStop size={14} />
                Stop
              </button>
            )}
          </div>

          <p className="wt-clock-hint">
            {isTimerMode
              ? 'Scegli i minuti e avvia il conto alla rovescia.'
              : 'Il cronometro conta il tempo totale della sessione o del recupero.'}
          </p>
        </div>
      </div>
    </section>
  );
};

const TrainingCalculator = () => {
  const [calc, setCalc] = usePersistentState(
    STORAGE_KEYS.calculator,
    createInitialCalculator
  );

  const handleDigit = (digit) => {
    setCalc((previous) => {
      if (previous.error) {
        return { ...createInitialCalculator(), display: digit };
      }

      if (previous.waiting) {
        return {
          ...previous,
          display: digit,
          waiting: false,
          expression: previous.operator ? previous.expression : '',
        };
      }

      if (previous.display === '0') {
        return { ...previous, display: digit };
      }

      if (previous.display.replace(/[^0-9]/g, '').length >= 12) {
        return previous;
      }

      return { ...previous, display: `${previous.display}${digit}` };
    });
  };

  const handleDecimal = () => {
    setCalc((previous) => {
      if (previous.error) {
        return { ...createInitialCalculator(), display: '0,' };
      }

      if (previous.waiting) {
        return {
          ...previous,
          display: '0,',
          waiting: false,
          expression: previous.operator ? previous.expression : '',
        };
      }

      if (previous.display.includes(',')) return previous;
      return { ...previous, display: `${previous.display},` };
    });
  };

  const handleBackspace = () => {
    setCalc((previous) => {
      if (previous.error) return createInitialCalculator();
      const nextDisplay = previous.display.length <= 1
        ? '0'
        : previous.display.slice(0, -1);
      return { ...previous, display: nextDisplay || '0' };
    });
  };

  const handleSign = () => {
    setCalc((previous) => {
      const current = parseCalculatorValue(previous.display);
      if (current == null || current === 0) return previous;
      return {
        ...previous,
        display: formatCalculatorValue(-current),
        waiting: false,
      };
    });
  };

  const handlePercent = () => {
    setCalc((previous) => {
      const current = parseCalculatorValue(previous.display);
      if (current == null) return previous;
      return {
        ...previous,
        display: formatCalculatorValue(current / 100),
        waiting: false,
      };
    });
  };

  const handleOperator = (operator) => {
    setCalc((previous) => {
      if (previous.error) return previous;
      const current = parseCalculatorValue(previous.display);
      if (current == null) return previous;

      if (previous.stored == null) {
        return {
          ...previous,
          stored: current,
          operator,
          waiting: true,
          expression: `${formatCalculatorValue(current)} ${operator}`,
        };
      }

      if (previous.waiting) {
        return {
          ...previous,
          operator,
          expression: `${formatCalculatorValue(previous.stored)} ${operator}`,
        };
      }

      const result = applyCalculatorOperator(previous.stored, current, previous.operator);
      if (result == null) {
        return {
          ...previous,
          display: 'Errore',
          stored: null,
          operator: null,
          waiting: false,
          expression: '',
          error: true,
        };
      }

      return {
        ...previous,
        display: formatCalculatorValue(result),
        stored: result,
        operator,
        waiting: true,
        expression: `${formatCalculatorValue(result)} ${operator}`,
      };
    });
  };

  const handleEquals = () => {
    setCalc((previous) => {
      if (previous.error || previous.stored == null || previous.operator == null) {
        return previous;
      }

      const current = parseCalculatorValue(previous.display);
      if (current == null) return previous;

      const result = applyCalculatorOperator(previous.stored, current, previous.operator);
      if (result == null) {
        return {
          ...previous,
          display: 'Errore',
          stored: null,
          operator: null,
          waiting: false,
          expression: '',
          error: true,
        };
      }

      return {
        display: formatCalculatorValue(result),
        stored: null,
        operator: null,
        waiting: true,
        expression: `${formatCalculatorValue(previous.stored)} ${previous.operator} ${formatCalculatorValue(current)} =`,
        error: false,
      };
    });
  };

  const handleQuickPercentage = (percentage) => {
    setCalc((previous) => {
      if (previous.error) return previous;
      const current = parseCalculatorValue(previous.display);
      if (current == null) return previous;
      return {
        ...previous,
        display: formatCalculatorValue((current * percentage) / 100),
        waiting: false,
      };
    });
  };

  const handleCalculatorKey = (key) => {
    switch (key.action) {
      case 'digit':
        handleDigit(key.value);
        break;
      case 'decimal':
        handleDecimal();
        break;
      case 'backspace':
        handleBackspace();
        break;
      case 'sign':
        handleSign();
        break;
      case 'percent':
        handlePercent();
        break;
      case 'operator':
        handleOperator(key.value);
        break;
      case 'equals':
        handleEquals();
        break;
      case 'clear':
      default:
        setCalc(createInitialCalculator());
        break;
    }
  };

  return (
    <section className="wt-card wt-calc-card" aria-labelledby="wt-calc-title">
      <div className="wt-card-head">
        <div>
          <span className="wt-eyebrow">Calcoli rapidi</span>
          <h3 id="wt-calc-title">Calcolatrice</h3>
        </div>
        <CalculatorIcon size={18} className="wt-card-icon" aria-hidden="true" />
      </div>

      <div className="wt-calc-body">
        <div className="wt-calc-display">
          <span className="wt-calc-expression" aria-hidden="true">
            {calc.expression}
          </span>
          <span className="wt-calc-value" aria-live="polite">{calc.display}</span>
          <div className="wt-calc-shortcuts" role="group" aria-label="Percentuali rapide">
            {QUICK_PERCENTAGES.map((percentage) => (
              <button
                type="button"
                key={percentage}
                className="wt-calc-shortcut"
                onClick={() => handleQuickPercentage(percentage)}
              >
                {percentage}%
              </button>
            ))}
          </div>
        </div>

        <div className="wt-calc-keys" role="group" aria-label="Tasti calcolatrice">
          {CALCULATOR_ROWS.flatMap((row, rowIndex) => (
            row.map((key, keyIndex) => (
              <button
                type="button"
                key={`${rowIndex}-${keyIndex}-${key.label}`}
                className={`wt-calc-key${key.tone ? ` wt-calc-key-${key.tone}` : ''}`}
                aria-label={key.ariaLabel || key.label}
                onClick={() => handleCalculatorKey(key)}
              >
                {key.label}
              </button>
            ))
          ))}
        </div>
      </div>
    </section>
  );
};

const WorkoutTools = ({ showLauncher = true }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openerRef = useRef(null);
  const closeButtonRef = useRef(null);

  useEffect(() => {
    if (!showLauncher && isOpen) {
      setIsOpen(false);
    }
  }, [isOpen, showLauncher]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    const opener = openerRef.current;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleKeyDown);
    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      window.cancelAnimationFrame(focusFrame);
      opener?.focus();
    };
  }, [isOpen]);

  return (
    <>
      {showLauncher && (
        <button
          ref={openerRef}
          type="button"
          className="wt-fab"
          aria-label="Apri strumenti allenamento"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setIsOpen(true)}
        >
          <Dumbbell size={25} />
        </button>
      )}

      <div
        className={`wt-overlay${isOpen ? ' is-open' : ''}`}
        aria-hidden={!isOpen}
        onClick={() => setIsOpen(false)}
      >
        <div
          className="wt-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wt-title"
          onClick={(event) => event.stopPropagation()}
        >
          <header className="wt-modal-header">
            <div className="wt-title-wrap">
              <span className="wt-title-icon" aria-hidden="true">
                <Dumbbell size={20} />
              </span>
              <div>
                <h2 className="wt-modal-title" id="wt-title">Strumenti allenamento</h2>
                <p className="wt-modal-subtitle">
                  Carichi, serie, recupero e calcoli per la sessione
                </p>
              </div>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              className="wt-close"
              onClick={() => setIsOpen(false)}
              aria-label="Chiudi strumenti allenamento"
            >
              <X size={20} />
            </button>
          </header>

          <div className="wt-content">
            <div className="wt-grid">
              <PlateCalculator />
              <SetCounter />
              <ClockTools />
              <TrainingCalculator />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

WorkoutTools.propTypes = {
  showLauncher: PropTypes.bool,
};

export default WorkoutTools;