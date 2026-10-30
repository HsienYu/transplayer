const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

function python(code) {
  const result = spawnSync("python3", ["-c",
    `import sys\nsys.path.insert(0, ${JSON.stringify(path.resolve(__dirname, "../packaging"))})\n` +
    "from browser_bundle import verify_archive, verify_version, validate_member, prepare_browser\n" + code,
  ], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

test("browser archive verification accepts exact bytes and rejects tampering", () => {
  python(`import tempfile, pathlib, hashlib
with tempfile.TemporaryDirectory() as d:
 p = pathlib.Path(d) / 'synthetic.zip'
 p.write_bytes(b'synthetic fixture')
 verify_archive(p, hashlib.sha256(p.read_bytes()).hexdigest())
 try:
  verify_archive(p, '0' * 64)
 except ValueError:
  pass
 else:
  raise AssertionError('tampered artifact accepted')
`);
});


const fixture = `import tempfile, pathlib, hashlib, zipfile, json
from unittest.mock import patch
def fixture(root, extension_version='0.6.1'):
 lock = {'version': '156.0.8078.80'}
 for name in ['chrome', 'chromedriver', 'extension']:
  filename = name + '.zip'
  item = {'file': filename, 'directory': name + '-linux64'}
  with zipfile.ZipFile(str(root / filename), 'w') as z:
   if name == 'extension':
    z.writestr('manifest.json', json.dumps({'version': extension_version, 'manifest_version': 3}))
   else:
    z.writestr(item['directory'] + '/' + name, 'synthetic binary, never executed')
  item['sha256'] = hashlib.sha256((root / filename).read_bytes()).hexdigest()
  lock[name] = item
 lock['extension'].update(version='0.6.1', manifest_version=3)
 return lock
`;
test("prepared browser files are world-readable without adding setuid privileges", () => {
  python(fixture + `
with tempfile.TemporaryDirectory() as d:
 root = pathlib.Path(d)
 lock = fixture(root)
 with patch('browser_bundle.subprocess.check_output', return_value=b'Chrome 156.0.8078.80'):
  chrome, driver, extension = prepare_browser(root, root / 'output', lock)
  for binary in [chrome / 'chrome', driver]:
   assert binary.stat().st_mode & 0o444 == 0o444, 'AppImage file is not world-readable'
   assert binary.stat().st_mode & 0o6000 == 0, 'setuid/setgid must not be copied'
`);
});

test("complete toolchain preparation checks both versions and the extension manifest", () => {
  python(fixture + `
with tempfile.TemporaryDirectory() as d:
 root = pathlib.Path(d)
 lock = fixture(root)
 with patch('browser_bundle.subprocess.check_output', return_value=b'Chrome 156.0.8078.80') as run:
  chrome, driver, extension = prepare_browser(root, root / 'output', lock)
  assert chrome.is_dir() and driver.is_file() and extension.is_file()
  assert run.call_count == 2
`);
});

test("wrong extension manifest fails even when its archive hash matches", () => {
  python(fixture + `
with tempfile.TemporaryDirectory() as d:
 root = pathlib.Path(d)
 lock = fixture(root, '0.0.0')
 with patch('browser_bundle.subprocess.check_output', return_value=b'Chrome 156.0.8078.80'):
  try:
   prepare_browser(root, root / 'output', lock)
  except ValueError as error:
   assert 'manifest' in str(error)
  else:
   raise AssertionError('wrong extension accepted')
`);
});

test("a tampered extension stops preparation before any binary executes", () => {
  python(fixture + `
with tempfile.TemporaryDirectory() as d:
 root = pathlib.Path(d)
 lock = fixture(root)
 (root / 'extension.zip').write_bytes(b'tampered')
 with patch('browser_bundle.subprocess.check_output') as run:
  try:
   prepare_browser(root, root / 'output', lock)
  except ValueError:
   pass
  else:
   raise AssertionError('tampering accepted')
  run.assert_not_called()
`);
});

test("missing browser archives fail explicitly", () => {
  python(`import tempfile, pathlib
with tempfile.TemporaryDirectory() as d:
 try:
  verify_archive(pathlib.Path(d) / 'absent.zip', '0' * 64)
 except FileNotFoundError:
  pass
 else:
  raise AssertionError('missing artifact accepted')
`);
});

test("browser and driver versions must match the exact locked version", () => {
  python(`verify_version('ChromeDriver 156.0.8078.80 (synthetic)', '156.0.8078.80')
verify_version('Google Chrome for Testing 156.0.8078.80', '156.0.8078.80')
for bad in ['ChromeDriver 87.0.4280.88', 'ChromeDriver 156.0.8078.800', 'no version']:
 try:
  verify_version(bad, '156.0.8078.80')
 except ValueError:
  pass
 else:
  raise AssertionError('wrong version accepted')
`);
});

test("archive member validation rejects traversal, absolute paths and symlinks", () => {
  python(`import zipfile
validate_member(zipfile.ZipInfo('chrome-linux64/chrome'))
for name in ['../escape', '/absolute', 'chrome/../../escape', 'chrome\\\\escape']:
 try:
  validate_member(zipfile.ZipInfo(name))
 except ValueError:
  pass
 else:
  raise AssertionError('hostile path accepted: ' + name)
link = zipfile.ZipInfo('chrome/link')
link.external_attr = 0o120777 << 16
try:
 validate_member(link)
except ValueError:
 pass
else:
 raise AssertionError('symlink accepted')
`);
});
