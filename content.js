
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

        document.getElementById("greenradar-count").textContent = orders.length;
        document.getElementById("greenradar-savings").textContent = savings;
        document.getElementById("greenradar-wait").textContent = wait;
        document.getElementById("greenradar-trend").textContent = trendMsgs[Math.floor(Math.random() * trendMsgs.length)];
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
