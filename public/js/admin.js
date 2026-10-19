// 管理员页面逻辑
const API = window.location.origin;
const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

// 检查登录和角色
if (!token || !userStr) {
  window.location.href = '/index.html';
} else {
  const user = JSON.parse(userStr);
  if (user.role !== 'admin') {
    alert('需要管理员权限');
    window.location.href = '/quiz.html';
  }
}

const messageBox = document.getElementById('message');

function showMessage(msg, type) {
  messageBox.innerHTML = `<div class="auth-message ${type}" style="display:block;">${msg}</div>`;
  setTimeout(() => { messageBox.innerHTML = ''; }, 4000);
}

// 加载统计
async function loadStats() {
  try {
    const res = await fetch(`${API}/api/admin/stats/summary`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('stat-questions').textContent = data.totalQuestions;
      document.getElementById('stat-users').textContent = data.totalUsers;
      document.getElementById('stat-answers').textContent = data.totalAnswers;
    }
  } catch (err) {
    console.error(err);
  }
}

// Excel上传
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', () => {
  uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadArea.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) uploadFile(files[0]);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files.length > 0) uploadFile(e.target.files[0]);
});

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  showMessage('上传中...', 'success');

  try {
    const res = await fetch(`${API}/api/admin/import`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (data.success) {
      showMessage(`✅ ${data.message}`, 'success');
      loadStats();
    } else {
      showMessage(`❌ ${data.message}`, 'error');
    }
  } catch (err) {
    showMessage(`❌ 上传失败：${err.message}`, 'error');
  }
}

// JSON导入
document.getElementById('btn-import-json').addEventListener('click', async () => {
  const text = document.getElementById('json-input').value.trim();
  if (!text) {
    showMessage('请输入JSON内容', 'error');
    return;
  }

  let questions;
  try {
    questions = JSON.parse(text);
  } catch (err) {
    showMessage('JSON格式错误', 'error');
    return;
  }

  try {
    const res = await fetch(`${API}/api/admin/import-json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ questions })
    });
    const data = await res.json();
    if (data.success) {
      showMessage(`✅ ${data.message}`, 'success');
      document.getElementById('json-input').value = '';
      loadStats();
    } else {
      showMessage(`❌ ${data.message}`, 'error');
    }
  } catch (err) {
    showMessage(`❌ 导入失败：${err.message}`, 'error');
  }
});

// 清空题目
document.getElementById('btn-clear').addEventListener('click', async () => {
  if (!confirm('确定要清空所有题目？此操作不可恢复！')) return;
  if (!confirm('请再确认一次：真的要清空所有题目和答题记录吗？')) return;

  try {
    const res = await fetch(`${API}/api/admin/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ confirm: 'DELETE_ALL' })
    });
    const data = await res.json();
    if (data.success) {
      showMessage(`✅ ${data.message}`, 'success');
      loadStats();
    } else {
      showMessage(`❌ ${data.message}`, 'error');
    }
  } catch (err) {
    showMessage(`❌ 操作失败：${err.message}`, 'error');
  }
});

loadStats();
