import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  fuseFilePath,
  isDesktopEntry,
  parseWindowResult,
  readNodeCliInspectFuse,
  windowExpression,
} from '../index.js';

const SENTINEL = 'dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX';

async function fuseFixture(enabled) {
  const directory = await mkdtemp(path.join(tmpdir(), 'dsh-fuse-'));
  const file = path.join(directory, 'Electron Framework');
  const wire = `111${enabled ? '1' : '0'}11111`;
  await writeFile(file, Buffer.concat([Buffer.from('prefix'), Buffer.from(SENTINEL), Buffer.from([1, wire.length]), Buffer.from(wire), Buffer.from('suffix')]));
  return { directory, file };
}

test('isDesktopEntry recognizes the Desktop Host entry point', () => {
  assert.equal(isDesktopEntry(['node', '/opt/dsh/dsh-desktop-host/lib/index.js']), true);
  assert.equal(isDesktopEntry(['node', 'C:\\dsh\\dsh-desktop-host\\lib\\index.js']), true);
});

test('isDesktopEntry rejects CLI and unrelated entries', () => {
  assert.equal(isDesktopEntry(['node', '/opt/dsh/dsh-desktop-host/lib/cli.js']), false);
  assert.equal(isDesktopEntry(['node', '/opt/dsh/dsh-desktop-host/lib/index.mjs']), false);
  assert.equal(isDesktopEntry(['node', '/opt/other/index.js']), false);
  assert.equal(isDesktopEntry([]), false);
  assert.equal(isDesktopEntry(undefined), false);
});

test('read expression never calls setAlwaysOnTop', () => {
  const expression = windowExpression(true, true);
  assert.equal(expression.includes('setAlwaysOnTop('), false);
  assert.equal(expression.includes("dsh-app://app"), true);
  assert.equal(expression.includes('isAlwaysOnTop()'), true);
});

test('write expression sets an explicit boolean and the floating level', () => {
  assert.equal(windowExpression(true, false).includes("setAlwaysOnTop(true, 'floating')"), true);
  assert.equal(windowExpression(false, false).includes("setAlwaysOnTop(false, 'floating')"), true);
});

test('write expression only emits boolean literals', () => {
  // A non-boolean input must be coerced to false, never interpolated.
  assert.equal(windowExpression('true', false).includes("setAlwaysOnTop(false, 'floating')"), true);
  assert.equal(windowExpression(1, false).includes("setAlwaysOnTop(false, 'floating')"), true);
  assert.equal(windowExpression('x', false).includes("setAlwaysOnTop(false, 'floating')"), true);
});

test('parseWindowResult normalizes a successful reading', () => {
  assert.deepEqual(parseWindowResult(JSON.stringify({ ok: true, alwaysOnTop: true, windowId: 7 })), {
    alwaysOnTop: true,
    windowId: 7,
  });
  assert.deepEqual(parseWindowResult(JSON.stringify({ ok: true, alwaysOnTop: false })), {
    alwaysOnTop: false,
    windowId: null,
  });
});

test('parseWindowResult reports unusable values as bridge errors', () => {
  assert.throws(() => parseWindowResult(undefined), { code: 'unreadable' });
  assert.throws(() => parseWindowResult('{'), { code: 'unreadable' });
  assert.throws(() => parseWindowResult(JSON.stringify({ ok: false, error: 'no-window' })), {
    code: 'no-window',
  });
  assert.throws(() => parseWindowResult(JSON.stringify({ ok: false, error: 'boom' })), {
    code: 'window-unavailable',
  });
});

test('fuseFilePath follows the Electron bundle layout', () => {
  assert.equal(
    fuseFilePath('/Applications/Foo.app/Contents/MacOS/Foo', 'darwin'),
    '/Applications/Foo.app/Contents/Frameworks/Electron Framework.framework/Electron Framework',
  );
  assert.equal(fuseFilePath('C:\\App\\Foo.exe', 'win32'), 'C:\\App\\Foo.exe');
  assert.equal(fuseFilePath('/opt/foo/foo', 'linux'), '/opt/foo/foo');
});

test('readNodeCliInspectFuse reports an enabled inspect fuse', async () => {
  const fixture = await fuseFixture(true);
  try {
    assert.equal(await readNodeCliInspectFuse(fixture.file), true);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test('readNodeCliInspectFuse refuses a disabled inspect fuse', async () => {
  const fixture = await fuseFixture(false);
  try {
    assert.equal(await readNodeCliInspectFuse(fixture.file), false);
  } finally {
    await rm(fixture.directory, { recursive: true, force: true });
  }
});

test('readNodeCliInspectFuse returns null when the sentinel is absent', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'dsh-fuse-'));
  const file = path.join(directory, 'Electron Framework');
  try {
    await writeFile(file, 'no fuse wire here');
    assert.equal(await readNodeCliInspectFuse(file), null);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
