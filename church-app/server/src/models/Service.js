import mongoose from 'mongoose';

// One document per Sunday service that actually happened (created on first check-in).
const serviceSchema = new mongoose.Schema(
  {
    date: { type: String, required: true, unique: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  },
  { timestamps: true }
);

export default mongoose.model('Service', serviceSchema);
