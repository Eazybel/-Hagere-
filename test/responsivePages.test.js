const test = require("node:test")
const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")

const publicDirectory = path.join(__dirname, "..", "public")
const pages = [
    "index.html",
    "feed.html",
    "news.html",
    "policy.html",
    "dashboard.html",
    "admin.html",
    "adminAuth.html",
    "login.html",
    "analytics.html",
    "docs.html"
]

test("all public views provide the same usable mobile navigation", () => {
    for (const page of pages) {
        const html = fs.readFileSync(path.join(publicDirectory, page), "utf8")
        const menu = html.match(/<details class="site-mobile-navigation">([\s\S]*?)<\/details>/)

        assert.ok(menu, `${page} should include a mobile navigation menu`)
        assert.match(menu[1], /<summary\b[^>]*aria-label="Toggle site navigation"/)
        for (const [label, href] of [
            ["Home", "index.html"],
            ["Policies", "feed.html"],
            ["News", "news.html"],
            ["Dashboard", "dashboard.html"]
        ]) {
            assert.match(menu[1], new RegExp(`<a href="${href}">${label}<\\/a>`), `${page} should link to ${label}`)
        }
    }
})

test("shared responsive styles support narrow screens, form entry, and scrollable tables", () => {
    const styles = fs.readFileSync(path.join(publicDirectory, "header.css"), "utf8")
    assert.match(styles, /@media \(max-width: 767px\)/)
    assert.match(styles, /font-size: 16px !important/)
    assert.match(styles, /\.responsive-table-wrap\s*\{[^}]*overflow-x: auto/s)
    assert.match(styles, /max-height: calc\(100dvh - 1rem\)/)
})

test("admin publishing dialog has accessible labeling and a narrow-screen table indicator is present", () => {
    const admin = fs.readFileSync(path.join(publicDirectory, "admin.html"), "utf8")
    const docs = fs.readFileSync(path.join(publicDirectory, "docs.html"), "utf8")
    assert.match(admin, /role="dialog" aria-modal="true" aria-labelledby="publishModalTitle"/)
    assert.match(docs, /Scroll horizontally to view all columns\./)
    assert.match(docs, /aria-label="Scrollable API endpoint reference table" tabindex="0"/)
})
