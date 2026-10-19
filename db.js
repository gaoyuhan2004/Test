// 数据库层 - 支持本地SQLite + 云端PostgreSQL
const path = require('path');
const fs = require('fs');

const DATABASE_URL = process.env.DATABASE_URL;

// ==================== PostgreSQL (云端) ====================
if (DATABASE_URL) {
  const { Pool } = require('pg');
  
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  // PostgreSQL 查询包装（让API代码不用改）
  const db = {
    async query(text, params = []) {
      const result = await pool.query(text, params);
      return result.rows;
    },
    async get(text, params = []) {
      const rows = await db.query(text, params);
      return rows[0] || null;
    },
    async run(text, params = []) {
      const result = await pool.query(text, params);
      return { changes: result.rowCount, lastInsertRowid: result.rows[0]?.id };
    },
    exec(sql) {
      return pool.query(sql);
    },
    close() {
      return pool.end();
    },
    isPostgres: true
  };

  // 初始化表（PostgreSQL版本）
  async function init() {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL DEFAULT 'student',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        option_a TEXT DEFAULT '',
        option_b TEXT DEFAULT '',
        option_c TEXT DEFAULT '',
        option_d TEXT DEFAULT '',
        answer VARCHAR(10) NOT NULL,
        explanation TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS user_answers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        selected TEXT NOT NULL,
        is_correct INTEGER NOT NULL,
        answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, question_id)
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, question_id)
      );
    `);

    // 创建默认管理员
    const bcrypt = require('bcryptjs');
    const existing = await db.get('SELECT * FROM users WHERE username = $1', ['admin']);
    if (!existing) {
      const hash = bcrypt.hashSync('admin123', 10);
      await db.run('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', hash, 'admin']);
      console.log('✅ 已创建默认管理员: admin / admin123');
    }

    // 自动导入题库（如果题目表为空）
    const qCount = await db.get('SELECT COUNT(*) AS count FROM questions');
    if (!qCount || Number(qCount.count) === 0) {
      const jsonPath = path.join(__dirname, 'questions-backup.json');
      if (fs.existsSync(jsonPath)) {
        const questions = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
        for (const q of questions) {
          await db.run(
            `INSERT INTO questions (type, content, option_a, option_b, option_c, option_d, answer, explanation)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [q.type, q.content, q.option_a, q.option_b, q.option_c, q.option_d, q.answer, q.explanation]
          );
        }
        console.log(`✅ 已自动导入 ${questions.length} 道题目`);
      } else {
        console.log('⚠️ 未找到 questions-backup.json，跳过题库导入');
      }
    }

    console.log('✅ PostgreSQL数据库初始化完成');
  }

  module.exports = db;
  module.exports.init = init;

} else {
  // ==================== SQLite (本地开发) ====================
  const Database = require('better-sqlite3');

  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, 'quiz.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // 本地SQLite的查询包装（统一async接口，和PostgreSQL版一致）
  const asyncDb = {
    async get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
    async query(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async run(sql, params = []) {
      const result = db.prepare(sql).run(...params);
      return { changes: result.changes, lastInsertRowid: result.lastInsertRowid };
    },
    exec(sql) {
      return db.exec(sql);
    },
    prepare(sql) {
      return db.prepare(sql);
    },
    isPostgres: false,
    close() { db.close(); }
  };

  // 初始化表
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      option_a TEXT DEFAULT '',
      option_b TEXT DEFAULT '',
      option_c TEXT DEFAULT '',
      option_d TEXT DEFAULT '',
      answer TEXT NOT NULL,
      explanation TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS user_answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      selected TEXT NOT NULL,
      is_correct INTEGER NOT NULL,
      answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, question_id)
    );
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, question_id)
    );
  `);

  // 默认管理员
  const bcrypt = require('bcryptjs');
  const existing = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)')
      .run('admin', hash, 'admin');
    console.log('✅ 已创建默认管理员: admin / admin123');
  }

  console.log('✅ SQLite数据库初始化完成（本地开发模式）');

  module.exports = asyncDb;
  module.exports.init = async () => {}; // 本地同步初始化，不用async
}
