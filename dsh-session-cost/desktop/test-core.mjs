import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, writeFile, rm, stat as fsStat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import core from './resources/js/core.js'
const { createInstaller, toFileUrl, joinPath } = core

const here = dirname(fileURLToPath(import.meta.url))
const resources = {
  '/resources/plugin/package.json': join(here, '..', 'package.json'),
  '/resources/plugin/lib/index.js': join(here, '..', 'lib', 'index.js'),
  '/resources/plugin/lib/client.js': join(here, '..', 'lib', 'client.js')
}

function deps(root, platform = 'Linux') {
  return {
    platform,
    now: () => new Date('2026-01-02T03:04:05'),
    env: async () => '',
    home: async () => root,
    stat: async (path) => {
      try {
        const s = await fsStat(path)
        return { isDirectory: s.isDirectory(), isFile: s.isFile() }
      } catch {
        return null
      }
    },
    readFile: (path) => readFile(path, 'utf8'),
    writeFile: (path, data) => writeFile(path, data, 'utf8'),
    mkdir: (path) => mkdir(path, { recursive: true }),
    remove: (path) => rm(path, { recursive: true, force: true }),
    readResource: async (path) => readFile(resources[path], 'utf8')
  }
}

assert.equal(toFileUrl('Linux', '/home/me/.dsh/plugins/x/lib/index.js'), 'file:///home/me/.dsh/plugins/x/lib/index.js')
assert.equal(toFileUrl('Windows', 'C:\\Users\\A B\\.dsh\\plugins\\x\\lib\\index.js'), 'file:///C:/Users/A%20B/.dsh/plugins/x/lib/index.js')
assert.equal(joinPath('Windows', ['C:\\Users\\me', '.dsh']), 'C:\\Users\\me\\.dsh')

const root = await mkdtemp(join(tmpdir(), 'dsh-cost-'))
const dshHome = join(root, 'dsh home')
const profileDir = join(dshHome, 'profiles', 'web')
await mkdir(profileDir, { recursive: true })
const patch = join(profileDir, 'cordis.patch.yml')
const original = '# keep me\n- id: other\n  name: "@example/other"\n'
await writeFile(patch, original, 'utf8')

const installer = createInstaller(deps(root))
let info = await installer.inspect('web', dshHome)
assert.equal(info.profileExists, true)
assert.equal(info.installed, false)

let result = await installer.install('web', dshHome)
assert.ok(result.entry.startsWith('file:///'))
const installedPatch = await readFile(patch, 'utf8')
assert.match(installedPatch, /# keep me/)
assert.match(installedPatch, /- id: other/)
assert.match(installedPatch, /# >>> dsh-session-cost \(managed\) >>>/)
assert.equal(installedPatch.match(/>>> dsh-session-cost/g).length, 1)
assert.ok(installedPatch.includes(result.entry))
assert.ok(await readFile(join(dshHome, 'plugins', 'dsh-session-cost', 'lib', 'client.js'), 'utf8'))

await installer.install('web', dshHome)
const reinstalled = await readFile(patch, 'utf8')
assert.equal(reinstalled.match(/>>> dsh-session-cost/g).length, 1)

info = await installer.inspect('web', dshHome)
assert.equal(info.installed, true)

result = await installer.uninstall('web', dshHome)
assert.equal(result.removedEntry, true)
assert.equal(result.removedPlugin, true)
const restored = await readFile(patch, 'utf8')
assert.equal(restored, original)
assert.equal(await installer.inspect('web', dshHome).then((x) => x.installed), false)

await assert.rejects(() => installer.install('missing', dshHome), /was not found/)
await assert.rejects(() => installer.install('../escape', dshHome), /may contain only/)

const emptyHome = join(root, 'empty home')
const emptyProfile = join(emptyHome, 'profiles', 'tui')
await mkdir(emptyProfile, { recursive: true })
await writeFile(join(emptyProfile, 'cordis.patch.yml'), '[]\n', 'utf8')
await createInstaller(deps(root)).install('tui', emptyHome)
const emptyPatch = await readFile(join(emptyProfile, 'cordis.patch.yml'), 'utf8')
assert.ok(emptyPatch.trimStart().startsWith('# >>> dsh-session-cost'))
assert.ok(!/^\[\]$/m.test(emptyPatch))

await rm(root, { recursive: true, force: true })
console.log('core tests passed')
