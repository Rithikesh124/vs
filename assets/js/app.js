/**
 * VS Mobile - Next-Gen Mobile IDE Application Logic
 * Integrates Ace Editor, Virtual Keyboard, AI Copilot, Live Sandbox & DevTools Console
 */

/* ==========================================================================
   UTILITY HELPERS
   ========================================================================== */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function showScreen(id) {
  $$('.screen').forEach(s => s.classList.remove('active'));
  const target = $('#' + id);
  if (target) target.classList.add('active');
}

function toast(msg, ms = 2200) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), ms);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function openModal({ title, bodyHTML, onConfirm }) {
  $('#modal-title').textContent = title;
  $('#modal-body').innerHTML = bodyHTML || '';
  $('#modal-backdrop').classList.add('active');

  const confirmBtn = $('#modal-confirm');
  const cancelBtn = $('#modal-cancel');

  const close = () => {
    $('#modal-backdrop').classList.remove('active');
    confirmBtn.onclick = null;
    cancelBtn.onclick = null;
  };

  confirmBtn.onclick = async () => {
    const inputs = $('#modal-body').querySelectorAll('input, select, textarea');
    const values = Array.from(inputs).map(i => i.value.trim());
    try {
      await onConfirm(values, close);
    } catch (err) {
      toast(err.message);
    }
  };
  cancelBtn.onclick = close;
}

/* ==========================================================================
   GLOBAL STATE
   ========================================================================== */
let currentProject = null;
let editor = null;
let openTabs = [];       // [{ path, content, dirty, original }]
let activeTab = null;
let fileTreeData = [];
let pyodideInstance = null;

/* ==========================================================================
   PROJECTS SCREEN
   ========================================================================== */
async function loadProjects() {
  const list = $('#projects-list');
  list.innerHTML = '<div style="color:var(--text-muted);padding:20px;text-align:center;">Loading projects…</div>';

  try {
    const projects = await API.listProjects();
    if (!projects || !projects.length) {
      list.innerHTML = `
        <div style="padding:40px 20px;text-align:center;color:var(--text-muted);">
          <p style="font-size:2rem;margin-bottom:10px;">📦</p>
          <p>No projects found.<br>Tap <strong>+ New Project</strong> to start coding.</p>
        </div>`;
      return;
    }

    list.innerHTML = '';
    projects.forEach(p => {
      const card = document.createElement('div');
      card.className = 'project-card';
      card.innerHTML = `
        <div class="project-info">
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description || 'Interactive mobile workspace')}</p>
          <div class="project-meta">
            <span>📄 ${p.fileCount || 1} files</span>
            <span>⚡ Ready</span>
          </div>
        </div>
        <div class="project-actions">
          <button class="project-del-btn" data-action="delete" title="Delete Project">🗑</button>
        </div>`;

      card.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="delete"]')) {
          confirmDeleteProject(p.id, p.name);
          return;
        }
        openProject(p.id, p.name);
      });

      list.appendChild(card);
    });
  } catch (err) {
    list.innerHTML = `<div style="color:var(--accent-rose);padding:20px;">Error loading projects: ${escapeHtml(err.message)}</div>`;
  }
}

$('#btn-new-project')?.addEventListener('click', () => {
  openModal({
    title: 'Create New Project',
    bodyHTML: `
      <label style="font-size:0.85rem;color:var(--text-secondary);">Project Name:</label>
      <input id="np-name" placeholder="e.g. My Next Mobile App" autofocus>
      <label style="font-size:0.85rem;color:var(--text-secondary);">Description (Optional):</label>
      <input id="np-desc" placeholder="Brief notes about this project">`,
    onConfirm: async ([name, desc], close) => {
      if (!name) throw new Error('Project name is required');
      const newProj = await API.createProject(name, desc);
      close();
      toast(`Project "${name}" created!`);
      loadProjects();
      openProject(newProj.id, newProj.name);
    }
  });
});

function confirmDeleteProject(id, name) {
  openModal({
    title: 'Delete Project?',
    bodyHTML: `<p style="color:var(--text-secondary);font-size:0.9rem;">Are you sure you want to delete <strong>${escapeHtml(name)}</strong>? All files will be removed.</p>`,
    onConfirm: async (_, close) => {
      await API.deleteProject(id);
      close();
      toast('Project deleted');
      loadProjects();
    }
  });
}

/* ==========================================================================
   EDITOR INITIALIZATION & ACE BINDINGS
   ========================================================================== */
function ensureEditor() {
  if (editor) return;

  editor = ace.edit('ace-editor');
  const savedTheme = localStorage.getItem('vs_mobile_editor_theme') || 'monokai';
  const savedFontSize = localStorage.getItem('vs_mobile_font_size') || '13.5px';

  editor.setTheme('ace/theme/' + savedTheme);
  editor.session.setMode('ace/mode/html');
  editor.setOptions({
    fontSize: savedFontSize,
    showPrintMargin: false,
    useWorker: false,
    wrap: true,
    tabSize: 2,
    enableBasicAutocompletion: true,
    enableLiveAutocompletion: true,
    enableSnippets: true,
    behavioursEnabled: true,
    scrollPastEnd: 0.5
  });

  // Track changes and mark tab dirty
  editor.on('change', () => {
    if (!activeTab) return;
    const currentVal = editor.getValue();
    const tab = openTabs.find(t => t.path === activeTab);
    if (!tab) return;

    if (currentVal !== tab.content) {
      tab.content = currentVal;
      tab.dirty = true;
      renderTabs();
    }
  });
}

async function openProject(id, name) {
  currentProject = { id, name };
  $('#editor-project-name').textContent = name;
  openTabs = [];
  activeTab = null;

  ensureEditor();
  editor.setValue('');
  renderTabs();
  showScreen('screen-editor');

  await refreshTree();

  // Automatically open index.html or first file
  const tree = fileTreeData;
  const firstFile = findFirstFile(tree);
  if (firstFile) {
    openFile(firstFile.path);
  } else {
    $('#editor-empty').classList.remove('hidden');
  }
}

function findFirstFile(nodes) {
  for (const n of nodes) {
    if (n.type === 'file') return n;
    if (n.children && n.children.length) {
      const found = findFirstFile(n.children);
      if (found) return found;
    }
  }
  return null;
}

$('#btn-back')?.addEventListener('click', () => {
  showScreen('screen-projects');
  loadProjects();
});

/* ==========================================================================
   TABS MANAGEMENT
   ========================================================================== */
function renderTabs() {
  const container = $('#editor-tabs');
  container.innerHTML = '';

  if (!openTabs.length) {
    $('#editor-empty').classList.remove('hidden');
    $('#editor-active-filename').textContent = 'No File Open';
    return;
  }

  $('#editor-empty').classList.add('hidden');

  openTabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'editor-tab' + (tab.path === activeTab ? ' active' : '');
    const filename = tab.path.split('/').pop();

    el.innerHTML = `
      ${tab.dirty ? '<span class="dirty-dot">●</span>' : ''}
      <span>${escapeHtml(filename)}</span>
      <span class="close-tab" title="Close File">✕</span>`;

    el.addEventListener('click', () => switchToTab(tab.path));
    el.querySelector('.close-tab').addEventListener('click', (e) => {
      e.stopPropagation();
      closeTab(tab.path);
    });

    container.appendChild(el);
  });
}

function switchToTab(path) {
  activeTab = path;
  renderTabs();

  if (!path) {
    editor.setValue('');
    $('#editor-empty').classList.remove('hidden');
    $('#editor-active-filename').textContent = 'No File Open';
    return;
  }

  const tab = openTabs.find(t => t.path === path);
  if (!tab) return;

  $('#editor-empty').classList.add('hidden');
  $('#editor-active-filename').textContent = path;

  editor.setValue(tab.content, -1);
  editor.session.setMode('ace/mode/' + detectMode(tab.path));
  editor.clearSelection();
  refreshTree(); // update active highlight in sidebar
}

async function openFile(path) {
  const existing = openTabs.find(t => t.path === path);
  if (existing) {
    switchToTab(path);
    return;
  }

  try {
    const data = await API.readFile(currentProject.id, path);
    openTabs.push({
      path,
      content: data.content,
      dirty: false,
      original: data.content
    });
    switchToTab(path);
  } catch (err) {
    toast(err.message);
  }
}

function closeTab(path) {
  const tab = openTabs.find(t => t.path === path);
  const proceedClose = () => {
    openTabs = openTabs.filter(t => t.path !== path);
    if (activeTab === path) {
      const nextTab = openTabs[openTabs.length - 1]?.path || null;
      switchToTab(nextTab);
    } else {
      renderTabs();
    }
  };

  if (tab?.dirty) {
    openModal({
      title: 'Unsaved Changes',
      bodyHTML: `<p style="color:var(--text-secondary);font-size:0.9rem;">Discard unsaved edits in <strong>${escapeHtml(path)}</strong>?</p>`,
      onConfirm: (_, close) => {
        close();
        proceedClose();
      }
    });
  } else {
    proceedClose();
  }
}

/* ==========================================================================
   SAVE OPERATIONS
   ========================================================================== */
$('#btn-save')?.addEventListener('click', saveActiveFile);

async function saveActiveFile() {
  if (!activeTab) return toast('No active file to save');
  const tab = openTabs.find(t => t.path === activeTab);
  if (!tab) return;

  try {
    await API.writeFile(currentProject.id, tab.path, editor.getValue());
    tab.dirty = false;
    tab.original = editor.getValue();
    renderTabs();
    toast('Saved ✓');
  } catch (err) {
    toast(`Save Error: ${err.message}`);
  }
}

// Global Ctrl/Cmd + S
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (currentProject) saveActiveFile();
  }
});

/* ==========================================================================
   FILE EXPLORER SIDEBAR
   ========================================================================== */
const sidebar = $('#sidebar');
const overlay = $('#overlay');

function openSidebar() {
  sidebar.classList.add('open');
  overlay.classList.add('active');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.classList.remove('active');
}

$('#btn-sidebar-toggle')?.addEventListener('click', openSidebar);
$('#btn-toolbar-files')?.addEventListener('click', openSidebar);
$('#btn-open-sidebar-empty')?.addEventListener('click', openSidebar);
$('#btn-sidebar-close')?.addEventListener('click', closeSidebar);
overlay?.addEventListener('click', () => {
  closeSidebar();
  closeAIDrawer();
});

async function refreshTree() {
  if (!currentProject) return;
  try {
    const res = await API.getFileTree(currentProject.id);
    fileTreeData = res.tree || [];
    renderTree();
  } catch (err) {
    toast(err.message);
  }
}

function renderTree() {
  const container = $('#file-tree');
  container.innerHTML = '';

  if (!fileTreeData.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);">Empty Project</div>';
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

  if (node.type === 'file' && activeTab === node.path) {
    item.classList.add('active');
  }

  const icon = node.type === 'folder' ? '📁' : getFileIcon(node.name);

  item.innerHTML = `
    <div class="tree-node-left">
      <span>${icon}</span>
      <span>${escapeHtml(node.name)}</span>
    </div>
    <div class="tree-actions">
      <button data-act="rename" title="Rename">✎</button>
      <button data-act="delete" title="Delete">🗑</button>
    </div>`;

  if (node.type === 'folder') {
    const childrenContainer = document.createElement('div');
    childrenContainer.className = 'tree-children';
    childrenContainer.appendChild(buildTreeNodes(node.children || []));
    wrapper.appendChild(item);
    wrapper.appendChild(childrenContainer);

    item.addEventListener('click', (e) => {
      if (e.target.dataset.act) return;
      childrenContainer.style.display = childrenContainer.style.display === 'none' ? '' : 'none';
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
    promptRenameNode(node);
  });

  item.querySelector('[data-act="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    confirmDeleteNode(node);
  });

  return wrapper;
}

function getFileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  switch (ext) {
    case 'html': return '🌐';
    case 'css': return '🎨';
    case 'js': return '⚡';
    case 'ts': return '🔷';
    case 'py': return '🐍';
    case 'json': return '📋';
    case 'md': return '📝';
    default: return '📄';
  }
}

function promptRenameNode(node) {
  openModal({
    title: 'Rename ' + (node.type === 'folder' ? 'Folder' : 'File'),
    bodyHTML: `<input id="rn-name" value="${escapeHtml(node.name)}" autofocus>`,
    onConfirm: async ([newName], close) => {
      if (!newName || newName === node.name) return close();
      const parentDir = node.path.includes('/') ? node.path.substring(0, node.path.lastIndexOf('/')) : '';
      const newPath = parentDir ? parentDir + '/' + newName : newName;

      await API.renameFile(currentProject.id, node.path, newPath);
      close();
      toast('Renamed successfully');

      // Update active tabs
      openTabs.forEach(t => {
        if (t.path === node.path) t.path = newPath;
        else if (t.path.startsWith(node.path + '/')) t.path = newPath + t.path.substring(node.path.length);
      });
      if (activeTab === node.path) activeTab = newPath;

      await refreshTree();
      renderTabs();
    }
  });
}

function confirmDeleteNode(node) {
  openModal({
    title: 'Delete ' + (node.type === 'folder' ? 'Folder' : 'File') + '?',
    bodyHTML: `<p style="color:var(--text-secondary);font-size:0.9rem;">Delete <strong>${escapeHtml(node.path)}</strong> permanently?</p>`,
    onConfirm: async (_, close) => {
      await API.deleteFile(currentProject.id, node.path);
      close();
      toast('Deleted');

      openTabs = openTabs.filter(t => t.path !== node.path && !t.path.startsWith(node.path + '/'));
      if (activeTab === node.path) switchToTab(openTabs[0]?.path || null);

      await refreshTree();
    }
  });
}

$('#btn-add-file-explorer')?.addEventListener('click', () => promptCreateNode('file'));
$('#btn-add-folder-explorer')?.addEventListener('click', () => promptCreateNode('folder'));

function promptCreateNode(type) {
  openModal({
    title: 'Create New ' + (type === 'file' ? 'File' : 'Folder'),
    bodyHTML: `<input id="new-node-path" placeholder="${type === 'file' ? 'e.g. components/Header.js' : 'e.g. assets/images'}" autofocus>`,
    onConfirm: async ([path], close) => {
      if (!path) throw new Error('Path cannot be empty');
      await API.createFile(currentProject.id, path, type);
      close();
      toast(`${type === 'file' ? 'File' : 'Folder'} created`);
      await refreshTree();
      if (type === 'file') openFile(path);
    }
  });
}

/* ==========================================================================
   VIRTUAL KEYBOARD ACCESSORY BAR (Mobile Coding Row)
   ========================================================================== */
$$('#virtual-keyboard .vk-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!editor) return;

    const toInsert = btn.dataset.insert;
    if (toInsert !== undefined) {
      editor.insert(toInsert);
      editor.focus();
    }
  });
});

$('#vk-undo')?.addEventListener('click', () => {
  if (editor) { editor.undo(); editor.focus(); }
});

$('#vk-redo')?.addEventListener('click', () => {
  if (editor) { editor.redo(); editor.focus(); }
});

/* ==========================================================================
   AI ASSISTANT (Copilot Drawer)
   ========================================================================== */
const aiDrawer = $('#ai-drawer');

function openAIDrawer() {
  aiDrawer.classList.add('open');
  overlay.classList.add('active');
  $('#ai-input-text')?.focus();
}

function closeAIDrawer() {
  aiDrawer.classList.remove('open');
  if (!sidebar.classList.contains('open')) {
    overlay.classList.remove('active');
  }
}

$('#btn-open-ai')?.addEventListener('click', openAIDrawer);
$('#btn-toolbar-ai')?.addEventListener('click', openAIDrawer);
$('#btn-ai-drawer-close')?.addEventListener('click', closeAIDrawer);

// Dispatch AI Query
async function dispatchAIQuery(promptText) {
  if (!promptText || !promptText.trim()) return;

  const messagesContainer = $('#ai-messages');
  const indicator = $('#ai-status-indicator');

  // Add User Message bubble
  const userMsg = document.createElement('div');
  userMsg.className = 'ai-msg user';
  userMsg.innerHTML = `<div class="ai-msg-bubble">${escapeHtml(promptText)}</div>`;
  messagesContainer.appendChild(userMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Add placeholder Assistant bubble
  const assistantMsg = document.createElement('div');
  assistantMsg.className = 'ai-msg assistant';
  assistantMsg.innerHTML = `
    <div class="ai-msg-bubble">
      <span style="color:var(--text-muted);font-style:italic;">⚡ Thinking & analyzing codebase...</span>
    </div>`;
  messagesContainer.appendChild(assistantMsg);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  indicator.classList.add('busy');

  // Gather Context
  const context = {
    activeFile: activeTab || 'none',
    language: activeTab ? detectMode(activeTab) : 'text',
    selectedCode: editor ? editor.getSelectedText() : '',
    fileContent: editor ? editor.getValue() : '',
    projectTree: fileTreeData
  };

  try {
    const reply = await window.AI.chat(promptText, context);
    indicator.classList.remove('busy');

    renderAIMessage(assistantMsg.querySelector('.ai-msg-bubble'), reply);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  } catch (err) {
    indicator.classList.remove('busy');
    assistantMsg.querySelector('.ai-msg-bubble').innerHTML = `
      <div style="color:var(--accent-rose);">❌ AI Error: ${escapeHtml(err.message)}</div>`;
  }
}

function renderAIMessage(container, markdownText) {
  // Simple markdown renderer with code fence extractor
  const codeRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;
  let html = '';

  while ((match = codeRegex.exec(markdownText)) !== null) {
    const textBefore = markdownText.substring(lastIndex, match.index);
    html += formatMarkdownText(textBefore);

    const lang = match[1] || 'text';
    const codeContent = match[2];
    const encodedCode = encodeURIComponent(codeContent);

    html += `
      <div class="ai-code-card">
        <pre><code>${escapeHtml(codeContent)}</code></pre>
        <div class="ai-code-actions">
          <button class="btn-apply-code" data-code="${encodedCode}">📥 Apply to Editor</button>
          <button class="btn-secondary" style="padding:4px 8px;font-size:0.75rem;" onclick="navigator.clipboard.writeText(decodeURIComponent('${encodedCode}')); toast('Copied to clipboard!');">📋 Copy</button>
        </div>
      </div>`;

    lastIndex = match.index + match[0].length;
  }

  html += formatMarkdownText(markdownText.substring(lastIndex));
  container.innerHTML = html;

  // Bind Apply buttons
  container.querySelectorAll('.btn-apply-code').forEach(btn => {
    btn.addEventListener('click', () => {
      const code = decodeURIComponent(btn.dataset.code);
      if (!editor || !activeTab) {
        toast('Open a file to apply code');
        return;
      }
      editor.setValue(code, 1);
      toast('Applied to active file! ✓');
      closeAIDrawer();
    });
  });
}

function formatMarkdownText(txt) {
  return txt
    .replace(/^### (.*$)/gim, '<h4 style="margin:8px 0 4px;color:var(--accent-cyan);">$1</h4>')
    .replace(/^## (.*$)/gim, '<h3 style="margin:10px 0 6px;color:#fff;">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,0.1);padding:2px 4px;border-radius:4px;color:#38bdf8;">$1</code>')
    .replace(/\n/g, '<br>');
}

// AI Quick Action Chips
$$('.ai-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const action = chip.dataset.aiAct;
    let prompt = '';
    switch (action) {
      case 'explain':
        prompt = 'Explain this code step-by-step with architectural highlights.';
        break;
      case 'fix':
        prompt = 'Analyze this code for syntax errors, bugs, or missing brackets, and provide a fixed version.';
        break;
      case 'optimize':
        prompt = 'Refactor and optimize this code for performance and modern clean standards.';
        break;
      case 'generate-calc':
        prompt = 'Generate an interactive glassmorphic calculator with full CSS and JS logic.';
        break;
      case 'generate-canvas':
        prompt = 'Generate a neon particle constellation canvas with touch interactivity.';
        break;
      case 'test':
        prompt = 'Generate a comprehensive automated unit test suite for this file.';
        break;
    }
    dispatchAIQuery(prompt);
  });
});

$('#btn-ai-send')?.addEventListener('click', () => {
  const input = $('#ai-input-text');
  const val = input.value.trim();
  if (val) {
    input.value = '';
    dispatchAIQuery(val);
  }
});

$('#ai-input-text')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (val) {
      e.target.value = '';
      dispatchAIQuery(val);
    }
  }
});

/* ==========================================================================
   LIVE PREVIEW SANDBOX & CONSOLE
   ========================================================================== */
const previewModal = $('#preview-modal');
const previewContainer = $('#preview-container');
const previewIframe = $('#preview-iframe');
const consoleLogsContainer = $('#console-logs');

$('#btn-preview')?.addEventListener('click', runPreview);
$('#btn-preview-close')?.addEventListener('click', () => {
  previewModal.classList.remove('active');
});
$('#btn-preview-reload')?.addEventListener('click', runPreview);

async function runPreview() {
  if (!currentProject) return;

  previewModal.classList.add('active');
  consoleLogsContainer.innerHTML = '';
  addConsoleLog('🚀 Starting live preview sandbox...', 'log');

  const files = await API.getAllProjectFiles(currentProject.id);

  // Check if active file is Python
  if (activeTab && activeTab.endsWith('.py')) {
    runPythonPreview(files[activeTab] || editor.getValue());
    return;
  }

  // HTML / Web Preview
  let htmlContent = files['index.html'] || (activeTab?.endsWith('.html') ? editor.getValue() : null);
  if (!htmlContent) {
    htmlContent = `<!DOCTYPE html><html><head><title>Preview</title></head><body style="color:white;background:#0b0f17;font-family:sans-serif;padding:20px;"><h2>No HTML Entry Point Found</h2><p>Create an <code>index.html</code> file or open an HTML tab to preview.</p></body></html>`;
  }

  // Inlining CSS & JS
  let cssContent = files['style.css'] || files['css/style.css'] || files['app.css'] || '';
  let jsContent = files['script.js'] || files['js/app.js'] || files['index.js'] || '';

  // Console interceptor script
  const consoleScript = `
    <script>
      (function() {
        const sendLog = (level, args) => {
          window.parent.postMessage({
            type: 'vs_console_log',
            level: level,
            args: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))
          }, '*');
        };
        ['log', 'warn', 'error', 'info'].forEach(fn => {
          const orig = console[fn];
          console[fn] = function(...args) {
            orig.apply(console, args);
            sendLog(fn, args);
          };
        });
        window.onerror = function(msg, url, line) {
          sendLog('error', ['Uncaught Error: ' + msg + ' (line ' + line + ')']);
        };
      })();
    </script>
  `;

  // Inject console interceptor before closing head or at top
  let finalHtml = htmlContent;
  if (finalHtml.includes('</head>')) {
    finalHtml = finalHtml.replace('</head>', `${consoleScript}${cssContent ? `<style>${cssContent}</style>` : ''}</head>`);
  } else {
    finalHtml = consoleScript + (cssContent ? `<style>${cssContent}</style>` : '') + finalHtml;
  }

  // Append JS if available
  if (jsContent) {
    finalHtml += `<script>${jsContent}</script>`;
  }

  previewIframe.srcdoc = finalHtml;
}

// In-Browser Python Execution via Pyodide CDN
async function runPythonPreview(pythonCode) {
  addConsoleLog('🐍 Loading in-browser Python WebAssembly engine (Pyodide)...', 'log');

  const pyHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js"></script>
    </head>
    <body style="background:#090d16;color:#38bdf8;font-family:monospace;padding:16px;">
      <h3>Python Execution Sandbox</h3>
      <div id="py-output" style="white-space:pre-wrap;color:#e2e8f0;margin-top:12px;">Running script...</div>
      <script>
        async function run() {
          const out = document.getElementById('py-output');
          try {
            let pyodide = await loadPyodide();
            pyodide.setStdout({
              batched: (str) => {
                out.innerText += str + '\\n';
                window.parent.postMessage({ type: 'vs_console_log', level: 'log', args: [str] }, '*');
              }
            });
            await pyodide.runPythonAsync(${JSON.stringify(pythonCode)});
            window.parent.postMessage({ type: 'vs_console_log', level: 'info', args: ['[Python Execution Completed]'] }, '*');
          } catch(err) {
            out.innerText += '\\nError: ' + err.message;
            window.parent.postMessage({ type: 'vs_console_log', level: 'error', args: [err.message] }, '*');
          }
        }
        run();
      </script>
    </body>
    </html>`;

  previewIframe.srcdoc = pyHtml;
}

// Console postMessage listener
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'vs_console_log') {
    const text = (e.data.args || []).join(' ');
    addConsoleLog(text, e.data.level || 'log');
  }
});

function addConsoleLog(text, level = 'log') {
  const line = document.createElement('div');
  line.className = `console-log ${level}`;
  const time = new Date().toTimeString().split(' ')[0];
  line.innerHTML = `<span style="opacity:0.5;font-size:0.75rem;">[${time}]</span> ${escapeHtml(text)}`;
  consoleLogsContainer.appendChild(line);
  consoleLogsContainer.scrollTop = consoleLogsContainer.scrollHeight;
}

$('#btn-clear-console')?.addEventListener('click', () => {
  consoleLogsContainer.innerHTML = '';
});

// Interactive Console REPL Input
$('#console-input')?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const val = e.target.value.trim();
    if (!val) return;
    e.target.value = '';
    addConsoleLog('> ' + val, 'log');

    try {
      if (previewIframe.contentWindow) {
        const result = previewIframe.contentWindow.eval(val);
        addConsoleLog('← ' + String(result), 'log');
      } else {
        addConsoleLog('← Sandbox not ready', 'warn');
      }
    } catch (err) {
      addConsoleLog('← Error: ' + err.message, 'error');
    }
  }
});

// Device Switcher
$$('.device-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.device-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const device = btn.dataset.device;
    previewContainer.className = 'preview-frame-container ' + device;
  });
});

/* ==========================================================================
   SETTINGS MODAL & PREFERENCES
   ========================================================================== */
function openSettingsModal() {
  const cfg = window.AI.getConfig();
  $('#setting-ai-provider').value = cfg.provider || 'offline';
  $('#setting-ai-api-key').value = cfg.apiKey || '';
  $('#setting-custom-endpoint').value = cfg.customEndpoint || '';

  toggleProviderFields(cfg.provider);

  const currentTheme = localStorage.getItem('vs_mobile_editor_theme') || 'monokai';
  $('#setting-editor-theme').value = currentTheme;

  const currentFontSize = localStorage.getItem('vs_mobile_font_size') || '13.5px';
  $('#setting-font-size').value = currentFontSize;

  $('#modal-settings').classList.add('active');
}

function closeSettingsModal() {
  $('#modal-settings').classList.remove('active');
}

function toggleProviderFields(provider) {
  const keyGroup = $('#setting-api-key-group');
  const endpointGroup = $('#setting-custom-endpoint-group');

  if (provider === 'offline') {
    keyGroup.style.display = 'none';
    endpointGroup.style.display = 'none';
  } else if (provider === 'custom') {
    keyGroup.style.display = 'block';
    endpointGroup.style.display = 'block';
  } else {
    keyGroup.style.display = 'block';
    endpointGroup.style.display = 'none';
  }
}

$('#setting-ai-provider')?.addEventListener('change', (e) => {
  toggleProviderFields(e.target.value);
});

$('#btn-settings')?.addEventListener('click', openSettingsModal);
$('#btn-settings-projects')?.addEventListener('click', openSettingsModal);

$('#btn-save-settings')?.addEventListener('click', () => {
  const provider = $('#setting-ai-provider').value;
  const apiKey = $('#setting-ai-api-key').value.trim();
  const customEndpoint = $('#setting-custom-endpoint').value.trim();
  const theme = $('#setting-editor-theme').value;
  const fontSize = $('#setting-font-size').value;

  window.AI.saveConfig({ provider, apiKey, customEndpoint });

  localStorage.setItem('vs_mobile_editor_theme', theme);
  localStorage.setItem('vs_mobile_font_size', fontSize);

  if (editor) {
    editor.setTheme('ace/theme/' + theme);
    editor.setFontSize(fontSize);
  }

  closeSettingsModal();
  toast('Preferences saved! ✓');
});

$('#modal-settings')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal-settings') closeSettingsModal();
});

/* ==========================================================================
   LANGUAGE MODE DETECTION HELPER
   ========================================================================== */
function detectMode(path) {
  const ext = path.split('.').pop().toLowerCase();
  const map = {
    html: 'html', htm: 'html',
    css: 'css', scss: 'scss', less: 'less',
    js: 'javascript', mjs: 'javascript', jsx: 'jsx',
    ts: 'typescript', tsx: 'tsx',
    py: 'python',
    json: 'json',
    md: 'markdown',
    php: 'php',
    sql: 'sql',
    sh: 'sh', bash: 'sh',
    xml: 'xml', svg: 'xml',
    yaml: 'yaml', yml: 'yaml',
    c: 'c_cpp', cpp: 'c_cpp', h: 'c_cpp',
    txt: 'text'
  };
  return map[ext] || 'text';
}

/* ==========================================================================
   APPLICATION BOOT
   ========================================================================== */
(async function boot() {
  console.log('📱 Initializing VS Mobile IDE Core...');
  await API.checkServer();
  loadProjects();
  showScreen('screen-projects');
})();
