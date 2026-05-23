const API_BASE = '/api';
let ADMIN_TOKEN = '';
let versions = [];
let editingId = null;

async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (ADMIN_TOKEN) headers['Authorization'] = 'Bearer ' + ADMIN_TOKEN;
  const res = await fetch(API_BASE + path, { ...opts, headers: { ...headers, ...opts.headers } });
  if (!res.ok) throw new Error(await res.text().then(t => t || res.statusText));
  if (res.status === 204) return null;
  return res.json();
}

async function init() {
  ADMIN_TOKEN = localStorage.getItem('admin_token') || '';
  if (!ADMIN_TOKEN) { showLogin(); return; }
  await loadVersions();
}

async function loadVersions() {
  document.getElementById('app').innerHTML = '<div class="loading">加载中...</div>';
  try {
    const data = await api('/versions');
    versions = Array.isArray(data) ? data : [];
    render();
  } catch (e) {
    console.error('Load error:', e.message);
    if (e.message.includes('unauthorized') || e.message.includes('401') || e.message.includes('invalid_token')) {
      localStorage.removeItem('admin_token');
      ADMIN_TOKEN = '';
      showLogin();
    } else {
      document.getElementById('app').innerHTML = '<div class="error">加载失败: ' + e.message + '</div>';
    }
  }
}

function showLogin() {
  document.getElementById('app').innerHTML = '<div class="card"><div class="card-title">管理员登录</div><div class="form-row"><input type="password" id="pwInput" placeholder="管理员密码"></div><button id="loginBtn">登录</button></div>';
  document.getElementById('loginBtn').addEventListener('click', doLogin);
  document.getElementById('pwInput').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('pwInput').focus();
}

async function doLogin() {
  const pw = document.getElementById('pwInput').value;
  try {
    const r = await api('/admin/login', { method: 'POST', body: JSON.stringify({ username: 'admin', password: pw }) });
    ADMIN_TOKEN = r.token;
    localStorage.setItem('admin_token', r.token);
    await loadVersions();
  } catch (e) {
    document.getElementById('app').innerHTML = '<div class="error">登录失败: ' + e.message + '</div>';
  }
}

let showOnlyPublished = false;

function toggleFilter() {
  showOnlyPublished = !showOnlyPublished;
  render();
}

function statusBadge(status) {
  const cls = status === 'published' ? 'published' : status === 'pending_review' ? 'pending_review' : 'draft';
  const label = status === 'published' ? '已发布' : status === 'pending_review' ? '审核中' : '草稿';
  return '<span class="badge ' + cls + '">' + label + '</span>';
}

function dlButton(url, label, cls) {
  if (!url) return '';
  return '<a href="' + url + '" target="_blank" class="dl-link ' + cls + '">' + label + '</a>';
}

function renderForm(v) {
  const isEdit = !!v;
  const ver = v ? v.version : '';
  const changelog = v ? v.changelog : '';
  const dw = v ? (v.downloadUrls && (v.downloadUrls.windows || v.downloadUrl) || '') : '';
  const dl = v ? (v.downloadUrls && v.downloadUrls.linux || '') : '';
  const da = v ? (v.downloadUrls && v.downloadUrls.android || '') : '';
  const di = v ? (v.downloadUrls && v.downloadUrls.ios || '') : '';
  const dwb = v ? (v.downloadUrls && v.downloadUrls.web || '') : '';
  
  let html = '<div class="card">' +
    '<div class="card-title">' + (isEdit ? '编辑版本' : '新建版本') + '</div>' +
    '<div id="formError"></div>' +
    '<div class="form-row"><label>版本号</label><input type="text" id="fVer" value="' + ver + '" placeholder="例如 1.53.0"></div>' +
    '<div class="form-row"><label>更新内容</label><textarea id="fChangelog" placeholder="版本更新说明">' + changelog + '</textarea></div>' +
    '<div class="platform-grid">' +
    '<div class="platform-box"><label>Windows</label><input type="text" id="fWinUrl" value="' + dw + '" placeholder="https://"></div>' +
    '<div class="platform-box"><label>Linux</label><input type="text" id="fLinuxUrl" value="' + dl + '" placeholder="https://"></div>' +
    '<div class="platform-box"><label>Android</label><input type="text" id="fAndroidUrl" value="' + da + '" placeholder="https://"></div>' +
    '<div class="platform-box"><label>iOS</label><input type="text" id="fIosUrl" value="' + di + '" placeholder="https://"></div>' +
    '<div class="platform-box"><label>Web</label><input type="text" id="fWebUrl" value="' + dwb + '" placeholder="https://"></div>' +
    '</div>' +
    '<div style="margin-top:12px" class="btn-group">' +
    '<button class="btn-sm" id="saveBtn">' + (isEdit ? '保存修改' : '创建版本（草稿）') + '</button>' +
    (isEdit ? '<button class="danger btn-sm" id="cancelBtn">取消</button>' : '') +
    '</div></div>';
  return html;
}

async function saveVersion(verId) {
  const version = document.getElementById('fVer').value.trim();
  const changelog = document.getElementById('fChangelog').value.trim();
  const windowsUrl = document.getElementById('fWinUrl').value.trim();
  const linuxUrl = document.getElementById('fLinuxUrl').value.trim();
  const androidUrl = document.getElementById('fAndroidUrl').value.trim();
  const iosUrl = document.getElementById('fIosUrl').value.trim();
  const webUrl = document.getElementById('fWebUrl').value.trim();
  if (!version) { showError('请输入版本号'); return; }
  try {
    if (verId) {
      await api('/versions/' + verId, { method: 'PUT', body: JSON.stringify({ version, changelog, windowsUrl, linuxUrl, androidUrl, iosUrl, webUrl }) });
    } else {
      await api('/versions', { method: 'POST', body: JSON.stringify({ version, changelog, windowsUrl, linuxUrl, androidUrl, iosUrl, webUrl }) });
    }
    editingId = null;
    await loadVersions();
  } catch (e) {
    showError('保存失败: ' + e.message);
  }
}

async function submitReview(ver) {
  try { await api('/versions/' + ver.version + '/submit-review', { method: 'POST' }); await loadVersions(); } catch (e) { showError(e.message); }
}

async function publish(ver) {
  try { await api('/versions/' + ver.version + '/publish', { method: 'POST' }); await loadVersions(); } catch (e) { showError(e.message); }
}

async function deleteVersion(ver) {
  if (!confirm('确定删除版本 ' + ver.version + ' 吗？')) return;
  try { await api('/versions/' + ver.version, { method: 'DELETE' }); await loadVersions(); } catch (e) { showError(e.message); }
}

function editVersion(ver) {
  editingId = ver.version;
  showOnlyPublished = false;
  render();
  document.getElementById('formArea').innerHTML = renderForm(ver);
  document.getElementById('fVer').focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEdit() {
  editingId = null;
  render();
}

function showError(msg) {
  const el = document.getElementById('formError');
  if (el) el.innerHTML = '<div class="error">' + msg + '</div>';
}

function render() {
  let html = '';
  if (!editingId) {
    if (showOnlyPublished) {
      html += '<div class="card" style="text-align:center;padding:12px;background:rgba(210,153,34,0.05);border-color:rgba(210,153,34,0.2)">' +
        '<span>当前仅显示已发布的版本</span> <a href="#" id="showAllLink" style="color:#58a6ff">显示所有版本</a></div>';
    } else {
      html += '<div id="formArea">' + renderForm(null) + '</div>';
    }
  } else {
    html += '<div id="formArea"></div>';
  }
  
  html += '<div class="card" style="padding:12px">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">' +
    '<span style="color:#8b949e;font-size:0.85rem">审核流程：<span class="badge draft">草稿</span> <span class="badge pending_review">审核中</span> <span class="badge published">已发布</span></span>' +
    '<div class="btn-group">' +
    '<button class="btn-sm" id="showAllBtn">全部版本</button>' +
    '<button class="btn-sm" id="showPublishedBtn">仅已发布</button>' +
    '</div></div></div>';
  
  const filteredVersions = showOnlyPublished ? versions.filter(v => v.status === 'published') : versions;
  html += '<div class="card"><div class="card-title">版本列表 (' + filteredVersions.length + '/' + versions.length + ')</div>';
  if (filteredVersions.length === 0) {
    html += '<div class="loading">' + (showOnlyPublished ? '暂无已发布的版本' : '暂无版本') + '</div>';
  } else {
    html += '<table><thead><tr><th>版本号</th><th>更新内容</th><th>状态</th><th>发布日期</th><th>下载链接</th><th>操作</th></tr></thead><tbody id="versionTableBody">';
    for (const v of filteredVersions) {
      const dl = v.downloadUrls || {};
      html += '<tr data-version="' + v.version + '">' +
        '<td style="font-weight:600">v' + v.version + '</td>' +
        '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + (v.changelog || '-') + '</td>' +
        '<td>' + statusBadge(v.status) + '</td>' +
        '<td>' + (v.releaseDate ? new Date(v.releaseDate).toLocaleDateString('zh-CN') : '-') + '</td>' +
        '<td><div class="dl-links">' +
          dlButton(dl.windows, 'Win', 'win') +
          dlButton(dl.linux, 'Linux', 'linux') + 
          dlButton(dl.android, 'APK', 'android') +
          dlButton(dl.ios, 'iOS', 'ios') +
          dlButton(dl.web, 'Web', 'web') +
        '</div></td>' +
        '<td><div class="btn-group">' +
          '<button class="btn-sm success" data-action="edit">编辑</button>' +
          (v.status === 'draft' ? '<button class="btn-sm" data-action="review">提交审核</button>' : '') +
          (v.status === 'pending_review' || v.status === 'draft' ? '<button class="btn-sm success" data-action="publish">发布</button>' : '') +
          '<button class="btn-sm danger" data-action="delete">删除</button>' +
        '</div></td></tr>';
    }
    html += '</tbody></table>';
  }
  html += '</div>';
  document.getElementById('app').innerHTML = html;
  
  // Bind event handlers
  bindEvents();
}

function bindEvents() {
  // Login
  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) loginBtn.addEventListener('click', doLogin);
  const pwInput = document.getElementById('pwInput');
  if (pwInput) {
    pwInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  }
  
  // Filter buttons
  const showAll = document.getElementById('showAllBtn') || document.getElementById('showAllLink');
  if (showAll) showAll.addEventListener('click', function(e) { e.preventDefault(); showOnlyPublished = false; render(); });
  const showPub = document.getElementById('showPublishedBtn');
  if (showPub) showPub.addEventListener('click', function() { showOnlyPublished = true; render(); });
  
  // Save / Cancel
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.addEventListener('click', function() { saveVersion(editingId || ''); });
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', cancelEdit);
  
  // Version table actions
  const tableBody = document.getElementById('versionTableBody');
  if (tableBody) {
    tableBody.addEventListener('click', function(e) {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const row = btn.closest('tr[data-version]');
      const ver = row ? versions.find(x => x.version === row.getAttribute('data-version')) : null;
      if (!ver) return;
      const action = btn.getAttribute('data-action');
      if (action === 'edit') editVersion(ver);
      else if (action === 'review') submitReview(ver);
      else if (action === 'publish') publish(ver);
      else if (action === 'delete') deleteVersion(ver);
    });
  }
}

init();