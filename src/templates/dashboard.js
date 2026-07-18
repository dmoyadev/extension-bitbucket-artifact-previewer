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
          body {
            margin: 0;
            display: flex;
            height: 100vh;
            overflow: hidden;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background: #f3f4f6;
            color: #111827;
          }
        
          #sidebar {
            width: 300px;
            display: flex;
            flex-direction: column;
            background: #fafafa;
            border-right: 1px solid #e5e7eb;
          }
        
          .sidebar-header {
            padding: 16px;
            font-weight: 700;
            background: #fff;
            border-bottom: 1px solid #e5e7eb;
          }
        
          #file-tree {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
            font-size: 13px;
            color: #4b5563;
          }
        
          #main {
            flex: 1;
            display: flex;
            flex-direction: column;
            background: #f3f4f6;
          }
        
          .topbar {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 12px 16px;
            background: #fff;
            border-bottom: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        
          #current-file {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            padding: 3px 8px;
            border-radius: 6px;
            color: #374151;
          }
        
          iframe {
            flex: 1;
            width: 100%;
            border: none;
            background: #fff;
          }
        
          ul {
            list-style: none;
            margin: 0;
            padding-left: 16px;
          }
        
          #file-tree > ul {
            padding-left: 0;
          }
        
          li {
            margin: 2px 0;
          }
        
          .folder {
            display: block;
            padding: 5px;
            font-weight: 600;
            color: #111827;
            cursor: pointer;
          }
        
          .file {
            display: block;
            padding: 5px 5px 5px 20px;
            border-radius: 6px;
            color: #4b5563;
            cursor: pointer;
            transition: background .15s;
          }
        
          .file:hover {
            background: #e5e7eb;
          }
        
          .file.active {
            background: #4b5563;
            color: #fff;
          }
        
          @media (prefers-color-scheme: dark) {
            body {
              background: #111827;
              color: #f3f4f6;
            }
        
            #sidebar {
              background: #1f2937;
              border-right-color: #374151;
            }
        
            .sidebar-header {
              background: #273244;
              border-bottom-color: #374151;
              color: #f3f4f6;
            }
        
            #main {
              background: #111827;
            }
        
            .topbar {
              background: #1f2937;
              border-bottom-color: #374151;
              color: #9ca3af;
            }
        
            #current-file {
              background: #273244;
              border-color: #374151;
              color: #f3f4f6;
            }
        
            iframe {
              background: #fff;
            }
        
            .folder {
              color: #f3f4f6;
            }
        
            .file {
              color: #d1d5db;
            }
        
            .file:hover {
              background: #374151;
            }
        
            .file.active {
              background: #6b7280;
              color: #fff;
            }
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
