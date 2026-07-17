let interceptNext = false;
let requestingTabId = null;

// Listen for the content script telling us to get ready
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'intercept_download') {
    interceptNext = true;
    requestingTabId = sender.tab.id;
    sendResponse({ status: 'ready' });
  }
});

// Watch the browser's download manager
chrome.downloads.onCreated.addListener((downloadItem) => {
  if (interceptNext) {
    interceptNext = false; // Reset immediately so normal downloads aren't blocked

    // Cancel the download before it hits the hard drive
    chrome.downloads.cancel(downloadItem.id, () => {
      // Send the captured URL back to the Bitbucket tab
      if (requestingTabId) {
        chrome.tabs.sendMessage(requestingTabId, {
          action: 'preview_url_captured',
          url: downloadItem.url
        });
      }
    });
  }
});
