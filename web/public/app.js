// ============================================
// Vinyl Library - Alpine.js Application
// ============================================

// biome-ignore lint/correctness/noUnusedVariables: used by Alpine.js in HTML x-data
function vinylApp() {
  const libraryUiInitial = (() => {
    const P = typeof window !== 'undefined' ? window.MoozhakUiPrefs : null;
    if (P?.readLibraryUiPrefs) {
      return P.readLibraryUiPrefs(localStorage);
    }
    const leg = localStorage.getItem('viewMode');
    return {
      subView: 'albums',
      trackSortKey: 'trackTitle',
      trackSortDir: 'asc',
      viewMode: leg === 'list' || leg === 'cards' ? leg : 'cards',
    };
  })();

  return {
    // State
    loading: false,
    theme: localStorage.getItem('theme') || 'dark',
    viewMode: libraryUiInitial.viewMode,
    toasts: [],
    libraryCache: [],

    // Collection state
    collection: [],
    collectionMetadata: null,
    collectionLoading: false,
    /** True after the first `loadCollection()` run finishes (collection page). */
    collectionInitialLoadComplete: false,

    // Modal state
    detailsData: null,
    deleteTarget: null, // Item pending deletion confirmation
    deleteSetWarnings: [],

    // Library Albums | Tracks
    librarySubView: libraryUiInitial.subView,
    libraryTrackRows: [],
    libraryTrackSortKey: libraryUiInitial.trackSortKey,
    libraryTrackSortDir: libraryUiInitial.trackSortDir,
    /** @type {Set<string>|null} */
    _trackMembershipSet: null,

    // Set editor (/sets/:id)
    setEditor: null,
    setEditorStats: {
      trackCount: 0,
      bpmMin: null,
      bpmMax: null,
      bpmAverage: null,
    },

    // Unified set dialog (library track)
    trackSetDialogContext: null,
    trackSetDialogAllSets: [],
    trackSetDialogMemberSets: [],
    trackSetDialogSelectedSetId: '',
    trackSetDialogLoading: false,

    // ============================================
    // Debug Logging
    // ============================================

    /**
     * Log a user action to the server
     * @param {string} action - Action name
     * @param {Object} [details] - Optional details
     */
    logAction(action, details = null) {
      fetch('/api/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, details }),
      }).catch(() => {
        // Silently ignore logging errors
      });
    },

    // ============================================
    // Tracklist Helpers
    // ============================================

    /**
     * Shared with server via core/domain/library.js (synced to /moozhak-domain.js).
     */
    getTrackSide(position) {
      const M = window.MoozhakDomain;
      if (M?.getTrackSide) return M.getTrackSide(position);
      if (!position) return '';
      const match = String(position).match(/^([A-Za-z]+)/);
      return match ? match[1].toUpperCase() : '';
    },

    groupTracksBySide(tracklist) {
      const M = window.MoozhakDomain;
      if (M?.groupTracksBySide) return M.groupTracksBySide(tracklist);
      if (!tracklist || tracklist.length === 0) return [];
      const sides = [];
      let currentSide = null;
      let currentTracks = [];
      for (const track of tracklist) {
        const side = this.getTrackSide(track.position);
        if (side !== currentSide) {
          if (currentTracks.length > 0) {
            sides.push({ label: currentSide || '', tracks: currentTracks });
          }
          currentSide = side;
          currentTracks = [track];
        } else {
          currentTracks.push(track);
        }
      }
      if (currentTracks.length > 0) {
        sides.push({ label: currentSide || '', tracks: currentTracks });
      }
      return sides;
    },

    // ============================================
    // Initialization
    // ============================================

    init() {
      document.documentElement.setAttribute('data-theme', this.theme);
      this.loadLibraryCache();
      this.logAction('page_load', { path: window.location.pathname });

      const rowsEl = document.getElementById('library-track-rows-data');
      if (rowsEl) {
        try {
          this.libraryTrackRows = JSON.parse(rowsEl.textContent);
        } catch {
          this.libraryTrackRows = [];
        }
      }
      const memEl = document.getElementById('library-membership-keys-data');
      if (memEl) {
        try {
          const keys = JSON.parse(memEl.textContent);
          this._trackMembershipSet = new Set(keys);
        } catch {
          this._trackMembershipSet = new Set();
        }
      } else {
        this._trackMembershipSet = new Set();
      }

      const setJson = document.getElementById('set-editor-initial-json');
      if (setJson) {
        try {
          this.setEditor = JSON.parse(setJson.textContent);
          this.refreshSetEditorStats();
        } catch (e) {
          console.error(e);
        }
      }

      this.$watch('librarySubView', () =>
        this.persistLibraryUiPrefsToStorage(),
      );
      this.$watch('libraryTrackSortKey', () =>
        this.persistLibraryUiPrefsToStorage(),
      );
      this.$watch('libraryTrackSortDir', () =>
        this.persistLibraryUiPrefsToStorage(),
      );
      this.$watch('viewMode', () => this.persistLibraryUiPrefsToStorage());

      this.persistLibraryUiPrefsToStorage();
    },

    persistLibraryUiPrefsToStorage() {
      const P = window.MoozhakUiPrefs;
      if (!P?.writeLibraryUiPrefs) return;
      try {
        localStorage.removeItem('viewMode');
      } catch {
        /* ignore */
      }
      P.writeLibraryUiPrefs(localStorage, {
        subView: this.librarySubView,
        trackSortKey: this.libraryTrackSortKey,
        trackSortDir: this.libraryTrackSortDir,
        viewMode: this.viewMode,
      });
    },

    async loadLibraryCache() {
      try {
        const response = await fetch('/api/library');
        const data = await response.json();
        this.libraryCache = data.items || [];
      } catch (error) {
        console.error('Failed to load library cache:', error);
      }
    },

    // ============================================
    // Theme Management
    // ============================================

    changeTheme(newTheme) {
      this.theme = newTheme;
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      this.logAction('theme_change', { theme: newTheme });
    },

    // ============================================
    // View Mode Management
    // ============================================

    setViewMode(mode) {
      this.viewMode = mode;
      this.logAction('view_mode_change', { mode });
    },

    // ============================================
    // Collection Management
    // ============================================

    async loadCollection() {
      this.collectionLoading = true;
      try {
        const response = await fetch('/api/collection');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load collection');
        }

        this.collection = data.releases || [];
        this.collectionMetadata = data.metadata;
      } catch (error) {
        console.error('Failed to load collection:', error);
        this.showToast(error.message, 'error');
      } finally {
        this.collectionLoading = false;
        this.collectionInitialLoadComplete = true;
      }
    },

    async syncCollection() {
      this.collectionLoading = true;
      try {
        const response = await fetch('/api/collection/sync', {
          method: 'POST',
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to sync collection');
        }

        this.showToast(`Synced ${data.count} releases from Discogs`, 'success');
        this.logAction('collection_sync', { count: data.count });

        // Reload the collection
        await this.loadCollection();
      } catch (error) {
        console.error('Failed to sync collection:', error);
        this.showToast(error.message, 'error');
      } finally {
        this.collectionLoading = false;
      }
    },

    // ============================================
    // Toast Notifications
    // ============================================

    showToast(message, type = 'info') {
      const id = Date.now();
      this.toasts.push({ id, message, type });
      setTimeout(() => {
        this.toasts = this.toasts.filter((t) => t.id !== id);
      }, 3000);
    },

    // ============================================
    // View Details
    // ============================================

    async viewDetails(type, id) {
      this.logAction('view_details', { type, id });
      this.loading = true;
      try {
        const endpoint =
          type === 'master' ? `/api/master/${id}` : `/api/release/${id}`;
        const response = await fetch(endpoint);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch details');
        }

        const artists = data.artists
          ? data.artists.map((a) => a.name).join(', ')
          : 'Unknown Artist';
        const formats = data.formats
          ? data.formats.map((f) => f.name).join(', ')
          : '';

        // Get best available images
        const cover = data.images?.[0]?.uri || data.thumb || '';
        const thumb = data.images?.[0]?.uri150 || data.thumb || cover;

        const M = window.MoozhakDomain;
        const compilation =
          typeof M?.isCompilationRelease === 'function'
            ? M.isCompilationRelease(data)
            : false;

        const masterDiscogsId =
          data.master_id != null && data.master_id !== ''
            ? Number(data.master_id)
            : undefined;

        const inLibrary = this.libraryCache.some((item) => {
          if (
            type === 'master' &&
            typeof M?.libraryItemMatchesMasterId === 'function'
          ) {
            return M.libraryItemMatchesMasterId(item, id);
          }
          return String(item.discogsId) === String(id);
        });

        this.detailsData = {
          id,
          type,
          title: data.title || 'Unknown Title',
          artist: artists,
          year: data.year || '',
          format: formats,
          thumb: thumb,
          cover: cover,
          tracklist: data.tracklist || [],
          compilation,
          masterDiscogsId: Number.isFinite(masterDiscogsId)
            ? masterDiscogsId
            : undefined,
          inLibrary,
        };

        this.$refs.detailsModal.showModal();
      } catch (error) {
        console.error('Details error:', error);
        this.showToast(error.message, 'error');
      } finally {
        this.loading = false;
      }
    },

    /**
     * View library item details using cached data (no API call needed)
     */
    viewLibraryItem(id) {
      const item = this.libraryCache.find((i) => i.id === id);
      if (!item) {
        this.showToast('Item not found', 'error');
        return;
      }

      this.logAction('view_library_item', { id, title: item.title });

      this.detailsData = {
        id: item.discogsId,
        type: item.type || 'release',
        title: item.title || 'Unknown Title',
        artist: item.artist || 'Unknown Artist',
        year: item.year || '',
        format: item.format || '',
        thumb: item.thumb || '',
        cover: item.cover || item.thumb || '',
        sides: item.sides || [],
        boxSet: item.boxSet || null,
        compilation: !!item.compilation,
        inLibrary: true,
        libraryItemId: item.id,
      };

      this.$refs.detailsModal.showModal();
    },

    detailsTrackRowArtist(track) {
      const album = this.detailsData?.artist ?? '';
      const M = window.MoozhakDomain;
      if (M?.resolveTrackRowArtist) {
        return M.resolveTrackRowArtist(track, album);
      }
      return album || 'Unknown Artist';
    },

    membershipKeyForRow(row) {
      return `${row.libraryItemId}::${String(row.position ?? '').trim()}`;
    },

    isTrackRowInSet(row) {
      if (!this._trackMembershipSet) return false;
      return this._trackMembershipSet.has(this.membershipKeyForRow(row));
    },

    isDetailsTrackInSet(track) {
      if (!this.detailsData?.libraryItemId) return false;
      return this.isTrackRowInSet({
        libraryItemId: this.detailsData.libraryItemId,
        position: track.position,
        trackTitle: track.title,
      });
    },

    openTrackSetDialogFromRow(row) {
      this.openTrackSetDialog({
        libraryItemId: row.libraryItemId,
        trackPosition: row.position,
        trackTitle: row.trackTitle,
      });
    },

    openTrackSetDialogFromDetails(track) {
      if (!this.detailsData?.libraryItemId) return;
      this.openTrackSetDialog({
        libraryItemId: this.detailsData.libraryItemId,
        trackPosition: track.position,
        trackTitle: track.title,
      });
    },

    toggleLibraryTrackSort(key) {
      if (this.libraryTrackSortKey === key) {
        this.libraryTrackSortDir =
          this.libraryTrackSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        this.libraryTrackSortKey = key;
        this.libraryTrackSortDir = 'asc';
      }
    },

    sortedLibraryTrackRows() {
      const rows = [...this.libraryTrackRows];
      const key = this.libraryTrackSortKey;
      const dir = this.libraryTrackSortDir === 'asc' ? 1 : -1;
      const str = (v) =>
        String(v ?? '')
          .toLowerCase()
          .trim();
      const bpmCmp =
        window.MoozhakDomain?.bpmSortComparable ||
        ((v, asc) => {
          if (typeof v === 'number' && Number.isFinite(v)) return v;
          if (typeof v === 'string' && String(v).trim() !== '') {
            const n = Number(String(v).trim());
            if (Number.isFinite(n)) return n;
          }
          return asc ? Infinity : -Infinity;
        });
      rows.sort((a, b) => {
        let cmp = 0;
        if (key === 'bpm') {
          const asc = dir === 1;
          cmp = bpmCmp(a.bpm, asc) - bpmCmp(b.bpm, asc);
        } else if (key === 'key') {
          cmp = str(a.key).localeCompare(str(b.key));
        } else if (key === 'albumTitle') {
          cmp = str(a.albumTitle).localeCompare(str(b.albumTitle));
        } else if (key === 'artist') {
          cmp = str(a.artist).localeCompare(str(b.artist));
        } else {
          cmp = str(a.trackTitle).localeCompare(str(b.trackTitle));
        }
        return cmp * dir;
      });
      return rows;
    },

    tracksPayloadForApi(tracks) {
      return (tracks || []).map((t) => ({
        libraryItemId: t.libraryItemId,
        trackPosition:
          t.trackPosition !== undefined && t.trackPosition !== null
            ? t.trackPosition
            : t.position,
      }));
    },

    membershipKeyFromApiRow(t) {
      const pos =
        t.trackPosition !== undefined && t.trackPosition !== null
          ? t.trackPosition
          : t.position;
      return `${String(t.libraryItemId)}::${String(pos ?? '').trim()}`;
    },

    trackSetDialogMembershipKey() {
      const c = this.trackSetDialogContext;
      if (!c) return '';
      return `${String(c.libraryItemId)}::${String(c.trackPosition ?? '').trim()}`;
    },

    trackSetDialogPickerSets() {
      const all = this.trackSetDialogAllSets || [];
      const memberIds = new Set(
        (this.trackSetDialogMemberSets || []).map((s) => s.id),
      );
      return all.filter((s) => s.id && !memberIds.has(s.id));
    },

    async openTrackSetDialog(ctx) {
      this.trackSetDialogContext = {
        libraryItemId: ctx.libraryItemId,
        trackPosition: ctx.trackPosition,
        trackTitle: ctx.trackTitle,
      };
      this.trackSetDialogSelectedSetId = '';
      this.trackSetDialogAllSets = [];
      this.trackSetDialogMemberSets = [];
      this.trackSetDialogLoading = true;
      this.$refs.manageTrackSetModal.showModal();
      const params = new URLSearchParams({
        libraryItemId: String(ctx.libraryItemId),
        trackPosition: String(ctx.trackPosition ?? ''),
      });
      try {
        const [rList, rBy] = await Promise.all([
          fetch('/api/setlists'),
          fetch(`/api/setlists/by-track?${params}`),
        ]);
        const dList = await rList.json();
        const dBy = await rBy.json();
        if (!rList.ok) throw new Error(dList.error || 'Could not load sets');
        if (!rBy.ok) throw new Error(dBy.error || 'Could not load membership');
        this.trackSetDialogAllSets = dList.setlists || [];
        this.trackSetDialogMemberSets = dBy.sets || [];
      } catch (e) {
        this.showToast(e.message || 'Could not load', 'error');
        this.trackSetDialogAllSets = [];
        this.trackSetDialogMemberSets = [];
      } finally {
        this.trackSetDialogLoading = false;
      }
    },

    closeTrackSetDialog() {
      this.trackSetDialogContext = null;
      this.trackSetDialogAllSets = [];
      this.trackSetDialogMemberSets = [];
      this.trackSetDialogSelectedSetId = '';
      this.trackSetDialogLoading = false;
      this.$refs.manageTrackSetModal?.close();
    },

    async addTrackToSelectedSet() {
      const ctx = this.trackSetDialogContext;
      const setId = this.trackSetDialogSelectedSetId;
      if (!ctx || !setId) return;
      this.loading = true;
      try {
        const gr = await fetch(`/api/setlists/${setId}`);
        const s = await gr.json();
        if (!gr.ok) throw new Error(s.error || 'Set not found');
        const payload = this.tracksPayloadForApi(s.tracks);
        const next = [...payload];
        next.push({
          libraryItemId: ctx.libraryItemId,
          trackPosition: ctx.trackPosition,
        });
        const pr = await fetch(`/api/setlists/${setId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: s.name,
            notes: s.notes ?? '',
            tracks: next,
          }),
        });
        const out = await pr.json();
        if (!pr.ok) throw new Error(out.error || 'Save failed');
        this.showToast('Added to set', 'success');
        this.closeTrackSetDialog();
        this.$refs.detailsModal?.close();
        window.location.reload();
      } catch (e) {
        this.showToast(e.message || 'Error', 'error');
      } finally {
        this.loading = false;
      }
    },

    async createNewSetWithTrack() {
      const ctx = this.trackSetDialogContext;
      if (!ctx) return;
      this.loading = true;
      try {
        const pr = await fetch('/api/setlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'New set',
            notes: '',
            tracks: [
              {
                libraryItemId: ctx.libraryItemId,
                trackPosition: ctx.trackPosition,
              },
            ],
          }),
        });
        const out = await pr.json();
        if (!pr.ok) throw new Error(out.error || 'Create failed');
        this.showToast('Set created', 'success');
        this.closeTrackSetDialog();
        this.$refs.detailsModal?.close();
        window.location.href = `/sets/${out.id}`;
      } catch (e) {
        this.showToast(e.message || 'Error', 'error');
      } finally {
        this.loading = false;
      }
    },

    async removeTrackFromMemberSet(setId) {
      const ctx = this.trackSetDialogContext;
      if (!ctx) return;
      const want = this.trackSetDialogMembershipKey();
      this.loading = true;
      try {
        const gr = await fetch(`/api/setlists/${setId}`);
        const s = await gr.json();
        if (!gr.ok) throw new Error(s.error || 'Set not found');
        const next = this.tracksPayloadForApi(s.tracks).filter(
          (t) => this.membershipKeyFromApiRow(t) !== want,
        );
        const pr = await fetch(`/api/setlists/${setId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: s.name,
            notes: s.notes ?? '',
            tracks: next,
          }),
        });
        const out = await pr.json();
        if (!pr.ok) throw new Error(out.error || 'Save failed');
        this.showToast('Removed from set', 'success');
        this.closeTrackSetDialog();
        this.$refs.detailsModal?.close();
        window.location.reload();
      } catch (e) {
        this.showToast(e.message || 'Error', 'error');
      } finally {
        this.loading = false;
      }
    },

    async duplicateTrackInMemberSet(setId) {
      const ctx = this.trackSetDialogContext;
      if (!ctx) return;
      this.loading = true;
      try {
        const gr = await fetch(`/api/setlists/${setId}`);
        const s = await gr.json();
        if (!gr.ok) throw new Error(s.error || 'Set not found');
        const payload = this.tracksPayloadForApi(s.tracks);
        const next = [
          ...payload,
          {
            libraryItemId: ctx.libraryItemId,
            trackPosition: ctx.trackPosition,
          },
        ];
        const pr = await fetch(`/api/setlists/${setId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: s.name,
            notes: s.notes ?? '',
            tracks: next,
          }),
        });
        const out = await pr.json();
        if (!pr.ok) throw new Error(out.error || 'Save failed');
        this.showToast('Duplicated in set', 'success');
        this.closeTrackSetDialog();
        this.$refs.detailsModal?.close();
        window.location.reload();
      } catch (e) {
        this.showToast(e.message || 'Error', 'error');
      } finally {
        this.loading = false;
      }
    },

    refreshSetEditorStats() {
      const tracks = this.setEditor?.tracks || [];
      const trackCount = tracks.length;
      const numBpm = window.MoozhakDomain?.numericBpmOrNull;
      const bpms = tracks
        .map((t) => {
          if (typeof numBpm === 'function') return numBpm(t.bpm);
          if (typeof t.bpm === 'number' && Number.isFinite(t.bpm)) return t.bpm;
          if (typeof t.bpm === 'string' && String(t.bpm).trim() !== '') {
            const n = Number(String(t.bpm).trim());
            return Number.isFinite(n) ? n : null;
          }
          return null;
        })
        .filter((b) => b != null);
      if (bpms.length === 0) {
        this.setEditorStats = {
          trackCount,
          bpmMin: null,
          bpmMax: null,
          bpmAverage: null,
        };
        return;
      }
      const sum = bpms.reduce((a, b) => a + b, 0);
      this.setEditorStats = {
        trackCount,
        bpmMin: Math.min(...bpms),
        bpmMax: Math.max(...bpms),
        bpmAverage: Math.round((sum / bpms.length) * 10) / 10,
      };
    },

    moveSetTrack(index, delta) {
      if (!this.setEditor?.tracks) return;
      const arr = this.setEditor.tracks;
      const j = index + delta;
      if (j < 0 || j >= arr.length) return;
      const t = arr[index];
      arr[index] = arr[j];
      arr[j] = t;
      this.refreshSetEditorStats();
    },

    removeSetTrack(index) {
      if (!this.setEditor?.tracks) return;
      this.setEditor.tracks.splice(index, 1);
      this.refreshSetEditorStats();
    },

    async saveSetEditor() {
      if (!this.setEditor?.id) return;
      this.loading = true;
      try {
        const body = {
          name: this.setEditor.name,
          notes: this.setEditor.notes ?? '',
          tracks: this.tracksPayloadForApi(this.setEditor.tracks),
        };
        const r = await fetch(`/api/setlists/${this.setEditor.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Save failed');
        this.setEditor = d;
        this.refreshSetEditorStats();
        this.showToast('Set saved', 'success');
        window.location.reload();
      } catch (e) {
        this.showToast(e.message || 'Error', 'error');
      } finally {
        this.loading = false;
      }
    },

    async deleteCurrentSet() {
      if (!this.setEditor?.id) return;
      if (!window.confirm('Delete this set permanently?')) return;
      this.loading = true;
      try {
        const r = await fetch(`/api/setlists/${this.setEditor.id}`, {
          method: 'DELETE',
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || 'Delete failed');
        this.showToast('Set deleted', 'success');
        window.location.href = '/sets';
      } catch (e) {
        this.showToast(e.message || 'Error', 'error');
      } finally {
        this.loading = false;
      }
    },

    /**
     * View collection item details (fetches tracklist from API)
     */
    async viewCollectionItem(item) {
      // Collection items need to fetch tracklist from API
      await this.viewDetails('release', item.discogsId);
    },

    // ============================================
    // Add to Library
    // ============================================

    async addToLibraryFromDetails() {
      if (!this.detailsData) return;

      this.logAction('add_to_library_from_details', {
        type: this.detailsData.type,
        id: this.detailsData.id,
        title: this.detailsData.title,
      });
      this.loading = true;
      try {
        const response = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discogsId: this.detailsData.id,
            type: this.detailsData.type,
            title: this.detailsData.title,
            artist: this.detailsData.artist,
            year: this.detailsData.year,
            format: this.detailsData.format,
            thumb: this.detailsData.thumb,
            cover: this.detailsData.cover,
            tracklist: this.detailsData.tracklist,
            compilation: !!this.detailsData.compilation,
            ...(this.detailsData.masterDiscogsId != null
              ? { masterDiscogsId: this.detailsData.masterDiscogsId }
              : {}),
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add to library');
        }

        if (data.boxSet && Array.isArray(data.items)) {
          data.items.forEach((item) => this.libraryCache.push(item));
        } else {
          this.libraryCache.push(data);
        }
        const toastMsg =
          data.addedFromCollection === true
            ? 'Added your collection pressing to the library!'
            : 'Added to library!';
        this.showToast(toastMsg, 'success');
        this.$refs.detailsModal.close();
        window.location.reload();
      } catch (error) {
        console.error('Add to library error:', error);
        this.showToast(error.message, 'error');
      } finally {
        this.loading = false;
      }
    },

    async quickAdd(type, id) {
      this.logAction('quick_add', { type, id });
      this.loading = true;
      try {
        const endpoint =
          type === 'master' ? `/api/master/${id}` : `/api/release/${id}`;
        const response = await fetch(endpoint);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch details');
        }

        const artists = data.artists
          ? data.artists.map((a) => a.name).join(', ')
          : 'Unknown Artist';
        const formats = data.formats
          ? data.formats.map((f) => f.name).join(', ')
          : '';

        // Get best available images
        const cover = data.images?.[0]?.uri || data.thumb || '';
        const thumb = data.images?.[0]?.uri150 || data.thumb || cover;

        const M = window.MoozhakDomain;
        const compilation =
          typeof M?.isCompilationRelease === 'function'
            ? M.isCompilationRelease(data)
            : false;

        /** @type {Record<string, unknown>} */
        const payload = {
          discogsId: id,
          type,
          title: data.title,
          artist: artists,
          year: data.year || '',
          format: formats,
          thumb: thumb,
          cover: cover,
          tracklist: data.tracklist || [],
          compilation,
        };
        if (type === 'release' && data.master_id != null && data.master_id !== '') {
          const mid = Number(data.master_id);
          if (Number.isFinite(mid)) payload.masterDiscogsId = mid;
        }

        const addResponse = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const addData = await addResponse.json();

        if (!addResponse.ok) {
          throw new Error(addData.error || 'Failed to add to library');
        }

        if (addData.boxSet && Array.isArray(addData.items)) {
          addData.items.forEach((item) => this.libraryCache.push(item));
        } else {
          this.libraryCache.push(addData);
        }
        const toastMsg =
          addData.addedFromCollection === true
            ? 'Added your collection pressing to the library!'
            : 'Added to library!';
        this.showToast(toastMsg, 'success');
        window.location.reload();
      } catch (error) {
        console.error('Quick add error:', error);
        this.showToast(error.message, 'error');
      } finally {
        this.loading = false;
      }
    },

    // ============================================
    // Delete Item
    // ============================================

    /**
     * Show delete confirmation modal
     */
    async deleteItem(id) {
      const item = this.libraryCache.find((i) => i.id === id);
      if (!item) {
        this.showToast('Item not found', 'error');
        return;
      }
      this.deleteTarget = item;
      this.deleteSetWarnings = [];
      try {
        const r = await fetch(`/api/library/${id}/set-usage`);
        const d = await r.json();
        if (r.ok && Array.isArray(d.sets)) {
          this.deleteSetWarnings = d.sets;
        }
      } catch {
        /* ignore */
      }
      this.$refs.deleteModal.showModal();
    },

    /**
     * Cancel delete and close modal
     */
    cancelDelete() {
      this.deleteTarget = null;
      this.deleteSetWarnings = [];
      this.$refs.deleteModal.close();
    },

    /**
     * Confirm and execute delete
     */
    async confirmDelete() {
      if (!this.deleteTarget) return;

      const id = this.deleteTarget.id;
      this.logAction('delete_item', { id });
      this.loading = true;
      this.$refs.deleteModal.close();

      try {
        const response = await fetch(`/api/library/${id}`, {
          method: 'DELETE',
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to delete');
        }

        this.libraryCache = this.libraryCache.filter((i) => i.id !== id);
        this.deleteTarget = null;
        this.showToast('Removed from library', 'success');
        window.location.reload();
      } catch (error) {
        console.error('Delete error:', error);
        this.showToast(error.message, 'error');
      } finally {
        this.loading = false;
      }
    },
  };
}

// biome-ignore lint/correctness/noUnusedVariables: used by Alpine.js in settings.ejs x-data
function moozhakSettingsPage() {
  return {
    discogsUsername: '',
    discogsTokenInput: '',
    getBpmApiKeyInput: '',
    discogsTokenSet: false,
    getSongBpmKeySet: false,
    saving: false,
    bannerMessage: '',
    bannerType: 'success',

    async init() {
      try {
        await this.reloadFromServer();
      } catch (e) {
        console.error(e);
        this.showBanner('Could not load settings from server.', 'error');
      }
    },

    async reloadFromServer() {
      const response = await fetch('/api/settings');
      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error('Invalid response from server');
      }
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load settings');
      }
      this.discogsUsername = data.discogsUsername || '';
      this.discogsTokenInput = data.discogsToken ?? '';
      this.getBpmApiKeyInput = data.getBpmApiKey ?? '';
      this.discogsTokenSet = Boolean(data.discogsTokenSet);
      this.getSongBpmKeySet = Boolean(data.getSongBpmKeySet);
    },

    showBanner(message, type = 'success') {
      this.bannerMessage = message;
      this.bannerType = type;
      setTimeout(() => {
        this.bannerMessage = '';
      }, 4000);
    },

    async save() {
      this.saving = true;
      this.bannerMessage = '';
      try {
        const body = {
          discogsUsername: this.discogsUsername,
          discogsToken: this.discogsTokenInput.trim(),
          getBpmApiKey: this.getBpmApiKeyInput.trim(),
        };
        const response = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        let data = {};
        try {
          data = await response.json();
        } catch {
          throw new Error('Invalid response from server');
        }
        if (!response.ok) {
          throw new Error(data.error || 'Save failed');
        }
        await this.reloadFromServer();
        this.showBanner('Settings saved.', 'success');
      } catch (error) {
        console.error(error);
        const msg = error instanceof Error ? error.message : 'Save failed';
        this.showBanner(msg, 'error');
      } finally {
        this.saving = false;
      }
    },
  };
}
