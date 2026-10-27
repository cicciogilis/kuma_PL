// Seed a throwaway QA user directly in Firebase RTDB (rules are open).
const DB = 'https://sbd-ladder-default-rtdb.europe-west1.firebasedatabase.app';
const username = 'qa_switch_test';

const bcrypt = (await import('file:///C:/Users/franc/OneDrive/Desktop/Cartelle/Sviluppo/Progetti/App%20Kuma%20CiccioBart/kuma_PL/node_modules/bcryptjs/index.js')).default;
const hash = bcrypt.hashSync('QaTest1234', 8);

const payload = {
  username,
  password: hash,
  firstName: 'Marco',
  lastName: 'Moscheo',
  birthDate: '1990-05-12',
  birthCity: 'Roma',
  birthProvince: 'RM',
  gender: 'M',
  firstLogin: false,
  showUsernameOnLeaderboard: true,
};

const res = await fetch(`${DB}/users/${username}.json`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});
console.log('seed status', res.status, await res.text());
