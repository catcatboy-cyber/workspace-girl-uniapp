#!/usr/bin/env node
/**
 * Sync _shared/*.js into every cloud function dir as a `_shared/` subfolder.
 * Run before `cloudbase fn deploy --all --force`.
 *
 * Usage: node scripts/sync-shared.js
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const FN_ROOT = path.join(ROOT, 'cloudfunctions')
const SHARED_SRC = path.join(FN_ROOT, '_shared')

const SHARED_FILES = fs.readdirSync(SHARED_SRC).filter(f => f.endsWith('.js'))

const SKIP_DIRS = new Set(['_shared'])

function copyShared(targetFnDir) {
  const dst = path.join(targetFnDir, '_shared')
  fs.mkdirSync(dst, { recursive: true })
  for (const file of SHARED_FILES) {
    fs.copyFileSync(path.join(SHARED_SRC, file), path.join(dst, file))
  }
}

const fns = fs.readdirSync(FN_ROOT, { withFileTypes: true })
  .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
  .map(e => e.name)

for (const name of fns) {
  copyShared(path.join(FN_ROOT, name))
  console.log(`[sync] ${name} <- _shared/ (${SHARED_FILES.length} files)`)
}

console.log(`Done. Synced shared into ${fns.length} cloud function(s).`)
