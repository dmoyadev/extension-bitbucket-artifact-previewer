import { injectPreviewButtons } from './utils/preview.js';

const observer = new MutationObserver(() => {
  document.querySelectorAll('button[data-testid="artifact-download-button"]:not(.bb-preview-added)')
    .forEach(injectPreviewButtons);
});

observer.observe(document.body, { childList: true, subtree: true });
