/**
 * Pet smoke tests — node tests/pet-smoke.cjs
 * Verifies: spritesheet assets, avatar PNGs, build outputs, no dead component refs.
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

// ── 1. Source assets ──────────────────────────────────────────
console.log('\n── Source assets ──')

const pets = [
  { id: 'xiaomi', hasSpritesheet: false },
  { id: 'doggo', hasSpritesheet: false, hasManifest: false } // cloud-hosted, no local spritesheet or manifest
]

for (const pet of pets) {
  const petDir = path.join(ROOT, 'src', 'static', 'pets', pet.id)
  test(`${pet.id}: pet directory exists`, () => {
    assert.ok(dirExists(petDir))
  })

  test(`${pet.id}: avatar.png exists`, () => {
    const avatar = path.join(petDir, 'avatar.png')
    assert.ok(fileExists(avatar), 'avatar.png missing')
    const stat = fs.statSync(avatar)
    assert.ok(stat.size > 1000, `avatar.png too small: ${stat.size} bytes`)
  })

  if (pet.hasSpritesheet) {
    test(`${pet.id}: spritesheet.webp exists`, () => {
      const ss = path.join(petDir, 'spritesheet.webp')
      assert.ok(fileExists(ss), 'spritesheet.webp missing')
      const stat = fs.statSync(ss)
      assert.ok(stat.size > 100000, `spritesheet too small: ${stat.size} bytes`)
    })
  } else {
    test(`${pet.id}: spritesheet.webp is not bundled`, () => {
      assert.ok(!fileExists(path.join(petDir, 'spritesheet.webp')), 'spritesheet.webp should be cloud-hosted')
    })
  }

  if (pet.hasManifest !== false) {
    test(`${pet.id}: manifest.json exists and valid`, () => {
      const m = JSON.parse(fs.readFileSync(path.join(petDir, 'manifest.json'), 'utf8'))
      assert.equal(m.name, pet.id)
      assert.equal(m.renderer, 'spritesheet')
      assert.equal(typeof m.cellWidth, 'number')
      assert.equal(typeof m.cellHeight, 'number')
      assert.equal(typeof m.columns, 'number')
      assert.equal(typeof m.rows, 'number')
    })
  }
}

// ── 2. Build outputs ─────────────────────────────────────────
console.log('\n── Build outputs ──')
const targets = [
  { name: 'h5', dir: path.join(ROOT, 'dist', 'build', 'h5') },
  { name: 'mp-weixin', dir: path.join(ROOT, 'dist', 'build', 'mp-weixin') }
]

for (const t of targets) {
  const d = t.dir
  if (!dirExists(d)) { console.log(`  SKIP ${t.name}: not built yet`); continue }
  if (t.name === 'h5') continue // H5 is admin-only, skip pet asset checks

  for (const pet of pets) {
    test(`${t.name}: ${pet.id} avatar.png copied`, () => {
      assert.ok(fileExists(path.join(d, 'static', 'pets', pet.id, 'avatar.png')))
    })

    if (pet.hasManifest !== false) {
      test(`${t.name}: ${pet.id} manifest.json copied`, () => {
        const m = JSON.parse(fs.readFileSync(path.join(d, 'static', 'pets', pet.id, 'manifest.json'), 'utf8'))
        assert.equal(m.name, pet.id)
      })
    }

    if (pet.hasSpritesheet) {
      test(`${t.name}: ${pet.id} spritesheet.webp copied`, () => {
        assert.ok(fileExists(path.join(d, 'static', 'pets', pet.id, 'spritesheet.webp')))
      })
    } else {
      test(`${t.name}: ${pet.id} spritesheet.webp not bundled`, () => {
        assert.ok(!fileExists(path.join(d, 'static', 'pets', pet.id, 'spritesheet.webp')), `${pet.id} spritesheet should be cloud-hosted`)
      })
    }
  }

  if (t.name === 'mp-weixin') {
    test(`${t.name}: no XiaomiPet component ref in index.json`, () => {
      const j = JSON.parse(fs.readFileSync(path.join(d, 'pages', 'index', 'index.json'), 'utf8'))
      assert.ok(!('xiaomi-pet' in (j.usingComponents || {})), 'xiaomi-pet should not be in index.json')
    })

    test(`${t.name}: no XiaomiPet.js component`, () => {
      assert.ok(!fileExists(path.join(d, 'components', 'XiaomiPet.js')), 'XiaomiPet.js should not exist')
    })

    test(`${t.name}: pets.js references avatar path`, () => {
      const js = fs.readFileSync(path.join(d, 'utils', 'pets.js'), 'utf8')
      assert.ok(js.includes('avatarPath'), 'pets.js missing avatarPath')
    })

    test(`${t.name}: custom-tab-bar files present`, () => {
      const ctb = path.join(d, 'custom-tab-bar')
      assert.ok(dirExists(ctb), 'custom-tab-bar dir missing')
      for (const f of ['index.js', 'index.json', 'index.wxml', 'index.wxss']) {
        assert.ok(fileExists(path.join(ctb, f)), `custom-tab-bar/${f} missing`)
      }
    })
  }
}

// ── 3. No dead components / stale files ─────────────────────
console.log('\n── Cleanliness ──')
const deadFiles = [
  'src/components/XiaomiPet.vue',
  'src/utils/pet-lines.ts',
  'src/utils/pet-anim.ts',
  'src/static/pets/xiaomi/frames',
  'src/static/pets/doggo/frames'
]
for (const f of deadFiles) {
  test(`dead file removed: ${f}`, () => {
    assert.ok(!fileExists(path.join(ROOT, f)) && !dirExists(path.join(ROOT, f)), `${f} should not exist`)
  })
}

// unused tabbar SVGs
const tabbarSvgFiles = ['home', 'home-active', 'me', 'me-active', 'cases', 'cases-active', 'new', 'new-active']
for (const name of tabbarSvgFiles) {
  test(`unused tabbar SVG removed: ${name}.svg`, () => {
    assert.ok(!fileExists(path.join(ROOT, 'src', 'static', 'tabbar', `${name}.svg`)), `${name}.svg should be deleted`)
  })
}

const unusedTabbarPngs = ['cases.png', 'cases-active.png']
for (const name of unusedTabbarPngs) {
  test(`unused tabbar PNG removed: ${name}`, () => {
    assert.ok(!fileExists(path.join(ROOT, 'src', 'static', 'tabbar', name)), `${name} should be deleted`)
  })
}

// ── 4. Frontend build smoke ─────────────────────────────────
console.log('\n── Build integrity ──')
test('mp-weixin app.json has custom tabBar', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'build', 'mp-weixin', 'app.json'), 'utf8'))
  assert.equal(appJson.tabBar.custom, true)
  assert.equal(appJson.tabBar.list[0].text, '今日')
  assert.equal(appJson.tabBar.list[2].text, 'Crushes')
  assert.equal(appJson.tabBar.list[4].text, '我')
})

test('pages.json has custom-pet route', () => {
  const pj = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'pages.json'), 'utf8'))
  const routes = pj.pages.map(p => p.path)
  assert.ok(routes.includes('pages/custom-pet/custom-pet'))
})

test('customPet cloud function exists', () => {
  assert.ok(fileExists(path.join(ROOT, 'cloudfunctions', 'customPet', 'index.js')))
  assert.ok(fileExists(path.join(ROOT, 'cloudfunctions', 'customPet', 'package.json')))
})

// ── Summary ──────────────────────────────────────────────────
console.log(`\n${pass} passed, ${fail} failed, ${pass + fail} total`)
if (fail > 0) {
  console.error(`${fail} test(s) FAILED`)
  process.exit(1)
}
console.log('All pet smoke tests passed.\n')
