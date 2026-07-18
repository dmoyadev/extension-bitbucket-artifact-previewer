export const generateDashboardHtml = (fileUrls, initialPath, pageNonce) => {
  const nonceAttr = pageNonce ? `nonce="${pageNonce}"` : '';

  const styles = `
    <style>
      body { margin: 0; display: flex; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; overflow: hidden; }
      #sidebar { width: 300px; background: #f4f5f7; border-right: 1px solid #dfe1e6; display: flex; flex-direction: column; }
      .sidebar-header { padding: 15px; background: #ebecf0; font-weight: bold; color: #1F1F21; border-bottom: 1px solid #dfe1e6; }
      #file-tree { flex: 1; overflow-y: auto; padding: 10px; font-size: 13px; color: #42526e; }
      #main { flex: 1; display: flex; flex-direction: column; background: #ebecf0; color: #1F1F21; }
      .topbar { padding: 10px 15px; background: #fff; border-bottom: 1px solid #dfe1e6; color: #5e6c84; font-size: 14px; display: flex; align-items: center; }
      #current-file { font-family: monospace; background: #ebecf0; padding: 2px 6px; border-radius: 3px; margin-left: 10px; }
      iframe { flex: 1; width: 100%; height: 100%; border: none; }
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
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Artifact Explorer</title>
        ${styles}
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
        
        <script ${nonceAttr}>
          const files = ${JSON.stringify(fileUrls)};
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
                  node[\`\${key}/\${keys[0]}\`] = node[key][keys[0]];
                  delete node[key];
                }
              }
            }
          };
          flattenTree(tree);
    
          const renderTree = (node, container) => {
            const ul = document.createElement('ul');
            Object.entries(node).sort(([nameA, valA], [nameB, valB]) => {
                const isDirA = typeof valA === 'object';
                const isDirB = typeof valB === 'object';
                return isDirA !== isDirB ? (isDirA ? -1 : 1) : nameA.localeCompare(nameB);
            }).forEach(([name, value]) => {
                const li = document.createElement('li');
                if (typeof value === 'string') {
                  const icon = name.endsWith('.html') ? '🌐' : name.endsWith('.xml') ? '📊' : '📄';
                  li.innerHTML = \`<span class="file" data-path="\${value}">\${icon} \${name}</span>\`;
                } else {
                  li.innerHTML = \`<span class="folder"><span class="icon-toggle">►</span><span class="icon-folder">📁</span> \${name}</span>\`;
                  const subContainer = document.createElement('div');
                  subContainer.style.display = 'none';
                  renderTree(value, subContainer);
                  li.appendChild(subContainer);
                }
                ul.appendChild(li);
            });
            container.appendChild(ul);
          };
          
          renderTree(tree, document.getElementById('file-tree'));
    
          const iframe = document.getElementById('preview-frame');
          const currentFileLabel = document.getElementById('current-file');
          let activeEl = null;
    
          document.getElementById('file-tree').addEventListener('click', (e) => {
            const folderEl = e.target.closest('.folder');
            if (folderEl) {
              const sub = folderEl.nextElementSibling;
              const isCollapsed = sub.style.display === 'none';
              sub.style.display = isCollapsed ? 'block' : 'none';
              folderEl.querySelector('.icon-toggle').textContent = isCollapsed ? '▼' : '►';
              folderEl.querySelector('.icon-folder').textContent = isCollapsed ? '📂' : '📁';
            }
            
            if (e.target.classList.contains('file')) {
              if (activeEl) activeEl.classList.remove('active');
              e.target.classList.add('active');
              activeEl = e.target;
              iframe.src = files[e.target.dataset.path];
              currentFileLabel.innerText = e.target.dataset.path;
            }
          });
    
          const allPaths = Object.keys(files);
          const targetPath = "${initialPath}" && files["${initialPath}"] ? "${initialPath}" : 
            (allPaths.filter(p => p.endsWith('index.html')).sort((a, b) => a.split('/').length - b.split('/').length)[0] || 
            allPaths.sort((a, b) => a.split('/').length - b.split('/').length)[0]);
    
          if (targetPath) {
            const targetEl = document.querySelector(\`.file[data-path="\${targetPath}"]\`);
            if (targetEl) {
              targetEl.click();
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
            }
          }
        </script>
      </body>
    </html>
  `;
};
