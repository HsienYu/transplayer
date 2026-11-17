'use strict';
const fs = require('fs');
const path = require('path');
function privatePath(file, directory = false) {
  const s = fs.lstatSync(file);
  if (s.isSymbolicLink() || s.uid !== process.getuid() || (s.mode & 0o077) ||
      (directory ? !s.isDirectory() : (!s.isFile() || s.nlink !== 1 || s.size > 4096)))
    throw Error('NopeCHA storage must be private and owned');
}
function readPrivate(file) {
  privatePath(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { return fs.readFileSync(fd, 'utf8'); } finally { fs.closeSync(fd); }
}
function prepareNopecha({ home, source, root }) {
  const absent = { directory: null, cleanup() {} };
  const base = path.join(home, '.config/transplayer');
  const settings = path.join(base, 'nopecha.json');
  if (!fs.existsSync(settings)) return absent;
  privatePath(base, true);
  const value = JSON.parse(readPrivate(settings));
  if (typeof value.enabled !== 'boolean') throw Error('Invalid NopeCHA settings');
  if (!value.enabled) return absent;
  const secrets = path.join(home, '.config/secrets');
  privatePath(secrets, true);
  const keyFile = path.join(secrets, 'transplayer-nopecha.key');
  const key = fs.existsSync(keyFile) ? readPrivate(keyFile) : '';
  if (key.length > 512 || (key && !/^[A-Za-z0-9_.-]+$/.test(key))) throw Error('Invalid NopeCHA key format');
  privatePath(root, true);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  if (!manifest.nopecha || typeof manifest.nopecha !== 'object')
    throw Error('NopeCHA automation build required');
  const directory = fs.mkdtempSync(path.join(root, 'nopecha-private-'));
  const cleanup = () => fs.rmSync(directory, { recursive: true, force: true });
  try {
    fs.cpSync(source, directory, { recursive: true });
    fs.chmodSync(directory, 0o700);
    manifest.nopecha.key = key;
    manifest.nopecha.keys = [];
    manifest.nopecha.enabled = true;
    const target = path.join(directory, 'manifest.json');
    fs.chmodSync(target, 0o600);
    fs.writeFileSync(target, JSON.stringify(manifest), { mode: 0o600 });
    return { directory, cleanup };
  } catch (_) {
    cleanup();
    throw Error('NopeCHA private extension preparation failed');
  }
}
module.exports = { prepareNopecha };
