import { defineConfig } from 'vite';
import { resolve } from 'path';
import fs from 'fs';
import path from 'path';

function getTargetInfo(key, rootDir) {
  if (!key) return null;
  if (key.startsWith('letter_')) {
    const char = key.replace('letter_', '').toUpperCase();
    const folder = path.join(rootDir, 'public/audio/letters');
    const filename = `${char}.webm`;
    return {
      folder,
      filename,
      filePath: path.join(folder, filename),
      relUrl: `/audio/letters/${filename}`,
      category: 'letters',
      id: char
    };
  }
  if (key.startsWith('word_')) {
    const id = key.replace('word_', '').toLowerCase();
    const folder = path.join(rootDir, 'public/audio/words');
    const filename = `${id}.webm`;
    return {
      folder,
      filename,
      filePath: path.join(folder, filename),
      relUrl: `/audio/words/${filename}`,
      category: 'words',
      id
    };
  }
  if (key.startsWith('meaning_')) {
    const id = key.replace('meaning_', '').toLowerCase();
    const folder = path.join(rootDir, 'public/audio/meanings');
    const filename = `${id}.webm`;
    return {
      folder,
      filename,
      filePath: path.join(folder, filename),
      relUrl: `/audio/meanings/${filename}`,
      category: 'meanings',
      id
    };
  }
  return null;
}

function loadManifest(rootDir) {
  const p = path.join(rootDir, 'public/audio/manifest.json');
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (_) {}
  return { version: 1, updatedAt: new Date().toISOString(), letters: {}, words: {}, meanings: {} };
}

function saveManifest(rootDir, manifest) {
  const p = path.join(rootDir, 'public/audio/manifest.json');
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(p, JSON.stringify(manifest, null, 2), 'utf8');
}

export default defineConfig({
  plugins: [
    {
      name: 'rewrite-admin-and-audio-api',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/admin' || req.url === '/admin/') {
            req.url = '/admin.html';
            return next();
          }

          // 1. Save single audio file directly to public/audio/
          if (req.url === '/api/save-audio' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const { key, dataUrl } = JSON.parse(body);
                const info = getTargetInfo(key, import.meta.dirname);
                if (!info || !dataUrl) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: 'Invalid key or dataUrl' }));
                }

                fs.mkdirSync(info.folder, { recursive: true });
                const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
                fs.writeFileSync(info.filePath, Buffer.from(base64, 'base64'));

                const manifest = loadManifest(import.meta.dirname);
                manifest[info.category] = manifest[info.category] || {};
                manifest[info.category][info.id] = info.relUrl;
                saveManifest(import.meta.dirname, manifest);

                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, url: info.relUrl }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          // 2. Batch save multiple audio recordings
          if (req.url === '/api/save-audio/batch' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const { items } = JSON.parse(body);
                if (!Array.isArray(items)) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  return res.end(JSON.stringify({ error: 'Expected items array' }));
                }

                const manifest = loadManifest(import.meta.dirname);
                let count = 0;

                for (const item of items) {
                  const { key, dataUrl } = item;
                  const info = getTargetInfo(key, import.meta.dirname);
                  if (info && dataUrl) {
                    fs.mkdirSync(info.folder, { recursive: true });
                    const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
                    fs.writeFileSync(info.filePath, Buffer.from(base64, 'base64'));
                    manifest[info.category] = manifest[info.category] || {};
                    manifest[info.category][info.id] = info.relUrl;
                    count++;
                  }
                }

                saveManifest(import.meta.dirname, manifest);
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, savedCount: count, manifest }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          // 3. Delete audio file
          if (req.url === '/api/delete-audio' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
              try {
                const { key } = JSON.parse(body);
                const info = getTargetInfo(key, import.meta.dirname);
                if (info) {
                  if (fs.existsSync(info.filePath)) {
                    fs.unlinkSync(info.filePath);
                  }
                  const manifest = loadManifest(import.meta.dirname);
                  if (manifest[info.category]) {
                    delete manifest[info.category][info.id];
                    saveManifest(import.meta.dirname, manifest);
                  }
                }
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err.message }));
              }
            });
            return;
          }

          next();
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html')
      }
    }
  }
});
