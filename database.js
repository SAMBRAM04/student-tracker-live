import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';

mkdirSync('data', { recursive: true });
const connection = new DatabaseSync(process.env.DB_FILE || 'data/projects.db');

connection.exec(`CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80),
  status TEXT NOT NULL CHECK(status IN ('Planned', 'In Progress', 'Completed')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High')),
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`);

// Safe migrations if table was created previously with older schema
try { connection.exec(`ALTER TABLE projects ADD COLUMN priority TEXT NOT NULL DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High'))`); } catch {}
try { connection.exec(`ALTER TABLE projects ADD COLUMN description TEXT NOT NULL DEFAULT ''`); } catch {}
try { connection.exec(`ALTER TABLE projects ADD COLUMN created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`); } catch {}

export const db = {
  async list() {
    return connection.prepare('SELECT id, name, status, priority, description, created_at FROM projects ORDER BY id DESC').all();
  },
  async create({ name, status, priority = 'Medium', description = '' }) {
    const result = connection.prepare(
      'INSERT INTO projects (name, status, priority, description) VALUES (?, ?, ?, ?)'
    ).run(name, status, priority, description);
    return connection.prepare('SELECT id, name, status, priority, description, created_at FROM projects WHERE id = ?').get(Number(result.lastInsertRowid));
  },
  async update(id, { name, status, priority = 'Medium', description = '' }) {
    const result = connection.prepare(
      'UPDATE projects SET name = ?, status = ?, priority = ?, description = ? WHERE id = ?'
    ).run(name, status, priority, description, id);
    if (!result.changes) return null;
    return connection.prepare('SELECT id, name, status, priority, description, created_at FROM projects WHERE id = ?').get(id);
  },
  async remove(id) {
    return connection.prepare('DELETE FROM projects WHERE id = ?').run(id).changes > 0;
  }
};
