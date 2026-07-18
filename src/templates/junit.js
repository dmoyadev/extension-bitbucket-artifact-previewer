export const generateJUnitHtml = (xmlString) => {
  const xmlDoc = new DOMParser().parseFromString(xmlString, 'text/xml');
  if (xmlDoc.querySelector('parsererror')) return null;

  const cases = Array.from(xmlDoc.querySelectorAll('testcase'));
  if (!cases.length) return null;

  let totalFailures = 0, totalSkipped = 0;

  const htmlCases = cases.map(tc => {
    const name = tc.getAttribute('name') || 'Unnamed test';
    const classname = tc.getAttribute('classname') || '';
    const time = tc.getAttribute('time') || '0';
    const failure = tc.querySelector('failure') || tc.querySelector('error');
    const skipped = tc.querySelector('skipped');

    let status = 'passed';
    if (failure) { status = 'failed'; totalFailures++; }
    else if (skipped) { status = 'skipped'; totalSkipped++; }

    const icon = status === 'failed' ? '❌' : status === 'skipped' ? '⚠️' : '✅';
    const failureHtml = failure
      ? `<div class="failure-msg">${failure.getAttribute('message') || ''}\n\n${failure.textContent || ''}</div>`
      : '';

    return `
      <div class="testcase ${status}">
        <div class="test-name">${icon} ${name}</div>
        <div class="test-meta">${classname} • ${time}s</div>
        ${failureHtml}
      </div>`;
  }).join('');

  const totalTests = cases.length;
  const totalPassed = totalTests - totalFailures - totalSkipped;

  const styles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f4f5f7; color: #1F1F21; padding: 30px; margin: 0; }
      .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
      h1 { font-size: 24px; margin-top: 0; border-bottom: 2px solid #ebecf0; padding-bottom: 15px; }
      .summary { display: flex; gap: 15px; margin-bottom: 30px; }
      .stat { padding: 20px; border-radius: 5px; flex: 1; text-align: center; border: 1px solid #dfe1e6; }
      .stat-value { font-size: 28px; font-weight: bold; margin-bottom: 5px; }
      .stat-label { font-size: 12px; text-transform: uppercase; color: #5e6c84; font-weight: 600; }
      .stat.total { border-top: 4px solid #0052cc; }
      .stat.passed { border-top: 4px solid #36b37e; background: #e3fcef; }
      .stat.failed { border-top: 4px solid #ff5630; background: #ffebe6; }
      .stat.skipped { border-top: 4px solid #ffab00; background: #fffae6; }
      .testcase { padding: 15px; border-bottom: 1px solid #ebecf0; }
      .testcase:last-child { border-bottom: none; }
      .testcase.passed { border-left: 4px solid #36b37e; }
      .testcase.failed { border-left: 4px solid #ff5630; background: #fffcfc; }
      .testcase.skipped { border-left: 4px solid #ffab00; }
      .test-name { font-weight: 600; font-size: 15px; }
      .test-meta { font-size: 13px; color: #5e6c84; margin-top: 6px; }
      .failure-msg { background: #ffebe6; color: #bf2600; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 13px; margin-top: 15px; white-space: pre-wrap; overflow-x: auto; border: 1px solid #ffbdad; }
      @media (prefers-color-scheme: dark) {
        body { background: #091e42; color: #f4f5f7; }
        .container { background: #1F1F21; border: 1px solid #2f2f33; box-shadow: none; }
        h1 { border-bottom-color: #2f2f33; }
        .summary .stat { background: #091e42; border-color: #2f2f33; color: #b3bac5; }
        .stat.passed { background: #0b3d26; border-top-color: #36b37e; }
        .stat.failed { background: #421f1a; border-top-color: #ff5630; }
        .stat.skipped { background: #40320a; border-top-color: #ffab00; }
        .testcase { border-bottom-color: #2f2f33; }
        .testcase.failed { background: #2b1d1d; }
        .test-meta { color: #8993a4; }
        .failure-msg { background: #3b1912; color: #ffab00; border-color: #5c2c22; }
      }
    </style>
  `;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Artifact Explorer</title>
        ${styles}
      </head>
      
      <body>
        <div class="container">
          <h1>JUnit Test Report</h1>
          <div class="summary">
            <div class="stat total"><div class="stat-value">${totalTests}</div><div class="stat-label">Total Tests</div></div>
            <div class="stat passed"><div class="stat-value">${totalPassed}</div><div class="stat-label">Passed</div></div>
            <div class="stat failed"><div class="stat-value">${totalFailures}</div><div class="stat-label">Failed</div></div>
            <div class="stat skipped"><div class="stat-value">${totalSkipped}</div><div class="stat-label">Skipped</div></div>
          </div>
          ${htmlCases}
        </div>
      </body>
    </html>
  `;
};
