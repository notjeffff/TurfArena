/* =========================================
   1. LIVE BACKEND API WRAPPER (MongoDB Linked)
   ========================================= */
const storedApiHost = localStorage.getItem('apiHost');
const API_HOST = !storedApiHost || ['http://127.0.0.1:5000', 'http://localhost:5000'].includes(storedApiHost)
    ? 'http://127.0.0.1:5001'
  : storedApiHost;
if (storedApiHost !== API_HOST) localStorage.setItem('apiHost', API_HOST);
const BASE_URL = `${API_HOST}/api`;

function toAssetUrl(imageName) {
  if (!imageName) return null;
  if (/^https?:\/\//i.test(imageName) || imageName.startsWith('/')) return imageName;
  return imageName;
}

const API = {
  // 1. READ: Fetch all turfs from MongoDB
  getTurfs: async () => {
    try {
        const response = await fetch(`${BASE_URL}/turfs`);
        const turfsArray = await response.json();
        
        let turfDict = {};
        turfsArray.forEach(turf => { 
            turfDict[turf._id] = {
                id: turf._id,
                name: turf.name,
                meta: turf.meta || `${turf.location || 'Chennai'} • ${(turf.sports || ['Multi-sport']).join(', ')}`,
                basePrice: turf.basePrice,
                panoramaUrl: turf.panoramaUrl || null,
                image: turf.image || null,
                reviews: Array.isArray(turf.reviews) ? turf.reviews : [],
                sports: Array.isArray(turf.sports) ? turf.sports : [],
                location: turf.location || ''
            }; 
        });
        return Object.keys(turfDict).length > 0 ? turfDict : defaultTurfData;
    } catch (err) {
        console.error("Backend not reachable. Falling back to defaults.", err);
        return defaultTurfData;
    }
  },

  // 2. READ: Fetch all bookings from MongoDB
  getBookings: async () => {
    try {
        const response = await fetch(`${BASE_URL}/bookings`);
        const bookingsArray = await response.json();
        
        let bookingDict = {};
        let bookingOwnerDict = {};
        bookingsArray.forEach(b => {
            if (String(b.status || '').toLowerCase() === 'cancelled') return;
            const tId = b.turfId && b.turfId._id ? b.turfId._id : b.turfId;
            if (!tId) return;
            if (!bookingDict[tId]) bookingDict[tId] = [];
            if (!bookingOwnerDict[tId]) bookingOwnerDict[tId] = {};
            
            const numericSlots = (b.slots || []).map(s => parseInt(s, 10)).filter(Number.isInteger);
            numericSlots.forEach(slot => {
                bookingDict[tId].push(slot);
                bookingOwnerDict[tId][slot] = {
                    userName: b.userName || 'User',
                    userEmail: b.userEmail || ''
                };
            });
        });
        return {
            bookings: bookingDict,
            bookingOwners: bookingOwnerDict
        };
    } catch (err) {
        return {
            bookings: defaultBookings,
            bookingOwners: defaultBookingOwners
        };
    }
  },

  getBlocked: async () => { return JSON.parse(localStorage.getItem('blocked')) || defaultBlocked; },

  // 3. CREATE: Save a newly listed turf to MongoDB
  saveNewTurf: async (newTurf) => {
    try {
        const response = await fetch(`${BASE_URL}/turfs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTurf)
        });
        return await response.json();
    } catch (err) { console.error("Failed to save turf", err); }
  },

  // 4. CREATE: Save a new booking to MongoDB
  saveBooking: async (turfId, newSlots, bookingDate, upiTransactionId = '') => {
    try {
        const user = JSON.parse(localStorage.getItem('currentUser')) || { name: "Guest", email: "guest@test.com" };
        const payload = {
            turfId: turfId,
            userName: user.name,
            userEmail: user.email,
            slots: newSlots.map(String),
            date: bookingDate,
            paymentMethod: 'UPI',
            paymentStatus: upiTransactionId ? 'Paid' : 'Pending',
            upiTransactionId
        };
        
        const response = await fetch(`${BASE_URL}/bookings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        return await response.json();
    } catch (err) { console.error("Failed to book slot", err); }
  },

  saveReview: async (turfId, reviewPayload) => {
    try {
      const response = await fetch(`${BASE_URL}/turfs/${turfId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewPayload)
      });
      return await response.json();
    } catch (err) { console.error("Failed to save review", err); }
  },

  deleteReview: async (turfId, userEmail) => {
    try {
      const response = await fetch(`${BASE_URL}/turfs/${turfId}/reviews`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userEmail })
      });
      return await response.json();
    } catch (err) { console.error("Failed to delete review", err); }
  }
};

/* =========================================
   2. DEFAULT DATA & STATE
   ========================================= */
const defaultTurfData = {
  "1": { name: "GreenLine Arena", meta: "Velachery • Football, Cricket", location: "Velachery", sports: ["Football", "Cricket"], basePrice: 1200, panoramaUrl: "panaroma1.jpeg", image: "aerial-view-grass-field-hockey.jpg", reviews: [] },
  "2": { name: "Boundary Line Turf", meta: "Tambaram • Cricket box", location: "Tambaram", sports: ["Cricket"], basePrice: 800, panoramaUrl: "panaroma2.jpeg", image: "izuddin-helmi-adnan-K5ChxJaheKI-unsplash.jpg", reviews: [] },
  "3": { name: "SkyLine Sports Hub", meta: "OMR • Multi‑sport", location: "OMR", sports: ["Football", "Cricket", "Multi-sport"], basePrice: 1000, panoramaUrl: "panaroma3.jpeg", image: "thomas-park-fDmpxdV69eA-unsplash.jpg", reviews: [] }
};
const defaultBookings = { "1": [6, 7, 20], "2": [18, 19], "3": [5, 6, 21] };
const defaultBlocked = { "1": [3], "2": [2, 3], "3": [] };
const defaultBookingOwners = { "1": {}, "2": {}, "3": {} };

let turfData = {};
let bookings = {};
let blocked = {};
let bookingOwners = {};

const hours = Array.from({ length: 24 }, (_, i) => i);
const turfImages = {
  "1": [
    "aerial-view-grass-field-hockey.jpg",
    "hc-digital-9sOleIZAE54-unsplash.jpg",
    "william-smith-_Kp1WFKoCRk-unsplash.jpg",
    "thomas-park-fDmpxdV69eA-unsplash.jpg"
  ],
  "2": [
    "izuddin-helmi-adnan-K5ChxJaheKI-unsplash.jpg",
    "nguy-n-hi-p-XHDRUHXcsl0-unsplash.jpg",
    "timothy-tan-PAe2UhGo-S4-unsplash.jpg",
    "aerial-view-grass-field-hockey.jpg"
  ],
  "3": [
    "thomas-park-fDmpxdV69eA-unsplash.jpg",
    "timothy-tan-PAe2UhGo-S4-unsplash.jpg",
    "hc-digital-9sOleIZAE54-unsplash.jpg",
    "william-smith-_Kp1WFKoCRk-unsplash.jpg"
  ]
};

let currentTurfId = null;
let selectedSlots = [];
let panoramaViewer = null;
let panoramaVisible = false;
let activeBookingPaymentIntent = null;
let currentReviewRating = 0;
let activeSearchQuery = '';
let activeFilters = {
  sport: 'all',
  price: 'all',
  rating: 'all',
  favoritesOnly: false
};

/* =========================================
   3. INITIALIZATION
   ========================================= */
async function init() {
  trackVisits();
  updateUserAuthUI();
  loadWeather();

  // Show the starter turfs immediately so the home page never loads empty.
  turfData = { ...defaultTurfData };
  bookings = { ...defaultBookings };
  bookingOwners = { ...defaultBookingOwners };
  blocked = await API.getBlocked();
  refreshSportOptions();
  renderTurfGrid();
  
  turfData = await API.getTurfs();
  const bookingData = await API.getBookings();
  bookings = bookingData.bookings || defaultBookings;
  bookingOwners = bookingData.bookingOwners || defaultBookingOwners;
  
  if(!localStorage.getItem('turfData')) localStorage.setItem('turfData', JSON.stringify(defaultTurfData));

  refreshSportOptions();
  renderTurfGrid();
  startAlternatingImages();

  const dateInput = document.getElementById("bookingDate");
  const searchInput = document.getElementById("turfSearchInput");
  const sportFilter = document.getElementById("sportFilter");
  const priceFilter = document.getElementById("priceFilter");
  const ratingFilter = document.getElementById("ratingFilter");
  const today = new Date().toISOString().split("T")[0];
  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      activeSearchQuery = String(event.target.value || '').trim().toLowerCase();
      renderTurfGrid();
    });
  }
  if (sportFilter) {
    sportFilter.addEventListener('change', (event) => {
      activeFilters.sport = event.target.value;
      renderTurfGrid();
    });
  }
  if (priceFilter) {
    priceFilter.addEventListener('change', (event) => {
      activeFilters.price = event.target.value;
      renderTurfGrid();
    });
  }
  if (ratingFilter) {
    ratingFilter.addEventListener('change', (event) => {
      activeFilters.rating = event.target.value;
      renderTurfGrid();
    });
  }
  if(dateInput) {
    dateInput.value = today;
    dateInput.min = today;
    dateInput.addEventListener("change", () => {
      document.getElementById("selectedDateText").textContent = dateInput.value === today ? "Today" : dateInput.value;
      renderSlots();
    });
  }
}

/* =========================================
   4. UI RENDERING (Grid)
   ========================================= */
function renderTurfGrid() {
  const grid = document.getElementById("turfGrid");
  if(!grid) return;
  grid.innerHTML = "";

  const visibleTurfs = Object.entries(turfData).filter(([id, turf]) => turfMatchesFilters(id, turf));
  updateDiscoveryMeta(visibleTurfs.length);

  if (!visibleTurfs.length) {
    grid.innerHTML = `<div class="turf-card"><div class="turf-body"><div class="turf-name">No turf found</div><div class="turf-location">Try searching by location or sport.</div></div></div>`;
    return;
  }

  visibleTurfs.forEach(([id, turf]) => {
    const article = document.createElement("article");
    article.className = "turf-card";
    
    const imageUrl = getTurfImageFrames(id, turf)[0] || "https://images.unsplash.com/photo-1529900948632-58674ba19306?w=400";
    
    const metaString = turf.meta || "Chennai • Multi-sport";
    const location = metaString.split(" • ")[0] || "Chennai";
    const tag = metaString.split(" • ")[1] || "Multi-sport";
    const ratingSummary = getTurfRatingSummary(turf);
    const favoriteText = isFavoriteTurf(id) ? 'Saved' : 'Save';

    article.innerHTML = `
      <div class="turf-image">
        <div class="turf-image-inner" id="turf-img-${id}" style="background-image: url('${imageUrl}');"></div>
        <span class="turf-tag">${tag}</span>
        <span class="turf-price-pill">₹${turf.basePrice} / hr</span>
        <button class="turf-favorite-btn ${isFavoriteTurf(id) ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavoriteTurf('${id}')">${favoriteText}</button>
      </div>
      <div class="turf-body">
        <div class="turf-title-row">
          <div>
            <div class="turf-name">${turf.name}</div>
            <div class="turf-location">${location}</div>
          </div>
          <button class="turf-open-btn" onclick="event.stopPropagation(); openModal('${id}')">Open</button>
        </div>
        <div class="turf-rating-row">
          <div class="turf-rating">⭐ ${ratingSummary}</div>
          <button class="turf-review-btn" onclick="event.stopPropagation(); openReviewsPanel('${id}')">Give Review</button>
        </div>
      </div>
    `;

    article.addEventListener("click", () => openModal(id));
    grid.appendChild(article);
  });
}

function normalizeSportValue(value) {
  return String(value || '').trim().toLowerCase();
}

function formatSportLabel(value) {
  return String(value || '')
    .trim()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getAvailableSports() {
  const sportMap = new Map();

  Object.values(turfData).forEach((turf) => {
    const sports = Array.isArray(turf?.sports) && turf.sports.length
      ? turf.sports
      : String(turf?.meta || '')
          .split('•')[1]
          ?.split(',')
          .map(item => item.trim())
          .filter(Boolean) || [];

    sports.forEach((sport) => {
      const normalized = normalizeSportValue(sport);
      if (!normalized || sportMap.has(normalized)) return;
      sportMap.set(normalized, formatSportLabel(sport));
    });
  });

  return Array.from(sportMap.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([value, label]) => ({ value, label }));
}

function refreshSportOptions() {
  const availableSports = getAvailableSports();
  const sportFilter = document.getElementById('sportFilter');
  const sportType = document.getElementById('sportType');

  if (sportFilter) {
    const previousValue = sportFilter.value || activeFilters.sport || 'all';
    sportFilter.innerHTML = '<option value="all">All Sports</option>';
    availableSports.forEach(({ value, label }) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      sportFilter.appendChild(option);
    });
    sportFilter.value = availableSports.some((sport) => sport.value === previousValue) ? previousValue : 'all';
    activeFilters.sport = sportFilter.value;
  }

  if (sportType) {
    const previousValue = normalizeSportValue(sportType.value);
    sportType.innerHTML = '';
    availableSports.forEach(({ value, label }) => {
      const option = document.createElement('option');
      option.value = label;
      option.textContent = label;
      sportType.appendChild(option);
    });
    if (!availableSports.length) {
      const option = document.createElement('option');
      option.value = 'Football';
      option.textContent = 'Football';
      sportType.appendChild(option);
      return;
    }
    const matchingSport = availableSports.find((sport) => sport.value === previousValue);
    sportType.value = matchingSport ? matchingSport.label : availableSports[0].label;
  }
}

function turfMatchesSearch(turf = {}) {
  if (!activeSearchQuery) return true;
  const haystack = [
    turf.name,
    turf.meta,
    turf.location,
    ...(Array.isArray(turf.sports) ? turf.sports : [])
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(activeSearchQuery);
}

function turfMatchesFilters(id, turf = {}) {
  if (!turfMatchesSearch(turf)) return false;

  const sportFilter = activeFilters.sport;
  const priceFilter = activeFilters.price;
  const ratingFilter = activeFilters.rating;
  const metaText = String(turf.meta || '').toLowerCase();
  const sportsText = Array.isArray(turf.sports) ? turf.sports.join(' ').toLowerCase() : '';
  const combinedSports = `${metaText} ${sportsText}`;
  const numericRating = getTurfAverageRating(turf);

  if (sportFilter !== 'all') {
    if (sportFilter === 'multi-sport') {
      if (!combinedSports.includes('multi')) return false;
    } else if (!combinedSports.includes(sportFilter)) {
      return false;
    }
  }

  if (priceFilter === 'low' && Number(turf.basePrice || 0) > 900) return false;
  if (priceFilter === 'mid' && (Number(turf.basePrice || 0) <= 900 || Number(turf.basePrice || 0) > 1100)) return false;
  if (priceFilter === 'high' && Number(turf.basePrice || 0) <= 1100) return false;

  if (ratingFilter === 'unrated' && numericRating > 0) return false;
  if (ratingFilter !== 'all' && ratingFilter !== 'unrated' && numericRating < Number(ratingFilter)) return false;

  if (activeFilters.favoritesOnly && !isFavoriteTurf(id)) return false;

  return true;
}

function getTurfRatingSummary(turf = {}) {
  const reviews = Array.isArray(turf.reviews) ? turf.reviews : [];
  if (!reviews.length) return 'No ratings';
  const average = getTurfAverageRating(turf);
  return `${average.toFixed(1)} (${reviews.length})`;
}

function getTurfAverageRating(turf = {}) {
  const reviews = Array.isArray(turf.reviews) ? turf.reviews : [];
  if (!reviews.length) return 0;
  return reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length;
}

function getFavoriteTurfs() {
  return JSON.parse(localStorage.getItem('favoriteTurfs') || '[]');
}

function isFavoriteTurf(turfId) {
  return getFavoriteTurfs().includes(String(turfId));
}

function toggleFavoriteTurf(turfId) {
  const favorites = new Set(getFavoriteTurfs());
  const key = String(turfId);
  if (favorites.has(key)) {
    favorites.delete(key);
    showToast('Removed from favorites.', 'info');
  } else {
    favorites.add(key);
    showToast('Added to favorites.', 'success');
  }
  localStorage.setItem('favoriteTurfs', JSON.stringify([...favorites]));
  renderTurfGrid();
}

function toggleFavoritesOnly() {
  activeFilters.favoritesOnly = !activeFilters.favoritesOnly;
  const btn = document.getElementById('favoritesOnlyBtn');
  if (btn) btn.classList.toggle('active', activeFilters.favoritesOnly);
  renderTurfGrid();
}

function resetFilters() {
  activeFilters = { sport: 'all', price: 'all', rating: 'all', favoritesOnly: false };
  activeSearchQuery = '';
  const searchInput = document.getElementById('turfSearchInput');
  const sportFilter = document.getElementById('sportFilter');
  const priceFilter = document.getElementById('priceFilter');
  const ratingFilter = document.getElementById('ratingFilter');
  const favoritesOnlyBtn = document.getElementById('favoritesOnlyBtn');
  if (searchInput) searchInput.value = '';
  if (sportFilter) sportFilter.value = 'all';
  if (priceFilter) priceFilter.value = 'all';
  if (ratingFilter) ratingFilter.value = 'all';
  if (favoritesOnlyBtn) favoritesOnlyBtn.classList.remove('active');
  renderTurfGrid();
}

function updateDiscoveryMeta(visibleCount) {
  const resultsEl = document.getElementById('resultsSummaryText');
  const favoritesEl = document.getElementById('favoritesSummaryText');
  const favoritesCount = getFavoriteTurfs().length;
  if (resultsEl) {
    resultsEl.textContent = visibleCount === Object.keys(turfData).length
      ? `Showing all ${visibleCount} turfs`
      : `Showing ${visibleCount} turf${visibleCount === 1 ? '' : 's'}`;
  }
  if (favoritesEl) {
    favoritesEl.textContent = `${favoritesCount} favorite${favoritesCount === 1 ? '' : 's'} saved`;
  }
}

function openReviewsPanel(turfId) {
  openModal(turfId);
  switchTab('reviews');
}

function startAlternatingImages() {
  let imgIndex = 0;
  setInterval(() => {
    Object.keys(turfData).forEach(id => {
      const imgEl = document.getElementById(`turf-img-${id}`);
      const frames = getTurfImageFrames(id, turfData[id] || {});
      if (!imgEl || !frames.length) return;
      imgEl.style.backgroundImage = `url('${frames[imgIndex % frames.length]}')`;
    });
    imgIndex += 1;
  }, 3000);
}

const defaultPanoramaByTurf = {
  "1": "panaroma1.jpeg",
  "2": "panaroma2.jpeg",
  "3": "panaroma3.jpeg"
};

const defaultPanoramaByName = {
  "greenline arena": "panaroma1.jpeg",
  "boundary line turf": "panaroma2.jpeg",
  "skyline sports hub": "panaroma3.jpeg"
};

const defaultCardImageByTurf = {
  "1": "aerial-view-grass-field-hockey.jpg",
  "2": "izuddin-helmi-adnan-K5ChxJaheKI-unsplash.jpg",
  "3": "thomas-park-fDmpxdV69eA-unsplash.jpg"
};

const defaultCardImageByName = {
  "greenline arena": "aerial-view-grass-field-hockey.jpg",
  "boundary line turf": "izuddin-helmi-adnan-K5ChxJaheKI-unsplash.jpg",
  "skyline sports hub": "thomas-park-fDmpxdV69eA-unsplash.jpg"
};

function resolvePanoramaUrl(turfId, turf = {}) {
  const byDbValue = toAssetUrl(turf.panoramaUrl);
  if (byDbValue) return byDbValue;

  const byId = defaultPanoramaByTurf[String(turfId)];
  if (byId) return toAssetUrl(byId);

  const byName = defaultPanoramaByName[String(turf.name || '').trim().toLowerCase()];
  return byName ? toAssetUrl(byName) : null;
}

function getTurfImageFrames(turfId, turf = {}) {
  const normalizedName = String(turf.name || '').trim().toLowerCase();
  const files = [];

  if (turf.image) files.push(turf.image);
  if (defaultCardImageByTurf[String(turfId)]) files.push(defaultCardImageByTurf[String(turfId)]);
  if (defaultCardImageByName[normalizedName]) files.push(defaultCardImageByName[normalizedName]);
  if (turfImages[turfId]) files.push(...turfImages[turfId]);

  return [...new Set(files.map(toAssetUrl).filter(Boolean))];
}

function normalizePhoneNumber(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function validateBookingDetails() {
  const nameInput = document.getElementById("userNameInput");
  const phoneInput = document.getElementById("userPhoneInput");
  const sportInput = document.getElementById("sportType");

  const name = String(nameInput?.value || '').trim();
  const phone = normalizePhoneNumber(phoneInput?.value || '');
  const sport = String(sportInput?.value || '').trim();

  if (!name || name.length < 2) {
    showToast("Enter a valid name to continue.", "error");
    nameInput?.focus();
    return null;
  }

  if (phone.length !== 10) {
    showToast("Phone number must be exactly 10 digits.", "error");
    phoneInput?.focus();
    return null;
  }

  if (!sport) {
    showToast("Select a sport before booking.", "error");
    sportInput?.focus();
    return null;
  }

  if (phoneInput) phoneInput.value = phone;

  return { name, phone, sport };
}

/* =========================================
   5. OWNER CRUD LOGIC 
   ========================================= */
function openTurfModal() {
    const modal = document.getElementById('turfModal');
    if(modal) modal.style.display = 'flex';
}

function closeOwnerModals() {
    if(document.getElementById('turfModal')) document.getElementById('turfModal').style.display = 'none';
    if(document.getElementById('manageBookingsModal')) document.getElementById('manageBookingsModal').style.display = 'none';
}

async function handleCreateTurf() {
    const name = document.getElementById('newTurfName').value;
    const loc = document.getElementById('newTurfLoc').value;
    const price = document.getElementById('newTurfPrice').value;

    if(!name || !loc) {
        showToast("Fill in the turf details, bro!", "error");
        return;
    }

    const newTurf = {
        name: name,
        meta: `${loc} • Multi-sport`,
        sports: ['Multi-sport'],
        basePrice: parseInt(price),
        panoramaUrl: null
    };

    await API.saveNewTurf(newTurf);
    showToast(`🎉 ${name} listed successfully!`, "success");
    
    turfData = await API.getTurfs();
    refreshSportOptions();
    renderTurfGrid();
    closeOwnerModals();
}

function openManageBookings(id) {
    currentTurfId = id;
    const log = JSON.parse(localStorage.getItem('bookingLog')) || [];
    const turfBookings = log.filter(entry => entry.turfId == id);
    const container = document.getElementById('bookingListContainer');
    const modal = document.getElementById('manageBookingsModal');
    
    if(!container || !modal) return;
    
    modal.style.display = 'flex';

    if(turfBookings.length === 0) {
        container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">No bookings for this turf yet.</p>`;
        return;
    }

    container.innerHTML = turfBookings.map(b => `
        <div class="request-item" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:12px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; border:1px solid rgba(255,255,255,0.05);">
            <div>
                <div style="font-weight:800; color:white;">${b.userName || 'Player'}</div>
                <div style="font-size:0.75rem; color:#94a3b8;">Slots: ${b.slots.map(formatHour).join(', ')}</div>
            </div>
            <div>
                ${b.status === 'Pending' ? `
                    <button onclick="updateLogStatus('${b.id}', 'Confirmed')" class="btn-sm" style="background:var(--primary); color:white; border:none; padding:5px 10px; border-radius:6px; cursor:pointer;">Approve</button>
                ` : `<span style="color:#60A5FA; font-weight:bold;">Confirmed</span>`}
            </div>
        </div>
    `).join('');
}

function updateLogStatus(logId, status) {
    let log = JSON.parse(localStorage.getItem('bookingLog')) || [];
    const entry = log.find(e => String(e.id) === String(logId));
    if(entry) entry.status = status;
    localStorage.setItem('bookingLog', JSON.stringify(log));
    showToast(`Booking ${status}!`, "success");
    openManageBookings(currentTurfId);
}

function postOpening() {
    showToast("Post openings from the Community page.", "info");
    setTimeout(() => {
      window.location.href = 'community.html';
    }, 400);
}

/* =========================================
   6. BOOKING & PANORAMA LOGIC
   ========================================= */
function openModal(turfId) {
  currentTurfId = turfId;
  const turf = turfData[turfId];
  
  if(!turf) return console.error("Could not find turf data for ID:", turfId);

  document.getElementById("modalTurfName").textContent = turf.name;
  document.getElementById("modalTurfMeta").textContent = turf.meta || "Chennai • Multi-sport";
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const nameInput = document.getElementById("userNameInput");
  const phoneInput = document.getElementById("userPhoneInput");

  if (nameInput && !nameInput.value.trim()) nameInput.value = currentUser?.name || '';
  if (phoneInput) phoneInput.value = normalizePhoneNumber(phoneInput.value || currentUser?.phone || '');
  
  selectedSlots = [];
  currentReviewRating = 0;
  
  const tabBooking = document.getElementById('tabBooking');
  const tabReviews = document.getElementById('tabReviews');
  const tabOpenings = document.getElementById('tabOpenings');
  const secReviews = document.getElementById('reviewsSection');
  const secOpenings = document.getElementById('openingsSection');
  const secBooking = document.getElementById('bookingSection');
  
  if (tabBooking) tabBooking.style.display = 'inline-flex';
  if (tabReviews) tabReviews.style.display = 'inline-flex';
  if (tabOpenings) tabOpenings.style.display = 'none';
  if (secOpenings) secOpenings.style.display = 'none';
  if (secReviews) secReviews.style.display = 'none';
  if (secBooking) secBooking.style.display = 'flex';
  setActivePanelTab('booking');

  updateBookingSummary();
  renderSlots();
  renderReviews();
  updateReviewStars();
  
  const view360Btn = document.getElementById("view360Btn");
  const panoramaUrl = resolvePanoramaUrl(turfId, turf);
  if(view360Btn) view360Btn.style.display = panoramaUrl ? "inline-block" : "none";
  
  document.getElementById("slotModalBackdrop").style.display = "flex";
  togglePanorama(false);
}

function closeModal() {
  document.getElementById("slotModalBackdrop").style.display = "none";
  if (panoramaViewer) {
    panoramaViewer.destroy();
    panoramaViewer = null;
  }
  panoramaVisible = false;
}

function togglePanorama(show = !panoramaVisible) {
  const section = document.getElementById("panoramaSection");
  const btn = document.getElementById("view360Btn");
  
  if(!section) return;

  panoramaVisible = show;
  if (show) {
    const turf = turfData[currentTurfId];
    const panoramaUrl = resolvePanoramaUrl(currentTurfId, turf);
    if (!panoramaUrl) {
      panoramaVisible = false;
      section.style.display = "none";
      if(btn) btn.style.display = "none";
      return;
    }

    section.style.display = "block";
    if(btn) btn.textContent = "Hide 360° Turf View";
    if (panoramaViewer) {
      panoramaViewer.destroy();
      panoramaViewer = null;
    }
    panoramaViewer = pannellum.viewer('panorama', {
      type: 'equirectangular',
      panorama: panoramaUrl,
      autoLoad: true,
      compass: false,
      showZoomCtrl: true,
      mouseZoom: true,
      draggable: true,
      hfov: 110,
      pitch: -8
    });
  } else {
    section.style.display = "none";
    if(btn) btn.textContent = "Open 360° Turf View";
    if (panoramaViewer) {
      panoramaViewer.destroy();
      panoramaViewer = null;
    }
  }
}

function setActivePanelTab(tabName) {
  const tabMap = {
    booking: document.getElementById('tabBooking'),
    reviews: document.getElementById('tabReviews'),
    openings: document.getElementById('tabOpenings')
  };

  Object.entries(tabMap).forEach(([key, element]) => {
    if (!element) return;
    element.classList.toggle('active', key === tabName);
  });
}

function switchTab(tabName) {
  const sections = {
    booking: document.getElementById('bookingSection'),
    reviews: document.getElementById('reviewsSection'),
    openings: document.getElementById('openingsSection')
  };

  Object.entries(sections).forEach(([key, section]) => {
    if (!section) return;
    section.style.display = key === tabName ? 'flex' : 'none';
  });

  if (tabName === 'reviews') {
    renderReviews();
  }

  setActivePanelTab(tabName);
}

function getCurrentTurfReviews() {
  const turf = turfData[currentTurfId] || {};
  return Array.isArray(turf.reviews) ? turf.reviews : [];
}

function getCurrentUserReview() {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (!user) return null;
  return getCurrentTurfReviews().find(review => String(review.userEmail || '').toLowerCase() === String(user.email || '').toLowerCase()) || null;
}

function formatReviewDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? 'Just now' : date.toLocaleDateString('en-IN');
}

function renderReviews() {
  const listEl = document.getElementById('reviewsList');
  const countEl = document.getElementById('reviewsCountText');
  const averageEl = document.getElementById('reviewsAverageText');
  const breakdownEl = document.getElementById('reviewBreakdownList');
  if (!listEl || !countEl || !averageEl || !breakdownEl) return;

  const reviews = getCurrentTurfReviews().slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  const average = reviews.length
    ? (reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length).toFixed(1)
    : '0.0';
  const currentUserReview = getCurrentUserReview();

  countEl.textContent = reviews.length ? `${reviews.length} review${reviews.length === 1 ? '' : 's'} from players` : 'No reviews yet.';
  averageEl.textContent = average;
  breakdownEl.innerHTML = renderReviewBreakdown(reviews);
  syncReviewFormWithCurrentUser(currentUserReview);

  if (!reviews.length) {
    listEl.innerHTML = `<div class="review-empty">No reviews yet. Be the first player to rate this turf.</div>`;
    return;
  }

  listEl.innerHTML = reviews.map(review => `
    <article class="review-card">
      <div class="review-card-header">
        <div class="review-author">${review.userName || 'Player'}${currentUserReview && review.userEmail === currentUserReview.userEmail ? ' <span class="review-owner-badge">You</span>' : ''}</div>
        <div class="review-rating">${'★'.repeat(Number(review.rating || 0))}${'☆'.repeat(5 - Number(review.rating || 0))}</div>
      </div>
      <div class="review-comment">${review.comment || 'Great turf experience.'}</div>
      <div class="review-date">${formatReviewDate(review.createdAt)}</div>
    </article>
  `).join('');
}

function renderReviewBreakdown(reviews = []) {
  const total = reviews.length || 1;
  return [5, 4, 3, 2, 1].map((rating) => {
    const count = reviews.filter(review => Number(review.rating || 0) === rating).length;
    const percentage = Math.round((count / total) * 100);
    return `
      <div class="review-breakdown-row">
        <span>${rating}★</span>
        <div class="review-breakdown-bar"><div style="width:${percentage}%;"></div></div>
        <strong>${count}</strong>
      </div>
    `;
  }).join('');
}

function syncReviewFormWithCurrentUser(currentUserReview) {
  const titleEl = document.getElementById('reviewFormTitle');
  const helperEl = document.getElementById('reviewFormHelper');
  const commentEl = document.getElementById('reviewComment');
  const submitBtn = document.getElementById('submitReviewBtn');
  const deleteBtn = document.getElementById('deleteReviewBtn');

  if (currentUserReview) {
    currentReviewRating = Number(currentUserReview.rating || 0);
    if (commentEl) commentEl.value = currentUserReview.comment || '';
    if (titleEl) titleEl.textContent = 'Update your review';
    if (helperEl) helperEl.textContent = 'You already rated this turf. You can edit the score, change the comment, or remove it.';
    if (submitBtn) submitBtn.textContent = 'Update Review';
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
  } else {
    currentReviewRating = currentReviewRating || 0;
    if (commentEl) commentEl.value = '';
    if (titleEl) titleEl.textContent = 'Rate this Turf';
    if (helperEl) helperEl.textContent = 'Booked players can share ground quality, lighting, and turf condition.';
    if (submitBtn) submitBtn.textContent = 'Submit Review';
    if (deleteBtn) deleteBtn.style.display = 'none';
  }
  updateReviewStars();
}

function setReviewRating(rating) {
  currentReviewRating = rating;
  updateReviewStars();
}

function updateReviewStars() {
  document.querySelectorAll('.review-star').forEach(star => {
    const rating = Number(star.dataset.rating || 0);
    star.classList.toggle('active', rating <= currentReviewRating);
    star.textContent = rating <= currentReviewRating ? '★' : '☆';
  });
}

async function submitReview() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if (!user) {
    showToast("Login to submit a review.", "error");
    return;
  }

  if (!currentTurfId) return;
  if (currentReviewRating < 1) {
    showToast("Choose a star rating first.", "error");
    return;
  }

  const commentEl = document.getElementById('reviewComment');
  const comment = String(commentEl?.value || '').trim();
  const payload = {
    userName: user.name,
    userEmail: user.email,
    rating: currentReviewRating,
    comment
  };

  const saved = await API.saveReview(currentTurfId, payload);
  if (!saved || saved.error) {
    showToast(saved?.error || "Couldn't save the review.", "error");
    return;
  }

  turfData[currentTurfId] = {
    ...turfData[currentTurfId],
    reviews: saved.reviews || turfData[currentTurfId].reviews || []
  };

  if (commentEl) commentEl.value = '';
  currentReviewRating = 0;
  updateReviewStars();
  renderReviews();
  renderTurfGrid();
  showToast("Review submitted successfully.", "success");
}

async function deleteReview() {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
  if (!user || !currentTurfId) {
    showToast("Login to manage your review.", "error");
    return;
  }

  const deleted = await API.deleteReview(currentTurfId, user.email);
  if (!deleted || deleted.error) {
    showToast(deleted?.error || "Couldn't delete the review.", "error");
    return;
  }

  turfData[currentTurfId] = {
    ...turfData[currentTurfId],
    reviews: deleted.reviews || []
  };

  currentReviewRating = 0;
  renderReviews();
  renderTurfGrid();
  showToast("Review deleted successfully.", "success");
}

function renderSlots() {
  const grid = document.getElementById("slotsGrid");
  if(!grid) return;
  grid.innerHTML = "";
  
  const bookedSlots = bookings[currentTurfId] || [];
  const bookedSlotOwners = bookingOwners[currentTurfId] || {};
  const blockedSlots = blocked[currentTurfId] || [];
  const currentUser = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const currentUserEmail = String(currentUser?.email || '').toLowerCase();

  hours.forEach((h) => {
    const pill = document.createElement("button");
    pill.className = "slot-pill";
    pill.textContent = formatHour(h);
    pill.type = "button";
    
    if (blockedSlots.includes(h)) {
      pill.classList.add("blocked");
      pill.setAttribute("aria-label", `${formatHour(h)} blocked by admin`);
      pill.addEventListener("mouseenter", showSlotTooltip);
      pill.addEventListener("mousemove", moveSlotTooltip);
      pill.addEventListener("mouseleave", hideSlotTooltip);
    }
    else if (bookedSlots.includes(h)) {
      pill.classList.add("booked");
      const bookedBy = bookedSlotOwners[h] || {};
      const isBookedByCurrentUser =
        currentUserEmail && String(bookedBy.userEmail || '').toLowerCase() === currentUserEmail;
      const hoverText = isBookedByCurrentUser ? "Booked by you" : "Booked by user";
      pill.classList.add(isBookedByCurrentUser ? "booked-you" : "booked-other");
      pill.setAttribute("aria-label", `${formatHour(h)} ${hoverText.toLowerCase()}`);
      pill.addEventListener("mouseenter", (event) => showSlotTooltip(event, hoverText));
      pill.addEventListener("mousemove", moveSlotTooltip);
      pill.addEventListener("mouseleave", hideSlotTooltip);
    }
    else {
      pill.classList.add("free");
      pill.setAttribute("aria-label", `${formatHour(h)} available to book`);
      if (selectedSlots.includes(h)) pill.classList.add("selected");
      pill.addEventListener("click", () => toggleSlot(h));
    }
    grid.appendChild(pill);
  });
}

function showSlotTooltip(event, message = "Blocked by admin") {
  const tooltip = document.getElementById("slotTooltip");
  if (!tooltip) return;
  tooltip.textContent = message;
  tooltip.classList.add("visible");
  tooltip.setAttribute("aria-hidden", "false");
  moveSlotTooltip(event);
}

function moveSlotTooltip(event) {
  const tooltip = document.getElementById("slotTooltip");
  if (!tooltip) return;
  tooltip.style.left = `${event.clientX + 14}px`;
  tooltip.style.top = `${event.clientY + 14}px`;
}

function hideSlotTooltip() {
  const tooltip = document.getElementById("slotTooltip");
  if (!tooltip) return;
  tooltip.classList.remove("visible");
  tooltip.setAttribute("aria-hidden", "true");
}

function formatHour(h) {
  const hourNum = parseInt(h, 10);
  if (isNaN(hourNum)) return "N/A";
  const fmt = (x) => `${x % 12 || 12}:00 ${x < 12 ? "AM" : "PM"}`;
  return `${fmt(hourNum)} – ${fmt((hourNum + 1) % 24)}`;
}

function toggleSlot(h) {
  const index = selectedSlots.indexOf(h);
  if (index >= 0) selectedSlots.splice(index, 1);
  else selectedSlots.push(h);
  renderSlots();
  updateBookingSummary();
}

function updateBookingSummary() {
  const count = selectedSlots.length;
  const countText = document.getElementById("slotCountText");
  const selectedText = document.getElementById("selectedSlotsText");
  const priceText = document.getElementById("totalPriceText");

  if(countText) countText.textContent = `${count} hr${count === 1 ? "" : "s"} selected`;
  
  if (count === 0) {
    if(selectedText) selectedText.textContent = "Select slots on the left.";
    if(priceText) priceText.textContent = "Total: ₹0";
  } else {
    if(selectedText) selectedText.textContent = `Selected: ${selectedSlots.map(formatHour).join(", ")}`;
    if(priceText) priceText.textContent = `Total: ₹${turfData[currentTurfId].basePrice * count}`;
  }
}

/* =========================================
   7. UPI PAYMENT & BOOKING CONFIRMATION
   ========================================= */
async function confirmBooking() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  if(!user) {
      alert("Please login first to book a slot!");
      window.location.href = 'login.html';
      return;
  }

  if (selectedSlots.length === 0) return showToast("Select slots first!", "error");
  const bookingDetails = validateBookingDetails();
  if (!bookingDetails) return;

  const amountInRupees = turfData[currentTurfId].basePrice * selectedSlots.length;
  const rzpModal = document.getElementById('mockRazorpayBackdrop');
  if (rzpModal) {
      document.getElementById('rzpAmount').innerText = `₹${amountInRupees}`;
      activeBookingPaymentIntent = null;
      resetMockQr('bookingQrCanvas', 'bookingQrRef');
      rzpModal.style.display = 'flex';
  }
}

function closeMockRazorpay() {
    const rzpModal = document.getElementById('mockRazorpayBackdrop');
    if (rzpModal) rzpModal.style.display = 'none';
}

async function fetchPaymentIntent(amount, purpose, reference) {
    const response = await fetch(`${BASE_URL}/payments/intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, purpose, reference })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Could not create payment intent.');
    }
    return data;
}

function drawMockQr(canvasId, seedText) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    canvas.style.display = 'block';
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cells = 21;
    const cellSize = size / cells;
    let seed = 0;

    for (let i = 0; i < seedText.length; i += 1) {
        seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
    }

    const nextBit = () => {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        return (seed >>> 30) & 1;
    };

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    const paintFinder = (startX, startY) => {
        ctx.fillStyle = '#111111';
        ctx.fillRect(startX * cellSize, startY * cellSize, cellSize * 7, cellSize * 7);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect((startX + 1) * cellSize, (startY + 1) * cellSize, cellSize * 5, cellSize * 5);
        ctx.fillStyle = '#111111';
        ctx.fillRect((startX + 2) * cellSize, (startY + 2) * cellSize, cellSize * 3, cellSize * 3);
    };

    paintFinder(1, 1);
    paintFinder(cells - 8, 1);
    paintFinder(1, cells - 8);

    for (let y = 0; y < cells; y += 1) {
        for (let x = 0; x < cells; x += 1) {
            const inFinderTopLeft = x >= 1 && x <= 7 && y >= 1 && y <= 7;
            const inFinderTopRight = x >= cells - 8 && x <= cells - 2 && y >= 1 && y <= 7;
            const inFinderBottomLeft = x >= 1 && x <= 7 && y >= cells - 8 && y <= cells - 2;
            if (inFinderTopLeft || inFinderTopRight || inFinderBottomLeft) continue;
            if (nextBit()) {
                ctx.fillStyle = '#111111';
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }
}

function resetMockQr(canvasId, refId) {
    const canvas = document.getElementById(canvasId);
    if (canvas) {
        canvas.style.display = 'none';
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    const refText = document.getElementById(refId);
    if (refText) refText.textContent = 'Generate QR to create a payment reference';
}

function generateMockPaymentIntent(referencePrefix, amount, purpose) {
    const randomPart = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`;
    return {
        method: 'UPI',
        amount: Number(amount).toFixed(2),
        purpose,
        reference: `${referencePrefix}-${randomPart}`,
        status: 'mock-paid'
    };
}

async function startBookingUpiPayment() {
    if (!currentTurfId || selectedSlots.length === 0) {
        showToast("Select slots first!", "error");
        return;
    }

    const turfName = turfData[currentTurfId] ? turfData[currentTurfId].name : 'Turf Booking';
    const amountInRupees = turfData[currentTurfId].basePrice * selectedSlots.length;
    activeBookingPaymentIntent = generateMockPaymentIntent(`BOOK-${currentTurfId}`, amountInRupees, `${turfName} Booking`);
    drawMockQr('bookingQrCanvas', `${activeBookingPaymentIntent.reference}-${activeBookingPaymentIntent.amount}`);
    const refText = document.getElementById('bookingQrRef');
    if (refText) refText.textContent = `Mock Ref: ${activeBookingPaymentIntent.reference}`;
    showToast("Mock QR generated. Confirm booking to mark payment as successful.", "success");
}

async function processMockPayment() {
    const txnId = activeBookingPaymentIntent?.reference || '';
    if (!txnId) {
        showToast("Generate the QR first to create a payment reference.", "error");
        return;
    }
    closeMockRazorpay();
    await processSuccessfulBooking(txnId);
}

async function processSuccessfulBooking(txnId) {
  const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
  const bookingDate = document.getElementById("bookingDate")?.value || new Date().toISOString().split("T")[0];
  const justBookedSlots = [...selectedSlots];
  await API.saveBooking(currentTurfId, justBookedSlots, bookingDate, txnId);
  if (!bookings[currentTurfId]) bookings[currentTurfId] = [];
  if (!bookingOwners[currentTurfId]) bookingOwners[currentTurfId] = {};
  justBookedSlots.forEach((slot) => {
    if (!bookings[currentTurfId].includes(slot)) bookings[currentTurfId].push(slot);
    bookingOwners[currentTurfId][slot] = {
      userName: user?.name || 'User',
      userEmail: user?.email || ''
    };
  });
  selectedSlots = [];
  renderSlots();
  updateBookingSummary();
  showToast(`Success! Booking confirmed${txnId ? ` with UPI ref ${txnId}` : ""}.`, "success");
  setTimeout(() => { location.reload(); }, 1500);
}

/* =========================================
   8. UTILS & EXTERNAL APIs
   ========================================= */
async function loadWeather() {
  const weatherSpan = document.getElementById("weatherDisplay");
  try {
    const response = await fetch('https://wttr.in/Chennai?format=j1');
    const data = await response.json();
    const tempC = data.current_condition[0].temp_C;
    const cond = data.current_condition[0].weatherDesc[0].value;
    if(weatherSpan) weatherSpan.innerHTML = `🌤️ Chennai: ${tempC}°C, ${cond}`;
  } catch (e) { 
    if(weatherSpan) weatherSpan.style.display = "none"; 
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById("toastContainer");
  if(!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type} show`;
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 300); }, 3000);
}

function trackVisits() {
  let visits = parseInt(localStorage.getItem("visitCounter")) || 0;
  localStorage.setItem("visitCounter", ++visits);
  if(document.getElementById("visitCountDisplay")) {
      document.getElementById("visitCountDisplay").textContent = `Visits: ${visits}`;
  }
}

function updateUserAuthUI() {
  const user = JSON.parse(localStorage.getItem('currentUser'));
  const container = document.getElementById('userAuthActions');
  if(!container) return;
  
  if (user) {
      container.innerHTML = `<a href="user-dashboard.html" style="background:#3b82f6; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; border:none; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center;">Profile</a>`;
  } else {
      container.innerHTML = `<a href="login.html" style="background:#3b82f6; color:white; padding:8px 16px; border-radius:8px; font-weight:bold; border:none; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center;">Login</a>`;
  }
}

window.addEventListener("DOMContentLoaded", init);
