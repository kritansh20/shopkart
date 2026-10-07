/**
 * Creates an isolated Express app backed by an in-memory SQLite database.
 * Import this in tests instead of the real index.js so each test suite
 * gets a fresh DB and the production data file is never touched.
 */
import express from 'express';
import Database from 'better-sqlite3';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const TEST_JWT_SECRET = 'test-secret-do-not-use-in-prod';

// ── in-memory DB ──────────────────────────────────────────────────────────────
export function createTestDb() {
  const db = new Database(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      name       TEXT NOT NULL,
      email      TEXT NOT NULL UNIQUE,
      password   TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  return db;
}

// ── token helpers ─────────────────────────────────────────────────────────────
export function signTestToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, TEST_JWT_SECRET, { expiresIn: '1h' });
}

// ── auth router factory ───────────────────────────────────────────────────────
function buildAuthRouter(db) {
  const router = Router();

  const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email });

  function requireAuth(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authentication token' });
    try {
      const payload = jwt.verify(token, TEST_JWT_SECRET);
      req.userId = payload.sub;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  router.post('/register', (req, res) => {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    if (!name || !email || !password)
      return res.status(400).json({ error: 'Name, email and password are all required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'That does not look like a valid email address' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email))
      return res.status(409).json({ error: 'An account with that email already exists' });

    const hash = bcrypt.hashSync(password, 10);
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
      .run(name, email, hash);

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(lastInsertRowid);
    res.status(201).json({ token: signTestToken(user), user: publicUser(user) });
  });

  router.post('/login', (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user || !bcrypt.compareSync(password, user.password))
      return res.status(401).json({ error: 'Incorrect email or password' });

    res.json({ token: signTestToken(user), user: publicUser(user) });
  });

  router.get('/me', requireAuth, (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: 'User no longer exists' });
    res.json({ user: publicUser(user) });
  });

  return router;
}

// ── app factory ───────────────────────────────────────────────────────────────
export function createTestApp() {
  const db = createTestDb();
  const app = express();
  app.use(express.json());
  app.use('/api/auth', buildAuthRouter(db));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong on the server' });
  });
  return { app, db };
}
