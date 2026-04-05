const GREEN_ACTIONS = {
    SUSTAINABILE_PRODUCT_VIEWED: 1,
    SUSTAINABLE_DELIVERY_OPT_IN: 3,
    HIGH_ECO_SCORE_PURCHASE: 5,
    MODAL_OPENED: 0.5,
}

const BAD_ACTIONS = {
    FAST_DELIVERY_OPT_IN: true,
    LOW_ECO_SCORE_PURCHASE: true,
};

// detect add to cart on high/low eco score products
function watchDeliveryChoice() {
    const observer = new MutationObserver(() => {
        document.querySelectorAll('input[name="delivery-speed"').forEach(input => {
            input.addEventListener("change", () => {
                const label = input.closest("label")?.innerText.toLowerCase() || "";
                const isSustainable = label.includes("no-rush") || label.includes("free delivery") || label.includes("slower");
            })
        })
    })
}