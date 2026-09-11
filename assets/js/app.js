/* ============== UTILITIES ============== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#' + id).classList.add('active');
}

function toast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

// Modal with optional input field
function openModal({ title, bodyHTML, onConfirm }) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML || '';
  $('#modal-backdrop').classList.add('active');

  const confirm = $('#modal-confirm');
  const cancel = $('#modal-cancel');
  const close = () => {
    $('#modal-backdrop').classList.remove('active');
    confirm.onclick = null; cancel.onclick = null;
  };
  confirm.onclick = async () => {
    const inputs = $('#modal-body').querySelectorAll('input,textarea');
    const values = Array.from(inputs).map(i => i.value.trim());
    try {
      await onConfirm(values, close);
    } catch (e) { toast(e.message); }
  };
  cancel.onclick = close;
}

/* ============== AUTH SCREEN ============== */
$$('[data-authtab]').forEach(t => t.addEventListener('click', () => {
  $$('[data-authtab]').forEach(x => x.classList.remove('active'));
  t.classList.add('active');
  const which = t.dataset.authtab;
  $('#form-login').classList.toggle('hidden', which !== 'login');
  $('#form-register').classList.toggle('hidden', which !== 'register');
}));

$('#form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#login-error').textContent = '';
  try {
    const data = await API.post('/auth/login', {
      email: $('#login-email').value,
      password: $('#login-password').value
    });
    API.setToken(data.token);
    API.setUser(data.user);
    toast('Welcome back, ' + data.user.username);
    loadProjects();
    showScreen('screen-projects');
  } catch (err) { $('#login-error').textContent = err.message; }
});

$('#form-register').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#reg-error').textContent = '';
  try {
    await API.post('/auth/register', {
      username: $('#reg-username').value,
      email: $('#reg-email').value,
      password: $('#reg-password').value
    });
    toast('Account created. Please log in.');
    document.querySelector('[data-authtab="login"]').click();
    $('#login-email').value = $('#reg-email').value;
  } catch (err) { $('#reg-error').textContent = err.message; }
});

$('#btn-logout').addEventListener('click', () => {
  API.logout();
  showScreen('screen-auth');
});

/* ============== PROJECTS SCREEN ============== */
async function loadProjects() {
  const list = $('#projects-list');
  list.innerHTML = '<div class="empty-state">Loading…</div>';
  try {
    const projects = await API.get('/projects');
    if (!projects.length) {
      list.innerHTML = '<div class="empty-state">No projects yet.<br>Tap <b>New Project</b> to start.</div>';
      return;
    }
    list.innerHTML = '';
    projects.forEach(p => {
      const el = document.createElement('div');
      el.className = 'project-card';
      el.innerHTML = `
        <div class="project-info">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || 'No description')}</p>
        </div>
        <div class="project-actions">
          <button data-action="delete" data-id="${p.id}">🗑</button>
        </div>`;
      el.addEventListener('click', (e) => {
        if (e.target.dataset.action === 'delete') {
          confirmDeleteProject(p.id);
          return;
        }
        openProject(p.id, p.name);
      });
      list.appendChild(el);
    });
  } catch (err) {
    list.innerHTML = `<div class="empty-state">Error: ${escapeHtml(err.message)}</div>`;
  }
}

$('#btn-new-project').addEventListener('click', () => {
  openModal({
    title: 'New Project',
    bodyHTML: `
      <input id="np-name" placeholder="Project name" autofocus>
      <input id="np-desc" placeholder="Description (optional)">`,
    onConfirm: async ([name, desc], close) => {
      if (!name) throw new Error('Name required');
      await API.post('/projects', { name, description: desc });
      close();
      toast('Project created');
      loadProjects();
    }
  });
});

function confirmDeleteProject(id) {
  openModal({
    title: 'Delete Project?',
    bodyHTML: '<p style="color:#aaa;font-size:13px">This will delete the project and all its files.</p>',
    onConfirm: async (_, close) => {
      await API.del('/projects/' + id);
      close();
      toast('Deleted');
      loadProjects();
    }
  });
}

/* ============== EDITOR SCREEN ============== */
let currentProject = null;
let editor = null;
let openTabs = [];       // [{path, content, dirty}]
let activeTab = null;
let fileTreeData = [];

function ensureEditor() {
  if (editor) return;
  editor = ace.edit('ace-editor');
  editor.setTheme('ace/theme/monokai');
  editor.session.setMode('ace/mode/text');
  editor.setOptions({
    fontSize: '14px',
    showPrintMargin: false,
    useWorker: false,
    wrap: true,
    tabSize: 2
  });
  editor.on('change', () => {
    if (!activeTab) return;
    const t = openTabs.find(x => x.path === activeTab);
    if (!t) return;
    const val = editor.getValue();
    if (val !== t.content) {
      t.dirty = true;
      t.content = val;
      updateTabUI();
    }
  });
}

async function openProject(id, name) {
  currentProject = { id, name };
  $('#editor-project-name').textContent = name;
  openTabs = []; activeTab = null;
  $('#editor-empty').classList.remove('hidden');
  ensureEditor();
  editor.setValue('');
  editor.session.setMode('ace/mode/text');
  renderTabs();
  showScreen('screen-editor');
  await refreshTree();
}

$('#btn-back').addEventListener('click', () => {
  showScreen('screen-projects');
  loadProjects();
});

/* ---------- Sidebar ---------- */
const sidebar = $('#sidebar');
const overlay = $('#overlay');
function openSidebar() { sidebar.classList.add('open'); overlay.classList.add('active'); }
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('active'); }
$('#btn-sidebar-toggle').addEventListener('click', openSidebar);
$('#btn-sidebar-close').addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

/* ---------- File tree ---------- */
async function refreshTree() {
  if (!currentProject) return;
  try {
    const data = await API.get(`/projects/${currentProject.id}/files`);
    fileTreeData = data.tree || [];
    renderTree();
  } catch (err) { toast(err.message); }
}

function renderTree() {
  const container = $('#file-tree');
  container.innerHTML = '';
  if (!fileTreeData.length) {
    container.innerHTML = '<div class="empty-state" style="padding:20px">Empty project</div>';
    return;
  }
  container.appendChild(buildTreeNodes(fileTreeData));
}

function buildTreeNodes(nodes) {
  const frag = document.createDocumentFragment();
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  nodes.forEach(n => frag.appendChild(buildTreeItem(n)));
  return frag;
}

function buildTreeItem(node) {
  const wrapper = document.createElement('div');

  const item = document.createElement('div');
  item.className = 'tree-item ' + node.type;
  if (node.type === 'file' && activeTab === node.path) item.classList.add('active');

  item.innerHTML = `
    <span class="icon">${node.type === 'folder' ? '📁' : '📄'}</span>
    <span class="label">${escapeHtml(node.name)}</span>
    <span class="tree-actions">
      <button data-act="rename" title="Rename">✎</button>
      <button data-act="delete" title="Delete">🗑</button>
    </span>`;

  if (node.type === 'folder') {
    const children = document.createElement('div');
    children.className = 'tree-children';
    children.appendChild(buildTreeNodes(node.children || []));
    wrapper.appendChild(item);
    wrapper.appendChild(children);
    item.addEventListener('click', (e) => {
      if (e.target.dataset.act) return;
      children.style.display = children.style.display === 'none' ? '' : 'none';
    });
  } else {
    wrapper.appendChild(item);
    item.addEventListener('click', (e) => {
      if (e.target.dataset.act) return;
      openFile(node.path);
      closeSidebar();
    });
  }

  item.querySelector('[data-act="rename"]').addEventListener('click', (e) => {
    e.stopPropagation();
    promptRename(node);
  });
  item.querySelector('[data-act="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    confirmDeleteNode(node);
  });

  return wrapper;
}

function promptRename(node) {
  openModal({
    title: 'Rename',
    bodyHTML: `<input id="rn-new" placeholder="New name" value="${escapeAttr(node.name)}">`,
    onConfirm: async ([newName], close) => {
      if (!newName || newName === node.name) return close();
      const dir = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/')) : '';
      const to = dir ? dir + '/' + newName : newName;
      await API.post(`/projects/${currentProject.id}/files/rename`, { from: node.path, to });
      close();
      toast('Renamed');
      // Update open tabs paths
      openTabs.forEach(t => {
        if (t.path === node.path) t.path = to;
        else if (t.path.startsWith(node.path + '/')) t.path = to + t.path.substring(node.path.length);
      });
      if (activeTab === node.path) activeTab = to;
      refreshTree();
      renderTabs();
    }
  });
}

function confirmDeleteNode(node) {
  openModal({
    title: 'Delete ' + (node.type === 'folder' ? 'Folder' : 'File') + '?',
    bodyHTML: `<p style="color:#aaa;font-size:13px">${escapeHtml(node.path)}</p>`,
    onConfirm: async (_, close) => {
      await API.del(`/projects/${currentProject.id}/files/delete`, { path: node.path });
      close();
      toast('Deleted');
      // Close tabs under this path
      openTabs = openTabs.filter(t => t.path !== node.path && !t.path.startsWith(node.path + '/'));
      if (activeTab === node.path) switchToTab(openTabs[0]?.path || null);
      refreshTree();
    }
  });
}

/* ---------- File operations ---------- */
$('#btn-new-file').addEventListener('click', () => promptCreate('file'));
$('#btn-new-folder').addEventListener('click', () => promptCreate('folder'));

function promptCreate(type) {
  openModal({
    title: 'New ' + (type === 'file' ? 'File' : 'Folder'),
    bodyHTML: `<input id="nc-path" placeholder="${type === 'file' ? 'src/index.js' : 'src/components'}">`,
    onConfirm: async ([path], close) => {
      if (!path) throw new Error('Path required');
      await API.post(`/projects/${currentProject.id}/files`, { path, type });
      close();
      toast('Created');
      refreshTree();
    }
  });
}

async function openFile(path) {
  const existing = openTabs.find(t => t.path === path);
  if (existing) {
    switchToTab(path);
    return;
  }
  try {
    const data = await API.get(`/projects/${currentProject.id}/files/read?path=${encodeURIComponent(path)}`);
    openTabs.push({ path, content: data.content, dirty: false, original: data.content });
    switchToTab(path);
  } catch (err) { toast(err.message); }
}

function switchToTab(path) {
  activeTab = path;
  renderTabs();
  if (!path) {
    editor.setValue('');
    editor.session.setMode('ace/mode/text');
    $('#editor-empty').classList.remove('hidden');
    return;
  }
  const tab = openTabs.find(t => t.path === path);
  if (!tab) return;
  editor.setValue(tab.content, -1);
  editor.session.setMode('ace/mode/' + detectMode(tab.path));
  editor.clearSelection();
  $('#editor-empty').classList.add('hidden');
  refreshTree(); // to update active highlight
}

function closeTab(path, e) {
  if (e) e.stopPropagation();
  const tab = openTabs.find(t => t.path === path);
  const doClose = () => {
    openTabs = openTabs.filter(t => t.path !== path);
    if (activeTab === path) {
      const next = openTabs[openTabs.length - 1]?.path || null;
      switchToTab(next);
    } else {
      renderTabs();
    }
  };
  if (tab?.dirty) {
    openModal({
      title: 'Unsaved changes',
      bodyHTML: `<p style="color:#aaa;font-size:13px">Close without saving ${escapeHtml(path)}?</p>`,
      onConfirm: (_, close) => { close(); doClose(); }
    });
  } else doClose();
}

function renderTabs() {
  const c = $('#editor-tabs');
  c.innerHTML = '';
  openTabs.forEach(t => {
    const el = document.createElement('div');
    el.className = 'editor-tab' + (t.path === activeTab ? ' active' : '');
    el.innerHTML = `<span>${t.dirty ? '● ' : ''}${escapeHtml(t.path.split('/').pop())}</span><span class="close">✕</span>`;
    el.addEventListener('click', () => switchToTab(t.path));
    el.querySelector('.close').addEventListener('click', (e) => closeTab(t.path, e));
    c.appendChild(el);
  });
}

function updateTabUI() { renderTabs(); }

/* ---------- Save ---------- */
$('#btn-save').addEventListener('click', saveActiveFile);

async function saveActiveFile() {
  if (!activeTab) return toast('No file open');
  const tab = openTabs.find(t => t.path === activeTab);
  if (!tab) return;
  try {
    await API.put(`/projects/${currentProject.id}/files/update`, {
      path: tab.path, content: editor.getValue()
    });
    tab.dirty = false;
    tab.original = editor.getValue();
    renderTabs();
    toast('Saved ✓');
  } catch (err) { toast(err.message); }
}

/* Keyboard shortcut (Ctrl/Cmd+S) */
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (currentProject) saveActiveFile();
  }
});

/* ---------- Language detection ---------- */
function detectMode(path) {
  const ext = path.split('.').pop().toLowerCase();
  return ({
    js: 'javascript', mjs: 'javascript', jsx: 'jsx', ts: 'typescript', tsx: 'tsx',
    html: 'html', htm: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', md: 'markdown', php: 'php', py: 'python', rb: 'ruby',
    go: 'golang', java: 'java', c: 'c_cpp', cpp: 'c_cpp', h: 'c_cpp',
    cs: 'csharp', sh: 'sh', bash: 'sh', yml: 'yaml', yaml: 'yaml',
    xml: 'xml', sql: 'sql', txt: 'text'
  })[ext] || 'text';
}

/* ---------- Preview (open project as static site) ---------- */
$('#btn-preview').addEventListener('click', () => {
  toast('Preview coming in next phase');
});

/* ---------- Escape helpers ---------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
}
function escapeAttr(s) { return escapeHtml(s); }

/* ============== BOOT ============== */
(function boot() {
  const user = API.getUser();
  if (API.token && user) {
    loadProjects();
    showScreen('screen-projects');
  } else {
    showScreen('screen-auth');
  }
})();
