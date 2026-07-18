export function openDashboard(files, initialPath) {
  // 1. Open an empty tab (bypasses popup blockers because it's triggered by a user click)
  const win = window.open('', '_blank');
  if (!win) return alert('Pop-up blocked. Please allow pop-ups for Bitbucket.');

  // 2. Write the HTML structure WITHOUT any <script> tags
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Artifact Explorer</title>
        <style>
          body { margin: 0; display: flex; height: 100vh; font-family: -apple-system, sans-serif; background: #fff; overflow: hidden; }
          #sidebar { width: 300px; background: #f4f5f7; border-right: 1px solid #dfe1e6; display: flex; flex-direction: column; }
          .sidebar-header { padding: 15px; background: #ebecf0; font-weight: bold; color: #1F1F21; border-bottom: 1px solid #dfe1e6; }
          #file-tree { flex: 1; overflow-y: auto; padding: 10px; font-size: 13px; color: #42526e; }
          #main { flex: 1; display: flex; flex-direction: column; background: #ebecf0; color: #1F1F21; }
          .topbar { padding: 10px 15px; background: #fff; border-bottom: 1px solid #dfe1e6; color: #5e6c84; font-size: 14px; display: flex; align-items: center; }
          #current-file { font-family: monospace; background: #ebecf0; padding: 2px 6px; border-radius: 3px; margin-left: 10px; }
          iframe { flex: 1; width: 100%; height: 100%; border: none; background: #fff; }
          ul { list-style: none; padding-left: 15px; margin: 0; }
          #file-tree > ul { padding-left: 0; }
          li { margin: 2px 0; }
          .folder { cursor: pointer; font-weight: 600; padding: 4px; color: #1F1F21; display: block; }
          .file { padding: 4px 4px 4px 20px; cursor: pointer; display: block; border-radius: 3px; }
          .file:hover { background: #dfe1e6; }
          .file.active { background: #7e7d7d; color: white; }
          
          @media (prefers-color-scheme: dark) {
            body { background: #1F1F21; color: #f4f5f7; }
            #sidebar { background: #1F1F21; border-right: 1px solid #37373a; }
            .sidebar-header { background: #2f2f33; color: #f4f5f7; border-bottom: 1px solid #37373a; }
            .topbar { background: #1F1F21; border-bottom: 1px solid #2f2f33; color: #b3bac5; }
            #current-file { background: #2f2f33; color: #fff; }
            .file { color: #b3bac5; }
            .file:hover { background: #2f2f33; }
            .file.active { background: #7e7d7d; color: #fff; }
            .folder { color: #fff; }
          }
        </style>
      </head>
      <body>
        <div id="sidebar">
          <div class="sidebar-header">📦 Archive Explorer</div>
          <div id="file-tree"></div>
        </div>
        <div id="main">
          <div class="topbar">Previewing: <span id="current-file">Select a file</span></div>
          <iframe id="preview-frame"></iframe>
        </div>
      </body>
    </html>
  `);
  win.document.close();

  // 3. ATTACH LOGIC DIRECTLY (CSP Immunity + Internal Routing Fix)
  const doc = win.document;
  const iframe = doc.getElementById('preview-frame');
  const currentFileLabel = doc.getElementById('current-file');
  let activeEl = null;

  // Build the folder tree data structure
  const tree = {};
  Object.keys(files).sort().forEach(path => {
    const parts = path.split('/');
    let current = tree;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) current[part] = path;
      else current = current[part] = current[part] || {};
    });
  });

  const flattenTree = (node) => {
    for (const key in node) {
      if (typeof node[key] === 'object') {
        flattenTree(node[key]);
        const keys = Object.keys(node[key]);
        if (keys.length === 1 && typeof node[key][keys[0]] === 'object') {
          node[`${key}/${keys[0]}`] = node[key][keys[0]];
          delete node[key];
        }
      }
    }
  };
  flattenTree(tree);

  const renderTree = (node, container) => {
    const ul = doc.createElement('ul');
    Object.entries(node).sort(([nameA, valA], [nameB, valB]) => {
      const isDirA = typeof valA === 'object';
      const isDirB = typeof valB === 'object';
      return isDirA !== isDirB ? (isDirA ? -1 : 1) : nameA.localeCompare(nameB);
    }).forEach(([name, value]) => {
      const li = doc.createElement('li');
      if (typeof value === 'string') {
        const icon = name.endsWith('.html') ? '🌐' : name.endsWith('.xml') ? '📊' : '📄';
        li.innerHTML = `<span class="file" data-path="${value}">${icon} ${name}</span>`;
      } else {
        li.innerHTML = `<span class="folder"><span class="icon-toggle">►</span><span class="icon-folder">📁</span> ${name}</span>`;
        const subContainer = doc.createElement('div');
        subContainer.style.display = 'none';
        renderTree(value, subContainer);
        li.appendChild(subContainer);
      }
      ul.appendChild(li);
    });
    container.appendChild(ul);
  };
  renderTree(tree, doc.getElementById('file-tree'));

  const activateSidebarItem = (path) => {
    const targetEl = doc.querySelector(`.file[data-path="${path}"]`);
    if (!targetEl) return;

    if (activeEl) activeEl.classList.remove('active');
    targetEl.classList.add('active');
    activeEl = targetEl;
    currentFileLabel.innerText = path;

    let parent = targetEl.parentElement;
    while (parent && parent.id !== 'file-tree') {
      if (parent.style.display === 'none') {
        parent.style.display = 'block';
        const folderSpan = parent.previousElementSibling;
        if (folderSpan?.classList.contains('folder')) {
          folderSpan.querySelector('.icon-toggle').textContent = '▼';
          folderSpan.querySelector('.icon-folder').textContent = '📂';
        }
      }
      parent = parent.parentElement;
    }
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  doc.getElementById('file-tree').addEventListener('click', (e) => {
    const folderEl = e.target.closest('.folder');
    if (folderEl) {
      const sub = folderEl.nextElementSibling;
      const isCollapsed = sub.style.display === 'none';
      sub.style.display = isCollapsed ? 'block' : 'none';
      folderEl.querySelector('.icon-toggle').textContent = isCollapsed ? '▼' : '►';
      folderEl.querySelector('.icon-folder').textContent = isCollapsed ? '📂' : '📁';
    }

    const fileEl = e.target.closest('.file');
    if (fileEl) {
      const path = fileEl.dataset.path;
      iframe.src = files[path];
      activateSidebarItem(path);
    }
  });

  // --- THE INTERNAL ROUTING FIX ---
  // Intercepts link clicks inside Istanbul reports to calculate the next Blob
  iframe.addEventListener('load', () => {
    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      if (!iframeDoc) return;

      const currentPath = activeEl ? activeEl.dataset.path : '';
      const currentDir = currentPath.includes('/') ? currentPath.substring(0, currentPath.lastIndexOf('/')) : '';

      iframeDoc.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        // Ignore absolute, anchor, or already processed links
        if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('blob:')) return;

        e.preventDefault();

        // Resolve the relative path (e.g. going from "coverage/index.html" -> "../utils.html")
        const stack = currentDir ? currentDir.split('/') : [];
        const parts = href.split('/');
        for (const part of parts) {
          if (part === '.') continue;
          if (part === '..') stack.pop();
          else stack.push(part);
        }
        const targetPath = stack.join('/');

        // Apply navigation
        if (files[targetPath]) {
          iframe.src = files[targetPath];
          activateSidebarItem(targetPath);
        } else {
          console.warn('Artifact path not found in archive:', targetPath);
        }
      });
    } catch (err) {
      // Catch cross-origin errors silently
    }
  });

  // Init the first file
  const allPaths = Object.keys(files);
  const targetPath = (initialPath && files[initialPath]) ? initialPath :
    (allPaths.filter(p => p.endsWith('index.html')).sort((a, b) => a.split('/').length - b.split('/').length)[0] ||
      allPaths.sort((a, b) => a.split('/').length - b.split('/').length)[0]);

  if (targetPath) {
    iframe.src = files[targetPath];
    activateSidebarItem(targetPath);
  }
};
