// Categorie di peso e di età condivise tra Leaderboard e dashboard Team.

export const MEN_WEIGHT_CLASSES = [53, 59, 66, 74, 83, 93, 105, 120, Infinity];
export const WOMEN_WEIGHT_CLASSES = [43, 47, 52, 57, 63, 69, 76, 84, Infinity];

export const MEN_WEIGHT_LABELS = ['53kg', '59kg', '66kg', '74kg', '83kg', '93kg', '105kg', '120kg', '+120kg'];
export const WOMEN_WEIGHT_LABELS = ['43kg', '47kg', '52kg', '57kg', '63kg', '69kg', '76kg', '84kg', '+84kg'];

export const AGE_ORDER = [
  'Sub-Junior',
  'Junior',
  'Open/Senior',
  'Master I',
  'Master II',
  'Master III',
  'Master IV',
];

export const MEN_WEIGHT_ORDER = MEN_WEIGHT_LABELS;
export const WOMEN_WEIGHT_ORDER = WOMEN_WEIGHT_LABELS;

export const getWeightClass = (bw, gender) => {
  if (!bw || (gender !== 'M' && gender !== 'F')) return null;
  const weight = parseFloat(bw);
  if (Number.isNaN(weight)) return null;
  const classes = gender === 'M' ? MEN_WEIGHT_CLASSES : WOMEN_WEIGHT_CLASSES;
  const labels = gender === 'M' ? MEN_WEIGHT_LABELS : WOMEN_WEIGHT_LABELS;
  for (let i = 0; i < classes.length; i += 1) {
    if (weight <= classes[i]) return labels[i];
  }
  return labels[labels.length - 1];
};

export const getAgeClass = (birthDate) => {
  if (!birthDate) return null;
  try {
    const birth = new Date(birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const month = today.getMonth() - birth.getMonth();
    if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
    if (age >= 14 && age <= 18) return 'Sub-Junior';
    if (age >= 19 && age <= 23) return 'Junior';
    if (age >= 24 && age <= 39) return 'Open/Senior';
    if (age >= 40 && age <= 49) return 'Master I';
    if (age >= 50 && age <= 59) return 'Master II';
    if (age >= 60 && age <= 69) return 'Master III';
    if (age >= 70) return 'Master IV';
    return null;
  } catch {
    return null;
  }
};

export const getAge = (birthDate) => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
};

// Dashboard allenatore: Open e Senior sono separati.
// - Open: categoria assoluta, tutti gli atleti dai 14 anni in su (non esclusiva).
// - Senior: fascia anagrafica 24-39 anni.
export const COACH_AGE_FILTERS = [
  'Sub-Junior',
  'Junior',
  'Open',
  'Senior',
  'Master I',
  'Master II',
  'Master III',
  'Master IV',
];

export const matchesCoachAgeFilter = (birthDate, filterKey) => {
  const age = getAge(birthDate);
  if (age == null) return false;
  if (filterKey === 'Open') return age >= 14;
  if (filterKey === 'Senior') return age >= 24 && age <= 39;
  return getAgeClass(birthDate) === filterKey;
};

export const getCoachAgeLabel = (birthDate) => {
  const age = getAge(birthDate);
  if (age == null) return null;
  if (age >= 24 && age <= 39) return 'Senior';
  return getAgeClass(birthDate);
};

export const isOpenCategory = (birthDate) => {
  const age = getAge(birthDate);
  return age != null && age >= 14;
};
