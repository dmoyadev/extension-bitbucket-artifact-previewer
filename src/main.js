import { injectPreviewButtons } from "./utils/preview.js";
import { makeFilePathsClickable } from "./utils/content.js";

const ARTIFACT_DOWNLOAD_BTN_SELECTOR = "button[data-testid=\"artifact-download-button\"]:not(.bb-preview-added)";
const FILE_PATH_SELECTOR = "h2[data-qa=\"bk-filepath\"]:not([data-pr-link-injected=\"true\"])";
const artifactObserver = new MutationObserver(() => {
  document.querySelectorAll(ARTIFACT_DOWNLOAD_BTN_SELECTOR).forEach(injectPreviewButtons);
  document.querySelectorAll(FILE_PATH_SELECTOR).forEach(makeFilePathsClickable)
});

artifactObserver.observe(document.body, { childList: true, subtree: true });
