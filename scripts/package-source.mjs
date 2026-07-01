// Produces a source-code zip for AMO review (required because the uploaded
// build is bundled/minified). Excludes build output, deps, and archives.
import { execSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const out = `nocturne-source-v${pkg.version}.zip`

if (existsSync(resolve(root, out))) rmSync(resolve(root, out))

// Keep dotfiles the reviewer needs (.nvmrc, .gitignore, .github); only drop
// build output, deps, archives, VCS internals and OS cruft.
execSync(
  `zip -r -X "${out}" . ` +
    `-x "node_modules/*" -x "dist/*" -x "*.zip" -x ".git/*" ` +
    `-x "**/.DS_Store" -x ".DS_Store"`,
  { stdio: 'inherit', shell: '/bin/bash' },
)

console.log(`\n✓ Created ${out}`)
console.log('  Upload this in the AMO "source code" field. Build: Node 20,')
console.log('  `npm install` then `npm run build` → output in dist/.')
