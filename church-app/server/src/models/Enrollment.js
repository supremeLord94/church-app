import mongoose from 'mongoose';
import { COURSES } from '../courses.js';

const { Schema } = mongoose;

// A person's place in a course. `cohort` is empty for past completions entered without a group.
const enrollmentSchema = new Schema(
  {
    person: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    course: { type: String, enum: COURSES, required: true },
    cohort: { type: Schema.Types.ObjectId, ref: 'Cohort' },
    status: { type: String, enum: ['active', 'completed', 'dropped'], default: 'active' },
    completedAt: { type: String },
  },
  { timestamps: true }
);
enrollmentSchema.index({ person: 1 });
enrollmentSchema.index(
  { cohort: 1, person: 1 },
  { unique: true, partialFilterExpression: { cohort: { $type: 'objectId' } } }
);

export default mongoose.model('Enrollment', enrollmentSchema);
