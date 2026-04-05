import { db } from "./firebase.js";
import { collection, doc, getDoc, query, where, getDocs } from "firebase/firestore";

// log install event
chrome.runtime.onInstalled.addListener(async ({ reason }) => {
    if (reason != "install") return;

    const { userId } = await chrome.storage.local.get("userId");
    if (userId) return;

    const newId = crypto.randomUUID();
    await chrome.storage.local.set({ userId: newId });

    await addDoc(collection(db, "analyticsEvents"), {
        event: "install",
        userId: newId,
        version: chrome.runtime.getManifest().version,
        timestamp: Date.now()
    });
});

// log active ping once per day when user visits Amazon
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!tab.url?.includes("amazon.com") || changeInfo.status !== "complete")
        return;

    const { lastPing, userId } = await chrome.storage.local.get(["lastPing", "userId"]);
    if (!userId) return;

    const oneDayMs = 24 * 60 * 60 * 1000;
    if (lastPing && Date.now() - lastPing < oneDayMs) return;

    await chrome.storage.local.set({ lastPing: Date.now() });

    await addDoc(collection(db, "analyticsEvents"), {
        event: "active_ping",
        userId,
        timestamp: Date.now()
    });
});