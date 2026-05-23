/**
 * Xiaomi Pet smoke tests — run with: node tests/pet-smoke.cjs
 * Verifies: assets, manifest, build outputs, no broken component refs.
 */
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
let pass = 0; let fail = 0

function test(name, fn) {
  try { fn(); pass++; console.log(`  PASS ${name}`) }
  catch (e) { fail++; console.error(`  FAIL ${name}: ${e.message}`) }
}

function dirExists(p) { return fs.existsSync(p) && fs.statSync(p).isDirectory() }
function fileExists(p) { return fs.existsSync(p) && fs.statSync(p).isFile() }
function countFiles(dir) { return fs.readdirSync(dir).filter(f => f.endsWith('.png')).length }

// ── 1. Source assets ──────────────────────────────────────────
console.log('\n── Source assets ──')
const framesDir = path.join(ROOT, 'src', 'static', 'pets', 'xiaomi', 'frames')
test('frames directory exists', () => { assert.ok(dirExists(framesDir)) })

const states = ['idle','waiting','review','jumping','failed','waving','running','running-left','running-right']
const expectedCounts = { idle:6, waiting:6, review:6, jumping:5, failed:8, waving:4, running:6, 'running-left':8, 'running-right':8 }

for (const s of states) {
  test(`frames/${s}/ has ${expectedCounts[s]} PNGs`, () => {
    const d = path.join(framesDir, s)
    assert.ok(dirExists(d))
    const n = countFiles(d)
    assert.equal(n, expectedCounts[s], `got ${n}`)
    for (let i = 0; i < n; i++) {
      const f = path.join(d, `${String(i).padStart(2,'0')}.png`)
      assert.ok(fileExists(f), `missing ${String(i).padStart(2,'0')}.png`)
    }
  })
}

test('manifest.json exists and valid', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'static', 'pets', 'xiaomi', 'manifest.json'), 'utf8'))
  assert.equal(m.name, 'xiaomi')
  assert.equal(typeof m.basePath, 'string')
  assert.ok(!m.basePath.includes(':\\'), 'basePath must not be absolute')
  for (const s of states) {
    assert.ok(m.states[s], `missing state ${s}`)
    assert.equal(m.states[s].frames, expectedCounts[s], `frame count mismatch for ${s}`)
  }
})

// ── 2. Build outputs ─────────────────────────────────────────
console.log('\n── Build outputs ──')
const targets = [
  { name: 'h5', dir: path.join(ROOT, 'dist', 'build', 'h5') },
  { name: 'mp-weixin', dir: path.join(ROOT, 'dist', 'build', 'mp-weixin') }
]

for (const t of targets) {
  const d = t.dir
  if (!dirExists(d)) { console.log(`  SKIP ${t.name}: not built yet`); continue }

  test(`${t.name}: pet assets in static/`, () => {
    assert.ok(dirExists(path.join(d, 'static', 'pets', 'xiaomi', 'frames', 'idle')))
  })

  test(`${t.name}: manifest.json copied`, () => {
    const m = JSON.parse(fs.readFileSync(path.join(d, 'static', 'pets', 'xiaomi', 'manifest.json'), 'utf8'))
    assert.equal(m.name, 'xiaomi')
  })

  if (t.name === 'mp-weixin') {
    test(`${t.name}: no XiaomiPet component reference in index.json`, () => {
      const j = JSON.parse(fs.readFileSync(path.join(d, 'pages', 'index', 'index.json'), 'utf8'))
      assert.ok(!('xiaomi-pet' in (j.usingComponents || {})), 'xiaomi-pet should not be in index.json')
    })
    test(`${t.name}: pet image path in compiled index.js`, () => {
      const js = fs.readFileSync(path.join(d, 'pages', 'index', 'index.js'), 'utf8')
      assert.ok(js.includes('/static/pets/xiaomi/frames/'), 'pet image path not found')
    })
    test(`${t.name}: no separate XiaomiPet.js component`, () => {
      assert.ok(!fileExists(path.join(d, 'components', 'XiaomiPet.js')), 'XiaomiPet.js should not exist')
    })
  }
  if (t.name === 'h5') {
    test(`${t.name}: pet frames served from static/`, () => {
      assert.ok(dirExists(path.join(d, 'static', 'pets', 'xiaomi', 'frames', 'idle')))
    })
  }
}

// ── 3. Frame naming convention ───────────────────────────────
console.log('\n── Frame naming ──')
test('all frames follow NN.png format', () => {
  for (const s of states) {
    const files = fs.readdirSync(path.join(framesDir, s))
    for (const f of files) {
      assert.match(f, /^\d{2}\.png$/, `${s}/${f} should be NN.png`)
    }
  }
})

// ── 4. No stale files ────────────────────────────────────────
console.log('\n── Cleanliness ──')
const staleFiles = [
  'src/utils/pet-lines.ts',
  'src/utils/pet-anim.ts'
]
for (const f of staleFiles) {
  test(`stale file removed: ${f}`, () => {
    assert.ok(!fileExists(path.join(ROOT, f)), `${f} should be deleted`)
  })
}

// ── Summary ──────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total`)
if (fail > 0) {
  console.error(`${fail} test(s) FAILED`)
  process.exit(1)
}
console.log('All pet smoke tests passed.\n')
