# 👁️ Bitbucket Artifact Previewer

<p align="center">
  <img style="width: 90%" src="/screenshots/marquee-tile.jpg" width="500" alt="GitLab MR Previewer in action with notes" />
</p>

This Chrome extension adds a **Preview** button to Bitbucket artifact downloads so you can inspect reports without the usual download-open-delete loop.

- **Save time:** Open artifacts directly instead of saving them locally first.
- **Read reports faster:** View HTML dashboards and JUnit results in a cleaner, purpose-built interface.
- **Stay in context:** Browse folders, files, and internal links inside generated reports without leaving the preview.
- **No manual setup:** Install it once and use it from the Bitbucket artifacts page.

<p align="center">
	<img style="width: 30%" src="/screenshots/slide-1-large.png" width="500" alt="GitLab MR Previewer in action on Google Chat" />
  <img style="width: 30%" src="/screenshots/slide-2-large.png" width="500" alt="GitLab MR Previewer in action with notes" />
  <img style="width: 30%" src="/screenshots/slide-3-large.png" width="500" alt="GitLab MR Previewer in action with notes" />
</p>

## ✨ What it supports today

The current version focuses on the most common artifact formats produced by CI pipelines:

- **Single XML reports** — rendered as a dedicated JUnit test report.
- **Single non-XML files** — opened directly in a new tab.
- **Multi-file archives** — shown in a dashboard with a file tree and in-app navigation.
- **HTML reports with relative links** — useful for coverage outputs and other static site style artifacts.

## ⚙️ How it works

1. The extension watches Bitbucket’s artifacts panel and injects a **Preview** button next to the native download action.
2. When you click it, the extension intercepts the artifact download request.
3. The archive is fetched and unpacked in memory.
4. The content is routed to the best viewer available:
   - JUnit report viewer for XML test results
   - File dashboard for multi-file archives
   - Direct tab preview for single non-XML files

## 🚀 Installation

Install it as an unpacked extension in Chrome:

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select the project folder.
6. Open a Bitbucket pipeline artifact page and look for **👁️ Preview**.

## 📝 Technical Details
- **Manifest Version: `3`**
- Permissions explanation:
  - `host_permissions`: Access to bitbucket.org artifacts API.
  - `content_scripts`: To inject the UI into the DOM.
  - `downloads`: To handle artifact fetching and Blob creation.
  - `storage`: To open a new window and write the DOM safely.
- **Architecture**: Modularized codebase using modern ES6+ features, async/await for asynchronous task handling, and isolated templates for UI components.

## 🤝 Contributing

If this extension saves you time, consider [supporting it with a coffee](https://www.buymeacoffee.com/dmoyadev).


Pull requests and ideas are welcome, especially for:

- More artifact formats
- Better navigation inside large reports
- Additional Bitbucket-specific edge cases
- UI polish and accessibility improvements
