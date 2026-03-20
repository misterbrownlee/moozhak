// ============================================
// Vinyl Library - Alpine.js Application
// ============================================

// biome-ignore lint/correctness/noUnusedVariables: used by Alpine.js in HTML x-data
function vinylApp() {
  return {
    // State
    loading: false,
    theme: localStorage.getItem('theme') || 'dark',
    viewMode: localStorage.getItem('viewMode') || 'cards',
    toasts: [],
    libraryCache: [],

    // Collection state
    collection: [],
    collectionMetadata: null,
    collectionLoading: false,

    // Modal state
    detailsData: null,
    deleteTarget: null, // Item pending deletion confirmation

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
      localStorage.setItem('viewMode', mode);
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
          inLibrary: this.libraryCache.some(
            (item) => String(item.discogsId) === String(id),
          ),
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
        inLibrary: true,
      };

      this.$refs.detailsModal.showModal();
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
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to add to library');
        }

        this.libraryCache.push(data);
        this.showToast('Added to library!', 'success');
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

        const addResponse = await fetch('/api/library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            discogsId: id,
            type,
            title: data.title,
            artist: artists,
            year: data.year || '',
            format: formats,
            thumb: thumb,
            cover: cover,
            tracklist: data.tracklist || [],
          }),
        });

        const addData = await addResponse.json();

        if (!addResponse.ok) {
          throw new Error(addData.error || 'Failed to add to library');
        }

        this.libraryCache.push(addData);
        this.showToast('Added to library!', 'success');
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
    deleteItem(id) {
      const item = this.libraryCache.find((i) => i.id === id);
      if (!item) {
        this.showToast('Item not found', 'error');
        return;
      }
      this.deleteTarget = item;
      this.$refs.deleteModal.showModal();
    },

    /**
     * Cancel delete and close modal
     */
    cancelDelete() {
      this.deleteTarget = null;
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
