import mongoose from 'mongoose';
import { COURSES } from '../courses.js';

// A group of students taking one course together (e.g. "Nivel 1 - Otoño 2026").
const cohortSchema = new mongoose.Schema(
  {
    course: { type: String, enum: COURSES, required: true },
    name: { type: String, required: true, trim: true },
    startDate: { type: String, match: /^\d{4}-\d{2}-\d{2}$/ },
    totalClasses: { type: Number, default: 12, min: 1, max: 30 }, // "around 12", adjustable per group
    status: { type: String, enum: ['active', 'completed'], default: 'active' },
    // Teachers (users with role 'teacher') who can see and record this group.
    teachers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default mongoose.model('Cohort', cohortSchema);
