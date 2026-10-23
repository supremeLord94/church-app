import AuditLog from './models/AuditLog.js';
import { parseDevice } from './device.js';

const clientInfo = (req) => ({
  ip: String(req.ip || '').replace(/^::ffff:/, ''),
  device: parseDevice(req.headers['user-agent'], req.headers['x-touch'] === '1'),
});

const actorFields = (a) => ({ actor: a?.id, actorName: a?.name || 'Desconocido', actorRole: a?.role });

// Record one event. Logging must never break the request, so errors are swallowed (and printed).
export async function audit(req, { category, action, summary, details, target = {}, actor }) {
  try {
    await AuditLog.create({
      ...actorFields(actor || req.user),
      category, action, summary,
      details: details?.length ? details : undefined,
      targetType: target.type,
      targetId: target.id ? String(target.id) : undefined,
      targetLabel: target.label,
      ...clientInfo(req),
    });
  } catch (e) {
    console.error('No se pudo guardar el registro de actividad:', e.message);
  }
}

// Many quick taps (attendance, homework) become ONE entry per person, place and 3-hour window.
// counters: names to add 1 to, e.g. ['present']; summarize(meta) builds the sentence from the totals.
export async function auditSession(req, { category, action, targetType, targetId, targetLabel, counters, summarize }) {
  try {
    const bucket = Math.floor(Date.now() / (3 * 3600 * 1000));
    const sessionKey = `${req.user.id}:${action}:${targetId}:${bucket}`;
    const inc = Object.fromEntries(counters.map((c) => [`meta.${c}`, 1]));
    const run = () =>
      AuditLog.findOneAndUpdate(
        { sessionKey },
        {
          $inc: inc,
          $set: { at: new Date() },
          $setOnInsert: {
            ...actorFields(req.user), category, action, targetType, targetId: String(targetId), targetLabel,
            ...clientInfo(req),
          },
        },
        { new: true, upsert: true }
      );
    let doc;
    try {
      doc = await run();
    } catch (e) {
      if (e.code !== 11000) throw e; // two taps raced to create the entry: the second one now finds it
      doc = await run();
    }
    await AuditLog.updateOne({ _id: doc._id }, { $set: { summary: summarize(doc.meta || {}) } });
  } catch (e) {
    console.error('No se pudo guardar el registro de actividad:', e.message);
  }
}
