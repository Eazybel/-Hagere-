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

        assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1\.0">/, `${page} should use the device viewport`)
        assert.match(html, /header\.css/, `${page} should use the shared responsive styles`)
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
    assert.match(styles, /\.site-mobile-navigation\s*\{\s*display: none/s)
    assert.match(styles, /\.site-desktop-navigation\s*\{\s*display: none !important/s)
    assert.match(styles, /\.site-header-actions\s*\{[^}]*flex-wrap: wrap/s)
    assert.match(styles, /font-size: 16px !important/)
    assert.match(styles, /\.responsive-table-wrap\s*\{[^}]*overflow-x: auto/s)
    assert.match(styles, /max-height: calc\(100dvh - 1rem\)/)
    assert.match(styles, /\.policy-chat-controls\s*\{[^}]*flex-direction: column/s)
})

test("shared design tokens provide antique burgundy accents and responsive three-column card grids", () => {
    const styles = fs.readFileSync(path.join(publicDirectory, "header.css"), "utf8")
    assert.match(styles, /--hagere-parchment:\s*#f6f1e7/)
    assert.match(styles, /--hagere-border:\s*#ded4c2/)
    assert.match(styles, /--hagere-bronze:\s*#7b2d3b/)
    assert.match(styles, /box-shadow:\s*0 0 0 4px var\(--hagere-focus\)/)
    assert.match(styles, /transition:\s*color 200ms ease, background-color 200ms ease/)

    for (const page of pages) {
        const html = fs.readFileSync(path.join(publicDirectory, page), "utf8")
        assert.match(html, /accent: '#7B2D3B'/, `${page} should use the antique burgundy accent`)
        assert.match(html, /bg: '#F6F1E7'/, `${page} should use the warm parchment background`)
    }

    for (const page of ["index.html", "feed.html", "news.html", "dashboard.html"]) {
        const html = fs.readFileSync(path.join(publicDirectory, page), "utf8")
        assert.match(html, /grid-cols-1 md:grid-cols-2 lg:grid-cols-3/)
    }
})

test("admin publishing dialog has accessible labeling and a narrow-screen table indicator is present", () => {
    const admin = fs.readFileSync(path.join(publicDirectory, "admin.html"), "utf8")
    const docs = fs.readFileSync(path.join(publicDirectory, "docs.html"), "utf8")
    const policy = fs.readFileSync(path.join(publicDirectory, "policy.html"), "utf8")
    const policyClient = fs.readFileSync(path.join(publicDirectory, "policy.js"), "utf8")
    assert.match(admin, /role="dialog" aria-modal="true" aria-labelledby="publishModalTitle"/)
    assert.match(docs, /Scroll horizontally to view all columns\./)
    assert.match(docs, /aria-label="Scrollable API endpoint reference table" aria-describedby="apiTableScrollHint" tabindex="0"/)
    assert.match(docs, /aria-label="Scrollable project directory example" tabindex="0"/)
    assert.match(policy, /class="policy-chat-controls flex items-center justify-between gap-4"/)
    assert.match(policyClient, /flex flex-wrap items-center gap-x-4 gap-y-2 text-sm/)
    assert.match(policyClient, /max-w-full flex-wrap/)
    assert.match(admin, /<div id="adminPolicyList" class="mt-4 space-y-3"/)
})
