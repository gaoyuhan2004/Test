// 一键导入题库到云端PostgreSQL
// 用法: node seed-postgres.js
// 环境变量: DATABASE_URL=postgres://xxx:xxx@xxx:5432/xxx node seed-postgres.js

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ 未设置 DATABASE_URL 环境变量');
  console.error('请设置 Render 或 Supabase 提供的 PostgreSQL 连接字符串');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function main() {
  console.log('连接PostgreSQL...');
  await pool.query('SELECT 1');
  console.log('✅ 已连接');

  // 1. 创建表
  console.log('\n创建数据库表...');
  await pool.query(`
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
  console.log('✅ 表创建完成');

  // 2. 创建管理员
  const adminCheck = await pool.query('SELECT * FROM users WHERE username = $1', ['admin']);
  if (adminCheck.rows.length === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    await pool.query('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', ['admin', hash, 'admin']);
    console.log('✅ 管理员账号已创建: admin / admin123');
  } else {
    console.log('⚠️  管理员账号已存在');
  }

  // 3. 清空旧题目
  await pool.query('DELETE FROM questions');
  console.log('🗑️  已清空旧题目');

  // 4. 导入题目（从JSON备份文件）
  const jsonPath = path.join(__dirname, 'questions-backup.json');
  if (fs.existsSync(jsonPath)) {
    const questions = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    console.log(`\n从JSON文件读取 ${questions.length} 道题目...`);
    
    let count = 0;
    for (const q of questions) {
      await pool.query(`
        INSERT INTO questions (type, content, option_a, option_b, option_c, option_d, answer, explanation)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [q.type, q.content, q.option_a, q.option_b, q.option_c, q.option_d, q.answer, q.explanation]);
      count++;
    }
    console.log(`✅ 成功导入 ${count} 道知识产权题目！`);
  } else {
    console.log('⚠️  未找到 questions-backup.json');
  }

  await pool.end();
  console.log('\n🎉 云端数据库初始化完成！');
}

main().catch(err => {
  console.error('❌ 错误:', err.message);
  process.exit(1);
});
