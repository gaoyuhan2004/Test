// 登录/注册页面逻辑
const API = window.location.origin;

const authForm = document.getElementById('auth-form');
const tabs = document.querySelectorAll('.auth-tab');
const subtitle = document.getElementById('auth-subtitle');
const confirmGroup = document.getElementById('confirm-password-group');
const submitBtn = document.getElementById('submit-btn');
const messageBox = document.getElementById('auth-message');

let currentMode = 'login';

// 切换登录/注册
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    currentMode = tab.dataset.mode;
    tabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    if (currentMode === 'login') {
      subtitle.textContent = '欢迎回来，请登录';
      submitBtn.textContent = '登录';
      confirmGroup.style.display = 'none';
    } else {
      subtitle.textContent = '创建账号，开始刷题之旅';
      submitBtn.textContent = '注册';
      confirmGroup.style.display = 'block';
    }
    hideMessage();
    authForm.reset();
  });
});

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideMessage();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  if (!username || !password) {
    showMessage('请填写完整信息', 'error');
    return;
  }

  if (currentMode === 'register') {
    const confirmPassword = document.getElementById('confirm-password').value;
    if (password !== confirmPassword) {
      showMessage('两次输入的密码不一致', 'error');
      return;
    }
    if (password.length < 4) {
      showMessage('密码至少4位', 'error');
      return;
    }
  }

  submitBtn.disabled = true;
  submitBtn.textContent = '处理中...';

  try {
    const endpoint = currentMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(`${API}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      // 保存token和用户信息
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      showMessage(currentMode === 'login' ? '登录成功，正在跳转...' : '注册成功，正在登录...', 'success');
      
      setTimeout(() => {
        // 根据角色跳转
        if (data.user.role === 'admin') {
          window.location.href = '/admin.html';
        } else {
          window.location.href = '/quiz.html';
        }
      }, 600);
    } else {
      showMessage(data.message || '操作失败', 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = currentMode === 'login' ? '登录' : '注册';
    }
  } catch (err) {
    showMessage('网络错误，请稍后重试', 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = currentMode === 'login' ? '登录' : '注册';
  }
});

function showMessage(msg, type) {
  messageBox.textContent = msg;
  messageBox.className = `auth-message ${type}`;
  messageBox.style.display = ''; // 清除hideMessage留下的display:none，确保提示可见
}

function hideMessage() {
  messageBox.className = 'auth-message';
  messageBox.style.display = 'none';
}
