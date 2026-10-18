import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, query, orderByChild } from 'firebase/database';
import './App.css';
import bcrypt from 'bcryptjs';
import PasswordInput from './PasswordInput';
import { User, Trophy, Settings, Home, Layout, Dumbbell, Target, Activity, ChevronDown, ChevronUp, Edit, Camera } from 'lucide-react';
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
  const [birthCity, setBirthCity] = useState('');
  const [birthProvince, setBirthProvince] = useState('');
  const [showUsernameOnLeaderboard, setShowUsernameOnLeaderboard] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
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
  const [showFirstLoginModal, setShowFirstLoginModal] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);

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
        if (userData.firstLogin) {
          await update(userRef, { firstLogin: false });
          setShowFirstLoginModal(true);
          setCurrentPage('Me');
        } else {
          setCurrentPage('Home');
        }
        localStorage.setItem('username', userData.username);
        localStorage.setItem('password', loginPassword);
      } else {
        alert('Password errata');
      }
    } else {
      if (isRegistering) {
        if (!firstName || !lastName || !birthDate || !birthCity || !birthProvince || !gender) {
          alert('Compila tutti i campi');
          return;
        }
        if (birthCity && !birthProvince) {
          alert('Inserisci anche la provincia di nascita');
          return;
        }
        if (birthProvince && !birthCity) {
          alert('Inserisci anche la città di nascita');
          return;
        }
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
          prDate: ['', '', '', ''],
          prNotes: ['', '', '', ''],
          otherPR: ['', '', '', ''],
          otherPRActive: [false, false, false, false],
          otherPRDate: ['', '', '', ''],
          otherPRNotes: ['', '', '', ''],
          previousBottomNumbers: ['', '', ''],
          previousOtherPRValues: ['', '', '', ''],
          otherPRGoalValues: ['', '', '', ''],
          nextWorkout: '',
          firstName: firstName || '',
          lastName: lastName || '',
          birthDate: birthDate || '',
          birthCity: birthCity || '',
          birthProvince: birthProvince || '',
          gender: gender || '',
          showUsernameOnLeaderboard: false,
          profilePhoto: '',
          firstLogin: true
        });
        loadUserData(lowercaseUsername);
        setShowFirstLoginModal(true);
        setCurrentPage('Me');
        localStorage.setItem('username', loginUsername);
        localStorage.setItem('password', loginPassword);
      } else {
        alert('Utente non registrato. Clicca su "Registrati" per creare un nuovo account.');
      }
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
      setPreviousOtherPRValues(userData.previousOtherPRValues || ['', '', '', '']);
      setOtherPRGoalValues(userData.otherPRGoalValues || ['', '', '', '']);
      setNextWorkout(userData.nextWorkout || '');
      setFirstName(userData.firstName || '');
      setLastName(userData.lastName || '');
      setBirthDate(userData.birthDate || '');
      setBirthCity(userData.birthCity || '');
      setBirthProvince(userData.birthProvince || '');
      setShowUsernameOnLeaderboard(userData.showUsernameOnLeaderboard || false);
      setProfilePhoto(userData.profilePhoto || '');
    }
  };

  const calculateTotal = (numbers) => {
    return numbers.reduce((total, num) => total + (num ? parseFloat(num) : 0), 0).toString();
  };

  const handleProfilePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target.result;
        setProfilePhoto(base64);
        handleSave({ profilePhoto: base64 });
      };
      reader.readAsDataURL(file);
    }
    setFileInputKey(prev => prev + 1);
  };

  const handleNumberChange = (index, isTop, newValue) => {
    const newNumbers = isTop ? [...topNumbers] : [...bottomNumbers];
    newNumbers[index] = newValue;
    newNumbers[3] = calculateTotal(newNumbers.slice(0, 3));
    if (isTop) {
      setTopNumbers(newNumbers);
      handleSave({ topNumbers: newNumbers });
    } else {
      setBottomNumbers(newNumbers);
      handleSave({ bottomNumbers: newNumbers });
    }
  };

  useEffect(() => {
    const newPercentages = topNumbers.map((top, index) => {
      const topValue = parseFloat(top);
      const bottomValue = parseFloat(bottomNumbers[index]);
      return topValue && bottomValue ? (bottomValue / topValue) * 100 : '';
    });
    setPercentages(newPercentages);
  }, [topNumbers, bottomNumbers]);

    const handleSave = async (overrides = {}) => {
    // Retrocompatibilità: se viene passato un booleano, è il toggle showUsername
    if (typeof overrides === 'boolean') {
      overrides = { showUsernameOnLeaderboard: overrides };
    }
    const merged = {
      bottomNumbers, topNumbers, bw, gender, prDates, prNotes,
      otherPRValues, otherPRActive, otherPRDates, otherPRNotes,
      otherPRGoalValues, nextWorkout, firstName, lastName,
      birthDate, birthCity, birthProvince, showUsernameOnLeaderboard,
      profilePhoto,
      ...overrides,
    };
    if (merged.birthCity && !merged.birthProvince) {
      alert('Inserisci anche la provincia di nascita');
      return;
    }
    if (merged.birthProvince && !merged.birthCity) {
      alert('Inserisci anche la città di nascita');
      return;
    }
    const userRef = ref(db, `users/${username.toLowerCase().replace(/\s/g, '')}`);
    setPreviousBottomNumbers([...merged.bottomNumbers]);
    setPreviousOtherPRValues([...merged.otherPRValues]);
    await update(userRef, {
      s: merged.bottomNumbers[0] || null,
      b: merged.bottomNumbers[1] || null,
      d: merged.bottomNumbers[2] || null,
      sObj: merged.topNumbers[0] || null,
      bObj: merged.topNumbers[1] || null,
      dObj: merged.topNumbers[2] || null,
      bw: merged.bw || null,
      gender: merged.gender || null,
      prDate: merged.prDates,
      prNotes: merged.prNotes,
      otherPR: merged.otherPRValues,
      otherPRActive: merged.otherPRActive,
      otherPRDate: merged.otherPRDates,
      otherPRNotes: merged.otherPRNotes,
      previousBottomNumbers: [...merged.bottomNumbers],
      previousOtherPRValues: [...merged.otherPRValues],
      otherPRGoalValues: [...merged.otherPRGoalValues],
      nextWorkout: merged.nextWorkout || null,
      firstName: merged.firstName || null,
      lastName: merged.lastName || null,
      birthDate: merged.birthDate || null,
      birthCity: merged.birthCity || null,
      birthProvince: merged.birthProvince || null,
      showUsernameOnLeaderboard: merged.showUsernameOnLeaderboard,
      profilePhoto: merged.profilePhoto || null
    });
  };

  const loadLeaderboard = async () => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    const leaderboardData = [];
    snapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      
      // Parse lift values safely
      const s = userData.s != null ? parseFloat(userData.s) : 0;
      const b = userData.b != null ? parseFloat(userData.b) : 0;
      const d = userData.d != null ? parseFloat(userData.d) : 0;
      const bw = userData.bw != null ? parseFloat(userData.bw) : 0;
      
      // Only include users with at least one valid main lift (> 0)
      const hasValidMainLift = (s > 0) || (b > 0) || (d > 0);
      if (!hasValidMainLift) return;
      
      const otherPR = userData.otherPR || ['', '', '', ''];
      const otherPRActive = userData.otherPRActive || [false, false, false, false];
      
      leaderboardData.push({
        username: userData.username,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        showUsernameOnLeaderboard: userData.showUsernameOnLeaderboard || false,
        profilePhoto: userData.profilePhoto || '',
        s: s > 0 ? String(s) : '',
        b: b > 0 ? String(b) : '',
        d: d > 0 ? String(d) : '',
        bw: bw > 0 ? String(bw) : '',
        gender: userData.gender || '',
        birthDate: userData.birthDate || '',
        otherPRValues: otherPR,
        otherPRActive: otherPRActive,
        total: (s + b + d) > 0 ? String(s + b + d) : '',
      });
    });
    setLeaderboardData(leaderboardData);
  };

  useEffect(() => {
    if (currentPage === 'Leaderboard') {
      loadLeaderboard();
    }
  }, [currentPage, showUsernameOnLeaderboard]);

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
    <div className={`login-page ${isRegistering ? 'register-mode' : ''}`}>
      <img src="/logo512.png" alt="Kuma Logo" className="login-logo" />
      <h2>{isRegistering ? 'Registrazione' : 'Login'}</h2>
      <form onSubmit={handleLogin}>
        {!isRegistering && (
          <>
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
          </>
        )}
        {isRegistering && (
          <>
            <div className="personal-info-grid">
              <div className="info-item">
                <div className="info-label">Nome</div>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Nome"
                  className="info-input"
                />
              </div>
              <div className="info-item">
                <div className="info-label">Cognome</div>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Cognome"
                  className="info-input"
                />
              </div>
              <div className="info-item">
                <div className="info-label">Data di Nascita</div>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  placeholder="Data di Nascita"
                  className="info-input"
                />
              </div>
              <div className="info-item">
                <div className="info-label">Genere</div>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="info-select"
                >
                  <option value="">Seleziona genere</option>
                  <option value="M">M</option>
                  <option value="F">F</option>
                </select>
              </div>
              <div className="info-item">
                <div className="info-label">Città di Nascita</div>
                <input
                  type="text"
                  value={birthCity}
                  onChange={(e) => setBirthCity(e.target.value)}
                  placeholder="Città di Nascita"
                  className="info-input"
                />
              </div>
              <div className="info-item">
                <div className="info-label">Provincia</div>
                <input
                  type="text"
                  value={birthProvince}
                  onChange={(e) => setBirthProvince(e.target.value)}
                  placeholder="Provincia"
                  className="info-input"
                />
              </div>
              <div className="info-item credentials-item">
                <div className="info-label">Username</div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  required
                  className="info-input"
                />
              </div>
              <div className="info-item credentials-item">
                <div className="info-label">Password</div>
                <PasswordInput
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                />
              </div>
            </div>
          </>
        )}
        <button type="submit" className="login-button">{isRegistering ? 'Registrati' : 'Accedi'}</button>
        <button type="button" onClick={() => setIsRegistering(!isRegistering)} className="toggle-register">
          {isRegistering ? 'Hai già un account? Accedi' : 'Nuovo utente? Registrati'}
        </button>
      </form>
    </div>
  );

  const renderProfilePage = () => (
    <div className="profile-page">
      <h2>Settings</h2>
      <div className="profile-section">
        <h3>Informazioni personali</h3>
        <div className="profile-photo-section">
          <div className="profile-photo-wrapper">
            {profilePhoto ? (
              <img src={profilePhoto} alt="Profile" className="profile-photo-img" />
            ) : (
              <div className="profile-photo-placeholder">
                <User size={48} />
              </div>
            )}
            <label className="profile-photo-edit-label">
              <input
                type="file"
                accept="image/*"
                onChange={handleProfilePhotoChange}
                className="profile-photo-file-input"
                key={fileInputKey}
              />
              <Camera size={20} />
            </label>
          </div>
        </div>
        <div className="personal-info-grid">
          <div className="info-item">
            <div className="info-label">Nome</div>
            <div className="info-value">{firstName || '—'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Cognome</div>
            <div className="info-value">{lastName || '—'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Data di Nascita</div>
            <div className="info-value">{birthDate || '—'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Città di Nascita</div>
            <div className="info-value">{birthCity || '—'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Provincia</div>
            <div className="info-value">{birthProvince || '—'}</div>
          </div>
          <div className="info-item">
            <div className="info-label">Genere</div>
            <div className="info-value">{gender === 'M' ? 'M' : gender === 'F' ? 'F' : '—'}</div>
          </div>
        </div>
      </div>
      <div className="profile-section">
        <h3>Visualizzazione Leader Board</h3>
        <div className="toggle-row">
          <label className="toggle-switch inline-toggle" style={{ marginTop: '0', display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <input
              type="checkbox"
              checked={showUsernameOnLeaderboard}
              onChange={(e) => {
                const newVal = e.target.checked;
                setShowUsernameOnLeaderboard(newVal); 
                handleSave({ showUsernameOnLeaderboard: newVal }); 
              }}
            />
            <span className="toggle-slider"></span>
          </label>
<div className="toggle-text" style={{ maxWidth: '260px', minWidth: '200px' }}>
            <span style={{ fontSize: '14px', color: '#ccc', whiteSpace: 'nowrap' }}>Mostra username su Leader Board</span>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '4px', marginBottom: '0', whiteSpace: 'nowrap' }}>Se disattivato, verranno mostrati Nome e Cognome</p>
          </div>
        </div>
      </div>
      <div className="profile-section">
        <h3>Cambia Username</h3>
        <div className="info-item current-username-box">
          <div className="info-label">Username attuale</div>
          <div className="info-value">{username || '—'}</div>
        </div>
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
      { key: 'b', label: 'Bench Press', icon: <img src="/bench-press.png" alt="Bench Press" className="img-no-black-bg pr-card-icon-img" />, index: 1 },
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
          <div className="profile-photo-section">
            <div className="profile-photo-wrapper">
              {profilePhoto ? (
                <img src={profilePhoto} alt="Profile" className="profile-photo-img" />
              ) : (
                <div className="profile-photo-placeholder">
                  <User size={48} />
                </div>
              )}
            </div>
          </div>
          <div className="personal-info-grid">
            <div className="info-item">
              <div className="info-label">Peso corporeo</div>
              <input
                type="number"
                value={bw}
                onChange={(e) => { setBw(e.target.value); handleSave({ bw: e.target.value }); }}
                className="info-input"
                placeholder="kg"
              />
            </div>
            <div className="info-item">
              <div className="info-label">Genere</div>
              <select
                value={gender}
                onChange={(e) => { setGender(e.target.value); handleSave({ gender: e.target.value }); }}
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
                          setPrDates(next); handleSave({ prDates: next });
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
                          setPrNotes(next); handleSave({ prNotes: next });
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
                      setOtherPRActive(next); handleSave({ otherPRActive: next });
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
                          setOtherPRValues(next); handleSave({ otherPRValues: next });
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
                          setOtherPRDates(next); handleSave({ otherPRDates: next });
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
                          setOtherPRGoalValues(next); handleSave({ otherPRGoalValues: next });
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
                          setOtherPRNotes(next); handleSave({ otherPRNotes: next });
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
      <div className="home-header">
        <h1 className="home-title">Kuma Powerlifting</h1>
        <p className="home-subtitle">powered by Marco Moscheo</p>
      </div>
      <h2 className="home-welcome">Benvenuto, {username}!</h2>
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
        <span>Settings</span>
      </button>
      </div>
      <div className="next-workout-section">
        <div className="next-workout-label">Il tuo prossimo allenamento è</div>
        <input
          type="text"
          value={nextWorkout}
          onChange={(e) => { setNextWorkout(e.target.value); handleSave({ nextWorkout: e.target.value }); }}
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
      {showFirstLoginModal && (
        <div className="first-login-modal-overlay">
          <div className="first-login-modal">
            <div className="first-login-icon">
              <Dumbbell size={48} />
            </div>
            <h2>Benvenuto in Kuma Powerlifting!</h2>
            <p>Prima di iniziare, inserisci i tuoi massimali attuali (Squat, Bench Press, Deadlift) nella sezione <strong>Personal Record</strong>.</p>
            <p>Questo è necessario per calcolare il tuo totale e posizionarti in classifica.</p>
            <button className="first-login-btn" onClick={() => { setShowFirstLoginModal(false); setCurrentPage('Me'); }}>
              Vai a Personal Record
            </button>
          </div>
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
