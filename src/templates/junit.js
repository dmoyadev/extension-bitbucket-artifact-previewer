export async function openJunitReport(rawJunitContent, filename) {
  // 1. Open an empty window under the Bitbucket origin to bypass CSP restrictions
  const reportWindow = window.open('', '_blank');

  if (!reportWindow) {
    console.error("Popup blocked! Please allow popups for Bitbucket.");
    return;
  }

  // 2. Parse XML data
  const xmlDoc = new DOMParser().parseFromString(rawJunitContent, 'text/xml');
  if (xmlDoc.querySelector('parsererror')) {
    reportWindow.document.write('<h2>Error: Invalid XML file</h2>');
    return null;
  }

  const cases = Array.from(xmlDoc.querySelectorAll('testcase'));
  if (!cases.length) {
    reportWindow.document.write('<h2>No valid &lt;testcase&gt; nodes found in this file.</h2>');
    return null;
  }

  // 3. Extract stats and generate HTML cases
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

  // 4. Define UI Styles
  const styles = `
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        background: #f3f4f6;
        color: #111827;
        margin: 0;
        padding: 32px;
      }
    
      .container {
        max-width: 1200px;
        margin: 0 auto;
        background: #fff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        box-shadow: 0 2px 8px rgba(0,0,0,.05);
        padding: 32px;
      }
    
      h1 {
        margin-top: 0;
        margin-bottom: 24px;
        padding-bottom: 16px;
        font-size: 24px;
        border-bottom: 1px solid #e5e7eb;
      }
    
      .summary {
        display: flex;
        gap: 16px;
        margin-bottom: 32px;
      }
    
      .stat {
        flex: 1;
        text-align: center;
        padding: 20px;
        border: 1px solid #e5e7eb;
        border-radius: 10px;
        background: #fafafa;
      }
    
      .stat-value {
        font-size: 30px;
        font-weight: 700;
        margin-bottom: 6px;
      }
    
      .stat-label {
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: .05em;
        color: #6b7280;
        font-weight: 600;
      }
    
      .stat.total { border-top: 4px solid #6b7280; }
      .stat.passed { border-top: 4px solid #22c55e; background: #f0fdf4; }
      .stat.failed { border-top: 4px solid #ef4444; background: #fef2f2; }
      .stat.skipped { border-top: 4px solid #f59e0b; background: #fffbeb; }
    
      .testcase {
        padding: 16px;
        border-bottom: 1px solid #e5e7eb;
      }
    
      .testcase:last-child {
        border-bottom: none;
      }
    
      .testcase.passed {
        border-left: 4px solid #22c55e;
      }
    
      .testcase.failed {
        border-left: 4px solid #ef4444;
        background: #fefcfc;
      }
    
      .testcase.skipped {
        border-left: 4px solid #f59e0b;
      }
    
      .test-name {
        font-size: 15px;
        font-weight: 600;
      }
    
      .test-meta {
        margin-top: 6px;
        font-size: 13px;
        color: #6b7280;
      }
    
      .failure-msg {
        margin-top: 14px;
        padding: 14px;
        background: #fef2f2;
        border: 1px solid #fecaca;
        border-radius: 8px;
        color: #991b1b;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px;
        white-space: pre-wrap;
        overflow-x: auto;
      }
    
      @media (prefers-color-scheme: dark) {
        body {
          background: #111827;
          color: #f3f4f6;
        }
    
        .container {
          background: #1f2937;
          border-color: #374151;
          box-shadow: none;
        }
    
        h1 {
          border-bottom-color: #374151;
        }
    
        .stat {
          background: #273244;
          border-color: #374151;
        }
    
        .stat-label {
          color: #9ca3af;
        }
    
        .stat.total { border-top-color: #9ca3af; }
        .stat.passed { background: #163021; }
        .stat.failed { background: #3a1d1d; }
        .stat.skipped { background: #3d3013; }
    
        .testcase {
          border-bottom-color: #374151;
        }
    
        .testcase.failed {
          background: #2a1d1d;
        }
    
        .test-meta {
          color: #9ca3af;
        }
    
        .failure-msg {
          background: #3b1f1f;
          border-color: #7f1d1d;
          color: #fecaca;
        }
      }
    </style>
  `;

  // 5. Write the final HTML document
  reportWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>JUnit Report: ${filename}</title>
        ${styles}
      </head>
      <body>
        <div class="container">
          <h1>JUnit Test Report: ${filename}</h1>
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
  `);
  reportWindow.document.close();
}
