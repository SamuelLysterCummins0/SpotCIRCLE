export const decodeHtmlEntities = (str) => {
  const textArea = document.createElement('textarea');
  textArea.innerHTML = str;
  return textArea.value;
};

export const getPlaylistStats = (selectedPlaylist, playlistTracks) => {
  if (!selectedPlaylist || !playlistTracks || playlistTracks.length === 0) {
    return { 
      duration: '0 min', 
      trackCount: 0, 
      lastUpdated: 'Recently',
      saves: 0 
    };
  }

  try {
    // Calculate average duration from loaded tracks
    const loadedDuration = playlistTracks.reduce((sum, track) => {
      if (!track || typeof track !== 'object') return sum;
      return sum + (track.duration_ms || 0);
    }, 0);
    
    const avgDurationPerTrack = loadedDuration / playlistTracks.length;
    const totalTracks = selectedPlaylist.tracks.total || 0;
    
    // Estimate total duration
    const estimatedTotalDuration = Math.round(avgDurationPerTrack * totalTracks);
    
    const hours = Math.floor(estimatedTotalDuration / (1000 * 60 * 60));
    const minutes = Math.floor((estimatedTotalDuration % (1000 * 60 * 60)) / (1000 * 60));
    
    let duration;
    if (hours > 0) {
      duration = `~${hours} hr ${minutes} min`;  // Added ~ to indicate estimate
    } else {
      duration = `~${minutes} min`;
    }

    const trackCount = totalTracks;
    const saves = selectedPlaylist?.saves || 0;

    let lastUpdated = 'Recently';
    if (selectedPlaylist.last_modified) {
      const date = new Date(selectedPlaylist.last_modified);
      const now = new Date();
      const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
      
      if (diffInHours < 24) {
        if (diffInHours === 0) {
          const diffInMinutes = Math.floor((now - date) / (1000 * 60));
          lastUpdated = `${diffInMinutes} minutes ago`;
        } else {
          lastUpdated = `${diffInHours} hours ago`;
        }
      } else {
        // Show only date and year for older entries
        lastUpdated = date.toLocaleDateString(undefined, { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric'
        });
      }
    }

    return {
      duration,
      trackCount,
      lastUpdated,
      saves
    };
  } catch (error) {
    console.error('Error calculating playlist stats:', error);
    return { 
      duration: '0 min', 
      trackCount: 0, 
      lastUpdated: 'Recently',
      saves: 0 
    };
  }
};

export const getHeaderStats = (playlist, tracks) => {
  if (!playlist || !tracks || !Array.isArray(tracks)) {
    return {
      uniqueArtists: 0,
      creator: '',
      visibility: 'Private'
    };
  }

  try {
    const artistSet = new Set();
    tracks.forEach(trackItem => {
      const track = trackItem.track || trackItem;
      if (track?.artists?.length) {
        track.artists.forEach(artist => {
          if (artist?.id) {
            artistSet.add(artist.id);
          }
        });
      }
    });

    return {
      uniqueArtists: artistSet.size,
      creator: playlist?.owner?.display_name || '',
      visibility: playlist?.public ? 'Public' : 'Private'
    };
  } catch (error) {
    console.error('Error calculating header stats:', error);
    return {
      uniqueArtists: 0,
      creator: playlist?.owner?.display_name || '',
      visibility: playlist?.public ? 'Public' : 'Private'
    };
  }
};
