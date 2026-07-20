document.addEventListener("DOMContentLoaded", async () => {
  // 1. Get the dataKey from the URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const dataKey = urlParams.get('dataKey');

  if (!dataKey) {
    document.body.innerHTML = '<h2>Error: No data key provided.</h2>';
    return;
  }

  // 2. Fetch the structured data from Chrome Storage
  const result = await chrome.storage.local.get(dataKey);
  const data = result[dataKey];

  if (!data) {
    document.body.innerHTML = '<h2>Error: Report data expired or not found.</h2>';
    return;
  }

  // 3. Clean up the storage so it doesn't bloat memory
  chrome.storage.local.remove(dataKey);

  // 4. Populate the DOM
  document.title = `JUnit Report: ${data.filename}`;
  document.getElementById('report-title').textContent = `JUnit Test Report: ${data.filename}`;

  document.getElementById('stat-total').textContent = data.totalTests;
  document.getElementById('stat-passed').textContent = data.totalPassed;
  document.getElementById('stat-failed').textContent = data.totalFailures;
  document.getElementById('stat-skipped').textContent = data.totalSkipped;

  const container = document.getElementById('test-cases');

  const htmlCases = data.cases.map(tc => {
    let failureHTML = '';

    if (tc.status === 'failed' && tc.failureMsg) {
      const escapedMsg = tc.failureMsg
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      failureHTML = `<div class="failure-msg">${escapedMsg}</div>`;
    }

    return `
      <div class="testcase ${tc.status}">
        <strong>${tc.name}</strong>
        <div class="test-meta">
          ${tc.classname ? `<span>Class: ${tc.classname}</span> | ` : ''}
          <span>Time: ${tc.time}s</span>
        </div>
        ${failureHTML}
      </div>
    `;
  }).join('');

  container.innerHTML = htmlCases;
});
