export const getPageNonce = () => document.querySelector('script[nonce]')?.nonce || '';

const MIME_TYPES = {
  html: 'text/html;charset=utf-8',
  css: 'text/css;charset=utf-8',
  js: 'application/javascript;charset=utf-8',
  json: 'application/json;charset=utf-8',
  xml: 'text/xml;charset=utf-8',
  svg: 'image/svg+xml'
};

export const getMimeType = (filename) => {
  const ext = filename.split('.').pop().toLowerCase();
  if (MIME_TYPES[ext]) return MIME_TYPES[ext];
  if (['jpeg', 'jpg', 'gif', 'png'].includes(ext)) return `image/${ext}`;
  return 'text/plain;charset=utf-8';
};

export const extractTar = (arrayBuffer) => {
  const files = {};
  const view = new Uint8Array(arrayBuffer);
  const decoder = new TextDecoder('utf-8');
  let offset = 0;
  let nextLongName = null;

  while (offset < arrayBuffer.byteLength - 512) {
    if (view[offset] === 0 && view[offset + 1] === 0) break;

    const readString = (start, length) => {
      let str = '';
      for (let i = 0; i < length; i++) {
        if (view[offset + start + i] === 0) break;
        str += String.fromCharCode(view[offset + start + i]);
      }
      return str;
    };

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
};

const resolveRelativePath = (basePath, relativeUrl) => {
  const stack = basePath ? basePath.split('/') : [];
  for (const part of relativeUrl.split('/')) {
    if (part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return stack.join('/');
};

export const buildVirtualFileSystem = (extractedFiles, nonceAttr) => {
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
};
