const axios = require('axios');
const cheerio = require('cheerio');
const { getLyrics, getSong } = require('genius-lyrics-api');

const GENIUS_API_URL = 'https://api.genius.com';
const GENIUS_ACCESS_TOKEN = process.env.GENIUS_ACCESS_TOKEN;

exports.searchSong = async (req, res) => {
  try {
    const { artist, title } = req.query;
    
    console.log('Searching for lyrics:', { title, artist });
    
    const options = {
      apiKey: GENIUS_ACCESS_TOKEN,
      title: title,
      artist: artist,
      optimizeQuery: true
    };

    const song = await getSong(options).catch(() => null);
    if (!song || !song.url) {
      return res.status(404).json({ 
        error: 'Song not found',
        message: 'Could not find this song on Genius.'
      });
    }

    console.log('Fetching lyrics from URL:', song.url);
    
    const response = await axios.get(song.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    let currentSection = '';
    let lyrics = [];

    // Function to process text nodes and maintain structure
    const processTextNode = (node) => {
      const text = $(node).text().trim();
      if (!text) return null;
      
      // Check if this is a section header
      if (text.match(/^\[.*\]$/)) {
        currentSection = text;
        return { type: 'section', text };
      }
      
      // Return regular lyrics line
      return { type: 'lyrics', text, section: currentSection };
    };

    // Function to process an element and its children
    const processElement = ($el) => {
      let results = [];
      
      // Process all child nodes
      $el.contents().each((_, node) => {
        if (node.type === 'text') {
          const processed = processTextNode(node);
          if (processed) results.push(processed);
        } else if (node.type === 'tag') {
          const $node = $(node);
          
          // Skip certain elements
          if ($node.is('script') || $node.is('[style*="display: none"]')) {
            return;
          }

          // Check for section headers in class names
          const className = $node.attr('class') || '';
          if (className.includes('Label') || className.includes('Header')) {
            const text = $node.text().trim();
            if (text) {
              currentSection = `[${text}]`;
              results.push({ type: 'section', text: currentSection });
            }
          } else {
            // Recursively process child elements
            results = results.concat(processElement($node));
          }
        }
      });

      return results;
    };

    // Try multiple selector patterns to find lyrics content
    const lyricsSelectors = [
      '[class*="Lyrics__Container"]',
      '.lyrics',
      '[data-lyrics-container="true"]',
      '#lyrics-root',
      '[class^="lyrics"]',
      '.song_body-lyrics',
      'div[class^="Lyrics__Root"]'
    ];

    let lyricsContent = [];
    
    for (const selector of lyricsSelectors) {
      const container = $(selector);
      if (container.length) {
        lyricsContent = processElement(container);
        if (lyricsContent.length) break;
      }
    }

    // Clean up the lyrics content
    const cleanedLyrics = lyricsContent
      .filter(item => {
        const unwantedPhrases = [
          'Embed',
          'You might also like',
          'Genius',
          'Share URL',
          'Copy',
          'Contributors',
          'Read More',
          'Advertisement',
          'Submit Corrections'
        ];
        
        return item.text && 
               !unwantedPhrases.some(phrase => item.text.includes(phrase));
      })
      .reduce((acc, current) => {
        // Avoid consecutive duplicates unless they're sections
        if (acc.length === 0 || 
            current.type === 'section' || 
            acc[acc.length - 1].text !== current.text) {
          acc.push(current);
        }
        return acc;
      }, []);

    // Convert to timed blocks
    const lyricsBlocks = cleanedLyrics.map((item, index) => ({
      text: item.text,
      type: item.type,
      section: item.section,
      timestamp: index * (item.type === 'section' ? 2000 : 4000)
    }));

    console.log(`Found ${lyricsBlocks.length} lyrics blocks`);

    res.json({
      songId: song.id,
      title: song.title,
      artist: artist,
      lyrics: lyricsBlocks,
      albumArt: song.albumArt
    });
    
  } catch (error) {
    console.error('Error fetching lyrics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch lyrics', 
      details: error.message,
      stack: error.stack 
    });
  }
};