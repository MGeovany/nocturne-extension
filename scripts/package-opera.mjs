// Produces an Opera Add-ons-ready zip from dist/.
// Opera accepts Chromium extension packages with manifest.json at the archive root.
import { execSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const out = `nocturne-opera-v${pkg.version}.zip`

if (!existsSync(resolve(root, 'dist', 'manifest.json'))) {
  console.error('✖ dist/manifest.json not found. Run `npm run build` first.')
  process.exit(1)
}

if (existsSync(resolve(root, out))) rmSync(resolve(root, out))

// Zip the *contents* of dist/ so manifest.json sits at the archive root.
execSync(`cd dist && zip -r -X "../${out}" . -x ".*" -x "**/.*"`, {
  stdio: 'inherit',
  shell: '/bin/bash',
})

console.log(`\n✓ Created ${out}`)
console.log('  Upload it at https://addons.opera.com/developer/')
