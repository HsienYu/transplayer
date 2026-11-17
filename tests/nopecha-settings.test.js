const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { prepareNopecha } = require('../nopecha-settings');
function fixture(t) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-nopecha-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  for (const dir of ['.config', '.config/transplayer', '.config/secrets', 'source', 'profiles'])
    fs.mkdirSync(path.join(home, dir), { mode: 0o700 });
  fs.writeFileSync(path.join(home, 'source/manifest.json'), JSON.stringify({ nopecha: { key: '', keys: [] } }));
  const settings = path.join(home, '.config/transplayer/nopecha.json');
  const key = path.join(home, '.config/secrets/transplayer-nopecha.key');
  fs.writeFileSync(settings, JSON.stringify({ enabled: true }), { mode: 0o600 });
  fs.writeFileSync(key, 'fixture-key', { mode: 0o600 });
  return { home, settings, key, source: path.join(home, 'source'), root: path.join(home, 'profiles') };
}
test('enabled seed gets private configured copy; source and public settings never receive key', t => {
  const f = fixture(t); const prepared = prepareNopecha(f);
  const file = path.join(prepared.directory, 'manifest.json');
  assert.equal(JSON.parse(fs.readFileSync(file)).nopecha.key, 'fixture-key');
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.statSync(prepared.directory).mode & 0o777, 0o700);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.source, 'manifest.json'))).nopecha.key, '');
  assert(!fs.readFileSync(f.settings, 'utf8').includes('fixture-key'));
  prepared.cleanup(); assert(!fs.existsSync(prepared.directory));
});
test('disabled and missing settings do not load extension', t => {
  const f = fixture(t);
  fs.writeFileSync(f.settings, '{"enabled":false}');
  assert.equal(prepareNopecha(f).directory, null);
  fs.unlinkSync(f.settings);
  assert.equal(prepareNopecha(f).directory, null);
});
test('symlink, loose permissions and hostile key are rejected without leaking contents', t => {
  const f = fixture(t);
  fs.chmodSync(f.key, 0o644);
  assert.throws(() => prepareNopecha(f), /private/);
  fs.chmodSync(f.key, 0o600); fs.writeFileSync(f.key, 'hostile\nsecret');
  assert.throws(() => prepareNopecha(f), error => !error.message.includes('secret'));
  fs.unlinkSync(f.key); fs.symlinkSync(f.settings, f.key);
  assert.throws(() => prepareNopecha(f), /private/);
});
