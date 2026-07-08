import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://finaledge.mx',
  output: 'static',
  build: {
    inlineStylesheets: 'auto',
  },
});
