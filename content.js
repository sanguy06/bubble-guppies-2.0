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
    const badge = document.createElement('div');
    badge.innerHTML = `<strong>Score: ${score} / 5</strong>`
    product.appendChild(badge);
}

function filter(threshold, opacity) {
    products.forEach(product => {
        const score = getScore(product);

        if (score < threshold) {
            product.style.opacity = opacity;
            const btn = product.querySelector('button[name="submit.addToCart"], input[name="submit.addToCart"]');
            if (btn) {
                btn.style.opacity = 1 / opacity;
                btn.style.pointerEvents = 'auto';
            }
        } else {
            dispScore(product, score);
        }
        
    })
}

filter(2, 0.1);


