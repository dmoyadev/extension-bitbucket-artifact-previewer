/**
 * Opens a new window and renders a JUnit report from the provided raw XML content.
 * @param {string} rawJunitContent - The raw XML content of the JUnit report.
 * @param {string} filename - The name of the JUnit report file (used for the window title).
 * @returns {null} When there was an error parsing the XML or no test cases were found.
 */
export async function openJunitReport(rawJunitContent, filename) {
  // 1. Parse the XML
  const xmlDoc = new DOMParser().parseFromString(rawJunitContent, 'text/xml');
  if (xmlDoc.querySelector('parsererror')) {
    alert('Error: Invalid XML file');
    return null;
  }

  const cases = Array.from(xmlDoc.querySelectorAll('testcase'));
  if (!cases.length) {
    alert('No valid <testcase> nodes found in this file.');
    return null;
  }

  // 2. Extract Data Object
  let totalFailures = 0;
  let totalSkipped = 0;
  const totalTests = cases.length;

  const parsedCases = cases.map(tc => {
    const failure = tc.querySelector('failure') || tc.querySelector('error');
    const skipped = tc.querySelector('skipped');

    if (failure) totalFailures++;
    if (skipped) totalSkipped++;

    return {
      name: tc.getAttribute('name') || 'Unnamed test',
      classname: tc.getAttribute('classname') || '',
      time: tc.getAttribute('time') || '0',
      status: failure ? 'failed' : skipped ? 'skipped' : 'passed',
      failureMsg: failure ? failure.textContent.trim() : null
    };
  });

  const totalPassed = totalTests - totalFailures - totalSkipped;
  const reportData = { filename, totalTests, totalPassed, totalFailures, totalSkipped, cases: parsedCases };

  // 3. Store the parsed data using a unique key
  const storageKey = `junit_data_${Date.now()}`;
  await chrome.storage.local.set({ [storageKey]: reportData });

  // 4. Ask the background script to open the extension page
  // We pass the storageKey in the URL so the new window knows exactly which data to grab
  chrome.runtime.sendMessage({
    action: "OPEN_REPORT_WINDOW",
    url: `src/templates/junit/report.html?dataKey=${storageKey}`
  });
}
