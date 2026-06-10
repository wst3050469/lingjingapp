// CrudConfigs and remaining page handlers

// === CRUD ENGINE ===
var renderers = renderers || {};
try {
function renderCrud() {
  var c = document.getElementById('pageContent');
  var cfg = crudConfigs[_page] || {};
  if (!cfg.path) { c.innerHTML = '<div class="empty">模块配置缺失</div>'; return; }
  c.innerHTML = '<div class="loading">加载中...</div>';
  api('GET', cfg.path).then(function(d) {
    var arr = Array.isArray(d) ? d : (d.data || d[cfg.listKey || ''] || []);
    c.innerHTML = buildCrudHTML(cfg, arr);
  }).catch(function(e) { c.innerHTML = '<div class="empty">加载失败: ' + e.message + '</div>'; });
}
function buildCrudHTML(cfg, arr) {
  var html = '<div class="toolbar"><span style="font-size:14px;color:#c9d1d9;font-weight:600">' + cfg.title + '</span>';
  if (cfg.fields) html += '<div style="display:flex;gap:8px"><input id="crudSearch" placeholder="搜索..." onkeyup="filterCrud()" style="width:160px;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:6px 12px;border-radius:6px;font-size:12px">' + (cfg.canCreate ? '<button class="btn-sm primary" onclick="openForm()">新增</button>' : '') + '</div>';
  html += '</div><table id="crudTable"><thead><tr>' + cfg.columns.map(function(c) { return '<th>' + c.label + '</th>'; }).join('') + '<th>操作</th></tr></thead><tbody>';
  if (!arr || arr.length === 0) { html += '</tbody></table><div class="empty">' + (cfg.emptyText || '暂无数据') + '</div>'; return html; }
  arr.forEach(function(row) {
    html += '<tr>';
    cfg.columns.forEach(function(c) { html += '<td>' + formatVal(row[c.key], c) + '</td>'; });
    html += '<td><button class="btn-sm" onclick="openForm(\'' + row.id + '\')">编辑</button> <button class="btn-sm danger" onclick="deleteItem(\'' + row.id + '\')">删除</button></td></tr>';
  });
  html += '</tbody></table>';
  return html;
}
function filterCrud() {
  var s = (document.getElementById('crudSearch') || {}).value || '';
  var rows = document.querySelectorAll('#crudTable tbody tr');
  rows.forEach(function(r) { r.style.display = s && r.textContent.toLowerCase().indexOf(s.toLowerCase()) === -1 ? 'none' : ''; });
}
var _editingId = null;
function openForm(id) {
  var cfg = crudConfigs[_page];
  var d = {};
  _editingId = id || null;
  if (cfg.fields) cfg.fields.forEach(function(f) { d[f.key] = ''; });
  var body = '';
  if (cfg.fields) cfg.fields.forEach(function(f) {
    body += '<div style="margin-bottom:8px"><label style="font-size:11px;color:#8b949e;display:block;margin-bottom:3px">' + f.label + (f.required ? ' *' : '') + '</label>';
    if (f.type === 'select') {
      body += '<select id="fld_' + f.key + '" style="width:100%;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:8px;border-radius:6px;font-size:13px;box-sizing:border-box">' + f.options.map(function(o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('') + '</select>';
    } else if (f.type === 'textarea') {
      body += '<textarea id="fld_' + f.key + '" style="width:100%;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:8px;border-radius:6px;font-size:13px;min-height:80px;box-sizing:border-box"></textarea>';
    } else {
      body += '<input id="fld_' + f.key + '" style="width:100%;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:8px 10px;border-radius:6px;font-size:13px;box-sizing:border-box"' + (f.type === 'number' ? ' type="number"' : '') + '>';
    }
    body += '</div>';
  });
  showModal(id ? '编辑' : '新增', body, '<button class="btn-sm primary" onclick="saveForm()">保存</button><button class="btn-sm" onclick="closeModal()">取消</button>');
}
function saveForm() {
  var cfg = crudConfigs[_page], d = {};
  cfg.fields.forEach(function(f) { var el = document.getElementById('fld_' + f.key); d[f.key] = el ? el.value : ''; });
  var method = _editingId ? 'PUT' : 'POST';
  var url = cfg.path + (_editingId ? '/' + _editingId : '');
  api(method, url, d).then(function() { closeModal(); renderCrud(); toast(_editingId ? '更新成功' : '创建成功'); }).catch(function(e) { toast(e.message, true); });
}
function deleteItem(id) {
  if (!confirm('确定删除?')) return;
  api('DELETE', crudConfigs[_page].path + '/' + id).then(function() { renderCrud(); toast('已删除'); }).catch(function(e) { toast(e.message, true); });
}
function formatVal(v, c) {
  if (c.format === 'time' && v) v = new Date(v).toLocaleString('zh-CN');
  if (c.format === 'tag') { var colors = { approved: 'success', pending: 'warning', rejected: 'danger', paid: 'success', active: 'success', inactive: 'danger', critical: 'danger', high: 'danger', medium: 'warning', low: 'info' }; return '<span class="tag tag-' + (colors[v] || 'info') + '">' + (v || '未知') + '</span>'; }
  return v || '-';
}

var crudConfigs = {
  devices: {title:'设备管理',path:'/devices',canCreate:true,listKey:'data',
    columns:[{key:'id',label:'设备ID'},{key:'name',label:'名称'},{key:'platform',label:'平台'},{key:'last_seen',label:'最后在线',format:'time'}],
    fields:[{key:'name',label:'设备名称',required:true},{key:'platform',label:'平台',type:'select',options:[{value:'ios',label:'iOS'},{value:'android',label:'Android'},{value:'web',label:'Web'}]}]},
  sessions:{title:'会话管理',path:'/sessions',canCreate:false,listKey:'data',
    columns:[{key:'id',label:'ID'},{key:'title',label:'标题'},{key:'type',label:'类型'},{key:'status',label:'状态',format:'tag'},{key:'updated_at',label:'更新时间',format:'time'}]},
  memories:{title:'记忆管理',path:'/memories',canCreate:true,listKey:'data',
    columns:[{key:'id',label:'ID'},{key:'key',label:'Key'},{key:'value',label:'Value'},{key:'category',label:'分类'},{key:'updated_at',label:'更新时间',format:'time'}],
    fields:[{key:'key',label:'Key',required:true},{key:'value',label:'Value',type:'textarea'},{key:'category',label:'分类'}]},
  tenants:{title:'租户管理',path:'/tenants',canCreate:true,listKey:'data',
    columns:[{key:'id',label:'ID'},{key:'name',label:'名称'},{key:'domain',label:'域名'},{key:'plan',label:'套餐'},{key:'status',label:'状态',format:'tag'},{key:'created_at',label:'创建时间',format:'time'}],
    fields:[{key:'name',label:'名称',required:true},{key:'domain',label:'域名'},{key:'plan',label:'套餐'}]},
  apikeys:{title:'API密钥',path:'/api-keys',canCreate:true,listKey:'data',
    columns:[{key:'id',label:'ID'},{key:'name',label:'名称'},{key:'key',label:'密钥'},{key:'created_at',label:'创建时间',format:'time'}],
    fields:[{key:'name',label:'名称',required:true}]},
  users:{title:'用户管理',path:'/users',canCreate:true,listKey:'data',
    columns:[{key:'id',label:'ID'},{key:'username',label:'用户名'},{key:'email',label:'邮箱'},{key:'role',label:'角色'},{key:'created_at',label:'注册时间',format:'time'}],
    fields:[{key:'username',label:'用户名',required:true},{key:'email',label:'邮箱'},{key:'password',label:'密码'},{key:'role',label:'角色',type:'select',options:[{value:'admin',label:'管理员'},{value:'user',label:'用户'}]}]},
  plans:{title:'订阅套餐',path:'/plans',canCreate:true,listKey:'data',
    columns:[{key:'id',label:'ID'},{key:'name',label:'名称'},{key:'price',label:'价格'},{key:'billing_cycle',label:'周期'},{key:'status',label:'状态',format:'tag'}],
    fields:[{key:'name',label:'名称',required:true},{key:'price',label:'价格',required:true},{key:'billing_cycle',label:'周期',type:'select',options:[{value:'monthly',label:'月付'},{value:'yearly',label:'年付'}]}]},
  invoices:{title:'发票管理',path:'/invoices',canCreate:false,listKey:'data',
    columns:[{key:'id',label:'ID'},{key:'invoice_no',label:'发票号'},{key:'amount',label:'金额'},{key:'status',label:'状态',format:'tag'},{key:'created_at',label:'创建时间',format:'time'}]},
  defects:{title:'缺陷追踪',path:'/defects',canCreate:true,listKey:'data',
    columns:[{key:'id',label:'ID'},{key:'title',label:'标题'},{key:'severity',label:'严重程度',format:'tag'},{key:'status',label:'状态',format:'tag'},{key:'created_at',label:'创建时间',format:'time'}],
    fields:[{key:'title',label:'标题',required:true},{key:'description',label:'描述',type:'textarea'},{key:'severity',label:'严重程度',type:'select',options:[{value:'critical',label:'致命'},{value:'high',label:'高'},{value:'medium',label:'中'},{value:'low',label:'低'}]}]},
  schedules:{title:'定时任务',path:'/schedules',canCreate:true,listKey:'data',
    columns:[{key:'id',label:'ID'},{key:'name',label:'名称'},{key:'cron_expr',label:'Cron'},{key:'action_type',label:'动作'},{key:'status',label:'状态',format:'tag'},{key:'next_run',label:'下次执行',format:'time'}],
    fields:[{key:'name',label:'名称',required:true},{key:'cron_expr',label:'Cron表达式',required:true},{key:'action_type',label:'动作',type:'select',options:[{value:'backup',label:'备份'},{value:'cleanup',label:'清理'},{value:'sync',label:'同步'},{value:'report',label:'报告'}]}]}
};

function renderConfig(){
  var c=document.getElementById('pageContent');
  c.innerHTML='<div class="loading">加载中...</div>';
  api('GET','/config').then(function(d){
    var html='<div class="card"><div class="card-title">系统配置</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">'+
      formInput('appName','应用名称','',d.appName||'灵境IDE')+
      formInput('maxDevices','最大设备数','number',d.maxDevices||5)+
      formInput('sessionTimeout','会话超时(秒)','number',d.sessionTimeout||3600)+
      formSelect('logLevel','日志级别',['debug','info','warn','error'],d.logLevel||'info')+
      formSelect('maintenanceMode','维护模式',['on','off'],d.maintenanceMode||'off')+
      '</div>'+
      '<button class="btn-sm primary" onclick="saveConfig()" style="margin-top:12px">保存配置</button>'+
      '</div>';
    c.innerHTML=html;
  }).catch(function(e){c.innerHTML='<div class="empty">'+e.message+'</div>'});
}
function saveConfig(){
  var d={};
  ['appName','maxDevices','sessionTimeout','logLevel','maintenanceMode'].forEach(function(k){
    var el=document.getElementById('cfg_'+k);d[k]=el?el.value:'';
  });
  api('PUT','/config',d).then(function(){toast('配置已保存')}).catch(function(e){toast(e.message,true)});
}
function formInput(key,label,type,val){
  return '<div><label style="font-size:11px;color:#8b949e;display:block;margin-bottom:4px">'+label+'</label><input id="cfg_'+key+'" value="'+escapeHtml(String(val||''))+'"'+(type==='number'?' type="number"':'')+' style="width:100%;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:8px 10px;border-radius:6px;font-size:13px;box-sizing:border-box"></div>';
}
function formSelect(key,label,opts,val){
  var o='';opts.forEach(function(v){o+='<option value="'+v+'"'+(v===val?' selected':'')+'>'+v+'</option>'});
  return '<div><label style="font-size:11px;color:#8b949e;display:block;margin-bottom:4px">'+label+'</label><select id="cfg_'+key+'" style="width:100%;background:#0d1117;border:1px solid #30363d;color:#c9d1d9;padding:8px 10px;border-radius:6px;font-size:13px">'+o+'</select></div>';
}
function renderPayments(){
  var c=document.getElementById('pageContent');
  c.innerHTML='<div class="loading">加载中...</div>';
  api('GET','/payments').then(function(d){
    var arr=Array.isArray(d)?d:(d.payments||d.data||[]);
    var html='<div class="toolbar"><h3 style="font-size:14px;color:#c9d1d9;margin:0">支付记录</h3></div>';
    html+='<table><thead><tr><th>ID</th><th>套餐</th><th>金额</th><th>状态</th><th>时间</th><th>操作</th></tr></thead><tbody>';
    arr.forEach(function(p){
      html+='<tr><td>'+p.id+'</td><td>'+p.plan_id+'</td><td>'+p.amount+'</td><td>'+renderTag(p.status)+'</td><td>'+formatDate(p.created_at)+'</td><td>'+(p.status==='pending'?'<button class="btn-sm success" onclick="verifyPayment(\''+p.id+'\')">确认收款</button>':'')+'</td></tr>';
    });
    html+='</tbody></table>';
    if(arr.length===0)html+='<div class="empty">暂无支付记录</div>';
    c.innerHTML=html;
  }).catch(function(e){c.innerHTML='<div class="empty">'+e.message+'</div>'});
}
function verifyPayment(id){
  api('PUT','/payments/'+id+'/verify').then(function(){renderPayments();toast('已确认收款')}).catch(function(e){toast(e.message,true)});
}
function renderSkills(){
  var c=document.getElementById('pageContent');
  c.innerHTML='<div class="loading">加载中...</div>';
  api('GET','/skills').then(function(d){
    var arr=Array.isArray(d)?d:(d.data||[]);
    var html='<div class="toolbar"><h3 style="font-size:14px;color:#c9d1d9;margin:0">技能审核</h3></div>';
    html+='<table><thead><tr><th>ID</th><th>名称</th><th>作者</th><th>分类</th><th>状态</th><th>操作</th></tr></thead><tbody>';
    arr.forEach(function(s){
      html+='<tr><td>'+s.id+'</td><td>'+s.name+'</td><td>'+(s.author||'')+'</td><td>'+(s.category||'')+'</td><td>'+renderTag(s.status)+'</td><td>'+(s.status==='pending'?'<button class="btn-sm success" onclick="reviewSkill(\''+s.id+'\',\'approved\')">通过</button> <button class="btn-sm danger" onclick="reviewSkill(\''+s.id+'\',\'rejected\')">拒绝</button>':'')+'</td></tr>';
    });
    html+='</tbody></table>';
    if(arr.length===0)html+='<div class="empty">暂无待审核技能</div>';
    c.innerHTML=html;
  }).catch(function(e){c.innerHTML='<div class="empty">'+e.message+'</div>'});
}
function reviewSkill(id,status){
  var action=status==='approved'?'approve':'reject';
  api('PUT','/skills/'+id+'/'+action).then(function(){renderSkills();toast(status==='approved'?'已通过':'已拒绝')}).catch(function(e){toast(e.message,true)});
}
function renderLogs(){
  var c=document.getElementById('pageContent');
  c.innerHTML='<div class="toolbar"><h3 style="font-size:14px;color:#c9d1d9;margin:0">系统日志</h3><div><button class="btn-sm primary" onclick="toggleLogStream()" id="streamBtn">实时</button> <button class="btn-sm" onclick="renderLogs()">刷新</button></div></div><div class="log-stream" id="logStream" style="min-height:300px"><div class="loading">加载中...</div></div>';
  api('GET','/logs').then(function(d){
    var arr=Array.isArray(d)?d:(d.logs||d.data||[]);
    var s=document.getElementById('logStream');
    s.innerHTML='';
    arr.forEach(function(l){s.innerHTML+='<div style="padding:2px 0;font-size:11px">'+formatLog(l)+'</div>'});
    s.scrollTop=s.scrollHeight;
  }).catch(function(e){document.getElementById('logStream').innerHTML='<div class="empty">'+e.message+'</div>'});
}
var _logStream=null;
function toggleLogStream(){
  if(_logStream){_logStream.close();_logStream=null;document.getElementById('streamBtn').textContent='实时';return}
  document.getElementById('streamBtn').textContent='停止';
  _logStream=new EventSource(API_BASE+'/logs/stream?token='+encodeURIComponent(_token));
  _logStream.onmessage=function(e){
    try{var d=JSON.parse(e.data);var s=document.getElementById('logStream');s.innerHTML+='<div style="padding:2px 0;font-size:11px">'+formatLog(d)+'</div>';s.scrollTop=s.scrollHeight}catch(ex){}
  };
  _logStream.onerror=function(){_logStream=null;document.getElementById('streamBtn').textContent='实时'};
}

function renderTag(v){
  var colors={approved:'success',pending:'warning',rejected:'danger',paid:'success',active:'success',inactive:'danger',critical:'danger',high:'danger',medium:'warning',low:'info'};
  return '<span class="tag tag-'+(colors[v]||'info')+'">'+v+'</span>';
}
function formatDate(v){if(!v)return'-';return new Date(v).toLocaleString('zh-CN')}
function formatLog(l){
  var ts=l.timestamp||l.time||'';var lvl=l.level||'INFO';var msg=l.message||l.msg||l.action||JSON.stringify(l);
  var color=lvl==='error'?'#f85149':lvl==='warn'?'#d29922':'#58a6ff';
  return '<span style="color:#484f58">'+(ts||'')+'</span> <span style="color:'+color+'">['+lvl+']</span> '+msg;
}
  
// Register all CRUD pages  
renderers.devices = renderCrud; renderers.sessions = renderCrud; renderers.memories = renderCrud; renderers.tenants = renderCrud; renderers.apikeys = renderCrud; renderers.users = renderCrud; renderers.plans = renderCrud; renderers.invoices = renderCrud; renderers.defects = renderCrud; renderers.schedules = renderCrud; renderers.config = renderConfig; renderers.payments = renderPayments; renderers.skills = renderSkills; renderers.logs = renderLogs;
} catch(e) { console.error('admin-crud.js error:', e); } 
