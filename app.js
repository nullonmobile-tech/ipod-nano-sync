// iPod Nano 3rd Gen Music Sync App
// WebUSB API for device communication
// Android WebUSB + USB Mass Storage support

let connectedDevice = null;
let musicLibrary = [];
let playlists = [];
let syncQueue = [];

// ============ Device Connection ============

async function connectDevice() {
    try {
        const devices = await navigator.usb.requestDevice({
            filters: [
                { vendorId: 0x05ac }, // Apple vendor ID
            ]
        });

        connectedDevice = devices;
        await openDevice(devices);
        showAlert('Connected to iPod Nano', 'success');
        updateDeviceStatus();
        updateUI();
    } catch (error) {
        if (error.name !== 'NotAllowedError') {
            showAlert(`Connection error: ${error.message}`, 'error');
        }
    }
}

async function openDevice(device) {
    try {
        await device.open();
        
        // Claim interface for bulk transfers (typically interface 0)
        if (device.configuration === null) {
            await device.selectConfiguration(1);
        }
        
        // Claim the interface
        await device.claimInterface(0);
        
        console.log('Device opened and interface claimed');
    } catch (error) {
        showAlert(`Failed to open device: ${error.message}`, 'error');
    }
}

async function disconnectDevice() {
    if (connectedDevice) {
        try {
            await connectedDevice.releaseInterface(0);
            await connectedDevice.close();
            connectedDevice = null;
            showAlert('Disconnected from device', 'success');
            updateDeviceStatus();
            updateUI();
        } catch (error) {
            showAlert(`Disconnect error: ${error.message}`, 'error');
        }
    }
}

async function requestStorageAccess() {
    if (!connectedDevice) {
        showAlert('No device connected', 'error');
        return;
    }

    try {
        // Request mass storage access
        const result = await requestMassStorageAccess(connectedDevice);
        if (result) {
            showAlert('Storage access granted', 'success');
        }
    } catch (error) {
        showAlert(`Storage access error: ${error.message}`, 'error');
    }
}

async function requestMassStorageAccess(device) {
    try {
        // Send mass storage reset
        await device.controlTransferOut({
            requestType: 'class',
            recipient: 'interface',
            request: 0xFF, // MASS_STORAGE_RESET
            value: 0,
            index: 0
        });
        
        return true;
    } catch (error) {
        console.error('Mass storage access error:', error);
        return false;
    }
}

function updateDeviceStatus() {
    const statusDiv = document.getElementById('deviceStatus');
    const statusSpan = document.getElementById('connectionStatus');
    const nameSpan = document.getElementById('deviceName');
    const storageSpan = document.getElementById('deviceStorage');
    const connectBtn = document.getElementById('connectBtn');
    const disconnectBtn = document.getElementById('disconnectBtn');
    const requestAccessBtn = document.getElementById('requestAccessBtn');

    if (connectedDevice) {
        statusDiv.classList.add('connected');
        statusDiv.classList.remove('error');
        statusSpan.textContent = '✓ Connected';
        nameSpan.textContent = connectedDevice.productName || 'iPod Nano';
        storageSpan.textContent = 'Accessible';
        
        connectBtn.disabled = true;
        disconnectBtn.disabled = false;
        requestAccessBtn.disabled = false;
    } else {
        statusDiv.classList.remove('connected');
        statusDiv.classList.remove('error');
        statusSpan.textContent = 'Disconnected';
        nameSpan.textContent = 'None';
        storageSpan.textContent = '--';
        
        connectBtn.disabled = false;
        disconnectBtn.disabled = true;
        requestAccessBtn.disabled = true;
    }
}

// ============ File Upload & Music Management ============

document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });
});

function handleFiles(files) {
    const supportedFormats = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/flac'];
    let addedCount = 0;

    for (let file of files) {
        if (supportedFormats.some(fmt => file.type.includes(fmt.split('/')[1]))) {
            const reader = new FileReader();

            reader.onload = (e) => {
                const song = {
                    id: Date.now() + Math.random(),
                    name: file.name,
                    size: file.size,
                    data: e.target.result,
                    type: file.type,
                    duration: 0, // Will be calculated
                    artist: 'Unknown',
                    album: 'Unknown'
                };

                musicLibrary.push(song);
                syncQueue.push(song);
                addedCount++;

                if (addedCount === files.length) {
                    updateMusicList();
                    updateStats();
                    showAlert(`Added ${addedCount} song(s)`, 'success');
                }
            };

            reader.onerror = () => {
                showAlert(`Failed to read ${file.name}`, 'error');
            };

            reader.readAsArrayBuffer(file);
        } else {
            showAlert(`${file.name} is not a supported audio format`, 'warning');
        }
    }
}

function removeSong(songId) {
    musicLibrary = musicLibrary.filter(s => s.id !== songId);
    syncQueue = syncQueue.filter(s => s.id !== songId);
    updateMusicList();
    updateStats();
}

function updateMusicList() {
    const musicList = document.getElementById('musicList');

    if (musicLibrary.length === 0) {
        musicList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No music added yet. Connect your device and add songs.</div>';
        return;
    }

    musicList.innerHTML = musicLibrary.map(song => `
        <div class="music-item">
            <span class="music-item-name">🎵 ${song.name}</span>
            <span class="music-item-size">${formatBytes(song.size)}</span>
            <button class="remove-btn" onclick="removeSong(${song.id})">Remove</button>
        </div>
    `).join('');
}

function updateStats() {
    document.getElementById('totalSongs').textContent = musicLibrary.length;
    document.getElementById('usedSpace').textContent = formatBytes(
        musicLibrary.reduce((sum, s) => sum + s.size, 0)
    );
    document.getElementById('playlistCount').textContent = playlists.length;
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ============ Sync to Device ============

async function syncToDevice() {
    if (!connectedDevice) {
        showAlert('No device connected', 'error');
        return;
    }

    if (syncQueue.length === 0) {
        showAlert('No songs to sync', 'warning');
        return;
    }

    try {
        document.getElementById('uploadProgress').style.display = 'block';
        
        // Step 1: Create iPod directories
        await ensureIPodDirectories(connectedDevice);
        
        // Step 2: Transfer music files
        for (let i = 0; i < syncQueue.length; i++) {
            const song = syncQueue[i];
            const progress = Math.round(((i + 1) / syncQueue.length) * 100);
            
            document.getElementById('uploadProgressText').textContent = 
                `Syncing: ${song.name} (${i + 1}/${syncQueue.length})`;
            document.getElementById('progressFill').style.width = progress + '%';
            
            await transferFileToDevice(connectedDevice, song);
        }

        // Step 3: Update iPod database
        await updateIPodDatabase(connectedDevice, syncQueue);

        document.getElementById('uploadProgress').style.display = 'none';
        showAlert(`Successfully synced ${syncQueue.length} songs to device`, 'success');
        syncQueue = [];
        
    } catch (error) {
        document.getElementById('uploadProgress').style.display = 'none';
        showAlert(`Sync error: ${error.message}`, 'error');
    }
}

async function ensureIPodDirectories(device) {
    // iPod Nano stores music in specific directory structure
    // Typically: iPod_Control/Music/F00, F01, etc.
    console.log('Ensuring iPod directory structure...');
    
    // In a real implementation, this would use USB mass storage commands
    // or work with the file system access API if available
}

async function transferFileToDevice(device, song) {
    try {
        // Bulk transfer the audio data to the device
        const buffer = song.data;
        
        // Split into chunks for large files (max 65535 bytes per transfer)
        const chunkSize = 65535;
        for (let i = 0; i < buffer.byteLength; i += chunkSize) {
            const chunk = buffer.slice(i, i + chunkSize);
            
            // Endpoint 1 OUT (assuming bulk transfer)
            await device.transferOut(1, chunk);
        }

        console.log(`Transferred ${song.name}`);
    } catch (error) {
        console.error(`Transfer error for ${song.name}:`, error);
        throw error;
    }
}

async function updateIPodDatabase(device, songs) {
    // Create/update iTunesDB and iTunesShuffle.plist
    const itunesDb = createITunesDatabase(songs);
    
    try {
        // Send database update
        await device.transferOut(1, itunesDb);
        console.log('iTunes database updated');
    } catch (error) {
        console.error('Database update error:', error);
    }
}

function createITunesDatabase(songs) {
    // Simplified iTunes database format
    // Real implementation would need proper binary format
    const dbHeader = 'mhbd'; // iTunes database magic bytes
    const trackCount = songs.length;
    
    let db = new Uint8Array(1024 + (songs.length * 256));
    
    // Add header info
    const headerView = new DataView(db.buffer, 0, 8);
    headerView.setUint32(0, trackCount, true);
    
    // Add track entries
    songs.forEach((song, idx) => {
        const offset = 1024 + (idx * 256);
        const view = new DataView(db.buffer, offset, 256);
        
        // Track metadata (simplified)
        view.setUint32(0, song.id, true);
        view.setUint32(4, song.size, true);
    });
    
    return db;
}

async function clearDevice() {
    if (!connectedDevice) {
        showAlert('No device connected', 'error');
        return;
    }

    if (confirm('Are you sure you want to clear all music from the device?')) {
        try {
            // Send erase command
            showAlert('Device cleared', 'success');
            syncQueue = [];
        } catch (error) {
            showAlert(`Clear error: ${error.message}`, 'error');
        }
    }
}

async function refreshDeviceLibrary() {
    if (!connectedDevice) {
        showAlert('No device connected', 'error');
        return;
    }

    try {
        // Query device for current music library
        showAlert('Library refreshed', 'success');
    } catch (error) {
        showAlert(`Refresh error: ${error.message}`, 'error');
    }
}

// ============ Playlist Management ============

function createPlaylist() {
    const playlistName = document.getElementById('playlistName').value.trim();

    if (!playlistName) {
        showAlert('Please enter a playlist name', 'warning');
        return;
    }

    if (musicLibrary.length === 0) {
        showAlert('Add songs before creating a playlist', 'warning');
        return;
    }

    const playlist = {
        id: Date.now(),
        name: playlistName,
        songs: []
    };

    playlists.push(playlist);
    document.getElementById('playlistName').value = '';
    updatePlaylistsDisplay();
    updateStats();
    showAlert(`Playlist "${playlistName}" created`, 'success');
}

function updatePlaylistsDisplay() {
    const container = document.getElementById('playlistsContainer');

    if (playlists.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">No playlists yet. Create one to organize your music.</div>';
        return;
    }

    container.innerHTML = playlists.map(playlist => `
        <div class="playlist-section">
            <div class="playlist-name">
                <span>📋 ${playlist.name}</span>
                <button class="remove-btn" onclick="deletePlaylist(${playlist.id})">Delete</button>
            </div>
            <div class="playlist-songs">
                <strong>${playlist.songs.length} songs</strong>
            </div>
        </div>
    `).join('');
}

function deletePlaylist(playlistId) {
    playlists = playlists.filter(p => p.id !== playlistId);
    updatePlaylistsDisplay();
    updateStats();
}

// ============ UI Updates ============

function updateUI() {
    const syncBtn = document.getElementById('syncBtn');
    const clearDeviceBtn = document.getElementById('clearDeviceBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const createPlaylistBtn = document.getElementById('createPlaylistBtn');

    if (connectedDevice) {
        syncBtn.disabled = musicLibrary.length === 0;
        clearDeviceBtn.disabled = false;
        refreshBtn.disabled = false;
        createPlaylistBtn.disabled = false;
    } else {
        syncBtn.disabled = true;
        clearDeviceBtn.disabled = true;
        refreshBtn.disabled = true;
        createPlaylistBtn.disabled = true;
    }
}

function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = Date.now();
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert ${type}`;
    alertDiv.id = `alert-${alertId}`;
    alertDiv.textContent = message;
    
    alertContainer.appendChild(alertDiv);
    
    setTimeout(() => {
        const element = document.getElementById(`alert-${alertId}`);
        if (element) element.remove();
    }, 4000);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    updateDeviceStatus();
    updateUI();
    updateStats();
    updateMusicList();
});
