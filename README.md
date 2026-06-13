# Opportunity Quest

> The bridge between faculty and students — and the record of it.
> Opportunity Quest turns scattered, word-of-mouth academic opportunity into a structured, equitable, on-record exchange.

---

## Why this exists

**1. What I saw.**
Campuses are full of opportunity — research, papers, internships, paid projects — and almost none of it is discoverable. It lives in WhatsApp groups that scroll faster than anyone can read, on noticeboards no one checks, and in the handful of conversations a professor has after class. If you are not in the group, you never hear about it. If you are not in that professor's section, the hallway conversation never happens.

The students who lose the most are the ones who are not loud. An introvert rarely walks up to a professor to ask for a project, and when a connection does happen by chance, the student often agrees to whatever is offered — even when it sits far outside their interests — simply because finding another door, and working up the nerve to knock on it again, costs more than it should. Opportunity ends up distributed by proximity and confidence rather than by fit or merit.

**2. What it should be.**
There should be one place where faculty post what they need and every eligible student can see it — narrowed to their branch, year and interests — and apply on equal footing. No group to be in. No nerve required. The match is made on relevance, not on who happened to be standing nearby.

**3. What this becomes.**
Once that exchange is structured, it is also *on record*. Every opportunity, application and decision is captured — which gives a university something it has rarely had: visibility into faculty–student engagement (research participation, mentorship, collaboration) as data rather than as folklore. Opportunity Quest is that bridge, and that record.

---

## What it does

Opportunity Quest gives faculty a place to publish opportunities and run a disciplined review of applicants, and gives students a place to find roles they are genuinely eligible for, apply with a cover letter and resume, and follow each application from submission to decision. Access is governed by a strict two-role model — Student and Faculty — and the interface is deliberately quiet: academic, uncluttered, and built to be trusted rather than to impress.

Under the hood it is a React single-page application backed by an Express and MongoDB REST API, organised in clean layers so the codebase stays maintainable as the platform grows.

---

## Key Features

**Authentication & roles**
- JWT authentication with bcrypt-hashed passwords.
- Role-based access control (Student / Faculty) enforced by middleware.
- Profile-aware sessions — name, title prefix and avatar follow the user across the UI.

**Opportunities (Faculty)**
- Create, edit and soft-delete opportunities.
- A full status lifecycle — **Active → Archived → Closed** — with **Expired** derived automatically once a deadline passes (evaluated at query time, no scheduler required).
- Reactivate archived opportunities, keeping or resetting the deadline.
- Extend deadlines, with an audited deadline-change history.
- Attach supporting PDFs to an opportunity.

**Discovery (Student)**
- A public feed of active, in-date opportunities with search and filters (category, branch, year).
- Opportunity detail showing eligibility, attachments, and the posting faculty member's public profile.

**Applications**
- Students apply with a required cover letter and an optional PDF resume.
- A strict eligibility gate (branch / year / gender) enforced on the server.
- Duplicate applications prevented at the database level; re-applying after a withdrawal is subject to a cooldown window.
- A faculty applicant dashboard with a status pipeline — **Applied → Viewed → Shortlisted → Selected / Rejected** — enforced as a server-side state machine.
- resumes stored privately and streamed only to the owning student and the owning faculty member.

**Profiles**
- Distinct student and faculty profiles. Students present skills, society/club role, projects and areas of interest; faculty present department, designation, cabin/office, research interests and a title prefix.
- Profile-image upload with an in-browser circular cropper (zoom and reposition), and one-click revert to initials.
- Symmetric visibility — faculty see a student's full profile while reviewing an application, and students see a faculty member's profile from any opportunity they posted.

**Security & hardening**
- Helmet security headers, global and per-route rate limiting, and request-body size limits.
- NoSQL-operator sanitization, Joi schema validation, and ObjectId parameter guards.
- Ownership (IDOR) checks on every application and resume access; mass-assignment blocked via field whitelisting.

**Design system**
- Centralized design tokens (color, type, spacing, radius, elevation) and shared `.btn` / `.card` primitives.
- A custom confirmation dialog (in place of native `window.confirm`), an inline SVG icon set, status badges, and deadline-urgency chips.

---

## Tech Stack

**Frontend**
- JavaScript (ES Modules), [React 19](https://react.dev/)
- [Vite 7](https://vitejs.dev/) build tooling and dev server
- [React Router 7](https://reactrouter.com/) for routing
- Plain CSS on a custom design-token system (no UI framework)
- Native `fetch` for HTTP
- ESLint 9 with the `react-hooks` and `react-refresh` plugins

**Backend**
- [Node.js](https://nodejs.org/) and [Express 5](https://expressjs.com/) (ES Modules)
- [MongoDB](https://www.mongodb.com/) via [Mongoose 9](https://mongoosejs.com/)
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) and [bcryptjs](https://github.com/dcodeIO/bcrypt.js) for authentication
- [Joi 18](https://joi.dev/) for request validation
- [Helmet 8](https://helmetjs.github.io/) and [express-rate-limit 8](https://express-rate-limit.mintlify.app/) for hardening
- [Multer 2](https://github.com/expressjs/multer) for file uploads
- `cors`, `dotenv`

**Architecture pattern**
The backend follows a strict layered flow — **Controller → Service → Repository → Model**. Controllers handle HTTP only, services own the business rules, repositories are the single point of database access, and models define schemas. This separation is intentional and load-bearing: it keeps business logic testable and the data layer swappable.

---

## Project Architecture / Directory Structure

```
Opportunity-Quest/
├── backend/                      Express + MongoDB REST API
│   ├── config/                   Database connection (db.js)
│   ├── constants/                Domain constants (application lifecycle, cooldown)
│   ├── controllers/              HTTP request/response handling
│   ├── middleware/               Auth, RBAC, validation, sanitization, rate limits, uploads
│   ├── models/                   Mongoose schemas — User, Opportunity, Application
│   ├── repositories/             Data-access layer (the only place that touches the database)
│   ├── routes/                   Express route definitions (auth, opportunities, applications, users)
│   ├── services/                 Business logic
│   ├── utils/                    AppError, error responder, ObjectId guard
│   ├── validators/               Joi request schemas
│   ├── uploads/                  Public files: opportunity PDFs, avatars (gitignored)
│   ├── storage/                  Private files: resumes (gitignored, never served statically)
│   └── server.js                 Application entry point
│
├── frontend/                     React + Vite single-page app
│   ├── index.html                SPA host page
│   ├── vite.config.js            Vite configuration
│   ├── eslint.config.js          ESLint configuration
│   └── src/
│       ├── components/           Reusable UI (Avatar, AvatarCropper, ProfileView/Modal,
│       │                         StatusBadge, Icons, ConfirmProvider)
│       ├── constants/            Option lists (skills, branches, positions)
│       ├── pages/                Route-level screens (Home, Login, Register, Profile,
│       │                         Faculty, Applicants, MyApplications, OpportunityDetail, …)
│       ├── utils/api.js          Fetch helpers (public, authed, multipart, blob)
│       ├── tokens.css            Design tokens (single source of truth for styling)
│       ├── global.css            Base element styles + shared .btn / .card primitives
│       └── main.jsx              Application entry point
│
└── .gitignore
```

**Key folders at a glance**
- `backend/repositories/` is the database boundary — services never query Mongoose directly.
- `backend/middleware/` holds the security stack (`authMiddleware`, `authorizeRoles`, `sanitizeMiddleware`, `rateLimiters`) and the upload configs (`uploadResume` → private, `uploadAvatar` / `uploadMiddleware` → public).
- `frontend/src/tokens.css` and `global.css` define the design system; pages and components consume tokens instead of hard-coded values.
- `frontend/src/utils/api.js` centralizes every backend call and all JWT handling.

---

## Getting Started & Installation

### Prerequisites
- **Node.js 20+** (the backend dev script uses `node --watch`).
- **MongoDB** — a connection string from MongoDB Atlas or a local `mongod` instance.
- **npm** (ships with Node).

### 1. Clone and install
```bash
git clone https://github.com/AgrimVerma11/OpportunityQuest.git
cd OpportunityQuest

# Backend dependencies
cd backend && npm install

# Frontend dependencies
cd ../frontend && npm install
```

### 2. Configure environment variables

Create `backend/.env`:
```bash
# Port the API listens on
PORT=5174

# MongoDB connection string (Atlas or local)
MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/opportunity-quest

# Secret used to sign JWTs — use a long, random string. The server refuses to start without it.
JWT_SECRET=replace-with-a-long-random-secret

# Origin allowed by CORS (the frontend dev server)
ALLOWED_ORIGIN=http://localhost:5173
```

Create `frontend/.env`:
```bash
# Base URL of the backend API (note the /api suffix)
VITE_API_URL=http://localhost:5174/api
```

> The `.env` files are gitignored — never commit real secrets. `JWT_SECRET` is required; the backend exits on startup if it is missing.

### 3. Run the app (two terminals)
```bash
# Terminal 1 — API (http://localhost:5174)
cd backend && npm run dev

# Terminal 2 — web app (http://localhost:5173)
cd frontend && npm run dev
```

Open `http://localhost:5173`, register a Faculty and a Student account, post an opportunity as the faculty, then apply as the student.

> Registration is currently gated to `@thapar.edu` email addresses (a deliberate institutional restriction enforced on the client). Use addresses such as `prof@thapar.edu` and `student@thapar.edu` when testing locally.

### 4. Production build (frontend)
```bash
cd frontend
npm run build      # outputs static assets to dist/
npm run preview    # serves the production build locally
```

In production, run the backend with `npm start` (plain `node server.js`) and serve the built frontend from your host or CDN of choice.

---

## Usage & Development Commands

**Backend** (`/backend`)
| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with file watching (`node --watch`) on `PORT` (default 5174). |
| `npm start` | Start the API once, without watching. |

**Frontend** (`/frontend`)
| Command | Description |
| --- | --- |
| `npm run dev` | Start the Vite dev server on port 5173. |
| `npm run build` | Produce an optimized production build in `dist/`. |
| `npm run preview` | Serve the production build locally. |
| `npm run lint` | Run ESLint over the source. |

> **Testing:** there is no automated test suite yet. The current quality gates are `npm run lint` and `npm run build` on the frontend, plus manual verification of the core flows (register, login, post, apply, review). A test runner (Vitest / Jest with Supertest) is the natural next addition before the team scales.

---

## API Overview

All API routes are prefixed with `/api`. Protected routes require an `Authorization: Bearer <token>` header.

| Group | Base path | Purpose |
| --- | --- | --- |
| Auth | `/api/auth` | Register, login, get/update own profile, profile-image upload and removal. |
| Opportunities | `/api/opportunities` | Public feed and detail; faculty create / edit / archive / close / reactivate / extend / attachments. |
| Applications | `/api/applications` | Apply, list own applications, faculty applicant lists, status updates, withdraw, authorized resume streaming. |
| Users | `/api/users/:id` | Public-safe profile of another user (e.g. a student viewing the posting faculty). |

Public uploads (opportunity PDFs, avatars) are served from `/uploads`. resumes are **never** served statically — they are streamed only through an authenticated, ownership-checked endpoint.

---

## License

Copyright © 2026 Agrim Verma. All rights reserved.

Opportunity Quest is proprietary software. Its source code, design and documentation may not be copied, modified, distributed or used in any form, in whole or in part, without the prior written consent of the author. See [LICENSE](LICENSE) for the full terms.

For permission or licensing inquiries: **masteragrim11@gmail.com**
