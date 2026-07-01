// Produces a Chrome Web Store-ready zip from dist/ (manifest at the zip root).
// Run after `npm run build` (the `package` npm script does both).
import { execSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const out = `nocturne-v${pkg.version}.zip`

if (!existsSync(resolve(root, 'dist', 'manifest.json'))) {
  console.error('✖ dist/manifest.json not found. Run `npm run build` first.')
  process.exit(1)
}

if (existsSync(resolve(root, out))) rmSync(resolve(root, out))

// Zip the *contents* of dist/ so manifest.json sits at the archive root.
// -X drops extra macOS attributes; exclude dotfiles like .DS_Store.
execSync(`cd dist && zip -r -X "../${out}" . -x ".*" -x "**/.*"`, {
  stdio: 'inherit',
  shell: '/bin/bash',
})

console.log(`\n✓ Created ${out}`)
console.log('  Upload it at https://chrome.google.com/webstore/devconsole')
