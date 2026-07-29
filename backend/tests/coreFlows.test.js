import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { createApp } from "../app.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import bcrypt from "bcryptjs";
import { verifyGoogleCredential } from "../config/googleClient.js";

// Google token verification is mocked so the tests exercise the account-linking
// and creation logic without a real Google round-trip.
vi.mock("../config/googleClient.js", () => ({
  verifyGoogleCredential: vi.fn(),
}));

const app = createApp();

const futureISO = (days = 30) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

// ── Fixtures ──────────────────────────────────────────────────────

async function registerUser(overrides = {}) {
  const payload = {
    name: "Test Person",
    password: "password123",
    confirmPassword: "password123",
    role: "Student",
    gender: "Male",
    ...overrides,
  };
  if (!payload.email) {
    throw new Error("registerUser requires an explicit email");
  }
  const res = await request(app).post("/api/auth/register").send(payload);
  expect(res.status).toBe(201);
  return payload;
}

async function loginUser(email, password = "password123") {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password });
  expect(res.status).toBe(200);
  return { token: res.body.data.token, user: res.body.data.user };
}

// Register and sign in — for accounts that are usable immediately (students).
async function registerAndLogin(overrides = {}) {
  const payload = await registerUser(overrides);
  return loginUser(payload.email, payload.password);
}

// Faculty start Pending. Activate directly so tests that just need a working
// faculty member don't depend on the approval flow, which has its own tests.
const asFaculty = async () => {
  await registerUser({
    email: "prof@thapar.edu",
    role: "Faculty",
    department: "DCSE",
    employeeId: "EMP-1001",
  });
  await User.updateOne(
    { email: "prof@thapar.edu" },
    { accountStatus: "Active" }
  );
  return loginUser("prof@thapar.edu");
};

const asStudent = (extra = {}) =>
  registerAndLogin({
    email: "student@thapar.edu",
    role: "Student",
    branch: "COE",
    year: 2,
    ...extra,
  });

// Coordinators are provisioned, not self-registered, so create one directly.
async function createCoordinator(email = "coord@thapar.edu", domain = "thapar.edu") {
  const org = await Organization.findOne({ emailDomains: domain });
  const passwordHash = await bcrypt.hash("password123", 10);
  await User.create({
    organizationId: org._id,
    name: "Coordinator",
    email,
    password: passwordHash,
    role: "Coordinator",
    gender: "Other",
    accountStatus: "Active",
  });
  return loginUser(email);
}

async function createOpportunity(token, overrides = {}) {
  const res = await request(app)
    .post("/api/opportunities/create")
    .set("Authorization", `Bearer ${token}`)
    .send({
      title: "Research Assistant Position",
      description:
        "Assist with an ongoing research project on distributed systems.",
      category: "Research",
      contactEmail: "prof@thapar.edu",
      eligibleBranches: ["All"],
      eligibleYears: ["All"],
      eligibleGender: "Any",
      deadline: futureISO(30),
      ...overrides,
    });
  expect(res.status).toBe(201);
  return res.body.opportunity;
}

const applyTo = (token, opportunityId, coverLetter) =>
  request(app)
    .post("/api/applications")
    .set("Authorization", `Bearer ${token}`)
    .field("opportunityId", opportunityId)
    .field(
      "coverLetter",
      coverLetter || "I am genuinely interested in contributing to this work."
    );

// Every registration resolves to an organization by email domain, so the suite
// provisions the institutional org before each test.
beforeEach(async () => {
  await Organization.create({
    name: "Thapar Institute",
    emailDomains: ["thapar.edu"],
  });
});

// ── Health ────────────────────────────────────────────────────────

describe("health", () => {
  it("reports ok when the database is connected", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.db).toBe("connected");
  });
});

// ── Auth ──────────────────────────────────────────────────────────

describe("auth", () => {
  it("registers and logs in a user", async () => {
    const { token, user } = await asStudent();
    expect(token).toBeTruthy();
    expect(user.role).toBe("Student");
  });

  it("rejects a registration whose passwords do not match", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Mismatch",
      email: "mismatch@thapar.edu",
      password: "password123",
      confirmPassword: "different1",
      role: "Student",
      gender: "Male",
    });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("rejects a duplicate email", async () => {
    await asStudent();
    const res = await request(app).post("/api/auth/register").send({
      name: "Duplicate",
      email: "student@thapar.edu",
      password: "password123",
      confirmPassword: "password123",
      role: "Student",
      gender: "Male",
    });
    expect(res.status).toBe(409);
  });

  it("rejects login with a wrong password", async () => {
    await asStudent();
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "student@thapar.edu", password: "wrongpassword" });
    expect(res.status).toBe(401);
  });

  it("rejects an unauthenticated protected request", async () => {
    const res = await request(app).get("/api/protected");
    expect(res.status).toBe(401);
  });

  it("rejects registration from a non-institutional email domain", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Outsider",
      email: "someone@gmail.com",
      password: "password123",
      confirmPassword: "password123",
      role: "Student",
      gender: "Male",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a password shorter than eight characters", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "Shortpass",
      email: "shortpass@thapar.edu",
      password: "pass12",
      confirmPassword: "pass12",
      role: "Student",
      gender: "Male",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a request whose Authorization header is not a Bearer token", async () => {
    const res = await request(app)
      .get("/api/protected")
      .set("Authorization", "token abc123");
    expect(res.status).toBe(401);
  });
});

// ── Authorization (RBAC) ──────────────────────────────────────────

describe("authorization", () => {
  it("forbids a student from creating an opportunity", async () => {
    const { token } = await asStudent();
    const res = await request(app)
      .post("/api/opportunities/create")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Should not be allowed",
        description: "A student must not be able to post an opportunity here.",
        category: "Research",
        contactEmail: "student@thapar.edu",
        deadline: futureISO(30),
      });
    expect(res.status).toBe(403);
  });
});

// ── Golden path ───────────────────────────────────────────────────

describe("core application flow", () => {
  it("carries an application from post → apply → review → shortlist → withdraw", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();

    const opportunity = await createOpportunity(faculty.token);

    // The feed, scoped to the caller's organization, shows the opportunity.
    const feed = await request(app)
      .get("/api/opportunities")
      .set("Authorization", `Bearer ${student.token}`);
    expect(feed.status).toBe(200);
    expect(feed.body.success).toBe(true);
    expect(feed.body.opportunities.some((o) => o._id === opportunity._id)).toBe(
      true
    );

    // Student applies.
    const apply = await applyTo(student.token, opportunity._id);
    expect(apply.status).toBe(201);
    const applicationId = apply.body.application._id;

    // Duplicate application is blocked.
    const dup = await applyTo(student.token, opportunity._id);
    expect(dup.status).toBe(409);

    // Faculty sees exactly one applicant.
    const applicants = await request(app)
      .get(`/api/applications/opportunity/${opportunity._id}`)
      .set("Authorization", `Bearer ${faculty.token}`);
    expect(applicants.status).toBe(200);
    expect(applicants.body.count).toBe(1);

    // Opening the applicant transitions Applied → Viewed.
    const opened = await request(app)
      .get(`/api/applications/${applicationId}`)
      .set("Authorization", `Bearer ${faculty.token}`);
    expect(opened.status).toBe(200);
    expect(opened.body.application.status).toBe("Viewed");

    // Faculty shortlists.
    const shortlist = await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${faculty.token}`)
      .send({ status: "Shortlisted" });
    expect(shortlist.status).toBe(200);
    expect(shortlist.body.application.status).toBe("Shortlisted");

    // Student withdraws (allowed from Shortlisted).
    const withdraw = await request(app)
      .patch(`/api/applications/${applicationId}/withdraw`)
      .set("Authorization", `Bearer ${student.token}`);
    expect(withdraw.status).toBe(200);
  });
});

// ── Eligibility gate ──────────────────────────────────────────────

describe("eligibility", () => {
  it("blocks a student who does not meet the branch criteria", async () => {
    const faculty = await asFaculty();
    const student = await asStudent({ branch: "COE" });

    const opportunity = await createOpportunity(faculty.token, {
      eligibleBranches: ["ECE"],
    });

    const res = await applyTo(student.token, opportunity._id);
    expect(res.status).toBe(403);
  });
});

// ── Status state machine ──────────────────────────────────────────

describe("application state machine", () => {
  it("rejects an illegal transition out of a terminal state", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);

    const apply = await applyTo(student.token, opportunity._id);
    const applicationId = apply.body.application._id;

    // Applied → Shortlisted → Selected (both legal).
    await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${faculty.token}`)
      .send({ status: "Shortlisted" });
    const select = await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${faculty.token}`)
      .send({ status: "Selected" });
    expect(select.status).toBe(200);

    // Selected is terminal — any further change is rejected.
    const illegal = await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${faculty.token}`)
      .send({ status: "Rejected" });
    expect(illegal.status).toBe(400);
  });
});

// ── Tenant isolation ──────────────────────────────────────────────

describe("multi-tenancy", () => {
  it("never leaks opportunities, detail, apply or profiles across organizations", async () => {
    // A Thapar faculty member posts an opportunity.
    const faculty = await asFaculty();
    const opportunity = await createOpportunity(faculty.token);

    // A student in a different organization.
    await Organization.create({
      name: "Other University",
      emailDomains: ["other.edu"],
    });
    const outsider = await registerAndLogin({
      email: "student@other.edu",
      role: "Student",
      branch: "COE",
      year: 2,
    });

    // The outsider's feed does not include the Thapar opportunity.
    const feed = await request(app)
      .get("/api/opportunities")
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(feed.status).toBe(200);
    expect(
      feed.body.opportunities.some((o) => o._id === opportunity._id)
    ).toBe(false);

    // Fetching it by id, applying to it, and viewing the poster's profile all
    // read as not-found across the tenant boundary.
    const detail = await request(app)
      .get(`/api/opportunities/${opportunity._id}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(detail.status).toBe(404);

    const apply = await request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${outsider.token}`)
      .field("opportunityId", opportunity._id)
      .field("coverLetter", "I would like to apply to this role from another org.");
    expect(apply.status).toBe(404);

    const profile = await request(app)
      .get(`/api/users/${faculty.user.id}`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(profile.status).toBe(404);
  });
});

// ── Faculty approval ──────────────────────────────────────────────

describe("faculty approval", () => {
  it("keeps a pending faculty out until a coordinator approves", async () => {
    // Faculty registers, is Pending, and cannot sign in.
    await registerUser({
      email: "newprof@thapar.edu",
      role: "Faculty",
      department: "DCSE",
      employeeId: "EMP-2002",
    });
    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "newprof@thapar.edu", password: "password123" });
    expect(blocked.status).toBe(403);

    // A coordinator sees them in the pending list and approves.
    const coordinator = await createCoordinator();
    const pending = await request(app)
      .get("/api/admin/faculty/pending")
      .set("Authorization", `Bearer ${coordinator.token}`);
    expect(pending.status).toBe(200);
    expect(pending.body.count).toBe(1);

    const facultyId = pending.body.faculty[0]._id;
    const approve = await request(app)
      .patch(`/api/admin/faculty/${facultyId}/approve`)
      .set("Authorization", `Bearer ${coordinator.token}`);
    expect(approve.status).toBe(200);

    // Now the faculty can sign in.
    const ok = await request(app)
      .post("/api/auth/login")
      .send({ email: "newprof@thapar.edu", password: "password123" });
    expect(ok.status).toBe(200);
  });

  it("blocks a rejected faculty from signing in", async () => {
    await registerUser({
      email: "badprof@thapar.edu",
      role: "Faculty",
      department: "DCSE",
      employeeId: "EMP-3003",
    });
    const coordinator = await createCoordinator();
    const pending = await request(app)
      .get("/api/admin/faculty/pending")
      .set("Authorization", `Bearer ${coordinator.token}`);
    const facultyId = pending.body.faculty[0]._id;

    const reject = await request(app)
      .patch(`/api/admin/faculty/${facultyId}/reject`)
      .set("Authorization", `Bearer ${coordinator.token}`)
      .send({ reason: "Could not verify faculty status" });
    expect(reject.status).toBe(200);

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "badprof@thapar.edu", password: "password123" });
    expect(blocked.status).toBe(403);
  });

  it("forbids a non-coordinator from the approval endpoints", async () => {
    const student = await asStudent();
    const res = await request(app)
      .get("/api/admin/faculty/pending")
      .set("Authorization", `Bearer ${student.token}`);
    expect(res.status).toBe(403);
  });

  it("does not let a coordinator approve faculty in another organization", async () => {
    await registerUser({
      email: "thaparprof@thapar.edu",
      role: "Faculty",
      department: "DCSE",
      employeeId: "EMP-4004",
    });
    const thaparCoord = await createCoordinator();
    const pending = await request(app)
      .get("/api/admin/faculty/pending")
      .set("Authorization", `Bearer ${thaparCoord.token}`);
    const facultyId = pending.body.faculty[0]._id;

    await Organization.create({
      name: "Other University",
      emailDomains: ["other.edu"],
    });
    const otherCoord = await createCoordinator("coord@other.edu", "other.edu");

    const res = await request(app)
      .patch(`/api/admin/faculty/${facultyId}/approve`)
      .set("Authorization", `Bearer ${otherCoord.token}`);
    expect(res.status).toBe(404);
  });
});

// ── Google sign-in ────────────────────────────────────────────────

describe("google sign-in", () => {
  const googlePost = (body) =>
    request(app).post("/api/auth/google").send(body);

  const mockGoogle = (overrides) =>
    verifyGoogleCredential.mockResolvedValue({
      email: "person@thapar.edu",
      emailVerified: true,
      name: "Test Person",
      googleId: "google-sub-1",
      ...overrides,
    });

  it("asks a brand-new Google user to onboard", async () => {
    mockGoogle({ email: "fresh@thapar.edu", googleId: "g-fresh" });
    const res = await googlePost({ credential: "x" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("needs-onboarding");
    expect(res.body.email).toBe("fresh@thapar.edu");
  });

  it("creates and signs in a student on onboarding", async () => {
    mockGoogle({ email: "gstudent@thapar.edu", googleId: "g-student" });
    const res = await googlePost({
      credential: "x",
      role: "Student",
      gender: "Male",
      branch: "COE",
      year: 2,
    });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("signed-in");
    expect(res.body.data.token).toBeTruthy();
  });

  it("creates a faculty as pending, and refuses a second sign-in", async () => {
    mockGoogle({ email: "gfaculty@thapar.edu", googleId: "g-faculty" });
    const created = await googlePost({
      credential: "x",
      role: "Faculty",
      gender: "Female",
      department: "DCSE",
      employeeId: "EMP-G-1",
    });
    expect(created.status).toBe(200);
    expect(created.body.status).toBe("pending");
    expect(created.body.data).toBeUndefined();

    const again = await googlePost({ credential: "x" });
    expect(again.status).toBe(403);
  });

  it("links Google to an existing password account and signs in", async () => {
    await registerUser({
      email: "linkme@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
    });
    mockGoogle({ email: "linkme@thapar.edu", googleId: "g-link" });
    const res = await googlePost({ credential: "x" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("signed-in");
    expect(res.body.data.token).toBeTruthy();
  });

  it("rejects a Google account from an unrecognized domain", async () => {
    mockGoogle({ email: "someone@gmail.com", googleId: "g-ext" });
    const res = await googlePost({ credential: "x", role: "Student" });
    expect(res.status).toBe(400);
  });

  it("rejects an unverified Google email", async () => {
    mockGoogle({ email: "unverified@thapar.edu", emailVerified: false });
    const res = await googlePost({ credential: "x" });
    expect(res.status).toBe(400);
  });

  it("tells a Google-only account to use Google when a password is tried", async () => {
    mockGoogle({ email: "googleonly@thapar.edu", googleId: "g-only" });
    await googlePost({
      credential: "x",
      role: "Student",
      gender: "Male",
      branch: "COE",
      year: 2,
    });

    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "googleonly@thapar.edu", password: "whatever123" });
    expect(res.status).toBe(400);
  });
});

// ── Feed pagination & search ──────────────────────────────────────

describe("feed pagination and search", () => {
  it("paginates, filters and searches the feed on the server", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();

    for (let i = 1; i <= 13; i++) {
      await createOpportunity(faculty.token, {
        title: `Research Assistant ${i}`,
        category: "Research",
        eligibleBranches: ["All"],
      });
    }
    await createOpportunity(faculty.token, {
      title: "Backend Internship",
      category: "Internship",
      eligibleBranches: ["ECE"],
    });
    await createOpportunity(faculty.token, {
      title: "Machine Learning Gig",
      category: "Paid Gig",
      eligibleBranches: ["COE"],
    });
    // 15 opportunities in total.

    const feed = (query) =>
      request(app)
        .get(`/api/opportunities${query}`)
        .set("Authorization", `Bearer ${student.token}`);

    const page1 = await feed("?page=1&limit=12");
    expect(page1.status).toBe(200);
    expect(page1.body.opportunities.length).toBe(12);
    expect(page1.body.pagination.total).toBe(15);
    expect(page1.body.pagination.hasMore).toBe(true);

    const page2 = await feed("?page=2&limit=12");
    expect(page2.body.opportunities.length).toBe(3);
    expect(page2.body.pagination.hasMore).toBe(false);

    const internships = await feed("?category=Internship");
    expect(internships.body.pagination.total).toBe(1);
    expect(internships.body.opportunities[0].title).toBe("Backend Internship");

    // The ECE-only opportunity plus every "All" one; the COE-only gig excluded.
    const ece = await feed("?branch=ECE&limit=50");
    expect(ece.body.pagination.total).toBe(14);

    const search = await feed("?search=Machine");
    expect(search.body.pagination.total).toBe(1);
    expect(search.body.opportunities[0].title).toBe("Machine Learning Gig");
  });
});
