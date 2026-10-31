// Converts the raw 5e-bits SRD dumps in data/raw/ into the compact shape the app renders.
// Run with `npm run data`. Output: src/data/spells-2014.json, src/data/spells-2024.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const ABILITIES = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
const ABBR = { STR: 'Strength', DEX: 'Dexterity', CON: 'Constitution', INT: 'Intelligence', WIS: 'Wisdom', CHA: 'Charisma' };

// 2024 reactions carry their trigger in the casting time; keep the short form for the table.
function shortCast(t) {
  const head = t.split(',')[0].trim();
  return head.replace(/^1 (action|bonus action|reaction)/i, '$1').replace(/^(\w)/, (c) => c.toUpperCase())
    .replace(/^Bonus action/, 'Bonus Action');
}

// A short summary: whole sentences until it says something useful, capped.
function summarise(paras) {
  const text = paras.filter((p) => !p.startsWith('|') && !/^(Using a Higher-Level Spell Slot|Cantrip Upgrade)\./.test(p)).join(' ').replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
  const sentences = text.match(/[^.!?]+[.!?]+(\s|$)/g) || [text];
  let out = '';
  for (const s of sentences) {
    if (out && (out.length + s.length > 230)) break;
    out += s;
    if (out.length >= 110) break;
  }
  return out.trim() || text.slice(0, 200);
}

function findSave(text) {
  const m = text.match(new RegExp(`(${ABILITIES.join('|')}) saving throw`, 'i'));
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : null;
}

function firstDice(map) {
  if (!map) return null;
  const k = Object.keys(map).sort((a, b) => a - b)[0];
  return map[k];
}

function convert(raw, edition) {
  return raw.map((s) => {
    let paras = edition === '2014'
      ? s.desc
      : s.description.split(/\n\s*/).map((p) => p.trim()).filter(Boolean);
    let higher = edition === '2014' ? (s.higher_level || []) : (s.higher_level ? [s.higher_level] : []);
    // A few 2024 entries run the upcast rule into the description; move it where it belongs.
    if (edition === '2024') {
      const tail = [];
      paras = paras.flatMap((p) => {
        const [before, after] = p.split(/\s*(?:Using a Higher-Level Spell Slot|Cantrip Upgrade)\.\s*/);
        if (after !== undefined) tail.push(after);
        return before ? [before] : [];
      });
      if (!higher.length) higher = tail;
    }
    const all = paras.join(' ');
    const dmg = Array.isArray(s.damage) ? s.damage[0] : s.damage;
    const save = s.dc ? ABBR[s.dc.dc_type.name] : findSave(all);
    const shape = all.match(/(\d+)-foot(?:-radius|-long)?,? ?(?:-?wide )?(Sphere|Cube|Cone|Line|Cylinder|Emanation)/i);
    const area = s.area_of_effect ? `${s.area_of_effect.size}-ft ${s.area_of_effect.type}`
      : shape ? `${(shape[2] === 'Line' && all.match(/(\d+)-foot-long/)?.[1]) || shape[1]}-ft ${shape[2].toLowerCase()}` : null;
    return {
      id: s.index,
      name: s.name,
      level: s.level,
      school: s.school.name,
      classes: s.classes.map((c) => c.name).sort(),
      cast: shortCast(s.casting_time),
      castFull: s.casting_time,
      range: s.range,
      duration: s.duration.replace(/^Concentration, /i, ''),
      concentration: s.concentration,
      ritual: s.ritual,
      components: s.components,
      material: s.material ? s.material.replace(/\.$/, '') : null,
      attack: s.attack_type || null,
      save,
      damage: dmg && dmg.damage_type ? {
        type: dmg.damage_type.name,
        dice: firstDice(dmg.damage_at_slot_level) || firstDice(dmg.damage_at_character_level),
      } : null,
      heal: firstDice(s.heal_at_slot_level) || (all.match(/regains? (?:a number of )?Hit Points equal to (\d+d\d+)/i) || [])[1] || null,
      area,
      summary: summarise(paras),
      desc: paras,
      higher,
    };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

mkdirSync('src/data', { recursive: true });
for (const edition of ['2014', '2024']) {
  const raw = JSON.parse(readFileSync(`data/raw/srd${edition}.json`, 'utf8'));
  const out = convert(raw, edition);
  writeFileSync(`src/data/spells-${edition}.json`, JSON.stringify(out));
  console.log(edition, out.length, 'spells');
}
