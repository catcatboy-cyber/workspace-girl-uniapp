const fs = require('fs')
const path = require('path')

const projectRoot = path.resolve(__dirname, '..')

const patches = [
  {
    file: path.join(projectRoot, 'node_modules', '@cloudbase', 'oauth', 'dist', 'esm', 'auth', 'apis.js'),
    replacements: [
      {
        from: [
          "            try {",
          "                const utils = await import('../utils/encrypt');",
          "                return utils;",
          "            }",
          "            catch (error) {",
          "                return;",
          "            }"
        ].join('\n'),
        to: "            return;"
      }
    ]
  },
  {
    file: path.join(projectRoot, 'node_modules', '@cloudbase', 'app', 'dist', 'esm', 'libs', 'adapter-node', 'tool.js'),
    replacements: [
      {
        from: [
          "                    return [4, import('jsonwebtoken')];",
          "                case 2:",
          "                    mod = _b.sent();"
        ].join('\n'),
        to: "                    mod = require('jsonwebtoken');"
      }
    ]
  },
  {
    file: path.join(projectRoot, 'node_modules', '@cloudbase', 'app', 'dist', 'esm', 'libs', 'adapter-node', 'request.js'),
    replacements: [
      {
        from: [
          "                    return [4, import('@cloudbase/signature-nodejs')];",
          "                case 2:",
          "                    mod = _a.sent();"
        ].join('\n'),
        to: "                    mod = require('@cloudbase/signature-nodejs');"
      }
    ]
  }
]

for (const patch of patches) {
  if (!fs.existsSync(patch.file)) {
    continue
  }

  let content = fs.readFileSync(patch.file, 'utf8')
  let changed = false

  for (const replacement of patch.replacements) {
    if (!content.includes(replacement.from)) {
      continue
    }
    content = content.replace(replacement.from, replacement.to)
    changed = true
  }

  if (changed) {
    fs.writeFileSync(patch.file, content, 'utf8')
    console.log(`[fix-cloudbase-app-build] patched ${path.relative(projectRoot, patch.file)}`)
  }
}
