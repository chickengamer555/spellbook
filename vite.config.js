import { defineConfig } from 'vite';

// Relative asset URLs, because GitHub Pages serves the site from /spellbook/ rather than the domain root.
export default defineConfig({ base: './' });
