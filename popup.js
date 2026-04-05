const slider = document.getElementById("eco-slider");
const sliderVal = document.getElementById("slider-value");

// Restore saved value from previous session
chrome.storage.local.get("minEcoScore", ({ minEcoScore }) => {
  if (minEcoScore !== undefined) {
    slider.value = minEcoScore;
    updateDisplay(minEcoScore);
    applyFilter(minEcoScore);
  }
});

slider.addEventListener("input", (e) => {
  const val = parseInt(e.target.value, 10);
  updateDisplay(val);

  // Save to storage so it persists when popup closes
  chrome.storage.local.set({ minEcoScore: val });

  applyFilter(val);
});

function updateDisplay(val) {
  sliderVal.textContent = val;

  // Change color dynamically based on value
  const color = val >= 4 ? "#2e7d32" : val >= 2 ? "#f9a825" : "#c62828";
  sliderVal.style.color = color;
}

function applyFilter(val) {
  // Tell content.js to re-filter the page
  chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
    if (!tab?.id) return;
    chrome.tabs.sendMessage(tab.id, { type: "FILTER_UPDATE", minScore: val });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('toggle');
  const toggleLabel = document.getElementById('toggle-label');
  const streakEl = document.getElementById('green-streak');
  const buddies = document.getElementById('buddies');

  // Load stats
  chrome.runtime.sendMessage({ type: 'GET_STATS' }, (data) => {
    if (!data) return;

    toggle.checked = data.enabled !== false;
    toggleLabel.textContent = toggle.checked ? 'On' : 'Off';

    buddies.textContent = data.buddies || 0;
    streakEl.textContent = data.streak || 0;
  });

  // Toggle handler
  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    toggleLabel.textContent = enabled ? 'On' : 'Off';
    chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED', enabled });
  });
});