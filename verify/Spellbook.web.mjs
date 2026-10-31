// Glue for Spellbook: mounts the real dist/ build, so the matrix tests what Pages serves.
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));
const built = () => readFileSync(dist + 'index.html', 'utf8');
let mounts = 0;

export default {
  async mount(container, props) {
    const html = built();
    container.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];
    window.history.replaceState(null, '', '#' + props.hash);
    // main.js reads these as bare globals; the adapter only installs the DOM ones.
    Object.assign(globalThis, {
      location: window.location,
      history: window.history,
      innerHeight: window.innerHeight,
      innerWidth: window.innerWidth,
      addEventListener: window.addEventListener.bind(window),
      MutationObserver: window.MutationObserver,
      matchMedia: () => ({ matches: false }),
    });
    const js = html.match(/<script[^>]+src="([^"]+)"/)[1].replace(/^\.?\//, '');
    // The query re-runs the module's top level for each fixture's fresh page.
    await import(pathToFileURL(dist + js).href + '?mount=' + mounts++);
  },

  codeChecks: {
    'rows-match-count': ({ root }) => {
      const claimed = root.querySelector('[data-verify-count]')?.getAttribute('data-verify-count');
      const rows = root.querySelectorAll('table.spells tbody tr').length;
      return String(rows) === claimed ? true : `count says ${claimed} but the table has ${rows} rows`;
    },
    'assets-relative': () => {
      const urls = [...built().matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
      const bad = urls.filter((u) => !u.startsWith('./'));
      if (!urls.length) return 'found no JS or CSS references in dist/index.html';
      return bad.length ? 'absolute asset URLs 404 under /spellbook/: ' + bad.join(', ') : true;
    },
  },

  acts: {
    'pick-wizard': async ({ click }) => { await click('[data-class="Wizard"]'); },
  },
};
