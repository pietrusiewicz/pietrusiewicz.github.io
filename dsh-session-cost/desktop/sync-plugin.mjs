import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const source = join(here, '..')
const target = join(here, 'resources', 'plugin')

await rm(target, { recursive: true, force: true })
await mkdir(join(target, 'lib'), { recursive: true })
await cp(join(source, 'package.json'), join(target, 'package.json'))
await cp(join(source, 'lib', 'client.js'), join(target, 'lib', 'client.js'))
await cp(join(source, 'lib', 'index.js'), join(target, 'lib', 'index.js'))
console.log('synced plugin sources into resources/plugin')
