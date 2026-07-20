/**
 * Get the nonce attribute from the first script tag in the document.
 * `nonce` stands for "number used once" and is a security feature to prevent certain types of attacks.
 * We get it to inject our own scripts into the page safely.
 * @returns {string} The nonce value or an empty string if not found.
 */
export function getPageNonce() {
  return document.querySelector('script[nonce]')?.nonce
    || document.scripts[0]?.nonce
    || '';
}

const MIME_TYPES = {
  html: 'text/html;charset=utf-8',
  css: 'text/css;charset=utf-8',
  js: 'application/javascript;charset=utf-8',
  json: 'application/json;charset=utf-8',
  xml: 'text/xml;charset=utf-8',
  svg: 'image/svg+xml',
  jpeg: 'image/jpeg',
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
};

/**
 * Get the MIME type based on the file extension.
 * @param {string} filename - The name of the file to determine the MIME type for.
 * @returns {typeof MIME_TYPES[keyof MIME_TYPES] | 'text/plain;charset=utf-8'} - The corresponding MIME type or a default type if not found.
 */
export function getMimeType(filename) {
  const extension = filename.split('.').pop().toLowerCase();
  if (MIME_TYPES[extension]) return MIME_TYPES[extension];

  return 'text/plain;charset=utf-8';
}

/**
 * Extract files from a TAR archive represented as an ArrayBuffer.
 * @param {ArrayBuffer} arrayBuffer - The ArrayBuffer containing the TAR archive data.
 * @returns {{ [key: string]: ArrayBuffer }} - An object where keys are file paths and values are ArrayBuffers of the file contents.
 */
export function extractTar(arrayBuffer) {
  const files = {};
  const view = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8');
  let offset = 0;
  let nextLongName = null;

  while (offset < arrayBuffer.byteLength - 512) {
    if (view[offset] === 0 && view[offset + 1] === 0) break;

    function readString(start, length) {
      let str = '';
      for (let i = 0; i < length; i++) {
        if (view[offset + start + i] === 0) break;
        str += String.fromCharCode(view[offset + start + i]);
      }
      return str;
    }

    let prefix = readString(345, 155);
    let name = readString(0, 100);
    if (prefix) name = `${prefix}${prefix.endsWith('/') ? '' : '/'}${name}`;

    if (nextLongName) {
      name = nextLongName;
      nextLongName = null;
    }

    const sizeStr = readString(124, 12);
    const size = parseInt(sizeStr.trim(), 8) || 0;
    const flagType = String.fromCharCode(view[offset + 156]);

    offset += 512;

    if (flagType === 'L') {
      nextLongName = decoder.decode(arrayBuffer.slice(offset, offset + size)).replace(/\0/g, '');
    } else if (flagType === 'x') {
      const pathMatch = decoder.decode(arrayBuffer.slice(offset, offset + size)).match(/path=([^\n]+)/);
      if (pathMatch) nextLongName = pathMatch[1];
    } else if (size > 0 && (flagType === '0' || flagType === '\0')) {
      const cleanName = name.startsWith('./') ? name.substring(2) : name;
      files[cleanName] = arrayBuffer.slice(offset, offset + size);
    }

    offset += Math.ceil(size / 512) * 512;
  }
  return files;
}

/**
 * Resolve a relative URL against a base path to get an absolute path.
 * @param {string} basePath - The base path to resolve against.
 * @param {string} relativeUrl - The relative URL to resolve.
 * @returns {string} - The resolved absolute path.
 */
function resolveRelativePath(basePath, relativeUrl) {
  const stack = basePath ? basePath.split('/') : [];
  for (const part of relativeUrl.split('/')) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
}

/**
 * Build a virtual file system from extracted files, creating Blob URLs for each file and rewriting HTML files to inline CSS and JS.
 * @param {{ [key: string]: ArrayBuffer }} extractedFiles - An object where keys are file paths and values are ArrayBuffers of the file contents.
 * @param {string} nonceAttr - The nonce attribute to be added to script tags for security.
 * @returns {{}}
 */
export function buildVirtualFileSystem(extractedFiles, nonceAttr) {
  const fileUrls = {};
  const htmlFiles = {};
  const assetContent = {};
  const decoder = new TextDecoder('utf-8');

  for (const [path, data] of Object.entries(extractedFiles)) {
    const mimeType = getMimeType(path);
    if (mimeType.includes('text/css') || mimeType.includes('javascript')) {
      assetContent[path] = decoder.decode(data);
    }
    if (mimeType.includes('text/html')) {
      htmlFiles[path] = decoder.decode(data);
    }
    fileUrls[path] = URL.createObjectURL(new Blob([data], { type: mimeType }));
  }

  for (const [path, htmlText] of Object.entries(htmlFiles)) {
    const basePath = path.split('/').slice(0, -1).join('/');
    const rewrittenHtml = htmlText
      .replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/gi, (match, url) => {
        const absPath = resolveRelativePath(basePath, url);
        return assetContent[absPath] ? `<style>${assetContent[absPath]}</style>` : match;
      })
      .replace(/<script[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (match, url) => {
        const absPath = resolveRelativePath(basePath, url);
        return assetContent[absPath] ? `<script ${nonceAttr}>${assetContent[absPath]}</script>` : match;
      });

    URL.revokeObjectURL(fileUrls[path]);
    fileUrls[path] = URL.createObjectURL(new Blob([rewrittenHtml], { type: 'text/html;charset=utf-8' }));
  }

  return fileUrls;
}
