// Produces a zip of the Safari Web Extension resources from dist-safari/.
// The Xcode wrapper in safari-app/ references dist-safari/ directly for local
// development; this archive is useful for handoff/review of the web resources.
import { execSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const out = `nocturne-safari-v${pkg.version}.zip`
const manifestPath = resolve(root, 'dist-safari', 'manifest.json')

if (!existsSync(manifestPath)) {
  console.error('✖ dist-safari/manifest.json not found. Run `npm run build:safari` first.')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.version = pkg.version
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')

if (existsSync(resolve(root, out))) rmSync(resolve(root, out))

// Zip the *contents* of dist-safari/ so manifest.json sits at the archive root.
execSync(`cd dist-safari && zip -r -X "../${out}" . -x ".*" -x "**/.*"`, {
  stdio: 'inherit',
  shell: '/bin/bash',
})

console.log(`\n✓ Created ${out}`)
console.log('  Xcode project: safari-app/nocturne/nocturne.xcodeproj')
