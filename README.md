# Spellbook

Every D&D 5e SRD spell in one searchable page: 319 from the 2014 rules and 339 from the 2024 rules. Filter by class, character level, spell level, school and casting type, read spells in a table or as cards, and share any filtered view by its URL.

**Live site:** https://chickengamer555.github.io/spellbook/

## Run it

```
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run build` | Builds the site into `dist/` |
| `npm run data` | Regenerates `src/data/` from the raw dumps in `data/raw/` |
| `npm run verify` | Builds, then runs the [web-harness](https://github.com/chickengamer555/web-harness) matrix on the build (expects the harness at its local path in `package.json`) |
| `npm run deploy` | Verifies, then publishes `dist/` to the `gh-pages` branch |

## Credits

This work includes material taken from the System Reference Document 5.1 ("SRD 5.1") and the System Reference Document 5.2 ("SRD 5.2") by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. The SRD 5.1 and SRD 5.2 are licensed under the [Creative Commons Attribution 4.0 International License](https://creativecommons.org/licenses/by/4.0/legalcode).

Spell data comes from [5e-bits/5e-database](https://github.com/5e-bits/5e-database) (MIT License, Copyright (c) 2018-2020 Adrian Padua, Christopher Ward), converted to this app's format by `scripts/build-data.mjs`.

This project is unofficial and is not affiliated with or endorsed by Wizards of the Coast.
