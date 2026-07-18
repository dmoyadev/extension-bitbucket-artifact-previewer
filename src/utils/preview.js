import { openDashboard } from '../templates/dashboard.js';
import { extractTar, buildVirtualFileSystem, getPageNonce } from './fileSystem.js';

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

async function handlePreviewClick(previewBtn, nativeDownloadBtn, artifactPath) {
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

    const fileUrls = buildVirtualFileSystem(extractTar(tarBuffer), getPageNonce() ? `nonce="${getPageNonce()}"` : '');
    const fileKeys = Object.keys(fileUrls);

    if (fileKeys.length === 1) {
      return window.open(fileUrls[fileKeys[0]], '_blank');
    }

    openDashboard(fileUrls)

  } catch (error) {
    console.error('Artifact Preview Extension Error:', error);
    alert('Failed to extract and preview artifact. Check the console for details.');
  } finally {
    previewBtn.innerText = originalText;
    previewBtn.disabled = false;
  }
}

export function injectPreviewButtons(btn) {
  btn.classList.add('bb-preview-added');

  const artifactPath = btn.closest('header')?.querySelector('span[title]')?.getAttribute('title')?.split('/').pop();
  if (!artifactPath) return;

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const bgColor = isDark ? 'transparent' : '#ebecf0';
  const hoverColor = isDark ? '#CECED912' : '#dfe1e6';

  const previewBtn = document.createElement('button');
  previewBtn.innerText = '👁️ Preview';
  previewBtn.style.cssText = `
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

  previewBtn.addEventListener('mouseenter', () => previewBtn.style.backgroundColor = hoverColor);
  previewBtn.addEventListener('mouseleave', () => previewBtn.style.backgroundColor = bgColor);

  previewBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    void handlePreviewClick(previewBtn, btn, artifactPath);
  });

  btn.closest('div[role="presentation"]')?.insertAdjacentElement('beforebegin', previewBtn);
}
