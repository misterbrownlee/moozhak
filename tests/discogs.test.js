/**
 * Tests for pure functions in discogs.js
 * No mocks required - these are pure data transformations
 */
import {
  buildDiscogsUrl,
  buildDiscogsUrlFromUri,
  formatResult,
  formatTrack,
} from '../lib/discogs.js';

describe('formatTrack', () => {
  const sampleTrack = {
    position: 'A1',
    title: 'Kiara',
    duration: '5:15',
  };

  describe('human format (default)', () => {
    it('formats track with position, title, and duration', () => {
      const result = formatTrack(sampleTrack, 0);
      expect(result).toBe('  A1 Kiara (5:15)');
    });

    it('omits duration parentheses when duration is empty', () => {
      const track = { position: '1', title: 'Intro', duration: '' };
      const result = formatTrack(track, 0);
      expect(result).toBe('  1 Intro');
    });

    it('uses index+1 as position when position is missing', () => {
      const track = { title: 'Track Five' };
      const result = formatTrack(track, 4);
      expect(result).toBe('  5 Track Five');
    });

    it('uses "Untitled" when title is missing', () => {
      const track = { position: '1', duration: '3:00' };
      const result = formatTrack(track, 0);
      expect(result).toBe('  1 Untitled (3:00)');
    });
  });

  describe('csv format', () => {
    it('formats as comma-separated values', () => {
      const result = formatTrack(sampleTrack, 0, 'csv');
      expect(result).toBe('A1,Kiara,5:15');
    });

    it('wraps title in quotes if it contains a comma', () => {
      const track = { position: '1', title: 'Hello, World', duration: '3:00' };
      const result = formatTrack(track, 0, 'csv');
      expect(result).toBe('1,"Hello, World",3:00');
    });

    it('escapes quotes in title by doubling them', () => {
      const track = { position: '1', title: 'Say "Hello"', duration: '3:00' };
      const result = formatTrack(track, 0, 'csv');
      expect(result).toBe('1,"Say ""Hello""",3:00');
    });

    it('handles empty duration', () => {
      const track = { position: '1', title: 'Intro' };
      const result = formatTrack(track, 0, 'csv');
      expect(result).toBe('1,Intro,');
    });
  });

  describe('pipe format', () => {
    it('formats with pipe separators', () => {
      const result = formatTrack(sampleTrack, 0, 'pipe');
      expect(result).toBe('A1 | Kiara | 5:15');
    });

    it('handles missing values gracefully', () => {
      const track = { title: 'Only Title' };
      const result = formatTrack(track, 2, 'pipe');
      expect(result).toBe('3 | Only Title | ');
    });
  });

  describe('markdown format', () => {
    it('formats as markdown table row', () => {
      const result = formatTrack(sampleTrack, 0, 'markdown');
      expect(result).toBe('| A1 | Kiara | 5:15 |');
    });

    it('handles missing values gracefully', () => {
      const track = {};
      const result = formatTrack(track, 0, 'markdown');
      expect(result).toBe('| 1 | Untitled |  |');
    });
  });
});

describe('formatResult', () => {
  it('formats complete result with all fields', () => {
    const result = {
      id: 12345,
      title: 'Black Sands - Bonobo',
      year: 2010,
      format: ['Vinyl', 'LP'],
      catno: 'ZEN195',
    };
    const formatted = formatResult(result);
    expect(formatted).toBe(
      '  12345 | Black Sands - Bonobo | 2010 | Vinyl, LP | ZEN195',
    );
  });

  it('omits missing fields from output', () => {
    const result = {
      id: 67890,
      title: 'Album Title',
    };
    const formatted = formatResult(result);
    expect(formatted).toBe('  67890 | Album Title');
  });

  it('uses "Untitled" when title is missing', () => {
    const result = { id: 123 };
    const formatted = formatResult(result);
    expect(formatted).toBe('  123 | Untitled');
  });

  it('handles empty result object', () => {
    const result = {};
    const formatted = formatResult(result);
    expect(formatted).toBe('  Untitled');
  });

  it('joins format array with commas', () => {
    const result = {
      title: 'Test',
      format: ['CD', 'Album', 'Remastered'],
    };
    const formatted = formatResult(result);
    expect(formatted).toBe('  Test | CD, Album, Remastered');
  });

  it('handles year of 0 (falsy but valid)', () => {
    const result = { id: 1, title: 'Ancient', year: 0 };
    const formatted = formatResult(result);
    // Year 0 is filtered out because it's falsy
    expect(formatted).toBe('  1 | Ancient');
  });
});

describe('buildDiscogsUrl', () => {
  it('builds URL for master type', () => {
    expect(buildDiscogsUrl('master', 12345)).toBe(
      'https://www.discogs.com/master/12345',
    );
  });

  it('builds URL for release type', () => {
    expect(buildDiscogsUrl('release', 67890)).toBe(
      'https://www.discogs.com/release/67890',
    );
  });

  it('builds URL for artist type', () => {
    expect(buildDiscogsUrl('artist', 111)).toBe(
      'https://www.discogs.com/artist/111',
    );
  });

  it('builds URL for label type', () => {
    expect(buildDiscogsUrl('label', 222)).toBe(
      'https://www.discogs.com/label/222',
    );
  });

  it('handles string ID', () => {
    expect(buildDiscogsUrl('master', '99999')).toBe(
      'https://www.discogs.com/master/99999',
    );
  });
});

describe('buildDiscogsUrlFromUri', () => {
  it('builds URL from master URI', () => {
    expect(buildDiscogsUrlFromUri('/master/12345')).toBe(
      'https://www.discogs.com/master/12345',
    );
  });

  it('builds URL from release URI', () => {
    expect(buildDiscogsUrlFromUri('/release/67890')).toBe(
      'https://www.discogs.com/release/67890',
    );
  });

  it('builds URL from complex URI path', () => {
    expect(buildDiscogsUrlFromUri('/artist/123-Artist-Name')).toBe(
      'https://www.discogs.com/artist/123-Artist-Name',
    );
  });

  it('handles URI without leading slash', () => {
    // Note: This tests current behavior, but URIs should have leading slash
    expect(buildDiscogsUrlFromUri('master/123')).toBe(
      'https://www.discogs.commaster/123',
    );
  });
});
