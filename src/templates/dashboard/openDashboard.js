import { attachDashboardLogic } from './dashboard.js';

export async function openDashboard(files, initialPath) {
  const win = window.open('', '_blank');
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for Bitbucket.');
    return;
  }

  win.document.open();
  win.document.write('<!DOCTYPE html><html lang="en"><head><title>Bitbucket Artifact Previewer</title></head><body></body></html>');
  win.document.close();

  try {
    const basePath = 'src/templates/dashboard';
    const [htmlRes, cssRes] = await Promise.all([
      fetch(chrome.runtime.getURL(`${basePath}/dashboard.html`)),
      fetch(chrome.runtime.getURL(`${basePath}/dashboard.css`))
    ]);

    const htmlContent = await htmlRes.text();
    const cssContent = await cssRes.text();

    const styleNode = win.document.createElement('style');
    styleNode.textContent = cssContent;
    win.document.head.appendChild(styleNode);

    win.document.body.innerHTML = htmlContent;

    attachDashboardLogic(win, files, initialPath);
  } catch (error) {
    console.error("Error loading Dashboard templates:", error);
    win.document.body.innerHTML = '<h2>Error loading explorer. Check your console.</h2>';
  }
}
