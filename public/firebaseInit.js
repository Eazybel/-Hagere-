/**
 * @file firebaseInit.js
 * @description Initializes the citizen-facing Firebase application and exports the shared Auth instance.
 * @module Client/Firebase
 * @requires Firebase App and Auth browser SDKs
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js"
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js"

// Browser Firebase configuration identifies the public client project; server credentials stay on the backend.
const firebaseConfig = {
    apiKey: "AIzaSyAXviVipDAJZl-xyiQE4JfACkcl1xt_CqM",
    authDomain: "hagere-c6abc.firebaseapp.com",
    projectId: "hagere-c6abc",
    storageBucket: "hagere-c6abc.firebasestorage.app",
    messagingSenderId: "272791886594",
    appId: "1:272791886594:web:05b9f9fd6fc98cdca3c01b"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
