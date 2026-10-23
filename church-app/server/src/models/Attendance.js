import mongoose from 'mongoose';

const { Schema } = mongoose;

// A document exists only when the person was present.
const attendanceSchema = new Schema(
  {
    date: { type: String, required: true },
    person: { type: Schema.Types.ObjectId, ref: 'Person', required: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

attendanceSchema.index({ date: 1, person: 1 }, { unique: true });
attendanceSchema.index({ person: 1, date: -1 });

export default mongoose.model('Attendance', attendanceSchema);
