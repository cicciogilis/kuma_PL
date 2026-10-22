import { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  aggregateSessionMetrics,
  aggregateWeeklyMetrics,
  detectProgramPhases,
  PHASE_DEFINITIONS,
} from './utils/trainingMetrics';
import './ProgramDashboard.css';

const LIFT_OPTIONS = [
  { key: 'squat', label: 'Squat' },
  { key: 'panca', label: 'Panca' },
  { key: 'stacco', label: 'Stacco' },
];

const KG_FORMATTER = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 0,
});
const KG_AXIS_FORMATTER = new Intl.NumberFormat('it-IT', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const DECIMAL_FORMATTER = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 1,
});

const formatDecimal = (value) =>
  value == null ? 'n.d.' : DECIMAL_FORMATTER.format(value);

const formatVolume = (value) =>
  value == null ? 'n.d.' : `${KG_FORMATTER.format(value)} kg`;

const formatIntensity = (value) =>
  value == null ? 'n.d.' : `${DECIMAL_FORMATTER.format(value)}%`;

const formatFrequency = (value) =>
  value == null ? 'n.d.' : `${value} ${value === 1 ? 'seduta' : 'sedute'}`;

const METRICS = [
  {
    key: 'volume',
    label: 'Volume',
    unit: 'kg',
    color: '#ff9f1c',
    softColor: 'rgba(255, 159, 28, 0.14)',
    formatValue: formatVolume,
    formatAxis: (value) => KG_AXIS_FORMATTER.format(value),
    axisWidth: 42,
  },
  {
    key: 'intensity',
    label: 'Intensità',
    unit: '% 1RM',
    color: '#a855f7',
    softColor: 'rgba(168, 85, 247, 0.14)',
    formatValue: formatIntensity,
    formatAxis: (value) => `${DECIMAL_FORMATTER.format(value)}%`,
    axisWidth: 38,
  },
  {
    key: 'frequency',
    label: 'Frequenza',
    unit: 'sedute/sett.',
    color: '#7bd88f',
    softColor: 'rgba(123, 216, 143, 0.14)',
    formatValue: formatFrequency,
    formatAxis: (value) => `${value}`,
    axisWidth: 26,
    allowDecimals: false,
  },
];

const getMedian = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const getYAxisDomain = (values, metricKey) => {
  if (!values.length) {
    return metricKey === 'intensity' ? [0, 100] : [0, 1];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const median = getMedian(values);
  const range = max - min;
  const padding = range > 0
    ? range * 0.1
    : Math.max(Math.abs(median) * 0.05, 1);
  let lower = min - padding;
  let upper = max + padding;

  if (metricKey === 'intensity') {
    lower = Math.max(0, lower);
    upper = Math.min(100, upper);
  } else {
    lower = Math.max(0, lower);
  }

  if (!(upper > lower)) upper = lower + 1;
  return [lower, upper];
};

const getNiceTicks = ([lower, upper], metricKey) => {
  const range = upper - lower;
  if (!(range > 0)) return [lower];

  const rawStep = range / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  let factor = 10;

  if (residual <= 1) factor = 1;
  else if (residual <= 2) factor = 2;
  else if (residual <= 2.5) factor = 2.5;
  else if (residual <= 5) factor = 5;

  let step = factor * magnitude;
  if (metricKey === 'frequency') step = Math.max(1, step);

  const first = Math.ceil((lower - step * 1e-9) / step) * step;
  const ticks = [];

  for (let tick = first; tick <= upper + step * 1e-9; tick += step) {
    ticks.push(Number(tick.toFixed(6)));
  }

  return ticks.length ? ticks : [Number(lower.toFixed(6))];
};

const DashboardTooltip = ({ active, payload, activeMetricKeys }) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const shows = (key) => activeMetricKeys.includes(key);
  const frequencyValue = row.weeklyFrequency ?? row.frequency;
  const completedValue = row.weeklyCompleted ?? row.completed;

  return (
    <div className="program-dashboard-tooltip">
      <div className="program-dashboard-tooltip-title">
        <span>
          {row.weekTitle}
          {row.sessionLabel ? ` · ${row.sessionLabel}` : ''}
        </span>
        <span>{row.sessionDateLabel || row.weekStartLabel || '—'}</span>
      </div>
      {shows('volume') && (
        <div className="program-dashboard-tooltip-row">
          <span className="program-dashboard-tooltip-label">
            <span
              className="program-dashboard-tooltip-dot"
              style={{ backgroundColor: '#ff9f1c' }}
              aria-hidden="true"
            />
            Volume
          </span>
          <span className="program-dashboard-tooltip-value">{formatVolume(row.volume)}</span>
        </div>
      )}
      {shows('intensity') && (
        <div className="program-dashboard-tooltip-row">
          <span className="program-dashboard-tooltip-label">
            <span
              className="program-dashboard-tooltip-dot"
              style={{ backgroundColor: '#a855f7' }}
              aria-hidden="true"
            />
            Intensità
          </span>
          <span className="program-dashboard-tooltip-value">{formatIntensity(row.intensity)}</span>
        </div>
      )}
      {shows('frequency') && (
        <div className="program-dashboard-tooltip-row">
          <span className="program-dashboard-tooltip-label">
            <span
              className="program-dashboard-tooltip-dot"
              style={{ backgroundColor: '#7bd88f' }}
              aria-hidden="true"
            />
            Frequenza
          </span>
          <span className="program-dashboard-tooltip-value">
            {frequencyValue} {frequencyValue === 1 ? 'seduta' : 'sedute'} · {completedValue}{' '}
            {completedValue === 1 ? 'completata' : 'completate'}
          </span>
        </div>
      )}
      <div className="program-dashboard-tooltip-row">
        <span className="program-dashboard-tooltip-label">RPE medio</span>
        <span className="program-dashboard-tooltip-value">{formatDecimal(row.rpe)}</span>
      </div>
      <div className="program-dashboard-tooltip-row">
        <span className="program-dashboard-tooltip-label">Serie / Rep</span>
        <span className="program-dashboard-tooltip-value">
          {row.sets} / {row.reps}
        </span>
      </div>
      {row.sessionLabel && (
        <div className="program-dashboard-tooltip-row">
          <span className="program-dashboard-tooltip-label">Seduta</span>
          <span className="program-dashboard-tooltip-value">
            {row.sessionCompleted ? 'completata' : 'da completare'}
          </span>
        </div>
      )}
      {row.estimated && (
        <div className="program-dashboard-tooltip-estimate">
          Include stime RPE
        </div>
      )}
    </div>
  );
};

DashboardTooltip.propTypes = {
  active: PropTypes.bool,
  payload: PropTypes.array,
  activeMetricKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const MetricChart = ({ metric, data, phases, liftLabel, activeMetricKeys }) => {
  const values = data
    .map((row) => row[metric.key])
    .filter((value) => value != null && Number.isFinite(value));
  const lastEntry = [...data]
    .reverse()
    .find((row) => row[metric.key] != null && Number.isFinite(row[metric.key]));
  const lastValue = lastEntry?.[metric.key];
  const lastValueWeek = lastEntry?.week;
  const isLastValueEstimated = (
    metric.key === 'volume'
      ? lastEntry?.estimatedVolume
      : metric.key === 'intensity'
        ? lastEntry?.estimatedIntensity
        : false
  );
  const hasValues = values.length > 0;
  const medianValue = getMedian(values);
  const yDomain = getYAxisDomain(values, metric.key);
  const yTicks = getNiceTicks(yDomain, metric.key);
  const weekNumbers = data
    .map((row) => Number(row.week))
    .filter((week) => Number.isFinite(week) && week >= 1);
  const maxWeek = weekNumbers.length ? Math.max(...weekNumbers) : 1;
  const xDomain = [0.5, maxWeek + 0.5];
  const tickStep = maxWeek <= 8 ? 1 : Math.ceil(maxWeek / 8);
  const xTicks = Array.from({ length: maxWeek }, (_, index) => index + 1)
    .filter((week) => (
      week === 1
      || week === maxWeek
      || (week - 1) % tickStep === 0
    ));

  return (
    <div className="program-dashboard-chart">
      <div className="program-dashboard-chart-head">
        <span className="program-dashboard-chart-title" style={{ color: metric.color }}>
          {metric.label}
          <span className="program-dashboard-chart-unit"> ({metric.unit})</span>
        </span>
        <span className="program-dashboard-chart-value">
          {lastValue == null
            ? 'n.d.'
            : `W${lastValueWeek} · ${isLastValueEstimated ? '~' : ''}${metric.formatValue(lastValue)}`}
        </span>
      </div>

      {!hasValues && metric.key !== 'frequency' ? (
        <div className="program-dashboard-chart-empty">
          n.d. per questa alzata
        </div>
      ) : (
        <div
          className="program-dashboard-chart-canvas"
          role="img"
          aria-label={`Grafico ${metric.label} per ${liftLabel}${medianValue == null ? '' : ', linea mediana tratteggiata'}`}
        >
          <ResponsiveContainer width="100%" height={108}>
            <LineChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
              {phases.map((phase) => (
                <ReferenceArea
                  key={`${phase.key}-${phase.from}-${phase.to}`}
                  x1={phase.from - 0.5}
                  x2={phase.to + 0.5}
                  fill={phase.color}
                  fillOpacity={0.1}
                  stroke="none"
                />
              ))}
              <XAxis
                dataKey="x"
                type="number"
                domain={xDomain}
                ticks={xTicks}
                tickFormatter={(value) => `W${value}`}
                tick={{ fill: '#8a8a8a', fontSize: 9 }}
                tickLine={false}
                axisLine={{ stroke: '#333' }}
                tickMargin={4}
                allowDecimals={false}
              />
              <YAxis
                width={metric.axisWidth}
                domain={yDomain}
                ticks={yTicks}
                allowDecimals={metric.allowDecimals}
                tickFormatter={metric.formatAxis}
                tick={{ fill: '#8a8a8a', fontSize: 9 }}
                tickLine={false}
                axisLine={false}
              />
              {medianValue != null && (
                <ReferenceLine
                  y={medianValue}
                  stroke="#666"
                  strokeDasharray="3 4"
                  strokeWidth={1}
                  label={{
                    value: 'mediana',
                    position: 'insideTopRight',
                    fill: '#8a8a8a',
                    fontSize: 8,
                  }}
                />
              )}
              <Tooltip
                content={<DashboardTooltip activeMetricKeys={activeMetricKeys} />}
                cursor={{ stroke: '#555', strokeDasharray: '3 3' }}
              />
              <Line
                type={metric.key === 'frequency' ? 'stepAfter' : 'monotone'}
                dataKey={metric.key}
                stroke={metric.color}
                strokeWidth={2}
                dot={{ r: 2, fill: metric.color, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: metric.color, strokeWidth: 0 }}
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

MetricChart.propTypes = {
  metric: PropTypes.object.isRequired,
  data: PropTypes.array.isRequired,
  phases: PropTypes.array.isRequired,
  liftLabel: PropTypes.string.isRequired,
  activeMetricKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
};

const formatPhaseRange = (range) =>
  `W${range.from}${range.to !== range.from ? `–W${range.to}` : ''}`;

const PhaseLegend = ({ phases }) => {
  const groupedPhases = PHASE_DEFINITIONS
    .map((definition) => {
      const ranges = phases.filter((phase) => phase.key === definition.key);
      return ranges.length ? { ...definition, ranges } : null;
    })
    .filter(Boolean);

  return (
    <div
      className="program-dashboard-phase-legend"
      role="group"
      aria-label="Fasi del mesociclo rilevate automaticamente"
    >
      {groupedPhases.length ? (
        groupedPhases.map((phase) => (
          <span className="program-dashboard-phase-item" key={phase.key}>
            <span
              className="program-dashboard-phase-dot"
              style={{ backgroundColor: phase.color }}
              aria-hidden="true"
            />
            {phase.label} · {phase.ranges.map(formatPhaseRange).join(', ')}
          </span>
        ))
      ) : (
        <span className="program-dashboard-phase-empty">
          Fasi non rilevabili con i dati attuali
        </span>
      )}
    </div>
  );
};

PhaseLegend.propTypes = {
  phases: PropTypes.array.isRequired,
};

const ProgramDashboard = ({
  program,
  prMaxes,
  completions = {},
}) => {
  const [selectedLift, setSelectedLift] = useState('squat');
  const [pointMode, setPointMode] = useState('session');
  const [activeMetrics, setActiveMetrics] = useState({
    volume: true,
    intensity: true,
    frequency: true,
  });

  const weeklyData = useMemo(
    () => aggregateWeeklyMetrics({
      program,
      prMaxes,
      completions,
      liftKey: selectedLift,
    }),
    [program, prMaxes, completions, selectedLift]
  );
  const sessionData = useMemo(
    () => (
      pointMode === 'session'
        ? aggregateSessionMetrics({
          program,
          prMaxes,
          completions,
          liftKey: selectedLift,
        })
        : []
    ),
    [pointMode, program, prMaxes, completions, selectedLift]
  );
  const autoPhases = useMemo(
    () => detectProgramPhases(weeklyData),
    [weeklyData]
  );

  const liftLabel = LIFT_OPTIONS.find((lift) => lift.key === selectedLift)?.label || 'Squat';
  const visibleMetrics = METRICS.filter((metric) => activeMetrics[metric.key]);
  const hasExposure = weeklyData.some((row) => row.sessions > 0);

  const toggleMetric = (key) => {
    setActiveMetrics((previous) => ({ ...previous, [key]: !previous[key] }));
  };

  return (
    <section className="program-dashboard" aria-label={`Grafici allenamento ${liftLabel}`}>
      <div className="program-dashboard-head">
        <div className="program-dashboard-top-row">
          <div className="program-dashboard-lifts" role="group" aria-label="Seleziona alzata">
            {LIFT_OPTIONS.map((lift) => (
              <button
                type="button"
                className={`program-dashboard-lift${selectedLift === lift.key ? ' active' : ''}`}
                key={lift.key}
                aria-pressed={selectedLift === lift.key}
                onClick={() => setSelectedLift(lift.key)}
              >
                {lift.label}
              </button>
            ))}
          </div>

          <div className="program-dashboard-point-mode">
            <div
              className="program-dashboard-point-toggle"
              role="group"
              aria-label="Dettaglio punti del grafico"
            >
              <button
                type="button"
                className={`program-dashboard-point-option${pointMode === 'week' ? ' active' : ''}`}
                aria-pressed={pointMode === 'week'}
                title="Un punto per settimana"
                onClick={() => setPointMode('week')}
              >
                Singolo
              </button>
              <button
                type="button"
                className={`program-dashboard-point-option${pointMode === 'session' ? ' active' : ''}`}
                aria-pressed={pointMode === 'session'}
                title="Un punto per seduta"
                onClick={() => setPointMode('session')}
              >
                Più punti
              </button>
            </div>
          </div>
        </div>

        <div className="program-dashboard-controls" role="group" aria-label="Variabili da mostrare">
          <span className="program-dashboard-controls-label">Variabili</span>
          {METRICS.map((metric) => (
            <button
              type="button"
              className={`program-dashboard-toggle${activeMetrics[metric.key] ? ' active' : ''}`}
              key={metric.key}
              aria-pressed={activeMetrics[metric.key]}
              style={{
                '--metric-color': metric.color,
                '--metric-soft': metric.softColor,
              }}
              onClick={() => toggleMetric(metric.key)}
            >
              <span className="program-dashboard-toggle-dot" aria-hidden="true" />
              {metric.label}
            </button>
          ))}
        </div>
      </div>

      {!hasExposure && (
        <p className="program-dashboard-empty">
          Nessuna seduta pianificata per questa alzata.
        </p>
      )}

      {visibleMetrics.length ? (
        <div className="program-dashboard-charts">
          {visibleMetrics.map((metric) => (
            <MetricChart
              key={metric.key}
              metric={metric}
              data={
                metric.key === 'frequency' || pointMode === 'week'
                  ? weeklyData
                  : sessionData
              }
              phases={autoPhases}
              liftLabel={liftLabel}
              activeMetricKeys={visibleMetrics.map((item) => item.key)}
            />
          ))}
        </div>
      ) : (
        <div className="program-dashboard-empty">Attiva almeno una variabile.</div>
      )}

      <PhaseLegend phases={autoPhases} />
    </section>
  );
};

ProgramDashboard.propTypes = {
  program: PropTypes.object.isRequired,
  prMaxes: PropTypes.object,
  completions: PropTypes.object,
};

export default ProgramDashboard;
