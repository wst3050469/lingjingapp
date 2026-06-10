/* === 灵境管理后台 v2.1 — 零CDN纯原生实现 === */
var API_BASE = '/admin/api';
var _token = localStorage.getItem('lingjing_admin_token') || '';
var _page = 'dashboard';

function api(method, path, body) {
  var opts = { method: method, headers: { 'Content-Type': 'application/json' } };
  if (_token) opts.headers['Authorization'] = 'Bearer ' + _token;
  if (body) opts.body = JSON.stringify(body);
  return fetch(API_BASE + path, opts).then(function(r) {
    if (r.status === 401) { doLogout(); throw new Error('登录已过期，请重新登录'); }
    if (!r.ok) { return r.json().then(function(d) { throw new Error(d.error || 'HTTP ' + r.status); }); }
    return r.json();
  });
}

function toast(msg, isError) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' error' : '');
  t.style.display = 'block';
  setTimeout(function() { t.style.display = 'none'; }, 3000);
}

function showModal(title, bodyHTML, footerHTML) {
  var o = document.getElementById('modalOverlay');
  o.innerHTML = '<div class="modal"><div class="modal-header"><span>' + title + '</span><button class="btn-sm" onclick="closeModal()" style="float:right">X</button></div><div class="modal-body">' + bodyHTML + '</div><div class="modal-footer">' + (footerHTML || '<button class="btn-sm" onclick="closeModal()">关闭</button>') + '</div></div>';
  o.className = 'modal-overlay';
}
function closeModal() {
  document.getElementById('modalOverlay').className = 'modal-overlay hidden';
}
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

// ====== LOGIN ======
function doLogin() {
  var u = $('#loginUser').value.trim() || 'admin';
  var p = $('#loginPwd').value.trim();
  if (!p) { showLoginError('请输入密码'); return; }
  var btn = $('#loginBtn');
  btn.disabled = true; btn.textContent = '登录中...';
  fetch('/admin/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p })
  }).then(function(r) { return r.json(); })
  .then(function(d) {
    if (d.token) { _token = d.token; localStorage.setItem('lingjing_admin_token', d.token); enterApp(); }
    else if (d.ok) { enterApp(); }
    else { showLoginError(d.error || '登录失败'); }
  }).catch(function(e) { showLoginError(e.message || '网络错误'); })
  .finally(function() { btn.disabled = false; btn.textContent = '登录'; });
}

function showLoginError(msg) { var e = $('#loginError'); e.textContent = msg; e.style.display = 'block'; }

function doLogout() {
  localStorage.removeItem('lingjing_admin_token');
  _token = '';
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('loginScreen').style.display = 'flex';
  $('#loginPwd').value = '';
  $('#loginError').style.display = 'none';
}

function enterApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  buildNav(); navigate('dashboard');
}

// ====== SESSION CHECK (startup) ======
(function() {
  try {
    if (_token) {
      fetch(API_BASE + '/stats', { headers: { 'Authorization': 'Bearer ' + _token } })
        .then(function(r) { if (r.ok) return r.json(); throw new Error('invalid'); })
        .then(function() { enterApp(); })
        .catch(function() { /* token invalid, stay on login */ });
    }
  } catch(e) { console.error('Admin init error:', e); /* never block login screen */ }
})();

// ====== NAVIGATION ======
var navItems = [
  { key: 'dashboard', icon: '📊', label: '数据总览' },
  { key: 'devices',   icon: '📱', label: '设备管理' },
  { key: 'sessions',  icon: '💬', label: '会话管理' },
  { key: 'memories',  icon: '🧠', label: '记忆管理' },
  { sep: true },
  { key: 'tenants',   icon: '', label: '　租户管理', sub: true },
  { key: 'apikeys',   icon: '', label: '　API密钥', sub: true },
  { key: 'config',    icon: '', label: '　系统配置', sub: true },
  { key: 'users',     icon: '', label: '　用户管理', sub: true },
  { sep: true },
  { key: 'plans',     icon: '', label: '　订阅套餐', sub: true },
  { key: 'payments',  icon: '', label: '　支付记录', sub: true },
  { key: 'invoices',  icon: '', label: '　发票管理', sub: true },
  { key: 'skills',    icon: '', label: '　技能审核', sub: true },
  { sep: true },
  { key: 'defects',   icon: '🐛', label: '缺陷追踪' },
  { key: 'logs',      icon: '📜', label: '系统日志' },
  { key: 'schedules', icon: '⏰', label: '定时任务' },
];

function buildNav() {
  var h = '';
  navItems.forEach(function(item) {
    if (item.sep) { h += '<div style="border-top:1px solid #21262d;margin:6px 0"></div>'; return; }
    h += '<a href="#" onclick="navigate(\'' + item.key + '\');return false" data-page="' + item.key + '"' + (item.sub ? ' class="sub"' : '') + '>' + (item.icon ? item.icon + ' ' : '') + item.label + '</a>';
  });
  document.getElementById('sideNav').innerHTML = h;
}

var pageTitles = {
  dashboard:'数据总览', devices:'设备管理', sessions:'会话管理', memories:'记忆管理',
  tenants:'租户管理', apikeys:'API密钥', config:'系统配置', users:'用户管理',
  plans:'订阅套餐', payments:'支付记录', invoices:'发票管理', skills:'技能审核',
  defects:'缺陷追踪', logs:'系统日志', schedules:'定时任务'
};

var renderers = {};

function navigate(key) {
  _page = key;
  $$('.sidebar-nav a').forEach(function(a) { a.classList.remove('active'); });
  var el = document.querySelector('.sidebar-nav a[data-page="' + key + '"]');
  if (el) el.classList.add('active');
  document.getElementById('pageTitle').textContent = pageTitles[key] || key;
  (renderers[key] || renderDashboard)();
}

// ====== DASHBOARD ======
renderers.dashboard = function() {
  var c = document.getElementById('pageContent');
  c.innerHTML = '<div class="loading">加载中...</div>';
  api('GET', '/stats').then(function(d) {
    c.innerHTML =
      '<div class="stats">' +
      statCard('📊', d.totalDevices || 0, '注册设备') +
      statCard('💬', d.activeSessions || 0, '活跃会话') +
      statCard('🧠', d.totalMemories || 0, '持久化记忆') +
      statCard('📋', d.totalPlans || 0, '订阅套餐') +
      statCard('🐛', d.openDefects || 0, '未修复缺陷') +
      statCard('💰', d.totalPayments || 0, '支付记录') +
      '</div>' +
      '<div class="card"><div class="card-title">快捷操作</div><div class="quick-actions">' +
      qa('📱','设备管理','devices') + qa('💬','会话管理','sessions') +
      qa('📦','订阅套餐','plans') + qa('📜','系统日志','logs') +
      qa('⚙️','系统配置','config') + qa('🛒','技能审核','skills') +
      '</div></div>';
  }).catch(function(e) { c.innerHTML = '<div class="empty">加载失败: ' + e.message + '</div>'; });
};

function statCard(icon, val, label) {
  return '<div class="stat-card"><div style="font-size:24px;flex-shrink:0">' + icon + '</div><div><div class="stat-value">' + (val||0) + '</div><div class="stat-label">' + label + '</div></div></div>';
}
function qa(icon, label, key) {
  return '<div class="qa-btn" onclick="navigate(\'' + key + '\')"><div class="qa-icon">' + icon + '</div><div class="qa-label">' + label + '</div></div>';
}

console.log('[Admin] v2.1 零CDN管理后台已就绪');
