(async () => {
  try {
    const src = chrome.runtime.getURL('src/main.js');
    await import(src);
  } catch (error) {
    console.error('Failed to load Bitbucket Artifact Previewer modules:', error);
  }
})();
