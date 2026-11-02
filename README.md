# ሀገሬ (Hagere)

> **Empowering Every Ethiopian Voice Through Transparent Civic Engagement.**

![Status](https://img.shields.io/badge/Status-Version%201%20Ready-success?style=for-the-badge)
![Version](https://img.shields.io/badge/Version-1-blue?style=for-the-badge)
![Made With](https://img.shields.io/badge/Made%20With-Node.js%20%7C%20Express%20%7C%20MongoDB-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-Coming%20Soon-lightgrey?style=for-the-badge)

---

> **Platform documentation:** [Open the documentation page](public/docs.html) for the architecture, API reference, project structure, and deployment guide.

## 🌍 About Hagere

**Hagere (ሀገሬ)** is an innovative civic engagement platform built to empower Ethiopian citizens by creating a transparent, inclusive, and intelligent space for public discussion around government policies, national initiatives, and civic matters.

The platform aims to bridge the communication gap between policymakers and citizens by allowing users to discover, understand, discuss, and express their opinions on government policies through community-driven discussions, voting, and constructive debate.

Rather than relying on scattered conversations across multiple social media platforms, Hagere provides a dedicated environment where public opinion can be organized, measured, and shared in a meaningful way.

Our goal is to encourage informed participation, respectful discussions, and greater civic awareness across Ethiopia.

---

# 🚀 Version 1 Status

Hagere V1 provides a responsive civic platform for discovering public policies, reading policy-related news, engaging with content, and asking questions about policy documents. The current implementation is a Node.js/Express application that serves static HTML, CSS, and JavaScript pages, exposes REST API endpoints, and persists data in MongoDB through Mongoose.

Authentication is handled with Firebase Authentication. Policy-document question answering uses Google Gemini and the policy's direct PDF URL. Admin-only publishing and deletion operations are protected by role-based authorization.

The test suites were verified at **63/63 Node tests** and **9/9 V1 Jest integration/E2E tests** when the documentation page was added. Run the commands below to verify the current checkout.

### Main application areas

- **Policy directory and feed:** browse policies and open their source documents.
- **Policy assistant:** ask policy-document questions; the assistant is designed to respond in Amharic.
- **Policy news:** browse the news feed, with authenticated citizen likes and comments.
- **Citizen dashboard and analytics:** view engagement activity and aggregate metrics.
- **Admin tools:** publish and manage policies and news.
- **Documentation:** [Architecture, API, and deployment guide](public/docs.html).

---

# Database Seed Data

Configure the required environment variables described in [Environment configuration](#environment-configuration), then run:

```sh
npm run seed:policies
npm run seed:news
```

Both seeders upsert their records by title and preserve existing policy engagement and news comments. News records link to matching seeded policies when available.

---

# 🧰 Local Development

Requirements: a supported Node.js version, npm, and access to configured MongoDB and Firebase projects.

```sh
npm install
npm start
```

The server serves the frontend and API on the configured `PORT`. For development with automatic restarts, use `npm run dev`.

## Environment configuration

The application validates its environment on startup. Set these values in your local environment or hosting provider's secret settings; never commit credentials or service-account private keys.

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP port |
| `NODE_ENV` | Runtime environment (`development`, `test`, or `production`) |
| `CONNECTION_STRING` | MongoDB connection string (including `mongodb+srv://` for Atlas); this app does not read `MONGODB_URI` |
| `GEMINI_API_KEY` | Gemini API key for policy chat |
| `FIREBASE_API` | Firebase web API configuration used by the app |
| `SERVICE_ACCOUNT` | JSON service-account credentials for the primary Firebase project |
| `ADMIN_FIREBASE_PROJECT_ID` | Separate Firebase project ID used for admin authentication |
| `ADMIN_SERVICE_ACCOUNT` | JSON service-account credentials for the admin Firebase project |
| `ADMIN_UIDS` | Comma-separated allowlist of admin user IDs |

For production, add the Render service's outbound IP addresses to MongoDB Atlas Network Access, use least-privilege database credentials, and add the deployed hostname to Firebase Authentication's Authorized domains. See the [deployment guide](public/docs.html#deployment) for operational details.

## Tests

```sh
npm test
npm run test:v1:e2e
```

`npm test` runs the Node test suite. `npm run test:v1:e2e` runs the V1 Jest/Supertest integration and end-to-end tests.

## API overview

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/policies` | List policies |
| `POST` | `/api/policies/:id/chat` | Ask a question about a policy document |
| `GET` | `/api/news` | Read the public news feed |
| `POST` | `/api/news/:id/like` | Toggle a citizen's news like |
| `POST` | `/api/news/:id/comment` | Add a citizen comment |
| `DELETE` | `/api/policies/:id` | Delete a policy (admin only) |
| `DELETE` | `/api/news/:id` | Delete a news item (admin only) |

Authenticated API calls include a Firebase ID token in the `Authorization` request header. See the [full API reference](public/docs.html#api) for access details.

---

# 🎯 Vision

To become Ethiopia's leading digital platform for civic participation, enabling every citizen to understand, discuss, and contribute to conversations about public policies in an accessible, transparent, and respectful environment.

---

# 🚀 Mission

Our mission is to build a platform where Ethiopians can:

- 📖 Read simplified government policy summaries
- 💬 Participate in meaningful public discussions
- 👍 Express support or opposition through community voting
- 📊 Understand public sentiment
- 🤝 Exchange ideas respectfully
- 📢 Raise awareness of important civic issues
- 🏛 Follow policy progress from proposal to implementation

---

# ✨ Planned Features

## 👤 User System

- User Registration
- Secure Authentication
- User Profiles
- Profile Customization
- Account Verification
- Reputation System

---

## 📰 Policy Feed

- Government Policy Posts
- Featured Policies
- Trending Discussions
- Latest Policies
- Personalized Feed

---

## 🗳 Community Voting

- Support
- Oppose
- Neutral

View community sentiment through interactive statistics and charts.

---

## 💬 Discussion System

- Threaded Comments
- Replies
- Rich Text Support
- Image Uploads
- Mentions
- Reactions
- Discussion Moderation

---

## 📚 Categories

- Education
- Economy
- Agriculture
- Health
- Transportation
- Infrastructure
- Employment
- Technology
- Environment
- Justice
- Energy
- Taxation
- Public Services
- Digital Transformation

---

## 🔍 Search & Discovery

- Search Policies
- Search Users
- Search Topics
- Search Categories
- Advanced Filters

---

## 🔔 Notifications

Receive updates when:

- Someone replies to your comment
- A followed topic is updated
- A policy changes status
- New policies are published
- Your content receives interactions

---

## 📈 Analytics

- Community Sentiment
- Policy Popularity
- Trending Topics
- Discussion Activity
- Public Engagement Metrics

---

## 🤖 Future AI Features

- AI Discussion Summaries
- Fact Checking Assistance
- Policy Simplification
- Smart Recommendations
- Toxic Content Detection
- AI Moderation Assistance

The policy-specific document assistant reads a policy's direct, publicly reachable HTTPS PDF URL and sends its contents to Google Gemini. The PDF URL must not redirect and must resolve only to public IP addresses. Set `GEMINI_API_KEY` in the server's environment to enable the assistant; the key is never sent to the browser.

---

# 🛣 Future Development Roadmap

The following items are roadmap concepts and should not be read as a description of current V1 functionality.

## Future phase 1

- Authentication
- User Profiles
- Policy Feed
- Voting System
- Comment System
- Categories
- Search
- Responsive UI

---

## Future phase 2

- Communities
- Notifications
- Bookmarks
- Polls
- Reputation
- Verification
- Trending Feed

---

## Future phase 3

- AI Features
- Government Verified Accounts
- Policy Timeline
- Regional Analytics
- Civic Learning Center
- Advanced Moderation
- Mobile Applications

---

# 🛠 Technology Stack

### Frontend

- Static HTML, CSS, and browser JavaScript served by Express
- Tailwind CSS utilities

### Backend

- Node.js
- Express.js REST API

### Database

- MongoDB Atlas with Mongoose models

### Authentication

- Firebase Authentication
- Firebase ID-token verification and role-based authorization

### AI

- Google Gemini policy-document assistant with document context and timeout safety

---

# 🎨 Design Principles

Hagere is being built around five core values:

- Transparency
- Accessibility
- Inclusivity
- Simplicity
- Scalability

Every design decision is made with Ethiopian users in mind, ensuring the platform remains intuitive, responsive, and accessible to everyone.

# 🤝 Contributing

Hagere V1 and its [platform documentation](public/docs.html) are available in this repository. Contributions should include focused changes and relevant tests; please open an issue to discuss substantial feature proposals before starting work.

---

# 👨‍💻 Development Team

## Syntax-Designs

Hagere is proudly designed and developed by **Syntax-Designs**, a software development team focused on building modern, impactful, and scalable digital solutions that solve real-world challenges.

The project is led by **Ezedin Yassin**, who oversees the product vision, system architecture, and full-stack development.

Our team is committed to delivering a platform that reflects high engineering standards, thoughtful user experience, and long-term maintainability.

Every feature is carefully planned, tested, and refined to ensure Hagere becomes a trusted platform for civic engagement in Ethiopia.

---

# 💙 Our Commitment

We're not just building another social platform.

We're building a digital space where ideas matter, respectful conversations thrive, and every Ethiopian has an opportunity to participate in shaping the nation's future.

Creating software with this level of responsibility requires careful planning, continuous testing, and thoughtful execution.

While development takes time, our commitment remains the same:

**Deliver a platform that Ethiopia can trust.**

---

# 📢 Stay Updated

Development is progressing every day.

New features, improvements, and milestones will continue to be pushed to this repository as we move closer to our first public release.

If you're interested in following the journey, don't forget to:

⭐ Star this repository

🍴 Follow the project

👀 Watch for updates

Your support motivates us to keep building.

---

# 📜 License

This project is currently under development.

A formal license will be added before the first public release.

---

# ❤️ From Ethiopia, For Ethiopia

> *"Technology has the power to strengthen democracy when every voice has the opportunity to be heard."*

Thank you for checking out **Hagere (ሀገሬ)**.

We can't wait to share what's coming next.

---

<div align="center">

### 🇪🇹 Built with passion by Syntax-Designs

**Led by Ezedin Yassin**

**Building Ethiopia's Future, One Line of Code at a Time.**

⭐ **If you like this project, consider giving it a star!**

</div>
