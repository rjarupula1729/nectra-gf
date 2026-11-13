const mongoose = require('mongoose');

const familyMemberSchema = new mongoose.Schema({
  name: { type: String, required: true },
  relation: { type: String, required: true },
  age: { type: String, default: '' },
}, { _id: true });

const userSchema = new mongoose.Schema({
  mobile: { type: String, unique: true, required: true },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  city: { type: String, default: '' },
  avatar: { type: String, default: '' },
  rewardPoints: { type: Number, default: 0 },
  family: { type: [familyMemberSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
