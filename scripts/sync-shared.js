#!/usr/bin/env node
/**
 * Sync _shared/*.js (and .json) into every cloud function dir's _shared/ subfolder.
 * Run before `cloudbase fn deploy --all --force`.
 *
 * Usage:
 *   node scripts/sync-shared.js              # sync all
 *   node scripts/sync-shared.js --dry-run    # show what would change, don't write
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const FN_ROOT = path.join(ROOT, 'cloudfunctions')
const SHARED_SRC = path.join(FN_ROOT, '_shared')
const DRY_RUN = process.argv.includes('--dry-run')

const SHARED_FILES = fs.readdirSync(SHARED_SRC).filter(f => f.endsWith('.js') || f.endsWith('.json'))

const SKIP_DIRS = new Set(['_shared'])

function filesEqual(a, b) {
  if (!fs.existsSync(b)) return false
  return fs.readFileSync(a).equals(fs.readFileSync(b))
}

function syncOne(targetFnDir) {
  const dst = path.join(targetFnDir, '_shared')
  const name = path.basename(targetFnDir)
  const changes = []

  // Check for extra files in dst that aren't in canonical
  if (fs.existsSync(dst)) {
    const dstFiles = fs.readdirSync(dst)
    for (const f of dstFiles) {
      if (!SHARED_FILES.includes(f)) {
        changes.push({ type: 'extra', file: f })
      }
    }
  }

  // Check canonical files against dst
  for (const file of SHARED_FILES) {
    const src = path.join(SHARED_SRC, file)
    const dest = path.join(dst, file)
    if (!filesEqual(src, dest)) {
      changes.push({
        type: fs.existsSync(dest) ? 'updated' : 'new',
        file: file,
        size: fs.statSync(src).size
      })
    }
  }

  if (changes.length === 0) return { name, synced: false, changes: [] }

  if (!DRY_RUN) {
    fs.mkdirSync(dst, { recursive: true })
    for (const change of changes) {
      if (change.type === 'extra') continue
      fs.copyFileSync(path.join(SHARED_SRC, change.file), path.join(dst, change.file))
    }
  }

  return { name, synced: true, changes }
}

const fns = fs.readdirSync(FN_ROOT, { withFileTypes: true })
  .filter(e => e.isDirectory() && !SKIP_DIRS.has(e.name))
  .map(e => e.name)

let synced = 0
let skipped = 0
const extraReport = []

for (const name of fns) {
  const result = syncOne(path.join(FN_ROOT, name))
  if (result.synced) {
    synced++
    const labels = result.changes.map(c => {
      if (c.type === 'extra') return `${c.file}(extra)`
      if (c.type === 'new') return `+${c.file}(${c.size}B)`
      return `~${c.file}(${c.size}B)`
    })
    console.log(`[sync] ${name}: ${labels.join(' ')}`)
    const extras = result.changes.filter(c => c.type === 'extra')
    if (extras.length) extraReport.push({ fn: name, extras: extras.map(e => e.file) })
  } else {
    skipped++
  }
}

if (DRY_RUN) {
  console.log(`\n[DRY RUN] Would sync ${synced} function(s), ${skipped} already up to date.`)
} else {
  console.log(`\nDone. Synced ${synced} function(s), ${skipped} already up to date.`)
}

if (extraReport.length) {
  console.log('\nExtra files present in function _shared/ (not in canonical; left untouched):')
  for (const item of extraReport) {
    console.log(`  ${item.fn}: ${item.extras.join(', ')}`)
  }
}
