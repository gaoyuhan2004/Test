const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Excel导入
router.post('/import', authenticate, requireAdmin, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: '请上传Excel文件' });
  }
  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    let count = 0;
    for (const item of rows) {
      await db.run(`
        INSERT INTO questions (type, content, option_a, option_b, option_c, option_d, answer, explanation)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        item.type || 'single',
        item.content,
        item.option_a || '',
        item.option_b || '',
        item.option_c || '',
        item.option_d || '',
        item.answer,
        item.explanation || ''
      ]);
      count++;
    }
    res.json({ success: true, message: `成功导入 ${count} 道题目`, count });
  } catch (err) {
    res.status(500).json({ success: false, message: '导入失败: ' + err.message });
  }
});

// JSON导入
router.post('/import-json', authenticate, requireAdmin, async (req, res) => {
  const questions = req.body.questions;
  if (!Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ success: false, message: '请提供题目数组' });
  }
  try {
    let count = 0;
    for (const item of questions) {
      await db.run(`
        INSERT INTO questions (type, content, option_a, option_b, option_c, option_d, answer, explanation)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        item.type || 'single',
        item.content,
        item.option_a || '',
        item.option_b || '',
        item.option_c || '',
        item.option_d || '',
        item.answer,
        item.explanation || ''
      ]);
      count++;
    }
    res.json({ success: true, message: `成功导入 ${count} 道题目`, count });
  } catch (err) {
    res.status(500).json({ success: false, message: '导入失败: ' + err.message });
  }
});

// 清空所有题目
router.post('/clear', authenticate, requireAdmin, async (req, res) => {
  const { confirm } = req.body;
  if (confirm !== 'DELETE_ALL') {
    return res.status(400).json({ success: false, message: '请确认操作' });
  }
  const result = await db.run('DELETE FROM questions');
  await db.run('DELETE FROM user_answers');
  await db.run('DELETE FROM favorites');
  res.json({ success: true, message: `已删除 ${result.changes} 道题目及相关数据` });
});

// 删除单题
router.delete('/question/:id', authenticate, requireAdmin, async (req, res) => {
  const result = await db.run('DELETE FROM questions WHERE id = $1', [req.params.id]);
  await db.run('DELETE FROM user_answers WHERE question_id = $1', [req.params.id]);
  await db.run('DELETE FROM favorites WHERE question_id = $1', [req.params.id]);
  if (result.changes === 0) {
    return res.status(404).json({ success: false, message: '题目不存在' });
  }
  res.json({ success: true, message: '删除成功' });
});

// 统计
router.get('/stats/summary', authenticate, requireAdmin, async (req, res) => {
  const q1 = await db.get('SELECT COUNT(*) as c FROM questions');
  const q2 = await db.get("SELECT COUNT(*) as c FROM users WHERE role = 'student'");
  const q3 = await db.get('SELECT COUNT(*) as c FROM user_answers');
  res.json({
    success: true,
    totalQuestions: q1.c,
    totalUsers: q2.c,
    totalAnswers: q3.c
  });
});

module.exports = router;
