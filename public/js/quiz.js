// 刷题页面逻辑
const API = window.location.origin;
const token = localStorage.getItem('token');
const userStr = localStorage.getItem('user');

// 检查登录
if (!token || !userStr) {
  window.location.href = '/index.html';
}

const user = JSON.parse(userStr);
document.getElementById('user-name').textContent = `👤 ${user.username}`;

// 退出登录
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
});

// 状态
let questions = [];
let progress = { answeredIds: [], favoriteIds: [], userAnswers: [] };
let currentIndex = -1;

const questionGrid = document.getElementById('question-grid');
const questionContainer = document.getElementById('question-container');
const emptyState = document.getElementById('empty-state');
const progressSummary = document.getElementById('progress-summary');

// 移动端菜单
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

document.getElementById('menu-btn').addEventListener('click', () => {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
});

sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
});

// 初始化
async function init() {
  try {
    // 获取题目列表
    const qRes = await fetch(`${API}/api/questions/`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const qData = await qRes.json();

    if (!qData.success || qData.data.length === 0) {
      emptyState.style.display = 'flex';
      return;
    }

    questions = qData.data;

    // 获取进度
    const pRes = await fetch(`${API}/api/user/progress`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const pData = await pRes.json();
    if (pData.success) progress = pData;

    emptyState.style.display = 'none';
    questionContainer.style.display = 'block';

    renderGrid();
    updateProgressSummary();

    // 默认选中第一题
    if (questions.length > 0) {
      selectQuestion(0);
    }
  } catch (err) {
    console.error(err);
    alert('加载失败：' + err.message);
  }
}

function renderGrid() {
  questionGrid.innerHTML = '';
  questions.forEach((q, idx) => {
    const btn = document.createElement('button');
    btn.className = 'q-btn';
    btn.textContent = idx + 1;

    if (progress.favoriteIds.includes(q.id)) {
      btn.classList.add('favorited');
    }
    if (progress.answeredIds.includes(q.id)) {
      btn.classList.add('done');
    }

    btn.addEventListener('click', () => selectQuestion(idx));
    questionGrid.appendChild(btn);
  });
}

function updateProgressSummary() {
  const total = questions.length;
  const answered = progress.answeredIds.length;
  const correctCount = progress.userAnswers.filter(a => a.is_correct === 1).length;
  progressSummary.innerHTML = `进度 ${answered}/${total} · 正确 ${correctCount}/${answered}`;
}

function selectQuestion(index) {
  currentIndex = index;
  const q = questions[index];

  // 更新网格选中状态
  document.querySelectorAll('.q-btn').forEach((btn, i) => {
    btn.classList.toggle('current', i === index);
  });

  // 移动端自动关闭菜单
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('show');
  }

  renderQuestion(q);
}

function renderQuestion(q) {
  // 查找用户答案
  const userAnswer = progress.userAnswers.find(a => a.question_id === q.id);
  const isFavorited = progress.favoriteIds.includes(q.id);
  const answered = !!userAnswer;

  const typeLabel = q.type === 'judge' ? '判断题' : '单选题';

  // 构建选项
  let optionsHTML = '';
  if (q.type === 'judge') {
    optionsHTML = `
      <div class="option" data-value="TRUE"><div class="option-letter">✓</div><div class="option-text">正确</div></div>
      <div class="option" data-value="FALSE"><div class="option-letter">✗</div><div class="option-text">错误</div></div>
    `;
  } else {
    const opts = [
      { key: 'A', text: q.option_a },
      { key: 'B', text: q.option_b },
      { key: 'C', text: q.option_c },
      { key: 'D', text: q.option_d }
    ].filter(o => o.text);

    optionsHTML = opts.map(o => `
      <div class="option" data-value="${o.key}"><div class="option-letter">${o.key}</div><div class="option-text">${o.text}</div></div>
    `).join('');
  }

  // 如果已答题，显示正确/错误状态
  if (answered) {
    const correctAns = q.answer.toUpperCase();
    const selectedAns = userAnswer.selected.toUpperCase();

    let resultBannerClass = userAnswer.is_correct === 1 ? 'correct' : 'wrong';
    let resultText = userAnswer.is_correct === 1
      ? '✅ 回答正确！'
      : `❌ 回答错误，正确答案是 ${correctAns}`;

    questionContainer.innerHTML = `
      <div class="question-card">
        <div class="question-meta">
          <span class="q-number">第 ${currentIndex + 1} 题 / 共 ${questions.length} 题</span>
          <span class="q-type">${typeLabel}</span>
          <button class="btn-favorite ${isFavorited ? 'favorited' : ''}" id="btn-fav">
            ${isFavorited ? '⭐ 已收藏' : '☆ 收藏'}
          </button>
        </div>

        <div class="result-banner ${resultBannerClass} show" id="result-banner">${resultText}</div>

        <div class="question-content">${q.content}</div>

        <div class="options" id="options">
          ${optionsHTML}
        </div>

        ${q.explanation ? `
          <div class="answer-explanation show" id="explanation">
            <div class="explanation-title">📖 答案解析</div>
            <div class="explanation-content">${q.explanation}</div>
          </div>
        ` : ''}

        <div class="action-buttons">
          <button class="btn-submit answered" id="btn-resubmit" style="display:none;">重新作答</button>
        </div>
      </div>
    `;

    // 标记选项状态
    const optionElements = document.querySelectorAll('.option');
    optionElements.forEach(el => {
      const val = el.dataset.value.toUpperCase();
      el.classList.add('disabled');
      if (val === correctAns) {
        el.classList.add('correct');
      } else if (val === selectedAns && val !== correctAns) {
        el.classList.add('wrong');
      }
    });

    bindFavButton(q.id);

  } else {
    // 未答题状态
    questionContainer.innerHTML = `
      <div class="question-card">
        <div class="question-meta">
          <span class="q-number">第 ${currentIndex + 1} 题 / 共 ${questions.length} 题</span>
          <span class="q-type">${typeLabel}</span>
          <button class="btn-favorite ${isFavorited ? 'favorited' : ''}" id="btn-fav">
            ${isFavorited ? '⭐ 已收藏' : '☆ 收藏'}
          </button>
        </div>

        <div class="question-content">${q.content}</div>

        <div class="options" id="options">
          ${optionsHTML}
        </div>

        <div class="answer-explanation" id="explanation">
          <div class="explanation-title">📖 答案解析</div>
          <div class="explanation-content" id="explanation-text"></div>
        </div>

        <div class="action-buttons">
          <button class="btn-submit" id="btn-submit" disabled>提交答案</button>
        </div>
      </div>
    `;

    let selectedOption = null;
    const submitBtn = document.getElementById('btn-submit');

    document.querySelectorAll('.option').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('.option').forEach(e => e.classList.remove('selected'));
        el.classList.add('selected');
        selectedOption = el.dataset.value;
        submitBtn.disabled = false;
      });
    });

    submitBtn.addEventListener('click', () => submitAnswer(q.id, selectedOption));
    bindFavButton(q.id);
  }
}

async function submitAnswer(questionId, selected) {
  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = '提交中...';

  try {
    const res = await fetch(`${API}/api/user/answer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ questionId, selected })
    });
    const data = await res.json();

    if (data.success) {
      // 更新本地状态
      if (!progress.answeredIds.includes(questionId)) {
        progress.answeredIds.push(questionId);
      }
      // 找到这道题的正确答案
      const q = questions.find(x => x.id === questionId);
      const existingIdx = progress.userAnswers.findIndex(a => a.question_id === questionId);
      const answerRecord = {
        question_id: questionId,
        selected,
        is_correct: data.isCorrect ? 1 : 0
      };
      if (existingIdx >= 0) {
        progress.userAnswers[existingIdx] = answerRecord;
      } else {
        progress.userAnswers.push(answerRecord);
      }

      renderGrid();
      updateProgressSummary();
      // 重新渲染题目（已答题状态）
      const idx = questions.findIndex(x => x.id === questionId);
      renderQuestion(q);
    }
  } catch (err) {
    alert('提交失败：' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = '提交答案';
  }
}

function bindFavButton(questionId) {
  const favBtn = document.getElementById('btn-fav');
  favBtn.addEventListener('click', async () => {
    try {
      const res = await fetch(`${API}/api/user/favorite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ questionId })
      });
      const data = await res.json();

      // 更新本地收藏状态
      const favIdx = progress.favoriteIds.indexOf(questionId);
      if (data.favorited && favIdx === -1) {
        progress.favoriteIds.push(questionId);
      } else if (!data.favorited && favIdx !== -1) {
        progress.favoriteIds.splice(favIdx, 1);
      }

      favBtn.classList.toggle('favorited', data.favorited);
      favBtn.innerHTML = data.favorited ? '⭐ 已收藏' : '☆ 收藏';

      // 更新网格
      renderGrid();
      // 保持当前选中高亮
      if (currentIndex >= 0) {
        document.querySelectorAll('.q-btn').forEach((btn, i) => {
          btn.classList.toggle('current', i === currentIndex);
        });
      }
    } catch (err) {
      alert('操作失败：' + err.message);
    }
  });
}

// 启动
init();
