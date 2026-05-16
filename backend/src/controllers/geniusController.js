// Lyrics lookup. Previously this scraped Genius song pages with cheerio,
// which broke whenever Genius changed their DOM. We now use LRCLib
// (https://lrclib.net) — a free, public lyrics API with no key required.
// The route URL stays "/api/genius/search" so the frontend doesn't need to
// know we swapped providers.

const axios = require('axios');
const { CacheService } = require('../utils/cache');

const LRCLIB_URL = 'https://lrclib.net/api';
const USER_AGENT = 'SpotCIRCLE (https://github.com/SamuelLysterCummins0/SpotCIRCLE)';
const LYRICS_TTL_SECONDS = 60 * 60; // 1 hour — lyrics don't really change.

const cacheKeyFor = (title, artist) =>
  `lyrics:${title.toLowerCase().trim()}|${artist.toLowerCase().trim()}`;

// LRC format: each line is "[mm:ss.xx]lyric text" (a line can carry several
// timestamps when the same words repeat). Returns lines sorted by time, each
// with an absolute ms offset from the start of the track.
const parseLrc = (text) => {
  const stampRe = /\[(\d+):(\d+(?:\.\d+)?)\]/g;
  const blocks = [];

  text.split(/\r?\n/).forEach((rawLine) => {
    stampRe.lastIndex = 0;
    const stamps = [];
    let match;
    while ((match = stampRe.exec(rawLine)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      stamps.push(Math.round((minutes * 60 + seconds) * 1000));
    }
    if (stamps.length === 0) return;
    const content = rawLine.replace(stampRe, '').trim();
    stamps.forEach((time) => {
      blocks.push({ time, text: content, type: 'lyrics', section: '' });
    });
  });

  return blocks.sort((a, b) => a.time - b.time);
};

// Plain text fallback when we only have unsynced lyrics. No timestamps, so the
// frontend can't highlight by time — it just renders them line-by-line.
const parsePlain = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => {
      const sectionMatch = line.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        return { type: 'section', text: line, section: line, time: null };
      }
      return { type: 'lyrics', text: line, section: '', time: null };
    });

exports.searchSong = async (req, res) => {
  const { title, artist } = req.query;

  if (!title || !artist) {
    return res
      .status(400)
      .json({ error: 'Missing title or artist query parameter' });
  }

  const cacheKey = cacheKeyFor(title, artist);
  const cached = await CacheService.get(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  try {
    let track = null;
    try {
      const getRes = await axios.get(`${LRCLIB_URL}/get`, {
        params: { track_name: title, artist_name: artist },
        headers: { 'User-Agent': USER_AGENT },
        validateStatus: (s) => s === 200 || s === 404,
      });
      if (getRes.status === 200) {
        track = getRes.data;
      }
    } catch (e) {
      // Fall through to search.
    }

    if (!track) {
      const searchRes = await axios.get(`${LRCLIB_URL}/search`, {
        params: { track_name: title, artist_name: artist },
        headers: { 'User-Agent': USER_AGENT },
      });
      if (Array.isArray(searchRes.data) && searchRes.data.length > 0) {
        // Prefer a result that has synced lyrics.
        track =
          searchRes.data.find((r) => r.syncedLyrics) || searchRes.data[0];
      }
    }

    if (!track) {
      return res.status(404).json({
        error: 'Song not found',
        message: 'Could not find lyrics for this song.',
      });
    }

    const send = async (payload) => {
      await CacheService.set(cacheKey, payload, LYRICS_TTL_SECONDS);
      return res.json(payload);
    };

    if (track.instrumental) {
      return send({
        songId: track.id,
        title: track.trackName || title,
        artist: track.artistName || artist,
        synced: false,
        lyrics: [{ type: 'lyrics', text: '[Instrumental]', section: '', time: null }],
        instrumental: true,
      });
    }

    if (track.syncedLyrics) {
      return send({
        songId: track.id,
        title: track.trackName || title,
        artist: track.artistName || artist,
        synced: true,
        lyrics: parseLrc(track.syncedLyrics),
      });
    }

    if (track.plainLyrics) {
      return send({
        songId: track.id,
        title: track.trackName || title,
        artist: track.artistName || artist,
        synced: false,
        lyrics: parsePlain(track.plainLyrics),
      });
    }

    return res.status(404).json({
      error: 'Lyrics not available',
      message: 'LRCLib has this track but no lyrics text on file.',
    });
  } catch (error) {
    console.error('Error fetching lyrics from LRCLib:', error.message);
    res.status(500).json({
      error: 'Failed to fetch lyrics',
      details: error.message,
    });
  }
};
