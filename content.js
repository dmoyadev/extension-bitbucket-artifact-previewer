// 1. MIME Type Mapper
function getMimeType(filename) {
  const lowerName = filename.toLowerCase();
  if (lowerName.includes('.html')) return 'text/html;charset=utf-8';
  if (lowerName.includes('.json')) return 'application/json;charset=utf-8';
  if (lowerName.includes('.xml')) return 'text/xml;charset=utf-8';
  if (lowerName.includes('.pdf')) return 'application/pdf';
  if (lowerName.match(/\.(jpeg|jpg|gif|png|svg)$/)) return 'image/*';
  return 'text/plain;charset=utf-8';
}

// 2. Metadata-Aware In-Memory TAR Extractor
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
      files[name] = arrayBuffer.slice(offset, offset + size);
    }

    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

// 3. The JUnit to HTML Transformer
function generateJUnitHtml(xmlString) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, "text/xml");

  let totalTests = 0, totalFailures = 0, totalErrors = 0, totalSkipped = 0, totalTime = 0;

  const suites = xmlDoc.querySelectorAll('testsuite');
  suites.forEach(suite => {
    totalTests += parseInt(suite.getAttribute('tests') || 0);
    totalFailures += parseInt(suite.getAttribute('failures') || 0);
    totalErrors += parseInt(suite.getAttribute('errors') || 0);
    totalSkipped += parseInt(suite.getAttribute('skipped') || 0);
    totalTime += parseFloat(suite.getAttribute('time') || 0);
  });

  const totalFailed = totalFailures + totalErrors;
  const totalPassed = totalTests - totalFailed - totalSkipped;

  // Atlassian Design System colors
  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>JUnit Report Preview</title>
      <style>
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
        .testsuite { margin-bottom: 30px; border: 1px solid #dfe1e6; border-radius: 5px; overflow: hidden; }
        .testsuite-header { background: #f4f5f7; padding: 15px; font-weight: bold; border-bottom: 1px solid #dfe1e6; display: flex; justify-content: space-between; }
        .testcase { padding: 15px; border-bottom: 1px solid #ebecf0; }
        .testcase:last-child { border-bottom: none; }
        .testcase.passed { border-left: 4px solid #36b37e; }
        .testcase.failed { border-left: 4px solid #ff5630; background: #fffcfc; }
        .testcase.skipped { border-left: 4px solid #ffab00; }
        .test-name { font-weight: 600; font-size: 15px; }
        .test-meta { font-size: 13px; color: #5e6c84; margin-top: 6px; }
        .failure-msg { background: #ffebe6; color: #bf2600; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 13px; margin-top: 15px; white-space: pre-wrap; overflow-x: auto; border: 1px solid #ffbdad; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>JUnit Test Report</h1>
        <div class="summary">
          <div class="stat total"><div class="stat-value">${totalTests}</div><div class="stat-label">Total Tests</div></div>
          <div class="stat passed"><div class="stat-value">${totalPassed}</div><div class="stat-label">Passed</div></div>
          <div class="stat failed"><div class="stat-value">${totalFailed}</div><div class="stat-label">Failed</div></div>
          <div class="stat skipped"><div class="stat-value">${totalSkipped}</div><div class="stat-label">Skipped</div></div>
          <div class="stat total"><div class="stat-value">${totalTime.toFixed(2)}s</div><div class="stat-label">Duration</div></div>
        </div>
  `;

  suites.forEach(suite => {
    const suiteName = suite.getAttribute('name') || 'Unnamed Suite';
    const suiteTests = suite.getAttribute('tests') || 0;
    const suiteTime = suite.getAttribute('time') || 0;

    html += `
      <div class="testsuite">
        <div class="testsuite-header">
          <span>📦 ${suiteName}</span>
          <span>${suiteTests} tests (${suiteTime}s)</span>
        </div>
    `;

    const cases = suite.querySelectorAll('testcase');
    cases.forEach(testcase => {
      const name = testcase.getAttribute('name');
      const classname = testcase.getAttribute('classname') || '';
      const time = testcase.getAttribute('time') || 0;

      const failure = testcase.querySelector('failure') || testcase.querySelector('error');
      const skipped = testcase.querySelector('skipped');

      let status = 'passed';
      if (failure) status = 'failed';
      if (skipped) status = 'skipped';

      html += `
        <div class="testcase ${status}">
          <div class="test-name">${status === 'failed' ? '❌' : status === 'skipped' ? '⚠️' : '✅'} ${name}</div>
          <div class="test-meta">${classname} • ${time}s</div>
      `;

      if (failure) {
        const message = failure.getAttribute('message') || '';
        const content = failure.textContent || '';
        html += `<div class="failure-msg">${message}\n\n${content}</div>`;
      }

      html += `</div>`;
    });

    html += `</div>`;
  });

  html += `</div></body></html>`;
  return html;
}

// 4. The Intercept & Render Logic
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

        let fileData = null;
        let matchedFileName = '';

        for (const [archivePath, data] of Object.entries(extractedFiles)) {
          if (archivePath.includes(artifactPath)) {
            fileData = data;
            matchedFileName = archivePath;
            break;
          }
        }

        if (!fileData) {
          throw new Error(`Could not find the file ${artifactPath} inside the archive.`);
        }

        let mimeType = getMimeType(matchedFileName);
        let blobData = [fileData];

        // NEW LOGIC: Sniff XML files for JUnit markers and convert to HTML
        if (mimeType.includes('text/xml')) {
          const text = new TextDecoder('utf-8').decode(fileData);
          if (text.includes('<testsuite') || text.includes('<testsuites')) {
            const htmlReport = generateJUnitHtml(text);
            blobData = [htmlReport];
            mimeType = 'text/html;charset=utf-8';
          }
        }

        const viewableBlob = new Blob(blobData, { type: mimeType });
        const objectUrl = URL.createObjectURL(viewableBlob);

        window.open(objectUrl, '_blank');

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

// 5. The UI Injector
function injectPreviewButtons() {
  const downloadButtons = document.querySelectorAll('button[data-testid="artifact-download-button"]:not(.bb-preview-added)');

  downloadButtons.forEach(nativeBtn => {
    nativeBtn.classList.add('bb-preview-added');

    const header = nativeBtn.closest('header');
    if (!header) return;

    const pathNode = header.querySelector('span[title]');
    if (!pathNode) return;

    const artifactPath = pathNode.getAttribute('title').split('/').pop();

    const previewBtn = document.createElement('button');
    previewBtn.innerText = '👁️ Preview';
    previewBtn.style.cssText = `
      margin-right: 8px;
      padding: 0 12px;
      font-size: 14px;
      cursor: pointer;
      background-color: #ebecf0;
      color: #172b4d;
      border: none;
      border-radius: 3px;
      font-weight: 500;
      height: 32px;
    `;

    previewBtn.onmouseover = () => previewBtn.style.backgroundColor = '#dfe1e6';
    previewBtn.onmouseout = () => previewBtn.style.backgroundColor = '#ebecf0';

    previewBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlePreviewClick(previewBtn, nativeBtn, artifactPath);
    });

    const buttonWrapper = nativeBtn.closest('div[role="presentation"]');
    if (buttonWrapper) {
      buttonWrapper.parentNode.insertBefore(previewBtn, buttonWrapper);
    }
  });
}

const observer = new MutationObserver(() => injectPreviewButtons());
observer.observe(document.body, { childList: true, subtree: true });
injectPreviewButtons();
