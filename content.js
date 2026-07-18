// 1. UTILITIES

function getMimeType(filename) {
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.html')) return 'text/html;charset=utf-8';
  if (lowerName.endsWith('.css')) return 'text/css;charset=utf-8';
  if (lowerName.endsWith('.js')) return 'application/javascript;charset=utf-8';
  if (lowerName.endsWith('.json')) return 'application/json;charset=utf-8';
  if (lowerName.endsWith('.xml')) return 'text/xml;charset=utf-8';
  if (lowerName.endsWith('.svg')) return 'image/svg+xml';
  if (lowerName.match(/\.(jpeg|jpg|gif|png)$/)) return `image/${lowerName.split('.').pop()}`;
  return 'text/plain;charset=utf-8';
}

function extractTar(arrayBuffer) {
  const files = {};
  let offset = 0;
  const view = new Uint8Array(arrayBuffer);
  let nextLongName = null; // Stores paths that exceed 100 characters

  while (offset < arrayBuffer.byteLength - 512) {
    if (view[offset] === 0 && view[offset + 1] === 0) break; // Two null bytes mark the end

    // 1. Read UStar prefix (offset 345, 155 bytes)
    let prefix = '';
    for (let i = 345; i < 500; i++) {
      if (view[offset + i] === 0) break;
      prefix += String.fromCharCode(view[offset + i]);
    }

    // 2. Read standard name (offset 0, 100 bytes)
    let name = '';
    for (let i = 0; i < 100; i++) {
      if (view[offset + i] === 0) break;
      name += String.fromCharCode(view[offset + i]);
    }

    // Combine prefix and name if it's a standard UStar split path
    if (prefix) name = prefix + (prefix.endsWith('/') ? '' : '/') + name;

    // 3. Apply GNU LongLink or PAX path if we captured it in the previous block
    if (nextLongName) {
      name = nextLongName;
      nextLongName = null; // Reset for the next file
    }

    // 4. Read file size
    let sizeStr = '';
    for (let i = 124; i < 136; i++) {
      if (view[offset + i] === 0 || view[offset + i] === 32) break;
      sizeStr += String.fromCharCode(view[offset + i]);
    }
    const size = parseInt(sizeStr.trim(), 8) || 0;

    // 5. Read typeflag (tells us what kind of block this is)
    const typeflag = String.fromCharCode(view[offset + 156]);

    offset += 512; // Skip over the header to the actual data block

    // 6. Process the block based on its typeflag
    if (typeflag === 'L') {
      // GNU tar LongLink format: Data block contains the real, long file name
      nextLongName = new TextDecoder('utf-8').decode(arrayBuffer.slice(offset, offset + size)).replace(/\0/g, '');

    } else if (typeflag === 'x') {
      // POSIX pax extended header: Data block contains key=value pairs
      const paxData = new TextDecoder('utf-8').decode(arrayBuffer.slice(offset, offset + size));
      const pathMatch = paxData.match(/path=([^\n]+)/); // Extract the "path=..." variable
      if (pathMatch) nextLongName = pathMatch[1];

    } else if (size > 0 && (typeflag === '0' || typeflag === '\0')) {
      // Standard file: Safe to save
      const cleanName = name.startsWith('./') ? name.substring(2) : name;
      files[cleanName] = arrayBuffer.slice(offset, offset + size);
    }

    // Jump to the next header (Data blocks are always padded to 512 bytes)
    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

// 2. VIRTUAL FILE SYSTEM

function generateJUnitHtml(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  // 1. Check if the browser's XML parser threw an error
  if (xmlDoc.querySelector('parsererror')) {
    return null; // Abort and fallback to raw XML
  }

  // 2. Globally find all testcases, ignoring how testsuites are nested
  const cases = xmlDoc.querySelectorAll('testcase');

  // 3. Fallback to raw XML if no testcases exist in this file
  if (cases.length === 0) {
    return null;
  }

  let totalFailures = 0, totalErrors = 0, totalSkipped = 0;
  let htmlCases = '';

  cases.forEach(tc => {
    const name = tc.getAttribute('name') || 'Unnamed test';
    const classname = tc.getAttribute('classname') || '';
    const time = tc.getAttribute('time') || '0';

    const failure = tc.querySelector('failure') || tc.querySelector('error');
    const skipped = tc.querySelector('skipped');

    let status = 'passed';
    if (failure) { status = 'failed'; totalFailures++; }
    else if (skipped) { status = 'skipped'; totalSkipped++; }

    htmlCases += `
      <div class="testcase ${status}">
        <div class="test-name">${status === 'failed' ? '❌' : status === 'skipped' ? '⚠️' : '✅'} ${name}</div>
        <div class="test-meta">${classname} • ${time}s</div>
    `;

    if (failure) {
      const message = failure.getAttribute('message') || '';
      const content = failure.textContent || '';
      htmlCases += `<div class="failure-msg">${message}\n\n${content}</div>`;
    }
    htmlCases += `</div>`;
  });

  const totalTests = cases.length;
  const totalFailed = totalFailures + totalErrors;
  const totalPassed = totalTests - totalFailed - totalSkipped;

  return `
    <!DOCTYPE html><html><head><style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f4f5f7; color: #1F1F21; padding: 30px; margin: 0; }
      .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      h1 { font-size: 24px; margin-top: 0; border-bottom: 2px solid #ebecf0; padding-bottom: 15px; }
      .summary { display: flex; gap: 15px; margin-bottom: 30px; }
      .stat { padding: 20px; border-radius: 5px; flex: 1; text-align: center; border: 1px solid #dfe1e6; }
      .stat-value { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
      .stat-label { font-size: 12px; text-transform: uppercase; color: #5e6c84; font-weight: 600; }
      .stat.total { border-top: 4px solid #0052cc; }
      .stat.passed { border-top: 4px solid #36b37e; background: #e3fcef; }
      .stat.failed { border-top: 4px solid #ff5630; background: #ffebe6; }
      .stat.skipped { border-top: 4px solid #ffab00; background: #fffae6; }
      .testcase { padding: 15px; border-bottom: 1px solid #ebecf0; }
      .testcase:last-child { border-bottom: none; }
      .testcase.passed { border-left: 4px solid #36b37e; }
      .testcase.failed { border-left: 4px solid #ff5630; background: #fffcfc; }
      .testcase.skipped { border-left: 4px solid #ffab00; }
      .test-name { font-weight: 600; font-size: 15px; }
      .test-meta { font-size: 13px; color: #5e6c84; margin-top: 6px; }
      .failure-msg { background: #ffebe6; color: #bf2600; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 13px; margin-top: 15px; white-space: pre-wrap; overflow-x: auto; border: 1px solid #ffbdad; }
      
      @media (prefers-color-scheme: dark) {
        body { background: #091e42; color: #f4f5f7; }
        .container { background: #1F1F21; border: 1px solid #2f2f33; box-shadow: none; }
        h1 { border-bottom-color: #2f2f33; }
        .summary .stat { background: #091e42; border-color: #2f2f33; color: #b3bac5; }
        .stat.passed { background: #0b3d26; border-top-color: #36b37e; }
        .stat.failed { background: #421f1a; border-top-color: #ff5630; }
        .stat.skipped { background: #40320a; border-top-color: #ffab00; }
        .testcase { border-bottom-color: #2f2f33; }
        .testcase.failed { background: #2b1d1d; }
        .test-meta { color: #8993a4; }
        .failure-msg { background: #3b1912; color: #ffab00; border-color: #5c2c22; }
      }
    </style></head><body>
      <div class="container">
        <h1>JUnit Test Report</h1>
        <div class="summary">
          <div class="stat total"><div class="stat-value">${totalTests}</div><div class="stat-label">Total Tests</div></div>
          <div class="stat passed"><div class="stat-value">${totalPassed}</div><div class="stat-label">Passed</div></div>
          <div class="stat failed"><div class="stat-value">${totalFailed}</div><div class="stat-label">Failed</div></div>
          <div class="stat skipped"><div class="stat-value">${totalSkipped}</div><div class="stat-label">Skipped</div></div>
        </div>
        ${htmlCases}
      </div>
    </body></html>
  `;
}

function generateDashboardHtml(fileUrls, initialPath) {
  // 1. SECURE NONCE EXTRACTION:
  // Loop through all scripts and read the internal JS property,
  // bypassing Chrome's HTML attribute hiding.
  let pageNonce = '';
  const scripts = document.getElementsByTagName('script');
  for (let i = 0; i < scripts.length; i++) {
    if (scripts[i].nonce) {
      pageNonce = scripts[i].nonce;
      break;
    }
  }

  const nonceAttr = pageNonce ? `nonce="${pageNonce}"` : '';
  const filesJson = JSON.stringify(fileUrls);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Artifact Explorer</title>
      <style>
        body { margin: 0; display: flex; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; overflow: hidden; }
        #sidebar { width: 300px; background: #f4f5f7; border-right: 1px solid #dfe1e6; display: flex; flex-direction: column; }
        .sidebar-header { padding: 15px; background: #ebecf0; font-weight: bold; color: #1F1F21; border-bottom: 1px solid #dfe1e6; }
        #file-tree { flex: 1; overflow-y: auto; padding: 10px; font-size: 13px; color: #42526e; }
        #main { flex: 1; display: flex; flex-direction: column; background: #fff; }
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

        /* Dark Mode Support */
        @media (prefers-color-scheme: dark) {
          body { background: #1F1F21; color: ,
          #f4f5f7; }
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

      <script ${nonceAttr}>
        const files = ${filesJson};
        const initialPath = "${initialPath}";
        
        const tree = {};
        Object.keys(files).sort().forEach(path => {
          const parts = path.split('/');
          let current = tree;
          for (let i = 0; i < parts.length; i++) {
            if (i === parts.length - 1) current[parts[i]] = path;
            else current = current[parts[i]] = current[parts[i]] || {};
          }
        });

        // 1. NEW: Recursively flatten single-child folders
        function flattenTree(node) {
          for (const key in node) {
            if (typeof node[key] === 'object') {
              flattenTree(node[key]); // Dive deep first
              
              const keys = Object.keys(node[key]);
              // If this folder has exactly one child, and that child is another folder:
              if (keys.length === 1 && typeof node[key][keys[0]] === 'object') {
                const childFolder = keys[0];
                const newName = key + '/' + childFolder;
                node[newName] = node[key][childFolder];
                delete node[key];
              }
            }
          }
        }
        flattenTree(tree);

        // 2. RECURSIVE RENDER (Modified for "expanded" logic)
        // RECURSIVE RENDER WITH FOLDER-FIRST SORTING
        function renderTree(node, container) {
          const ul = document.createElement('ul');
          
          // 1. NEW: Custom sorting logic
          const sortedEntries = Object.entries(node).sort((a, b) => {
            const aIsFolder = typeof a[1] === 'object';
            const bIsFolder = typeof b[1] === 'object';
            
            // If one is folder and other is file, folder comes first
            if (aIsFolder && !bIsFolder) return -1;
            if (!aIsFolder && bIsFolder) return 1;
            
            // Otherwise, sort alphabetically
            return a[0].localeCompare(b[0]);
          });

          // 2. Iterate over the sorted entries
          for (const [name, value] of sortedEntries) {
            const li = document.createElement('li');
            if (typeof value === 'string') {
              const isHtml = name.endsWith('.html');
              const icon = isHtml ? '🌐' : name.endsWith('.xml') ? '📊' : '📄';
              li.innerHTML = \`<span class="file" data-path="\${value}">\${icon} \${name}</span>\`;
            } else {
              li.innerHTML = \`
                <span class="folder">
                  <span class="icon-toggle">►</span>
                  <span class="icon-folder">📁</span>
                  \${name}
                </span>
              \`;
              
              const subContainer = document.createElement('div');
              subContainer.style.display = 'none'; 
              
              renderTree(value, subContainer);
              li.appendChild(subContainer);
            }
            ul.appendChild(li);
          }
          container.appendChild(ul);
        }
        
        renderTree(tree, document.getElementById('file-tree'));

        // INTERACTION HANDLING
        const iframe = document.getElementById('preview-frame');
        const currentFileLabel = document.getElementById('current-file');
        let activeEl = null;

        document.getElementById('file-tree').addEventListener('click', (e) => {
          // Toggle Folder
          if (e.target.closest('.folder')) {
            const folderEl = e.target.closest('.folder');
            const sub = folderEl.nextElementSibling;
            const isCollapsed = sub.style.display === 'none';
            
            sub.style.display = isCollapsed ? 'block' : 'none';
            folderEl.querySelector('.icon-toggle').textContent = isCollapsed ? '▼' : '►';
            folderEl.querySelector('.icon-folder').textContent = isCollapsed ? '📂' : '📁';
          }
          
          // Select File
          if (e.target.classList.contains('file')) {
            const path = e.target.dataset.path;
            if (activeEl) activeEl.classList.remove('active');
            e.target.classList.add('active');
            activeEl = e.target;
            
            iframe.src = files[path];
            currentFileLabel.innerText = path;
          }
        });

        // AUTO-LOAD
        const allPaths = Object.keys(files);
        
        // Find all index.html files
        const indexFiles = allPaths.filter(p => p.endsWith('index.html'));
        
        // Sort index files by number of slashes (shallower = better)
        indexFiles.sort((a, b) => {
          const depthA = a.split('/').length;
          const depthB = b.split('/').length;
          return depthA - depthB;
        });

        // Use the shallowest index.html, or fall back to the shallowest file overall
        const allPathsSorted = [...allPaths].sort((a, b) => a.split('/').length - b.split('/').length);
        const bestEntry = indexFiles[0] || allPathsSorted[0];

        const targetPath = (initialPath && files[initialPath]) ? initialPath : bestEntry;

        if (targetPath) {
          const targetEl = document.querySelector(\`.file[data-path="\${targetPath}"]\`);
          if (targetEl) {
            targetEl.classList.add('active');
            activeEl = targetEl;
            iframe.src = files[targetPath];
            currentFileLabel.innerText = targetPath;
            
            // Expand parent folders to reveal the automatically opened file
            let parent = targetEl.parentElement;
            while (parent && parent.id !== 'file-tree') {
              if (parent.style.display === 'none') {
                parent.style.display = 'block';
                // Flip the folder icons to "open" state
                const folderSpan = parent.previousElementSibling;
                if (folderSpan && folderSpan.classList.contains('folder')) {
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
}

function resolveRelativePath(basePath, relativeUrl) {
  const stack = basePath ? basePath.split('/') : [];
  const parts = relativeUrl.split('/');
  for (const part of parts) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

function buildVirtualFileSystem(extractedFiles) {
  const fileUrls = {};
  const htmlFiles = {}; // Store raw HTML content to rewrite
  const assetContent = {}; // Store raw CSS/JS content to inline

  // PASS 1: Generate blobs and collect raw content for inlining
  for (const [path, data] of Object.entries(extractedFiles)) {
    let mimeType = getMimeType(path);
    const decoder = new TextDecoder('utf-8');

    if (mimeType.includes('text/css') || mimeType.includes('javascript')) {
      assetContent[path] = decoder.decode(data);
    }

    // Store HTML raw text for rewriting
    if (mimeType.includes('text/html')) {
      htmlFiles[path] = decoder.decode(data);
    }

    const blob = new Blob([data], { type: mimeType });
    fileUrls[path] = URL.createObjectURL(blob);
  }

  // PASS 2: Inline CSS/JS into HTML files to bypass CSP
  for (const [path, htmlText] of Object.entries(htmlFiles)) {
    const basePath = path.split('/').slice(0, -1).join('/');

    let pageNonce = '';
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      if (scripts[i].nonce) {
        pageNonce = scripts[i].nonce;
        break;
      }
    }
    const nonceAttr = pageNonce ? `nonce="${pageNonce}"` : '';

    let rewrittenHtml = htmlText
      // 1. Inline CSS: Find <link rel="stylesheet" href="...">
      .replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (match, url) => {
        const absolutePath = resolveRelativePath(basePath, url);
        if (assetContent[absolutePath]) {
          return `<style>${assetContent[absolutePath]}</style>`;
        }
        return match;
      })
      // 2. Inline JS: Find <script src="..."></script>
      .replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (match, url) => {
        const absolutePath = resolveRelativePath(basePath, url);
        if (assetContent[absolutePath]) {
          // Inject the nonce here so the browser trusts our inlined code!
          return `<script ${nonceAttr}>${assetContent[absolutePath]}</script>`;
        }
        return match;
      });

    // Replace the blob with our new inlined HTML
    URL.revokeObjectURL(fileUrls[path]);
    const newBlob = new Blob([rewrittenHtml], { type: 'text/html;charset=utf-8' });
    fileUrls[path] = URL.createObjectURL(newBlob);
  }

  return fileUrls;
}

// 3. THE EXTENSION CORE LOGIC

async function handlePreviewClick(previewBtn, nativeDownloadBtn, artifactPath) {
  const originalText = previewBtn.innerText;
  previewBtn.innerText = '⏳ Intercepting...';
  previewBtn.disabled = true;

  const messageListener = async (message) => {
    if (message.action === 'preview_url_captured') {
      chrome.runtime.onMessage.removeListener(messageListener);

      try {
        previewBtn.innerText = '⏳ Unzipping...';

        const response = await fetch(message.url);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'));
        const tarBlob = await new Response(decompressedStream).blob();
        const tarBuffer = await tarBlob.arrayBuffer();

        const extractedFiles = extractTar(tarBuffer);
        const fileUrls = buildVirtualFileSystem(extractedFiles);
        const fileKeys = Object.keys(fileUrls);

        // QoL Fix: If the archive only has 1 file, skip the dashboard and open it directly
        if (fileKeys.length === 1) {
          window.open(fileUrls[fileKeys[0]], '_blank');
          return;
        }

        let matchedFileName = '';
        for (const archivePath of fileKeys) {
          if (archivePath.includes(artifactPath)) {
            matchedFileName = archivePath;
            break;
          }
        }

        const dashboardHtml = generateDashboardHtml(fileUrls, matchedFileName);
        const dashboardBlob = new Blob([dashboardHtml], { type: 'text/html;charset=utf-8' });

        window.open(URL.createObjectURL(dashboardBlob), '_blank');

      } catch (error) {
        console.error('Artifact Preview Extension Error:', error);
        alert('Failed to extract and preview artifact. See console.');
      } finally {
        previewBtn.innerText = originalText;
        previewBtn.disabled = false;
      }
    }
  };

  chrome.runtime.onMessage.addListener(messageListener);

  chrome.runtime.sendMessage({ action: 'intercept_download' }, (response) => {
    if (response && response.status === 'ready') {
      nativeDownloadBtn.click();
    }
  });

  setTimeout(() => {
    chrome.runtime.onMessage.removeListener(messageListener);
    if (previewBtn.disabled) {
      previewBtn.innerText = originalText;
      previewBtn.disabled = false;
    }
  }, 10000);
}

// 4. UI INJECTOR

function injectPreviewButtons(btn) {
  // Determine if Bitbucket is currently in dark mode
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  const bgColor = isDark ? 'transparent' : '#ebecf0';
  const textColor = isDark ? '#A9ABAF' : '#1F1F21';
  const hoverColor = isDark ? '#CECED912' : '#dfe1e6';

  btn.classList.add('bb-preview-added');

  const header = btn.closest('header');
  if (!header) return;

  const pathNode = header.querySelector('span[title]');
  if (!pathNode) return;

  // Get the exact filename the user is clicking on
  const artifactPath = pathNode.getAttribute('title').split('/').pop();

  const previewBtn = document.createElement('button');
  previewBtn.innerText = '👁️ Preview';
  previewBtn.style.cssText = `
      margin-right: 8px;
      padding: 0 12px;
      font-size: 14px;
      cursor: pointer;
      background-color: ${bgColor};
      color: ${textColor};
      border: none;
      border-radius: 3px;
      font-weight: 500;
      height: 32px;
    `;

  previewBtn.onmouseover = () => previewBtn.style.backgroundColor = hoverColor;
  previewBtn.onmouseout = () => previewBtn.style.backgroundColor = bgColor;

  previewBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void handlePreviewClick(previewBtn, btn, artifactPath);
  });

  const buttonWrapper = btn.closest('div[role="presentation"]');
  if (buttonWrapper) {
    buttonWrapper.parentNode.insertBefore(previewBtn, buttonWrapper);
  }
}

const observer = new MutationObserver(mutations => {
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      if (node.nodeType === 1) {
        const downloadButtons = document.querySelectorAll('button[data-testid="artifact-download-button"]:not(.bb-preview-added)');
        downloadButtons.forEach(injectPreviewButtons);
      }
    }
  }
});

observer.observe(document.body, { childList: true, subtree: true });
