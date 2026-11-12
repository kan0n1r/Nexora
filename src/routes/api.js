const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { db } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
function activity(userId, action, detail = '') {
  db.prepare('INSERT INTO activity (user_id,action,detail) VALUES (?,?,?)').run(userId, action, detail);
}
function current(req) { return req.session.user; }

router.post('/auth/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
  req.session.user = { id: user.id, name: user.name, email: user.email, role: user.role, department: user.department };
  activity(user.id, 'Signed in', 'Workspace access');
  res.json({ user: req.session.user });
});
router.post('/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));
router.get('/auth/me', requireAuth, (req, res) => res.json({ user: current(req) }));

router.get('/dashboard', requireAuth, (req, res) => {
  const stats = {
    customers: db.prepare('SELECT COUNT(*) n FROM customers').get().n,
    projects: db.prepare("SELECT COUNT(*) n FROM projects WHERE status NOT IN ('completed','archived')").get().n,
    tasks: db.prepare("SELECT COUNT(*) n FROM tasks WHERE status != 'done'").get().n,
    pipeline: db.prepare("SELECT COALESCE(SUM(value),0) n FROM customers WHERE status IN ('lead','proposal')").get().n
  };
  const recent = db.prepare('SELECT a.*,u.name user_name FROM activity a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 8').all();
  res.json({ stats, recent });
});

router.get('/customers', requireAuth, (req, res) => {
  const q = String(req.query.q || '');
  const rows = q
    ? db.prepare(`SELECT * FROM customers WHERE name LIKE '%${q}%' OR company LIKE '%${q}%' ORDER BY id DESC`).all()
    : db.prepare('SELECT * FROM customers ORDER BY id DESC').all();
  res.json({ customers: rows });
});
router.get('/customers/:id', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  res.json({ customer });
});
router.post('/customers', requireAuth, (req, res) => {
  const { name, company, email, phone, status, value, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Customer name is required' });
  const result = db.prepare('INSERT INTO customers (name,company,email,phone,status,value,owner_id,notes) VALUES (?,?,?,?,?,?,?,?)')
    .run(name, company || '', email || '', phone || '', status || 'lead', Number(value) || 0, current(req).id, notes || '');
  activity(current(req).id, 'Created customer', name);
  res.status(201).json({ id: result.lastInsertRowid });
});
router.patch('/customers/:id', requireAuth, (req, res) => {
  const allowed = ['name','company','email','phone','status','value','notes','owner_id'];
  const fields = Object.keys(req.body).filter(k => allowed.includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No fields supplied' });
  const sql = fields.map(k => `${k}=?`).join(',');
  db.prepare(`UPDATE customers SET ${sql} WHERE id=?`).run(...fields.map(k => req.body[k]), req.params.id);
  activity(current(req).id, 'Updated customer', String(req.params.id));
  res.json({ ok: true });
});
router.delete('/customers/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

router.get('/projects', requireAuth, (req, res) => {
  res.json({ projects: db.prepare('SELECT p.*,c.name customer_name,u.name owner_name FROM projects p LEFT JOIN customers c ON c.id=p.customer_id LEFT JOIN users u ON u.id=p.owner_id ORDER BY p.id DESC').all() });
});
router.post('/projects', requireAuth, (req, res) => {
  const { name, description, customer_id, budget, due_date } = req.body;
  if (!name) return res.status(400).json({ error: 'Project name is required' });
  const r = db.prepare('INSERT INTO projects (name,description,customer_id,budget,due_date,owner_id) VALUES (?,?,?,?,?,?)').run(name, description || '', customer_id || null, Number(budget) || 0, due_date || null, current(req).id);
  activity(current(req).id, 'Created project', name);
  res.status(201).json({ id: r.lastInsertRowid });
});
router.get('/tasks', requireAuth, (req, res) => {
  res.json({ tasks: db.prepare('SELECT t.*,p.name project_name,u.name assignee_name FROM tasks t LEFT JOIN projects p ON p.id=t.project_id LEFT JOIN users u ON u.id=t.assignee_id ORDER BY t.id DESC').all() });
});
router.patch('/tasks/:id', requireAuth, (req, res) => {
  const { status, assignee_id, priority } = req.body;
  db.prepare('UPDATE tasks SET status=COALESCE(?,status),assignee_id=COALESCE(?,assignee_id),priority=COALESCE(?,priority) WHERE id=?').run(status, assignee_id, priority, req.params.id);
  res.json({ ok: true });
});

router.get('/team', requireAuth, (req, res) => {
  const users = db.prepare('SELECT id,name,email,role,department,created_at FROM users ORDER BY name').all();
  res.json({ users });
});
router.patch('/team/:id', requireAuth, (req, res) => {
  const fields = Object.keys(req.body).filter(k => ['name','email','role','department'].includes(k));
  if (!fields.length) return res.status(400).json({ error: 'No fields supplied' });
  db.prepare(`UPDATE users SET ${fields.map(k => `${k}=?`).join(',')} WHERE id=?`).run(...fields.map(k => req.body[k]), req.params.id);
  res.json({ ok: true });
});
router.post('/team/:id/invite', requireAdmin, (req, res) => {
  const { name, email, role } = req.body;
  const temporary = crypto.randomBytes(9).toString('base64url');
  const hash = bcrypt.hashSync(temporary, 10);
  const r = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)').run(name, email, hash, role || 'member');
  res.status(201).json({ id: r.lastInsertRowid, temporary_password: temporary });
});

router.get('/documents', requireAuth, (req, res) => res.json({ documents: db.prepare('SELECT * FROM documents ORDER BY id DESC').all() }));
router.post('/documents', requireAuth, (req, res) => {
  const { name, content, customer_id, project_id } = req.body;
  if (!name || typeof content !== 'string') return res.status(400).json({ error: 'Name and content are required' });
  const stored = path.basename(name);
  fs.writeFileSync(path.join(uploadDir, stored), Buffer.from(content, 'base64'));
  const r = db.prepare('INSERT INTO documents (name,stored_name,customer_id,project_id,uploaded_by) VALUES (?,?,?,?,?)').run(name, stored, customer_id || null, project_id || null, current(req).id);
  res.status(201).json({ id: r.lastInsertRowid });
});
router.get('/documents/:id/download', requireAuth, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id=?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const file = path.join(uploadDir, req.query.file || doc.stored_name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'File not found' });
  res.download(file, doc.name);
});

router.get('/reports/summary', requireAuth, (req, res) => {
  const customers = db.prepare('SELECT status,COUNT(*) count,SUM(value) value FROM customers GROUP BY status').all();
  const projects = db.prepare('SELECT status,COUNT(*) count FROM projects GROUP BY status').all();
  res.json({ customers, projects });
});
router.post('/reports/presets', requireAuth, (req, res) => {
  const { name, filter } = req.body;
  const r = db.prepare('INSERT INTO report_presets (name,query_filter,created_by) VALUES (?,?,?)').run(name, filter || '', current(req).id);
  res.status(201).json({ id: r.lastInsertRowid });
});
router.get('/reports/presets/:id/run', requireAuth, (req, res) => {
  const preset = db.prepare('SELECT * FROM report_presets WHERE id=?').get(req.params.id);
  if (!preset) return res.status(404).json({ error: 'Preset not found' });
  const rows = db.prepare(`SELECT id,name,company,status,value FROM customers WHERE ${preset.query_filter || '1=1'}`).all();
  res.json({ rows });
});

router.get('/invoices', requireAuth, (req, res) => res.json({ invoices: db.prepare('SELECT i.*,c.name customer_name FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id ORDER BY i.id DESC').all() }));
router.post('/invoices/:id/approve', requireAuth, (req, res) => {
  db.prepare("UPDATE invoices SET status='approved',approved_by=? WHERE id=?").run(current(req).id, req.params.id);
  activity(current(req).id, 'Approved invoice', String(req.params.id));
  res.json({ ok: true });
});

router.post('/integrations/test', requireAuth, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: 'Endpoint is required' });
  try {
    const client = endpoint.startsWith('https:') ? https : http;
    const result = await new Promise((resolve, reject) => {
      const request = client.get(endpoint, { timeout: 5000 }, response => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', chunk => body += chunk.slice(0, 2048));
        response.on('end', () => resolve({ status: response.statusCode, preview: body.slice(0, 500) }));
      });
      request.on('error', reject);
      request.on('timeout', () => { request.destroy(new Error('Request timed out')); });
    });
    res.json(result);
  } catch (error) { res.status(502).json({ error: error.message }); }
});
router.post('/integrations', requireAdmin, (req, res) => {
  const { name, endpoint, api_key } = req.body;
  const r = db.prepare('INSERT INTO integrations (name,endpoint,api_key) VALUES (?,?,?)').run(name, endpoint, api_key || '');
  res.status(201).json({ id: r.lastInsertRowid });
});

router.get('/activity', requireAuth, (req, res) => res.json({ activity: db.prepare('SELECT a.*,u.name user_name FROM activity a LEFT JOIN users u ON u.id=a.user_id ORDER BY a.id DESC LIMIT 30').all() }));
router.get('/meta', requireAuth, (req, res) => res.json({ user: current(req), version: '1.0.0', workspace: 'Nexora Studio' }));

module.exports = router;
