import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  target: 'esnext',
  sourcemap: true,
  minify: false,
  keepNames: true,
  entry: ['src/index.ts'],
}); 