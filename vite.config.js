import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const entry = (name) => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  build: {
    assetsDir: 'showcase-bundle',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      input: {
        blog: entry('index.html'),
        course: entry('showcase-course.html'),
        simulator: entry('simulator.html'),
      },
    },
  },
});
