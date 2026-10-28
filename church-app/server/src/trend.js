/**
 * Per-service numbers for the dashboard chart (oldest service first).
 *  total          everyone present
 *  members        present people who are not visitors
 *  newOrVisitors  present visitors plus anyone on their first counted Sunday (each person counted once)
 * dates: service dates, newest first. rows: attendance rows with person { status, joinedAt } filled in.
 */
export function buildTrend(dates, rows) {
  const byDate = Object.fromEntries(dates.map((d) => [d, { date: d, members: 0, visitors: 0, newPeople: 0, newOrVisitors: 0 }]));
  for (const r of rows) {
    const row = r.person && byDate[r.date];
    if (!row) continue;
    const visitor = r.person.status === 'visitor';
    const isNew = r.person.joinedAt === r.date;
    if (visitor) row.visitors++;
    else row.members++;
    if (isNew) row.newPeople++;
    if (visitor || isNew) row.newOrVisitors++;
  }
  return dates.map((d) => ({ ...byDate[d], total: byDate[d].members + byDate[d].visitors })).reverse();
}
