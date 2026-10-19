const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// 获取进度
router.get('/progress', authenticate, async (req, res) => {
  const userId = req.user.id;

  const answers = await db.query(
    'SELECT question_id, selected, is_correct FROM user_answers WHERE user_id = $1',
    [userId]
  );

  const favorites = await db.query(
    'SELECT question_id FROM favorites WHERE user_id = $1',
    [userId]
  );

  const countRow = await db.get('SELECT COUNT(*) as c FROM questions');
  const questionCount = countRow.c;

  const answeredIds = answers.map(a => a.question_id);
  const correctCount = answers.filter(a => a.is_correct === 1).length;

  res.json({
    success: true,
    answeredIds,
    correctIds: answers.filter(a => a.is_correct === 1).map(a => a.question_id),
    userAnswers: answers,
    favoriteIds: favorites.map(f => f.question_id),
    questionCount,
    answeredCount: answers.length,
    correctCount
  });
});

// 提交答案
router.post('/answer', authenticate, async (req, res) => {
  const { questionId, selected } = req.body;
  const userId = req.user.id;

  if (!questionId || !selected) {
    return res.status(400).json({ success: false, message: '缺少必要参数' });
  }

  const question = await db.get('SELECT * FROM questions WHERE id = $1', [questionId]);
  if (!question) {
    return res.status(404).json({ success: false, message: '题目不存在' });
  }

  const correct = question.answer.toString().toUpperCase() === selected.toString().toUpperCase() ? 1 : 0;

  // PostgreSQL用ON CONFLICT做upsert
  try {
    await db.run(`
      INSERT INTO user_answers (user_id, question_id, selected, is_correct)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(user_id, question_id)
      DO UPDATE SET selected = EXCLUDED.selected, is_correct = EXCLUDED.is_correct, answered_at = CURRENT_TIMESTAMP
    `, [userId, questionId, selected, correct]);
  } catch {
    // SQLite兼容写法
    await db.run('DELETE FROM user_answers WHERE user_id = $1 AND question_id = $2', [userId, questionId]);
    await db.run('INSERT INTO user_answers (user_id, question_id, selected, is_correct) VALUES ($1, $2, $3, $4)', [userId, questionId, selected, correct]);
  }

  res.json({
    success: true,
    isCorrect: correct === 1,
    correctAnswer: question.answer,
    explanation: question.explanation || ''
  });
});

// 收藏/取消收藏
router.post('/favorite', authenticate, async (req, res) => {
  const { questionId } = req.body;
  const userId = req.user.id;

  if (!questionId) {
    return res.status(400).json({ success: false, message: '缺少题目ID' });
  }

  const existing = await db.get(
    'SELECT * FROM favorites WHERE user_id = $1 AND question_id = $2',
    [userId, questionId]
  );

  if (existing) {
    await db.run('DELETE FROM favorites WHERE id = $1', [existing.id]);
    res.json({ success: true, favorited: false });
  } else {
    await db.run('INSERT INTO favorites (user_id, question_id) VALUES ($1, $2)', [userId, questionId]);
    res.json({ success: true, favorited: true });
  }
});

// 重置所有答题记录
router.post('/reset', authenticate, async (req, res) => {
  const userId = req.user.id;
  await db.run('DELETE FROM user_answers WHERE user_id = $1', [userId]);
  res.json({ success: true, message: '已重置答题记录' });
});

module.exports = router;
