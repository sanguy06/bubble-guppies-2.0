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
  const buddiesEl = document.getElementById('buddies') || document.getElementById('buddiese');

  // Load stats
  chrome.storage.local.get(['streak', 'buddies'], ({ streak, buddies }) => {
    document.getElementById('green-streak').textContent = streak || 0;
    if (buddiesEl) buddiesEl.textContent = buddies || 0;
});

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.buddies && buddiesEl) {
      buddiesEl.textContent = changes.buddies.newValue || 0;
    }
  });

chrome.storage.local.get('streak', ({ streak }) => {
    if ((streak || 0) >= 5) {
        const streak_count = document.getElementById('green-streak');
        const existing = streak_count.querySelector('.streak-fire');
        const size = 12 + Math.min(streak * 0.5, 20); // grows with streak but caps at 32px

        if (existing) {
            existing.style.fontSize = `${size}px`;
        } else {
            const streak_emoji = document.createElement('span');
            streak_emoji.className = 'streak-fire';
            streak_emoji.innerText = '🔥';
            streak_emoji.style.fontSize = `${size}px`;
            streak_count.appendChild(streak_emoji);
        }
    }
});

  // Toggle handler
  toggle.addEventListener('change', () => {
    const enabled = toggle.checked;
    toggleLabel.textContent = enabled ? 'On' : 'Off';
    chrome.runtime.sendMessage({ type: 'TOGGLE_ENABLED', enabled });
  });
});

