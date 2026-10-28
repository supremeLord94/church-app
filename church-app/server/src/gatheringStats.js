/**
 * For the admin: how many casas de paz and células each section held in the period, and who led them.
 * Section status for casas de paz:  none = held no casa de paz,  behind = fewer than half of the most active section,  ok.
 * gatherings need participants[].person populated with { firstName, lastName, section }.
 */
export function summarizeGatherings(gatherings, sections = [1, 2, 3, 4, 5]) {
  const bySection = Object.fromEntries(sections.map((s) => [s, { section: s, casas: 0, celulas: 0, lastCasa: null, lastCelula: null }]));
  const leaders = new Map();

  for (const g of gatherings) {
    const s = bySection[g.section];
    if (!s) continue;
    const casa = g.type === 'casa_de_paz';
    if (casa) { s.casas++; if (!s.lastCasa || g.date > s.lastCasa) s.lastCasa = g.date; }
    else { s.celulas++; if (!s.lastCelula || g.date > s.lastCelula) s.lastCelula = g.date; }

    for (const p of g.participants || []) {
      if (!p.roles?.includes('leader') || !p.person) continue;
      const key = String(p.person._id);
      const e = leaders.get(key) || { personId: key, name: `${p.person.firstName} ${p.person.lastName}`, section: p.person.section ?? g.section, casas: 0, celulas: 0 };
      e[casa ? 'casas' : 'celulas']++;
      leaders.set(key, e);
    }
  }
  const list = sections.map((s) => bySection[s]);
  const max = Math.max(0, ...list.map((s) => s.casas));
  for (const s of list) s.status = s.casas === 0 ? 'none' : s.casas < max / 2 ? 'behind' : 'ok';

  return {
    sections: list,
    leaders: [...leaders.values()].sort((a, b) => b.casas - a.casas || b.celulas - a.celulas || a.name.localeCompare(b.name)),
  };
}

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// The calendar week (Monday to Sunday) that contains `now`.
export function weekBounds(now = new Date()) {
  const offset = (now.getDay() + 6) % 7; // days since Monday
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
  return { start: iso(start), end: iso(end) };
}

/** This week's reuniones: totals by type and by section. "people" = everyone listed in them (leader included). */
export function summarizeWeek(gatherings, { start, end }, sections = [1, 2, 3, 4, 5]) {
  const mine = gatherings.filter((g) => g.date >= start && g.date <= end);
  const bySection = sections.map((s) => {
    const here = mine.filter((g) => g.section === s);
    return {
      section: s,
      celulas: here.filter((g) => g.type === 'celula').length,
      casas: here.filter((g) => g.type === 'casa_de_paz').length,
      people: here.reduce((n, g) => n + (g.participants?.length || 0), 0),
    };
  });
  const part = (type) => {
    const list = mine.filter((g) => g.type === type);
    return { count: list.length, people: list.reduce((n, g) => n + (g.participants?.length || 0), 0) };
  };
  return { start, end, celulas: part('celula'), casas: part('casa_de_paz'), sections: bySection };
}
