// DHL Package Tracker - Cloud Storage with JSONbin
// This file handles all data operations using JSONbin API

const JSONBIN_API = 'https://api.jsonbin.io/v3';

// Try to get from localStorage first, then fall back to config.js
function getBinId() {
    return localStorage.getItem('dhl_bin_id') || (window.CONFIG && window.CONFIG.BIN_ID) || null;
}

function getApiKey() {
    return localStorage.getItem('dhl_api_key') || (window.CONFIG && window.CONFIG.API_KEY) || null;
}

// Check if configured
function isConfigured() {
    return getBinId() && getApiKey();
}

// Show setup modal if not configured
function showSetupModal() {
    const modal = document.getElementById('setupModal');
    if (modal) modal.classList.add('active');
}

// Hide setup modal
function hideSetupModal() {
    const modal = document.getElementById('setupModal');
    if (modal) modal.classList.remove('active');
}

// Save configuration
function saveConfig(binId, apiKey) {
    localStorage.setItem('dhl_bin_id', binId);
    localStorage.setItem('dhl_api_key', apiKey);
}

// Get shipments from JSONbin
async function getShipmentsFromCloud() {
    if (!isConfigured()) {
        return [];
    }

    try {
        const response = await fetch(`${JSONBIN_API}/b/${getBinId()}/latest`, {
            headers: {
                'X-Access-Key': getApiKey()
            }
        });

        if (!response.ok) {
            console.error('Failed to fetch from JSONbin');
            return [];
        }

        const data = await response.json();
        return data.record.shipments || [];
    } catch (error) {
        console.error('Error fetching shipments:', error);
        return [];
    }
}

// Save shipments to JSONbin
async function saveShipmentsToCloud(shipments) {
    if (!isConfigured()) {
        console.error('JSONbin not configured');
        return false;
    }

    try {
        const response = await fetch(`${JSONBIN_API}/b/${getBinId()}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Key': getApiKey()
            },
            body: JSON.stringify({ shipments })
        });

        return response.ok;
    } catch (error) {
        console.error('Error saving shipments:', error);
        return false;
    }
}

// Create new bin (for first-time setup)
async function createNewBin(apiKey) {
    try {
        const response = await fetch(`${JSONBIN_API}/b`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Access-Key': apiKey,
                'X-Bin-Name': 'dhl-package-tracker',
                'X-Bin-Private': 'false'
            },
            body: JSON.stringify({ shipments: [] })
        });

        if (!response.ok) {
            throw new Error('Failed to create bin');
        }

        const data = await response.json();
        return data.metadata.id;
    } catch (error) {
        console.error('Error creating bin:', error);
        throw error;
    }
}

// Export for use in main app
window.CloudStorage = {
    isConfigured,
    showSetupModal,
    hideSetupModal,
    saveConfig,
    getShipments: getShipmentsFromCloud,
    saveShipments: saveShipmentsToCloud,
    createNewBin,
    getBinId,
    getApiKey
};
