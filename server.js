const express = require('express');
const cors = require('cors');
const path = require('path');

// 导入db（本地自动SQLite，云端自动PostgreSQL）
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 静态文件
app.use(express.static(path.join(__dirname, 'public')));

// 路由
const authRoutes = require('./routes/auth');
const questionRoutes = require('./routes/questions');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    time: new Date().toISOString(),
    db: db.isPostgres ? 'PostgreSQL' : 'SQLite',
    env: process.env.NODE_ENV || 'development'
  });
});

// 初始化数据库表（如果是PostgreSQL模式）
async function start() {
  if (typeof db.init === 'function') {
    try {
      await db.init();
    } catch (err) {
      console.error('数据库初始化警告:', err.message);
    }
  }

  app.listen(PORT, () => {
    console.log('========================================');
    console.log('  🎯 刷题服务器已启动！');
    console.log(`  📡 本地访问: http://localhost:${PORT}`);
    console.log(`  🗄️  数据库: ${db.isPostgres ? 'PostgreSQL (云端)' : 'SQLite (本地)'}`);
    console.log('========================================');
    console.log('按 Ctrl+C 停止服务器');
  });
}

start();
