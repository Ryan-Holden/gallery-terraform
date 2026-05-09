const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

const app = express();
const PORT = 3000;
const JWT_SECRET = 'photo-gallery-secret-key-2024';
const UPLOADS_DIR = path.join(__dirname, 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(express.static(path.join(__dirname, 'public')));

// --- Database Setup ---
let db;
const DB_PATH = path.join(__dirname, 'gallery.db');

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS photos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    title TEXT,
    description TEXT,
    size INTEGER,
    mimetype TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  saveDb();
  console.log('Database initialized');
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

// --- Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// --- Auth Middleware ---
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// --- Auth Routes ---
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const existing = dbGet('SELECT id FROM users WHERE username = ?', [username]);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const hashed = await bcrypt.hash(password, 10);
  const id = uuidv4();
  dbRun('INSERT INTO users (id, username, password) VALUES (?, ?, ?)', [id, username, hashed]);

  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: '7d' });
  res.status(201).json({ token, user: { id, username } });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: user.id, username: user.username } });
});

app.get('/api/me', authMiddleware, (req, res) => {
  const user = dbGet('SELECT id, username, created_at FROM users WHERE id = ?', [req.user.id]);
  res.json(user);
});

// --- Photo Routes ---
app.post('/api/photos', authMiddleware, upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image file provided' });

  const { title, description } = req.body;
  const id = uuidv4();

  dbRun(
    'INSERT INTO photos (id, user_id, filename, original_name, title, description, size, mimetype) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.user.id, req.file.filename, req.file.originalname, title || req.file.originalname, description || '', req.file.size, req.file.mimetype]
  );

  const photo = dbGet('SELECT * FROM photos WHERE id = ?', [id]);
  res.status(201).json({ ...photo, url: `/uploads/${photo.filename}` });
});

app.get('/api/photos', authMiddleware, (req, res) => {
  const photos = dbAll(
    'SELECT p.*, u.username FROM photos p JOIN users u ON p.user_id = u.id ORDER BY p.created_at DESC'
  );
  res.json(photos.map(p => ({ ...p, url: `/uploads/${p.filename}` })));
});

app.get('/api/photos/my', authMiddleware, (req, res) => {
  const photos = dbAll(
    'SELECT * FROM photos WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id]
  );
  res.json(photos.map(p => ({ ...p, url: `/uploads/${p.filename}` })));
});

app.get('/api/photos/:id', authMiddleware, (req, res) => {
  const photo = dbGet('SELECT p.*, u.username FROM photos p JOIN users u ON p.user_id = u.id WHERE p.id = ?', [req.params.id]);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });
  res.json({ ...photo, url: `/uploads/${photo.filename}` });
});

app.delete('/api/photos/:id', authMiddleware, (req, res) => {
  const photo = dbGet('SELECT * FROM photos WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!photo) return res.status(404).json({ error: 'Photo not found or unauthorized' });

  const filePath = path.join(UPLOADS_DIR, photo.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  dbRun('DELETE FROM photos WHERE id = ?', [req.params.id]);
  res.json({ message: 'Photo deleted' });
});

app.get('/api/photos/:id/download', authMiddleware, (req, res) => {
  const photo = dbGet('SELECT * FROM photos WHERE id = ?', [req.params.id]);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  const filePath = path.join(UPLOADS_DIR, photo.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  res.download(filePath, photo.original_name);
});

// Stats
app.get('/api/stats', authMiddleware, (req, res) => {
  const totalPhotos = dbGet('SELECT COUNT(*) as count FROM photos');
  const myPhotos = dbGet('SELECT COUNT(*) as count FROM photos WHERE user_id = ?', [req.user.id]);
  const totalUsers = dbGet('SELECT COUNT(*) as count FROM users');
  res.json({
    totalPhotos: totalPhotos.count,
    myPhotos: myPhotos.count,
    totalUsers: totalUsers.count
  });
});

// Start server
initDb().then(() => {
  app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
});