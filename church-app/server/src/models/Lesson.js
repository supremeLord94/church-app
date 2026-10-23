import mongoose from 'mongoose';

// A class session that was actually held (created the first time someone is recorded for it).
const lessonSchema = new mongoose.Schema({
  cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
  number: { type: Number, required: true, min: 1 },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
});
lessonSchema.index({ cohort: 1, number: 1 }, { unique: true });

export default mongoose.model('Lesson', lessonSchema);
