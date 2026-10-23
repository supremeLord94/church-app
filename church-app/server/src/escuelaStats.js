import { COURSES, COURSE_ORDER } from './courses.js';

const push = (map, key, val) => {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(val);
};

/**
 * One row per person who is a member or has any Escuela de Vida enrollment.
 * stage: graduated (all 4 courses completed) | in_progress (active enrollment)
 *        | stalled (has enrollments, none active, not graduated) | not_started (member, no enrollments)
 */
export function buildRows({ people, enrollments, lessons, records }) {
  const lessonsBy = new Map();
  for (const l of lessons) push(lessonsBy, String(l.cohort), l);
  for (const arr of lessonsBy.values()) arr.sort((a, b) => b.number - a.number); // newest first

  const recBy = new Map();
  for (const r of records) {
    const k = `${r.cohort}:${r.person}`;
    if (!recBy.has(k)) recBy.set(k, new Map());
    recBy.get(k).set(r.number, r);
  }
  const enrBy = new Map();
  for (const e of enrollments) push(enrBy, String(e.person), e);

  // Attendance, homework and current absence streak for one enrollment (needs a cohort).
  const statsFor = (e) => {
    if (!e.cohort) return null;
    const L = lessonsBy.get(String(e.cohort)) || [];
    const recs = recBy.get(`${e.cohort}:${e.person}`) || new Map();
    let attended = 0, homework = 0, lastAttended = null;
    let consecutiveMissed = 0, countingMissed = true;     // classes in a row (newest first) not attended
    let consecutiveNoHomework = 0, countingHw = true;     // classes in a row without homework turned in
    for (const l of L) {
      const r = recs.get(l.number);
      if (r?.present) {
        attended++;
        countingMissed = false;
        if (!lastAttended) lastAttended = l.date;
      } else if (countingMissed) consecutiveMissed++;
      if (r?.homework) {
        homework++;
        countingHw = false;
      } else if (countingHw) consecutiveNoHomework++;
    }
    return { held: L.length, attended, homework, consecutiveMissed, consecutiveNoHomework, lastAttended };
  };

  const rows = [];
  for (const p of people) {
    const es = enrBy.get(String(p._id)) || [];
    if (p.status !== 'member' && !es.length) continue;

    const completed = COURSES.filter((c) => es.some((e) => e.course === c && e.status === 'completed'));
    const graduated = completed.length === COURSES.length;
    const byCourse = [...es].sort(
      (a, b) => COURSE_ORDER[b.course] - COURSE_ORDER[a.course] || String(b.createdAt).localeCompare(String(a.createdAt))
    );
    const active = byCourse.find((e) => e.status === 'active');
    const focus = active || byCourse[0]; // what we show attendance for
    const stats = focus ? statsFor(focus) : null;
    const lastActivity = es.map((e) => statsFor(e)?.lastAttended).filter(Boolean).sort().pop() || null;

    rows.push({
      personId: String(p._id),
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
      section: p.section,
      memberStatus: p.status,
      stage: graduated ? 'graduated' : active ? 'in_progress' : es.length ? 'stalled' : 'not_started',
      completedCourses: completed,
      currentCourse: active?.course || null,
      lastCourse: focus?.course || null,
      lastCourseStatus: focus?.status || null,
      cohortId: focus?.cohort ? String(focus.cohort) : null,
      held: stats?.held ?? null,
      attended: stats?.attended ?? null,
      homework: stats?.homework ?? null,
      consecutiveMissed: stats?.consecutiveMissed ?? 0,
      consecutiveNoHomework: stats?.consecutiveNoHomework ?? 0,
      lastAttended: stats?.lastAttended ?? null,
      lastActivity,
    });
  }
  return rows;
}

export function summarize(rows) {
  const count = (stage) => rows.filter((r) => r.stage === stage).length;
  return {
    total: rows.length,
    graduated: count('graduated'),
    inProgress: count('in_progress'),
    stalled: count('stalled'),
    notStarted: count('not_started'),
    completedByCourse: Object.fromEntries(COURSES.map((c) => [c, rows.filter((r) => r.completedCourses.includes(c)).length])),
  };
}
