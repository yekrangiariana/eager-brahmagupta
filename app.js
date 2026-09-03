/**
 * LAPIS — Self-Growth Art Discovery Single Page Application
 * Vanilla ES6+ JavaScript Application Engine
 * Exclusive Integration: The Metropolitan Museum of Art Collection (Custom Era Ranges & Mobile PWA Engine)
 */

(function () {
  'use strict';

  // ==========================================================================
  // Application State
  // ==========================================================================
  const state = {
    dateBegin: 1300,
    dateEnd: 1599,
    metObjectIDs: [],
    deck: [],
    currentIndex: 0,
    history: new Set(),
    favorites: new Set(),
    activeView: 'discovery', // 'discovery' | 'collection'
    activeCenturyFilter: 'all', // 'all' | '14th' | '15th' | '16th'
    favoritesOnlyFilter: false,
    metCache: new Map(),
    isFlipped: false,
    isLoadingMetBatch: false,
    totalMetCount: 0
  };

  // LocalStorage Keys
  const STORAGE_KEYS = {
    HISTORY: 'lapis_history_met_era_v6',
    FAVORITES: 'lapis_favorites_met_era_v6'
  };

  // ==========================================================================
  // DOM Element References
  // ==========================================================================
  const elements = {
    // Navigation Tabs & Era Controls
    tabDiscovery: document.getElementById('tab-discovery'),
    tabCollection: document.getElementById('tab-collection'),
    viewDiscovery: document.getElementById('view-discovery'),
    viewCollection: document.getElementById('view-collection'),
    eraSelect: document.getElementById('era-select'),
    eraCountBadge: document.getElementById('era-count-badge'),

    // Discovery Card Elements
    cardArea: document.getElementById('card-perspective-area'),
    card3D: document.getElementById('painting-card'),
    frontSkeleton: document.getElementById('front-skeleton'),
    frontCenturyBadge: document.getElementById('front-century-badge'),
    frontSourceBadge: document.getElementById('front-source-badge'),
    frontImg: document.getElementById('front-painting-img'),
    frontTitle: document.getElementById('front-painting-title'),
    frontArtistYear: document.getElementById('front-painting-artist-year'),
    btnCardFav: document.getElementById('btn-card-fav'),
    btnTapFlipHint: document.getElementById('btn-tap-flip-hint'),

    // Card Back Elements
    backTitle: document.getElementById('back-painting-title'),
    backArtist: document.getElementById('back-painting-artist'),
    backMedium: document.getElementById('back-medium'),
    backLocation: document.getElementById('back-location'),
    backRegion: document.getElementById('back-region'),
    backAnalysis: document.getElementById('back-analysis'),
    backHistoricalContext: document.getElementById('back-historical-context'),
    backWikiText: document.getElementById('back-wiki-extract-text'),
    backWikiLink: document.getElementById('back-wiki-link'),

    // Discovery Controls
    btnPrev: document.getElementById('btn-prev'),
    btnFlip: document.getElementById('btn-flip'),
    btnNext: document.getElementById('btn-next'),
    btnFavToolbar: document.getElementById('btn-fav-toolbar'),
    btnShuffle: document.getElementById('btn-shuffle'),
    btnZoom: document.getElementById('btn-zoom'),

    // Collection View Elements
    progressText: document.getElementById('progress-text'),
    progressFill: document.getElementById('progress-fill'),
    filterPills: document.querySelectorAll('.filter-pill'),
    btnFavFilter: document.getElementById('btn-fav-filter'),
    galleryGrid: document.getElementById('gallery-grid'),
    emptyGridMsg: document.getElementById('empty-grid-msg'),
    btnLoadMoreMet: document.getElementById('btn-load-more-met'),

    // Modals
    modalZoom: document.getElementById('modal-zoom'),
    zoomImg: document.getElementById('zoom-img'),
    zoomCaption: document.getElementById('zoom-caption'),
    btnCloseZoom: document.getElementById('btn-close-zoom'),

    modalDetail: document.getElementById('modal-detail'),
    detailModalBody: document.getElementById('detail-modal-body'),
    btnCloseDetail: document.getElementById('btn-close-detail')
  };

  // ==========================================================================
  // Service Worker Registration for PWA Support
  // ==========================================================================
  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((reg) => {
          console.log('[Lapis PWA] ServiceWorker registered with scope:', reg.scope);
        }).catch((err) => {
          console.warn('[Lapis PWA] ServiceWorker registration failed:', err);
        });
      });
    }
  }

  // ==========================================================================
  // Met Museum API Engine (Dynamic Date Ranges)
  // ==========================================================================

  /**
   * Fetch object IDs from Metropolitan Museum of Art API for selected date range
   */
  async function fetchMetObjectIDsForEra(dateBegin, dateEnd) {
    state.dateBegin = dateBegin;
    state.dateEnd = dateEnd;

    if (elements.eraCountBadge) {
      elements.eraCountBadge.textContent = '⏳ Querying API...';
    }

    const metSearchUrl = `https://collectionapi.metmuseum.org/public/collection/v1/search?medium=Paintings&dateBegin=${dateBegin}&dateEnd=${dateEnd}&hasImages=true&q=painting`;

    try {
      const resp = await fetch(metSearchUrl);
      if (!resp.ok) throw new Error(`Met API Error: ${resp.status}`);
      const data = await resp.json();

      if (data.objectIDs && data.objectIDs.length) {
        state.metObjectIDs = data.objectIDs;
        state.totalMetCount = data.objectIDs.length;
        
        if (elements.eraCountBadge) {
          elements.eraCountBadge.textContent = `${state.totalMetCount.toLocaleString()} Works`;
        }

        // Reset current deck for new era
        state.deck = [];
        state.currentIndex = 0;

        // Fetch initial batch of 20 paintings from this era
        await loadBatchMetItems(20);
      } else {
        state.metObjectIDs = [];
        state.totalMetCount = 0;
        if (elements.eraCountBadge) {
          elements.eraCountBadge.textContent = '0 Works Found';
        }
      }
    } catch (err) {
      console.warn('Met Museum API search failed:', err);
      if (elements.eraCountBadge) {
        elements.eraCountBadge.textContent = 'API Offline';
      }
    }
  }

  /**
   * Determine century or era tag from objectDate string
   */
  function formatEraBadge(dateStr) {
    if (!dateStr) return 'Historical Art';

    if (dateStr.toLowerCase().includes('bce') || dateStr.toLowerCase().includes('bc')) {
      return 'BCE Ancient Art';
    }

    const numbers = dateStr.match(/\d{4}/g);
    let year = 1500;
    if (numbers && numbers.length) {
      year = parseInt(numbers[0], 10);
    } else {
      const match3 = dateStr.match(/\d{3}/g);
      if (match3) year = parseInt(match3[0], 10);
    }

    const centuryNum = Math.floor(year / 100) + 1;
    if (centuryNum === 14) return '14th Century';
    if (centuryNum === 15) return '15th Century';
    if (centuryNum === 16) return '16th Century';
    if (centuryNum === 17) return '17th Century';
    if (centuryNum === 18) return '18th Century';
    if (centuryNum === 19) return '19th Century';
    if (centuryNum === 20) return '20th Century';

    return `${centuryNum}th Century`;
  }

  /**
   * Fetch object details for a single Met Museum Object ID
   */
  async function fetchMetObjectDetails(objectID) {
    if (state.metCache.has(objectID)) {
      return state.metCache.get(objectID);
    }

    const objUrl = `https://collectionapi.metmuseum.org/public/collection/v1/objects/${objectID}`;
    try {
      const resp = await fetch(objUrl);
      if (!resp.ok) return null;
      const obj = await resp.json();

      if (!obj.primaryImageSmall && !obj.primaryImage) return null;

      const eraBadge = formatEraBadge(obj.objectDate);
      const artist = obj.artistDisplayName || obj.artistAlphaSort || 'European / Global Master';
      const year = obj.objectDate || 'Historical Period';
      const medium = obj.medium || 'Oil / Tempera on canvas or panel';
      const location = obj.repository || 'The Metropolitan Museum of Art, New York';
      const culture = obj.culture || obj.department || 'Met Museum Collection';

      const paintingItem = {
        id: `met_${objectID}`,
        metID: objectID,
        title: obj.title || 'Untitled Masterpiece',
        artist: artist,
        year: year,
        century: eraBadge,
        region: culture,
        medium: medium,
        location: location,
        compressedImage: obj.primaryImageSmall || obj.primaryImage,
        highResImage: obj.primaryImage || obj.primaryImageSmall,
        webUrl: obj.objectURL || `https://www.metmuseum.org/art/collection/search/${objectID}`,
        analysis: `Masterpiece from the Metropolitan Museum of Art collection. Demonstrates distinctive ${culture} composition, period techniques, and style from ${year}.`,
        historicalContext: `Preserved by the Met Museum as an outstanding cultural work reflecting artistic traditions of ${eraBadge}.`
      };

      state.metCache.set(objectID, paintingItem);
      return paintingItem;
    } catch (err) {
      return null;
    }
  }

  /**
   * Batch fetch Met items and add them to deck & collection
   */
  async function loadBatchMetItems(targetCount = 20) {
    if (!state.metObjectIDs.length || state.isLoadingMetBatch) return;
    state.isLoadingMetBatch = true;

    if (elements.btnLoadMoreMet) {
      elements.btnLoadMoreMet.textContent = '⏳ Fetching Masterpieces from Met Museum...';
      elements.btnLoadMoreMet.disabled = true;
    }

    const shuffledIDs = [...state.metObjectIDs].sort(() => 0.5 - Math.random());

    let added = 0;
    for (const oid of shuffledIDs) {
      if (state.deck.some(p => p.metID === oid)) continue;

      const metItem = await fetchMetObjectDetails(oid);
      if (metItem) {
        state.deck.push(metItem);
        added++;
        if (added >= targetCount) break;
      }
    }

    state.isLoadingMetBatch = false;

    if (elements.btnLoadMoreMet) {
      elements.btnLoadMoreMet.innerHTML = '<span>🏛️</span> Load 20 More Masterpieces from Met Museum';
      elements.btnLoadMoreMet.disabled = false;
    }

    renderCurrentCard();

    if (state.activeView === 'collection') {
      renderCollectionGrid();
    }
  }

  // ==========================================================================
  // LocalStorage Persistence
  // ==========================================================================

  function loadStateFromStorage() {
    try {
      const savedHistory = localStorage.getItem(STORAGE_KEYS.HISTORY);
      if (savedHistory) state.history = new Set(JSON.parse(savedHistory));

      const savedFavorites = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (savedFavorites) state.favorites = new Set(JSON.parse(savedFavorites));
    } catch (error) {
      console.error('Error reading from localStorage:', error);
    }
  }

  function saveStateToStorage() {
    try {
      localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(Array.from(state.history)));
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(Array.from(state.favorites)));
    } catch (error) {
      console.error('Error saving to localStorage:', error);
    }
  }

  // ==========================================================================
  // Discovery Renderers & Card Controls
  // ==========================================================================

  async function renderCurrentCard() {
    if (!state.deck.length) return;

    let painting = state.deck[state.currentIndex];
    if (!painting) return;

    if (state.isFlipped) {
      unflipCard();
    }

    state.history.add(painting.id);
    saveStateToStorage();
    updateProgressBar();

    elements.frontTitle.textContent = painting.title;
    elements.frontArtistYear.textContent = `${painting.artist} • ${painting.year}`;
    elements.frontCenturyBadge.textContent = painting.century;
    elements.frontSourceBadge.textContent = 'The Met Museum';

    updateFavoriteButtons(painting.id);

    elements.backTitle.textContent = painting.title;
    elements.backArtist.textContent = `${painting.artist} (${painting.year})`;
    elements.backMedium.textContent = painting.medium;
    elements.backLocation.textContent = painting.location;
    elements.backRegion.textContent = painting.region;
    elements.backAnalysis.textContent = painting.analysis;
    elements.backHistoricalContext.textContent = painting.historicalContext;

    elements.backWikiText.textContent = `Official accession record from The Metropolitan Museum of Art Collection.`;
    elements.backWikiLink.href = painting.webUrl;
    elements.backWikiLink.textContent = 'View Official Record on MetMuseum.org ↗';

    elements.frontSkeleton.style.display = 'block';
    elements.frontImg.style.opacity = '0';
    elements.frontImg.alt = `${painting.title} by ${painting.artist}`;

    elements.frontImg.onload = () => {
      elements.frontSkeleton.style.display = 'none';
      elements.frontImg.style.opacity = '1';
    };

    elements.frontImg.onerror = () => {
      elements.frontSkeleton.style.display = 'none';
      elements.frontImg.style.opacity = '1';
    };

    elements.frontImg.src = painting.compressedImage;
  }

  function toggleCardFlip() {
    state.isFlipped = !state.isFlipped;
    elements.card3D.classList.toggle('flipped', state.isFlipped);
  }

  function unflipCard() {
    state.isFlipped = false;
    elements.card3D.classList.remove('flipped');
  }

  async function nextCard() {
    if (!state.deck.length) return;
    state.currentIndex++;
    if (state.currentIndex >= state.deck.length - 2) {
      loadBatchMetItems(10);
    }
    if (state.currentIndex >= state.deck.length) {
      state.currentIndex = 0;
    }
    renderCurrentCard();
  }

  function prevCard() {
    if (!state.deck.length) return;
    state.currentIndex = (state.currentIndex - 1 + state.deck.length) % state.deck.length;
    renderCurrentCard();
  }

  function shuffleDeck() {
    for (let i = state.deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.deck[i], state.deck[j]] = [state.deck[j], state.deck[i]];
    }
    state.currentIndex = 0;
    renderCurrentCard();
  }

  function toggleCurrentFavorite() {
    const currentPainting = state.deck[state.currentIndex];
    if (!currentPainting) return;

    if (state.favorites.has(currentPainting.id)) {
      state.favorites.delete(currentPainting.id);
    } else {
      state.favorites.add(currentPainting.id);
    }

    saveStateToStorage();
    updateFavoriteButtons(currentPainting.id);
    if (state.activeView === 'collection') {
      renderCollectionGrid();
    }
  }

  function updateFavoriteButtons(paintingId) {
    const isFav = state.favorites.has(paintingId);
    elements.btnCardFav.classList.toggle('is-favorite', isFav);
    elements.btnCardFav.innerHTML = isFav ? '★ Starred' : '★ Star';

    elements.btnFavToolbar.classList.toggle('is-favorite', isFav);
    elements.btnFavToolbar.innerHTML = isFav ? '<span class="star-icon">⭐</span> Starred' : '<span class="star-icon">⭐</span> Star Favorite';
  }

  // ==========================================================================
  // Collection View Renderer
  // ==========================================================================

  function updateProgressBar() {
    const explored = state.history.size;
    const totalLoaded = state.deck.length;
    const percentage = totalLoaded > 0 ? Math.round((explored / totalLoaded) * 100) : 0;

    elements.progressText.textContent = `Explored ${explored} of ${totalLoaded} Loaded Met Works (${state.totalMetCount.toLocaleString()} Total in Era)`;
    elements.progressFill.style.width = `${Math.min(percentage, 100)}%`;
  }

  function renderCollectionGrid() {
    updateProgressBar();

    let filtered = state.deck.filter(p => {
      if (state.activeCenturyFilter !== 'all') {
        if (!p.century.includes(state.activeCenturyFilter.replace('th', ''))) return false;
      }
      if (state.favoritesOnlyFilter) {
        if (!state.favorites.has(p.id)) return false;
      }
      return true;
    });

    elements.galleryGrid.innerHTML = '';

    if (!filtered.length) {
      elements.emptyGridMsg.style.display = 'block';
      return;
    }

    elements.emptyGridMsg.style.display = 'none';

    filtered.forEach(painting => {
      const isFav = state.favorites.has(painting.id);
      const isSeen = state.history.has(painting.id);

      const card = document.createElement('div');
      card.className = 'grid-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      card.innerHTML = `
        <div class="grid-thumb-box">
          <span class="grid-century-tag">${painting.century}</span>
          ${isFav ? '<span class="grid-fav-icon">★</span>' : ''}
          <img class="grid-thumb" src="${painting.compressedImage}" alt="${painting.title}" loading="lazy">
        </div>
        <div class="grid-card-info">
          <h3 class="grid-card-title">${painting.title}</h3>
          <p class="grid-card-artist">${painting.artist}</p>
          <div class="grid-card-meta">
            <span>${painting.year}</span>
            <span class="status-seen-tag">${isSeen ? '✓ Explored' : 'Unseen'}</span>
          </div>
        </div>
      `;

      card.addEventListener('click', () => openDetailModal(painting));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openDetailModal(painting);
        }
      });

      elements.galleryGrid.appendChild(card);
    });
  }

  // ==========================================================================
  // Modals Controller
  // ==========================================================================

  function openZoomModal() {
    const painting = state.deck[state.currentIndex];
    if (!painting) return;

    elements.zoomImg.src = painting.highResImage || painting.compressedImage;
    elements.zoomCaption.textContent = `"${painting.title}" (${painting.year}) by ${painting.artist} — ${painting.location}`;
    elements.modalZoom.classList.add('active');
  }

  function closeZoomModal() {
    elements.modalZoom.classList.remove('active');
  }

  function openDetailModal(painting) {
    elements.detailModalBody.innerHTML = `
      <div class="detail-modal-img-box">
        <img src="${painting.compressedImage}" alt="${painting.title}">
      </div>
      <div class="detail-modal-info">
        <div>
          <span class="century-badge" style="position:static; display:inline-block; margin-bottom:8px;">${painting.century}</span>
          <h2 style="font-size:1.6rem; color:var(--text-gold); font-family:var(--font-heading);">${painting.title}</h2>
          <p style="font-size:1rem; color:var(--text-parchment); font-weight:600; margin-top:2px;">${painting.artist} • ${painting.year}</p>
        </div>

        <div class="museum-placard" style="margin-bottom:0;">
          <div class="placard-row"><span class="placard-label">Medium:</span> <span>${painting.medium}</span></div>
          <div class="placard-row"><span class="placard-label">Location:</span> <span>${painting.location}</span></div>
          <div class="placard-row"><span class="placard-label">Culture/Era:</span> <span>${painting.region}</span></div>
        </div>

        <div class="analysis-section">
          <h4 class="analysis-heading">🎨 Art Analysis</h4>
          <p class="analysis-text">${painting.analysis}</p>
        </div>

        <div class="analysis-section">
          <h4 class="analysis-heading">📜 Historical Context</h4>
          <p class="analysis-text">${painting.historicalContext}</p>
        </div>

        <div class="wiki-excerpt-box">
          <div class="wiki-excerpt-title">🏛️ Met Museum Accession Record</div>
          <p class="wiki-extract-text">Official accession record from The Metropolitan Museum of Art Collection.</p>
          <a class="wiki-link" href="${painting.webUrl}" target="_blank" rel="noopener noreferrer">View Record on MetMuseum.org ↗</a>
        </div>
      </div>
    `;

    elements.modalDetail.classList.add('active');
  }

  function closeDetailModal() {
    elements.modalDetail.classList.remove('active');
  }

  // ==========================================================================
  // Touch Gestures & Keyboard Shortcuts
  // ==========================================================================

  let touchStartX = 0;
  let touchStartY = 0;

  function initTouchGestures() {
    elements.cardArea.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
      }
    }, { passive: true });

    elements.cardArea.addEventListener('touchend', (e) => {
      if (e.changedTouches.length === 1) {
        const deltaX = e.changedTouches[0].clientX - touchStartX;
        const deltaY = e.changedTouches[0].clientY - touchStartY;

        if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
          if (deltaX < 0) nextCard();
          else prevCard();
        }
      }
    }, { passive: true });
  }

  function initKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (elements.modalZoom.classList.contains('active') || elements.modalDetail.classList.contains('active')) {
        if (e.key === 'Escape') {
          closeZoomModal();
          closeDetailModal();
        }
        return;
      }

      if (state.activeView !== 'discovery') return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          toggleCardFlip();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          prevCard();
          break;
        case 'ArrowRight':
          e.preventDefault();
          nextCard();
          break;
        case 'f':
        case 'F':
          e.preventDefault();
          toggleCurrentFavorite();
          break;
      }
    });
  }

  // ==========================================================================
  // Initialization & Event Listeners
  // ==========================================================================

  function initEventListeners() {
    elements.tabDiscovery.addEventListener('click', () => switchView('discovery'));
    elements.tabCollection.addEventListener('click', () => switchView('collection'));

    if (elements.eraSelect) {
      elements.eraSelect.addEventListener('change', (e) => {
        const [begin, end] = e.target.value.split('_').map(Number);
        fetchMetObjectIDsForEra(begin, end);
      });
    }

    elements.card3D.addEventListener('click', (e) => {
      if (e.target.closest('.btn-fav-card') || e.target.closest('a')) return;
      toggleCardFlip();
    });

    if (elements.btnTapFlipHint) {
      elements.btnTapFlipHint.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCardFlip();
      });
    }

    elements.btnCardFav.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCurrentFavorite();
    });

    elements.btnPrev.addEventListener('click', prevCard);
    elements.btnNext.addEventListener('click', nextCard);
    elements.btnFlip.addEventListener('click', toggleCardFlip);
    elements.btnFavToolbar.addEventListener('click', toggleCurrentFavorite);
    elements.btnShuffle.addEventListener('click', shuffleDeck);
    elements.btnZoom.addEventListener('click', openZoomModal);

    if (elements.btnLoadMoreMet) {
      elements.btnLoadMoreMet.addEventListener('click', () => loadBatchMetItems(20));
    }

    elements.btnCloseZoom.addEventListener('click', closeZoomModal);
    elements.modalZoom.addEventListener('click', (e) => {
      if (e.target === elements.modalZoom) closeZoomModal();
    });

    elements.btnCloseDetail.addEventListener('click', closeDetailModal);
    elements.modalDetail.addEventListener('click', (e) => {
      if (e.target === elements.modalDetail) closeDetailModal();
    });

    elements.filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        elements.filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        state.activeCenturyFilter = pill.dataset.century;
        renderCollectionGrid();
      });
    });

    elements.btnFavFilter.addEventListener('click', () => {
      state.favoritesOnlyFilter = !state.favoritesOnlyFilter;
      elements.btnFavFilter.classList.toggle('active', state.favoritesOnlyFilter);
      renderCollectionGrid();
    });
  }

  function switchView(viewName) {
    state.activeView = viewName;
    elements.tabDiscovery.classList.toggle('active', viewName === 'discovery');
    elements.tabCollection.classList.toggle('active', viewName === 'collection');
    elements.viewDiscovery.classList.toggle('active', viewName === 'discovery');
    elements.viewCollection.classList.toggle('active', viewName === 'collection');

    if (viewName === 'collection') {
      renderCollectionGrid();
    }
  }

  async function init() {
    registerServiceWorker();
    loadStateFromStorage();
    initEventListeners();
    initTouchGestures();
    initKeyboardShortcuts();

    // Query Met Museum API for initial Renaissance era (1300-1599)
    await fetchMetObjectIDsForEra(1300, 1599);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
