// Checks the split pages stay in step: every page shares site.css and the
// same statusline, and the statusline counts match the cards and themes pages.
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const pages = ['index.html', 'extensions.html', 'themes.html', 'cards.html'];
const html = Object.fromEntries(pages.map(name => [name, read(name)]));

const count = (source, cls) => (source.match(new RegExp(`class="${cls}[" ]`, 'g')) || []).length;
const cards = count(html['cards.html'], 'card-item');
const themes = count(html['themes.html'], 'theme-colors');
const pdp = html['index.html'].match(/const currentPresetVersion = "([^"]+)"/)[1];
const tee = html['index.html'].match(/const currentTeeVersion = "([^"]+)"/)[1];

const statuslines = pages.map(name => {
  const line = html[name].match(/<p class="statusline" id="statusline">([^<]*)<\/p>/);
  assert(line, `${name} has no statusline`);
  assert(html[name].includes('href="site.css'), `${name} does not load site.css`);
  return line[1];
});

assert.strictEqual(new Set(statuslines).size, 1, `statuslines differ:\n${statuslines.join('\n')}`);
const expected = new RegExp(`^pdp:${pdp.replace('.', '\\.')} \\| tee:${tee.replace('.', '\\.')} \\| cards:${cards} \\| themes:${themes} \\| updated:\\d{4}-\\d{2}-\\d{2}$`);
assert.match(statuslines[0], expected, `statusline should read pdp:${pdp} | tee:${tee} | cards:${cards} | themes:${themes}`);

for (const name of pages) {
  for (const id of ['extensions', 'themes', 'cards']) {
    const own = name === `${id}.html`;
    assert.strictEqual(html[name].includes(`id="${id}"`), own, `${name} ${own ? 'should' : 'should not'} contain #${id}`);
  }
}

console.log(`Site pages passed: ${cards} cards, ${themes} themes, statusline in step on ${pages.length} pages`);
