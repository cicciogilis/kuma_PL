import React, { useState, useMemo } from 'react';
import './Leaderboard.css';

const LeaderboardWithSorting = ({ data }) => {
  const [sortBy, setSortBy] = useState('totalDesc');

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
  
  const sortedAndGroupedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      switch (sortBy) {
        case 'sDesc':
          return parseFloat(b.s) - parseFloat(a.s);
        case 'bDesc':
          return parseFloat(b.b) - parseFloat(a.b);
        case 'dDesc':
          return parseFloat(b.d) - parseFloat(a.d);
        case 'bwDesc':
          const categoryA = Math.floor(parseFloat(a.bw) / 10) * 10;
          const categoryB = Math.floor(parseFloat(b.bw) / 10) * 10;
          if (categoryA === categoryB) {
            return parseFloat(b.total) - parseFloat(a.total);
          }
          return categoryA - categoryB;
        case 'totalDesc':
          return parseFloat(b.total) - parseFloat(a.total);
        case 'ratioDesc':
          return parseFloat(b.total) / parseFloat(b.bw) - parseFloat(a.total) / parseFloat(a.bw);
        case 'ipfDesc':
          return calculateIPFPoints(parseFloat(b.total), parseFloat(b.bw), b.gender) - 
                 calculateIPFPoints(parseFloat(a.total), parseFloat(a.bw), a.gender);
        default:
          return parseFloat(b.total) - parseFloat(a.total);
      }
    });

    if (sortBy === 'bwDesc') {
      const grouped = {};
      sorted.forEach((item) => {
        const category = Math.floor(parseFloat(item.bw) / 10) * 10;
        if (!grouped[category]) {
          grouped[category] = [];
        }
        grouped[category].push(item);
      });
      return grouped;
    }

    return { all: sorted };
  }, [data, sortBy]);

  return (
    <div className="leaderboard-container">
      <h2 className="leaderboard-title">Classifica</h2>
      <div className="leaderboard-content">
        <div className="sort-container">
          <div className="sort-label">Ordina</div>
          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="sDesc">Squat</option>
            <option value="bDesc">Bench</option>
            <option value="dDesc">Deadlift</option>
            <option value="bwDesc">Categoria</option>
            <option value="totalDesc">Totale</option>
            <option value="ratioDesc">Totale/BW</option>
            <option value="ipfDesc">IPF points</option>
          </select>
        </div>
        <div className="table-wrapper">
          {Object.entries(sortedAndGroupedData).map(([category, items]) => (
            <React.Fragment key={category}>
              {sortBy === 'bwDesc' && (
                <h3 className="weight-category">
                  Categoria {category}-{parseInt(category) + 9.9} kg
                </h3>
              )}
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th className="position-name">Nome</th>
                    {sortBy !== 'ratioDesc' && sortBy !== 'bwDesc' && sortBy !== 'ipfDesc' && <th>Squat</th>}
                    {sortBy !== 'ratioDesc' && sortBy !== 'bwDesc' && sortBy !== 'ipfDesc' && <th>Bench</th>}
                    {sortBy !== 'ratioDesc' && sortBy !== 'bwDesc' && sortBy !== 'ipfDesc' && <th>Deadlift</th>}
                    {(sortBy === 'ratioDesc' || sortBy === 'bwDesc' || sortBy === 'ipfDesc') && <th>BW</th>}
                    {sortBy !== 'ipfDesc' && <th>Totale</th>}
                    {sortBy === 'ratioDesc' && <th>T/BW</th>}
                    {sortBy === 'ipfDesc' && <th>IPF Points</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={item.username}>
                      <td className="position-name">
                        <span className="position">{index + 1}.</span> {item.username}
                      </td>
                      {sortBy !== 'ratioDesc' && sortBy !== 'bwDesc' && sortBy !== 'ipfDesc' && <td>{item.s}</td>}
                      {sortBy !== 'ratioDesc' && sortBy !== 'bwDesc' && sortBy !== 'ipfDesc' && <td>{item.b}</td>}
                      {sortBy !== 'ratioDesc' && sortBy !== 'bwDesc' && sortBy !== 'ipfDesc' && <td>{item.d}</td>}
                      {(sortBy === 'ratioDesc' || sortBy === 'bwDesc' || sortBy === 'ipfDesc') && <td className="bw">{item.bw}</td>}
                      {sortBy !== 'ipfDesc' && <td className="total">{item.total}</td>}
                      {sortBy === 'ratioDesc' && (
                        <td>{(parseFloat(item.total) / parseFloat(item.bw)).toFixed(2)}</td>
                      )}
                      {sortBy === 'ipfDesc' && (
                        <td>{calculateIPFPoints(parseFloat(item.total), parseFloat(item.bw), item.gender).toFixed(2)}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardWithSorting;
