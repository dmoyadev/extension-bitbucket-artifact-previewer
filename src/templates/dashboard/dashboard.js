export function attachDashboardLogic(win, files, initialPath) {
  const doc = win.document;
  const iframe = doc.querySelector('iframe');
  const currentFileLabel = doc.getElementById('current-file');
  let activeEl = null;

  // Get the icon url
  const iconUrl = chrome.runtime.getURL("icons/icon16.png");
  doc.querySelector('#logo').src = iconUrl;
  const link = doc.createElement('link');
  link.rel = 'icon';
  link.href = iconUrl;
  doc.head.appendChild(link);

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

  function renderTree(node, container) {
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
  }
  renderTree(tree, doc.getElementById('file-tree'));

  function activateSidebarItem(path) {
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
  }

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
}
