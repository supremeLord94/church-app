import mongoose from 'mongoose';

const { Schema } = mongoose;

// One student in one class: did they attend, and did they turn in the homework.
const classRecordSchema = new Schema({
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true },
  number: { type: Number, required: true, min: 1 },
  person: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
  present: { type: Boolean, default: false },
  homework: { type: Boolean, default: false },
});
classRecordSchema.index({ cohort: 1, number: 1, person: 1 }, { unique: true });
classRecordSchema.index({ cohort: 1, person: 1 });

export default mongoose.model('ClassRecord', classRecordSchema);
