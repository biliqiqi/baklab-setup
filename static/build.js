import * as esbuild from 'esbuild'
import * as fs from 'fs'
import * as path from 'path'

const isWatch = process.argv.includes('--watch')

// Clean dist directory
if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true })
}
fs.mkdirSync('dist', { recursive: true })

// Copy static assets
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return

  const stat = fs.statSync(src)
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true })
    const entries = fs.readdirSync(src)
    for (const entry of entries) {
      copyRecursive(path.join(src, entry), path.join(dest, entry))
    }
  } else {
    fs.copyFileSync(src, dest)
  }
}

// Copy public files (i18n, images, etc.)
console.log('Copying static assets...')
copyRecursive('public', 'dist')

// Copy images and icons
const images = ['favicon.ico', 'logo-icon.png', 'github-mark.png', 'google.webp']
images.forEach(img => {
  if (fs.existsSync(img)) {
    fs.copyFileSync(img, path.join('dist', img))
  }
})

// Copy steps directory if it exists in public
if (fs.existsSync('public/steps')) {
  copyRecursive('public/steps', 'dist/steps')
} else if (fs.existsSync('src/js/steps')) {
  // Steps are bundled in main.js, no need to copy
  console.log('Steps are bundled into app.js')
}

// esbuild configuration
const buildOptions = {
  entryPoints: ['src/js/main.js'],
  bundle: true,
  minify: true,
  sourcemap: false,
  target: 'es2020',
  outfile: 'dist/app.js',
  format: 'esm',
}

const cssOptions = {
  entryPoints: ['src/css/styles.css'],
  bundle: true,
  minify: true,
  outfile: 'dist/styles.css',
}

async function build() {
  try {
    console.log('Building JavaScript...')
    await esbuild.build(buildOptions)

    console.log('Building CSS...')
    await esbuild.build(cssOptions)

    console.log('✓ Build complete!')

    // Show output sizes
    const jsSize = (fs.statSync('dist/app.js').size / 1024).toFixed(2)
    const cssSize = (fs.statSync('dist/styles.css').size / 1024).toFixed(2)
    console.log(`  app.js: ${jsSize} KB`)
    console.log(`  styles.css: ${cssSize} KB`)
  } catch (error) {
    console.error('Build failed:', error)
    process.exit(1)
  }
}

if (isWatch) {
  console.log('Watching for changes...')
  const jsContext = await esbuild.context(buildOptions)
  const cssContext = await esbuild.context(cssOptions)
  await jsContext.watch()
  await cssContext.watch()
} else {
  await build()
}
