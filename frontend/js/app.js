/* ============================================================
   SHIFT MANAGER — Frontend Application v3
   ============================================================ */

const API = {
  async request(method, path, body) {
    const opts = { method, headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin' };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res  = await fetch('/api' + path, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'שגיאה בשרת');
    return data;
  },
  get:    p      => API.request('GET',    p),
  post:   (p, b) => API.request('POST',   p, b),
  delete: p      => API.request('DELETE', p)
};

// ===== STATE =====
let currentUser      = null;
let currentWeekStart = getWeekStart(new Date());
let weeklyTab        = 'future';   // 'future' | 'past'
let myTab            = 'future';
let adminActTab      = 'future';

// ===== UTILS =====
function getWeekStart(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDateHebrew(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function formatDateShort(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
}

function getWeekEnd(ws) {
  const d = new Date(ws);
  d.setDate(d.getDate() + 6);
  return d;
}

function formatWeekLabel(ws) {
  const end = getWeekEnd(ws);
  const opts = { day: 'numeric', month: 'long' };
  return `${ws.toLocaleDateString('he-IL', opts)} – ${end.toLocaleDateString('he-IL', opts)}`;
}

function todayStr() { return formatDate(new Date()); }

function isPastDate(dateStr) { return dateStr < todayStr(); }

function isToday(dateStr) { return dateStr === todayStr(); }

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(String(str || '')));
  return d.innerHTML;
}

function getInitials(name) { return name ? name.charAt(0).toUpperCase() : '?'; }

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 3500);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
}

function hideError(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

const DAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// ===== NAVIGATION =====
function switchView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('view-' + viewId)?.classList.add('active');
  document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
}

// ===== LOGIN =====
async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  hideError('login-error');
  if (!username) { showError('login-error', 'נא להזין שם משתמש'); return; }
  try {
    currentUser = await API.post('/auth/login', { username });
    initApp();
  } catch (e) { showError('login-error', e.message); }
}

function initApp() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');
  document.getElementById('sidebar-username').textContent     = currentUser.isAdmin ? 'מנהל' : 'עובד';
  document.getElementById('user-display-name').textContent    = currentUser.username;
  document.getElementById('user-role-label').textContent      = currentUser.isAdmin ? 'מנהל מערכת' : 'עובד';
  document.getElementById('user-avatar-initials').textContent = getInitials(currentUser.username);
  document.querySelectorAll('.admin-only').forEach(el =>
    el.classList.toggle('hidden', !currentUser.isAdmin)
  );
  switchView('weekly');
  setWeeklyTab('future');
}

async function handleLogout() {
  await API.post('/auth/logout');
  currentUser = null;
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
  document.getElementById('login-username').value = '';
  hideError('login-error');
}

// ===== WEEKLY VIEW TABS =====
function setWeeklyTab(tab) {
  weeklyTab = tab;
  document.getElementById('weekly-tab-future').classList.toggle('active', tab === 'future');
  document.getElementById('weekly-tab-past').classList.toggle('active', tab === 'past');
  document.getElementById('weekly-future-content').classList.toggle('hidden', tab !== 'future');
  document.getElementById('weekly-past-content').classList.toggle('hidden', tab !== 'past');
  document.getElementById('week-controls').classList.toggle('hidden', tab !== 'future');

  if (tab === 'future') loadWeeklyView();
  else loadWeeklyPast();
}

// ===== WEEKLY FUTURE — calendar grid =====
async function loadWeeklyView() {
  const weekEnd = getWeekEnd(currentWeekStart);
  document.getElementById('week-label').textContent = formatWeekLabel(currentWeekStart);

  let activities = [];
  try {
    activities = await API.get(
      `/activities?week_start=${formatDate(currentWeekStart)}&week_end=${formatDate(weekEnd)}`
    );
  } catch (e) { showToast(e.message, 'error'); }

  const grid = document.getElementById('week-grid');
  grid.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const day = new Date(currentWeekStart);
    day.setDate(day.getDate() + i);
    const dayStr = formatDate(day);
    const dayActs = activities.filter(a => a.date === dayStr);

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
    if (dayActs.length === 0) {
      dayEl.innerHTML = '<div class="empty-day">אין פעילויות</div>';
    } else {
      dayActs.forEach(act => dayEl.appendChild(buildActivityChip(act, false)));
    }
  }
}

// ===== WEEKLY PAST — flat list =====
async function loadWeeklyPast() {
  const container = document.getElementById('weekly-past-list');
  container.innerHTML = '<div class="loading-msg">טוען...</div>';
  try {
    const activities = await API.get('/activities?period=past');
    renderActivitiesList(container, activities, true);
  } catch (e) { showToast(e.message, 'error'); }
}

// ===== CHIP (calendar) =====
function buildActivityChip(act, isPast) {
  const names = act.registered_names
    ? act.registered_names.split(', ').slice(0, 3)
    : [];
  const extra = (act.registrations_count || 0) - names.length;

  const div = document.createElement('div');
  div.className = 'activity-chip' + (act.user_registered ? ' registered' : '') + (isPast ? ' past' : '');
  div.innerHTML = `
    <div class="chip-title">${escapeHtml(act.title)}</div>
    <div class="chip-time">${act.start_time}–${act.end_time}</div>
    <div class="chip-names">
      ${names.length > 0
        ? names.map(n => `<span class="chip-name">${escapeHtml(n)}</span>`).join('') +
          (extra > 0 ? `<span class="chip-name chip-name-more">+${extra}</span>` : '')
        : '<span class="chip-name chip-name-empty">אין רשומים</span>'
      }
    </div>
    <div class="chip-tags">
      ${act.user_registered ? '<span class="chip-tag tag-registered">רשום ✓</span>' : ''}
      ${act.allow_overlap        ? '<span class="chip-tag tag-overlap">חפיפה</span>' : ''}
      ${act.lock_unregistration  ? '<span class="chip-tag tag-lock">🔒</span>'       : ''}
    </div>
  `;
  div.addEventListener('click', () => openActivityModal(act.id, isPast));
  return div;
}

// ===== FLAT ACTIVITY ROW (lists) =====
function renderActivitiesList(container, activities, isPast, showUnregister = false) {
  if (activities.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${isPast ? '🕐' : '📅'}</div>
        <p>${isPast ? 'אין פעילויות עבר' : 'אין פעילויות עתידיות'}</p>
      </div>`;
    return;
  }

  container.innerHTML = activities.map(act => {
    const names = act.registered_names ? act.registered_names.split(', ') : [];
    return `
      <div class="activity-row ${isPast ? 'past' : ''}">
        <div class="act-info" style="cursor:pointer" onclick="openActivityModal(${act.id}, ${isPast})">
          <div class="act-title">${escapeHtml(act.title)}</div>
          <div class="act-meta">
            <span>📅 ${formatDateHebrew(act.date)}</span>
            <span>🕐 ${act.start_time} – ${act.end_time}</span>
            ${act.allow_overlap ? '<span>🔀 חפיפה מותרת</span>' : ''}
          </div>
          <div class="act-registered-names">
            ${names.length > 0
              ? names.map(n => `<span class="name-pill">${escapeHtml(n)}</span>`).join('')
              : '<span style="font-size:12px;color:var(--text-3)">אין רשומים</span>'
            }
          </div>
        </div>
        ${showUnregister && !isPast
          ? act.lock_unregistration
            ? `<span class="lock-badge">🔒 נעול</span>`
            : `<button class="btn btn-ghost" onclick="unregisterActivity(${act.id})">בטל הרשמה</button>`
          : ''
        }
      </div>
    `;
  }).join('');
}

// ===== MY SCHEDULE TABS =====
function setMyTab(tab) {
  myTab = tab;
  document.getElementById('my-tab-future').classList.toggle('active', tab === 'future');
  document.getElementById('my-tab-past').classList.toggle('active', tab === 'past');
  document.getElementById('my-future-content').classList.toggle('hidden', tab !== 'future');
  document.getElementById('my-past-content').classList.toggle('hidden', tab !== 'past');
  if (tab === 'future') loadMyFuture();
  else loadMyPast();
}

async function loadMySchedule() { setMyTab(myTab); }

async function loadMyFuture() {
  const container = document.getElementById('my-future-list');
  container.innerHTML = '<div class="loading-msg">טוען...</div>';
  try {
    const activities = await API.get('/registrations/my?period=future');
    renderActivitiesList(container, activities, false, true);
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadMyPast() {
  const container = document.getElementById('my-past-list');
  container.innerHTML = '<div class="loading-msg">טוען...</div>';
  try {
    const activities = await API.get('/registrations/my?period=past');
    renderActivitiesList(container, activities, true, false);
  } catch (e) { showToast(e.message, 'error'); }
}

async function unregisterActivity(actId) {
  if (!confirm('לבטל הרשמה לפעילות זו?')) return;
  try {
    await API.delete(`/registrations/${actId}`);
    showToast('הרשמה בוטלה בהצלחה');
    loadMyFuture();
    loadWeeklyView();
  } catch (e) { showToast(e.message, 'error'); }
}

// ===== ACTIVITY MODAL =====
let currentActivityId = null;

async function openActivityModal(activityId, isPast = false) {
  currentActivityId = activityId;
  hideError('assign-error');

  try {
    const act = await API.get(`/activities/${activityId}`);
    const pastActivity = isPast || isPastDate(act.date);
    const isLocked     = act.lock_unregistration === 1;

    // Safe helper — avoids null crashes if element missing
    function setText(id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }

    setText('modal-title',   act.title);
    setText('modal-date',    formatDateHebrew(act.date));
    setText('modal-time',    `${act.start_time} – ${act.end_time}`);
    setText('modal-overlap', act.allow_overlap ? '✅ מותרת' : '❌ לא מותרת');
    setText('modal-lock',    isLocked ? '🔒 נעול — משתמש לא יכול לבטל' : '🔓 פתוח');

    // Capacity display
    const cap     = act.capacity;
    const regCount = act.registrations.length;
    const isFull  = cap != null && regCount >= cap;
    if (cap != null) {
      setText('modal-count', `${regCount} / ${cap} משתתפים${isFull ? ' — מלא' : ''}`);
    } else {
      setText('modal-count', regCount + ' משתתפים');
    }

    // Notes
    const notesSection = document.getElementById('modal-notes-section');
    const notesText    = document.getElementById('modal-notes-text');
    if (act.notes && act.notes.trim()) {
      if (notesSection) notesSection.classList.remove('hidden');
      if (notesText)    notesText.textContent = act.notes;
    } else {
      if (notesSection) notesSection.classList.add('hidden');
    }

    renderRegisteredList(act.registrations, activityId);

    if (currentUser.isAdmin) {
      // Admin — show assignment panel, hide user register button
      document.getElementById('modal-admin-panel').classList.remove('hidden');
      document.getElementById('modal-footer-user').classList.add('hidden');
      document.getElementById('modal-footer-admin').classList.remove('hidden');
      await loadAvailableUsers(activityId);
      document.getElementById('modal-delete-btn').onclick = () => deleteActivityFromModal(activityId);
      document.getElementById('modal-edit-btn').onclick   = () => openEditModal(act);

    } else {
      // Regular user
      document.getElementById('modal-admin-panel').classList.add('hidden');
      document.getElementById('modal-footer-admin').classList.add('hidden');
      document.getElementById('modal-footer-user').classList.remove('hidden');

      const btn          = document.getElementById('modal-register-btn');
      const isRegistered = act.registrations.some(r => r.id === currentUser.id);

      // Reset button state
      btn.disabled          = false;
      btn.style.opacity     = '1';
      btn.style.cursor      = 'pointer';
      btn.style.pointerEvents = 'auto';

      if (pastActivity) {
        btn.className   = 'btn btn-ghost btn-full';
        btn.textContent = '🕐 פעילות זו כבר התקיימה';
        btn.disabled    = true;
        btn.style.opacity = '0.5';
        btn.onclick     = null;

      } else if (isRegistered && isLocked) {
        btn.className        = 'btn btn-ghost btn-full';
        btn.textContent      = '🔒 לא ניתן לבטל הרשמה לפעילות זו';
        btn.disabled         = true;
        btn.style.opacity    = '0.6';
        btn.style.cursor     = 'not-allowed';
        btn.style.pointerEvents = 'none';
        btn.onclick          = null;

      } else if (isRegistered) {
        btn.className   = 'btn btn-ghost btn-full';
        btn.textContent = 'בטל הרשמה';
        btn.onclick     = async () => {
          try {
            await API.delete(`/registrations/${activityId}`);
            closeModal();
            showToast('הרשמה בוטלה בהצלחה');
            loadWeeklyView();
            if (myTab === 'future') loadMyFuture();
          } catch (e) { showToast(e.message, 'error'); }
        };

      } else if (isFull) {
        btn.className        = 'btn btn-ghost btn-full';
        btn.textContent      = '🈵 הפעילות מלאה';
        btn.disabled         = true;
        btn.style.opacity    = '0.6';
        btn.style.cursor     = 'not-allowed';
        btn.style.pointerEvents = 'none';
        btn.onclick          = null;

      } else {
        btn.className   = 'btn btn-primary btn-full';
        btn.textContent = 'הרשם לפעילות';
        btn.onclick     = async () => {
          try {
            await API.post('/registrations', { activity_id: activityId });
            closeModal();
            showToast('נרשמת לפעילות בהצלחה! ✅');
            loadWeeklyView();
            if (myTab === 'future') loadMyFuture();
          } catch (e) { showToast(e.message, 'error'); }
        };
      }
    }

    document.getElementById('activity-modal').classList.remove('hidden');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function renderRegisteredList(registrations, activityId) {
  const list = document.getElementById('modal-registered-list');
  if (registrations.length === 0) {
    list.innerHTML = '<span style="color:var(--text-3);font-size:13px">אין עובדים משובצים עדיין</span>';
    return;
  }
  if (currentUser.isAdmin) {
    list.innerHTML = registrations.map(r => `
      <div class="assigned-row">
        <span class="registered-pill">${escapeHtml(r.username)}</span>
        <button class="btn-remove-assigned" onclick="removeAssignment(${activityId}, ${r.id})">
          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `).join('');
  } else {
    list.innerHTML = registrations.map(r =>
      `<span class="registered-pill">${escapeHtml(r.username)}</span>`
    ).join('');
  }
}

async function loadAvailableUsers(activityId) {
  try {
    const users = await API.get(`/assignments/available/${activityId}`);
    const sel = document.getElementById('assign-user-select');
    sel.innerHTML = users.length === 0
      ? '<option value="">— כל העובדים כבר משובצים —</option>'
      : '<option value="">— בחר עובד לשיבוץ —</option>' +
        users.map(u => `<option value="${u.id}">${escapeHtml(u.username)}</option>`).join('');
  } catch (e) { console.error(e); }
}

async function assignUser() {
  const userId = document.getElementById('assign-user-select').value;
  hideError('assign-error');
  if (!userId) { showError('assign-error', 'נא לבחור עובד מהרשימה'); return; }
  try {
    const res = await API.post('/assignments', { user_id: parseInt(userId), activity_id: currentActivityId });
    showToast(res.message + ' ✅');
    const act = await API.get(`/activities/${currentActivityId}`);
    const countEl = document.getElementById('modal-count');
    if (countEl) countEl.textContent = act.registrations.length + ' עובדים';
    renderRegisteredList(act.registrations, currentActivityId);
    await loadAvailableUsers(currentActivityId);
    loadWeeklyView();
    if (document.getElementById('view-manage-activities')?.classList.contains('active')) {
      loadAdminActivities();
    }
  } catch (e) { showError('assign-error', e.message); }
}

async function removeAssignment(activityId, userId) {
  try {
    const res = await API.delete(`/assignments/${activityId}/${userId}`);
    showToast(res.message);
    const act = await API.get(`/activities/${activityId}`);
    const countEl = document.getElementById('modal-count');
    if (countEl) countEl.textContent = act.registrations.length + ' עובדים';
    renderRegisteredList(act.registrations, activityId);
    await loadAvailableUsers(activityId);
    loadWeeklyView();
    if (document.getElementById('view-manage-activities')?.classList.contains('active')) {
      loadAdminActivities();
    }
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteActivityFromModal(activityId) {
  if (!confirm('למחוק את הפעילות לצמיתות?')) return;
  try {
    await API.delete(`/activities/${activityId}`);
    closeModal();
    showToast('הפעילות נמחקה בהצלחה');
    loadWeeklyView();
    loadAdminActivities();
  } catch (e) { showToast(e.message, 'error'); }
}

function closeModal() {
  document.getElementById('activity-modal').classList.add('hidden');
  currentActivityId = null;
  hideError('assign-error');
}

// ===== ADMIN: MANAGE ACTIVITIES TABS =====
function setAdminActTab(tab) {
  adminActTab = tab;
  document.getElementById('admin-act-tab-future').classList.toggle('active', tab === 'future');
  document.getElementById('admin-act-tab-past').classList.toggle('active', tab === 'past');
  loadAdminActivities();
}

async function loadAdminActivities() {
  try {
    const activities = await API.get(`/activities?period=${adminActTab}`);
    const container  = document.getElementById('admin-activities-list');
    const isPast     = adminActTab === 'past';

    if (activities.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>אין פעילויות ${isPast ? 'עבר' : 'עתידיות'}</p></div>`;
      return;
    }

    container.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>כותרת</th><th>תאריך</th><th>שעות</th><th>חפיפה</th><th>משובצים</th><th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          ${activities.map(act => {
            const names = act.registered_names ? act.registered_names.split(', ') : [];
            return `
              <tr>
                <td class="td-title">${escapeHtml(act.title)}</td>
                <td>${formatDateShort(act.date)}</td>
                <td>${act.start_time} – ${act.end_time}</td>
                <td><span class="badge ${act.allow_overlap ? 'badge-overlap' : 'badge-no-overlap'}">${act.allow_overlap ? 'מותרת' : 'לא מותרת'}</span></td>
                <td class="td-names">
                  ${names.length > 0
                    ? names.map(n => `<span class="name-pill">${escapeHtml(n)}</span>`).join('')
                    : '<span style="color:var(--text-3);font-size:12px">אין</span>'
                  }
                </td>
                <td>
                  <div style="display:flex;gap:6px;flex-wrap:wrap">
                    <button class="btn btn-ghost" style="padding:6px 10px;font-size:12px" onclick="openActivityModal(${act.id}, ${isPast})">
                      👥 ${isPast ? 'צפה' : 'שיבוץ'}
                    </button>
                    <button class="btn btn-danger" style="padding:6px 10px;font-size:12px" onclick="deleteActivity(${act.id})">מחק</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch (e) { showToast(e.message, 'error'); }
}

async function deleteActivity(id) {
  if (!confirm('למחוק פעילות זו לצמיתות?')) return;
  try {
    await API.delete(`/activities/${id}`);
    showToast('הפעילות נמחקה בהצלחה');
    loadAdminActivities();
    loadWeeklyView();
  } catch (e) { showToast(e.message, 'error'); }
}

async function createActivity() {
  const title               = document.getElementById('act-title').value.trim();
  const start_date          = document.getElementById('act-start-date').value;
  const end_date            = document.getElementById('act-end-date').value;
  const start_time          = document.getElementById('act-start').value;
  const end_time            = document.getElementById('act-end').value;
  const allow_overlap       = document.getElementById('act-overlap').checked;
  const lock_unregistration = document.getElementById('act-lock-unreg').checked;
  const capacity            = document.getElementById('act-capacity').value;
  const notes               = document.getElementById('act-notes').value.trim();
  hideError('create-act-error');

  if (!title || !start_date || !start_time || !end_time) {
    showError('create-act-error', 'נא למלא את כל השדות החובה');
    return;
  }
  if (end_date && end_date < start_date) {
    showError('create-act-error', 'תאריך הסיום לא יכול להיות לפני תאריך ההתחלה');
    return;
  }
  try {
    const res = await API.post('/activities', {
      title, start_date, end_date: end_date || start_date,
      start_time, end_time, allow_overlap, lock_unregistration,
      capacity: capacity || null,
      notes: notes || null
    });
    showToast(res.message + ' ✅');
    document.getElementById('create-activity-form').classList.add('hidden');
    ['act-title','act-start-date','act-end-date','act-start','act-end','act-capacity','act-notes']
      .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    document.getElementById('act-overlap').checked    = false;
    document.getElementById('act-lock-unreg').checked = false;
    loadAdminActivities();
    loadWeeklyView();
  } catch (e) { showError('create-act-error', e.message); }
}

// ===== ADMIN: MANAGE USERS WITH ATTRIBUTES =====
async function loadUsers() {
  try {
    const users     = await API.get('/users');
    const container = document.getElementById('users-list');

    if (users.length === 0) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>אין משתמשים במערכת</p></div>`;
      return;
    }

    container.innerHTML = users.map(u => `
      <div class="user-card" id="user-card-${u.id}">
        <div class="user-card-header">
          <div class="user-card-info">
            <div class="user-card-avatar">${getInitials(u.username)}</div>
            <div>
              <div class="user-card-name">${escapeHtml(u.username)}</div>
              <span class="badge ${u.is_admin ? 'badge-admin' : 'badge-user'}">${u.is_admin ? 'מנהל' : 'עובד'}</span>
            </div>
          </div>
          ${!u.is_admin
            ? `<button class="btn btn-danger" style="padding:6px 12px;font-size:12px"
                 onclick="deleteUser(${u.id}, '${escapeHtml(u.username)}')">מחק עובד</button>`
            : ''
          }
        </div>

        <!-- Attributes section -->
        <div class="user-attrs">
          <div class="attrs-label">תכונות:</div>
          <div class="attrs-list" id="attrs-list-${u.id}">
            ${renderAttrPills(u.id, u.attributes)}
          </div>
          <div class="attr-add-row">
            <input type="text" class="attr-input" id="attr-input-${u.id}"
              placeholder="הוסף תכונה (לדוגמה: רישיון צבאי)..."
              onkeydown="if(event.key==='Enter') addAttribute(${u.id})" />
            <button class="btn btn-ghost" style="white-space:nowrap" onclick="addAttribute(${u.id})">
              + הוסף
            </button>
          </div>
          <div class="error-msg hidden" id="attr-error-${u.id}"></div>
        </div>
      </div>
    `).join('');
  } catch (e) { showToast(e.message, 'error'); }
}

function renderAttrPills(userId, attributes) {
  if (!attributes || attributes.length === 0) {
    return '<span class="no-attrs">אין תכונות עדיין</span>';
  }
  return attributes.map(a => `
    <span class="attr-pill">
      ${escapeHtml(a.attribute)}
      <button class="attr-remove" onclick="removeAttribute(${userId}, ${a.id})" title="הסר תכונה">×</button>
    </span>
  `).join('');
}

async function addAttribute(userId) {
  const input = document.getElementById(`attr-input-${userId}`);
  const value = input.value.trim();
  hideError(`attr-error-${userId}`);

  if (!value) { showError(`attr-error-${userId}`, 'נא להזין תכונה'); return; }

  try {
    await API.post(`/users/${userId}/attributes`, { attribute: value });
    input.value = '';
    showToast('התכונה נוספה בהצלחה ✅');
    await refreshUserAttrs(userId);
  } catch (e) { showError(`attr-error-${userId}`, e.message); }
}

async function removeAttribute(userId, attrId) {
  try {
    await API.delete(`/users/${userId}/attributes/${attrId}`);
    showToast('התכונה הוסרה');
    await refreshUserAttrs(userId);
  } catch (e) { showToast(e.message, 'error'); }
}

async function refreshUserAttrs(userId) {
  try {
    const users = await API.get('/users');
    const user  = users.find(u => u.id === userId);
    if (user) {
      document.getElementById(`attrs-list-${userId}`).innerHTML =
        renderAttrPills(userId, user.attributes);
    }
  } catch (e) { console.error(e); }
}

async function deleteUser(id, username) {
  if (!confirm(`למחוק את המשתמש "${username}"?`)) return;
  try {
    await API.delete(`/users/${id}`);
    showToast(`המשתמש "${username}" נמחק בהצלחה`);
    loadUsers();
  } catch (e) { showToast(e.message, 'error'); }
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
  } catch (e) { showError('add-user-error', e.message); }
}

// ===== EDIT MODAL =====
function openEditModal(act) {
  // Pre-fill all fields
  document.getElementById('edit-title').value        = act.title || '';
  document.getElementById('edit-date').value         = act.date  || '';
  document.getElementById('edit-start').value        = act.start_time || '';
  document.getElementById('edit-end').value          = act.end_time   || '';
  document.getElementById('edit-capacity').value     = act.capacity != null ? act.capacity : '';
  document.getElementById('edit-notes').value        = act.notes  || '';
  document.getElementById('edit-overlap').checked    = !!act.allow_overlap;
  document.getElementById('edit-lock-unreg').checked = !!act.lock_unregistration;
  hideError('edit-error');
  document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  hideError('edit-error');
}

async function saveEditActivity() {
  const title               = document.getElementById('edit-title').value.trim();
  const date                = document.getElementById('edit-date').value;
  const start_time          = document.getElementById('edit-start').value;
  const end_time            = document.getElementById('edit-end').value;
  const capacity            = document.getElementById('edit-capacity').value;
  const notes               = document.getElementById('edit-notes').value.trim();
  const allow_overlap       = document.getElementById('edit-overlap').checked;
  const lock_unregistration = document.getElementById('edit-lock-unreg').checked;
  hideError('edit-error');

  if (!title || !date || !start_time || !end_time) {
    showError('edit-error', 'נא למלא את כל השדות החובה');
    return;
  }

  try {
    const res = await API.request('PUT', `/activities/${currentActivityId}`, {
      title, date, start_time, end_time,
      allow_overlap, lock_unregistration,
      capacity: capacity !== '' ? parseInt(capacity) : null,
      notes: notes || null
    });
    closeEditModal();
    // Refresh the activity modal with updated data
    await openActivityModal(currentActivityId, isPastDate(date));
    showToast(res.message + ' ✅');
    loadWeeklyView();
    if (document.getElementById('view-manage-activities')?.classList.contains('active')) {
      loadAdminActivities();
    }
  } catch (e) {
    showError('edit-error', e.message);
  }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', async () => {
  try { currentUser = await API.get('/auth/me'); initApp(); } catch (_) {}

  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-username').addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const view = item.dataset.view;
      switchView(view);
      if (view === 'weekly')              { setWeeklyTab(weeklyTab); }
      else if (view === 'my-schedule')    loadMySchedule();
      else if (view === 'manage-activities') { setAdminActTab(adminActTab); }
      else if (view === 'manage-users')   loadUsers();
    });
  });

  // Week navigation
  document.getElementById('prev-week').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7); loadWeeklyView();
  });
  document.getElementById('next-week').addEventListener('click', () => {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7); loadWeeklyView();
  });
  document.getElementById('today-btn').addEventListener('click', () => {
    currentWeekStart = getWeekStart(new Date()); loadWeeklyView();
  });

  // Modal
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('activity-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('activity-modal')) closeModal();
  });
  document.getElementById('assign-user-btn').addEventListener('click', assignUser);

  // Edit activity modal
  document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
  document.getElementById('edit-cancel-btn').addEventListener('click', closeEditModal);
  document.getElementById('edit-save-btn').addEventListener('click', saveEditActivity);
  document.getElementById('edit-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('edit-modal')) closeEditModal();
  });

  // Create activity
  document.getElementById('show-create-activity-form').addEventListener('click', () => {
    document.getElementById('create-activity-form').classList.remove('hidden');
    document.getElementById('act-start-date').value = formatDate(new Date());
    document.getElementById('act-end-date').value   = '';
  });
  document.getElementById('cancel-create-activity').addEventListener('click', () => {
    document.getElementById('create-activity-form').classList.add('hidden');
    hideError('create-act-error');
  });
  document.getElementById('create-activity-btn').addEventListener('click', createActivity);

  // Add user
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
