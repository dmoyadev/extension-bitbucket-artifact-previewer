import { injectPreviewButtons } from './utils/preview.js';

const ARTIFACT_DOWNLOAD_BTN_SELECTOR = 'button[data-testid="artifact-download-button"]:not(.bb-preview-added)';
const observer = new MutationObserver(() => {
  document.querySelectorAll(ARTIFACT_DOWNLOAD_BTN_SELECTOR).forEach(injectPreviewButtons);
});

observer.observe(document.body, { childList: true, subtree: true });
