import mongoose from 'mongoose';

const { Schema } = mongoose;

const personSchema = new Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    colonia: { type: String, trim: true }, // colonia / barrio (replaces the old address)
    birthday: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ }, // YYYY-MM-DD
    section: { type: Number, min: 1, max: 5 }, // sections 1-5, empty = unassigned
    invitedBy: { type: Schema.Types.ObjectId, ref: 'Person' },
    relatives: [
      {
        person: { type: Schema.Types.ObjectId, ref: 'Person' },
        relationship: { type: String, trim: true }, // e.g. esposo, hijo, madre
        _id: false,
      },
    ],
    // visitor = new / not yet a member. member = counted in "who is missing".
    status: { type: String, enum: ['visitor', 'member', 'inactive'], default: 'visitor' },
    // First Sunday we count them. Missed services before this date are ignored.
    joinedAt: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    notes: String,
    // Simple yes/no. People saved before these existed have no value, which counts as "no".
    baptized: { type: Boolean, default: false },
    macroencuentro: { type: Boolean, default: false },
  },
  { timestamps: true }
);

personSchema.index({ lastName: 1, firstName: 1 });
personSchema.index({ section: 1, status: 1 });

export default mongoose.model('Person', personSchema);
