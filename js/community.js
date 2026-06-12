const storedApiHost = localStorage.getItem('apiHost');
const API_HOST = !storedApiHost || ['http://127.0.0.1:5000', 'http://localhost:5000'].includes(storedApiHost)
    ? 'http://127.0.0.1:5001'
    : storedApiHost;
if (storedApiHost !== API_HOST) localStorage.setItem('apiHost', API_HOST);
const BASE_URL = `${API_HOST}/api`;

let currentUser = JSON.parse(localStorage.getItem('currentUser'));
let communityPosts = [];
let activePostId = null;
let activePaymentIntent = null;

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
    if (refText) refText.innerText = 'Generate QR to create a payment reference';
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

function isAdminUser() {
    return currentUser && currentUser.role === 'admin';
}

window.onload = async () => {
    updateAuthUI();
    await fetchCommunityData();
};

function updateAuthUI() {
    const authAction = document.getElementById('userAuthActions');
    const hostTournamentBtn = document.getElementById('hostTournamentBtn');
    if (!authAction) return;

    if (hostTournamentBtn) {
        hostTournamentBtn.style.display = isAdminUser() ? 'inline-flex' : 'none';
    }

    if (currentUser) {
        authAction.innerHTML = `<button class="nav-login-btn" onclick="window.location.href='user-dashboard.html'">Hi, ${escapeHtml(currentUser.name.split(' ')[0])}</button>`;
    } else {
        authAction.innerHTML = `<button class="nav-login-btn" onclick="window.location.href='login.html'">Login</button>`;
    }
}

async function fetchJsonOrThrow(path, options) {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }
    return data;
}

async function fetchCommunityData() {
    try {
        communityPosts = await fetchJsonOrThrow('/community');
        renderOverviewStats();
        renderLobby();
        renderWars();
        renderTournaments();
    } catch (err) {
        console.error('Failed to fetch from MongoDB:', err);
        renderOverviewError();
        renderCommunityErrorState(err.message || 'Community data could not be loaded.');
        showToast(err.message || 'Database connection error', 'error');
    }
}

function renderOverviewError() {
    setMetricText('commMetricOpenings', 'offline');
    setMetricText('commMetricWars', 'offline');
    setMetricText('commMetricTournaments', 'offline');
    setMetricText('commMetricApprovals', 'offline');
}

function renderCommunityErrorState(message) {
    const errorCard = buildEmptyState(
        'Community is unavailable right now',
        `${message} Start the backend and refresh this page.`
    );

    ['lobbyGrid', 'warsGrid', 'tournamentGrid'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = errorCard;
    });
}

function switchCommTab(tabId, buttonEl) {
    document.querySelectorAll('.comm-section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`${tabId}Section`).style.display = 'block';
    if (buttonEl) buttonEl.classList.add('active');
}

function getPostById(id) {
    return communityPosts.find(post => post._id === id);
}

function getAcceptedRequest(post) {
    return (post.requests || []).find(entry => entry.status === 'Accepted');
}

function getLiveRequestCount(post) {
    return (post.requests || []).filter(entry => entry.status !== 'Rejected').length;
}

function getPendingRequestCount(post) {
    return (post.requests || []).filter(entry => entry.status === 'Pending').length;
}

function formatEventMeta(post) {
    const parts = [];
    if (post.eventDate) parts.push(formatDate(post.eventDate));
    if (post.eventTime) parts.push(formatTime(post.eventTime));
    if (post.turf) parts.push(post.turf);
    return parts.join(' • ') || 'Details will be announced';
}

function formatDate(value) {
    if (!value) return 'Date TBA';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(value) {
    if (!value) return 'Time TBA';
    const [hourString = '0', minuteString = '00'] = String(value).split(':');
    const hour = Number(hourString);
    const minute = Number(minuteString);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return value;
    const suffix = hour >= 12 ? 'PM' : 'AM';
    const normalizedHour = hour % 12 || 12;
    return `${normalizedHour}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function normalizePhone(value) {
    return String(value || '').replace(/\D/g, '').slice(0, 10);
}

function renderOverviewStats() {
    const soloCount = communityPosts.filter(post => post.postType === 'solo').length;
    const warCount = communityPosts.filter(post => post.postType === 'team').length;
    const tournamentCount = communityPosts.filter(post => post.postType === 'tournament').length;
    const pendingApprovals = communityPosts.reduce((sum, post) => sum + getPendingRequestCount(post), 0);

    setMetricText('commMetricOpenings', `${soloCount} live`);
    setMetricText('commMetricWars', `${warCount} live`);
    setMetricText('commMetricTournaments', `${tournamentCount} live`);
    setMetricText('commMetricApprovals', `${pendingApprovals} pending`);
}

function setMetricText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function buildEmptyState(title, copy, ctaLabel = '', ctaAction = '') {
    return `
        <div class="empty-state-card">
            <div class="empty-state-icon">◎</div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(copy)}</p>
            ${ctaLabel ? `<button class="btn-post-primary" onclick="${ctaAction}">${escapeHtml(ctaLabel)}</button>` : ''}
        </div>
    `;
}

function renderLobby() {
    const grid = document.getElementById('lobbyGrid');
    const solos = communityPosts.filter(p => p.postType === 'solo');
    if (!grid) return;

    if (solos.length === 0) {
        grid.innerHTML = buildEmptyState(
            'No openings yet',
            'Captains have not posted player requirements yet. Start the board with your own opening.',
            '+ Post Opening',
            `openPostModal('solo')`
        );
        return;
    }

    grid.innerHTML = solos.map(post => {
        const isOwner = currentUser && currentUser.email === post.createdBy;
        const pendingCount = getPendingRequestCount(post);
        const acceptedCount = (post.requests || []).filter(r => r.status === 'Accepted').length;
        const isFull = post.spots === 0;

        return `
        <article class="comm-card lobby-card">
            <div class="card-eyebrow-row">
                <span class="status-tag blue">PLAYER OPENING</span>
                <span class="status-pill ${isFull ? 'danger' : 'neutral'}">${isFull ? 'Full' : `${post.spots} spots left`}</span>
            </div>
            <h3>${escapeHtml(post.teamName)}</h3>
            <p class="meta">${escapeHtml(post.sport || 'Football')} • ${escapeHtml(post.turf || 'Turf TBA')}</p>
            <div class="metric-grid compact">
                <div class="metric-item"><span>Entry</span><strong>₹${post.fare || 0}/player</strong></div>
                <div class="metric-item"><span>Accepted</span><strong>${acceptedCount}</strong></div>
                <div class="metric-item"><span>Pending</span><strong>${pendingCount}</strong></div>
                <div class="metric-item"><span>Posted by</span><strong>${isOwner ? 'You' : 'Captain'}</strong></div>
            </div>
            <div class="card-note">Phone number is required while joining so the captain can reach the player quickly.</div>
            <div class="card-actions">
                ${isOwner
                    ? `<button class="btn-secondary" onclick="openManageModal('${post._id}')">Manage Requests (${pendingCount})</button>`
                    : `<button class="btn-join" onclick="openJoinModal('${post._id}')" ${isFull ? 'disabled' : ''}>${isFull ? 'Team Full' : 'Join Team'}</button>`
                }
            </div>
        </article>
    `;
    }).join('');
}

function openJoinModal(id) {
    if (!currentUser) return alert('You must be logged in to join a team.');
    const post = getPostById(id);
    if (!post) return;
    if ((post.requests || []).some(r => r.email === currentUser.email)) {
        return alert('You already sent a request to this team.');
    }

    activePostId = id;
    document.getElementById('joinContext').innerText = `Requesting to join ${post.teamName}.`;
    document.getElementById('playerName').value = currentUser.name;
    document.getElementById('playerPhone').value = normalizePhone(currentUser.phone || '');
    document.getElementById('joinPlayerModal').style.display = 'flex';
}

function closeJoinModal() {
    document.getElementById('joinPlayerModal').style.display = 'none';
}

async function submitJoinRequest() {
    const post = getPostById(activePostId);
    const phone = normalizePhone(document.getElementById('playerPhone').value.trim());
    if (!post) return;
    if (phone.length !== 10) return alert('Phone number must be exactly 10 digits.');

    try {
        await fetchJsonOrThrow(`/community/${activePostId}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: currentUser.name,
                email: currentUser.email,
                phone,
                status: 'Pending'
            })
        });

        showToast('Join request sent to the captain.');
        closeJoinModal();
        await fetchCommunityData();
    } catch (err) {
        showToast(err.message || 'Failed to send request.', 'error');
    }
}

function renderWars() {
    const grid = document.getElementById('warsGrid');
    const wars = communityPosts.filter(p => p.postType === 'team');
    if (!grid) return;

    if (wars.length === 0) {
        grid.innerHTML = buildEmptyState(
            'No turf wars yet',
            'No active team-vs-team challenges are waiting right now. Post one and let admin review the matchup requests.',
            '+ Issue Challenge',
            `openPostModal('team')`
        );
        return;
    }

    grid.innerHTML = wars.map(war => {
        const acceptedRequest = getAcceptedRequest(war);
        const pendingCount = getPendingRequestCount(war);
        const isOwner = currentUser && currentUser.email === war.createdBy;
        const canChallenge = !isOwner && !acceptedRequest;
        const challengerName = acceptedRequest ? (acceptedRequest.teamName || acceptedRequest.name) : 'Awaiting opponent';
        const statusText = acceptedRequest ? 'Match locked by admin' : pendingCount ? 'Awaiting admin review' : 'Looking for opponent';

        return `
        <article class="comm-card war-card-premium">
            <div class="card-eyebrow-row">
                <span class="status-tag red">TURF WAR</span>
                <span class="status-pill ${acceptedRequest ? 'success' : pendingCount ? 'warning' : 'neutral'}">${escapeHtml(statusText)}</span>
            </div>
            <h3>${escapeHtml(war.teamName)} ${acceptedRequest ? `vs ${escapeHtml(challengerName)}` : 'is challenging'}</h3>
            <p class="meta">${escapeHtml(war.sport || 'Football')} • ${escapeHtml(formatEventMeta(war))}</p>
            <div class="metric-grid compact">
                <div class="metric-item"><span>Stake</span><strong>₹${war.fare || 0}</strong></div>
                <div class="metric-item"><span>Host Turf</span><strong>${escapeHtml(war.turf || 'TBA')}</strong></div>
                <div class="metric-item"><span>Queue</span><strong>${pendingCount} pending</strong></div>
                <div class="metric-item"><span>Approval</span><strong>Admin first</strong></div>
            </div>
            <div class="card-note">Challenge payments only reserve your place. The matchup goes live after admin approves one team.</div>
            <div class="card-actions">
                ${canChallenge
                    ? `<button class="btn-join btn-danger-surface" onclick="openTurfWarModal('${war._id}')">Pay Share & Send Request</button>`
                    : `<button class="btn-secondary" ${acceptedRequest ? 'disabled' : ''}>${isOwner ? 'Waiting for challengers' : acceptedRequest ? 'Match Scheduled' : 'Awaiting review'}</button>`
                }
            </div>
        </article>
    `;
    }).join('');
}

function openTurfWarModal(id) {
    if (!currentUser) return alert('You must be logged in to accept challenges.');
    const war = getPostById(id);
    if (!war) return;
    if (war.createdBy === currentUser.email) return alert('You cannot accept your own challenge.');

    activePostId = id;
    activePaymentIntent = null;

    const totalCost = Number(war.fare || 0);
    const splitCost = Math.max(1, Math.ceil(totalCost / 2));

    document.getElementById('warHostName').innerText = war.teamName;
    document.getElementById('warTotalCost').innerText = `₹${totalCost}`;
    document.getElementById('warSplitCost').innerText = `₹${splitCost}`;
    document.getElementById('warChallengerName').value = '';
    resetMockQr('warQrCanvas', 'warQrRef');
    document.getElementById('turfWarModal').style.display = 'flex';
}

async function startWarPayment() {
    const war = getPostById(activePostId);
    if (!war) return;
    const amount = Math.max(1, Math.ceil(Number(war.fare || 0) / 2));
    activePaymentIntent = generateMockPaymentIntent(`WAR-${war._id}`, amount, `Turf War ${war.teamName}`);
    drawMockQr('warQrCanvas', `${activePaymentIntent.reference}-${activePaymentIntent.amount}`);
    document.getElementById('warQrRef').innerText = `Mock Ref: ${activePaymentIntent.reference}`;
    showToast('Mock QR generated. Submit to mark the share as paid.');
}

async function confirmTurfWar() {
    const war = getPostById(activePostId);
    const challengerName = document.getElementById('warChallengerName').value.trim();
    const upiTransactionId = activePaymentIntent?.reference || '';
    if (!war) return;
    if (!challengerName) return alert('Enter your team name to accept the challenge.');
    if (!upiTransactionId) return alert('Generate the QR first to create a payment reference.');

    try {
        await fetchJsonOrThrow(`/community/${activePostId}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: currentUser.name,
                teamName: challengerName,
                email: currentUser.email,
                phone: normalizePhone(currentUser.phone || ''),
                status: 'Pending',
                paymentStatus: 'Paid',
                paymentAmount: Math.max(1, Math.ceil(Number(war.fare || 0) / 2)),
                upiTransactionId
            })
        });

        showToast('Challenge request sent for admin approval.');
        document.getElementById('turfWarModal').style.display = 'none';
        await fetchCommunityData();
    } catch (err) {
        showToast(err.message || 'Failed to submit the challenge.', 'error');
    }
}

function openPostModal(type) {
    if (!currentUser) return alert('You must be logged in to post.');
    if (type === 'tournament' && !isAdminUser()) return alert('Only admins can create tournaments.');
    document.getElementById('postType').value = type;
    document.getElementById('modalTitle').innerText =
        type === 'solo'
            ? 'Post Individual Opening'
            : type === 'team'
                ? 'Issue Turf War Challenge'
                : 'Host Tournament';
    document.getElementById('labelName').innerText = type === 'solo' ? 'Team Name' : type === 'team' ? 'Team Name' : 'Tournament Name';
    document.getElementById('soloFields').style.display = type === 'solo' ? 'block' : 'none';
    document.getElementById('teamFields').style.display = type === 'team' ? 'block' : 'none';
    document.getElementById('tournamentFields').style.display = type === 'tournament' ? 'block' : 'none';
    document.getElementById('postModalHint').textContent = type === 'team' || type === 'tournament'
        ? 'All matchups and registrations go through admin approval before they are confirmed.'
        : 'Captains can review player requests and accept them manually.';
    document.getElementById('commName').placeholder = type === 'tournament' ? 'e.g. Summer Turf Cup 2026' : 'e.g. Marina Sharks';
    document.getElementById('commDate').value = '';
    document.getElementById('commTime').value = '';
    document.getElementById('commTournamentDate').value = '';
    document.getElementById('commTournamentTime').value = '';
    document.getElementById('commModal').style.display = 'flex';
}

function closeCommModal() {
    document.getElementById('commModal').style.display = 'none';
}

async function handlePostSubmit() {
    const type = document.getElementById('postType').value;
    const teamName = document.getElementById('commName').value.trim();
    if (!teamName) return alert('Team name is required.');

    const eventDate = type === 'tournament'
        ? document.getElementById('commTournamentDate').value
        : document.getElementById('commDate').value;
    const eventTime = type === 'tournament'
        ? document.getElementById('commTournamentTime').value
        : document.getElementById('commTime').value;

    if (type === 'tournament' && !eventDate) {
        return alert('Tournament date is required.');
    }

    const newPost = {
        postType: type,
        sport: document.getElementById('commSport').value,
        teamName,
        turf: document.getElementById('commTurf').value.trim(),
        spots: type === 'solo' ? Number(document.getElementById('commSpots').value || 0) : 0,
        fare: type === 'tournament'
            ? Number(document.getElementById('commTournamentFee').value || 0)
            : Number(document.getElementById('commFare').value || 0),
        prizePool: type === 'tournament' ? document.getElementById('commPrizePool').value.trim() : '',
        eventDate,
        eventTime,
        maxTeams: type === 'tournament' ? Number(document.getElementById('commMaxTeams').value || 16) : 0,
        createdBy: currentUser.email,
        status: type === 'tournament' ? 'Registrations Open' : 'Open'
    };

    try {
        await fetchJsonOrThrow('/community', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newPost)
        });

        closeCommModal();
        showToast(type === 'team' ? 'Challenge created. Admin will review challengers.' : 'Community post created successfully.');
        await fetchCommunityData();
    } catch (err) {
        showToast(err.message || 'Failed to post to server.', 'error');
    }
}

function renderTournaments() {
    const grid = document.getElementById('tournamentGrid');
    const tournaments = communityPosts.filter(post => post.postType === 'tournament');
    if (!grid) return;

    if (tournaments.length === 0) {
        grid.innerHTML = buildEmptyState(
            'No tournaments live yet',
            'No weekend cups are open right now. Host one and admin can still moderate registrations and cleanup later.',
            isAdminUser() ? '+ Host Tournament' : '',
            isAdminUser() ? `openPostModal('tournament')` : ''
        );
        return;
    }

    grid.innerHTML = tournaments.map(post => {
        const joinedTeams = getLiveRequestCount(post);
        const pendingTeams = getPendingRequestCount(post);
        const hasJoined = (post.requests || []).some(entry => entry.email === (currentUser && currentUser.email));
        const isFull = post.maxTeams > 0 && joinedTeams >= post.maxTeams;
        const isOwner = currentUser && currentUser.email === post.createdBy;

        return `
        <article class="comm-card tournament-card-premium">
            <div class="card-eyebrow-row">
                <span class="status-tag gold">TOURNAMENT</span>
                <span class="status-pill ${isFull ? 'danger' : 'success'}">${isFull ? 'Registration closed' : escapeHtml(post.status || 'Registrations Open')}</span>
            </div>
            <h3>${escapeHtml(post.teamName)}</h3>
            <p class="meta">${escapeHtml(post.sport || 'Football')} • ${escapeHtml(post.turf || 'Venue TBA')}</p>
            <div class="metric-grid compact">
                <div class="metric-item"><span>Date</span><strong>${escapeHtml(formatDate(post.eventDate))}</strong></div>
                <div class="metric-item"><span>Start</span><strong>${escapeHtml(formatTime(post.eventTime))}</strong></div>
                <div class="metric-item"><span>Entry Fee</span><strong>₹${post.fare || 0}</strong></div>
                <div class="metric-item"><span>Teams</span><strong>${joinedTeams}${post.maxTeams ? ` / ${post.maxTeams}` : ''}</strong></div>
            </div>
            <div class="card-note">${pendingTeams ? `${pendingTeams} registrations are waiting for admin review.` : 'Paid registrations still require admin approval before final confirmation.'}</div>
            <div class="card-actions">
                ${isOwner
                    ? `<button class="btn-secondary" onclick="openManageModal('${post._id}')">View Teams (${joinedTeams})</button>`
                    : `<button class="btn-join btn-gold-surface" onclick="openTournamentModal('${post._id}')" ${hasJoined || isFull ? 'disabled' : ''}>${hasJoined ? 'Already Registered' : (isFull ? 'Registration Closed' : 'Pay & Register')}</button>`
                }
            </div>
        </article>
        `;
    }).join('');
}

function openTournamentModal(id) {
    if (!currentUser) return alert('You must be logged in to register for a tournament.');
    const post = getPostById(id);
    if (!post) return;
    if ((post.requests || []).some(entry => entry.email === currentUser.email)) {
        return alert('You already registered for this tournament.');
    }

    activePostId = id;
    activePaymentIntent = null;
    document.getElementById('tourneyNameDisplay').innerText = post.teamName;
    document.getElementById('tourneyFeeDisplay').innerText = `Entry Fee: ₹${post.fare || 0}`;
    document.getElementById('tourneyTeamName').value = '';
    document.getElementById('tourneyPhone').value = normalizePhone(currentUser.phone || '');
    resetMockQr('tourneyQrCanvas', 'tourneyQrRef');
    document.getElementById('tournamentModal').style.display = 'flex';
}

async function startTournamentPayment() {
    const post = getPostById(activePostId);
    if (!post) return;
    activePaymentIntent = generateMockPaymentIntent(`TRN-${post._id}`, Number(post.fare || 0), `Tournament ${post.teamName}`);
    drawMockQr('tourneyQrCanvas', `${activePaymentIntent.reference}-${activePaymentIntent.amount}`);
    document.getElementById('tourneyQrRef').innerText = `Mock Ref: ${activePaymentIntent.reference}`;
    showToast('Mock QR generated. Submit registration to mark payment as paid.');
}

async function confirmTourneyRegistration() {
    const post = getPostById(activePostId);
    const teamName = document.getElementById('tourneyTeamName').value.trim();
    const phone = normalizePhone(document.getElementById('tourneyPhone').value.trim());
    const upiTransactionId = activePaymentIntent?.reference || '';
    if (!post) return;
    if (!teamName || phone.length !== 10) return alert('Enter your team name and a valid 10-digit captain phone number.');
    if (!upiTransactionId) return alert('Generate the QR first to create a payment reference.');

    try {
        await fetchJsonOrThrow(`/community/${activePostId}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: currentUser.name,
                teamName,
                email: currentUser.email,
                phone,
                status: 'Pending',
                paymentStatus: 'Paid',
                paymentAmount: Number(post.fare || 0),
                upiTransactionId
            })
        });

        document.getElementById('tournamentModal').style.display = 'none';
        showToast('Tournament registration sent for admin approval.');
        await fetchCommunityData();
    } catch (err) {
        showToast(err.message || 'Registration failed.', 'error');
    }
}

function openManageModal(postId) {
    const post = getPostById(postId);
    if (!post) return;
    activePostId = postId;

    const title = document.getElementById('manageModalTitle');
    const container = document.getElementById('requestsListContainer');
    const requests = post.requests || [];
    const canOwnerModerate = post.postType === 'solo';
    const acceptedCount = (post.requests || []).filter(request => request.status === 'Accepted').length;

    if (title) {
        title.textContent = post.postType === 'solo' ? 'Manage Applicants' : 'Submission Status';
    }

    const spotsManager = canOwnerModerate ? `
        <div class="request-item">
            <div class="request-copy">
                <div class="request-title">Available slots</div>
                <div class="request-meta">Change how many player spots are still open for this team.</div>
                <div class="request-submeta">Accepted players: ${acceptedCount} • Remaining spots: ${post.spots}</div>
            </div>
            <div class="request-actions">
                <input type="number" id="manageSpotsInput" min="0" value="${post.spots}" style="width:90px; min-height:38px; border-radius:12px; border:1px solid rgba(148, 163, 184, 0.24); background:rgba(15, 23, 42, 0.88); color:white; padding:0 12px;">
                <button class="btn-acc" onclick="updateOpeningSpots('${post._id}')">Save</button>
            </div>
        </div>
    ` : '';

    if (requests.length === 0) {
        container.innerHTML = `${spotsManager}<div class="empty-inline">No requests yet.</div>`;
    } else {
        container.innerHTML = `${spotsManager}${requests.map(request => `
            <div class="request-item">
                <div class="request-copy">
                    <div class="request-title">${escapeHtml(request.teamName || request.name || 'Unknown Applicant')}</div>
                    <div class="request-meta">${escapeHtml(request.email || 'No email')}${request.phone ? ` • ${escapeHtml(request.phone)}` : ''}</div>
                    <div class="request-status ${String(request.status || '').toLowerCase()}">${escapeHtml(request.status || 'Pending')}</div>
                    ${request.upiTransactionId ? `<div class="request-submeta">UPI Ref: ${escapeHtml(request.upiTransactionId)}</div>` : ''}
                </div>
                ${canOwnerModerate
                    ? `<div class="request-actions">
                        <button class="btn-acc" onclick="updateRequestStatus('${post._id}', '${request._id}', 'Accepted')">Accept</button>
                        <button class="btn-rej" onclick="updateRequestStatus('${post._id}', '${request._id}', 'Rejected')">Reject</button>
                    </div>`
                    : `<div class="request-admin-note">Admin controls approval and removal for this post.</div>`
                }
            </div>
        `).join('')}`;
    }

    document.getElementById('manageRequestsModal').style.display = 'flex';
}

function closeManageModal() {
    document.getElementById('manageRequestsModal').style.display = 'none';
}

async function updateRequestStatus(postId, requestId, status) {
    try {
        await fetchJsonOrThrow(`/community/${postId}/request/${requestId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });

        showToast(`Request ${status.toLowerCase()}.`);
        await fetchCommunityData();
        openManageModal(postId);
    } catch (err) {
        showToast(err.message || 'Could not update request.', 'error');
    }
}

async function updateOpeningSpots(postId) {
    const input = document.getElementById('manageSpotsInput');
    const spots = Math.max(0, parseInt(input?.value, 10) || 0);

    try {
        await fetchJsonOrThrow(`/community/${postId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spots })
        });

        showToast(`Available spots updated to ${spots}.`);
        await fetchCommunityData();
        openManageModal(postId);
    } catch (err) {
        showToast(err.message || 'Could not update available spots.', 'error');
    }
}

function showToast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type} show`;
    toast.innerHTML = `<span>${escapeHtml(msg)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
