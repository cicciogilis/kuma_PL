const NUMBER_FORMATTER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 });
const RAW_WEIGHT_FORMATTER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 4 });
const SUGGESTED_WEIGHT_FORMATTER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

export const formatNumber = (value) => NUMBER_FORMATTER.format(value);
export const formatRawWeight = (value) => RAW_WEIGHT_FORMATTER.format(value);
export const formatSuggestedWeight = (value) => SUGGESTED_WEIGHT_FORMATTER.format(value);

export const noteKeyFor = (week, session, liftIndex) =>
  `${week.week}-${session.day}-${liftIndex}`;

export const getPrForLift = (lift, prMaxes) => {
  const key = lift.key === 'panca' ? 'bench' : lift.key === 'squat' ? 'squat' : 'deadlift';
  const value = Number(prMaxes?.[key]);
  return Number.isFinite(value) && value > 0 ? value : null;
};

export const getMaxForLift = (program, lift, prMaxes) => {
  if (program.usePrMax) return getPrForLift(lift, prMaxes);

  const maxes = program.maxes || {};
  if (lift.key === 'panca') return maxes.panca > 0 ? maxes.panca : null;
  if (lift.key === 'squat') return maxes.squat > 0 ? maxes.squat : null;

  if (lift.variant === 'classico') {
    return maxes.staccoClassico > 0 ? maxes.staccoClassico : maxes.staccoSumo || null;
  }
  return maxes.staccoSumo > 0 ? maxes.staccoSumo : maxes.staccoClassico || null;
};

const LIFT_DISPLAY_ORDER = { squat: 0, panca: 1, stacco: 2 };
const PROPOSAL_STEP = 1.25;

export const compareLifts = (a, b) =>
  (LIFT_DISPLAY_ORDER[a.key] ?? 99) - (LIFT_DISPLAY_ORDER[b.key] ?? 99);

export const getSuggestedWeight = (rawWeight) => {
  if (rawWeight == null) return null;

  return Math.ceil((rawWeight - 1e-6) / PROPOSAL_STEP) * PROPOSAL_STEP;
};

export const formatRpeReference = (base) => {
  if (!base) return '';

  const reps = base.sets && base.sets > 1
    ? `${base.sets}×${base.reps}`
    : base.reps != null ? `${base.reps}` : '';
  const rpe = base.rpe != null ? `@${formatNumber(base.rpe)}` : '';

  return [reps, rpe].filter(Boolean).join(' ');
};

export const formatBlock = (block) => {
  const parts = [];
  if (block.sets && block.reps) {
    if (block.sets === 1 && block.rpe != null) {
      parts.push(block.reps === 1 ? '1 ripetizione' : `${block.reps} ripetizioni`);
    } else {
      parts.push(`${block.sets}×${block.reps}`);
    }
  } else if (block.reps) {
    parts.push(block.reps === 1 ? '1 ripetizione' : `${block.reps} ripetizioni`);
  }

  if (block.percent != null) parts.push(`${formatNumber(block.percent)}%`);
  if (block.rpe != null) parts.push(`RPE ${formatNumber(block.rpe)}`);

  return parts.join(' @ ');
};
