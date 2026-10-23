const pad = (n) => String(n).padStart(2, '0');
const addDays = (iso, n) => {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
};

export const WEEKS = 6;
export const CRITICAL_AT = 4; // 4 or more missed services in the window
export const LOW_AT = 2;      // 2 or 3 missed; a single miss gets no tag

/**
 * Members who missed at least one service in the last `weeks` weeks (every miss counts, in a row or not).
 * services: held services, newest first. presentBy: { date: Set(personId) }.
 * The window is `weeks` weeks ending at the most recent recorded service, so it always holds 6 Sundays.
 * A member is only counted for services on or after their first counted Sunday (joinedAt).
 */
export function computeMissing({ services, presentBy, members, weeks = WEEKS }) {
  const empty = { weeks, latestService: null, windowStart: null, servicesInWindow: 0, counts: { critical: 0, low: 0, one: 0 }, people: [] };
  if (!services.length) return empty;

  const latestService = services[0].date;
  const windowStart = addDays(latestService, -(weeks * 7 - 1));
  const inWindow = services.filter((s) => s.date >= windowStart);

  const people = [];
  for (const m of members) {
    const joined = m.joinedAt || '0000-00-00';
    const eligible = inWindow.filter((s) => s.date >= joined); // still newest first
    if (!eligible.length) continue;
    const here = (s) => !!presentBy[s.date]?.has(String(m._id));
    const attended = eligible.filter(here).length;
    const missed = eligible.length - attended;
    if (!missed) continue;

    let consecutiveMissed = 0;
    for (const s of eligible) {
      if (here(s)) break;
      consecutiveMissed++;
    }
    people.push({
      _id: m._id, firstName: m.firstName, lastName: m.lastName, phone: m.phone, section: m.section,
      missed, attended, eligible: eligible.length, consecutiveMissed,
      lastSeen: services.find((s) => s.date >= joined && here(s))?.date || null,
      level: missed >= CRITICAL_AT ? 'critical' : missed >= LOW_AT ? 'low' : null,
    });
  }
  people.sort(
    (a, b) => b.missed - a.missed || b.consecutiveMissed - a.consecutiveMissed ||
      a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)
  );
  const count = (f) => people.filter(f).length;
  return {
    weeks, latestService, windowStart, servicesInWindow: inWindow.length,
    counts: { critical: count((p) => p.level === 'critical'), low: count((p) => p.level === 'low'), one: count((p) => !p.level) },
    people,
  };
}
