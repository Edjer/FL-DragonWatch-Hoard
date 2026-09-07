import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const target = process.env.BROWSER_TARGET === 'chromium' ? 'chromium' : 'firefox';
const root = resolve(dirname(fileURLToPath(import.meta.url)));
const contentBuild = process.env.BUILD_EXTENSION_CONTENT === 'true';
const input: Record<string, string> = contentBuild
  ? { content: 'src/content/index.ts' }
  : {
      background: 'src/background/index.ts',
      popup: 'src/popup/index.html',
    };

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: { '@': resolve(root, 'src') },
  },
  build: {
    outDir: `dist/${target}`,
    emptyOutDir: !contentBuild,
    sourcemap: true,
    minify: mode === 'production' ? 'esbuild' : false,
    rollupOptions: {
      input,
      output: {
        format: contentBuild ? 'iife' : 'es',
        inlineDynamicImports: contentBuild,
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name][extname]',
      },
    },
  },
}));
