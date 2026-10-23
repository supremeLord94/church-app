import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema({
  key: { type: String, default: 'main', unique: true },
  attendanceGoal: { type: Number, default: 0 }, // target people on a Sunday
});

export default mongoose.model('Settings', settingsSchema);
