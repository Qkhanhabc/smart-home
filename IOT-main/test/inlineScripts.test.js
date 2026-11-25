const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

for (const file of ['automation.html', 'index.html', 'airconditioner.html']) {
  test(`inline script của ${file} có cú pháp hợp lệ`, () => {
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', file), 'utf8');
    const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((match) => match[1]);
    assert.ok(scripts.length > 0);
    scripts.forEach((source) => assert.doesNotThrow(() => new Function(source)));
  });
}
