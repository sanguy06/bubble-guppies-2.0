(function () {
    if(document.getElementById("greenradar-widget")) return;

    //the data and diagram itself
    const FIREBASE = "https://amaradar-default-rtdb.firebaseio.com";
    const CLUSTER_RAD = 2; //in miles
    const ORDER_TIMELIVE = 24 * 60 * 60 * 1000; //time is in milliseconds
    const POLL_INTERVAL = 30000;  //will refresh every 30 seconds

    let orders = [];
    let joined = false;
    let scanner = 0; //starting point
    let tick = 0;
    let userLoc = null; //the users location
    let userOrder = null;
    
    //The distance between the coordinates in miles
    function haversine(a, b) { 
        //haversine function is preferred due to how it calculates
        //the distance between two coordinates  
        const R = 3958.8;
        const dLat = (b.lat - a.lat) * Math.PI / 180; //latitude
        const dLon = (b.lon - a.lon) * Math.PI /180; //longitude
        const h = Math.sin(dLat / 2)**2 +
            Math.cos(a.lat * Math.PI / 180) * 
            Math.cos(b.lat * Math.PI / 180) * 
            Math.sin(dLon / 2)**2;
            return R * 2 * Math.asin(Math.sqrt(h));

    }

    //converting the latitude/longitude to polar to show on the radar
    function polar(userLo, orderLo) {
        const dist = haversine(userLo, orderLo);
        const dLat = orderLo.lat - userLo.lat;
        const dLon = orderLo.lon - userLo.lon;
        const angle = Math.atan2(dLon, dLat) * (180 / Math.PI);
        return {
            distance: dist,
            angle: (angle + 360) % 360, 
            age: 0};
    }

    //will simulate data if geolocation firebase does fail
    function genOrder() {
        return {
            id: Math.random().toString(36).slice(2),
            distance: 0.2 + Math.random() * 1.8,
            angle: Math.random() * 360,
            age: 0
        };
    }

    function clusterOrders(list) {
        return list.filter(o => o.distance < 1.5);
    }

    function calcSavingsClust(clusterSize) {
        return Math.min(72, clusterSize * 7);
    }

    function estWaitTime() {
        const base = 10 - Math.min(9, orders.length);
        return Math.max(1, base);
    }

    //Firebase will get the orders that are nearby
    async function fetchOrders() {
    if (!userLoc) return;
    try {
        const res  = await fetch(`${FIREBASE}/orders.json`);
        const data = await res.json();
        if (!data) return; // keep simulated dots

        const now = Date.now();
        const realOrders = Object.entries(data)
            .map(([key, o]) => ({ key, ...o }))
            .filter(o => o.expiresAt > now && o.key !== userOrder)
            .filter(o => haversine(userLoc, o) <= CLUSTER_RAD)
            .map(o => polar(userLoc, o));

        if (realOrders.length > 0) orders = realOrders; // only swap if real data exists
        updateStats();
    } catch (e) {
        console.warn("Firebase fail", e);
    }
}

    //If user opt-in to green then Firebase updates
    async function writeFirebase() {
        if (!userLoc) return;
        try {
            const res = await fetch(`${FIREBASE}/orders.json`, {
                method: "POST",
                headers: {"Content-Type" : "application/json"},
                body: JSON.stringify({
                    lat: Math.round(userLoc.lat * 100) / 100,
                    lon: Math.round(userLoc.lon * 100) / 100,
                    joinedAt: Date.now(),
                    expiresAt: Date.now() + ORDER_TIMELIVE
                })
            });
            const data = await res.json();
            userOrder = data.name;

            //Increments the global total user count
            const countRes = await fetch(`${FIREBASE}/stats/totalUsers.json`);
            const current  = await countRes.json();
            await fetch(`${FIREBASE}/stats/totalUsers.json`, {
                method: "PUT",
                headers: {"Content-Type": "application/json"},
                body:JSON.stringify((current || 0) + 1)
            });
        } 
        catch (e) {
            console.warn("Firebasse fail", e);
        }
    }

    //Users order is deleted when they leave site
    window.addEventListener("beforeunload", () => {
        if (userOrder) {
            navigator.sendBeacon(`${FIREBASE}/orders/${userOrder}.json`, JSON.stringify(null));
        }
    });


    if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            userLoc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
            // Replace simulated dots with real Firebase data
            //orders = [];
            setTimeout(() => {
                fetchOrders();
                setInterval(fetchOrders, POLL_INTERVAL);    
            }, 30000);
        },
        () => {
            // Geo denied — keep simulation running and growing
            setInterval(() => {
                if (orders.length < 18) {
                    orders.push(genOrder());
                    orders.push(genOrder());
                }
                updateStats();
            }, 8000);
        },
        { timeout: 8000 }
    );
}

    //the structure of the actual picture
    const widget = document.createElement("div");
    widget.id = "greenradar-widget";
    widget.innerHTML = `
        <div id="greenradar-header">
            <span class="greenradar-dot-live"></span>
            <span>Eco Radar</span>
            <button id="greenradar-toggle" title="Minimize">−</button>
        </div>

        <div id="greenradar-body">
            <div id="greenradar-wrap">
                <canvas id="greenradar-canvas" width="200" height="200"></canvas>
                <div id="greenradar-you">you</div>
            </div>

            <div id="greenradar-stats">
                <p class="greenradar-stat"><span id="greenradar-count">5</span> nearby buddies going green</p>
                <p class="greenradar-stat" id="greenradar-trend">+2 in last 5 minutes</p>
            </div>

            <div id="greenradar-waitout">
                <div id="greenradar-waitoutT">‼️ Wait <span id="greenradar-wait">6</span> hrs → join batch</div>
                <div id="greenradar-waitoutS">Save ~<span id="greenradar-savings">38</span>% carbon delivery emissions</div>
            </div>

            <button id="greenradar-button">Join Sustainable Delivery</button>

            <div id="greenradar-joined" style="display:none">
                <span class="greenradar-check">🎉</span> You joined a sustainable batch!<br>
                <small id="greenradar-impact"></small>
            </div>
        </div>
    `;
    document.body.appendChild(widget);

    //the Radar picture
    const canvas = document.getElementById("greenradar-canvas");
    const ctx = canvas.getContext("2d");
    const CX = 100, CY = 100, MAX_R = 88;

    function polarXY(distance, angleDg) {
        const r = (distance / 2) * MAX_R;
        const rad = (angleDg - 90) * Math.PI / 180;
        return {
            x: CX + r * Math.cos(rad),
            y: CY + r * Math.sin(rad)
        };
    }

    function imgRadar() {
        ctx.clearRect(0, 0, 200, 200);

        //outer circle border
        ctx.beginPath();
        ctx.arc(CX, CY, MAX_R, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(0, 99, 216, 0.6)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        //cluster light up
        const clustered = clusterOrders(orders);
        if (clustered.length >= 3) {
            const avgA = clustered.reduce((s, o) => s + o.angle, 0) / clustered.length;
            const avgD = clustered.reduce((s, o) => s + o.distance, 0) /clustered.length;
            const cp = polarXY(avgD, avgA);
            const pulse = 0.6 + 0.4 * Math.sin(tick * 0.08);
            ctx.beginPath();
            ctx.arc(cp.x, cp.y, 14 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 99, 216,${0.15 * pulse})`;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(cp.x, cp.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 99, 216, 0.9)`
            ctx.fill();
        }

        //for the dots resembling the orders
        orders.forEach(o => {
            const p = polarXY(o.distance, o.angle);
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = "#00c3ff"
            ctx.fill();
        });

        //the dot that represents us
        ctx.beginPath();
        ctx.arc(CX, CY, 5 , 0, Math.PI * 2);
        ctx.fillStyle = "#ffffff";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(CX, CY, 8, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    //Updates on stats
    const trendMsgs = [
        "+1 in last 3 min", "+2 in last 5 min", "+3 in last 8 min",
    "+1 just now", "+2 in last 2 min"
    ];

    function updateStats() {
        const cluster = clusterOrders(orders);
        const savings = calcSavingsClust(cluster.length);
        const wait = estWaitTime();
        const buddyCount = orders.length;

        document.getElementById("greenradar-count").textContent = buddyCount;
        document.getElementById("greenradar-savings").textContent = savings;
        document.getElementById("greenradar-wait").textContent = wait;
        document.getElementById("greenradar-trend").textContent = trendMsgs[Math.floor(Math.random() * trendMsgs.length)];
        chrome.storage.local.set({ buddies: buddyCount });
    }

    //the animated part
    function loop() {
        ++tick;
        imgRadar();
        requestAnimationFrame(loop);
    }
    //seed simulation
    for (let i = 0; i < 5; i++) orders.push(genOrder());
    updateStats();

    loop();
    updateStats();

    //Refreshes stats every 8s
    setInterval(updateStats, 8000); //in milliseconds

    //the button for the user to join
    document.getElementById("greenradar-button").onclick = async function () {
        if (joined) return;
        joined = true;

        //writes to firebase
        await writeFirebase();
        if (userLoc) await fetchOrders();

        const cluster = clusterOrders(orders);
        const savings = calcSavingsClust(cluster.length);

        this.style.display = "none";

        document.getElementById("greenradar-waitout").style.display = "none";
        document.getElementById("greenradar-joined").style.display = "block";
        document.getElementById("greenradar-impact").textContent = `Cluster of ${orders.length} → ~${savings}% fewer emissions`;

        orders.push({ distance: 0, angle: 0, age: 0, isUser: true });
    };

    //to be able to minimize toggle
    let collapsed = false;
    document.getElementById("greenradar-toggle").onclick = function () {
        collapsed = !collapsed;
        document.getElementById("greenradar-body").style.display = collapsed ? "none" : "block";
        this.textContent = collapsed ? "+" : "-";
    };

})();

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

// fixed positioning with score element injections
function dispScore(product, score) {
    let badge = product.querySelector('.eco-score-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'eco-score-badge';
        badge.style.cssText = `
            font-size: 12px;
            color: ${score >= 3 ? '#2e7d32' : '#a94442'};
            background: ${score >= 3 ? '#f0f9f2' : '#fdf0f0'};
            border: 1px solid ${score >= 3 ? '#c8e6c9' : '#f5c6cb'};
            border-radius: 6px;
            padding: 2px 8px;
            margin: 4px 0;
            display: inline-block;
        `;

        badge.innerHTML = `<strong>Score: ${score} / 5</strong>`;
        
        const titleElement = product.querySelector('[data-cy="title-recipe"]');
        if (titleElement) {
            titleElement.parentNode.insertBefore(badge, titleElement.nextSibling);
        }
        else {
            const cardInner = product.querySelector('.s-card-container') || 
                          product.querySelector('.sg-col-inner') ||
                          product;
        cardInner.prepend(badge);

        }
    }
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

// Run Detect Page - Product Page Ftr
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

