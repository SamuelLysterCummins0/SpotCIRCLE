const mongoose = require('mongoose');

const artistSchema = new mongoose.Schema({
  artistId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  playCount: {
    type: Number,
    default: 0
  },
  totalMinutes: {
    type: Number,
    default: 0
  },
  lastPlayed: {
    type: Date
  }
});

module.exports = mongoose.model('Artist', artistSchema);
