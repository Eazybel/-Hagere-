import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js"
import { auth } from "./firebaseInit.js"
const newsFeed = document.getElementById("newsFeed")

function showFeedMessage(message, isError = false) {
    const state = document.createElement("p")
    state.className = `col-span-full py-12 text-center text-sm bg-antique-card border border-antique-border rounded-lg font-sans ${isError ? "text-rose-700" : "text-antique-muted"}`
    state.textContent = message
    newsFeed.replaceChildren(state)
}

function makeElement(tag, className, text) {
    const element = document.createElement(tag)
    if (className) element.className = className
    if (text !== undefined) element.textContent = text
    return element
}

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

function renderComment(comment) {
    const item = makeElement("li", "rounded border border-antique-border bg-antique-bg p-3")
    item.append(
        makeElement("p", "text-xs font-semibold", comment.userName || "Citizen"),
        makeElement("p", "mt-1 whitespace-pre-wrap break-words text-sm", comment.comment),
        makeElement("time", "mt-2 block text-xs text-antique-muted", new Date(comment.createdAt).toLocaleString())
    )
    return item
}

function renderNewsPost(post, user) {
    post.comments = Array.isArray(post.comments) ? post.comments : []
    const card = makeElement("article", "overflow-hidden rounded-lg border border-antique-border bg-antique-card")
    const image = document.createElement("img")
    image.className = "h-56 w-full bg-antique-bg object-cover"
    image.src = post.imageUrl
    image.alt = post.title
    image.loading = "lazy"
    image.referrerPolicy = "no-referrer"
    image.addEventListener("error", () => {
        image.removeAttribute("src")
        image.alt = "News image unavailable"
        image.className = "h-56 w-full bg-antique-bg object-contain text-antique-muted"
    }, { once: true })

    const body = makeElement("div", "p-5")
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
            policyLink.addEventListener("click", () => {
                localStorage.setItem("policyID", post.relatedPolicy._id)
            })
        } else {
            policyLink.href = "./feed.html"
        }
        body.append(policyLink)
    }

    const actions = makeElement("div", "mt-5 border-t border-antique-border pt-4")
    const likeButton = makeElement(
        "button",
        "rounded border border-antique-border px-3 py-2 text-sm font-sans hover:bg-antique-bg",
        `${post.liked ? "Unlike" : "Like"} · ${post.likesCount ?? 0}`
    )
    likeButton.type = "button"
    likeButton.addEventListener("click", async () => {
        likeButton.disabled = true
        try {
            const result = await authenticatedRequest(`/api/news/${encodeURIComponent(post._id)}/like`, "POST", {}, user)
            post.liked = result.liked
            post.likesCount = result.likesCount
            likeButton.textContent = `${post.liked ? "Unlike" : "Like"} · ${post.likesCount}`
        } catch (error) {
            console.error("News like failed:", error)
            window.alert(error.message)
        } finally {
            likeButton.disabled = false
        }
    })

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

    actions.append(likeButton, commentsHeading, commentsList, commentForm)
    body.append(actions)
    card.append(image, body)
    return card
}

async function loadNews(user) {
    showFeedMessage("Loading policy news…")
    try {
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
        newsFeed.replaceChildren(...posts.map(post => renderNewsPost(post, user)))
    } catch (error) {
        console.error("News feed request failed:", error)
        showFeedMessage("Unable to load policy news. Please try again later.", true)
    }
}

onAuthStateChanged(auth, user => {
    if (!user) {
        window.location.replace("./index.html")
        return
    }
    loadNews(user)
})

document.getElementById("signOutButton").addEventListener("click", async () => {
    try {
        await signOut(auth)
        window.location.replace("./index.html")
    } catch (error) {
        console.error("Sign out failed:", error)
    }
})
