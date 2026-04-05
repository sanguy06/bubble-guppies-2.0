import { db } from "./firebase.js";
import { collection, query, where, getCountFromServer } from "firebase/firestore";

async function loadUserStats() {
  try {
    // Total installs
    const installSnap = await getCountFromServer(
      query(collection(db, "analyticsEvents"),
        where("event", "==", "install"))
    );

    // Active users in last 7 days
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const activeSnap = await getCountFromServer(
      query(collection(db, "analyticsEvents"),
        where("event", "==", "active_ping"),
        where("timestamp", ">", sevenDaysAgo))
    );

    const totalEl = document.getElementById("total-installs");
    const activeEl = document.getElementById("active-users");

    totalEl.textContent = installSnap.data().count.toLocaleString();
    activeEl.textContent = activeSnap.data().count.toLocaleString();

    // Remove loading style once loaded
    totalEl.classList.remove("loading");
    activeEl.classList.remove("loading");

  } catch (err) {
    console.error("Firestore error:", err);
    document.getElementById("total-installs").textContent = "—";
    document.getElementById("active-users").textContent = "—";
  }
}

loadUserStats();