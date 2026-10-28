import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Optional second way to log in. Unique; absent (not null) when not set.
    username: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    // admin: everything.
    // user ("usuario"): take attendance, register people, edit people.
    // teacher ("profesor"): only the Escuela de Vida groups they are assigned to.
    role: { type: String, enum: ['admin', 'user', 'teacher', 'leader'], default: 'user' },
    // leader ("líder"): runs células and casas de paz of their own section; needs a person record (their section comes from it)
    person: { type: mongoose.Schema.Types.ObjectId, ref: 'Person' },
    active: { type: Boolean, default: true },
    // Set when an admin creates the account or resets the password.
    mustChangePassword: { type: Boolean, default: false },
    // Login protection: consecutive failed attempts, and until when the account is locked.
    failedLogins: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    // Sessions created before this moment stop working (set on every password change or reset).
    passwordChangedAt: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
