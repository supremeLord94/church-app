import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  attendanceGoal: { type: Number, default: 0 }, // target people on a Sunday
  // Default leaders of each section (a couple, up to 2). First = default Líder, second = Co-líder.
  // New reuniones of that section start with them.
  sectionLeaders: [
    {
      section: { type: Number, min: 1, max: 5, required: true },
      people: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Person' }],
      _id: false,
    },
  ],
});

export default mongoose.model('Settings', settingsSchema);
