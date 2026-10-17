import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, set, get, update, query, orderByChild } from 'firebase/database';
import './App.css';
import bcrypt from 'bcryptjs';
import PasswordInput from './PasswordInput';
import { User, Trophy, Settings } from 'lucide-react';
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
  
  useEffect(() => {
    // Controlla se ci sono credenziali salvate nel localStorage
    const savedUsername = localStorage.getItem('username');
    const savedPassword = localStorage.getItem('password');
    if (savedUsername && savedPassword) {
      setUsername(savedUsername);
      setPassword(savedPassword);
      handleLogin(null, savedUsername, savedPassword);
    }
  }, []);

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
        setCurrentPage('Me');
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
        bw: ''
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
    await update(userRef, {
      s: bottomNumbers[0] || null,
      b: bottomNumbers[1] || null,
      d: bottomNumbers[2] || null,
      sObj: topNumbers[0] || null,
      bObj: topNumbers[1] || null,
      dObj: topNumbers[2] || null,
      bw: bw || null,
      gender: gender || null
    });
    alert('Dati salvati con successo');
  };

  const loadLeaderboard = async () => {
    const usersRef = ref(db, 'users');
    const snapshot = await get(usersRef);
    const leaderboardData = [];
    snapshot.forEach((childSnapshot) => {
      const userData = childSnapshot.val();
      leaderboardData.push({
        username: userData.username,
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

  const renderLoginPage = () => (
    <div className="login-page">
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

  const renderMePage = () => (
    <>
      <h2>Benvenuto, {username}!</h2>
      <div className="section-title">OBIETTIVI:</div>
      <div className="section">
        <div className="column">
          <div className="label">S</div>
          <input
            type="number"
            value={topNumbers[0]}
            onChange={(e) => handleNumberChange(0, true, e.target.value)}
            className="number-input"
          />
          <div className="label">D</div>
          <input
            type="number"
            value={topNumbers[2]}
            onChange={(e) => handleNumberChange(2, true, e.target.value)}
            className="number-input"
          />
        </div>
        <div className="column">
          <div className="label">B</div>
          <input
            type="number"
            value={topNumbers[1]}
            onChange={(e) => handleNumberChange(1, true, e.target.value)}
            className="number-input"
          />
          <div className="label">T</div>
          <input
            type="number"
            value={topNumbers[3]}
            readOnly
            className="number-input"
          />
        </div>
      </div>
      <div className="section-title">PR:</div>
      <div className="section">
        <div className="column">
          <div className="label">S</div>
          <input
            type="number"
            value={bottomNumbers[0]}
            onChange={(e) => handleNumberChange(0, false, e.target.value)}
            className="number-input"
          />
          <div className="percentage-item">
            <div
              className="percentage-bar"
              style={{
                width: `${percentages[0] || 0}%`,
                backgroundColor: getColor(percentages[0] || 0),
              }}
            ></div>
            <span className="percentage-text">{percentages[0] ? `${percentages[0].toFixed(2)}%` : ''}</span>
          </div>
          <div className="label">D</div>
          <input
            type="number"
            value={bottomNumbers[2]}
            onChange={(e) => handleNumberChange(2, false, e.target.value)}
            className="number-input"
          />
          <div className="percentage-item">
            <div
              className="percentage-bar"
              style={{
                width: `${percentages[2] || 0}%`,
                backgroundColor: getColor(percentages[2] || 0),
              }}
            ></div>
            <span className="percentage-text">{percentages[2] ? `${percentages[2].toFixed(2)}%` : ''}</span>
          </div>
        </div>
        <div className="column">
          <div className="label">B</div>
          <input
            type="number"
            value={bottomNumbers[1]}
            onChange={(e) => handleNumberChange(1, false, e.target.value)}
            className="number-input"
          />
          <div className="percentage-item">
            <div
              className="percentage-bar"
              style={{
                width: `${percentages[1] || 0}%`,
                backgroundColor: getColor(percentages[1] || 0),
              }}
            ></div>
            <span className="percentage-text">{percentages[1] ? `${percentages[1].toFixed(2)}%` : ''}</span>
          </div>
          <div className="label">T</div>
          <input
            type="number"
            value={bottomNumbers[3]}
            readOnly
            className="number-input"
          />
          <div className="percentage-item">
            <div
              className="percentage-bar"
              style={{
                width: `${percentages[3] || 0}%`,
                backgroundColor: getColor(percentages[3] || 0),
              }}
            ></div>
            <span className="percentage-text">{percentages[3] ? `${percentages[3].toFixed(2)}%` : ''}</span>
          </div>
        </div>
      </div>
      <div className="bw-gender-container">
        <div className="bw-input">
          <div className="label">BW</div>
          <input
            type="number"
            value={bw}
            onChange={(e) => setBw(e.target.value)}
            className="number-input"
          />
        </div>
        <div className="gender-input">
          <div className="label">Genere</div>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="gender-select"
          >
            <option value="">Seleziona</option>
            <option value="M">M</option>
            <option value="F">F</option>
          </select>
        </div>
      </div>
      <button onClick={handleSave} className="save-button">Salva</button>
    </>
  );

  const renderLeaderboardPage = () => (
    <div className="leaderboard">
      <LeaderboardWithSorting data={leaderboardData} />
    </div>
  );

  return (
    <div className="app">
      {currentPage === 'Login' && renderLoginPage()}
      {currentPage === 'Me' && renderMePage()}
      {currentPage === 'Leaderboard' && renderLeaderboardPage()}
      {currentPage === 'Profile' && renderProfilePage()}
      {currentPage !== 'Login' && (
        <div className="menu-bar">
          <button onClick={() => setCurrentPage('Me')}>
            <User size={24} />
          </button>
          <button onClick={() => setCurrentPage('Leaderboard')}>
            <Trophy size={24} />
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
