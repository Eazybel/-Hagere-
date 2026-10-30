const test = require("node:test")
const assert = require("node:assert/strict")
const mongoose = require("mongoose")
const { createNewsController } = require("../controllers/newsController")
const News = require("../models/News")

const newsId = new mongoose.Types.ObjectId()
const userId = new mongoose.Types.ObjectId()
const policyId = new mongoose.Types.ObjectId()
const policyImageUrl = "https://res.cloudinary.com/hagere/image/upload/v1/news.jpg"

function makeResponse() {
    return {
        statusCode: null,
        body: null,
        status(statusCode) {
            this.statusCode = statusCode
            return this
        },
        json(body) {
            this.body = body
            return this
        }
    }
}

function makeUserModel(user = { _id: userId, name: "Test Citizen" }) {
    return {
        findOne(filter) {
            assert.deepEqual(filter, { email: "citizen@example.com" })
            return Promise.resolve(user)
        }
    }
}

test("News schema requires title, content, and a valid image URL", async () => {
    const invalid = new News({ title: "News", content: "Details", imageUrl: "javascript:alert(1)" })
    await assert.rejects(invalid.validate(), error => {
        assert.ok(error.errors.imageUrl)
        return true
    })

    const valid = new News({ title: "News", content: "Details", imageUrl: policyImageUrl })
    assert.equal(valid.author, "Government Communication Office")
    assert.ok(valid.createdAt instanceof Date)
    assert.equal(News.schema.path("relatedPolicy").options.ref, "policyModel")
    assert.equal(News.schema.path("likes").instance, "Array")
})

test("Admin news creation persists a direct image URL and optional related policy", async () => {
    let savedNews
    class FakeNews {
        constructor(data) {
            Object.assign(this, data)
            this._id = newsId
        }
        async save() {
            savedNews = this
        }
    }
    const controller = createNewsController({
        News: FakeNews,
        User: {},
        Policy: { exists: async filter => filter._id === policyId.toString() }
    })
    const res = makeResponse()

    await controller.create({
        body: {
            title: "  Policy update  ",
            content: "  A new policy announcement.  ",
            imageUrl: ` ${policyImageUrl} `,
            relatedPolicy: policyId.toString()
        }
    }, res)

    assert.equal(res.statusCode, 201)
    assert.equal(savedNews.title, "Policy update")
    assert.equal(savedNews.content, "A new policy announcement.")
    assert.equal(savedNews.imageUrl, policyImageUrl)
    assert.equal(savedNews.relatedPolicy, policyId.toString())
    assert.equal(res.body.news.imageUrl, policyImageUrl)
})

test("News creation rejects invalid image URLs and unknown related policies", async () => {
    class FakeNews {
        save() {
            assert.fail("Invalid news must not be stored")
        }
    }
    const controller = createNewsController({
        News: FakeNews,
        User: {},
        Policy: { exists: async () => false }
    })
    const invalidImage = makeResponse()
    await controller.create({
        body: { title: "Title", content: "Content", imageUrl: "data:image/png;base64,abc" }
    }, invalidImage)
    assert.equal(invalidImage.statusCode, 400)

    const unknownPolicy = makeResponse()
    await controller.create({
        body: {
            title: "Title",
            content: "Content",
            imageUrl: policyImageUrl,
            relatedPolicy: policyId.toString()
        }
    }, unknownPolicy)
    assert.equal(unknownPolicy.statusCode, 404)
})

test("GET news returns newest first, populates comments, and includes like counts and image URLs", async () => {
    const post = {
        _id: newsId,
        title: "Policy news",
        imageUrl: policyImageUrl,
        likes: [userId],
        comments: [{
            user: { _id: userId, name: "Test Citizen" },
            userName: "Test Citizen",
            comment: "Helpful update"
        }],
        toObject() {
            return {
                _id: this._id,
                title: this.title,
                imageUrl: this.imageUrl,
                likes: this.likes,
                comments: this.comments
            }
        }
    }
    const calls = []
    const query = {
        sort(value) {
            calls.push(["sort", value])
            return this
        },
        populate(path, fields) {
            calls.push(["populate", path, fields])
            return this
        },
        then(resolve, reject) {
            return Promise.resolve([post]).then(resolve, reject)
        }
    }
    const controller = createNewsController({
        News: { find: () => query },
        User: makeUserModel(),
        Policy: {}
    })
    const res = makeResponse()

    await controller.list({
        auth: { email: "citizen@example.com" }
    }, res)

    assert.equal(res.statusCode, 200)
    assert.deepEqual(calls, [
        ["sort", { createdAt: -1 }],
        ["populate", "comments.user", "name"],
        ["populate", "relatedPolicy", "title"]
    ])
    assert.equal(res.body[0].imageUrl, policyImageUrl)
    assert.equal(res.body[0].likesCount, 1)
    assert.equal(res.body[0].liked, true)
    assert.equal("likes" in res.body[0], false)
    assert.equal(res.body[0].comments[0].user.name, "Test Citizen")
})

test("Like endpoint toggles membership in the likes array", async () => {
    let likes = []
    const controller = createNewsController({
        News: {
            findOneAndUpdate(filter, update) {
                assert.equal(filter._id, newsId.toString())
                const nextLikes = update.$addToSet?.likes
                const alreadyLiked = likes.some(id => id.equals(nextLikes))
                const result = alreadyLiked ? null : { likes: [...likes, nextLikes] }
                if (result) likes = result.likes
                return { select: async () => result }
            },
            findByIdAndUpdate(id, update) {
                assert.equal(id, newsId.toString())
                likes = likes.filter(existingId => !existingId.equals(update.$pull.likes))
                return { select: async () => ({ likes: [...likes] }) }
            }
        },
        User: makeUserModel(),
        Policy: {}
    })

    const liked = makeResponse()
    await controller.toggleLike({
        params: { id: newsId.toString() },
        auth: { email: "citizen@example.com" }
    }, liked)
    assert.equal(liked.statusCode, 200)
    assert.deepEqual(liked.body, { success: true, liked: true, likesCount: 1 })

    const unliked = makeResponse()
    await controller.toggleLike({
        params: { id: newsId.toString() },
        auth: { email: "citizen@example.com" }
    }, unliked)
    assert.equal(unliked.statusCode, 200)
    assert.deepEqual(unliked.body, { success: true, liked: false, likesCount: 0 })
})

test("Comment endpoint appends authenticated citizen comments", async () => {
    let update
    const controller = createNewsController({
        News: {
            findByIdAndUpdate(id, updateValue, options) {
                update = { id, updateValue, options }
                return {
                    select: async () => ({ comments: [updateValue.$push.comments] })
                }
            }
        },
        User: makeUserModel(),
        Policy: {}
    })
    const res = makeResponse()

    await controller.addComment({
        params: { id: newsId.toString() },
        body: { comment: "  Good update  " },
        auth: { email: "citizen@example.com" }
    }, res)

    assert.equal(update.id, newsId.toString())
    const savedComment = update.updateValue.$push.comments
    assert.ok(savedComment._id instanceof mongoose.Types.ObjectId)
    assert.equal(savedComment.user, userId)
    assert.equal(savedComment.userName, "Test Citizen")
    assert.equal(savedComment.comment, "Good update")
    assert.ok(savedComment.createdAt instanceof Date)
    assert.deepEqual(update.options, { new: true, runValidators: true })
    assert.equal(res.statusCode, 201)
    assert.deepEqual(res.body.comment, savedComment)
})
