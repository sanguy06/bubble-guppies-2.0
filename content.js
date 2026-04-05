chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "FILTER_UPDATE") {
        filter(msg.minScore, 0.1);
    }
});

const strongKeywords = [
    // certifications
    'certified organic',
    'fair trade',
    'rainforest alliance',
    'b corp',
    'carbon neutral',
    'climate pledge friendly',
    
    // materials
    'biodegradable',
    'compostable',
    'recycled material',
    'organic cotton',
    'bamboo',
    'hemp',
    
    // packaging
    'plastic free',
    'zero waste',
    'package free'
];

    const mediumKeywords = [
    'recycled',
    'organic',
    'sustainable',
    'renewable',
    'solar powered',
    'rechargeable',
    'reusable',
    'non toxic',
    'chemical free',
    'natural materials',
    'upcycled',
    'ethically sourced',
    'responsibly sourced'
];

    const weakKeywords = [
    'eco',
    'eco friendly',
    'green',
    'natural',
    'clean',
    'conscious',
    'responsible',
    'earth friendly',
    'environmentally friendly'
];

// Weighted scoring categories
const CATEGORIES = [
  {
    name: 'Carbon & Emissions',
    weight: 0.25,
    positive: ['carbon neutral', 'carbon offset', 'climate pledge', 'zero emissions', 'solar powered', 'wind powered', 'renewable energy', 'low carbon'],
    negative: ['petroleum', 'fossil fuel', 'air freight', 'same-day', 'expedited shipping']
  },
  {
    name: 'Water Use',
    weight: 0.15,
    positive: ['water saving', 'drought resistant', 'water efficient', 'rain fed', 'drip irrigation', 'waterless'],
    negative: ['water intensive', 'bleached', 'dyed', 'conventional cotton']
  },
  {
    name: 'Materials & Waste',
    weight: 0.25,
    positive: ['recycled', 'biodegradable', 'compostable', 'organic', 'bamboo', 'hemp', 'reclaimed', 'upcycled', 'plastic free', 'zero waste', 'fsc certified', 'natural materials'],
    negative: ['plastic', 'styrofoam', 'pvc', 'single-use', 'disposable', 'non-recyclable', 'synthetic']
  },
  {
    name: 'Labor & Supply Chain',
    weight: 0.20,
    positive: ['fair trade', 'ethically sourced', 'responsibly sourced', 'b corp', 'certified', 'handmade', 'locally made', 'small batch', 'artisan', 'cruelty free'],
    negative: ['fast fashion', 'mass produced']
  },
  {
    name: 'Product Longevity',
    weight: 0.15,
    positive: ['durable', 'lifetime warranty', 'repairable', 'reusable', 'long lasting', 'warranty', 'rechargeable', 'refillable', 'replaceable parts'],
    negative: ['single use', 'disposable', 'non-reusable']
  }
];


function getProductScore(text) {
    const lower = text.toLowerCase();
    const matchedPositive = [];
    const matchedNegative = [];

    const categoryScores = CATEGORIES.map(cat => {
        let score = 2.5; // neutral baseline

        const posHits = cat.positive.filter(kw => lower.includes(kw));
        const negHits = cat.negative.filter(kw => lower.includes(kw));

        posHits.forEach(kw => { if (!matchedPositive.includes(kw)) matchedPositive.push(kw); });
        negHits.forEach(kw => { if (!matchedNegative.includes(kw)) matchedNegative.push(kw); });

        score += Math.min(posHits.length * 0.6, 2.0);  // max +2.0 from positives
        score -= Math.min(negHits.length * 0.5, 1.5);  // max -1.5 from negatives
        score = Math.round(Math.max(1, Math.min(5, score)));

        return { ...cat, score };
    });

    const weighted = categoryScores.reduce((sum, c) => sum + c.score * c.weight, 0);
    const finalScore = Math.round(weighted);

    return {
        score: finalScore,
        categories: categoryScores,
        matchedPositive,
        matchedNegative
    };
}


function detectPage() {
    const url = window.location.href;

    // if it's a product page
    // all product pages include '/dp'
    if(url.includes('/dp') || url.includes('/gp/product/')){
        injectProductPage();
    }
}


// Product Page Injection
function injectProductPage() {

    console.log("inject product")
    const pageText = document.body.innerText;
    const scoreData = getProductScore(pageText);
    const score = scoreData.score;
    const title = document.getElementById('productTitle');
    // Inject Indicators near buy box
    const buy_box = document.getElementById('buyNow')
    let msg = ""
    if (buy_box) {
        msg = score >= 3 ? "🌿" : "😟";
        const badge = createBadge(scoreData, msg)
        buy_box.parentNode.insertBefore(badge, buy_box.nextSibling);
    }
       
    // Inject Score
    if (title) {
        console.log("TITLE")
        const scoreBadge = createScoreBadge(scoreData, msg)
        title.parentNode.insertBefore(scoreBadge, title.nextSibling)                   // goes into the title div
    }
   
}

// Create Badge Elements
function createBadge(scoreData, msg) {
    const badge = document.createElement("span")
    badge.className = 'ecobuddy-indicator'

    // Style it
    badge.style.display = "block";
    badge.style.textAlign = "center";
    badge.style.fontSize = "2rem";
    badge.style.marginTop = "6px";

    badge.textContent = msg;
    console.log(msg)

    badge.addEventListener('click', (e) => {
        console.log("clicked badge")
        e.preventDefault();
        e.stopPropagation();
        showPopup(scoreData.score);
    });

    return badge
}

// Create Badge for Scores
function createScoreBadge(scoreData, msg) {
    const scoreBadge = document.createElement("span")
    scoreBadge.id = 'ecobuddy-score-badge';
    //const desc = score >= 3 ? "🌿 High": "😟 Low" 
    scoreBadge.className = scoreData.score >= 3 ? 'ecobuddy-badge__icon_positive': 'ecobuddy-badge__icon_negative'
    scoreBadge.textContent = `${msg} ${scoreData.score}/5`;
    document.addEventListener('click', (e) => {
        if (e.target.id === 'ecobuddy-score-badge' || e.target.closest('#ecobuddy-score-badge')) {
            e.preventDefault();
            e.stopPropagation();
            console.log("clicked score badge");
            showScorePopup(scoreData);
        }
    }, true);  // ← 'true' means capture phase, fires BEFORE Amazon's handlers
    return scoreBadge

}

function getScore(item) {
    
    let score = 0;
    const title = item.textContent.toLowerCase();
    
    // check for each respective keyword : 
    strongKeywords.forEach(keyword => {
        if (title.includes(keyword)) {
            score += 3;
        }
    })

     mediumKeywords.forEach(keyword => {
        if (title.includes(keyword)) {
            score += 2;
        }
    })

     weakKeywords.forEach(keyword => {
        if (title.includes(keyword)) {
            score += 1;
        }
    })

    // check for the green certification badge
    const badge = item.querySelector(`[data-s-pc-sidesheet-open]`);
    if (badge) {
        score += 3;
        console.log("certification at " + item.textContent);
    }

    // cap score at 5
    if (score > 5) {
        score = 5;
    }
    return score;

}

function dispScore(product, score) {
    let badge = product.querySelector('.eco-score-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'eco-score-badge';
        product.appendChild(badge);
    }
    badge.innerHTML = `<strong>Score: ${score} / 5</strong>`;
}

function showPopup(score) {
    // Avoid duplicates
    const existing = document.getElementById('ecobuddy-popup');
    if (existing) existing.remove();
    const desc = score >= 3 ? "🌿 High": "😟 Low" 
    const popup = document.createElement('div');
    popup.id = 'ecobuddy-popup';
    popup.innerHTML = `
        <div id="ecobuddy-popup-inner">
            <button id="ecobuddy-close">✕</button>
            <h2>${desc} EcoBuddy Score</h2>
            <p>This product scores <strong>${score}/5 on sustainability. </strong></p>
            <p>${score >= 3 ? "Great choice for the planet!" : "Consider looking for alternatives with better environmental practices."}</p>
        </div>
    `;

    document.body.appendChild(popup);

    document.getElementById('ecobuddy-close').addEventListener('click', () => {
        popup.remove();
    });

    // Click outside to close
    popup.addEventListener('click', (e) => {
        if (e.target === popup) popup.remove();
    });
}

function showScorePopup(scoreData) {
    const existing = document.getElementById('ecobuddy-score-popup');
    if (existing) existing.remove();

    const score = scoreData.score;
    const desc = score >= 3 ? "🌿 High" : "😟 Low";

    const breakdownHtml = scoreData.categories.map(c => {
        const pct = (c.score / 5) * 100;
        const color = c.score >= 3.5 ? '#2e7d32' : c.score >= 2.5 ? '#856404' : '#a94442';
        return `
            <li style="list-style:none; margin: 6px 0;">
                <div style="display:flex; justify-content:space-between; font-size:13px; margin-bottom:2px;">
                    <span>${c.name}</span>
                    <span style="color:${color}; font-weight:600;">${c.score}/5</span>
                </div>
                <div style="background:#eee; border-radius:4px; height:6px; width:100%;">
                    <div style="width:${pct}%; background:${color}; height:6px; border-radius:4px;"></div>
                </div>
            </li>`;
    }).join('');

    let insightsHtml = '';
    if (scoreData.matchedPositive.length) {
        insightsHtml += `<p style="font-size:12px; color:#2d6a4f; margin-top:10px;">✓ Positive signals: ${scoreData.matchedPositive.join(', ')}</p>`;
    }
    if (scoreData.matchedNegative.length) {
        insightsHtml += `<p style="font-size:12px; color:#c62828;">✗ Concerns: ${scoreData.matchedNegative.join(', ')}</p>`;
    }
    if (!scoreData.matchedPositive.length && !scoreData.matchedNegative.length) {
        insightsHtml = '<p style="font-size:12px; color:#666; margin-top:10px;">No specific sustainability keywords found.</p>';
    }

    const popup = document.createElement('div');
    popup.id = 'ecobuddy-score-popup';
    popup.innerHTML = `
        <div id="ecobuddy-popup-inner">
            <button id="ecobuddy-score-close">✕</button>
            <h2 style="white-space:nowrap;">${desc} EcoBuddy Score</h2>
            <p>This product scores <strong>${score}/5 on sustainability.</strong></p>
            <ul style="padding:0; margin-top:12px;">${breakdownHtml}</ul>
            ${insightsHtml}
            <p style="font-size:11px; color:#999; margin-top:12px;">Score weighted across carbon, water, materials, labor & longevity.</p>
        </div>
    `;

    document.body.appendChild(popup);

    document.getElementById('ecobuddy-score-close').addEventListener('click', () => popup.remove());
    popup.addEventListener('click', (e) => { if (e.target === popup) popup.remove(); });   
}

function filter(threshold = 3, opacity = 0.1) {
    // products = each product basically

    const products = document.querySelectorAll('[data-asin][data-component-type="s-search-result"]');
    const minScore = Number.isFinite(Number(threshold)) ? Number(threshold) : 2;
    products.forEach(product => {
        const score = getScore(product);

        if (score < minScore) {
            product.style.opacity = String(opacity);
            const btn = product.querySelector('button[name="submit.addToCart"], input[name="submit.addToCart"]');
            if (btn) {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }
        } else {
            product.style.opacity = '1';
            dispScore(product, score);
        }
        
    })
}


chrome.storage.local.get("minEcoScore", ({ minEcoScore }) => {
    filter(minEcoScore ?? 2, 0.1);
});
detectPage();

// STREAK



function attachStreakListeners() {
    // 1) Handle Product Result Clicks (Existing logic)
    document.querySelectorAll('[data-asin][data-component-type="s-search-result"]').forEach(product => {
        if (product.dataset.streakListener) return;
        product.dataset.streakListener = true;
        
        product.addEventListener('click', () => {
            const score = getScore(product);
            chrome.storage.local.get('streak', ({ streak }) => {
                const currentStreak = streak || 0;
                chrome.storage.local.set({ streak: score >= 3 ? currentStreak + 1 : 0 });
            });
        });
    });
}

// 2) Handle ALL "Add to Cart" clicks using Global Delegation
document.addEventListener('click', (e) => {
    // Check if the clicked element (or its parent) is an Add to Cart button
    const addToCartBtn = e.target.closest('#add-to-cart-button, [name="submit.add-to-cart"], .a-button-stack input[type="submit"]');
    
    if (addToCartBtn) {
        console.log("Streak updated to:", currentStreak + 2);
        console.log("Add to cart detected - incrementing streak +2");
        chrome.storage.local.get('streak', ({ streak }) => {
            const currentStreak = streak || 0;
            chrome.storage.local.set({ streak: currentStreak + 2 });
        });
    }
}, true); // Use capture phase to ensure we catch it before Amazon handles navigation

const streakObserver = new MutationObserver(() => {
    attachStreakListeners();
});

streakObserver.observe(document.body, { childList: true, subtree: true });

attachStreakListeners(); // run once on initial load

// --- CORE LOGIC HANDLER ---

function updatePageSustainabilty() {
    chrome.storage.local.get("minEcoScore", ({ minEcoScore }) => {
        const threshold = minEcoScore ?? 2; // Default to 2 if not set
        
        // 1. Run the Filter
        filter(threshold, 0.1);
        
        // 2. Attach Streak Listeners to any new items
        attachStreakListeners();
    });
}

// Change your globalObserver setup to this:
const globalObserver = new MutationObserver((mutations) => {
    // Check if the mutation was actually a product list addition, 
    // not just our own badges being added.
    const addedNodes = mutations.some(m => Array.from(m.addedNodes).some(node => 
        node.nodeType === 1 && (node.querySelector('[data-asin]') || node.hasAttribute('data-asin'))
    ));

    if (addedNodes) {
        clearTimeout(window.ecoTimeout);
        window.ecoTimeout = setTimeout(updatePageSustainabilty, 500); 
    }
});

// --- INITIAL LOAD ---
// Run immediately when the script first injects
updatePageSustainabilty();
