document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('settings-form');
  const tokenInput = document.getElementById('app-token');
  const statusText = document.getElementById('status');

  // 1. Load saved settings when the popup opens
  chrome.storage.sync.get(['bitbucketAppToken'], (result) => {
    if (result.bitbucketAppToken) {
      tokenInput.value = result.bitbucketAppToken;
    }
  });

  // 2. Handle form submission to save settings
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const tokenValue = tokenInput.value.trim();

    // Save to Chrome sync storage
    chrome.storage.sync.set({ bitbucketAppToken: tokenValue }, () => {
      showStatusMessage('Settings saved successfully!');
    });
  });

  // 3. Helper function to show a fading status message
  function showStatusMessage(message) {
    statusText.textContent = message;
    statusText.style.opacity = '1';

    // Fade out after 2.5 seconds
    setTimeout(() => {
      statusText.style.opacity = '0';
    }, 2500);
  }
});
