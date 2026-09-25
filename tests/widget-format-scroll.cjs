const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const load = file => import('data:text/javascript;base64,' + fs.readFileSync(path.join(__dirname, '../frontend/chatbot', file)).toString('base64'));

async function main() {
  const { parseMarkdown } = await load('js/core/markdown.js');
  const result = parseMarkdown('#### Enrolment\n\nRead **this** first.\n\n1. Choose a course\n2. Contact us\n\n- Bring ID\n- Bring forms');
  assert.match(result, /<h4>Enrolment<\/h4>/);
  assert.match(result, /<p>Read <strong>this<\/strong> first\.<\/p>/);
  assert.match(result, /<ol><li>Choose a course<\/li><li>Contact us<\/li><\/ol>/);
  assert.match(result, /<ul><li>Bring ID<\/li><li>Bring forms<\/li><\/ul>/);
  for (let level = 1; level <= 6; level++) assert.equal(parseMarkdown('#'.repeat(level) + ' Heading'), `<h${level}>Heading</h${level}>`);
  assert.equal(parseMarkdown('Use C# and issue #123.'), '<p>Use C# and issue #123.</p>');
  assert.equal(parseMarkdown('3. Start here'), '<ol start="3"><li>Start here</li></ol>');
  assert.match(parseMarkdown('| Course | Level |\n| --- | --- |\n| **Maths** | 3 |'), /<td><strong>Maths<\/strong><\/td><td>3<\/td>/);
  assert(!parseMarkdown('a | b\nc | d').includes('<table>'));
  const unsafe = parseMarkdown('<img src=x onerror=alert(1)>\n\n[x](javascript:alert)\n\n[safe](https://example.edu/?a="onclick")');
  assert(!unsafe.includes('<img'));
  assert(!unsafe.includes('href="javascript:'));
  assert.match(unsafe, /rel="noopener noreferrer"/);
  assert.match(parseMarkdown('```html\n<script>alert(1)</script>\n```'), /&lt;script&gt;/);
  for (const count of [367, 400, 401]) {
    const text = Array.from({ length: count }, (_, i) => `word${i}`).join(' ');
    assert(parseMarkdown(text).endsWith(`word${count - 1}</p>`));
  }
  const { createChatScroll } = await load('js/ui/scroll.js');
  global.getComputedStyle = () => ({ paddingTop: '22px' });
  const paneListeners = {}, buttonListeners = {};
  let currentTop = 0;
  const pane = {
    scrollHeight: 1500, clientHeight: 400,
    get scrollTop() { return currentTop; },
    set scrollTop(value) { currentTop = Math.max(0, Math.min(value, this.scrollHeight - this.clientHeight)); },
    getBoundingClientRect: () => ({ top: 200 }),
    addEventListener: (name, fn) => { paneListeners[name] = fn; },
  };
  const button = { hidden: true, addEventListener: (name, fn) => { buttonListeners[name] = fn; } };
  const scroll = createChatScroll(pane, button);
  let focused = false;
  const article = { getBoundingClientRect: () => ({ top: 200 + 1522 - pane.scrollTop }), focus: () => { focused = true; } };
  scroll.bottom(); assert.equal(pane.scrollTop, 1100);
  scroll.begin(); pane.scrollHeight = 2600; scroll.answer(article);
  assert.equal(pane.scrollTop, 1500, 'long answer begins at pane padding');
  assert.equal(button.hidden, true);
  scroll.bottom(); scroll.begin();
  pane.scrollTop = 300; paneListeners.scroll();
  scroll.removeTyping({ remove() { pane.scrollHeight -= 40; } });
  pane.scrollHeight += 900; scroll.answer(article);
  assert.equal(pane.scrollTop, 300, 'reading older messages is preserved');
  assert.equal(button.hidden, false);
  buttonListeners.click(); assert.equal(pane.scrollTop, 1500); assert(focused); assert(button.hidden);
  scroll.bottom(); scroll.begin(); pane.scrollTop = 200; paneListeners.scroll();
  pane.scrollTop = pane.scrollHeight; paneListeners.scroll();
  scroll.answer(article); assert.equal(pane.scrollTop, 1500, 'returning to bottom resumes reveal');
  scroll.reset(); assert.equal(pane.scrollTop, 0); assert(button.hidden);
  console.log('PASS: Markdown headings, paragraphs, numbered lists, tables, safe HTML/links and complete 367/400/401-word rendering');
  console.log('PASS: answer-start positioning, reader preservation, New answer button, resume and reset');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
