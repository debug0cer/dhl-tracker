// DHL Package Tracker - Application Logic with Cloud Storage

// Status labels
const STATUS_LABELS = {
    pending: 'Pending',
    in_transit: 'In Transit',
    delivered: 'Delivered',
    exception: 'Exception',
    arrived: 'Arrived at Facility',
    departed: 'Departed Facility',
    out_for_delivery: 'Out for Delivery'
};

// Local cache for shipments
let shipmentsCache = [];
let isLoading = false;

// DOM Elements
const dashboardView = document.getElementById('dashboardView');
const trackingView = document.getElementById('trackingView');
const shipmentsGrid = document.getElementById('shipmentsGrid');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');

// Stats
const pendingCount = document.getElementById('pendingCount');
const transitCount = document.getElementById('transitCount');
const deliveredCount = document.getElementById('deliveredCount');
const exceptionCount = document.getElementById('exceptionCount');

// Modals
const shipmentModal = document.getElementById('shipmentModal');
const locationModal = document.getElementById('locationModal');
const setupModal = document.getElementById('setupModal');
const shipmentForm = document.getElementById('shipmentForm');
const locationForm = document.getElementById('locationForm');

// Buttons
const addShipmentBtn = document.getElementById('addShipmentBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const closeLocationModalBtn = document.getElementById('closeLocationModalBtn');
const cancelLocationBtn = document.getElementById('cancelLocationBtn');
const updateLocationBtn = document.getElementById('updateLocationBtn');
const shareLinkBtn = document.getElementById('shareLinkBtn');
const deleteShipmentBtn = document.getElementById('deleteShipmentBtn');
const backBtn = document.getElementById('backBtn');
const saveSetupBtn = document.getElementById('saveSetupBtn');

// Navigation
const navBtns = document.querySelectorAll('.nav-btn');

// Current shipment being viewed
let currentShipmentId = null;

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupEventListeners();

    // Check if cloud storage is configured
    if (!CloudStorage.isConfigured()) {
        CloudStorage.showSetupModal();
    } else {
        await loadShipments();
    }
}

// Event Listeners
function setupEventListeners() {
    // Navigation
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (view === 'dashboard') showDashboard();
        });
    });

    // Add Shipment
    addShipmentBtn.addEventListener('click', () => {
        if (!CloudStorage.isConfigured()) {
            CloudStorage.showSetupModal();
            return;
        }
        openModal(shipmentModal);
    });
    closeModalBtn.addEventListener('click', () => closeModal(shipmentModal));
    cancelModalBtn.addEventListener('click', () => closeModal(shipmentModal));

    // Shipment Form
    shipmentForm.addEventListener('submit', handleCreateShipment);

    // Location Modal
    closeLocationModalBtn.addEventListener('click', () => closeModal(locationModal));
    cancelLocationBtn.addEventListener('click', () => closeModal(locationModal));
    updateLocationBtn.addEventListener('click', () => openModal(locationModal));
    locationForm.addEventListener('submit', handleUpdateLocation);

    // Delete Shipment
    deleteShipmentBtn.addEventListener('click', handleDeleteShipment);

    // Share Link
    shareLinkBtn.addEventListener('click', handleShareLink);

    // Back Button
    backBtn.addEventListener('click', showDashboard);

    // Search
    searchInput.addEventListener('input', handleSearch);

    // Close modals on overlay click
    [shipmentModal, locationModal].forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // Setup modal
    saveSetupBtn.addEventListener('click', handleSetup);
}

// Handle cloud setup
async function handleSetup() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    let binId = document.getElementById('binIdInput').value.trim();

    if (!apiKey) {
        alert('Please enter your JSONbin API Key');
        return;
    }

    saveSetupBtn.textContent = 'Connecting...';
    saveSetupBtn.disabled = true;

    try {
        // If no bin ID, create new bin
        if (!binId) {
            binId = await CloudStorage.createNewBin(apiKey);
        }

        // Save config
        CloudStorage.saveConfig(binId, apiKey);
        CloudStorage.hideSetupModal();

        // Load shipments
        await loadShipments();

        alert('✅ Connected successfully!\n\nYour Bin ID: ' + binId + '\n\nSave this ID to use on other devices.');
    } catch (error) {
        alert('❌ Connection failed. Please check your API key.');
    } finally {
        saveSetupBtn.textContent = 'Save & Connect';
        saveSetupBtn.disabled = false;
    }
}

// Storage Functions - Now using cloud
async function getShipments() {
    return shipmentsCache;
}

async function loadShipments() {
    if (isLoading) return;
    isLoading = true;

    try {
        shipmentsCache = await CloudStorage.getShipments();
        updateStats();
        renderShipments();
    } catch (error) {
        console.error('Error loading shipments:', error);
    } finally {
        isLoading = false;
    }
}

async function saveShipments(shipments) {
    shipmentsCache = shipments;
    await CloudStorage.saveShipments(shipments);
}

// Generate Tracking Number
function generateTrackingNumber() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'DHL-';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Format Date
function formatDate(date) {
    return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Calculate Progress
function calculateProgress(shipment) {
    if (shipment.status === 'delivered') return 100;
    if (shipment.status === 'pending') return 10;

    const checkpoints = shipment.checkpoints.length;
    if (checkpoints === 0) return 15;

    return Math.min(15 + (checkpoints * 15), 85);
}

// Create Shipment
async function handleCreateShipment(e) {
    e.preventDefault();

    const origin = document.getElementById('originInput').value.trim();
    const destination = document.getElementById('destinationInput').value.trim();
    const description = document.getElementById('descriptionInput').value.trim();

    const shipment = {
        id: Date.now().toString(),
        trackingNumber: generateTrackingNumber(),
        origin: { name: origin, timestamp: new Date().toISOString() },
        destination: { name: destination },
        currentLocation: { name: origin, timestamp: new Date().toISOString() },
        status: 'pending',
        description: description || 'Package',
        checkpoints: [
            {
                location: origin,
                status: 'Package received',
                timestamp: new Date().toISOString(),
                notes: 'Shipment created'
            }
        ],
        createdAt: new Date().toISOString()
    };

    shipmentsCache.unshift(shipment);
    await saveShipments(shipmentsCache);

    closeModal(shipmentModal);
    shipmentForm.reset();
    updateStats();
    renderShipments();
}

// Update Location
async function handleUpdateLocation(e) {
    e.preventDefault();

    const location = document.getElementById('newLocationInput').value.trim();
    const status = document.getElementById('statusSelect').value;
    const notes = document.getElementById('notesInput').value.trim();

    const index = shipmentsCache.findIndex(s => s.id === currentShipmentId);

    if (index !== -1) {
        const checkpoint = {
            location: location,
            status: STATUS_LABELS[status] || status,
            timestamp: new Date().toISOString(),
            notes: notes || null
        };

        shipmentsCache[index].checkpoints.unshift(checkpoint);
        shipmentsCache[index].currentLocation = { name: location, timestamp: checkpoint.timestamp };

        // Update main status
        if (status === 'delivered') {
            shipmentsCache[index].status = 'delivered';
        } else if (status === 'exception') {
            shipmentsCache[index].status = 'exception';
        } else if (shipmentsCache[index].status === 'pending') {
            shipmentsCache[index].status = 'in_transit';
        }

        await saveShipments(shipmentsCache);
        closeModal(locationModal);
        locationForm.reset();
        updateStats();
        renderTrackingDetail(shipmentsCache[index]);
        renderShipments();
    }
}

// Delete Shipment
async function handleDeleteShipment() {
    if (!confirm('Are you sure you want to delete this shipment?')) return;

    shipmentsCache = shipmentsCache.filter(s => s.id !== currentShipmentId);
    await saveShipments(shipmentsCache);

    showDashboard();
    updateStats();
    renderShipments();
}

// Share Link
function handleShareLink() {
    const shipment = shipmentsCache.find(s => s.id === currentShipmentId);

    if (!shipment) return;

    // Use GitHub Pages URL pattern
    const currentUrl = window.location.href;
    const baseUrl = currentUrl.substring(0, currentUrl.lastIndexOf('/') + 1);
    const trackingUrl = `${baseUrl}track.html?id=${shipment.trackingNumber}`;

    navigator.clipboard.writeText(trackingUrl).then(() => {
        const originalText = shareLinkBtn.innerHTML;
        shareLinkBtn.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 6L9 17l-5-5"/>
            </svg>
            Copied!
        `;
        shareLinkBtn.style.color = 'var(--status-delivered)';

        setTimeout(() => {
            shareLinkBtn.innerHTML = originalText;
            shareLinkBtn.style.color = '';
        }, 2000);
    }).catch(() => {
        prompt('Copy this tracking link:', trackingUrl);
    });
}

// Update Stats
function updateStats() {
    pendingCount.textContent = shipmentsCache.filter(s => s.status === 'pending').length;
    transitCount.textContent = shipmentsCache.filter(s => s.status === 'in_transit').length;
    deliveredCount.textContent = shipmentsCache.filter(s => s.status === 'delivered').length;
    exceptionCount.textContent = shipmentsCache.filter(s => s.status === 'exception').length;
}

// Render Shipments
function renderShipments(filter = '') {
    let shipments = shipmentsCache;

    if (filter) {
        shipments = shipments.filter(s =>
            s.trackingNumber.toLowerCase().includes(filter.toLowerCase()) ||
            s.origin.name.toLowerCase().includes(filter.toLowerCase()) ||
            s.destination.name.toLowerCase().includes(filter.toLowerCase())
        );
    }

    const cards = shipmentsGrid.querySelectorAll('.shipment-card');
    cards.forEach(card => card.remove());

    if (shipments.length === 0) {
        emptyState.style.display = 'flex';
        return;
    }

    emptyState.style.display = 'none';

    shipments.forEach(shipment => {
        const card = createShipmentCard(shipment);
        shipmentsGrid.appendChild(card);
    });
}

// Create Shipment Card
function createShipmentCard(shipment) {
    const card = document.createElement('div');
    card.className = 'shipment-card';
    card.onclick = () => showTrackingDetail(shipment.id);

    const progress = calculateProgress(shipment);

    card.innerHTML = `
        <div class="shipment-header">
            <span class="shipment-tracking">${shipment.trackingNumber}</span>
            <span class="shipment-badge ${shipment.status}">${STATUS_LABELS[shipment.status] || shipment.status}</span>
        </div>
        <div class="shipment-route">
            <div class="shipment-location">
                <span class="shipment-location-label">From</span>
                <span class="shipment-location-name">${shipment.origin.name}</span>
            </div>
            <svg class="shipment-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
            <div class="shipment-location">
                <span class="shipment-location-label">To</span>
                <span class="shipment-location-name">${shipment.destination.name}</span>
            </div>
        </div>
        <div class="shipment-progress">
            <div class="shipment-progress-bar" style="width: ${progress}%"></div>
        </div>
        <div class="shipment-footer">
            <span class="shipment-current">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                    <circle cx="12" cy="10" r="3"/>
                </svg>
                ${shipment.currentLocation.name}
            </span>
            <span>${formatDate(shipment.currentLocation.timestamp)}</span>
        </div>
    `;

    return card;
}

// Show Tracking Detail
function showTrackingDetail(id) {
    const shipment = shipmentsCache.find(s => s.id === id);

    if (!shipment) return;

    currentShipmentId = id;
    renderTrackingDetail(shipment);

    dashboardView.classList.remove('active');
    trackingView.classList.add('active');

    navBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-view="tracking"]').classList.add('active');
}

// Render Tracking Detail
function renderTrackingDetail(shipment) {
    document.getElementById('detailTrackingNumber').textContent = shipment.trackingNumber;

    const statusEl = document.getElementById('detailStatus');
    statusEl.textContent = STATUS_LABELS[shipment.status] || shipment.status;
    statusEl.className = `tracking-status ${shipment.status}`;

    document.getElementById('detailOrigin').textContent = shipment.origin.name;
    document.getElementById('detailOriginTime').textContent = formatDate(shipment.origin.timestamp);
    document.getElementById('detailDestination').textContent = shipment.destination.name;

    const progress = calculateProgress(shipment);
    document.getElementById('progressFill').style.width = `${progress}%`;

    const etaEl = document.getElementById('detailETA');
    if (shipment.status === 'delivered') {
        etaEl.textContent = 'Delivered';
    } else {
        etaEl.textContent = 'In Progress';
    }

    renderTimeline(shipment);
}

// Render Timeline
function renderTimeline(shipment) {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';

    shipment.checkpoints.forEach((checkpoint, index) => {
        const item = document.createElement('div');
        item.className = 'timeline-item';

        if (index === 0) {
            item.classList.add('active');
        } else if (shipment.status === 'delivered') {
            item.classList.add('completed');
        }

        item.innerHTML = `
            <div class="timeline-marker">
                ${index === 0 ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>' : ''}
            </div>
            <div class="timeline-content">
                <div class="timeline-location">${checkpoint.location}</div>
                <div class="timeline-status">${checkpoint.status}</div>
                <div class="timeline-time">${formatDate(checkpoint.timestamp)}</div>
                ${checkpoint.notes ? `<div class="timeline-notes">${checkpoint.notes}</div>` : ''}
            </div>
        `;

        timeline.appendChild(item);
    });
}

// Show Dashboard
function showDashboard() {
    currentShipmentId = null;
    trackingView.classList.remove('active');
    dashboardView.classList.add('active');

    navBtns.forEach(btn => btn.classList.remove('active'));
    document.querySelector('[data-view="dashboard"]').classList.add('active');

    // Refresh data from cloud
    loadShipments();
}

// Search
function handleSearch(e) {
    renderShipments(e.target.value);
}

// Modal Functions
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}
