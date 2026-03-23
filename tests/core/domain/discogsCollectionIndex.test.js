import { describe, expect, it } from '@jest/globals';
import {
  buildCollectionIndex,
  libraryItemInCollection,
  libraryItemMatchesMasterId,
  pickCollectionReleaseForMaster,
} from '../../../core/domain/discogsCollectionIndex.js';

describe('discogsCollectionIndex', () => {
  it('buildCollectionIndex maps release ids and master groups', () => {
    const idx = buildCollectionIndex([
      { discogsId: 10, masterId: 100, dateAdded: '2020-01-01T00:00:00' },
      { discogsId: 11, masterId: 100, dateAdded: '2024-06-01T00:00:00' },
    ]);
    expect(idx.releaseIdSet.has('10')).toBe(true);
    expect(idx.releaseIdSet.has('11')).toBe(true);
    expect(idx.masterIdToReleases.get('100')?.length).toBe(2);
  });

  it('pickCollectionReleaseForMaster prefers most recent dateAdded', () => {
    const idx = buildCollectionIndex([
      { discogsId: 10, masterId: 100, dateAdded: '2020-01-01T00:00:00' },
      { discogsId: 11, masterId: 100, dateAdded: '2024-06-01T00:00:00' },
    ]);
    expect(pickCollectionReleaseForMaster(idx, 100)).toBe(11);
  });

  it('libraryItemInCollection for release uses releaseIdSet', () => {
    const idx = buildCollectionIndex([
      { discogsId: 10, masterId: 100, dateAdded: '2020-01-01T00:00:00' },
    ]);
    expect(
      libraryItemInCollection({ type: 'release', discogsId: 10 }, idx),
    ).toBe(true);
    expect(
      libraryItemInCollection({ type: 'release', discogsId: 99 }, idx),
    ).toBe(false);
  });

  it('libraryItemInCollection for master checks any collection release', () => {
    const idx = buildCollectionIndex([
      { discogsId: 10, masterId: 100, dateAdded: '2020-01-01T00:00:00' },
    ]);
    expect(
      libraryItemInCollection({ type: 'master', discogsId: 100 }, idx),
    ).toBe(true);
    expect(
      libraryItemInCollection({ type: 'master', discogsId: 200 }, idx),
    ).toBe(false);
  });

  it('libraryItemMatchesMasterId', () => {
    expect(
      libraryItemMatchesMasterId(
        { type: 'master', discogsId: 55 },
        55,
      ),
    ).toBe(true);
    expect(
      libraryItemMatchesMasterId(
        { type: 'release', discogsId: 10, masterDiscogsId: 55 },
        55,
      ),
    ).toBe(true);
    expect(
      libraryItemMatchesMasterId(
        { type: 'release', discogsId: 10, masterDiscogsId: 56 },
        55,
      ),
    ).toBe(false);
  });
});
