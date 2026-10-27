// Filtri per data di scadenza scheda nella dashboard allenatore.
// Le fasce sono disgiunte: ogni scheda compare in un solo filtro.
export const RANGE_FILTERS = [
  { key: 'all', label: 'Tutte' },
  { key: 'w1', label: 'Tra 1 settimana' },
  { key: 'w2', label: 'Tra 2 settimane' },
  { key: 'w3', label: 'Tra 3 settimane' },
  { key: 'expired', label: 'Scadute' },
  { key: 'expired1', label: 'Scadute da 1 settimana' },
  { key: 'expired2', label: 'Scadute da 2 settimane' },
];

// `days` = giorni che mancano alla fine della scheda (negativi se già scaduta).
export const matchesRange = (days, range) => {
  if (days == null) return false;

  switch (range) {
    case 'w1': return days >= 0 && days <= 7;
    case 'w2': return days >= 8 && days <= 14;
    case 'w3': return days >= 15 && days <= 21;
    case 'expired': return days < 0;
    case 'expired1': return days <= -1 && days >= -7;
    case 'expired2': return days <= -8 && days >= -14;
    default: return true;
  }
};
