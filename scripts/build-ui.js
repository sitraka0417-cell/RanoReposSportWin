// Assemble l'interface (src/ + Firebase) en un seul fichier : renderer/app.bundle.js
const esbuild = require('esbuild');

esbuild
  .build({
    entryPoints: ['src/app.js'],
    bundle: true,
    outfile: 'renderer/app.bundle.js',
    format: 'iife',
    platform: 'browser',
    target: 'chrome120',
    minify: true,
    legalComments: 'none',
    logLevel: 'info'
  })
  .catch(() => process.exit(1));
