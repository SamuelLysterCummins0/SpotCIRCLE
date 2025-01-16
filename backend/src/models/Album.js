const mongoose = require('mongoose');

const albumSchema = new mongoose.Schema({
  albumId: {
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

module.exports = mongoose.model('Album', albumSchema);
