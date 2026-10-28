import mongoose from 'mongoose';

const { Schema } = mongoose;

// One row per thing somebody did. Never stores passwords or request bodies:
// only a plain-language summary, who did it, when, from which device and IP.
const auditSchema = new Schema({
  at: { type: Date, default: Date.now },
  actor: { type: Schema.Types.ObjectId, ref: 'User' }, // empty for unknown people (failed logins)
  actorName: { type: String, default: 'Desconocido' },  // name at the time, so the log stays readable later
  actorRole: String,
  category: { type: String, enum: ['sesion', 'cuenta', 'usuarios', 'personas', 'asistencia', 'escuela', 'reuniones', 'ajustes'], required: true },
  action: { type: String, required: true },             // machine key, e.g. person.update
  summary: String,                                      // "editó a Juan Pérez"
  details: [String],                                    // e.g. which fields changed (names only, not values)
  targetType: String,
  targetId: String,
  targetLabel: String,
  device: { type: Object },                             // { label, type, os, browser, ua }
  ip: String,
  // Used to merge many taps (attendance, homework) into a single entry per session.
  sessionKey: { type: String, unique: true, sparse: true },
  meta: { type: Object, default: undefined },
});

auditSchema.index({ actor: 1, at: -1 });
auditSchema.index({ category: 1, at: -1 });
// Old entries are deleted automatically (default: after one year).
const days = Number(process.env.ACTIVITY_RETENTION_DAYS) || 365;
auditSchema.index({ at: 1 }, { expireAfterSeconds: days * 24 * 3600 });

export default mongoose.model('AuditLog', auditSchema);
