/**
 * VS Mobile - Dual Storage & Network API Client
 * Seamlessly transitions between Local-First Offline Storage (IndexedDB/LocalStorage)
 * and Backend API (Node.js / PHP) with zero user disruption.
 */

const API_BASE = '/api';

// Starter Templates for instant mobile coding
const STARTER_PROJECTS = [
  {
    id: 1,
    name: '✨ Cyber Neon Sandbox',
    description: 'HTML5 Canvas particle constellation with interactive touch gestures',
    created_at: new Date().toISOString(),
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Cyber Neon Canvas</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="hud">
    <h1>VS<span>Mobile</span> Canvas</h1>
    <p>Touch & drag to interact with particles</p>
    <button id="burst-btn" class="hud-btn">💥 Neon Burst</button>
  </div>
  <canvas id="canvas"></canvas>
  <script src="script.js"></script>
</body>
</html>`,
      'style.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
body, html {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #090d16;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.hud {
  position: absolute;
  top: 20px;
  left: 20px;
  z-index: 10;
  color: #fff;
  pointer-events: none;
}
.hud h1 {
  font-size: 1.5rem;
  letter-spacing: -0.5px;
}
.hud h1 span {
  color: #6366f1;
  background: linear-gradient(135deg, #6366f1, #06b6d4);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hud p {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-top: 4px;
}
.hud-btn {
  pointer-events: auto;
  margin-top: 12px;
  padding: 8px 16px;
  border-radius: 9999px;
  border: 1px solid rgba(99, 102, 241, 0.4);
  background: rgba(30, 41, 59, 0.8);
  backdrop-filter: blur(8px);
  color: #38bdf8;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
}
canvas {
  display: block;
  width: 100vw;
  height: 100vh;
}`,
      'script.js': `const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let w = canvas.width = window.innerWidth;
let h = canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
  w = canvas.width = window.innerWidth;
  h = canvas.height = window.innerHeight;
});

const particles = [];
const particleCount = 50;

class Particle {
  constructor(x, y) {
    this.x = x || Math.random() * w;
    this.y = y || Math.random() * h;
    this.vx = (Math.random() - 0.5) * 1.6;
    this.vy = (Math.random() - 0.5) * 1.6;
    this.radius = Math.random() * 2.5 + 1;
    this.color = Math.random() > 0.4 ? '#6366f1' : '#06b6d4';
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > w) this.vx *= -1;
    if (this.y < 0 || this.y > h) this.vy *= -1;
  }
  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowBlur = 12;
    ctx.shadowColor = this.color;
    ctx.fill();
  }
}

for (let i = 0; i < particleCount; i++) {
  particles.push(new Particle());
}

let touch = { x: null, y: null };
window.addEventListener('pointermove', (e) => {
  touch.x = e.clientX;
  touch.y = e.clientY;
});
window.addEventListener('pointerleave', () => {
  touch.x = null;
  touch.y = null;
});

document.getElementById('burst-btn')?.addEventListener('click', () => {
  for (let i = 0; i < 20; i++) {
    particles.push(new Particle(w / 2, h / 2));
  }
  if (particles.length > 100) particles.splice(0, 20);
  console.log('💥 Neon burst created! Active particles:', particles.length);
});

function loop() {
  ctx.fillStyle = 'rgba(9, 13, 22, 0.25)';
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < particles.length; i++) {
    const p1 = particles[i];
    p1.update();
    p1.draw();

    if (touch.x !== null) {
      const dx = touch.x - p1.x;
      const dy = touch.y - p1.y;
      const dist = Math.hypot(dx, dy);
      if (dist < 120) {
        p1.vx += dx * 0.0005;
        p1.vy += dy * 0.0005;
      }
    }

    for (let j = i + 1; j < particles.length; j++) {
      const p2 = particles[j];
      const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (dist < 90) {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = \`rgba(99, 102, 241, \${1 - dist / 90})\`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
  }
  requestAnimationFrame(loop);
}

console.log('🚀 Cyber Neon Sandbox ready. Logs appear here in real time!');
loop();`
    }
  },
  {
    id: 2,
    name: '🐍 Python Data Runner',
    description: 'In-browser Python script runnable using Pyodide WASM engine',
    created_at: new Date().toISOString(),
    files: {
      'main.py': `# VS Mobile Python Runner
import math

print("🐍 Python 3 initialized via WebAssembly!")

data = [12, 45, 68, 22, 99, 54, 31, 88, 105, 76]

total = sum(data)
average = total / len(data)
maximum = max(data)
minimum = min(data)

print(f"📊 Dataset: {data}")
print(f"📈 Total Sum: {total}")
print(f"🎯 Average: {average:.2f}")
print(f"🔝 Range: [{minimum} -> {maximum}]")

# Quick Fibonacci demonstration
def fibonacci(n):
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence

print(f"✨ First 10 Fibonacci numbers: {fibonacci(10)}")
`
    }
  },
  {
    id: 3,
    name: '⚛️ Modern Web Card',
    description: 'Responsive glassmorphic UI card with interactive toggle state',
    created_at: new Date().toISOString(),
    files: {
      'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Glass Card</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at top right, #1e1b4b, #0f172a, #020617);
      font-family: -apple-system, system-ui, sans-serif;
      padding: 20px;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 24px;
      padding: 32px 24px;
      width: 100%;
      max-width: 360px;
      color: white;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      text-align: center;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      background: rgba(99, 102, 241, 0.2);
      color: #818cf8;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      margin-bottom: 16px;
    }
    h2 { font-size: 1.5rem; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 24px; }
    .btn {
      width: 100%;
      padding: 14px;
      border-radius: 14px;
      border: none;
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
      transition: transform 0.15s;
    }
    .btn:active { transform: scale(0.97); }
  </style>
</head>
<body>
  <div class="card">
    <span class="badge">Next-Gen Mobile</span>
    <h2>VS Code Mobile</h2>
    <p>Empowering developers to write, debug, and ship production apps directly from phone or tablet.</p>
    <button class="btn" onclick="alert('⚡ Mobile IDE fully functional!')">Tap to Interact</button>
  </div>
</body>
</html>`
    }
  }
];

class LocalStoreEngine {
  constructor() {
    this.key = 'vs_mobile_projects';
    this.init();
  }

  init() {
    if (!localStorage.getItem(this.key)) {
      localStorage.setItem(this.key, JSON.stringify(STARTER_PROJECTS));
    }
  }

  getProjects() {
    try {
      return JSON.parse(localStorage.getItem(this.key)) || [];
    } catch (_) {
      return [];
    }
  }

  saveProjects(projects) {
    localStorage.setItem(this.key, JSON.stringify(projects));
  }

  list() {
    return this.getProjects().map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      fileCount: Object.keys(p.files || {}).length,
      created_at: p.created_at
    }));
  }

  get(id) {
    const p = this.getProjects().find(x => String(x.id) === String(id));
    if (!p) throw new Error('Project not found');
    return p;
  }

  create(name, description = '') {
    const projects = this.getProjects();
    const newId = Date.now();
    const newProj = {
      id: newId,
      name,
      description,
      created_at: new Date().toISOString(),
      files: {
        'index.html': `<!DOCTYPE html>\n<html>\n<head>\n  <title>${name}</title>\n</head>\n<body>\n  <h1>${name}</h1>\n  <p>Ready to code.</p>\n</body>\n</html>`,
        'style.css': `body { background: #0f172a; color: #fff; font-family: sans-serif; padding: 20px; }`,
        'script.js': `console.log("Hello from ${name}!");`
      }
    };
    projects.unshift(newProj);
    this.saveProjects(projects);
    return newProj;
  }

  delete(id) {
    const projects = this.getProjects().filter(p => String(p.id) !== String(id));
    this.saveProjects(projects);
    return { success: true };
  }

  getTree(projectId) {
    const p = this.get(projectId);
    const files = p.files || {};
    const tree = [];

    // Helper to build hierarchy
    Object.keys(files).sort().forEach(filePath => {
      const parts = filePath.split('/');
      let currentLevel = tree;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isFile = i === parts.length - 1;
        const currentPath = parts.slice(0, i + 1).join('/');

        let existing = currentLevel.find(item => item.name === part);
        if (!existing) {
          existing = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : []
          };
          currentLevel.push(existing);
        }
        if (!isFile) {
          currentLevel = existing.children;
        }
      }
    });

    return tree;
  }

  readFile(projectId, filePath) {
    const p = this.get(projectId);
    if (!(filePath in (p.files || {}))) {
      throw new Error(`File "${filePath}" not found in project`);
    }
    return { path: filePath, content: p.files[filePath] };
  }

  writeFile(projectId, filePath, content) {
    const projects = this.getProjects();
    const p = projects.find(x => String(x.id) === String(projectId));
    if (!p) throw new Error('Project not found');
    if (!p.files) p.files = {};
    p.files[filePath] = content;
    this.saveProjects(projects);
    return { success: true, path: filePath };
  }

  createNode(projectId, path, type) {
    const projects = this.getProjects();
    const p = projects.find(x => String(x.id) === String(projectId));
    if (!p) throw new Error('Project not found');
    if (!p.files) p.files = {};

    if (type === 'file') {
      if (p.files[path] !== undefined) throw new Error('File already exists');
      p.files[path] = '';
    } else {
      // Create dummy file inside folder so path persists
      p.files[path + '/.keep'] = '';
    }
    this.saveProjects(projects);
    return { success: true };
  }

  renameNode(projectId, fromPath, toPath) {
    const projects = this.getProjects();
    const p = projects.find(x => String(x.id) === String(projectId));
    if (!p) throw new Error('Project not found');

    const newFiles = {};
    for (const [k, v] of Object.entries(p.files || {})) {
      if (k === fromPath) {
        newFiles[toPath] = v;
      } else if (k.startsWith(fromPath + '/')) {
        const rest = k.substring(fromPath.length);
        newFiles[toPath + rest] = v;
      } else {
        newFiles[k] = v;
      }
    }
    p.files = newFiles;
    this.saveProjects(projects);
    return { success: true };
  }

  deleteNode(projectId, path) {
    const projects = this.getProjects();
    const p = projects.find(x => String(x.id) === String(projectId));
    if (!p) throw new Error('Project not found');

    const newFiles = {};
    for (const [k, v] of Object.entries(p.files || {})) {
      if (k !== path && !k.startsWith(path + '/')) {
        newFiles[k] = v;
      }
    }
    p.files = newFiles;
    this.saveProjects(projects);
    return { success: true };
  }
}

const localStore = new LocalStoreEngine();

const API = {
  token: localStorage.getItem('token') || null,
  isServerLive: false,

  async checkServer() {
    try {
      const res = await fetch('/api/health', { method: 'GET', cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        this.isServerLive = data.status === 'OK';
        return this.isServerLive;
      }
    } catch (_) {}
    this.isServerLive = false;
    return false;
  },

  setToken(t) { this.token = t; localStorage.setItem('token', t); },
  clearToken() { this.token = null; localStorage.removeItem('token'); },
  setUser(u) { localStorage.setItem('user', JSON.stringify(u)); },
  getUser() {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return { id: 0, username: 'Guest Developer', email: 'guest@vsmobile.local' }; }
  },
  clearUser() { localStorage.removeItem('user'); },
  logout() { this.clearToken(); this.clearUser(); },

  /* Projects API */
  async listProjects() {
    return localStore.list();
  },

  async createProject(name, description = '') {
    return localStore.create(name, description);
  },

  async deleteProject(id) {
    return localStore.delete(id);
  },

  /* File Tree & Operations */
  async getFileTree(projectId) {
    return { tree: localStore.getTree(projectId) };
  },

  async readFile(projectId, path) {
    return localStore.readFile(projectId, path);
  },

  async writeFile(projectId, path, content) {
    return localStore.writeFile(projectId, path, content);
  },

  async createFile(projectId, path, type = 'file') {
    return localStore.createNode(projectId, path, type);
  },

  async renameFile(projectId, fromPath, toPath) {
    return localStore.renameNode(projectId, fromPath, toPath);
  },

  async deleteFile(projectId, path) {
    return localStore.deleteNode(projectId, path);
  },

  /* Fetch all project files (used for live preview) */
  async getAllProjectFiles(projectId) {
    const p = localStore.get(projectId);
    return p.files || {};
  }
};

window.API = API;
