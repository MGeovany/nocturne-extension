// Produces a Firefox/AMO-ready zip: builds, swaps in the Gecko manifest
// (version kept in sync with package.json), and zips dist/.
import { execSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const out = `nocturne-firefox-v${pkg.version}.zip`

if (!existsSync(resolve(root, 'dist', 'manifest.json'))) {
  console.error('✖ dist/ not built. Run `npm run build` first.')
  process.exit(1)
}

// Replace the Chrome manifest copied into dist/ with the Firefox one,
// forcing the version to match package.json so the two never drift.
const fox = JSON.parse(readFileSync(resolve(root, 'manifest.firefox.json'), 'utf8'))
fox.version = pkg.version
writeFileSync(resolve(root, 'dist', 'manifest.json'), JSON.stringify(fox, null, 2) + '\n')

if (existsSync(resolve(root, out))) rmSync(resolve(root, out))

execSync(`cd dist && zip -r -X "../${out}" . -x ".*" -x "**/.*"`, {
  stdio: 'inherit',
  shell: '/bin/bash',
})

console.log(`\n✓ Created ${out}`)
console.log('  Upload it at https://addons.mozilla.org/developers/addon/submit/')
console.log('  Note: dist/manifest.json now holds the Firefox manifest — rerun')
console.log('  `npm run build` (or `npm run package`) before loading in Chrome.')
