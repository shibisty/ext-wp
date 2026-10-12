/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { buildManifest, type Target } from './src/manifest';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

function manifestPlugin(target: Target): Plugin {
  return {
    name: 'extension-manifest',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(buildManifest(target, pkg.version), null, 2) + '\n',
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const target: Target = mode === 'firefox' ? 'firefox' : 'chrome';
  return {
    root: resolve(__dirname, 'src'),
    base: '',
    publicDir: false,
    plugins: [manifestPlugin(target)],
    build: {
      outDir: resolve(__dirname, 'dist', target),
      emptyOutDir: true,
      target: 'es2022',
      // Readable output: easier to debug in the browser and what AMO reviewers prefer.
      minify: false,
      modulePreload: false,
      rollupOptions: {
        input: {
          sidebar: resolve(__dirname, 'src/sidebar/index.html'),
          background: resolve(__dirname, 'src/background/index.ts'),
        },
        output: {
          // The manifest references background.js by a fixed name.
          entryFileNames: (chunk) => (chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js'),
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]',
        },
      },
    },
    test: {
      root: __dirname,
      environment: 'jsdom',
      include: ['tests/**/*.test.ts'],
      setupFiles: ['tests/setup.ts'],
    },
  };
});
