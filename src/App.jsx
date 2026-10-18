import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, query, orderByChild } from 'firebase/database';
import './App.css';
import bcrypt from 'bcryptjs';
import PasswordInput from './PasswordInput';
import { User, Trophy, Settings, Home, Layout, Dumbbell, Target, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import LeaderboardWithSorting from './LeaderboardWithSorting';

// Configurazione Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAd7n_WQD_jUUPSTftZ6jtu8xidMun-jzc",
  authDomain: "sbd-ladder.firebaseapp.com",
  databaseURL: "https://sbd-ladder-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "sbd-ladder",
  storageBucket: "sbd-ladder.appspot.com",
  messagingSenderId: "111032615204",
  appId: "1:111032615204:web:c444cf45e5bd5733adb3b1",
  measurementId: "G-GCFF96NMEW"
};

// Inizializza Firebase
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

function App() {
  const [currentPage, setCurrentPage] = useState('Login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [topNumbers, setTopNumbers] = useState(['', '', '', '']);
  const [bottomNumbers, setBottomNumbers] = useState(['', '', '', '']);
  const [percentages, setPercentages] = useState(['', '', '', '']);
  const [leaderboard, setLeaderboard] = useState([]);
  const [newUsername, setNewUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [bw, setBw] = useState('');
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [gender, setGender] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [showUsernameOnLeaderboard, setShowUsernameOnLeaderboard] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [prDates, setPrDates] = useState(['', '', '']);
  const [prNotes, setPrNotes] = useState(['', '', '']);
  const [previousBottomNumbers, setPreviousBottomNumbers] = useState(['', '', '']);
  const [otherPRValues, setOtherPRValues] = useState(['', '', '', '']);
  const [otherPRActive, setOtherPRActive] = useState([false, false, false, false]);
  const [otherPRDates, setOtherPRDates] = useState(['', '', '', '']);
  const [otherPRNotes, setOtherPRNotes] = useState(['', '', '', '']);
  const [previousOtherPRValues, setPreviousOtherPRValues] = useState(['', '', '', '']);
  const [otherPRGoalValues, setOtherPRGoalValues] = useState(['', '', '', '']);
  const [nextWorkout, setNextWorkout] = useState('');
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!showSplash) {
      const savedUsername = localStorage.getItem('username');
      const savedPassword = localStorage.getItem('password');
      if (savedUsername && savedPassword) {
        setUsername(savedUsername);
        setPassword(savedPassword);
        handleLogin(null, savedUsername, savedPassword);
      }
    }
  }, [showSplash]);

  const handleLogin = async (e, savedUsername = null, savedPassword = null) => {
    if (e) e.preventDefault();
    const loginUsername = savedUsername || username;
    const loginPassword = savedPassword || password;
    const lowercaseUsername = loginUsername.toLowerCase().replace(/\s/g, '');
    const userRef = ref(db, `users/${lowercaseUsername}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      const userData = snapshot.val();
      const isPasswordCorrect = await bcrypt.compare(loginPassword, userData.password);
      if (isPasswordCorrect) {
        setUsername(userData.username);
        loadUserData(lowercaseUsername);
        setCurrentPage('Home');
        localStorage.setItem('username', userData.username);
        localStorage.setItem('password', loginPassword);
      } else {
        alert('Password errata');
      }
    } else {
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(loginPassword, saltRounds);
      await set(userRef, {
        username: loginUsername,
        password: hashedPassword,
        s: 0,
        b: 0,
        d: 0,
        sObj: 0,
        bObj: 0,
        dObj: 0,
        bw: '',
        prDate: ['', '', ''],
        prNotes: ['', '', ''],
        otherPR: ['', '', '', ''],
        otherPRActive: [false, false, false, false],
        otherPRDate: ['', '', '', ''],
        otherPRNotes: ['', '', '', ''],
        previousBottomNumbers: ['', '', ''],
        previousOtherPRValues: ['', '', '', ''],
        otherPRGoalValues: ['', '', '', ''],
        nextWorkout: '',
        firstName: '',
        lastName: '',
        birthDate: '',
        showUsernameOnLeaderboard: false
      });
      loadUserData(lowercaseUsername);
      setCurrentPage('Me');
      localStorage.setItem('username', loginUsername);
      localStorage.setItem('password', loginPassword);
    }
  };

  const loadUserData = async (lowercaseUsername) => {
    const userRef = ref(db, `users/${lowercaseUsername}`);
    const snapshot = await get(userRef);
    if (snapshot.exists()) {
      const userData = snapshot.val();
      setBottomNumbers([
        userData.s || '',
        userData.b || '',
        userData.d || '',
        calculateTotal([userData.s, userData.b, userData.d])
      ]);
      setTopNumbers([
        userData.sObj || '',
        userData.bObj || '',
        userData.dObj || '',
        calculateTotal([userData.sObj, userData.bObj, userData.dObj])
      ]);
      setBw(userData.bw || '');
      setGender(userData.gender || '');
      setPrDates(userData.prDate || ['', '', '']);
      setPrNotes(userData.prNotes || ['', '', '']);
      setOtherPRValues(userData.otherPR || ['', '', '']);
      setOtherPRActive(userData.otherPRActive || [false, false, false]);
      setOtherPRDates(userData.otherPRDate || ['', '', '']);
      setOtherPRNotes(userData.otherPRNotes || ['', '', '']);
      setPreviousBottomNumbers(userData.previousBottomNumbers || ['', '', '']);
      setPreviousOtherPRValues(userData.previousOtherPRValues || ['', '', '']);
      setOtherPRGoalValues(userData.otherPRGoalValues || ['', '', '']);
      setNextWorkout(userData.nextWorkout || '');
      setFirstName(userData.firstName || '');
      setLastName(userData.lastName || '');
      setBirthDate(userData.birthDate || '');
      setShowUsernameOnLeaderboard(userData.showUsernameOnLeaderboard || false);
    }
  };

  const calculateTotal = (numbers) => {
    return numbers.reduce((total, num) => total + (num ? parseFloat(num) : 0), 0).toString();
  };

  const handleNumberChange = (index, isTop, newValue) => {
    const newNumbers = isTop ? [...topNumbers] : [...bottomNumbers];
    newNumbers[index] = newValue;
    newNumbers[3] = calculateTotal(newNumbers.slice(0, 3));
    if (isTop) {
      setTopNumbers(newNumbers);
    } else {
      setBottomNumbers(newNumbers);
    }
    handleSave();
  };

  useEffect(() => {
    const newPercentages = topNumbers.map((top, index) => {
      const topValue = parseFloat(top);
      const bottomValue = parseFloat(bottomNumbers[index]);
      return topValue && bottomValue ? (bottomValue / topValue) * 100 : '';
    });
    setPercentages(newPercentages);
  }, [topNumbers, bottomNumbers]);

    const handleSave = async () => {
    const userRef = ref(db, `users/${username.toLowerCase().replace(/\s/g, '')}`);
    setPreviousBottomNumbers([...bottomNumbers]);
    setPreviousOtherPRValues([...otherPRValues]);
    await update(userRef, {
      s: bottomNumbers[0] || null,
      b: bottomNumbers[1] || null,
      d: bottomNumbers[2] || null,
      sObj: topNumbers[0] || null,
      bObj: topNumbers[1] || null,
      dObj: topNumbers[2] || null,
      bw: bw || null,
      gender: gender || null,
      prDate: prDates,
      prNotes: prNotes,
      otherPR: otherPRValues,
      otherPRActive: otherPRActive,
      otherPRDate: otherPRDates,
      otherPRNotes: otherPRNotes,
      previousBottomNumbers: [...bottomNumbers],
      previousOtherPRValues: [...otherPRValues],
      otherPRGoalValues: [...otherPRGoalValues],
      nextWorkout: nextWorkout || null,
      firstName: firstName || null,
      lastName: lastName || null,
      birthDate: birthDate || null,
      showUsernameOnLeaderboard: showUsernameOnLeaderboard
    });
  };

  const loadLeaderboard = async () => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    const leaderboardData = [];
    snapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      leaderboardData.push({
        username: userData.username,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        showUsernameOnLeaderboard: userData.showUsernameOnLeaderboard || false,
        s: userData.s || '',
        b: userData.b || '',
        d: userData.d || '',
        bw: userData.bw || '',
        gender: userData.gender || '',
        total: calculateTotal([userData.s, userData.b, userData.d]),
        
      });
    });
    setLeaderboardData(leaderboardData);
  };

  useEffect(() => {
    if (currentPage === 'Leaderboard') {
      loadLeaderboard();
    }
  }, [currentPage]);

  const handleChangeUsername = async () => {
    if (newUsername) {
      const lowercaseNewUsername = newUsername.toLowerCase().replace(/\s/g, '');
      const newUserRef = ref(db, `users/${lowercaseNewUsername}`);
      const snapshot = await get(newUserRef);
      if (snapshot.exists()) {
        alert('Username già in uso');
      } else {
        const oldUserRef = ref(db, `users/${username.toLowerCase().replace(/\s/g, '')}`);
        const userData = (await get(oldUserRef)).val();
        await set(newUserRef, {...userData, username: newUsername});
        await set(oldUserRef, null);
        setUsername(newUsername);
        localStorage.setItem('username', newUsername);
        alert('Username cambiato con successo');
      }
    }
  };

  const handleChangePassword = async () => {
    if (currentPassword && newPassword && confirmNewPassword) {
      if (newPassword !== confirmNewPassword) {
        alert('Le nuove password non corrispondono');
        return;
      }
      
      const userRef = ref(db, `users/${username.toLowerCase().replace(/\s/g, '')}`);
      const snapshot = await get(userRef);
      if (snapshot.exists()) {
        const userData = snapshot.val();
        const isPasswordCorrect = await bcrypt.compare(currentPassword, userData.password);
        if (isPasswordCorrect) {
          const saltRounds = 10;
          const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);
          await update(userRef, {password: hashedNewPassword});
          localStorage.setItem('password', newPassword);
          alert('Password cambiata con successo');
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
        } else {
          alert('La password corrente non è corretta');
        }
      }
    } else {
      alert('Per favore, compila tutti i campi');
    }
  };

  const renderSplashPage = () => (
    <div className="splash-page">
      <div className="splash-logo-container">
        <img src="/splash-logo.png" alt="Kuma Logo" className="splash-logo" />
      </div>
    </div>
  );

  const renderLoginPage = () => (
    <div className="login-page">
      <img src="/logo512.png" alt="Kuma Logo" className="login-logo" />
      <h2>Login / Registrazione</h2>
      <form onSubmit={handleLogin}>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          required
        />
        <PasswordInput
          value={password} 
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Nome"
        />
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Cognome"
        />
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          placeholder="Data di Nascita"
        />
        <button type="submit" className="login-button">Login / Registrati</button>
      </form>
    </div>
  );

  const renderProfilePage = () => (
    <div className="profile-page">
      <h2>Profilo di {username}</h2>
      <div className="profile-section">
        <h3>Cambia Username</h3>
        <input
          type="text"
          value={newUsername}
          onChange={(e) => setNewUsername(e.target.value)}
          placeholder="Nuovo Username"
        />
        <button onClick={handleChangeUsername}>Cambia Username</button>
      </div>
      <div className="profile-section">
        <h3>Cambia Password</h3>
        <PasswordInput
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          placeholder="Password corrente"
        />
        <PasswordInput
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Nuova password"
        />
        <PasswordInput
          value={confirmNewPassword}
          onChange={(e) => setConfirmNewPassword(e.target.value)}
          placeholder="Conferma nuova password"
        />
        <button onClick={handleChangePassword} className="change-password-button">Cambia Password</button>
      </div>
    </div>
  );

  const renderMePage = () => {
    const exercises = [
      { key: 's', label: 'Squat', icon: <img src="/squat.png" alt="Squat" className="img-no-black-bg pr-card-icon-img" />, index: 0 },
      { key: 'b', label: 'Bench', icon: <img src="/bench-press.png" alt="Bench" className="img-no-black-bg pr-card-icon-img" />, index: 1 },
      { key: 'd', label: 'Deadlift', icon: <img src="/deadlift.jpg" alt="Deadlift" className="img-no-black-bg pr-card-icon-img" />, index: 2 },
    ];

    const otherExercises = [
      { key: 'dips', label: 'Dips', icon: <img src="/dips.jpg" alt="Dips" className="img-no-black-bg pr-card-icon-img" /> },
      { key: 'chinup', label: 'Chin Up', icon: <img src="/chinup.png" alt="Chin Up" className="img-no-black-bg pr-card-icon-img" /> },
      { key: 'military', label: 'Military Press', icon: <img src="/military-press.jpg" alt="Military Press" className="img-no-black-bg pr-card-icon-img" /> },
      { key: 'trazioni', label: 'Trazioni', icon: <img src="/trazioni.png" alt="Trazioni" className="img-no-black-bg pr-card-icon-img" /> },
    ];

    const getPrPercentage = (index, isOther = false) => {
      if (isOther) {
        const current = parseFloat(otherPRValues[index]);
        const goal = parseFloat(otherPRGoalValues[index] || '0');
        const previous = parseFloat(previousOtherPRValues[index] || '0');
        if (!current || !goal) return 0;
        const base = previous || 0;
        const diff = goal - base;
        if (diff === 0) return 0;
        return Math.min(((current - base) / diff) * 100, 100);
      } else {
        const current = parseFloat(bottomNumbers[index]);
        const goal = parseFloat(topNumbers[index]);
        const previous = parseFloat(previousBottomNumbers[index] || '0');
        if (!current || !goal) return 0;
        const base = previous || 0;
        const diff = goal - base;
        if (diff === 0) return 0;
        return Math.min(((current - base) / diff) * 100, 100);
      }
    };

    return (
      <>
        <div className="personal-info-section">
          <div className="section-title">Informazioni personali</div>
          <div className="personal-info-grid">
            <div className="info-item">
              <div className="info-label">Nome</div>
              <input
                type="text"
                value={firstName}
                onChange={(e) => { setFirstName(e.target.value); handleSave(); }}
                className="info-input"
                placeholder="Nome"
              />
            </div>
            <div className="info-item">
              <div className="info-label">Cognome</div>
              <input
                type="text"
                value={lastName}
                onChange={(e) => { setLastName(e.target.value); handleSave(); }}
                className="info-input"
                placeholder="Cognome"
              />
            </div>
            <div className="info-item">
              <div className="info-label">Data di Nascita</div>
              <input
                type="date"
                value={birthDate}
                onChange={(e) => { setBirthDate(e.target.value); handleSave(); }}
                className="info-input"
              />
            </div>
            <div className="info-item">
              <div className="info-label">Username</div>
              <input
                type="text"
                value={username}
                onChange={(e) => { setUsername(e.target.value); handleSave(); }}
                className="info-input"
                placeholder="Username"
              />
              <label className="toggle-switch" style={{ marginTop: '8px', display: 'inline-flex' }}>
                <input
                  type="checkbox"
                  checked={showUsernameOnLeaderboard}
                  onChange={(e) => { setShowUsernameOnLeaderboard(e.target.checked); handleSave(); }}
                />
                <span className="toggle-slider"></span>
              </label>
              <span style={{ fontSize: '12px', color: '#ccc', marginLeft: '6px' }}>Mostra username su Leader Board</span>
            </div>
            <div className="info-item">
              <div className="info-label">Peso corporeo</div>
              <input
                type="number"
                value={bw}
                onChange={(e) => { setBw(e.target.value); handleSave(); }}
                className="info-input"
                placeholder="kg"
              />
            </div>
            <div className="info-item">
              <div className="info-label">Genere</div>
              <select
                value={gender}
                onChange={(e) => { setGender(e.target.value); handleSave(); }}
                className="info-select"
              >
                <option value="">Seleziona</option>
                <option value="M">M</option>
                <option value="F">F</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pr-cards-section">
          <div className="section-title">Powerlifting Personal Record</div>
          <div className="me-total">
            <span className="me-total-value">{bottomNumbers[3] || '0'} kg</span>
          </div>
          {exercises.map((ex) => (
            <div key={ex.key} className={`pr-card ${expandedCard === ex.index ? 'expanded' : ''}`}>
              <div className="pr-card-header" onClick={() => setExpandedCard(expandedCard === ex.index ? null : ex.index)}>
                <div className="pr-card-icon-container">{ex.icon}</div>
                <span className="pr-card-label">{ex.label}</span>
                {expandedCard === ex.index ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </div>
              {expandedCard === ex.index && (
                <div className="pr-card-content">
                  <div className="pr-field-row">
                    <div className="pr-field">
                      <label>Attuale</label>
                      <input
                        type="number"
                        value={bottomNumbers[ex.index]}
                        onChange={(e) => handleNumberChange(ex.index, false, e.target.value)}
                        className="pr-input"
                      />
                    </div>
                    <div className="pr-field">
                      <label>Data</label>
                      <input
                        type="date"
                        value={prDates[ex.index]}
                        onChange={(e) => {
                          const next = [...prDates];
                          next[ex.index] = e.target.value;
                          setPrDates(next); handleSave();
                        }}
                        className="pr-input"
                      />
                    </div>
                  </div>
                  <div className="pr-field-row">
                    <div className="pr-field-full">
                      <label>Obiettivo</label>
                      <input
                        type="number"
                        value={topNumbers[ex.index]}
                        onChange={(e) => handleNumberChange(ex.index, true, e.target.value)}
                        className="pr-input"
                      />
                    </div>
                  </div>
                  <div className="pr-field-row">
                    <div className="pr-field-full">
                      <label>Note</label>
                      <textarea
                        value={prNotes[ex.index]}
                        onChange={(e) => {
                          const next = [...prNotes];
                          next[ex.index] = e.target.value;
                          setPrNotes(next); handleSave();
                        }}
                        className="pr-textarea"
                        placeholder="Aggiungi note..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="pr-percentage-row">
                    <span className="pr-percentage-label">Progresso verso obiettivo</span>
                    <div className="pr-percentage-bar-container">
                      <div
                        className="pr-percentage-bar"
                        style={{
                          width: `${getPrPercentage(ex.index)}%`,
                          backgroundColor: getColor(getPrPercentage(ex.index)),
                        }}
                      />
                    </div>
                    <span className="pr-percentage-value">{getPrPercentage(ex.index).toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="other-pr-section">
          <div className="section-title">Other Personal Record</div>
          {otherExercises.map((ex, idx) => (
            <div key={ex.key} className={`other-pr-card ${otherPRActive[idx] ? 'expanded' : ''}`}>
              <div className="other-pr-card-header" onClick={(e) => {
                e.stopPropagation();
                const next = [...otherPRActive];
                next[idx] = !next[idx];
                setOtherPRActive(next);
              }}>
                <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={otherPRActive[idx]}
                    onChange={(e) => {
                      e.stopPropagation();
                      const next = [...otherPRActive];
                      next[idx] = e.target.checked;
                      setOtherPRActive(next); handleSave();
                    }}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <div className="other-pr-card-icon">{ex.icon}</div>
                <span className="other-pr-card-label">{ex.label}</span>
              </div>
              {otherPRActive[idx] && (
                <div className="other-pr-card-content">
                  <div className="pr-field-row">
                    <div className="pr-field">
                      <label>Attuale</label>
                      <input
                        type="number"
                        value={otherPRValues[idx]}
                        onChange={(e) => {
                          const next = [...otherPRValues];
                          next[idx] = e.target.value;
                          setOtherPRValues(next); handleSave();
                        }}
                        className="pr-input"
                      />
                    </div>
                    <div className="pr-field">
                      <label>Data</label>
                      <input
                        type="date"
                        value={otherPRDates[idx]}
                        onChange={(e) => {
                          const next = [...otherPRDates];
                          next[idx] = e.target.value;
                          setOtherPRDates(next); handleSave();
                        }}
                        className="pr-input"
                      />
                    </div>
                  </div>
                  <div className="pr-field-row">
                    <div className="pr-field-full">
                      <label>Obiettivo</label>
                      <input
                        type="number"
                        value={otherPRGoalValues[idx] || ''}
                        onChange={(e) => {
                          const next = [...otherPRGoalValues];
                          next[idx] = e.target.value;
                          setOtherPRGoalValues(next); handleSave();
                        }}
                        className="pr-input"
                      />
                    </div>
                  </div>
                  <div className="pr-field-row">
                    <div className="pr-field-full">
                      <label>Note</label>
                      <textarea
                        value={otherPRNotes[idx]}
                        onChange={(e) => {
                          const next = [...otherPRNotes];
                          next[idx] = e.target.value;
                          setOtherPRNotes(next); handleSave();
                        }}
                        className="pr-textarea"
                        placeholder="Aggiungi note..."
                        rows={2}
                      />
                    </div>
                  </div>
                  <div className="pr-percentage-row">
                    <span className="pr-percentage-label">Progresso verso obiettivo</span>
                    <div className="pr-percentage-bar-container">
                      <div
                        className="pr-percentage-bar"
                        style={{
                          width: `${getPrPercentage(idx, true)}%`,
                          backgroundColor: getColor(getPrPercentage(idx, true)),
                        }}
                      />
                    </div>
                    <span className="pr-percentage-value">{getPrPercentage(idx, true).toFixed(1)}%</span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </>
    );
  };

  const renderLeaderboardPage = () => (
    <div className="leaderboard">
      <LeaderboardWithSorting data={leaderboardData} />
    </div>
  );

  const renderProgrammazioniPage = () => (
    <div className="programmazioni-page">
      <h2>Programmazioni</h2>
      <p>In arrivo...</p>
    </div>
  );

  const renderHomePage = () => (
    <div className="home-page">
      <h2>Benvenuto, {username}!</h2>
      <div className="home-grid">
        <button className="home-card" onClick={() => setCurrentPage('Me')}>
          <User size={48} />
          <span>Personal Record</span>
        </button>
        <button className="home-card" onClick={() => setCurrentPage('Leaderboard')}>
          <Trophy size={48} />
          <span>Leader Board</span>
        </button>
        <button className="home-card" onClick={() => setCurrentPage('Programmazioni')}>
          <Layout size={48} />
          <span>Programmazioni</span>
        </button>
      <button className="home-card" onClick={() => setCurrentPage('Profile')}>
        <Settings size={48} />
        <span>Profilo</span>
      </button>
      </div>
      <div className="next-workout-section">
        <div className="next-workout-label">Il tuo prossimo allenamento è</div>
        <input
          type="text"
          value={nextWorkout}
          onChange={(e) => { setNextWorkout(e.target.value); handleSave(); }}
          className="next-workout-input"
          placeholder="Scrivi qui il tuo prossimo allenamento..."
        />
      </div>
    </div>
  );

  return (
    <div className="app">
      <div className="app-background" />
      {showSplash && renderSplashPage()}
      {!showSplash && currentPage === 'Login' && renderLoginPage()}
      {!showSplash && currentPage === 'Home' && renderHomePage()}
      {!showSplash && currentPage === 'Me' && renderMePage()}
      {!showSplash && currentPage === 'Leaderboard' && renderLeaderboardPage()}
      {!showSplash && currentPage === 'Profile' && renderProfilePage()}
      {!showSplash && currentPage === 'Programmazioni' && renderProgrammazioniPage()}
      {currentPage !== 'Login' && (
        <div className="menu-bar">
          <button onClick={() => setCurrentPage('Home')}>
            <Home size={24} />
          </button>
          <button onClick={() => setCurrentPage('Me')}>
            <User size={24} />
          </button>
          <button onClick={() => setCurrentPage('Leaderboard')}>
            <Trophy size={24} />
          </button>
          <button onClick={() => setCurrentPage('Programmazioni')}>
            <Layout size={24} />
          </button>
          <button onClick={() => setCurrentPage('Profile')}>
            <Settings size={24} />
          </button>
        </div>
      )}
    </div>
  );
}

function getColor(percentage) {
  const hue = percentage * 1.2;
  return `hsl(${hue}, 100%, 50%)`;
}

export default App;
