// Produces a Firefox/AMO-ready zip: builds, swaps in the Gecko manifest
// (version kept in sync with package.json), and zips dist/.
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const out = `nocturne-firefox-v${pkg.version}.zip`

function hardenFirefoxBundle() {
  const assetsDir = resolve(root, 'dist', 'assets')
  if (!existsSync(assetsDir)) return

  for (const file of readdirSync(assetsDir)) {
    if (!file.endsWith('.js')) continue

    const path = resolve(assetsDir, file)
    let code = readFileSync(path, 'utf8')

    code = code
      .replace(
        /([A-Za-z_$][\w$]*)=([A-Za-z_$][\w$]*)\.createElement\("div"\),\1\.innerHTML="<script><\\\/script>",\1=\1\.removeChild\(\1\.firstChild\)/g,
        '$1=$2.createElement("script")',
      )
      .replace(
        /([A-Za-z_$][\w$]*)=\1\|\|document\.createElement\("div"\),\1\.innerHTML="<svg>"\+([A-Za-z_$][\w$]*)\.valueOf\(\)\.toString\(\)\+"<\/svg>",\2=\1\.firstChild/g,
        '$1=new DOMParser().parseFromString("<svg>"+$2.valueOf().toString()+"</svg>","image/svg+xml"),$2=$1.documentElement',
      )
      .replace(
        /([A-Za-z_$][\w$]*)\.innerHTML=([A-Za-z_$][\w$]*);/g,
        '$1.replaceChildren(document.createTextNode($2));',
      )

    if (/\.innerHTML\s*=/.test(code)) {
      console.error(`✖ Unsafe innerHTML assignment remains in dist/assets/${file}`)
      process.exit(1)
    }

    writeFileSync(path, code)
  }
}

if (!existsSync(resolve(root, 'dist', 'manifest.json'))) {
  console.error('✖ dist/ not built. Run `npm run build` first.')
  process.exit(1)
}

// Replace the Chrome manifest copied into dist/ with the Firefox one,
// forcing the version to match package.json so the two never drift.
const fox = JSON.parse(readFileSync(resolve(root, 'manifest.firefox.json'), 'utf8'))
fox.version = pkg.version
writeFileSync(resolve(root, 'dist', 'manifest.json'), JSON.stringify(fox, null, 2) + '\n')

hardenFirefoxBundle()

if (existsSync(resolve(root, out))) rmSync(resolve(root, out))

execSync(`cd dist && zip -r -X "../${out}" . -x ".*" -x "**/.*"`, {
  stdio: 'inherit',
  shell: '/bin/bash',
})

console.log(`\n✓ Created ${out}`)
console.log('  Upload it at https://addons.mozilla.org/developers/addon/submit/')
console.log('  Note: dist/manifest.json now holds the Firefox manifest — rerun')
console.log('  `npm run build` (or `npm run package`) before loading in Chrome.')
