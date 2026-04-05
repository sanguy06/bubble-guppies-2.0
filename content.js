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
    { name: 'Carbon & Emissions', weight: 0.25 },
    { name: 'Water Use', weight: 0.15 },
    { name: 'Materials & Waste', weight: 0.25 },
    { name: 'Labor & Supply Chain', weight: 0.20 },
    { name: 'Product Longevity', weight: 0.15 }
];


function detectPage() {
    const url = window.location.href;


    // if it's a product page
    // all product pages include '/dp'
    if(url.includes('/dp')){
        injectProductPage();
    }
}


// Product Page Injection
function injectProductPage() {

    console.log("inject product")
    const score = getProductScore()
    const title = document.getElementById('productTitle');
    // Inject Indicators near buy box
    const buy_box = document.getElementById('buyNow')
    let msg = ""
    if (buy_box) {
        msg = score >= 3 ? "🌿" : "😟";
        const badge = createBadge(msg)
        buy_box.parentNode.insertBefore(badge, buy_box.nextSibling);
        
    }
       
    // Inject Score
    if (title) {
        console.log("TITLE")
        const scoreBadge = createScoreBadge(score, msg)
        title.appendChild(scoreBadge)                   // goes into the title div
    }
   
}

// Create Badge Elements
function createBadge(msg) {
    const badge = document.createElement("span")
    badge.className = 'ecocart-indicator'

    // Style it
    badge.style.display = "block";
    badge.style.textAlign = "center";
    badge.style.fontSize = "2rem";
    badge.style.marginTop = "6px";

    badge.textContent = msg;
    console.log(msg)

    badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    return badge
}

// Create Badge for Scores
function createScoreBadge(score, msg) {
    const scoreBadge = document.createElement("span")
    scoreBadge.className = 'ecocart-badge__icon'
    scoreBadge.textContent = `${msg} ${score}/5`;
    scoreBadge.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
    });
    return scoreBadge

}

function getProductScore() {
    console.log("Product Score")
    const pageText = document.body.innerText;
    let score = 0
    strongKeywords.forEach(keyword => {
        if (pageText.includes(keyword)) {
            console.log("Strong: ", keyword)
            score += 3;
        }
        })

     mediumKeywords.forEach(keyword => {
        if (pageText.includes(keyword)) {
            console.log("Medium: ", keyword)
            score += 2;
        }
    })

     weakKeywords.forEach(keyword => {
        if (pageText.includes(keyword)) {
            console.log("Weak: ", keyword)
            score += 1;
        }
    })
    console.log("Score: ", score)
    return score
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

document.querySelectorAll('[data-asin][data-component-type="s-search-result"]').forEach(product => {
    product.addEventListener('click', () => {
        const score = getScore(product);
        if (score >= 3) {
            chrome.storage.local.get('streak', ({ streak }) => {
                chrome.storage.local.set({ streak: (streak || 0) + 1 });
            });
        } else {
            chrome.storage.local.set({ streak: 0 }); 
        }
    });
});
