import { build } from 'vite';
await build({
  build: {
    outDir: 'work/s2/stress-dist',
    rollupOptions: { input: 'tests/fixtures/station-stress.html' },
  },
});
