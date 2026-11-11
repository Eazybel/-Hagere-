/**
 * @file news.js
 * @description Loads the public news feed and renders image-attributed posts, likes, and comments based on optional Firebase auth.
 * @module Client/News
 * @requires Firebase Auth browser SDK and local firebaseInit.js
 */
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js"
import { auth } from "./firebaseInit.js"
/** Root element into which feed loading, error, and post states are rendered. */
const newsFeed = document.getElementById("newsFeed")

/** Replaces feed content with a readable loading, empty, or error state. */
function showFeedMessage(message, isError = false) {
    const state = document.createElement("p")
    state.className = `col-span-full py-12 text-center text-sm bg-antique-card border border-antique-border rounded-lg font-sans ${isError ? "text-rose-700" : "text-antique-muted"}`
    state.textContent = message
    newsFeed.replaceChildren(state)
}

/** Creates an element using textContent for untrusted dynamic text. */
function makeElement(tag, className, text) {
    const element = document.createElement(tag)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
}

/**
 * Sends an authenticated news mutation with the Firebase ID token and JSON response validation.
 * @param {string} url API endpoint.
 * @param {string} method HTTP method.
 * @param {object} body JSON mutation payload.
 * @param {import("firebase/auth").User} user Authenticated Firebase user.
 * @returns {Promise<object>} Parsed successful response.
 * @throws {Error} When authentication, network, or API response fails.
 */
async function authenticatedRequest(url, method, body, user) {
    const token = await user.getIdToken()
    const response = await fetch(url, {
        method,
        headers: {
            "Authorization": `Bearer ${token}`,
            ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.success === false) {
        throw new Error(result.error || `News request failed (${response.status})`)
    }
    return result
}

/** Builds a safe text-based comment list item. */
function renderComment(comment) {
    const item = makeElement("li", "rounded border border-antique-border bg-antique-bg p-3")
    item.append(
        makeElement("p", "text-xs font-semibold", comment.userName || "Citizen"),
        makeElement("p", "mt-1 whitespace-pre-wrap break-words text-sm", comment.comment),
        makeElement("time", "mt-2 block text-xs text-antique-muted", new Date(comment.createdAt).toLocaleString())
    )
    return item
}

/**
 * Renders one post, showing engagement controls only to authenticated visitors.
 * @param {object} post Public news API record.
 * @param {?import("firebase/auth").User} user Optional signed-in citizen.
 * @param {number} index Position used to prioritize the first visible images.
 * @returns {HTMLElement} News article card.
 */
function renderNewsPost(post, user, index) {
    post.comments = Array.isArray(post.comments) ? post.comments : []
    const card = makeElement("article", "overflow-hidden rounded-xl border border-antique-border bg-antique-card shadow-sm")
    const image = document.createElement("img")
    image.className = "h-56 w-full bg-antique-bg object-cover"
    image.src = post.imageUrl
    image.alt = post.title
    image.loading = index < 2 ? "eager" : "lazy"
    image.decoding = "async"
    image.fetchPriority = index < 2 ? "high" : "low"
    image.width = 640
    image.height = 360
    image.sizes = "(min-width: 768px) 50vw, 100vw"
    image.referrerPolicy = "no-referrer"
    /** Replaces a broken remote asset with a stable accessible fallback. */
    image.addEventListener("error", () => {
        image.removeAttribute("src")
        image.alt = "News image unavailable"
        image.className = "h-56 w-full bg-antique-bg object-contain text-antique-muted"
    }, { once: true })
    if (post.imageSource && post.imageCredit) {
        const attribution = makeElement("a", "block px-6 pt-3 text-right text-xs text-antique-muted hover:text-antique-accent")
        attribution.href = post.imageSource
        attribution.target = "_blank"
        attribution.rel = "noopener noreferrer"
        attribution.textContent = `Image: ${post.imageCredit}`
        card.append(image, attribution)
    } else {
        card.append(image)
    }

    const body = makeElement("div", "p-6")
    body.append(
        makeElement("p", "text-xs text-antique-muted", `${post.author || "Government Communication Office"} · ${new Date(post.createdAt).toLocaleString()}`),
        makeElement("h2", "mt-2 text-xl font-semibold", post.title),
        makeElement("p", "mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-antique-muted", post.content)
    )
    if (post.relatedPolicy) {
        const policyTitle = typeof post.relatedPolicy === "object" ? post.relatedPolicy.title : "View related policy"
        const policyLink = makeElement("a", "mt-3 inline-block text-sm font-medium text-antique-accent hover:underline", `Related policy: ${policyTitle}`)
        if (typeof post.relatedPolicy === "object" && post.relatedPolicy._id) {
            policyLink.href = "./policy.html"
            /** Persists the related policy ID for the subsequent detail-page navigation. */
            policyLink.addEventListener("click", () => {
                localStorage.setItem("policyID", post.relatedPolicy._id)
            })
        } else {
            policyLink.href = "./feed.html"
        }
        body.append(policyLink)
    }

    const actions = makeElement("div", "mt-5 border-t border-antique-border pt-4")
    const commentsHeading = makeElement("h3", "mb-3 text-sm font-semibold", `Comments (${post.comments?.length || 0})`)
    const commentsList = makeElement("ul", "space-y-2")
    for (const comment of post.comments || []) commentsList.append(renderComment(comment))
    if (!post.comments?.length) {
        commentsList.append(makeElement("li", "text-sm text-antique-muted", "No comments yet."))
    }

    const commentForm = document.createElement("form")
    commentForm.className = "mt-4 flex flex-col gap-2 sm:flex-row"
    const commentInput = document.createElement("input")
    commentInput.name = "comment"
    commentInput.type = "text"
    commentInput.maxLength = 2000
    commentInput.required = true
    commentInput.placeholder = "Write a comment…"
    commentInput.className = "min-w-0 flex-1 rounded border border-antique-border bg-antique-bg px-3 py-2 text-sm"
    const commentButton = makeElement("button", "rounded bg-antique-accent px-4 py-2 text-sm font-medium text-white hover:bg-antique-accentHover disabled:opacity-60", "Comment")
    commentButton.type = "submit"
    commentForm.append(commentInput, commentButton)
    // Comment submission obtains a Firebase ID token, disables the button, and appends the returned comment in place.
    commentForm.addEventListener("submit", async event => {
        event.preventDefault()
        commentButton.disabled = true
        try {
            const result = await authenticatedRequest(
                `/api/news/${encodeURIComponent(post._id)}/comment`,
                "POST",
                { comment: commentInput.value },
                user
            )
            const emptyComment = commentsList.querySelector("li")
            if (post.comments.length === 0 && emptyComment?.textContent === "No comments yet.") emptyComment.remove()
            post.comments.push(result.comment)
            commentsList.append(renderComment(result.comment))
            commentsHeading.textContent = `Comments (${post.comments.length})`
            commentForm.reset()
        } catch (error) {
            console.error("News comment failed:", error)
            window.alert(error.message)
        } finally {
            commentButton.disabled = false
        }
    })

    if (user) {
        const likeButton = makeElement(
            "button",
            "rounded border border-antique-border px-3 py-2 text-sm font-sans hover:bg-antique-bg disabled:opacity-60",
            `${post.liked ? "Unlike" : "Like"} · ${post.likesCount ?? 0}`
        )
        likeButton.type = "button"
        // Like toggles update their own label/count after the authenticated API confirms the change.
        likeButton.addEventListener("click", async () => {
            likeButton.disabled = true
            likeButton.textContent = "Updating…"
            try {
                const result = await authenticatedRequest(`/api/news/${encodeURIComponent(post._id)}/like`, "POST", {}, user)
                post.liked = result.liked
                post.likesCount = result.likesCount
                likeButton.textContent = `${post.liked ? "Unlike" : "Like"} · ${post.likesCount}`
            } catch (error) {
                console.error("News like failed:", error)
                window.alert(error.message)
                likeButton.textContent = `${post.liked ? "Unlike" : "Like"} · ${post.likesCount ?? 0}`
            } finally {
                likeButton.disabled = false
            }
        })
        actions.append(likeButton)
    }

    // Keep reading public while gating only interactive controls on authentication.
    actions.append(commentsHeading, commentsList)
    if (user) {
        actions.append(commentForm)
    } else {
        const signInPrompt = makeElement(
            "p",
            "mt-4 rounded border border-antique-border bg-antique-bg px-3 py-2 text-sm text-antique-muted",
            "Log in to like or comment on this news."
        )
        const signInLink = makeElement("a", "ml-1 font-medium text-antique-accent hover:underline", "Sign in")
        signInLink.href = "./login.html"
        signInPrompt.append(signInLink)
        actions.append(signInPrompt)
    }
    body.append(actions)
    card.append(body)
    return card
}

/** Fetches the public feed, optionally attaching auth for per-user like state. */
async function loadNews(user) {
    showFeedMessage("Loading policy news…")
    try {
        // The feed remains public; a Firebase token is optional and only personalizes engagement state.
        const headers = user ? { "Authorization": `Bearer ${await user.getIdToken()}` } : {}
        const response = await fetch("/api/news", { headers, cache: "no-store" })
        const posts = await response.json()
        if (!response.ok || !Array.isArray(posts)) {
            throw new Error(posts.error || `News feed request failed (${response.status})`)
        }
        if (!posts.length) {
            showFeedMessage("No policy news published yet.")
            return
        }
        newsFeed.replaceChildren(...posts.map((post, index) => renderNewsPost(post, user, index)))
    } catch (error) {
        console.error("News feed request failed:", error)
        showFeedMessage("Unable to load policy news. Please try again later.", true)
    }
}

// Guest visibility is preserved: auth only controls interactive actions and account links.
/** Synchronizes sign-in controls and reloads the feed for guest or authenticated visibility. */
onAuthStateChanged(auth, user => {
    const signInLink = document.getElementById("newsSignIn")
    const accountControls = document.getElementById("newsAccountControls")
    signInLink.classList.toggle("hidden", Boolean(user))
    accountControls.classList.toggle("hidden", !user)
    accountControls.classList.toggle("flex", Boolean(user))
    loadNews(user)
})

/** Signs out the current Firebase user and returns to the public landing page. */
document.getElementById("signOutButton").addEventListener("click", async () => {
    try {
        await signOut(auth)
        window.location.replace("./index.html")
    } catch (error) {
        console.error("Sign out failed:", error)
    }
})
