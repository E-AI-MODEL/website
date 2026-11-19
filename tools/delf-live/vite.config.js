import { defineConfig } from 'vite';
export default defineConfig({base:'./', build:{outDir:'dist',emptyOutDir:true,rollupOptions:{input:{stage:new URL('./index.html',import.meta.url).pathname,mobile:new URL('./mobile-preview.html',import.meta.url).pathname}}},worker:{format:'es'}, server:{host:'127.0.0.1'}});
