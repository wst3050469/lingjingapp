/* 灵境IDE Admin Panel v2 — Vue3 Application */
const { createApp, ref, reactive, computed, onMounted, onUnmounted, watch, nextTick, h } = Vue;
const API = '/admin/api';

// ====== API Layer ======
const token = () => localStorage.getItem('lingjing_admin_token') || '';
const api = {
  headers: () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }),
  async request(method, path, body) {
    const res = await fetch(API + path, { method, headers: this.headers(), body: body ? JSON.stringify(body) : undefined });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get: (p) => api.request('GET', p),
  post: (p,b) => api.request('POST', p, b),
  put: (p,b) => api.request('PUT', p, b),
  del: (p) => api.request('DELETE', p),
  async login(username, password) {
    const res = await fetch(API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.token) localStorage.setItem('lingjing_admin_token', data.token);
    return data;
  },
  logout() { localStorage.removeItem('lingjing_admin_token'); }
};

// ====== Dashboard ======
const DashboardPage = {
  template: `<div>
  <div class="admin-dashboard">
    <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(88,166,255,0.15);color:#58a6ff">📊</div><div><div class="admin-stat-value">{{stats.totalDevices||0}}</div><div class="admin-stat-label">注册设备</div></div></div>
    <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(63,185,80,0.15);color:#3fb950">💬</div><div><div class="admin-stat-value">{{stats.activeSessions||0}}</div><div class="admin-stat-label">活跃会话</div></div></div>
    <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(210,168,255,0.15);color:#d2a8ff">🧠</div><div><div class="admin-stat-value">{{stats.totalMemories||0}}</div><div class="admin-stat-label">持久化记忆</div></div></div>
    <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(255,166,87,0.15);color:#ffa657">📋</div><div><div class="admin-stat-value">{{stats.totalPlans||0}}</div><div class="admin-stat-label">订阅套餐</div></div></div>
    <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(248,81,73,0.15);color:#f85149">🐛</div><div><div class="admin-stat-value">{{stats.openDefects||0}}</div><div class="admin-stat-label">未修复缺陷</div></div></div>
    <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(121,192,255,0.15);color:#79c0ff">💰</div><div><div class="admin-stat-value">{{stats.totalPayments||0}}</div><div class="admin-stat-label">支付记录</div></div></div>
  </div>
  <el-row :gutter="16">
    <el-col :span="12">
      <el-card><template #header>快捷操作</template>
        <el-row :gutter="12">
          <el-col :span="8" v-for="a in quickActions" :key="a.key"><div @click="$emit('nav',a.key)" style="background:#0d1117;border:1px solid #30363d;border-radius:8px;padding:20px;text-align:center;cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='#58a6ff'" onmouseout="this.style.borderColor='#30363d'"><div style="font-size:28px;margin-bottom:8px">{{a.icon}}</div><div style="color:#c9d1d9;font-size:13px;font-weight:600">{{a.label}}</div><div style="color:#484f58;font-size:11px;margin-top:4px">{{a.desc}}</div></div></el-col>
        </el-row>
      </el-card>
    </el-col>
    <el-col :span="12">
      <el-card><template #header>系统状态</template>
        <div style="display:flex;flex-direction:column;gap:12px">
          <div v-for="sv in sysStatus" :key="sv.label" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #21262d"><span style="color:#8b949e;font-size:13px">{{sv.label}}</span><el-tag size="small" :type="sv.ok?'success':'danger'" effect="dark">{{sv.ok?sv.value:'异常'}}</el-tag></div>
        </div>
      </el-card>
    </el-col>
  </el-row>
</div>`,
  data() {
    return {
      stats: {},
      quickActions: [
        {key:'devices',icon:'📱',label:'设备管理',desc:'查看所有注册设备'},
        {key:'sessions',icon:'💬',label:'会话管理',desc:'管理活跃会话'},
        {key:'plans',icon:'📦',label:'订阅套餐',desc:'管理订阅方案'},
        {key:'logs',icon:'📜',label:'系统日志',desc:'查看实时日志'},
        {key:'config',icon:'⚙️',label:'系统配置',desc:'修改系统参数'},
        {key:'skills',icon:'🛒',label:'技能审核',desc:'审核市场技能'},
      ],
      sysStatus: [
        {label:'API 服务',value:'在线',ok:true},
        {label:'数据库',value:'在线',ok:true},
        {label:'WebSocket',value:'在线',ok:true},
        {label:'更新时间',value:new Date().toLocaleString('zh-CN'),ok:true},
      ]
    };
  },
  async mounted() {
    try { const r = await api.get('/stats'); Object.assign(this.stats, r); } catch(e) { console.log('stats:', e.message); }
  },
  emits: ['nav']
};
console.log('[admin] Dashboard ready');


// ====== CRUD Table Generator ======
function createCrudPage(config) {
  const { title, apiPath, columns, formFields, onDelete, formatItem } = config;
  return {
    template: `<div>
      <div class="admin-table-bar">
        <h3>{{title}}</h3>
        <div style="display:flex;gap:8px">
          <el-input v-model="search" placeholder="搜索..." size="small" style="width:200px" clearable/>
          <el-button type="primary" size="small" @click="openAdd" v-if="formFields">新增</el-button>
          <el-button size="small" @click="loadData" :loading="loading">刷新</el-button>
        </div>
      </div>
      <el-table :data="filteredData" stripe v-loading="loading" empty-text="暂无数据" style="width:100%" @sort-change="onSort">
        <el-table-column v-for="col in columns" :key="col.prop" :prop="col.prop" :label="col.label" :width="col.width" :sortable="col.sortable" :formatter="col.formatter"/>
        <el-table-column label="操作" width="180" fixed="right" v-if="showActions">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="openEdit(scope.row)">编辑</el-button>
            <el-popconfirm title="确定删除?" @confirm="doDelete(scope.row)"><template #reference><el-button link type="danger" size="small">删除</el-button></template></el-popconfirm>
          </template>
        </el-table-column>
      </el-table>
      <el-pagination v-if="total>pageSize" v-model:current-page="page" :page-size="pageSize" :total="total" layout="prev,pager,next" @current-change="loadData" style="margin-top:16px;justify-content:center"/>
      <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px" @closed="resetForm">
        <el-form :model="form" label-position="top" v-if="formFields">
          <el-form-item v-for="f in formFields" :key="f.prop" :label="f.label" :required="f.required">
            <el-input v-if="f.type==='text'||!f.type" v-model="form[f.prop]" :placeholder="f.placeholder"/>
            <el-input v-else-if="f.type==='number'" v-model.number="form[f.prop]" type="number" :placeholder="f.placeholder"/>
            <el-input v-else-if="f.type==='textarea'" v-model="form[f.prop]" type="textarea" :rows="3" :placeholder="f.placeholder"/>
            <el-select v-else-if="f.type==='select'" v-model="form[f.prop]" :placeholder="f.placeholder" style="width:100%"><el-option v-for="o in (f.options||[])" :key="o.value" :label="o.label" :value="o.value"/></el-select>
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="dialogVisible=false">取消</el-button>
          <el-button type="primary" @click="doSave" :loading="saving">{{editingId?'更新':'创建'}}</el-button>
        </template>
      </el-dialog>
    </div>`,
    data() {
      return {
        title, apiPath, columns, formFields, formatItem,
        data: [], loading: false, saving: false, search: '', page: 1, pageSize: 20, total: 0,
        dialogVisible: false, dialogTitle: '', editingId: null, form: {}, sortProp: '', sortOrder: ''
      };
    },
    computed: {
      showActions() { return this.formFields && this.formFields.length > 0; },
      filteredData() {
        if (!this.search) return this.data;
        const s = this.search.toLowerCase();
        return this.data.filter(d => JSON.stringify(d).toLowerCase().includes(s));
      }
    },
    methods: {
      async loadData() {
        this.loading = true;
        try {
          let url = this.apiPath + '?page=' + this.page + '&pageSize=' + this.pageSize;
          const res = await api.get(url);
          this.data = Array.isArray(res) ? res : (res.data || res[Object.keys(res).find(k=>Array.isArray(res[k]))||'']||[]);
          this.total = res.total || res.pagination?.total || this.data.length;
        } catch(e) { console.error(e); } finally { this.loading = false; }
      },
      openAdd() { this.dialogTitle = '新增'; this.editingId = null; this.resetForm(); this.dialogVisible = true; },
      openEdit(row) { this.dialogTitle = '编辑'; this.editingId = row.id; this.form = Object.keys(this.form).reduce((o,k)=>({...o,[k]:row[k]??''}),{}); this.dialogVisible = true; },
      resetForm() { this.form = (this.formFields||[]).reduce((o,f)=>({...o,[f.prop]:''}),{}); },
      async doSave() {
        this.saving = true;
        try {
          const body = { ...this.form };
          if (this.editingId) { await api.put(this.apiPath+'/'+this.editingId, body); }
          else { await api.post(this.apiPath, body); }
          this.dialogVisible = false;
          this.loadData();
          ElMessage.success(this.editingId?'更新成功':'创建成功');
        } catch(e) { ElMessage.error(e.message); } finally { this.saving = false; }
      },
      async doDelete(row) {
        try {
          await api.del(this.apiPath+'/'+row.id);
          this.loadData();
          ElMessage.success('删除成功');
        } catch(e) { ElMessage.error(e.message); }
      },
      onSort({prop,order}) { this.sortProp=prop; this.sortOrder=order; this.loadData(); }
    },
    mounted() { this.loadData(); this.resetForm(); }
  };
}

// ====== Device Page ======
const DevicesPage = createCrudPage({
  title: '设备管理', apiPath: '/devices',
  columns: [
    {prop:'id',label:'设备ID',width:200},
    {prop:'name',label:'设备名称',width:160},
    {prop:'platform',label:'平台',width:80},
    {prop:'version',label:'版本',width:80},
    {prop:'status',label:'状态',width:80},
    {prop:'last_seen',label:'最后在线',width:160},
  ],
  formFields: [
    {prop:'name',label:'设备名称',required:true,placeholder:'如: iPhone 15 Pro'},
    {prop:'platform',label:'平台',type:'select',options:[{label:'iOS',value:'ios'},{label:'Android',value:'android'},{label:'Web',value:'web'},{label:'Desktop',value:'desktop'}]},
  ]
});

// ====== Sessions Page ======
const SessionsPage = createCrudPage({
  title: '会话管理', apiPath: '/sessions',
  columns: [
    {prop:'id',label:'会话ID',width:200},
    {prop:'title',label:'标题',width:200},
    {prop:'type',label:'类型',width:80},
    {prop:'status',label:'状态',width:80},
    {prop:'updated_at',label:'更新时间',width:160},
  ]
});

// ====== Memories Page ======
const MemoriesPage = createCrudPage({
  title: '记忆管理', apiPath: '/memories',
  columns: [
    {prop:'id',label:'ID',width:80},
    {prop:'key',label:'Key',width:160},
    {prop:'value',label:'Value',width:200},
    {prop:'category',label:'分类',width:100},
    {prop:'updated_at',label:'更新时间',width:160},
  ],
  formFields: [
    {prop:'key',label:'Key',required:true},
    {prop:'value',label:'Value',type:'textarea'},
    {prop:'category',label:'分类'},
  ]
});

// ====== Tenants Page ======
const TenantsPage = createCrudPage({
  title: '租户管理', apiPath: '/tenants',
  columns: [
    {prop:'id',label:'ID',width:60},
    {prop:'name',label:'名称',width:160},
    {prop:'domain',label:'域名',width:180},
    {prop:'plan',label:'套餐',width:100},
    {prop:'status',label:'状态',width:80},
    {prop:'created_at',label:'创建时间',width:160},
  ],
  formFields: [
    {prop:'name',label:'租户名称',required:true},
    {prop:'domain',label:'域名'},
    {prop:'plan',label:'套餐'},
  ]
});

// ====== API Keys Page ======
const ApiKeysPage = createCrudPage({
  title: 'API密钥', apiPath: '/api-keys',
  columns: [
    {prop:'id',label:'ID',width:60},
    {prop:'name',label:'名称',width:160},
    {prop:'key',label:'密钥',width:220},
    {prop:'created_at',label:'创建时间',width:160},
  ],
  formFields: [{prop:'name',label:'名称',required:true,placeholder:'如: Production Key'}]
});

// ====== Config Page ======
const ConfigPage = {
  template: `<div>
    <el-card><template #header>系统配置</template>
      <el-form label-position="top" v-loading="loading">
        <el-row :gutter="16">
          <el-col :span="12" v-for="item in configItems" :key="item.key">
            <el-form-item :label="item.label">
              <el-input v-if="item.type==='text'" v-model="cfg[item.key]" :placeholder="item.placeholder"/>
              <el-input v-else-if="item.type==='number'" v-model.number="cfg[item.key]" type="number"/>
              <el-input v-else-if="item.type==='textarea'" v-model="cfg[item.key]" type="textarea" :rows="2"/>
              <el-select v-else-if="item.type==='select'" v-model="cfg[item.key]" style="width:100%"><el-option v-for="o in item.options" :key="o" :label="o" :value="o"/></el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-button type="primary" @click="saveConfig" :loading="saving">保存配置</el-button>
      </el-form>
    </el-card>
  </div>`,
  data() { return { cfg:{}, loading:false, saving:false,
    configItems: [
      {key:'appName',label:'应用名称',type:'text',placeholder:'灵境IDE'},
      {key:'maxDevices',label:'最大设备数',type:'number'},
      {key:'sessionTimeout',label:'会话超时(秒)',type:'number'},
      {key:'logLevel',label:'日志级别',type:'select',options:['debug','info','warn','error']},
      {key:'maintenanceMode',label:'维护模式',type:'select',options:['on','off']},
    ]
  };},
  async mounted() { try { const r = await api.get('/config'); Object.assign(this.cfg, r); } catch(e) {} },
  methods: { async saveConfig() { this.saving=true; try { await api.put('/config',this.cfg); ElMessage.success('配置已保存'); } catch(e){ ElMessage.error(e.message); } finally { this.saving=false; } } }
};

// ====== Users Page ======
const UsersPage = createCrudPage({
  title: '用户管理', apiPath: '/users',
  columns: [
    {prop:'id',label:'ID',width:60},
    {prop:'username',label:'用户名',width:140},
    {prop:'email',label:'邮箱',width:200},
    {prop:'role',label:'角色',width:80},
    {prop:'created_at',label:'注册时间',width:160},
  ],
  formFields: [
    {prop:'username',label:'用户名',required:true},
    {prop:'email',label:'邮箱'},
    {prop:'password',label:'密码',type:'text',placeholder:'留空则不修改'},
    {prop:'role',label:'角色',type:'select',options:[{label:'管理员',value:'admin'},{label:'普通用户',value:'user'}]},
  ]
});

// ====== Plans Page ======
const PlansPage = createCrudPage({
  title: '订阅套餐', apiPath: '/plans',
  columns: [
    {prop:'id',label:'ID',width:60},
    {prop:'name',label:'名称',width:140},
    {prop:'price',label:'价格',width:80},
    {prop:'billing_cycle',label:'周期',width:80},
    {prop:'status',label:'状态',width:80},
    {prop:'created_at',label:'创建时间',width:160},
  ],
  formFields: [
    {prop:'name',label:'套餐名称',required:true},
    {prop:'price',label:'价格(元)',type:'number',required:true},
    {prop:'billing_cycle',label:'计费周期',type:'select',options:[{label:'月付',value:'monthly'},{label:'年付',value:'yearly'}]},
    {prop:'description',label:'描述',type:'textarea'},
  ]
});

// ====== Payments Page ======
const PaymentsPage = {
  template: `<div>
    <div class="admin-table-bar"><h3>支付记录</h3><el-button size="small" @click="load">刷新</el-button></div>
    <el-table :data="data" stripe v-loading="loading" empty-text="暂无数据">
      <el-table-column prop="id" label="ID" width="60"/>
      <el-table-column prop="plan_id" label="套餐" width="100"/>
      <el-table-column prop="amount" label="金额" width="80"/>
      <el-table-column prop="status" label="状态" width="80"><template #default="s"><el-tag size="small" :type="s.row.status==='paid'?'success':s.row.status==='pending'?'warning':'info'">{{s.row.status}}</el-tag></template></el-table-column>
      <el-table-column prop="created_at" label="创建时间" width="160"/>
      <el-table-column label="操作" width="100"><template #default="s"><el-button v-if="s.row.status==='pending'" link type="success" size="small" @click="verify(s.row.id)">确认收款</el-button></template></el-table-column>
    </el-table>
  </div>`,
  data() { return { data:[], loading:false }; },
  methods: {
    async load() { this.loading=true; try { const r=await api.get('/payments'); this.data=Array.isArray(r)?r:(r.payments||r.data||[]); } catch(e){} finally{this.loading=false;} },
    async verify(id) { try { await api.put('/payments/'+id+'/verify'); this.load(); ElMessage.success('已确认'); } catch(e) { ElMessage.error(e.message); } }
  },
  mounted() { this.load(); }
};

// ====== Skills Page ======
const SkillsPage = {
  template: `<div>
    <div class="admin-table-bar"><h3>技能审核</h3><el-button size="small" @click="load">刷新</el-button></div>
    <el-table :data="data" stripe v-loading="loading" empty-text="暂无待审核技能">
      <el-table-column prop="id" label="ID" width="60"/>
      <el-table-column prop="name" label="名称" width="150"/>
      <el-table-column prop="author" label="作者" width="120"/>
      <el-table-column prop="category" label="分类" width="100"/>
      <el-table-column prop="status" label="状态" width="80"><template #default="s"><el-tag size="small" :type="s.row.status==='approved'?'success':s.row.status==='pending'?'warning':'danger'">{{s.row.status}}</el-tag></template></el-table-column>
      <el-table-column label="操作" width="180"><template #default="s"><el-button v-if="s.row.status==='pending'" link type="success" size="small" @click="approve(s.row.id)">通过</el-button><el-button v-if="s.row.status==='pending'" link type="danger" size="small" @click="reject(s.row.id)">拒绝</el-button></template></el-table-column>
    </el-table>
  </div>`,
  data() { return { data:[], loading:false }; },
  methods: {
    async load() { this.loading=true; try { this.data = await api.get('/skills'); } catch(e){} finally{this.loading=false;} },
    async approve(id) { try { await api.put('/skills/'+id+'/approve'); this.load(); ElMessage.success('已通过'); } catch(e) { ElMessage.error(e.message); } },
    async reject(id) { try { await api.put('/skills/'+id+'/reject'); this.load(); ElMessage.success('已拒绝'); } catch(e) { ElMessage.error(e.message); } }
  },
  mounted() { this.load(); }
};

// ====== Invoices Page ======
const InvoicesPage = createCrudPage({
  title: '发票管理', apiPath: '/invoices',
  columns: [
    {prop:'id',label:'ID',width:60},
    {prop:'invoice_no',label:'发票号',width:160},
    {prop:'amount',label:'金额',width:80},
    {prop:'status',label:'状态',width:80},
    {prop:'created_at',label:'创建时间',width:160},
  ]
});

// ====== Defects Page ======
const DefectsPage = createCrudPage({
  title: '缺陷追踪', apiPath: '/defects',
  columns: [
    {prop:'id',label:'ID',width:60},
    {prop:'title',label:'标题',width:200},
    {prop:'severity',label:'严重程度',width:80},
    {prop:'status',label:'状态',width:80},
    {prop:'created_at',label:'创建时间',width:160},
  ],
  formFields: [
    {prop:'title',label:'标题',required:true},
    {prop:'description',label:'描述',type:'textarea'},
    {prop:'severity',label:'严重程度',type:'select',options:[{label:'🔴 致命',value:'critical'},{label:'🟠 高',value:'high'},{label:'🟡 中',value:'medium'},{label:'🟢 低',value:'low'}]},
  ]
});

// ====== Logs Page ======
const LogsPage = {
  template: `<div>
    <div class="admin-table-bar"><h3>系统日志</h3><div style="display:flex;gap:8px"><el-select v-model="level" size="small" style="width:100px" @change="loadLogs"><el-option label="全部" value=""/><el-option label="INFO" value="info"/><el-option label="WARN" value="warn"/><el-option label="ERROR" value="error"/></el-select><el-button size="small" type="primary" @click="toggleStream">{{streaming?'停止':'实时'}}</el-button><el-button size="small" @click="loadLogs">刷新</el-button></div></div>
    <div class="admin-log-stream" ref="logContainer">
      <div v-if="logs.length===0" style="text-align:center;padding:40px;color:#484f58">暂无日志</div>
      <div v-for="(log,i) in logs" :key="i" class="log-line" :class="'admin-log-level-'+log.level">{{formatLog(log)}}</div>
    </div>
  </div>`,
  data() { return { logs:[], level:'', streaming:false, eventSource:null }; },
  methods: {
    async loadLogs() { try { const r = await api.get('/logs?level='+this.level); this.logs = Array.isArray(r)?r:(r.logs||[]); } catch(e){} },
    toggleStream() {
      if(this.streaming) { if(this.eventSource){this.eventSource.close();this.eventSource=null;} this.streaming=false; return; }
      this.streaming=true;
      this.eventSource = new EventSource(API+'/logs/stream?token='+token());
      this.eventSource.onmessage = (e) => {
        try { const d = JSON.parse(e.data); this.logs.push(d); if(this.logs.length>500)this.logs.shift(); } catch(ex) {}
        nextTick(() => { const el = this.$refs.logContainer; if(el) el.scrollTop = el.scrollHeight; });
      };
      this.eventSource.onerror = () => { this.streaming=false; };
    },
    formatLog(log) { return (log.timestamp||'') + ' [' + (log.level||'INFO') + '] ' + (log.message||log.msg||log.action||JSON.stringify(log)); }
  },
  mounted() { this.loadLogs(); },
  beforeUnmount() { if(this.eventSource) this.eventSource.close(); }
};

// ====== Schedules Page ======
const SchedulesPage = createCrudPage({
  title: '定时任务', apiPath: '/schedules',
  columns: [
    {prop:'id',label:'ID',width:60},
    {prop:'name',label:'名称',width:160},
    {prop:'cron_expr',label:'Cron表达式',width:140},
    {prop:'action_type',label:'动作',width:100},
    {prop:'status',label:'状态',width:80},
    {prop:'next_run',label:'下次执行',width:160},
  ],
  formFields: [
    {prop:'name',label:'任务名称',required:true},
    {prop:'cron_expr',label:'Cron表达式',required:true,placeholder:'0 */6 * * *'},
    {prop:'action_type',label:'动作类型',type:'select',options:[{label:'备份',value:'backup'},{label:'清理',value:'cleanup'},{label:'同步',value:'sync'},{label:'报告',value:'report'}]},
  ]
});

// ====== Main App ======
const AdminApp = {
  components: { DashboardPage, DevicesPage, SessionsPage, MemoriesPage, TenantsPage, ApiKeysPage, ConfigPage, PlansPage, PaymentsPage, InvoicesPage, SkillsPage, DefectsPage, LogsPage, SchedulesPage, UsersPage },
  data() {
    return {
      loggedIn: !!token(),
      loginForm: { username: 'admin', password: '' },
      loginLoading: false, loginError: '',
      isCollapse: false, activeMenu: 'dashboard',
      pageMap: {
        dashboard: '数据总览', devices: '设备管理', sessions: '会话管理', memories: '记忆管理',
        tenants: '租户管理', apikeys: 'API密钥', config: '系统配置', users: '用户管理',
        plans: '订阅套餐', payments: '支付记录', invoices: '发票管理', skills: '技能审核',
        defects: '缺陷追踪', logs: '系统日志', schedules: '定时任务'
      }
    };
  },
  computed: {
    currentPage() {
      const m = {
        dashboard: 'DashboardPage', devices:'DevicesPage', sessions:'SessionsPage', memories:'MemoriesPage',
        tenants:'TenantsPage', apikeys:'ApiKeysPage', config:'ConfigPage', users:'UsersPage',
        plans:'PlansPage', payments:'PaymentsPage', invoices:'InvoicesPage', skills:'SkillsPage',
        defects:'DefectsPage', logs:'LogsPage', schedules:'SchedulesPage'
      };
      return m[this.activeMenu] || 'DashboardPage';
    },
    pageTitle() { return this.pageMap[this.activeMenu] || '管理面板'; }
  },
  methods: {
    async doLogin() {
      this.loginLoading = true; this.loginError = '';
      try {
        const r = await api.login(this.loginForm.username, this.loginForm.password);
        if (r.token || r.ok) { this.loggedIn = true; ElMessage.success('登录成功'); }
        else { this.loginError = r.error || '登录失败'; }
      } catch(e) { this.loginError = e.message; } finally { this.loginLoading = false; }
    },
    doLogout() { api.logout(); this.loggedIn = false; this.activeMenu = 'dashboard'; },
    onMenuSelect(index) { this.activeMenu = index; },
  }
};

// Register Element Plus icons
for (const [k, comp] of Object.entries(ElementPlusIconsVue || {})) {
  if (k.startsWith('el-icon-')) continue;
}
const app = createApp(AdminApp);
app.use(ElementPlus);
// Register components
app.component('DashboardPage', DashboardPage);
app.component('DevicesPage', DevicesPage);
app.component('SessionsPage', SessionsPage);
app.component('MemoriesPage', MemoriesPage);
app.component('TenantsPage', TenantsPage);
app.component('ApiKeysPage', ApiKeysPage);
app.component('ConfigPage', ConfigPage);
app.component('UsersPage', UsersPage);
app.component('PlansPage', PlansPage);
app.component('PaymentsPage', PaymentsPage);
app.component('InvoicesPage', InvoicesPage);
app.component('SkillsPage', SkillsPage);
app.component('DefectsPage', DefectsPage);
app.component('LogsPage', LogsPage);
app.component('SchedulesPage', SchedulesPage);
app.mount('#app');
console.log('[Admin] App mounted');
