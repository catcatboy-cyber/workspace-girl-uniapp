const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function walkDir(dir, files = []) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== 'dist' && entry.name !== '.git') {
      walkDir(p, files);
    } else if (entry.name.endsWith('.vue')) {
      files.push(p);
    }
  }
  return files;
}

const srcDir = 'src';
const files = walkDir(srcDir);
let totalFiles = 0;
let totalChanges = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let fileChanges = 0;

  // Extract template section
  const tplMatch = content.match(/(<template[\s\S]*?>)([\s\S]*?)(<\/template>)/i);
  if (!tplMatch) continue;

  let tpl = tplMatch[2];

  // Pattern 1: >Token<  or  > Token<  (bare text in tags)
  // Match "Token" when surrounded by Chinese characters, or at tag boundaries
  const replacements = [
    // Between Chinese char and Chinese char/punctuation
    [/([一-鿿])Token([一-鿿，。！？、；：""''）\)】』\s])/g, '$1Credits$2'],
    // After Chinese char at end of text node
    [/([一-鿿])Token\s*</g, '$1Credits<'],
    // At start of text node before Chinese
    [/>(Token[一-鿿])/g, '>Credits$1'.replace('$1', '$1').replace('Token', '')],
    // standalone "Token" as a whole text node: >Token</
    [/>Token<\//g, '>Credits</'],
    // placeholder with Token
    [/placeholder="Token"/g, 'placeholder="Credits"'],
    // Token followed by space and Chinese
    [/>Token ([一-鿿])/g, '>Credits $1'],
    // Token preceded by Chinese and space
    [/([一-鿿]) Token</g, '$1 Credits<'],
  ];

  let newTpl = tpl;
  for (const [pattern, replacement] of replacements) {
    const before = newTpl;
    newTpl = newTpl.replace(pattern, replacement);
    if (newTpl !== before) fileChanges++;
  }

  if (newTpl !== tpl) {
    content = content.replace(tpl, newTpl);
    fs.writeFileSync(file, content, 'utf8');
    totalFiles++;
    totalChanges += fileChanges;
    console.log(file + ' (' + fileChanges + ' changes)');
  }
}

console.log('\nTotal: ' + totalFiles + ' files, ' + totalChanges + ' replacements');
