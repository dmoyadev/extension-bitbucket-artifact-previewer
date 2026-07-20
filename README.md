# 👁️ Bitbucket Artifact Previewer

A lightweight Chrome Extension that transforms Bitbucket pipeline artifacts into instantly previewable reports, bypassing the tedious "Download-Open-Delete" workflow.

---

## ✨ Features

* **Instant Preview:** Stop downloading files just to inspect them. Preview HTML reports, JUnit test results, and code coverage stats directly in the browser.
* **Smart Artifact Handling:** Automatically detects the artifact type and applies the appropriate viewer (e.g., dedicated dashboard for Coverage, formatted view for JUnit).
* **Interactive Navigation:** Supports complex reports (like Istanbul coverage) with deep-linking support, allowing you to browse through files, folders, and reports without losing your place in the sidebar.
* **CSP & Security Focused:** Uses an advanced "Popup Injection" strategy to render content in a safe, privileged environment, effectively bypassing restrictive Content Security Policies that often break third-party tools.
* **Memory-Efficient:** Includes a lightweight in-memory TAR/GZ extractor to handle archives without the need for server-side processing or temporary file clutter.

---

## 🚀 Installation (Developer Mode)

Since this extension is built for high-performance direct inspection, you can install it as an "Unpacked" extension:

1. **Download/Clone** this repository to your local machine.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** (toggle in the top right corner).
4. Click **Load unpacked** and select the folder containing the extension files.
5. Navigate to your Bitbucket Pipeline artifacts page—you should see the new "👁️ Preview" button.

---

## ⚙️ How it Works

* **MutationObserver:** The extension actively monitors the Bitbucket SPA (Single Page Application) for the "Artifacts" panel. When detected, it injects a custom "Preview" button alongside the standard download link.
* **Forced-Download Bypass:**
  * Bitbucket serves artifacts with a `Content-Disposition: attachment` header.
  * Our extension intercepts the click, performs a `fetch()` request, converts the response into a `Blob`, and generates an `Object URL`.
  * This allows the browser to render the content natively as if it were a standard webpage, rather than a file download.
* **CSP-Safe Rendering:** To ensure reports display correctly without being blocked by Bitbucket’s security headers, the extension opens a blank window (`window.open`) and writes the DOM elements from the content script. This "Popup Injection" strategy allows us to execute custom JavaScript and CSS safely.
* **In-Memory Extraction:** The extension includes a specialized TAR/GZ parser that handles even the most complex, deeply nested file paths (supporting extended headers for paths >100 characters).

---

## 📝 Technical Details

* **Manifest Version:** 3
* **Permissions:**
  * `host_permissions`: Access to `bitbucket.org` artifacts API.
  * `content_scripts`: To inject the UI into the DOM.
  * `downloads`: To handle artifact fetching and Blob creation.
  * `storage`: To open a new window and write the DOM safely.


* **Architecture:** Modularized codebase using modern ES6+ features, `async/await` for asynchronous task handling, and isolated templates for UI components.

---

## 🤝 Contributing

We welcome contributions to make pipeline artifact inspection even smoother. Feel free to open an issue or submit a pull request if you have ideas for:

* Supporting additional artifact types (e.g., JSON logs, performance benchmarks).
* Improving the UI/UX of the sidebar navigation.
* Adding configuration options for custom Bitbucket instances.
