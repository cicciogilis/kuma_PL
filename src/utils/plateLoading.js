export const BAR_WEIGHT = 20;

export const COMPETITION_PLATES = [
  {
    weight: 25,
    label: '25',
    color: '#ef4444',
    textColor: '#fff',
    height: 100,
    width: 22,
  },
  {
    weight: 20,
    label: '20',
    color: '#3b82f6',
    textColor: '#fff',
    height: 92,
    width: 21,
  },
  {
    weight: 15,
    label: '15',
    color: '#facc15',
    textColor: '#1f1f1f',
    height: 84,
    width: 20,
  },
  {
    weight: 10,
    label: '10',
    color: '#22c55e',
    textColor: '#fff',
    height: 76,
    width: 18,
  },
  {
    weight: 5,
    label: '5',
    color: '#f8fafc',
    textColor: '#1f1f1f',
    height: 66,
    width: 17,
  },
  {
    weight: 2.5,
    label: '2,5',
    color: '#fb7185',
    textColor: '#fff',
    height: 58,
    width: 16,
  },
  {
    weight: 1.25,
    label: '1,25',
    color: '#94a3b8',
    textColor: '#111',
    height: 50,
    width: 16,
  },
];

const roundToHundredths = (value) => Math.round(value * 100) / 100;

const parseWeight = (value) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
};

export const calculatePlateLoad = (
  totalWeight,
  {
    barWeight = BAR_WEIGHT,
    plates = COMPETITION_PLATES,
  } = {}
) => {
  const total = parseWeight(totalWeight);

  if (total == null || total <= 0) {
    return {
      error: 'Inserisci un carico valido.',
      plates: [],
      perSide: 0,
      loadedPerSide: 0,
      remainderPerSide: 0,
      remainderTotal: 0,
      loadedTotal: barWeight,
      exact: false,
      barWeight,
    };
  }

  if (total < barWeight) {
    return {
      error: `Il carico minimo è ${barWeight} kg.`,
      plates: [],
      perSide: 0,
      loadedPerSide: 0,
      remainderPerSide: 0,
      remainderTotal: 0,
      loadedTotal: barWeight,
      exact: false,
      barWeight,
    };
  }

  const perSide = roundToHundredths((total - barWeight) / 2);
  let remaining = perSide;
  const loadedPlates = [];

  [...plates]
    .sort((left, right) => right.weight - left.weight)
    .forEach((plate) => {
      while (remaining + 0.001 >= plate.weight) {
        loadedPlates.push(plate);
        remaining = roundToHundredths(remaining - plate.weight);
      }
    });

  const loadedPerSide = roundToHundredths(perSide - remaining);

  return {
    error: '',
    plates: loadedPlates,
    perSide,
    loadedPerSide,
    remainderPerSide: remaining,
    remainderTotal: roundToHundredths(remaining * 2),
    loadedTotal: roundToHundredths(barWeight + loadedPerSide * 2),
    exact: remaining < 0.01,
    barWeight,
  };
};
