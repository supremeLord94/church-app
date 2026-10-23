const pad = (n) => String(n).padStart(2, '0');

// People whose birthday falls within the next `days` days (today included), soonest first.
// Feb 29 is celebrated on Feb 28 in years without a leap day.
export function upcomingBirthdays(people, now = new Date(), days = 28) {
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const out = [];
  for (const p of people) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.birthday || '');
    if (!m) continue;
    const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const on = (yr) => {
      const d = new Date(yr, month - 1, day);
      return d.getMonth() === month - 1 ? d : new Date(yr, month - 1, day - 1);
    };
    let next = on(t0.getFullYear());
    if (next < t0) next = on(t0.getFullYear() + 1);
    const daysUntil = Math.round((next - t0) / 86400000);
    if (daysUntil > days) continue;
    out.push({
      _id: p._id, firstName: p.firstName, lastName: p.lastName, phone: p.phone, section: p.section, status: p.status,
      month, day, date: `${next.getFullYear()}-${pad(next.getMonth() + 1)}-${pad(next.getDate())}`,
      daysUntil, turning: year >= 1900 ? next.getFullYear() - year : null,
    });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil || a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));
}
