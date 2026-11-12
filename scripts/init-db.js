require('dotenv').config();
const bcrypt = require('bcrypt');
const { db, initialize } = require('../src/db');

initialize();
const users = [
  ['Morgan Lee', 'admin@nexora.local', 'admin', 'Operations'],
  ['Alex Rivera', 'alex@nexora.local', 'sales', 'Sales'],
  ['Sam Taylor', 'sam@nexora.local', 'member', 'Delivery']
];
const addUser = db.prepare('INSERT OR IGNORE INTO users (name,email,password_hash,role,department) VALUES (?,?,?,?,?)');
for (const [name, email, role, department] of users) {
  addUser.run(name, email, bcrypt.hashSync('NexoraDemo!2026', 10), role, department);
}
const owner = db.prepare('SELECT id FROM users WHERE email=?').get('alex@nexora.local').id;
const admin = db.prepare('SELECT id FROM users WHERE email=?').get('admin@nexora.local').id;
if (db.prepare('SELECT COUNT(*) AS n FROM customers').get().n === 0) {
  const customer = db.prepare('INSERT INTO customers (name,company,email,phone,status,value,owner_id,notes) VALUES (?,?,?,?,?,?,?,?)');
  const ids = [
    customer.run('Olivia Bennett','Northstar Studio','olivia@northstar.example','+1 415 555 0142','customer',24500,owner,'Primary contact for the brand refresh.').lastInsertRowid,
    customer.run('Ethan Brooks','Brightline Labs','ethan@brightline.example','+1 212 555 0188','proposal',18200,owner,'Proposal shared; follow up next week.').lastInsertRowid,
    customer.run('Mia Chen','Harbor & Pine','mia@harborpine.example','+1 646 555 0109','lead',7600,admin,'Interested in a quarterly support plan.').lastInsertRowid,
    customer.run('Noah Williams','Vertex Works','noah@vertex.example','+1 312 555 0163','customer',41200,admin,'Long-term account.').lastInsertRowid
  ];
  const project = db.prepare('INSERT INTO projects (name,description,customer_id,status,budget,due_date,owner_id) VALUES (?,?,?,?,?,?,?)');
  const p1 = project.run('Website modernization','A refreshed digital experience and content platform.',ids[0],'active',24500,'2026-12-18',owner).lastInsertRowid;
  const p2 = project.run('Customer portal','Self-service portal discovery and delivery.',ids[1],'planning',18200,'2027-01-30',admin).lastInsertRowid;
  const task = db.prepare('INSERT INTO tasks (project_id,title,description,assignee_id,status,priority,due_date) VALUES (?,?,?,?,?,?,?)');
  task.run(p1,'Review homepage concepts','Collect feedback from the customer team.',owner,'in_progress','high','2026-11-20');
  task.run(p1,'Prepare content inventory','Map current pages and owners.',2,'todo','normal','2026-11-25');
  task.run(p2,'Confirm portal scope','Align the initial release requirements.',3,'todo','high','2026-11-28');
  db.prepare('INSERT INTO invoices (customer_id,amount,status) VALUES (?,?,?)').run(ids[0],8200,'pending');
  db.prepare('INSERT INTO invoices (customer_id,amount,status) VALUES (?,?,?)').run(ids[1],4600,'draft');
}
console.log('Nexora database is ready.');
db.close();
