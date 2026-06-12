/* =========================================
   USER DASHBOARD - LIVE MONGODB LINK
   ========================================= */
const storedApiHost = localStorage.getItem('apiHost');
const API_HOST = !storedApiHost || ['http://127.0.0.1:5000', 'http://localhost:5000'].includes(storedApiHost)
    ? 'http://127.0.0.1:5001'
    : storedApiHost;
if (storedApiHost !== API_HOST) localStorage.setItem('apiHost', API_HOST);
const BASE_URL = `${API_HOST}/api`;

async function fetchJsonOrThrow(path, options = {}) {
    const response = await fetch(`${BASE_URL}${path}`, options);
    const rawText = await response.text();

    let data;
    try {
        data = rawText ? JSON.parse(rawText) : null;
    } catch (parseError) {
        throw new Error(`Invalid JSON response from ${path}.`);
    }

    if (!response.ok) {
        const msg = data && data.error ? data.error : `Request failed with status ${response.status}`;
        throw new Error(msg);
    }

    return data;
}

async function init() {
    const user = JSON.parse(localStorage.getItem('currentUser'));
    
    // Security Guard: Kick them to login if not authenticated
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Personalize UI
    const displayName = (user.name || 'Player').split(' ')[0];
    document.getElementById('welcomeName').innerHTML = user.role === 'admin'
        ? `Welcome admin, <span>${displayName}</span>`
        : `Welcome back, <span>${displayName}</span>`;

    // Fetch live data from MongoDB
    await fetchAndRenderBookings(user.email);
    await fetchAndRenderTeams(user.email); 
}

/* =========================================
   1. FETCH BOOKINGS
   ========================================= */
async function fetchAndRenderBookings(userEmail) {
    const tableBody = document.getElementById('userBookingTable');
    
    try {
        const allBookings = await fetchJsonOrThrow('/bookings');
        
        // FILTER: Keep only bookings that belong to this exact user
        const myBookings = allBookings.filter(b => b.userEmail === userEmail);
        
        document.getElementById('countBookings').innerText = myBookings.length;
        const refundCredits = myBookings.reduce((sum, booking) => sum + Number(booking.refundAmount || 0), 0);
        document.getElementById('creditsValue').innerText = `₹${refundCredits}`;

        if (myBookings.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">No bookings yet. Ready for a match?</td></tr>`;
            return;
        }

        tableBody.innerHTML = myBookings.map(b => {
            const turfName = b.turfId && b.turfId.name ? b.turfId.name : "TurfArena Partner";
            const price = b.turfId && b.turfId.basePrice ? b.turfId.basePrice : 1000;
            const bookingStatus = String(b.status || 'Confirmed');
            const tagClass = bookingStatus.toLowerCase() === 'cancelled' ? 'cancelled' : bookingStatus.toLowerCase() === 'pending' ? 'pending' : 'confirmed';
            const refundText = bookingStatus === 'Cancelled'
                ? (Number(b.refundAmount || 0) > 0 ? `Refunded ₹${b.refundAmount}` : 'No refund')
                : 'Eligible if cancelled 30 min early';
            const canCancel = canCancelBooking(b);
            
            return `
                <tr>
                    <td><strong>${turfName}</strong></td>
                    <td>${formatBookingDate(b.date)}<br><span style="color:var(--text-muted); font-size:0.78rem;">${b.slots.map(formatHour).join(', ')}</span></td>
                    <td>₹${b.slots.length * price}</td>
                    <td><span class="status-tag tag-${tagClass}">${bookingStatus}</span></td>
                    <td>${refundText}</td>
                    <td><button class="btn-cancel-booking" onclick="cancelBooking('${b._id}')" ${canCancel ? '' : 'disabled'}>${bookingStatus === 'Cancelled' ? 'Cancelled' : 'Cancel'}</button></td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error("Failed to fetch user bookings:", err);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#ef4444;">${err.message || 'Could not load bookings from server.'}</td></tr>`;
    }
}

function getBookingStartTime(booking) {
    const bookingDate = String(booking?.date || '').slice(0, 10);
    const firstSlot = (booking?.slots || [])
        .map(slot => parseInt(slot, 10))
        .filter(Number.isInteger)
        .sort((a, b) => a - b)[0];

    if (!bookingDate || !Number.isInteger(firstSlot)) return null;
    const [year, month, day] = bookingDate.split('-').map(Number);
    return new Date(year, month - 1, day, firstSlot, 0, 0, 0);
}

function canCancelBooking(booking) {
    return String(booking?.status || '').toLowerCase() !== 'cancelled';
}

function formatBookingDate(value) {
    if (!value) return 'Date TBA';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

async function cancelBooking(bookingId) {
    const user = JSON.parse(localStorage.getItem('currentUser') || 'null');
    if (!user) return;

    try {
        const booking = await fetchJsonOrThrow(`/bookings`);
        const target = booking.find(entry => entry._id === bookingId && entry.userEmail === user.email);
        if (!target) {
            alert('Booking not found.');
            return;
        }

        const startAt = getBookingStartTime(target);
        const qualifiesForRefund = !!startAt && (startAt.getTime() - Date.now()) >= (30 * 60 * 1000);
        const confirmText = qualifiesForRefund
            ? 'Cancel this booking? Refund will be issued because it is more than 30 minutes before the slot.'
            : 'Cancel this booking? No refund will be issued because it is within 30 minutes of the slot.';

        if (!confirm(confirmText)) return;

        const updated = await fetchJsonOrThrow(`/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'Cancelled' })
        });

        alert(Number(updated.refundAmount || 0) > 0
            ? `Booking cancelled. Refund credited: ₹${updated.refundAmount}.`
            : 'Booking cancelled. Refund not applicable.');

        await fetchAndRenderBookings(user.email);
    } catch (err) {
        alert(err.message || 'Could not cancel booking.');
    }
}

function formatHour(h) {
    const hourNum = parseInt(h, 10);
    if (isNaN(hourNum)) return h;
    const fmt = (x) => `${x % 12 || 12}:00 ${x < 12 ? "AM" : "PM"}`;
    return `${fmt(hourNum)}`;
}

/* =========================================
   2. FETCH REAL TEAM REQUESTS 
   ========================================= */
async function fetchAndRenderTeams(userEmail) {
    const container = document.getElementById('userTeamsList');
    
    try {
        const allPosts = await fetchJsonOrThrow('/community');

        // Find all posts where this user's email is inside the "requests" array
        let myTeams = [];
        allPosts.forEach(post => {
            const userRequest = (post.requests || []).find(req => req.email === userEmail);
            if (userRequest) {
                myTeams.push({
                    name: post.teamName || "TurfArena Team",
                    sport: post.sport || "Multi-sport",
                    status: userRequest.status // 'Pending' or 'Accepted'
                });
            }
        });

        document.getElementById('countTeams').innerText = myTeams.length;

        if (myTeams.length === 0) {
            container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:20px;">You haven't requested to join any teams yet.</p>`;
            return;
        }

        container.innerHTML = myTeams.map(t => {
            const badgeClass = t.status === 'Accepted' || t.status === 'Confirmed' ? 'confirmed' : 'pending';
            return `
            <div class="team-item" style="display:flex; justify-content:space-between; align-items:center; padding:15px; border-bottom:1px solid rgba(255,255,255,0.05);">
                <div>
                    <div style="font-weight:700;">${t.name}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${t.sport}</div>
                </div>
                <span class="status-tag tag-${badgeClass}">${t.status}</span>
            </div>
        `}).join('');

    } catch (err) {
        console.error("Failed to fetch teams:", err);
        container.innerHTML = `<p style="color:#ef4444; text-align:center;">${err.message || 'Could not load teams.'}</p>`;
    }
}

function logout() {
    if(confirm("Ready to sign out?")) {
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

window.addEventListener('DOMContentLoaded', init);
