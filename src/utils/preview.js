import { openDashboard } from '../templates/dashboard.js';
import { openJunitReport } from '../templates/junit.js';
import { extractTar, buildVirtualFileSystem, getPageNonce } from './fileSystem.js';

/**
 * Captures the preview URL sent from the background script.
 * @returns {Promise<unknown>}
 */
function capturePreviewUrl() {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error('Timeout waiting for preview URL.'));
    }, 10000);

    const listener = (message) => {
      if (message.action === 'preview_url_captured') {
        clearTimeout(timeoutId);
        chrome.runtime.onMessage.removeListener(listener);
        resolve(message.url);
      }
    };
    chrome.runtime.onMessage.addListener(listener);
  });
}

/**
 * Called when the preview button is clicked.
 * Intercepts the download, decompresses the artifact, and opens the appropriate preview.
 * @param previewBtn
 * @param nativeDownloadBtn
 */
async function handlePreviewClick(previewBtn, nativeDownloadBtn) {
  const originalText = previewBtn.innerText;
  previewBtn.innerText = '⏳ Intercepting...';
  previewBtn.disabled = true;

  try {
    const urlPromise = capturePreviewUrl();
    chrome.runtime.sendMessage({ action: 'intercept_download' }, (res) => {
      if (res?.status === 'ready') nativeDownloadBtn.click();
    });

    const url = await urlPromise;
    previewBtn.innerText = '⏳ Unzipping...';

    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const decompressedStream = response.body.pipeThrough(new DecompressionStream('gzip'));
    const tarBuffer = await (await new Response(decompressedStream).blob()).arrayBuffer();

    // fileUrls is an object like: { "test-report.xml": "blob:http://...", ... }
    const fileUrls = buildVirtualFileSystem(extractTar(tarBuffer), getPageNonce() ? `nonce="${getPageNonce()}"` : '');
    const fileKeys = Object.keys(fileUrls);

    if (fileKeys.length === 1) {
      const fileName = fileKeys[0];
      const fileUrl = fileUrls[fileName];

      // ROUTE A: It's a single XML file (Likely JUnit)
      if (fileName.toLowerCase().endsWith('.xml')) {
        previewBtn.innerText = '⏳ Parsing XML...';

        // Fetch the raw XML string directly out of our in-memory Blob
        const blobResponse = await fetch(fileUrl);
        const rawXml = await blobResponse.text();

        // Pass to our custom JUnit UI
        openJunitReport(rawXml, fileName);
        return;
      }

      // ROUTE B: It's a single file, but not an XML file (e.g., a single .txt log)
      return window.open(fileUrl, '_blank');
    }

    // ROUTE C: It's multiple files (e.g., Istanbul Coverage HTML reports)
    openDashboard(fileUrls);

  } catch (error) {
    console.error('Artifact Preview Extension Error:', error);
    alert('Failed to extract and preview artifact. Check the console for details.');
  } finally {
    previewBtn.innerText = originalText;
    previewBtn.disabled = false;
  }
}

/**
 * Creates a styled "Preview" button with hover effects.
 * @returns {HTMLButtonElement}
 */
function createPreviewButton() {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const bgColor = isDark ? 'transparent' : '#ebecf0';
  const hoverColor = isDark ? '#CECED912' : '#dfe1e6';

  const btn = document.createElement('button');
  btn.innerText = '👁️ Preview';
  btn.style.cssText = `
    margin-right: 8px;
    padding: 0 12px;
    font-size: 14px;
    cursor: pointer;
    background-color: ${bgColor};
    color: ${isDark ? '#A9ABAF' : '#1F1F21'};
    border: none;
    border-radius: 3px;
    font-weight: 500;
    height: 32px;
  `;

  btn.addEventListener('mouseenter', () => btn.style.backgroundColor = hoverColor);
  btn.addEventListener('mouseleave', () => btn.style.backgroundColor = bgColor);

  return btn;
}

/**
 * Injects a "Preview" button next to the native download button for artifacts.
 * @param {HTMLButtonElement} downloadBtn - The native download button element.
 */
export function injectPreviewButtons(downloadBtn) {
  downloadBtn.classList.add('bb-preview-added');

  const artifactPath = downloadBtn.closest('header')
    ?.querySelector('span[title]')
    ?.getAttribute('title')
    ?.split('/')
    .pop();
  if (!artifactPath) return;

  const previewBtn = createPreviewButton();
  previewBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void handlePreviewClick(previewBtn, downloadBtn, artifactPath);
  });

  downloadBtn.closest('div[role="presentation"]')
    ?.insertAdjacentElement('beforebegin', previewBtn);
}
