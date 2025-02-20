export const TimeRanges = {
  SHORT: 'short_term',     // Last 4 weeks
  MEDIUM: 'medium_term',   // Last 6 months
  LONG: 'long_term'       // All time
};

export const TimeRangeLabels = {
  short_term: 'Last 4 Weeks',
  medium_term: 'Last 6 Months', 
  long_term: 'All Time'    // Updated to reflect actual Spotify range
};

export const timeRanges = [
  { id: TimeRanges.SHORT, label: TimeRangeLabels.short_term },
  { id: TimeRanges.MEDIUM, label: TimeRangeLabels.medium_term },
  { id: TimeRanges.LONG, label: TimeRangeLabels.long_term }
];
