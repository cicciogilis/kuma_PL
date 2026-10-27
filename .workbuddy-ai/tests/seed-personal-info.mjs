// Crea/ripristina gli utenti QA usati dai test E2E (le regole RTDB sono aperte).
const DB = 'https://sbd-ladder-default-rtdb.europe-west1.firebasedatabase.app';

const bcrypt = (await import('file:///C:/Users/franc/OneDrive/Desktop/Cartelle/Sviluppo/Progetti/App%20Kuma%20CiccioBart/kuma_PL/node_modules/bcryptjs/index.js')).default;

const PASSWORD = 'QaTest1234';
const hash = bcrypt.hashSync(PASSWORD, 8);

const users = {
  // Profilo completo: non deve mai passare da "Informazioni personali".
  qa_switch_test: {
    username: 'qa_switch_test',
    firstName: 'Marco',
    lastName: 'Moscheo',
    birthDate: '1990-05-12',
    birthCity: 'Roma',
    birthProvince: 'RM',
    gender: 'M',
    firstLogin: false,
    showUsernameOnLeaderboard: true,
  },
  // Manca la provincia + richiesta configurazione iniziale:
  // deve passare da "Informazioni personali" e POI vedere il benvenuto.
  qa_info_incomplete: {
    username: 'qa_info_incomplete',
    firstName: 'Luca',
    lastName: 'Bianchi',
    birthDate: '1995-03-08',
    birthCity: 'Torino',
    birthProvince: '',
    gender: 'M',
    firstLogin: true,
    showUsernameOnLeaderboard: false,
  },
  // Nessun dato anagrafico (profilo storico): tutti e 6 i campi da compilare,
  // nessun benvenuto perché firstLogin è false.
  qa_info_empty: {
    username: 'qa_info_empty',
    s: 100,
    b: 60,
    d: 140,
    firstLogin: false,
    showUsernameOnLeaderboard: false,
  },
};

for (const [key, data] of Object.entries(users)) {
  const res = await fetch(`${DB}/users/${key}.json`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: hash, ...data }),
  });
  console.log(key, '->', res.status);
}

console.log('password:', PASSWORD);
