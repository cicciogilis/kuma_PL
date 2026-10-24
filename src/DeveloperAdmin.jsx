import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { get, ref, set, update } from 'firebase/database';
import bcrypt from 'bcryptjs';
import {
  AlertTriangle,
  Camera,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import PasswordInput from './PasswordInput';

const normalizeUsername = (value = '') => value.toLowerCase().replace(/\s/g, '');

const roleLabel = (role) => (role === 'coach' ? 'Allenatore' : 'Utente');

const createForm = (user = {}) => ({
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  birthDate: user.birthDate || '',
  birthCity: user.birthCity || '',
  birthProvince: user.birthProvince || '',
  gender: user.gender || '',
  bw: user.bw ?? '',
  role: user.role === 'coach' ? 'coach' : 'user',
  showUsernameOnLeaderboard: Boolean(user.showUsernameOnLeaderboard),
  firstLogin: Boolean(user.firstLogin),
  disabled: Boolean(user.disabled),
  profilePhoto: user.profilePhoto || '',
});

const displayName = (user) =>
  [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username || user.key;

function DeveloperAdmin({
  db,
  currentUsername,
  onClose,
  onCurrentAccountDeleted,
  onCurrentUserUpdated,
}) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [mobileDetailTop, setMobileDetailTop] = useState(null);
  const [form, setForm] = useState(createForm());
  const listRef = useRef(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const currentKey = normalizeUsername(currentUsername);
  const selectedUser = users.find((user) => user.key === selectedKey) || null;

  const loadUsers = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const snapshot = await get(ref(db, 'users'));
      const nextUsers = [];
      snapshot.forEach((childSnapshot) => {
        const data = childSnapshot.val() || {};
        nextUsers.push({
          key: childSnapshot.key,
          username: data.username || childSnapshot.key,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          birthDate: data.birthDate || '',
          birthCity: data.birthCity || '',
          birthProvince: data.birthProvince || '',
          gender: data.gender || '',
          bw: data.bw ?? '',
          role: data.role === 'coach' ? 'coach' : 'user',
          showUsernameOnLeaderboard: Boolean(data.showUsernameOnLeaderboard),
          firstLogin: Boolean(data.firstLogin),
          disabled: Boolean(data.disabled),
          profilePhoto: data.profilePhoto || '',
        });
      });
      nextUsers.sort((a, b) => displayName(a).localeCompare(displayName(b), 'it'));
      setUsers(nextUsers);
      setSelectedKey((current) =>
        current && nextUsers.some((user) => user.key === current) ? current : null
      );
      setSelectedKeys((current) =>
        current.filter((key) => nextUsers.some((user) => user.key === key))
      );
    } catch (error) {
      console.error("Errore durante il caricamento degli utenti:", error);
      setLoadError('Impossibile caricare gli account. Controlla la connessione e riprova.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!selectedKey) {
      setMobileDetailTop(null);
      return undefined;
    }

    const updateTop = () => {
      if (!window.matchMedia('(max-width: 760px)').matches || !listRef.current) {
        setMobileDetailTop(null);
        return;
      }
      const listTop = listRef.current.getBoundingClientRect().top;
      setMobileDetailTop(Math.max(0, Math.round(listTop - 6)));
    };

    updateTop();
    window.addEventListener('resize', updateTop);
    return () => window.removeEventListener('resize', updateTop);
  }, [selectedKey]);

  const selectUser = (user) => {
    setSelectedKey(user.key);
    setForm(createForm(user));
    setNewPassword('');
    setConfirmPassword('');
    setNotice('');
    setActionError('');
  };

  const closeSelectedUser = () => {
    setSelectedKey(null);
    setForm(createForm());
    setNewPassword('');
    setConfirmPassword('');
    setNotice('');
    setActionError('');
  };

  const updateField = (field, value) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      updateField('profilePhoto', loadEvent.target.result);
      setActionError('');
      setNotice('Foto pronta: salva le modifiche per applicarla.');
    };
    reader.onerror = () => {
      setActionError("Impossibile leggere l'immagine selezionata.");
    };
    reader.readAsDataURL(file);
  };

  const saveUser = async (event) => {
    event.preventDefault();
    if (!selectedUser) return;

    if (form.birthCity.trim() && !form.birthProvince.trim()) {
      setActionError('Inserisci anche la provincia di nascita.');
      return;
    }
    if (form.birthProvince.trim() && !form.birthCity.trim()) {
      setActionError('Inserisci anche la città di nascita.');
      return;
    }

    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      const payload = {
        firstName: form.firstName.trim() || null,
        lastName: form.lastName.trim() || null,
        birthDate: form.birthDate || null,
        birthCity: form.birthCity.trim() || null,
        birthProvince: form.birthProvince.trim() || null,
        gender: form.gender || null,
        bw: form.bw === '' ? null : String(form.bw),
        role: form.role === 'coach' ? 'coach' : 'user',
        showUsernameOnLeaderboard: form.showUsernameOnLeaderboard,
        firstLogin: form.firstLogin,
        disabled: form.disabled,
        profilePhoto: form.profilePhoto || null,
      };
      await update(ref(db, `users/${selectedUser.key}`), payload);
      setUsers((previous) =>
        previous.map((user) =>
          user.key === selectedUser.key ? { ...user, ...payload } : user
        )
      );
      setNotice('Modifiche salvate.');
      if (selectedUser.key === currentKey) {
        onCurrentUserUpdated?.();
      }
    } catch (error) {
      console.error("Errore durante il salvataggio dell'utente:", error);
      setActionError("Impossibile salvare le modifiche. Controlla la connessione e riprova.");
    } finally {
      setSaving(false);
    }
  };

  const updateUserPassword = async () => {
    if (!selectedUser) return;

    if (!newPassword || !confirmPassword) {
      setActionError('Inserisci e conferma la nuova password.');
      return;
    }
    if (newPassword.length < 6) {
      setActionError('La nuova password deve contenere almeno 6 caratteri.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setActionError('Le due password non corrispondono.');
      return;
    }

    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await update(ref(db, `users/${selectedUser.key}`), { password: hashedPassword });
      if (selectedUser.key === currentKey) {
        localStorage.setItem('password', newPassword);
      }
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Password aggiornata.');
    } catch (error) {
      console.error("Errore durante l'aggiornamento della password:", error);
      setActionError("Impossibile aggiornare la password. Controlla la connessione e riprova.");
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async () => {
    if (!selectedUser) return;

    const label = displayName(selectedUser);
    const confirmed = window.confirm(
      `Eliminare definitivamente l'account "${label}"? Tutti i suoi dati verranno cancellati. Questa azione non può essere annullata.`
    );
    if (!confirmed) return;

    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      await set(ref(db, `users/${selectedUser.key}`), null);
      if (selectedUser.key === currentKey) {
        window.alert('Il tuo account è stato eliminato. Verrai disconnesso.');
        onCurrentAccountDeleted?.();
        return;
      }
      setUsers((previous) => previous.filter((user) => user.key !== selectedUser.key));
      setSelectedKeys((previous) => previous.filter((key) => key !== selectedUser.key));
      setSelectedKey(null);
      setForm(createForm());
      setNotice(`Account "${label}" eliminato.`);
    } catch (error) {
      console.error("Errore durante l'eliminazione dell'utente:", error);
      setActionError("Impossibile eliminare l'account. Controlla la connessione e riprova.");
    } finally {
      setSaving(false);
    }
  };

  const normalizedSearch = search.trim().toLowerCase();
  const filteredUsers = users.filter((user) =>
    [displayName(user), user.username, user.firstName, user.lastName]
      .join(' ')
      .toLowerCase()
      .includes(normalizedSearch)
  );

  const selectedUsers = users.filter((user) => selectedKeys.includes(user.key));
  const allSelectedHave = (field) =>
    selectedUsers.length > 0 && selectedUsers.every((user) => Boolean(user[field]));
  const someSelectedHave = (field) =>
    selectedUsers.some((user) => Boolean(user[field]));
  const allSelectedEnabled =
    selectedUsers.length > 0 && selectedUsers.every((user) => !user.disabled);
  const someSelectedEnabled = selectedUsers.some((user) => !user.disabled);
  const allVisibleSelected =
    filteredUsers.length > 0
    && filteredUsers.every((user) => selectedKeys.includes(user.key));

  const toggleUserSelection = (key) => {
    setSelectedKeys((previous) =>
      previous.includes(key)
        ? previous.filter((selected) => selected !== key)
        : [...previous, key]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleKeys = filteredUsers.map((user) => user.key);
    setSelectedKeys((previous) => {
      if (allVisibleSelected) {
        return previous.filter((key) => !visibleKeys.includes(key));
      }
      return [...new Set([...previous, ...visibleKeys])];
    });
  };

  const clearSelection = () => setSelectedKeys([]);

  const updateSelectedUsers = async (field, value) => {
    if (!selectedKeys.length) return;

    const keys = [...selectedKeys];
    const updates = {};
    keys.forEach((key) => {
      updates[`users/${key}/${field}`] = value;
    });

    setSaving(true);
    setNotice('');
    setActionError('');
    try {
      await update(ref(db), updates);
      setUsers((previous) =>
        previous.map((user) => (
          keys.includes(user.key) ? { ...user, [field]: value } : user
        ))
      );
      if (selectedKey && keys.includes(selectedKey)) {
        setForm((previous) => ({ ...previous, [field]: value }));
      }
      if (keys.includes(currentKey)) {
        onCurrentUserUpdated?.();
      }
      setNotice(`Aggiornati ${keys.length} account.`);
    } catch (error) {
      console.error('Errore durante la modifica multipla:', error);
      setActionError('Impossibile aggiornare gli account selezionati. Riprova.');
    } finally {
      setSaving(false);
    }
  };

  const coachCount = users.filter((user) => user.role === 'coach').length;
  const disabledCount = users.filter((user) => user.disabled).length;
  const message = loadError || actionError || notice;

  return (
    <div className="dev-admin-overlay">
      <div
        className="dev-admin-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dev-admin-title"
      >
        <header className="dev-admin-header">
          <div className="dev-admin-heading">
            <span className="dev-admin-heading-icon">
              <ShieldCheck size={24} />
            </span>
            <div>
              <h2 id="dev-admin-title">Super Admin</h2>
              <p>Gestione account, ruoli e credenziali</p>
            </div>
          </div>
          <div className="dev-admin-header-actions">
            <button
              type="button"
              className="dev-icon-button"
              onClick={loadUsers}
              aria-label="Aggiorna elenco account"
              title="Aggiorna elenco"
              disabled={loading || saving}
            >
              <RefreshCw size={18} />
            </button>
            <button
              type="button"
              className="dev-icon-button"
              onClick={onClose}
              aria-label="Chiudi Super Admin"
              title="Chiudi"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <div className="dev-admin-stats">
          <div className="dev-stat">
            <Users size={18} />
            <span><strong>{users.length}</strong> account</span>
          </div>
          <div className="dev-stat">
            <UserCog size={18} />
            <span><strong>{coachCount}</strong> allenatori</span>
          </div>
          <div className="dev-stat">
            <AlertTriangle size={18} />
            <span><strong>{disabledCount}</strong> disabilitati</span>
          </div>
        </div>

        {message && (
          <div
            className={`dev-admin-message ${loadError || actionError ? 'error' : 'success'}`}
            role="status"
          >
            {message}
          </div>
        )}

        {selectedKeys.length > 0 && (
          <div className="dev-bulk-panel">
            <div className="dev-bulk-header">
              <span><strong>{selectedKeys.length}</strong> account selezionati</span>
              <button
                type="button"
                className="dev-bulk-clear"
                onClick={clearSelection}
              >
                Deseleziona
              </button>
            </div>
            <div className="dev-bulk-grid">
              <label
                className={`dev-bulk-row${someSelectedHave('showUsernameOnLeaderboard') && !allSelectedHave('showUsernameOnLeaderboard') ? ' mixed' : ''}`}
                title="Applica a tutti gli account selezionati"
              >
                <span>Mostra username in classifica</span>
                <span className="dev-status-switch">
                  <input
                    type="checkbox"
                    checked={allSelectedHave('showUsernameOnLeaderboard')}
                    onChange={() => updateSelectedUsers(
                      'showUsernameOnLeaderboard',
                      !allSelectedHave('showUsernameOnLeaderboard')
                    )}
                    disabled={saving}
                  />
                  <span className="dev-status-slider" />
                </span>
              </label>
              <label
                className={`dev-bulk-row${someSelectedHave('firstLogin') && !allSelectedHave('firstLogin') ? ' mixed' : ''}`}
                title="Applica a tutti gli account selezionati"
              >
                <span>Richiedi configurazione iniziale</span>
                <span className="dev-status-switch">
                  <input
                    type="checkbox"
                    checked={allSelectedHave('firstLogin')}
                    onChange={() => updateSelectedUsers(
                      'firstLogin',
                      !allSelectedHave('firstLogin')
                    )}
                    disabled={saving}
                  />
                  <span className="dev-status-slider" />
                </span>
              </label>
              <label
                className={`dev-bulk-row${someSelectedEnabled && !allSelectedEnabled ? ' mixed' : ''}`}
                title="Attiva o disattiva l'accesso per tutti gli account selezionati"
              >
                <span>Account abilitati</span>
                <span className="dev-status-switch">
                  <input
                    type="checkbox"
                    checked={allSelectedEnabled}
                    onChange={() => updateSelectedUsers('disabled', allSelectedEnabled)}
                    disabled={saving}
                  />
                  <span className="dev-status-slider" />
                </span>
              </label>
            </div>
          </div>
        )}

        <div className={`dev-admin-body${selectedUser ? ' has-selected-user' : ''}`}>
          <aside className="dev-admin-list-pane">
            <label className="dev-search">
              <Search size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Cerca per nome o username"
                aria-label="Cerca account"
              />
            </label>
            <div className="dev-list-toolbar">
              <label className="dev-select-all">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                  disabled={loading || !filteredUsers.length}
                />
                <span>Seleziona tutti</span>
              </label>
              {selectedKeys.length > 0 && (
                <span className="dev-selected-count">
                  {selectedKeys.length} selezionati
                </span>
              )}
            </div>
            <div className="dev-user-list" ref={listRef}>
              {loading && <p className="dev-list-state">Caricamento account...</p>}
              {!loading && filteredUsers.length === 0 && (
                <p className="dev-list-state">Nessun account trovato.</p>
              )}
              {!loading && filteredUsers.map((user) => (
                <div
                  key={user.key}
                  className={`dev-user-item${selectedKey === user.key ? ' selected' : ''}${selectedKeys.includes(user.key) ? ' checked' : ''}`}
                >
                  <label className="dev-user-check">
                    <input
                      type="checkbox"
                      checked={selectedKeys.includes(user.key)}
                      onChange={() => toggleUserSelection(user.key)}
                      aria-label={`Seleziona ${displayName(user)}`}
                    />
                  </label>
                  <button
                    type="button"
                    className="dev-user-open"
                    onClick={() => selectUser(user)}
                  >
                    <span className="dev-user-avatar">
                      {user.profilePhoto ? (
                        <img src={user.profilePhoto} alt="" />
                      ) : (
                        (user.firstName || user.username || '?').charAt(0).toUpperCase()
                      )}
                    </span>
                    <span className="dev-user-copy">
                      <strong>{displayName(user)}</strong>
                      <small>@{user.username}</small>
                    </span>
                    <span className={`dev-role-badge ${user.role}`}>
                      {roleLabel(user.role)}
                    </span>
                    {user.disabled && <span className="dev-blocked-dot" title="Account disabilitato" />}
                  </button>
                </div>
              ))}
            </div>
          </aside>

          <section
            className={`dev-admin-detail${selectedUser ? ' detail-open' : ''}`}
            style={selectedUser && mobileDetailTop != null
              ? { top: `${mobileDetailTop}px` }
              : undefined}
          >
            {!selectedUser ? (
              <div className="dev-admin-empty">
                <UserCog size={44} />
                <h3>Seleziona un account</h3>
                <p>Scegli un utente dalla lista per modificarne i dati, il ruolo o la password.</p>
              </div>
            ) : (
              <>
                <div className="dev-detail-header">
                  <span className="dev-detail-avatar">
                    {form.profilePhoto ? (
                      <img src={form.profilePhoto} alt="" />
                    ) : (
                      (selectedUser.firstName || selectedUser.username || '?').charAt(0).toUpperCase()
                    )}
                  </span>
                  <div className="dev-detail-title">
                    <h3>{displayName(selectedUser)}</h3>
                    <p>@{selectedUser.username}</p>
                  </div>
                  <span className={`dev-role-badge ${selectedUser.role}`}>
                    {roleLabel(selectedUser.role)}
                  </span>
                  <button
                    type="button"
                    className="dev-detail-close"
                    onClick={closeSelectedUser}
                    aria-label="Torna alla lista utenti"
                    title="Torna alla lista utenti"
                  >
                    <X size={18} />
                  </button>
                </div>

                <form className="dev-detail-form" onSubmit={saveUser}>
                  <div className="dev-detail-section">
                    <h4>Informazioni personali</h4>
                    <div className="dev-photo-editor">
                      <span className="dev-photo-preview">
                        {form.profilePhoto ? (
                          <img src={form.profilePhoto} alt="Anteprima foto profilo" />
                        ) : (
                          <Camera size={24} />
                        )}
                      </span>
                      <div className="dev-photo-copy">
                        <strong>Foto profilo</strong>
                        <small>Carica un&apos;immagine e salva per applicarla.</small>
                        <div className="dev-photo-actions">
                          <label className="dev-photo-upload">
                            <Camera size={14} />
                            {form.profilePhoto ? 'Cambia foto' : 'Carica foto'}
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handlePhotoChange}
                            />
                          </label>
                          {form.profilePhoto && (
                            <button
                              type="button"
                              className="dev-photo-remove"
                              onClick={() => updateField('profilePhoto', '')}
                            >
                              Rimuovi
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="dev-form-grid">
                      <label className="dev-field">
                        <span className="info-label">Nome</span>
                        <input
                          className="info-input"
                          type="text"
                          value={form.firstName}
                          onChange={(event) => updateField('firstName', event.target.value)}
                          placeholder="Nome"
                        />
                      </label>
                      <label className="dev-field">
                        <span className="info-label">Cognome</span>
                        <input
                          className="info-input"
                          type="text"
                          value={form.lastName}
                          onChange={(event) => updateField('lastName', event.target.value)}
                          placeholder="Cognome"
                        />
                      </label>
                      <label className="dev-field">
                        <span className="info-label">Data di nascita</span>
                        <input
                          className="info-input"
                          type="date"
                          value={form.birthDate}
                          onChange={(event) => updateField('birthDate', event.target.value)}
                        />
                      </label>
                      <label className="dev-field">
                        <span className="info-label">Genere</span>
                        <select
                          className="info-select"
                          value={form.gender}
                          onChange={(event) => updateField('gender', event.target.value)}
                        >
                          <option value="">Seleziona</option>
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </label>
                      <label className="dev-field">
                        <span className="info-label">Città di nascita</span>
                        <input
                          className="info-input"
                          type="text"
                          value={form.birthCity}
                          onChange={(event) => updateField('birthCity', event.target.value)}
                          placeholder="Città di nascita"
                        />
                      </label>
                      <label className="dev-field">
                        <span className="info-label">Provincia</span>
                        <input
                          className="info-input"
                          type="text"
                          value={form.birthProvince}
                          onChange={(event) => updateField('birthProvince', event.target.value)}
                          placeholder="Provincia"
                        />
                      </label>
                      <label className="dev-field">
                        <span className="info-label">Peso corporeo (kg)</span>
                        <input
                          className="info-input"
                          type="number"
                          value={form.bw}
                          onChange={(event) => updateField('bw', event.target.value)}
                          placeholder="kg"
                        />
                      </label>
                      <label className="dev-field">
                        <span className="info-label">Ruolo profilo</span>
                        <select
                          className="info-select"
                          value={form.role}
                          onChange={(event) => updateField('role', event.target.value)}
                        >
                          <option value="user">Utente</option>
                          <option value="coach">Allenatore</option>
                        </select>
                      </label>
                    </div>
                    <p className="dev-note">
                      Le funzioni dedicate agli allenatori verranno abilitate nella prossima feature.
                    </p>
                    <div className="dev-toggle-list">
                      <label className="dev-toggle-row">
                        <span>
                          <strong>Mostra username in classifica</strong>
                          <small>Se disattivato vengono mostrati nome e cognome.</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={form.showUsernameOnLeaderboard}
                          onChange={(event) => updateField('showUsernameOnLeaderboard', event.target.checked)}
                        />
                      </label>
                      <label className="dev-toggle-row">
                        <span>
                          <strong>Richiedi configurazione iniziale</strong>
                          <small>Al prossimo accesso mostrerà di nuovo il benvenuto e i massimali.</small>
                        </span>
                        <input
                          type="checkbox"
                          checked={form.firstLogin}
                          onChange={(event) => updateField('firstLogin', event.target.checked)}
                        />
                      </label>
                      <label className={`dev-account-status ${form.disabled ? 'disabled' : 'enabled'}`}>
                        <span className="dev-account-status-copy">
                          <strong>{form.disabled ? 'Account disabilitato' : 'Account Abilitato'}</strong>
                          <small>
                            {form.disabled
                              ? "L'utente non può accedere."
                              : "L'utente può accedere normalmente."}
                          </small>
                        </span>
                        <span className="dev-status-switch">
                          <input
                            type="checkbox"
                            checked={!form.disabled}
                            onChange={(event) => updateField('disabled', !event.target.checked)}
                            aria-label="Account abilitato"
                          />
                          <span className="dev-status-slider" />
                        </span>
                      </label>
                    </div>
                    <div className="dev-form-actions">
                      <button
                        type="submit"
                        className="dev-primary-button"
                        disabled={saving}
                      >
                        <Save size={16} />
                        {saving ? 'Salvataggio...' : 'Salva modifiche'}
                      </button>
                    </div>
                  </div>
                </form>

                <div className="dev-detail-section">
                  <h4>Cambia password</h4>
                  <div className="dev-password-grid">
                    <PasswordInput
                      value={newPassword}
                      onChange={(event) => setNewPassword(event.target.value)}
                      placeholder="Nuova password"
                    />
                    <PasswordInput
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      placeholder="Conferma password"
                    />
                  </div>
                  <button
                    type="button"
                    className="dev-secondary-button"
                    onClick={updateUserPassword}
                    disabled={saving}
                  >
                    Aggiorna password
                  </button>
                </div>

                <div className="dev-danger-zone">
                  <div>
                    <h4>ELIMINAZIONE ACCOUNT</h4>
                    <p>L&apos;eliminazione cancella definitivamente l&apos;account e tutti i suoi dati.</p>
                  </div>
                  <button
                    type="button"
                    className="dev-danger-button"
                    onClick={deleteUser}
                    disabled={saving}
                  >
                    <Trash2 size={16} />
                    Elimina account
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

DeveloperAdmin.propTypes = {
  db: PropTypes.object.isRequired,
  currentUsername: PropTypes.string,
  onClose: PropTypes.func.isRequired,
  onCurrentAccountDeleted: PropTypes.func,
  onCurrentUserUpdated: PropTypes.func,
};

export default DeveloperAdmin;
