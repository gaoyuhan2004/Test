const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 获取所有题目
router.get('/', authenticate, async (req, res) => {
  const questions = await db.query('SELECT * FROM questions ORDER BY id ASC');
  res.json({ success: true, data: questions, total: questions.length });
});

// 获取单个题目
router.get('/:id', authenticate, async (req, res) => {
  const q = await db.get('SELECT * FROM questions WHERE id = $1', [req.params.id]);
  if (!q) {
    return res.status(404).json({ success: false, message: '题目不存在' });
  }
  res.json({ success: true, data: q });
});

module.exports = router;
