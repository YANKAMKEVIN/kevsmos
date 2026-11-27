import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('la version affichée suit package.json', () => {
  const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const util = readFileSync(new URL('../../src/util.js', import.meta.url), 'utf8');
  assert.equal(util.match(/VERSION='([^']+)'/)[1], pkg.version);
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/);
});
