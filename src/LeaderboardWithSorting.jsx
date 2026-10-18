import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Trophy, User } from 'lucide-react';
import './Leaderboard.css';

const LeaderboardWithSorting = ({ data }) => {
  const [sortBy, setSortBy] = useState('totalDesc');
  const [expandedRows, setExpandedRows] = useState({});
  const [filters, setFilters] = useState({
    absolute: true,
    weightCategory: false,
    sex: false,
    age: false,
    openIncludeJunior: false
  });

  const SPECIALTY_LIFTS = {
    dips: { label: 'Dips', key: 'dips', field: 'otherPRValues', index: 0, activeField: 'otherPRActive', activeIndex: 0 },
    chinup: { label: 'Chin Up', key: 'chinup', field: 'otherPRValues', index: 1, activeField: 'otherPRActive', activeIndex: 1 },
    military: { label: 'Military Press', key: 'military', field: 'otherPRValues', index: 2, activeField: 'otherPRActive', activeIndex: 2 },
    trazioni: { label: 'Trazioni', key: 'trazioni', field: 'otherPRValues', index: 3, activeField: 'otherPRActive', activeIndex: 3 }
  };

  const MAIN_LIFTS = {
    totalDesc: { label: 'PL Total', field: 'total' },
    sDesc: { label: 'Squat', field: 's' },
    bDesc: { label: 'Bench Press', field: 'b' },
    dDesc: { label: 'Deadlift', field: 'd' },
    ratioDesc: { label: 'Rapporto Peso/Potenza', field: 'ratio' },
    ipfDesc: { label: 'IPF Points', field: 'ipf' }
  };

  const MEN_WEIGHT_CLASSES = [53, 59, 66, 74, 83, 93, 105, 120, Infinity];
  const WOMEN_WEIGHT_CLASSES = [43, 47, 52, 57, 63, 69, 76, 84, Infinity];

  const isSpecialty = (sortKey) => SPECIALTY_LIFTS[sortKey] !== undefined;

  const getSpecialtyValue = (item, sortKey) => {
    const spec = SPECIALTY_LIFTS[sortKey];
    if (!spec) return '—';
    const active = item[spec.activeField]?.[spec.activeIndex];
    const value = item[spec.field]?.[spec.index];
    if (!active || !value || value === '') return '—';
    return `${value} kg`;
  };

  const hasSpecialtyRecord = (item, sortKey) => {
    const spec = SPECIALTY_LIFTS[sortKey];
    if (!spec) return false;
    const active = item[spec.activeField]?.[spec.activeIndex];
    const value = item[spec.field]?.[spec.index];
    return active && value && value !== '' && parseFloat(value) > 0;
  };

  const getWeightClass = (bw, gender) => {
    if (!bw || !gender) return null;
    const weight = parseFloat(bw);
    if (isNaN(weight)) return null;
    const classes = gender === 'M' ? MEN_WEIGHT_CLASSES : WOMEN_WEIGHT_CLASSES;
    const labels = gender === 'M' 
      ? ['53kg', '59kg', '66kg', '74kg', '83kg', '93kg', '105kg', '120kg', '+120kg']
      : ['43kg', '47kg', '52kg', '57kg', '63kg', '69kg', '76kg', '84kg', '+84kg'];
    for (let i = 0; i < classes.length; i++) {
      if (weight <= classes[i]) return labels[i];
    }
    return labels[labels.length - 1];
  };

  const getAgeClass = (birthDate) => {
    if (!birthDate) return null;
    try {
      const birth = new Date(birthDate);
      if (isNaN(birth.getTime())) return null;
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const m = today.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
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

  const getSortValue = (item, sortKey) => {
    if (isSpecialty(sortKey)) {
      return getSpecialtyValue(item, sortKey);
    }
    switch (sortKey) {
      case 'totalDesc':
        return `${item.total} kg`;
      case 'sDesc':
        return `${item.s} kg`;
      case 'bDesc':
        return `${item.b} kg`;
      case 'dDesc':
        return `${item.d} kg`;
      case 'ratioDesc':
        return item.bw ? (parseFloat(item.total) / parseFloat(item.bw)).toFixed(2) : '—';
      case 'ipfDesc':
        return item.bw && item.gender ? calculateIPFPoints(parseFloat(item.total), parseFloat(item.bw), item.gender).toFixed(2) : '—';
      default:
        return `${item.total} kg`;
    }
  };

  const getSortLabel = (sortKey) => {
    switch (sortKey) {
      case 'totalDesc':
        return 'Total';
      case 'sDesc':
        return 'Squat';
      case 'bDesc':
        return 'Bench Press';
      case 'dDesc':
        return 'Deadlift';
      case 'ratioDesc':
        return 'Rapporto';
      case 'ipfDesc':
        return 'IPF';
      case 'bwDesc':
        return 'Peso';
      default:
        return 'Total';
    }
  };

const calculateIPFPoints = (total, bw, gender) => {
  if (!gender || (gender !== 'M' && gender !== 'F') || !total || !bw) {
    return 0;
  }

  let A, B, C;

  if (gender === 'M') {
    A = 1199.72839;
    B = 1025.18162;
    C = 0.00921;
  } else {
    A = 610.32796;
    B = 1045.59282;
    C = 0.03048;
  }

  const coefficient = 100 / (A - B * Math.exp(-C * bw));
  const points = coefficient * total;

  return points > 0 ? points : 0;
};

const safeParse = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const hasInvalidData = (item, sortKey) => {
    if (isSpecialty(sortKey)) {
      return !hasSpecialtyRecord(item, sortKey);
    }
    switch (sortKey) {
      case 'sDesc':
        return !item.s || item.s === '' || isNaN(parseFloat(item.s)) || parseFloat(item.s) <= 0;
      case 'bDesc':
        return !item.b || item.b === '' || isNaN(parseFloat(item.b)) || parseFloat(item.b) <= 0;
      case 'dDesc':
        return !item.d || item.d === '' || isNaN(parseFloat(item.d)) || parseFloat(item.d) <= 0;
      case 'totalDesc':
        return !item.total || item.total === '' || isNaN(parseFloat(item.total)) || parseFloat(item.total) <= 0;
      case 'ratioDesc':
        return !item.bw || !item.total || item.bw === '' || item.total === '' || isNaN(parseFloat(item.bw)) || isNaN(parseFloat(item.total)) || parseFloat(item.bw) <= 0 || parseFloat(item.total) <= 0;
      case 'ipfDesc':
        return !item.bw || !item.gender || !item.total || item.bw === '' || item.total === '' || isNaN(parseFloat(item.bw)) || isNaN(parseFloat(item.total)) || parseFloat(item.bw) <= 0 || parseFloat(item.total) <= 0;
      default:
        return false;
    }
  };
  
  const AGE_ORDER = ['Sub-Junior', 'Junior', 'Open/Senior', 'Master I', 'Master II', 'Master III', 'Master IV'];
  const MEN_WEIGHT_ORDER = ['53kg','59kg','66kg','74kg','83kg','93kg','105kg','120kg','+120kg'];
  const WOMEN_WEIGHT_ORDER = ['43kg','47kg','52kg','57kg','63kg','69kg','76kg','84kg','+84kg'];
  
const getGroupKey = (item) => {
    const parts = [];
    
    if (filters.sex) {
      parts.push(item.gender === 'M' ? 'M' : 'F');
    }
    
    if (filters.weightCategory) {
      const wc = getWeightClass(item.bw, item.gender);
      if (!wc) return null;
      parts.push(wc);
    }
    
    if (filters.age) {
      let ageClass = getAgeClass(item.birthDate);
      if (!ageClass) return null;
      
      // Handle "Includi le categorie SubJunior/Junior negli Open"
      if (filters.openIncludeJunior && (ageClass === 'Junior' || ageClass === 'Sub-Junior')) {
        ageClass = 'Open/Senior';
      }
      parts.push(ageClass);
    }
    
    return parts.length > 0 ? parts.join('-') : 'all';
  };
  
  const formatGroupLabel = (key) => {
    if (key === 'all') return '';
    const parts = key.split('-');
    const labels = [];
    
    if (filters.sex) {
      labels.push(parts[0] === 'M' ? '♂ Maschile' : '♀ Femminile');
      parts.shift();
    }
    
    if (filters.weightCategory && parts.length > 0) {
      labels.push(parts[0].replace('kg', ' kg'));
      parts.shift();
    }
    
    if (filters.age && parts.length > 0) {
      labels.push(parts[0]);
    }
    
    return labels.join(' · ');
  };
  
  const getGroupSortKey = (groupKey) => {
    const parts = groupKey.split('-');
    let sortKey = '';
    
    // Sex order: F first, then M
    if (filters.sex) {
      sortKey += parts[0] === 'F' ? '0' : '1';
      parts.shift();
    }
    
    // Weight class order
    if (filters.weightCategory && parts.length > 0) {
      const wc = parts[0];
      const isMale = groupKey.startsWith('M-');
      const order = isMale ? MEN_WEIGHT_ORDER : WOMEN_WEIGHT_ORDER;
      const idx = order.indexOf(wc);
      sortKey += String(Math.max(0, idx)).padStart(2, '0');
      parts.shift();
    }
    
    // Age order
    if (filters.age && parts.length > 0) {
      const ageClass = parts[0];
      const idx = AGE_ORDER.indexOf(ageClass);
      sortKey += String(Math.max(0, idx)).padStart(2, '0');
    }
    
    return sortKey;
  };
  
  const sortedAndGroupedData = useMemo(() => {
    try {
      let filtered = [...data];

      // Track users with invalid data for warning
      const invalidUsers = [];

      // Specialty lifts: only absolute mode, filter by users with that lift
      if (isSpecialty(sortBy)) {
        filtered = filtered.filter(item => {
          const hasRecord = hasSpecialtyRecord(item, sortBy);
          if (!hasRecord) invalidUsers.push(getDisplayName(item));
          return hasRecord;
        });
        const sorted = filtered.sort((a, b) => {
          const spec = SPECIALTY_LIFTS[sortBy];
          const valA = safeParse(a[spec.field]?.[spec.index]);
          const valB = safeParse(b[spec.field]?.[spec.index]);
          return valB - valA;
        });
        if (invalidUsers.length > 0) {
          setTimeout(() => alert(`Utenti esclusi da "${SPECIALTY_LIFTS[sortBy].label}" (dati mancanti):\n${invalidUsers.join(', ')}`), 0);
        }
        return { all: sorted };
      }

      // Filter out users without valid data for the selected sort
      filtered = filtered.filter(item => {
        const valid = !hasInvalidData(item, sortBy);
        if (!valid) invalidUsers.push(getDisplayName(item));
        return valid;
      });

      if (invalidUsers.length > 0) {
        const sortLabel = MAIN_LIFTS[sortBy]?.label || sortBy;
        setTimeout(() => alert(`Utenti esclusi da "${sortLabel}" (dati mancanti o non validi):\n${invalidUsers.join(', ')}`), 0);
      }

      // Absolute mode: no grouping
      if (filters.absolute) {
        const sorted = filtered.sort((a, b) => {
          switch (sortBy) {
            case 'sDesc': return safeParse(b.s) - safeParse(a.s);
            case 'bDesc': return safeParse(b.b) - safeParse(a.b);
            case 'dDesc': return safeParse(b.d) - safeParse(a.d);
            case 'totalDesc': return safeParse(b.total) - safeParse(a.total);
            case 'ratioDesc': return safeParse(b.total) / safeParse(b.bw) - safeParse(a.total) / safeParse(a.bw);
            case 'ipfDesc': return calculateIPFPoints(safeParse(b.total), safeParse(b.bw), b.gender) - calculateIPFPoints(safeParse(a.total), safeParse(a.bw), a.gender);
            default: return safeParse(b.total) - safeParse(a.total);
          }
        });
        return { all: sorted };
      }

      // Group by combination of active filters
      const grouped = {};
      filtered.forEach(item => {
        const key = getGroupKey(item);
        if (!key) return;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });

      // Sort within each group
      Object.values(grouped).forEach(group => {
        group.sort((a, b) => {
          switch (sortBy) {
            case 'sDesc': return safeParse(b.s) - safeParse(a.s);
            case 'bDesc': return safeParse(b.b) - safeParse(a.b);
            case 'dDesc': return safeParse(b.d) - safeParse(a.d);
            case 'totalDesc': return safeParse(b.total) - safeParse(a.total);
            case 'ratioDesc': return safeParse(b.total) / safeParse(b.bw) - safeParse(a.total) / safeParse(a.bw);
            case 'ipfDesc': return calculateIPFPoints(safeParse(b.total), safeParse(b.bw), b.gender) - calculateIPFPoints(safeParse(a.total), safeParse(a.bw), a.gender);
            default: return safeParse(b.total) - safeParse(a.total);
          }
        });
      });

      // Sort groups by composite key
      return Object.fromEntries(
        Object.entries(grouped).sort(([a], [b]) => {
          return getGroupSortKey(a).localeCompare(getGroupSortKey(b));
        })
      );
    } catch (e) {
      console.error('Leaderboard sorting error:', e);
      // Fallback: absolute mode
      const sorted = [...data].sort((a, b) => safeParse(b.total) - safeParse(a.total));
      return { all: sorted };
    }
  }, [data, sortBy, filters]);

  const toggleRow = (username) => {
    setExpandedRows(prev => ({ ...prev, [username]: !prev[username] }));
  };

  const getDisplayName = (item) => {
    return item.showUsernameOnLeaderboard ? item.username : (item.firstName && item.lastName ? `${item.firstName} ${item.lastName}` : item.username);
  };

  return (
    <div className="leaderboard-container">
      <div className="leaderboard-header">
        <div className="leaderboard-title-row">
          <Trophy size={24} className="leaderboard-icon" />
          <h2 className="section-title leaderboard-title">Leader Board</h2>
          <Trophy size={24} className="leaderboard-icon leaderboard-icon-mirrored" />
        </div>
        <p className="leaderboard-subtitle">Confrontati con gli altri della squadra e decreta <br /> CHI DI VOI VUOLE ESSERE RE!</p>
        <div className="sort-container">
          <div className="sort-label">Filtra per</div>
          <div className="sort-options">
            {[
              { value: 'totalDesc', label: 'PL Total' },
              { value: 'sDesc', label: 'Squat' },
              { value: 'bDesc', label: 'Bench Press' },
              { value: 'dDesc', label: 'Deadlift' },
              { value: 'ratioDesc', label: 'Rapporto Peso/Potenza' },
              { value: 'ipfDesc', label: 'IPF Points' },
              { value: 'dips', label: 'Dips' },
              { value: 'chinup', label: 'Chin Up' },
              { value: 'military', label: 'Military Press' },
              { value: 'trazioni', label: 'Trazioni' }
            ].map((opt) => (
              <button
                key={opt.value}
                className={`sort-option ${sortBy === opt.value ? 'active' : ''}`}
                onClick={() => {
                  if (isSpecialty(opt.value)) {
                    setFilters(prev => ({ ...prev, absolute: true, weightCategory: false, sex: false, age: false, openIncludeJunior: false }));
                  }
                  setSortBy(opt.value);
                }}
              >
                <span className="sort-option-dot"></span>
                <span className="sort-option-label">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="sort-container filter-container">
          <div className="sort-label">Ordina per</div>
          <div className="filter-toggles">
          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filters.absolute || isSpecialty(sortBy)}
              onChange={(e) => {
                if (isSpecialty(sortBy)) return;
                const val = e.target.checked;
                setFilters(prev => ({ 
                  ...prev, 
                  absolute: val,
                  weightCategory: val ? false : prev.weightCategory,
                  sex: val ? false : prev.sex,
                  age: val ? false : prev.age,
                  openIncludeJunior: val ? false : prev.openIncludeJunior
                }));
              }}
              disabled={isSpecialty(sortBy)}
            />
            <span className="filter-toggle-slider"></span>
            <span className="filter-toggle-label">Assoluto</span>
          </label>

          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filters.weightCategory}
              onChange={(e) => {
                if (isSpecialty(sortBy)) return;
                const val = e.target.checked;
                setFilters(prev => ({ 
                  ...prev, 
                  weightCategory: val,
                  sex: val ? true : prev.sex,
                  absolute: val ? false : prev.absolute,
                  age: val ? false : prev.age,
                  openIncludeJunior: val ? false : prev.openIncludeJunior
                }));
              }}
              disabled={filters.absolute || isSpecialty(sortBy)}
            />
            <span className="filter-toggle-slider"></span>
            <span className="filter-toggle-label">Cat. Peso</span>
          </label>

          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filters.sex}
              onChange={(e) => {
                if (isSpecialty(sortBy)) return;
                const val = e.target.checked;
                setFilters(prev => ({ 
                  ...prev, 
                  sex: val,
                  absolute: val ? false : prev.absolute,
                  weightCategory: val ? prev.weightCategory : false
                }));
              }}
              disabled={filters.absolute || isSpecialty(sortBy)}
            />
            <span className="filter-toggle-slider"></span>
            <span className="filter-toggle-label">Sesso</span>
          </label>

          <label className="filter-toggle">
            <input
              type="checkbox"
              checked={filters.age}
              onChange={(e) => {
                if (isSpecialty(sortBy)) return;
                const val = e.target.checked;
                setFilters(prev => ({ 
                  ...prev, 
                  age: val,
                  absolute: val ? false : prev.absolute,
                  weightCategory: val ? false : prev.weightCategory,
                  sex: val ? prev.sex : false,
                  openIncludeJunior: val ? false : prev.openIncludeJunior
                }));
              }}
              disabled={filters.absolute || isSpecialty(sortBy)}
            />
            <span className="filter-toggle-slider"></span>
            <span className="filter-toggle-label">Età</span>
          </label>

          {filters.age && !isSpecialty(sortBy) && (
            <label className="filter-toggle">
              <input
                type="checkbox"
                checked={filters.openIncludeJunior}
                onChange={(e) => setFilters(prev => ({ ...prev, openIncludeJunior: e.target.checked }))}
              />
              <span className="filter-toggle-slider"></span>
              <span className="filter-toggle-label">Includi le categorie SubJunior/Junior negli Open</span>
            </label>
          )}
</div>
        </div>
      </div>
      <div className="leaderboard-content">
        {Object.entries(sortedAndGroupedData).map(([category, items]) => (
          <React.Fragment key={category}>
            {(category !== 'all' && items.length > 0) && (
              <h3 className="weight-category">
                {formatGroupLabel(category)}
              </h3>
            )}
            <div className="leaderboard-cards">
              {items.map((item, index) => {
                try {
                  return (
                    <div 
                      key={item.username}
                      className={`leaderboard-card ${expandedRows[item.username] ? 'expanded' : ''}`}
                      onClick={() => toggleRow(item.username)}
                    >
                      <div className="leaderboard-card-header">
                        <div className={`leaderboard-position ${index === 0 ? 'position-gold' : index === 1 ? 'position-silver' : index === 2 ? 'position-bronze' : ''}`}>{index + 1}</div>
                        <div className="leaderboard-name">
                          {item.profilePhoto ? (
                            <img src={item.profilePhoto} alt="" className="avatar-inline" />
                          ) : (
                            <div className="avatar-placeholder-inline">
                              <User size={16} />
                            </div>
                          )}
                          {getDisplayName(item)}
                        </div>
                        <div className="leaderboard-value">{getSortValue(item, sortBy)}</div>
                        <div className="leaderboard-chevron">
                          {expandedRows[item.username] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </div>
                      {expandedRows[item.username] && (
                        <div className="leaderboard-card-content">
                          <div className="leaderboard-stats-grid">
                            {item.s && item.s !== '' && !isNaN(parseFloat(item.s)) && (
                              <div className="leaderboard-stat">
                                <span className="leaderboard-stat-label">Squat</span>
                                <span className="leaderboard-stat-value">{item.s} kg</span>
                              </div>
                            )}
                            {item.b && item.b !== '' && !isNaN(parseFloat(item.b)) && (
                              <div className="leaderboard-stat">
                                <span className="leaderboard-stat-label">Bench Press</span>
                                <span className="leaderboard-stat-value">{item.b} kg</span>
                              </div>
                            )}
                            {item.d && item.d !== '' && !isNaN(parseFloat(item.d)) && (
                              <div className="leaderboard-stat">
                                <span className="leaderboard-stat-label">Deadlift</span>
                                <span className="leaderboard-stat-value">{item.d} kg</span>
                              </div>
                            )}
                            {isSpecialty(sortBy) && (() => {
                              const spec = SPECIALTY_LIFTS[sortBy];
                              const active = item[spec.activeField]?.[spec.activeIndex];
                              const value = item[spec.field]?.[spec.index];
                              return active && value && value !== '' ? (
                                <div className="leaderboard-stat">
                                  <span className="leaderboard-stat-label">{spec.label}</span>
                                  <span className="leaderboard-stat-value">{value} kg</span>
                                </div>
                              ) : null;
                            })()}
                            {item.bw && item.bw !== '' && !isNaN(parseFloat(item.bw)) && (
                              <div className="leaderboard-stat">
                                <span className="leaderboard-stat-label">Peso Corporeo</span>
                                <span className="leaderboard-stat-value">{item.bw} kg</span>
                              </div>
                            )}
                            {item.total && item.total !== '' && item.bw && item.bw !== '' && !isNaN(parseFloat(item.total)) && !isNaN(parseFloat(item.bw)) && parseFloat(item.bw) > 0 && (
                              <div className="leaderboard-stat">
                                <span className="leaderboard-stat-label">Totale/BW</span>
                                <span className="leaderboard-stat-value">{(safeParse(item.total) / safeParse(item.bw)).toFixed(2)}</span>
                              </div>
                            )}
                            {item.bw && item.bw !== '' && item.gender && item.total && item.total !== '' && !isNaN(parseFloat(item.bw)) && !isNaN(parseFloat(item.total)) && parseFloat(item.bw) > 0 && (
                              <div className="leaderboard-stat">
                                <span className="leaderboard-stat-label">IPF Points</span>
                                <span className="leaderboard-stat-value">{calculateIPFPoints(safeParse(item.total), safeParse(item.bw), item.gender).toFixed(2)}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                } catch (e) {
                  console.error('Error rendering card:', e);
                  return null;
                }
              })}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default LeaderboardWithSorting;
