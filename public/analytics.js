/**
 * @file analytics.js
 * @description Loads protected admin engagement metrics and renders totals, vote proportions, and top policies.
 * @module Client/AdminAnalytics
 * @requires Firebase App and Auth browser SDKs
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js"
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js"

const firebaseConfig = {
    apiKey: "AIzaSyBg9v5J4qdDYQhYCl79Q1U5Nm7hzrQ7yMw",
    authDomain: "hagere-admin.firebaseapp.com",
    projectId: "hagere-admin",
    storageBucket: "hagere-admin.firebasestorage.app",
    messagingSenderId: "907064312662",
    appId: "1:907064312662:web:e716e0df19627c4a5dccf7"
}

// Shared client state: authenticated admin context, loading/error regions, and one-time initial-load tracking.
const auth = getAuth(initializeApp(firebaseConfig))
const numberFormatter = new Intl.NumberFormat()
const refreshButton = document.getElementById("refreshAnalytics")
const retryButton = document.getElementById("retryAnalytics")
const loadingState = document.getElementById("analyticsLoading")
const errorState = document.getElementById("analyticsError")
const errorMessage = document.getElementById("analyticsErrorMessage")
const analyticsContent = document.getElementById("analyticsContent")
let hasLoaded = false

/** Formats a numeric metric into its designated text-only DOM node. */
function setNumber(elementId, value) {
    document.getElementById(elementId).textContent = numberFormatter.format(value)
}

/** Renders aggregate metrics and the top-policy ranking from the analytics API payload. */
function renderAnalytics(data) {
    const { overview } = data
    const voteTotal = overview.agreeVotes + overview.neutralVotes + overview.disagreeVotes

    setNumber("totalPolicies", overview.totalPolicies)
    setNumber("totalVotes", overview.totalVotes)
    setNumber("totalComments", overview.totalComments)
    setNumber("activeCitizens", overview.activeCitizens)

    for (const [stance, count] of Object.entries({
        agree: overview.agreeVotes,
        neutral: overview.neutralVotes,
        disagree: overview.disagreeVotes
    })) {
        const percentage = voteTotal === 0 ? 0 : Math.round((count / voteTotal) * 100)
        document.getElementById(`${stance}Label`).textContent =
            `${stance[0].toUpperCase()}${stance.slice(1)} (${percentage}%)`
        document.getElementById(`${stance}Votes`).textContent =
            `${numberFormatter.format(count)} votes`
        document.getElementById(`${stance}Bar`).style.width = `${percentage}%`
    }

    document.getElementById("analyticsSampleSize").textContent =
        `Sample Size: ${numberFormatter.format(voteTotal)} votes`
    document.getElementById("analyticsUpdatedAt").textContent =
        `Updated ${new Date(data.generatedAt).toLocaleString()}`

    const topPolicies = document.getElementById("topPolicies")
    topPolicies.replaceChildren()
    if (data.topPolicies.length === 0) {
        const emptyState = document.createElement("li")
        emptyState.className = "text-antique-muted"
        emptyState.textContent = "No policy participation data yet."
        topPolicies.append(emptyState)
        return
    }

    for (const policy of data.topPolicies) {
        const item = document.createElement("li")
        item.className = "flex items-center justify-between gap-3 p-2.5 bg-antique-bg border border-antique-border rounded"

        const title = document.createElement("span")
        title.className = "font-medium"
        title.textContent = policy.title

        const votes = document.createElement("span")
        votes.className = "font-bold text-antique-accent whitespace-nowrap"
        votes.textContent = `${numberFormatter.format(policy.totalVotes)} votes`

        item.append(title, votes)
        topPolicies.append(item)
    }
}

/**
 * Fetches admin-only analytics with Firebase ID-token authorization and explicit loading state.
 * @param {import("firebase/auth").User} user Authenticated administrator.
 * @returns {Promise<void>} Resolves when metrics render.
 * @throws {Error} Network, authorization, or API errors after showing the error state.
 */
async function loadAnalytics(user) {
    refreshButton.disabled = true
    retryButton.disabled = true
    errorState.classList.add("hidden")
    if (!hasLoaded) {
        loadingState.classList.remove("hidden")
        analyticsContent.classList.add("hidden")
        analyticsContent.setAttribute("aria-busy","true")
    }

    try {
        // ID token is verified by admin authorization middleware; secrets are never sent from the client.
        const token = await user.getIdToken()
        const response = await fetch("/admin/analytics", {
            headers: { Authorization: `Bearer ${token}` }
        })
        if (!response.ok) {
            if (response.status === 401) {
                window.location.replace("./adminAuth.html")
                return
            }
            if (response.status === 403) {
                throw new Error("This account is not authorized to view administrative analytics.")
            }
            throw new Error(`Analytics request failed (${response.status}). Please retry.`)
        }
        renderAnalytics(await response.json())
        hasLoaded = true
        loadingState.classList.add("hidden")
        analyticsContent.classList.remove("hidden")
        analyticsContent.setAttribute("aria-busy","false")
    } catch (error) {
        errorMessage.textContent = error.message || "Check your connection and try again."
        errorState.classList.remove("hidden")
        if (!hasLoaded) loadingState.classList.add("hidden")
        throw error
    } finally {
        refreshButton.disabled = false
        retryButton.disabled = false
    }
}

// Redirect unauthenticated visitors to the admin sign-in view before fetching protected metrics.
onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.replace("./adminAuth.html")
        return
    }

    loadAnalytics(user).catch(error => console.error(error))
}, error => {
    loadingState.classList.add("hidden")
    errorMessage.textContent = "We couldn't verify your session. Refresh the page or sign in again."
    errorState.classList.remove("hidden")
    console.error(error)
})

/** Runs a user-initiated retry/refresh when an admin session remains available. */
async function refreshAnalytics() {
    if (auth.currentUser) {
        try {
            await loadAnalytics(auth.currentUser)
        } catch (error) {
            console.error(error)
        }
    }
}

/** @listens click Refresh button repeats the authenticated analytics request. */
refreshButton.addEventListener("click", refreshAnalytics)
/** @listens click Retry button uses the same loading/error lifecycle as manual refresh. */
retryButton.addEventListener("click", refreshAnalytics)
