const $ = s => document.querySelector(s);
const state = { user: null, page: 'overview', customers: [], projects: [], tasks: [] };
const api = async (url, options = {}) => {
  const response = await fetch('/api' + url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};
const money = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); setTimeout(() => el.classList.remove('show'), 2600); }
function setPage(page) {
  state.page = page;
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  $('#crumb').textContent = page[0].toUpperCase() + page.slice(1);
  render();
}
document.querySelectorAll('.nav-link').forEach(a => a.addEventListener('click', e => { e.preventDefault(); setPage(a.dataset.page); }));
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const form = new FormData(e.currentTarget);
  try { const result = await api('/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(form)) }); state.user = result.user; showApp(); }
  catch (err) { $('#login-error').textContent = err.message; }
});
$('#logout').addEventListener('click', async () => { await api('/auth/logout', { method: 'POST' }); state.user = null; $('#app').classList.add('hidden'); $('#login').classList.remove('hidden'); });
$('#theme-toggle').addEventListener('click', () => document.body.classList.toggle('dark'));
$('#today').textContent = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date());

async function showApp() {
  $('#login').classList.add('hidden'); $('#app').classList.remove('hidden');
  $('#user-name').textContent = state.user.name; $('#user-role').textContent = state.user.role;
  await render();
}
async function render() {
  const root = $('#content');
  try {
    if (state.page === 'overview') {
      const d = await api('/dashboard');
      root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">MONDAY, NOVEMBER 16, 2026</p><h1>Good morning, ${escapeHtml(state.user.name.split(' ')[0])} <span class="wave">✦</span></h1><p class="muted">Here’s what’s happening across your workspace today.</p></div><button class="primary" data-action="new-customer">＋ Add customer</button></div>
      <div class="stat-grid"><article class="stat-card"><div class="stat-top"><span>Total customers</span><b class="stat-icon blue">◉</b></div><strong>${d.stats.customers}</strong><small><em>↑ 12%</em> vs last month</small></article><article class="stat-card"><div class="stat-top"><span>Active projects</span><b class="stat-icon violet">▦</b></div><strong>${d.stats.projects}</strong><small><em>↑ 8%</em> vs last month</small></article><article class="stat-card"><div class="stat-top"><span>Open tasks</span><b class="stat-icon amber">☷</b></div><strong>${d.stats.tasks}</strong><small><em>↓ 4%</em> vs last month</small></article><article class="stat-card"><div class="stat-top"><span>Open pipeline</span><b class="stat-icon teal">$</b></div><strong>${money(d.stats.pipeline)}</strong><small><em>↑ 18%</em> vs last month</small></article></div>
      <div class="dashboard-grid"><section class="panel"><div class="panel-head"><div><h2>Customer pipeline</h2><p class="muted">A snapshot of current opportunities</p></div><button class="text-btn" data-page="customers">View customers →</button></div><div class="pipeline"><div class="pipeline-row"><span class="dot dot-blue"></span><span>New leads</span><b>Explore</b></div><div class="pipeline-bar"><i style="width:82%"></i></div><div class="pipeline-row"><span class="dot dot-violet"></span><span>In proposal</span><b>Review</b></div><div class="pipeline-bar violet-bar"><i style="width:58%"></i></div><div class="pipeline-row"><span class="dot dot-teal"></span><span>Customers</span><b>Growing</b></div><div class="pipeline-bar teal-bar"><i style="width:72%"></i></div></div></section><section class="panel"><div class="panel-head"><div><h2>Recent activity</h2><p class="muted">The latest updates from your team</p></div><button class="text-btn" data-page="activity">See all →</button></div><div class="activity-list">${d.recent.map(a => `<div class="activity-item"><span class="activity-avatar">${escapeHtml((a.user_name||'N').split(' ').map(x=>x[0]).join('').slice(0,2))}</span><div><b>${escapeHtml(a.user_name||'Workspace')}</b><span>${escapeHtml(a.action)} · ${escapeHtml(a.detail)}</span><small>${new Date(a.created_at+'Z').toLocaleString()}</small></div></div>`).join('') || '<p class="muted">No activity yet.</p>'}</div></section></div>
      <section class="panel table-panel"><div class="panel-head"><div><h2>Priority tasks</h2><p class="muted">Keep the important work moving</p></div><button class="text-btn" data-page="tasks">All tasks →</button></div><div id="task-preview" class="muted">Loading tasks…</div></section>`;
      const tasks = await api('/tasks'); $('#task-preview').innerHTML = tasks.tasks.slice(0,4).map(t => `<div class="simple-row"><span class="task-check">${t.status==='done'?'✓':''}</span><span>${escapeHtml(t.title)}</span><small>${escapeHtml(t.project_name||'')}</small><span class="priority ${escapeHtml(t.priority)}">${escapeHtml(t.priority)}</span></div>`).join('') || 'No tasks yet.';
    } else if (state.page === 'customers') await renderCustomers(root);
    else if (state.page === 'projects') await renderProjects(root);
    else if (state.page === 'tasks') await renderTasks(root);
    else if (state.page === 'documents') await renderDocuments(root);
    else if (state.page === 'reports') await renderReports(root);
    else if (state.page === 'activity') await renderActivity(root);
    else if (state.page === 'team') await renderTeam(root);
    else if (state.page === 'settings') root.innerHTML = '<div class="page-heading"><div><p class="eyebrow">PREFERENCES</p><h1>Settings</h1><p class="muted">Manage your workspace preferences and connections.</p></div></div><section class="panel settings-panel"><h2>Workspace profile</h2><p class="muted">Nexora Studio · Professional workspace</p><div class="setting-row"><span><b>Workspace name</b><small>Shown to members of your team</small></span><b>Nexora Studio</b></div><div class="setting-row"><span><b>Default currency</b><small>Used in customer and project values</small></span><b>USD ($)</b></div><div class="setting-row"><span><b>Time zone</b><small>Dates and activity timestamps</small></span><b>UTC</b></div></section>';
  } catch (err) { root.innerHTML = `<div class="empty-state"><h2>We couldn't load this view</h2><p>${escapeHtml(err.message)}</p><button class="secondary" onclick="location.reload()">Try again</button></div>`; }
}
async function renderCustomers(root) {
  const d = await api('/customers'); state.customers = d.customers; $('#customer-count').textContent = d.customers.length;
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">RELATIONSHIPS</p><h1>Customers</h1><p class="muted">Build lasting relationships and keep every detail close.</p></div><button class="primary" data-action="new-customer">＋ Add customer</button></div><section class="panel table-panel"><div class="table-toolbar"><input id="customer-search" placeholder="Search customers or companies…"><span class="muted">${d.customers.length} records</span></div><div class="data-table"><div class="table-head"><span>NAME</span><span>COMPANY</span><span>STATUS</span><span>VALUE</span><span>CONTACT</span></div><div id="customer-rows">${customerRows(d.customers)}</div></div></section>`;
  $('#customer-search').addEventListener('input', async e => { const result = await api('/customers?q='+encodeURIComponent(e.target.value)); $('#customer-rows').innerHTML = customerRows(result.customers); });
}
function customerRows(rows) { return rows.map(c => `<div class="table-row"><span class="person-cell"><i class="person-avatar">${escapeHtml(c.name.split(' ').map(x=>x[0]).join('').slice(0,2))}</i><b>${escapeHtml(c.name)}</b></span><span>${escapeHtml(c.company)}</span><span><i class="status status-${escapeHtml(c.status)}">${escapeHtml(c.status)}</i></span><span>${money(c.value)}</span><span class="muted">${escapeHtml(c.email)}</span></div>`).join('') || '<div class="empty-row">No customers match your search.</div>'; }
async function renderProjects(root) {
  const d = await api('/projects'); state.projects = d.projects;
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">DELIVERY</p><h1>Projects</h1><p class="muted">Track outcomes, budgets and milestones.</p></div><button class="primary" data-action="new-project">＋ New project</button></div><div class="project-grid">${d.projects.map(p=>`<article class="project-card"><div class="project-card-top"><span class="project-symbol">▦</span><i class="status status-${escapeHtml(p.status)}">${escapeHtml(p.status)}</i></div><h2>${escapeHtml(p.name)}</h2><p class="muted">${escapeHtml(p.description)}</p><div class="project-meta"><span>CLIENT</span><b>${escapeHtml(p.customer_name||'—')}</b></div><div class="project-meta"><span>BUDGET</span><b>${money(p.budget)}</b></div><div class="project-progress"><i></i></div><small class="muted">Owned by ${escapeHtml(p.owner_name||'Unassigned')}</small></article>`).join('') || '<div class="empty-state">No projects yet. Create your first project to get started.</div>'}</div>`;
}
async function renderTasks(root) {
  const d = await api('/tasks'); state.tasks = d.tasks;
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">GET THINGS DONE</p><h1>Tasks</h1><p class="muted">A clear list of what needs attention.</p></div></div><section class="panel table-panel"><div class="data-table"><div class="table-head task-head"><span>TASK</span><span>PROJECT</span><span>ASSIGNEE</span><span>PRIORITY</span><span>STATUS</span></div>${d.tasks.map(t=>`<div class="table-row task-row"><span><b>${escapeHtml(t.title)}</b><small class="muted">${escapeHtml(t.description)}</small></span><span>${escapeHtml(t.project_name||'—')}</span><span>${escapeHtml(t.assignee_name||'—')}</span><span class="priority ${escapeHtml(t.priority)}">${escapeHtml(t.priority)}</span><select data-task="${t.id}" class="status-select"><option value="todo" ${t.status==='todo'?'selected':''}>To do</option><option value="in_progress" ${t.status==='in_progress'?'selected':''}>In progress</option><option value="done" ${t.status==='done'?'selected':''}>Done</option></select></div>`).join('') || '<div class="empty-row">You are all caught up.</div>'}</div></section>`;
  root.querySelectorAll('[data-task]').forEach(s=>s.addEventListener('change',async()=>{await api('/tasks/'+s.dataset.task,{method:'PATCH',body:JSON.stringify({status:s.value})});toast('Task updated');}));
}
async function renderDocuments(root) {
  const d = await api('/documents');
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">SHARED FILES</p><h1>Documents</h1><p class="muted">Keep important files connected to your customer work.</p></div><button class="primary" data-action="new-document">＋ Add document</button></div><section class="panel table-panel"><div class="data-table"><div class="table-head"><span>DOCUMENT</span><span>CUSTOMER</span><span>UPLOADED</span><span> </span><span> </span></div>${d.documents.map(f=>`<div class="table-row"><span>▤ &nbsp;${escapeHtml(f.name)}</span><span>${f.customer_id||'—'}</span><span>${new Date(f.created_at+'Z').toLocaleDateString()}</span><span></span><a href="/api/documents/${f.id}/download">Download</a></div>`).join('') || '<div class="empty-row">No documents uploaded yet.</div>'}</div></section>`;
}
async function renderReports(root) {
  const d = await api('/reports/summary');
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">INSIGHTS</p><h1>Reports</h1><p class="muted">Understand the shape of your customer and project portfolio.</p></div></div><div class="report-grid"><section class="panel"><h2>Customers by stage</h2>${d.customers.map(x=>`<div class="report-line"><span>${escapeHtml(x.status)}</span><b>${x.count}</b><small>${money(x.value)}</small></div>`).join('')}</section><section class="panel"><h2>Projects by status</h2>${d.projects.map(x=>`<div class="report-line"><span>${escapeHtml(x.status)}</span><b>${x.count}</b></div>`).join('')}</section></div>`;
}
async function renderActivity(root) {
  const d = await api('/activity');
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">WORKSPACE LOG</p><h1>Activity</h1><p class="muted">A shared timeline of recent team updates.</p></div></div><section class="panel activity-panel">${d.activity.map(a=>`<div class="activity-item"><span class="activity-avatar">${escapeHtml((a.user_name||'N').slice(0,1))}</span><div><b>${escapeHtml(a.user_name||'Workspace')}</b><span>${escapeHtml(a.action)} · ${escapeHtml(a.detail)}</span><small>${new Date(a.created_at+'Z').toLocaleString()}</small></div></div>`).join('') || '<p class="muted">No activity yet.</p>'}</section>`;
}
async function renderTeam(root) {
  const d = await api('/team');
  root.innerHTML = `<div class="page-heading"><div><p class="eyebrow">PEOPLE</p><h1>Team</h1><p class="muted">The people behind the work.</p></div><button class="primary" data-action="invite">＋ Invite member</button></div><section class="panel table-panel"><div class="data-table"><div class="table-head"><span>MEMBER</span><span>EMAIL</span><span>DEPARTMENT</span><span>ROLE</span><span>JOINED</span></div>${d.users.map(u=>`<div class="table-row"><span class="person-cell"><i class="person-avatar">${escapeHtml(u.name.split(' ').map(x=>x[0]).join('').slice(0,2))}</i><b>${escapeHtml(u.name)}</b></span><span>${escapeHtml(u.email)}</span><span>${escapeHtml(u.department)}</span><span class="status status-active">${escapeHtml(u.role)}</span><span class="muted">${new Date(u.created_at+'Z').toLocaleDateString()}</span></div>`).join('')}</div></section>`;
}
document.addEventListener('click', async e => {
  const page = e.target.closest('[data-page]'); if (page && !page.classList.contains('nav-link')) { setPage(page.dataset.page); return; }
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'new-customer') {
    const name = prompt('Customer name'); if (!name) return;
    const company = prompt('Company') || '';
    await api('/customers',{method:'POST',body:JSON.stringify({name,company})}); toast('Customer created'); setPage('customers');
  }
  if (action === 'new-project') {
    const name = prompt('Project name'); if (!name) return;
    await api('/projects',{method:'POST',body:JSON.stringify({name})}); toast('Project created'); render();
  }
  if (action === 'invite') {
    const name = prompt('Member name'); if (!name) return;
    const email = prompt('Email address'); if (!email) return;
    const result = await api('/team/'+state.user.id+'/invite',{method:'POST',body:JSON.stringify({name,email,role:'member'})}); toast('Member invited · temporary password: '+result.temporary_password); render();
  }
  if (action === 'new-document') {
    const name = prompt('Document file name'); if (!name) return;
    const content = prompt('Text to store in the document') || '';
    await api('/documents',{method:'POST',body:JSON.stringify({name,content:btoa(unescape(encodeURIComponent(content)))})}); toast('Document added'); render();
  }
});
(async()=>{ try { const d=await api('/auth/me'); state.user=d.user; await showApp(); } catch {} })();
