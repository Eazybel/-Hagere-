// Profile management and activity metrics
const mongoose = require("mongoose")
const userModel = require("../models/User")
const { getAuth } = require("firebase-admin/auth")

const userController = async (req, res) => {
    if (req.headers.authorization) {
        const token = req.headers.authorization.split("Bearer ")[1]
        try {
            const decodedToken = await getAuth().verifyIdToken(token)
            const trustedToken = decodedToken.uid
            console.log(trustedToken)
            return res.sendStatus(200).send(req.body)
        } catch (err) {
            console.error(err)
            return res.status(401).send("Invalid token")
        }
    } else {
        return res.status(401).send("Unauthorized Request")
    }
}

module.exports = userController