import { defineConfig } from 'vite';
export default defineConfig({base:'./',build:{outDir:'dist',emptyOutDir:true},worker:{format:'es'},server:{host:'127.0.0.1'}});
