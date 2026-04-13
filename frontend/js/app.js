/* ============================================================
   SHIFT MANAGER — Frontend Application
   ============================================================ */

const API = {
  async request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch('/api' + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'שגיאה בשרת');
    return data;
  },
  get: (path) => API.request('GET', path),
  post: (path, body) => API.request('POST', path, body),
  delete: (path) => API.request('DELETE', path)
};

// ===== STATE =====
let currentUser = null;
let currentWeekStart = getWeekStart(new Date());
let myWeekStart = getWeekStart(new Date());

// ===== UTILS =====
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 6=Sat
  // Week starts on Sunday in Israel
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date) {
  const d = new Date(date);
  return d.toISOString().split('T')[0];
}

function formatDateHebrew(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

function getWeekEnd(weekStart) {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

function formatWeekLabel(weekStart) {
  const end = getWeekEnd(weekStart);
  const opts = { day: 'numeric', month: 'long' };
  return `${weekStart.toLocaleDateString('he-IL', opts)} – ${end.toLocaleDateString('he-IL', opts)}`;
}

function isToday(dateStr) {
  return dateStr === formatDate(new Date());
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3000);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function getInitials(name) {
  return name ? name.charAt(0).toUpperCase() : '?';
}

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// ===== NAVIGATION =====
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const view = document.getElementById('view-' + viewId);
  if (view) view.classList.add('active');

  const navItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
  if (navItem) navItem.classList.add('active');
}

// ===== LOGIN =====
async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  hideError('login-error');

  if (!username) { showError('login-error', 'נא להזין שם משתמש'); return; }
  if (!password) { showError('login-error', 'נא להזין סיסמה'); return; }

  try {
    const user = await API.post('/auth/login', { username, password });
    currentUser = user;
    initApp();
  } catch (e) {
    showError('login-error', e.message);
  }
}

// ===== INIT APP =====
function initApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');

  // Sidebar user info
  document.getElementById('sidebar-username').textContent = currentUser.isAdmin ? 'מנהל' : 'עובד';
  document.getElementById('user-display-name').textContent = currentUser.username;
  document.getElementById('user-role-label').textContent = currentUser.isAdmin ? 'מנהל מערכת' : 'עובד';
  document.getElementById('user-avatar-initials').textContent = getInitials(currentUser.username);

  // Admin-only nav items
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('hidden', !currentUser.isAdmin);
  });

  // Switch to weekly view
  switchView('weekly');
  loadWeeklyView();
}

// ===== LOGOUT =====
async function handleLogout() {
  await API.post('/auth/logout');
  currentUser = null;
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  hideError('login-error');
}

// ===== WEEKLY VIEW =====
async function loadWeeklyView() {
  const weekEnd = getWeekEnd(currentWeekStart);
  document.getElementById('week-label').textContent = formatWeekLabel(currentWeekStart);

  let activities = [];
  try {
    activities = await API.get(`/activities?week_start=${formatDate(currentWeekStart)}&week_end=${formatDate(weekEnd)}`);
  } catch (e) { showToast(e.message, 'error'); }

  // Build 7-day grid
  const grid = document.getElementById('week-grid');
  grid.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const day = new Date(currentWeekStart);
    day.setDate(day.getDate() + i);
    const dayStr = formatDate(day);
    const dayActivities = activities.filter(a => a.date === dayStr);

    const col = document.createElement('div');
    col.className = 'day-column' + (isToday(dayStr) ? ' today' : '');
    col.innerHTML = `
      <div class="day-header">
        <div class="day-name">${DAYS_HE[day.getDay()]}</div>
        <div class="day-date">${day.getDate()}</div>
      </div>
      <div class="day-activities" id="day-${dayStr}"></div>
    `;
    grid.appendChild(col);

    const dayEl = document.getElementById('day-' + dayStr);
    if (dayActivities.length === 0) {
      dayEl.innerHTML = '<div class="empty-day">אין פעילויות</div>';
    } else {
      dayActivities.forEach(act => {
        const chip = buildActivityChip(act);
        dayEl.appendChild(chip);
      });
    }
  }
}

function buildActivityChip(act) {
  const div = document.createElement('div');
  div.className = 'activity-chip' + (act.user_registered ? ' registered' : '');
  div.innerHTML = `
    <div class="chip-title">${escapeHtml(act.title)}</div>
    <div class="chip-time">${act.start_time}–${act.end_time}</div>
    <div class="chip-tags">
      ${act.user_registered ? '<span class="chip-tag tag-registered">רשום ✓</span>' : ''}
      ${act.allow_overlap ? '<span class="chip-tag tag-overlap">חפיפה מותרת</span>' : ''}
      <span class="chip-tag tag-registered-count">${act.registrations_count || 0} רשומים</span>
    </div>
  `;
  div.addEventListener('click', () => openActivityModal(act.id));
  return div;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ===== ACTIVITY MODAL =====
let currentActivityId = null;

async function openActivityModal(activityId) {
  currentActivityId = activityId;
  try {
    const act = await API.get(`/activities/${activityId}`);
    document.getElementById('modal-title').textContent = act.title;
    document.getElementById('modal-date').textContent = formatDateHebrew(act.date);
    document.getElementById('modal-time').textContent = `${act.start_time} – ${act.end_time}`;
    document.getElementById('modal-overlap').textContent = act.allow_overlap ? '✅ מותרת' : '❌ לא מותרת';
    document.getElementById('modal-count').textContent = act.registrations.length + ' עובדים';

    const list = document.getElementById('modal-registered-list');
    list.innerHTML = act.registrations.length === 0
      ? '<span style="color:var(--text-3);font-size:13px">אין רשומים עדיין</span>'
      : act.registrations.map(r => `<span class="registered-pill">${escapeHtml(r.username)}</span>`).join('');

    const isRegistered = act.registrations.some(r => r.id === currentUser.id);
    const btn = document.getElementById('modal-register-btn');

    if (currentUser.isAdmin) {
      btn.className = 'btn btn-danger btn-full';
      btn.textContent = 'מחק פעילות';
      btn.onclick = async () => {
        if (!confirm('למחוק את הפעילות?')) return;
        try {
          await API.delete(`/activities/${activityId}`);
          closeModal();
          showToast('הפעילות נמחקה בהצלחה');
          loadWeeklyView();
          loadAdminActivities();
        } catch (e) { showToast(e.message, 'error'); }
      };
    } else if (isRegistered) {
      btn.className = 'btn btn-ghost btn-full';
      btn.textContent = 'בטל הרשמה';
      btn.onclick = async () => {
        try {
          await API.delete(`/registrations/${activityId}`);
          closeModal();
          showToast('הרשמה בוטלה בהצלחה');
          loadWeeklyView();
        } catch (e) { showToast(e.message, 'error'); }
      };
    } else {
      btn.className = 'btn btn-primary btn-full';
      btn.textContent = 'הרשם לפעילות';
      btn.onclick = async () => {
        try {
          await API.post('/registrations', { activity_id: activityId });
          closeModal();
          showToast('נרשמת לפעילות בהצלחה! ✅');
          loadWeeklyView();
        } catch (e) { showToast(e.message, 'error'); }
      };
    }

    document.getElementById('activity-modal').classList.remove('hidden');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function closeModal() {
  document.getElementById('activity-modal').classList.add('hidden');
  currentActivityId = null;
}

// ===== MY SCHEDULE VIEW =====
async function loadMySchedule() {
  const weekEnd = getWeekEnd(myWeekStart);
  document.getElementById('my-week-label').textContent = formatWeekLabel(myWeekStart);

  try {
    const activities = await API.get(`/registrations/my?week_start=${formatDate(myWeekStart)}&week_end=${formatDate(weekEnd)}`);
    const list = document.getElementById('my-activities-list');

    if (activities.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📅</div>
          <p>לא נרשמת לפעילויות בשבוע זה</p>
        </div>`;
      return;
    }

    list.innerHTML = activities.map(act => `
      <div class="activity-row">
        <div class="act-info">
          <div class="act-title">${escapeHtml(act.title)}</div>
          <div class="act-meta">
            <span>📅 ${formatDateHebrew(act.date)}</span>
            <span>🕐 ${act.start_time} – ${act.end_time}</span>
            ${act.allow_overlap ? '<span>🔀 חפיפה מותרת</span>' : ''}
          </div>
        </div>
        <button class="btn btn-ghost" onclick="unregisterFromMySchedule(${act.id})">בטל הרשמה</button>
      </div>
    `).join('');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function unregisterFromMySchedule(actId) {
  if (!confirm('לבטל הרשמה לפעילות זו?')) return;
  try {
    await API.delete(`/registrations/${actId}`);
    showToast('הרשמה בוטלה בהצלחה');
    loadMySchedule();
    loadWeeklyView();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

// ===== ADMIN: MANAGE ACTIVITIES =====
async function loadAdminActivities() {
  try {
    const activities = await API.get('/activities');
    const container = document.getElementById('admin-activities-list');

    if (activities.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>אין פעילויות במערכת</p></div>`;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>כותרת</th>
            <th>תאריך</th>
            <th>שעות</th>
            <th>חפיפה</th>
            <th>רשומים</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${activities.map(act => `
            <tr>
              <td class="td-title">${escapeHtml(act.title)}</td>
              <td>${formatDateShort(act.date)}</td>
              <td>${act.start_time} – ${act.end_time}</td>
              <td><span class="badge ${act.allow_overlap ? 'badge-overlap' : 'badge-no-overlap'}">${act.allow_overlap ? 'מותרת' : 'לא מותרת'}</span></td>
              <td>${act.registrations_count || 0}</td>
              <td>
                <button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deleteActivity(${act.id})">מחק</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteActivity(id) {
  if (!confirm('למחוק פעילות זו לצמיתות?')) return;
  try {
    await API.delete(`/activities/${id}`);
    showToast('הפעילות נמחקה בהצלחה');
    loadAdminActivities();
    loadWeeklyView();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function createActivity() {
  const title = document.getElementById('act-title').value.trim();
  const date = document.getElementById('act-date').value;
  const start_time = document.getElementById('act-start').value;
  const end_time = document.getElementById('act-end').value;
  const allow_overlap = document.getElementById('act-overlap').checked;
  hideError('create-act-error');

  if (!title || !date || !start_time || !end_time) {
    showError('create-act-error', 'נא למלא את כל השדות החובה');
    return;
  }

  try {
    await API.post('/activities', { title, date, start_time, end_time, allow_overlap });
    showToast('הפעילות נוצרה בהצלחה! ✅');
    document.getElementById('create-activity-form').classList.add('hidden');
    // Reset form
    ['act-title', 'act-date', 'act-start', 'act-end'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('act-overlap').checked = false;
    loadAdminActivities();
    loadWeeklyView();
  } catch (e) {
    showError('create-act-error', e.message);
  }
}

// ===== ADMIN: MANAGE USERS =====
async function loadUsers() {
  try {
    const users = await API.get('/users');
    const container = document.getElementById('users-list');

    if (users.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>אין משתמשים במערכת</p></div>`;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>שם משתמש</th>
            <th>תפקיד</th>
            <th>תאריך הצטרפות</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => `
            <tr>
              <td class="td-title">${escapeHtml(u.username)}</td>
              <td><span class="badge ${u.is_admin ? 'badge-admin' : 'badge-user'}">${u.is_admin ? 'מנהל' : 'עובד'}</span></td>
              <td>${new Date(u.created_at).toLocaleDateString('he-IL')}</td>
              <td>
                ${!u.is_admin ? `<button class="btn btn-danger" style="padding:6px 12px;font-size:12px" onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')">מחק</button>` : '<span style="color:var(--text-3);font-size:12px">לא ניתן למחוק</span>'}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteUser(id, username) {
  if (!confirm(`למחוק את המשתמש "${username}"?`)) return;
  try {
    await API.delete(`/users/${id}`);
    showToast(`המשתמש "${username}" נמחק בהצלחה`);
    loadUsers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function addUser() {
  const username = document.getElementById('new-username').value.trim();
  hideError('add-user-error');

  if (!username) { showError('add-user-error', 'נא להזין שם משתמש'); return; }

  try {
    await API.post('/users', { username });
    showToast(`המשתמש "${username}" נוסף בהצלחה! ✅`);
    document.getElementById('new-username').value = '';
    document.getElementById('add-user-form').classList.add('hidden');
    loadUsers();
  } catch (e) {
    showError('add-user-error', e.message);
  }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', async () => {
  // Check if already logged in
  try {
    const user = await API.get('/auth/me');
    currentUser = user;
    initApp();
  } catch (_) {
    // Not logged in, show login screen
  }

  // Login
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-username').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('login-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });

  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  // Nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
      if (view === 'weekly') loadWeeklyView();
      else if (view === 'my-schedule') loadMySchedule();
      else if (view === 'manage-activities') loadAdminActivities();
      else if (view === 'manage-users') loadUsers();
    });
  });

  // Weekly navigation
  document.getElementById('prev-week').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    loadWeeklyView();
  });
  document.getElementById('next-week').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    loadWeeklyView();
  });
  document.getElementById('today-btn').addEventListener('click', () => {
    currentWeekStart = getWeekStart(new Date());
    loadWeeklyView();
  });

  // My schedule navigation
  document.getElementById('my-prev-week').addEventListener('click', () => {
    myWeekStart.setDate(myWeekStart.getDate() - 7);
    loadMySchedule();
  });
  document.getElementById('my-next-week').addEventListener('click', () => {
    myWeekStart.setDate(myWeekStart.getDate() + 7);
    loadMySchedule();
  });
  document.getElementById('my-today-btn').addEventListener('click', () => {
    myWeekStart = getWeekStart(new Date());
    loadMySchedule();
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('activity-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('activity-modal')) closeModal();
  });

  // Create activity form toggle
  document.getElementById('show-create-activity-form').addEventListener('click', () => {
    document.getElementById('create-activity-form').classList.remove('hidden');
    // Set default date to today
    document.getElementById('act-date').value = formatDate(new Date());
  });
  document.getElementById('cancel-create-activity').addEventListener('click', () => {
    document.getElementById('create-activity-form').classList.add('hidden');
    hideError('create-act-error');
  });
  document.getElementById('create-activity-btn').addEventListener('click', createActivity);

  // Add user form toggle
  document.getElementById('show-add-user-form').addEventListener('click', () => {
    document.getElementById('add-user-form').classList.remove('hidden');
  });
  document.getElementById('cancel-add-user').addEventListener('click', () => {
    document.getElementById('add-user-form').classList.add('hidden');
    hideError('add-user-error');
  });
  document.getElementById('add-user-btn').addEventListener('click', addUser);
  document.getElementById('new-username').addEventListener('keydown', e => { if (e.key === 'Enter') addUser(); });
});
