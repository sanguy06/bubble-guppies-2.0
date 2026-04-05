chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "FILTER_UPDATE") {
        filter(msg.minScore, 0.1);
    }
});

// products = each product basically

const products = document.querySelectorAll('[data-asin][data-component-type="s-search-result"]');

function getScore(item) {
    
    let score = 0;
    const title = item.textContent.toLowerCase();

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

function filter(threshold = 2, opacity = 0.1) {
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


