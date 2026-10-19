const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// 注册
router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }

  if (username.length < 2 || username.length > 20) {
    return res.status(400).json({ success: false, message: '用户名长度需在2-20之间' });
  }

  if (password.length < 4 || password.length > 50) {
    return res.status(400).json({ success: false, message: '密码长度需在4-50之间' });
  }

  const existing = await db.get('SELECT * FROM users WHERE username = $1', [username]);
  if (existing) {
    return res.status(400).json({ success: false, message: '该用户名已被注册' });
  }

  const hash = bcrypt.hashSync(password, 10);
  await db.run('INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3)', [username, hash, 'student']);
  const newUser = await db.get('SELECT id, username, role FROM users WHERE username = $1', [username]);

  const token = jwt.sign(
    { id: newUser.id, username: newUser.username, role: 'student' },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    success: true,
    message: '注册成功',
    token,
    user: { id: newUser.id, username, role: 'student' }
  });
});

// 登录
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
  }

  const user = await db.get('SELECT * FROM users WHERE username = $1', [username]);
  if (!user) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  res.json({
    success: true,
    message: '登录成功',
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

// 获取当前用户信息
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  
  if (!token) return res.json({ success: false, user: null });
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await db.get('SELECT id, username, role FROM users WHERE id = $1', [decoded.id]);
    if (!user) return res.json({ success: false, user: null });
    res.json({ success: true, user });
  } catch {
    res.json({ success: false, user: null });
  }
});

module.exports = router;
