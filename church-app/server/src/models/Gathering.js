import mongoose from 'mongoose';
import { ROLES } from '../gatheringRoles.js';

const { Schema } = mongoose;

// One person at one gathering. The tags belong to THIS gathering only (next time the host may be someone else).
const participantSchema = new Schema(
  {
    person: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    roles: [{ type: String, enum: Object.keys(ROLES) }], // leader, subleader, host, word, praise, prayer, offering
  },
  { _id: false }
);

// A reunión: a célula (weekly small group) or a casa de paz (one of the 9 visits for people outside the church).
const gatheringSchema = new Schema(
  {
    type: { type: String, enum: ['celula', 'casa_de_paz'], required: true },
    classNumber: { type: Number, min: 1, max: 9 }, // casa de paz only: which of the 9 lessons
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, match: /^\d{2}:\d{2}$/ },
    place: { type: String, trim: true, maxlength: 120 },
    section: { type: Number, min: 1, max: 5, required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    participants: [participantSchema],
  },
  { timestamps: true }
);
gatheringSchema.index({ section: 1, date: -1 });
gatheringSchema.index({ date: -1 });

export default mongoose.model('Gathering', gatheringSchema);
