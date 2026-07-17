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

  while (offset < arrayBuffer.byteLength - 512) {
    if (view[offset] === 0 && view[offset + 1] === 0) break;

    let name = '';
    for (let i = 0; i < 100; i++) {
      if (view[offset + i] === 0) break;
      name += String.fromCharCode(view[offset + i]);
    }

    let sizeStr = '';
    for (let i = 124; i < 136; i++) {
      if (view[offset + i] === 0 || view[offset + i] === 32) break;
      sizeStr += String.fromCharCode(view[offset + i]);
    }
    const size = parseInt(sizeStr.trim(), 8);
    const typeflag = String.fromCharCode(view[offset + 156]);

    offset += 512;

    if (size > 0 && (typeflag === '0' || typeflag === '\0')) {
      // Clean up paths (remove leading './' if present)
      const cleanName = name.startsWith('./') ? name.substring(2) : name;
      files[cleanName] = arrayBuffer.slice(offset, offset + size);
    }

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
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f4f5f7; color: #172b4d; padding: 30px; margin: 0; }
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
        .container { background: #172b4d; border: 1px solid #253858; box-shadow: none; }
        h1 { border-bottom-color: #253858; }
        .summary .stat { background: #091e42; border-color: #253858; color: #b3bac5; }
        .stat.passed { background: #0b3d26; border-top-color: #36b37e; }
        .stat.failed { background: #421f1a; border-top-color: #ff5630; }
        .stat.skipped { background: #40320a; border-top-color: #ffab00; }
        .testcase { border-bottom-color: #253858; }
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
  // We embed the file dictionary directly into the Dashboard's javascript
  const filesJson = JSON.stringify(fileUrls);

  const styles = `
    <style>
      body { margin: 0; display: flex; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fff; overflow: hidden; }
      #sidebar { width: 300px; background: #f4f5f7; border-right: 1px solid #dfe1e6; display: flex; flex-direction: column; }
      .sidebar-header { padding: 15px; background: #ebecf0; font-weight: bold; color: #172b4d; border-bottom: 1px solid #dfe1e6; }
      #file-tree { flex: 1; overflow-y: auto; padding: 10px; font-size: 13px; color: #42526e; }
      #main { flex: 1; display: flex; flex-direction: column; background: #fff; }
      .topbar { padding: 10px 15px; background: #fff; border-bottom: 1px solid #dfe1e6; color: #5e6c84; font-size: 14px; display: flex; align-items: center; }
      #current-file { font-family: monospace; background: #ebecf0; padding: 2px 6px; border-radius: 3px; margin-left: 10px; }
      iframe { flex: 1; width: 100%; height: 100%; border: none; }
        
      ul { list-style: none; padding-left: 15px; margin: 0; }
      #file-tree > ul { padding-left: 0; }
      li { margin: 2px 0; }
      .folder { font-weight: 600; padding: 4px; display: block; color: #172b4d; }
      .file { padding: 4px 4px 4px 20px; cursor: pointer; display: block; border-radius: 3px; }
      .file:hover { background: #dfe1e6; }
      .file.active { background: #0052cc; color: white; }
      
      @media (prefers-color-scheme: dark) {
        body { background: #172b4d; color: #f4f5f7; }
        #sidebar { background: #091e42; border-right: 1px solid #253858; }
        .sidebar-header { background: #172b4d; color: #f4f5f7; border-bottom: 1px solid #253858; }
        #main { background: #091e42; }
        .topbar { background: #172b4d; border-bottom: 1px solid #253858; color: #b3bac5; }
        #current-file { background: #253858; color: #fff; }
        .file { color: #b3bac5; }
        .file:hover { background: #253858; }
        .file.active { background: #0052cc; color: #fff; }
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

      <script>
        const files = ${filesJson};
        const initialPath = "${initialPath}";
        
        // 1. Build a nested tree object from flat paths
        const tree = {};
        Object.keys(files).sort().forEach(path => {
          const parts = path.split('/');
          let current = tree;
          for (let i = 0; i < parts.length; i++) {
            if (i === parts.length - 1) current[parts[i]] = path;
            else current = current[parts[i]] = current[parts[i]] || {};
          }
        });

        // 2. Render the tree recursively
        function renderTree(node, container) {
          const ul = document.createElement('ul');
          for (const [name, value] of Object.entries(node)) {
            const li = document.createElement('li');
            if (typeof value === 'string') {
              // It's a file
              const isHtml = name.endsWith('.html');
              const icon = isHtml ? '🌐' : name.endsWith('.xml') ? '📊' : '📄';
              li.innerHTML = \`<span class="file" data-path="\${value}">\${icon} \${name}</span>\`;
            } else {
              // It's a folder
              li.innerHTML = \`<span class="folder">📁 \${name}</span>\`;
              renderTree(value, li);
            }
            ul.appendChild(li);
          }
          container.appendChild(ul);
        }
        
        renderTree(tree, document.getElementById('file-tree'));

        // 3. Handle Clicks
        const iframe = document.getElementById('preview-frame');
        const currentFileLabel = document.getElementById('current-file');
        let activeEl = null;

        function loadFile(path, element) {
          if (!files[path]) return;
          
          if (activeEl) activeEl.classList.remove('active');
          if (element) {
            element.classList.add('active');
            activeEl = element;
          }
          
          iframe.src = files[path];
          currentFileLabel.innerText = path;
        }

        document.getElementById('file-tree').addEventListener('click', (e) => {
          if (e.target.classList.contains('file')) {
            loadFile(e.target.dataset.path, e.target);
          }
        });

        // 4. Auto-load the clicked file
        if (initialPath && files[initialPath]) {
          const initialEl = document.querySelector(\`.file[data-path="\${initialPath}"]\`);
          loadFile(initialPath, initialEl);
        } else {
          // Fallback: load the first index.html or first file found
          const firstHtml = Object.keys(files).find(p => p.endsWith('index.html')) || Object.keys(files)[0];
          const fallbackEl = document.querySelector(\`.file[data-path="\${firstHtml}"]\`);
          loadFile(firstHtml, fallbackEl);
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
  const htmlFiles = {};

  for (const [path, data] of Object.entries(extractedFiles)) {
    let mimeType = getMimeType(path);
    let blobData = [data];

    if (mimeType.includes('text/xml')) {
      const text = new TextDecoder('utf-8').decode(data);

      // Sniff for test report markers
      if (text.includes('<testsuite') || text.includes('<testcase')) {
        const htmlReport = generateJUnitHtml(text);

        // If the parser successfully built a report, override the blob
        if (htmlReport !== null) {
          blobData = [htmlReport];
          mimeType = 'text/html;charset=utf-8';
        }
        // If htmlReport is null, it naturally falls back to the raw XML data
      }
    }

    if (mimeType.includes('text/html')) {
      htmlFiles[path] = typeof blobData[0] === 'string' ? blobData[0] : new TextDecoder('utf-8').decode(data);
    }

    const blob = new Blob(blobData, { type: mimeType });
    fileUrls[path] = URL.createObjectURL(blob);
  }

  for (const [path, htmlText] of Object.entries(htmlFiles)) {
    const basePath = path.split('/').slice(0, -1).join('/');
    const rewrittenHtml = htmlText.replace(/(src|href)=["']([^"']+)["']/gi, (match, attr, url) => {
      if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('#')) return match;
      const absolutePath = resolveRelativePath(basePath, url);
      if (fileUrls[absolutePath]) return `${attr}="${fileUrls[absolutePath]}"`;
      return match;
    });

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
  const textColor = isDark ? '#A9ABAF' : '#172b4d';
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
