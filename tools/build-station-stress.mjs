import { build } from 'vite';
await build({
  build: {
    outDir: 'work/s4/stress-dist',
    rollupOptions: { input: 'tests/fixtures/station-stress.html' },
  },
});
