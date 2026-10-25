import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  aggregateSessionMetrics,
  aggregateWeeklyMetrics,
} from './utils/trainingMetrics';
import { formatDateIt, parseLocalDate } from './utils/programData';
import './TeamCharts.css';

const LIFT_OPTIONS = [
  { key: 'squat', label: 'Squat' },
  { key: 'panca', label: 'Panca' },
  { key: 'stacco', label: 'Stacco' },
];

const METRICS = [
  { key: 'volume', label: 'Volume', unit: 'kg', color: '#ff9f1c' },
  { key: 'intensity', label: 'Intensità', unit: '% 1RM', color: '#a855f7' },
  { key: 'frequency', label: 'Frequenza', unit: 'sedute', color: '#7bd88f' },
];

const ChartsTooltip = ({ active, payload, activeMetrics }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const shows = (key) => activeMetrics.includes(key);
  return (
    <div className="team-chart-tooltip">
      <div className="team-chart-tooltip-title">
        <span>{row.label}</span>
        <span>{row.completed}/{row.frequency} completate</span>
      </div>
      {shows('volume') && (
        <div className="team-chart-tooltip-row">
          <span>Volume</span>
          <span>{row.volume == null ? 'n.d.' : `${Math.round(row.volume)} kg`}</span>
        </div>
      )}
      {shows('intensity') && (
        <div className="team-chart-tooltip-row">
          <span>Intensità</span>
          <span>{row.intensity == null ? 'n.d.' : `${row.intensity}%`}</span>
        </div>
      )}
      {shows('frequency') && (
        <div className="team-chart-tooltip-row">
          <span>Frequenza</span>
          <span>{row.frequency} sedute</span>
        </div>
      )}
      {row.programs.length > 0 && (
        <div className="team-chart-tooltip-programs">{row.programs.join(', ')}</div>
      )}
    </div>
  );
};

ChartsTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  activeMetrics: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const buildBuckets = ({ programs, prMaxes, completions, liftKey, mode }) => {
  const buckets = new Map();

  programs.forEach((program) => {
    const rows = mode === 'session'
      ? aggregateSessionMetrics({ program, prMaxes, completions, liftKey })
      : aggregateWeeklyMetrics({ program, prMaxes, completions, liftKey });

    rows.forEach((row) => {
      const iso = mode === 'session' ? row.sessionDateIso : row.weekStartIso;
      const date = parseLocalDate(iso);
      if (!date) return;
      const bucket = buckets.get(iso) || {
        iso,
        ts: date.getTime(),
        label: formatDateIt(iso),
        volume: 0,
        hasVolume: false,
        intensityWeighted: 0,
        intensityReps: 0,
        frequency: 0,
        completed: 0,
        programs: new Set(),
      };

      if (Number.isFinite(row.volume)) {
        bucket.volume += row.volume;
        bucket.hasVolume = true;
      }
      if (Number.isFinite(row.intensity) && Number(row.reps) > 0) {
        bucket.intensityWeighted += row.intensity * row.reps;
        bucket.intensityReps += row.reps;
      }
      if (mode === 'session') {
        bucket.frequency += 1;
        bucket.completed += row.sessionCompleted ? 1 : 0;
      } else {
        bucket.frequency += row.frequency || 0;
        bucket.completed += row.completed || 0;
      }
      bucket.programs.add(program.name);
      buckets.set(iso, bucket);
    });
  });

  return [...buckets.values()]
    .sort((a, b) => a.ts - b.ts)
    .map((bucket) => ({
      ...bucket,
      volume: bucket.hasVolume ? Math.round(bucket.volume) : null,
      intensity: bucket.intensityReps
        ? Math.round((bucket.intensityWeighted / bucket.intensityReps) * 10) / 10
        : null,
      programs: [...bucket.programs],
    }));
};

const LineChartBlock = ({ metric, data, activeMetrics }) => {
  const values = data.map((row) => row[metric.key]).filter((value) => value != null);
  const hasValues = values.length > 0;
  const max = hasValues ? Math.max(...values) : 0;
  const min = hasValues ? Math.min(...values) : 0;
  const domain = metric.key === 'intensity'
    ? [Math.max(0, Math.floor(min - 5)), Math.min(100, Math.ceil(max + 5))]
    : [0, Math.ceil((max || 1) * 1.1)];

  return (
    <div className="team-chart">
      <div className="team-chart-head">
        <span className="team-chart-title" style={{ color: metric.color }}>
          {metric.label} <span className="team-chart-unit">({metric.unit})</span>
        </span>
      </div>
      {!hasValues ? (
        <div className="team-chart-empty">n.d. per questa alzata</div>
      ) : (
        <div className="team-chart-canvas">
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={data} margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#8a8a8a', fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: '#333' }}
                tickMargin={4}
              />
              <YAxis
                width={metric.key === 'frequency' ? 26 : 44}
                domain={domain}
                allowDecimals={false}
                tick={{ fill: '#8a8a8a', fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<ChartsTooltip activeMetrics={activeMetrics} />} cursor={{ stroke: '#555', strokeDasharray: '3 3' }} />
              <Line
                type="monotone"
                dataKey={metric.key}
                stroke={metric.color}
                strokeWidth={2}
                dot={{ r: 2, fill: metric.color, strokeWidth: 0 }}
                connectNulls={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

LineChartBlock.propTypes = {
  metric: PropTypes.object.isRequired,
  data: PropTypes.array.isRequired,
  activeMetrics: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const TeamCharts = ({ programs, prMaxes, completions }) => {
  // Teniamo traccia solo delle schede che l'utente ha nascosto: così cambiando
  // atleta le sue programmazioni risultano tutte attive di default.
  const [hiddenIds, setHiddenIds] = useState([]);
  const [liftKey, setLiftKey] = useState('squat');
  const [mode, setMode] = useState('week');
  const [activeMetrics, setActiveMetrics] = useState({
    volume: true,
    intensity: true,
    frequency: true,
  });

  const selectedPrograms = useMemo(
    () => programs.filter((program) => !hiddenIds.includes(program.id)),
    [programs, hiddenIds]
  );
  const data = useMemo(
    () => buildBuckets({ programs: selectedPrograms, prMaxes, completions, liftKey, mode }),
    [selectedPrograms, prMaxes, completions, liftKey, mode]
  );

  const toggleProgram = (id) => {
    setHiddenIds((previous) => (
      previous.includes(id) ? previous.filter((value) => value !== id) : [...previous, id]
    ));
  };
  const toggleMetric = (key) => setActiveMetrics((previous) => ({ ...previous, [key]: !previous[key] }));
  const visibleMetrics = METRICS.filter((metric) => activeMetrics[metric.key]);

  return (
    <div className="team-charts">
      <div className="team-charts-controls">
        <div className="team-charts-lifts" role="group" aria-label="Seleziona alzata">
          {LIFT_OPTIONS.map((lift) => (
            <button
              type="button"
              key={lift.key}
              className={`team-chart-chip lift ${liftKey === lift.key ? ' active' : ''}`}
              onClick={() => setLiftKey(lift.key)}
            >
              {lift.label}
            </button>
          ))}
        </div>
        <div className="team-charts-mode" role="group" aria-label="Dettaglio punti">
          <button
            type="button"
            className={`team-chart-chip mode ${mode === 'week' ? ' active' : ''}`}
            onClick={() => setMode('week')}
          >
            Singolo
          </button>
          <button
            type="button"
            className={`team-chart-chip mode ${mode === 'session' ? ' active' : ''}`}
            onClick={() => setMode('session')}
          >
            Più punti
          </button>
        </div>
      </div>

      <div className="team-charts-metrics" role="group" aria-label="Variabili">
        {METRICS.map((metric) => (
          <button
            type="button"
            key={metric.key}
            className={`team-chart-chip metric ${activeMetrics[metric.key] ? ' active' : ''}`}
            style={{ '--chip-color': metric.color }}
            onClick={() => toggleMetric(metric.key)}
          >
            <span className="team-chart-chip-dot" style={{ backgroundColor: metric.color }} />
            {metric.label}
          </button>
        ))}
      </div>

      <div className="team-charts-programs">
        {programs.map((program) => (
          <label className="team-charts-program" key={program.id}>
            <input
              type="checkbox"
              checked={!hiddenIds.includes(program.id)}
              onChange={() => toggleProgram(program.id)}
            />
            <span>{program.name}</span>
          </label>
        ))}
      </div>

      {selectedPrograms.length === 0 ? (
        <p className="team-empty-line">Seleziona almeno una programmazione.</p>
      ) : visibleMetrics.length === 0 ? (
        <p className="team-empty-line">Attiva almeno una variabile.</p>
      ) : (
        <div className="team-charts-list">
          {visibleMetrics.map((metric) => (
            <LineChartBlock
              key={metric.key}
              metric={metric}
              data={data}
              activeMetrics={visibleMetrics.map((item) => item.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

TeamCharts.propTypes = {
  programs: PropTypes.array.isRequired,
  prMaxes: PropTypes.object,
  completions: PropTypes.object,
};

export default TeamCharts;
