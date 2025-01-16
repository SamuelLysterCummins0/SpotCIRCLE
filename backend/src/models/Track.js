const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
  trackId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  artistId: {
    type: String,
    required: true
  },
  albumId: {
    type: String,
    required: true
  },
  playCount: {
    type: Number,
    default: 0
  },
  duration: {
    type: Number,
    required: true
  },
  lastPlayed: {
    type: Date
  }
});

module.exports = mongoose.model('Track', trackSchema);
