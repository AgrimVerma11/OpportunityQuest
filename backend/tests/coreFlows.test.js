import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { createApp } from "../app.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import AuditLog from "../models/AuditLog.js";
import * as auditRepo from "../repositories/auditRepository.js";
import bcrypt from "bcryptjs";
import { verifyGoogleCredential } from "../config/googleClient.js";
import * as storage from "../lib/storage/index.js";
import { avatarKey, resumeKey } from "../lib/storage/keys.js";
import { ResilientStore } from "../middleware/resilientStore.js";
import * as emailTransport from "../lib/email/index.js";

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

  // Helper: register a pending faculty and return the coordinator + faculty id.
  const pendingFacultyAndCoordinator = async (email, employeeId) => {
    await registerUser({
      email,
      role: "Faculty",
      department: "DCSE",
      employeeId,
    });
    const coordinator = await createCoordinator();
    const pending = await request(app)
      .get("/api/admin/faculty/pending")
      .set("Authorization", `Bearer ${coordinator.token}`);
    return { coordinator, facultyId: pending.body.faculty[0]._id };
  };

  it("records an audit entry for an approval", async () => {
    const { coordinator, facultyId } = await pendingFacultyAndCoordinator(
      "auditapprove@thapar.edu",
      "EMP-6006"
    );

    await request(app)
      .patch(`/api/admin/faculty/${facultyId}/approve`)
      .set("Authorization", `Bearer ${coordinator.token}`)
      .expect(200);

    const entries = await AuditLog.find({ targetUser: facultyId });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("faculty.approved");
    expect(entries[0].actor.toString()).toBe(coordinator.user.id);
    expect(entries[0].organizationId).toBeTruthy();
  });

  it("records an audit entry with the reason for a rejection", async () => {
    const { coordinator, facultyId } = await pendingFacultyAndCoordinator(
      "auditreject@thapar.edu",
      "EMP-7007"
    );

    await request(app)
      .patch(`/api/admin/faculty/${facultyId}/reject`)
      .set("Authorization", `Bearer ${coordinator.token}`)
      .send({ reason: "Employee id did not match the directory" })
      .expect(200);

    const entries = await AuditLog.find({ targetUser: facultyId });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("faculty.rejected");
    expect(entries[0].reason).toBe("Employee id did not match the directory");
  });

  it("rolls back the status change if writing the audit entry fails", async () => {
    const { coordinator, facultyId } = await pendingFacultyAndCoordinator(
      "audittx@thapar.edu",
      "EMP-8008"
    );

    // Force the audit write inside the transaction to fail.
    const spy = vi
      .spyOn(auditRepo, "record")
      .mockRejectedValueOnce(new Error("audit write failed"));

    const res = await request(app)
      .patch(`/api/admin/faculty/${facultyId}/approve`)
      .set("Authorization", `Bearer ${coordinator.token}`);
    expect(res.status).toBe(500);

    spy.mockRestore();

    // The whole transaction rolled back: the account is still Pending and no
    // audit entry was persisted.
    const faculty = await User.findById(facultyId);
    expect(faculty.accountStatus).toBe("Pending");
    expect(await AuditLog.countDocuments({ targetUser: facultyId })).toBe(0);
  });

  it("emails the faculty member on approval", async () => {
    const spy = vi.spyOn(emailTransport, "sendEmail").mockResolvedValue();
    const { coordinator, facultyId } = await pendingFacultyAndCoordinator(
      "emailapprove@thapar.edu",
      "EMP-9009"
    );

    await request(app)
      .patch(`/api/admin/faculty/${facultyId}/approve`)
      .set("Authorization", `Bearer ${coordinator.token}`)
      .expect(200);

    expect(spy).toHaveBeenCalledTimes(1);
    const email = spy.mock.calls[0][0];
    expect(email.to).toBe("emailapprove@thapar.edu");
    expect(email.subject).toMatch(/approved/i);
    spy.mockRestore();
  });

  it("emails the faculty member, with the reason, on rejection", async () => {
    const spy = vi.spyOn(emailTransport, "sendEmail").mockResolvedValue();
    const { coordinator, facultyId } = await pendingFacultyAndCoordinator(
      "emailreject@thapar.edu",
      "EMP-1010"
    );

    await request(app)
      .patch(`/api/admin/faculty/${facultyId}/reject`)
      .set("Authorization", `Bearer ${coordinator.token}`)
      .send({ reason: "Employee id did not match" })
      .expect(200);

    expect(spy).toHaveBeenCalledTimes(1);
    const email = spy.mock.calls[0][0];
    expect(email.to).toBe("emailreject@thapar.edu");
    expect(email.text).toContain("Employee id did not match");
    spy.mockRestore();
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

// ── Object storage ────────────────────────────────────────────────

describe("storage port (local driver)", () => {
  it("stores an object, streams it back byte-for-byte, then deletes it", async () => {
    const key = resumeKey();
    const body = Buffer.from("%PDF-1.4 storage round-trip\n%%EOF");

    await storage.put(key, { body, contentType: "application/pdf" });

    const object = await storage.getStream(key);
    expect(object).not.toBeNull();
    const chunks = [];
    for await (const chunk of object.stream) chunks.push(chunk);
    expect(Buffer.concat(chunks).equals(body)).toBe(true);

    await storage.remove(key);
    expect(await storage.getStream(key)).toBeNull();
  });

  it("recovers a key from the public url it issued", () => {
    const key = avatarKey("image/png");
    expect(storage.keyFromPublicUrl(storage.publicUrl(key))).toBe(key);
    expect(storage.keyFromPublicUrl("https://example.com/not-ours.png")).toBeNull();
  });
});

// ── Resume upload & authorized streaming ──────────────────────────

describe("resume storage", () => {
  const pdf = Buffer.from("%PDF-1.4\n1 0 obj applicant resume\n%%EOF");

  const applyWithResume = (token, opportunityId) =>
    request(app)
      .post("/api/applications")
      .set("Authorization", `Bearer ${token}`)
      .field("opportunityId", opportunityId)
      .field("coverLetter", "Please find my resume attached for your review.")
      .attach("resume", pdf, "resume.pdf");

  it("stores an applied resume and streams it back to the owning faculty", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);

    const apply = await applyWithResume(student.token, opportunity._id);
    expect(apply.status).toBe(201);
    const applicationId = apply.body.application._id;

    const download = await request(app)
      .get(`/api/applications/${applicationId}/resume`)
      .set("Authorization", `Bearer ${faculty.token}`);
    expect(download.status).toBe(200);
    expect(download.headers["content-type"]).toContain("application/pdf");
    expect(download.headers["content-length"]).toBe(String(pdf.length));
  });

  it("denies resume access to an unrelated user", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);

    const apply = await applyWithResume(student.token, opportunity._id);
    const applicationId = apply.body.application._id;

    const outsider = await registerAndLogin({
      email: "outsider@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
    });
    const denied = await request(app)
      .get(`/api/applications/${applicationId}/resume`)
      .set("Authorization", `Bearer ${outsider.token}`);
    expect(denied.status).toBe(403);
  });
});

// ── Rate-limit resilient store ────────────────────────────────────

describe("rate-limit resilient store", () => {
  it("passes through the wrapped store's result when it succeeds", async () => {
    const inner = {
      increment: async () => ({ totalHits: 5, resetTime: undefined }),
    };
    const store = new ResilientStore(inner);
    store.init({ windowMs: 1000 });

    const info = await store.increment("key");
    expect(info.totalHits).toBe(5);
  });

  it("fails open (allows the request) when the wrapped store errors", async () => {
    const inner = {
      increment: async () => {
        throw new Error("redis unreachable");
      },
    };
    const store = new ResilientStore(inner);
    store.init({ windowMs: 1000 });

    const info = await store.increment("key");
    // A single hit, well under any ceiling, so the request proceeds.
    expect(info.totalHits).toBe(1);
    expect(info.resetTime).toBeInstanceOf(Date);
  });

  it("swallows errors from best-effort operations", async () => {
    const inner = {
      decrement: async () => {
        throw new Error("redis unreachable");
      },
      resetKey: async () => {
        throw new Error("redis unreachable");
      },
    };
    const store = new ResilientStore(inner);

    await expect(store.decrement("key")).resolves.toBeUndefined();
    await expect(store.resetKey("key")).resolves.toBeUndefined();
  });

  it("does not leave an unhandled rejection when the store's init fails", async () => {
    // The wrapped store's init loads a Lua script and rejects if the client
    // isn't connected — this must be handled, not crash the process.
    const inner = {
      init: () => Promise.reject(new Error("not connected yet")),
    };
    const store = new ResilientStore(inner);

    expect(() => store.init({ windowMs: 1000 })).not.toThrow();
    // Give the rejected init promise a tick to settle; it must be handled.
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
});

// ── Notifications ─────────────────────────────────────────────────

describe("notifications", () => {
  const listFor = (token) =>
    request(app)
      .get("/api/notifications")
      .set("Authorization", `Bearer ${token}`);

  const unreadFor = (token) =>
    request(app)
      .get("/api/notifications/unread-count")
      .set("Authorization", `Bearer ${token}`);

  it("notifies the faculty on a new application and the student on a decision", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);

    // Applying notifies the opportunity's owner.
    const apply = await applyTo(student.token, opportunity._id);
    expect(apply.status).toBe(201);
    const applicationId = apply.body.application._id;

    const facultyNotifs = await listFor(faculty.token);
    expect(facultyNotifs.status).toBe(200);
    expect(facultyNotifs.body.notifications).toHaveLength(1);
    expect(facultyNotifs.body.notifications[0].type).toBe(
      "application.received"
    );

    // Faculty views (Applied → Viewed) then shortlists → the student is told.
    await request(app)
      .get(`/api/applications/${applicationId}`)
      .set("Authorization", `Bearer ${faculty.token}`);
    await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set("Authorization", `Bearer ${faculty.token}`)
      .send({ status: "Shortlisted" })
      .expect(200);

    const studentNotifs = await listFor(student.token);
    expect(studentNotifs.body.notifications).toHaveLength(1);
    expect(studentNotifs.body.notifications[0].type).toBe("application.status");

    // Each party sees only their own.
    expect((await unreadFor(student.token)).body.count).toBe(1);
    expect((await unreadFor(faculty.token)).body.count).toBe(1);
  });

  it("marks a notification read and drops the unread count", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);
    await applyTo(student.token, opportunity._id);

    const id = (await listFor(faculty.token)).body.notifications[0]._id;

    await request(app)
      .patch(`/api/notifications/${id}/read`)
      .set("Authorization", `Bearer ${faculty.token}`)
      .expect(200);

    expect((await unreadFor(faculty.token)).body.count).toBe(0);
  });

  it("does not let a user mark someone else's notification read", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);
    await applyTo(student.token, opportunity._id);

    const id = (await listFor(faculty.token)).body.notifications[0]._id;

    // The student "marks" the faculty's notification — the call succeeds
    // (idempotent) but must not actually touch it.
    await request(app)
      .patch(`/api/notifications/${id}/read`)
      .set("Authorization", `Bearer ${student.token}`)
      .expect(200);

    expect((await unreadFor(faculty.token)).body.count).toBe(1);
  });

  it("notifies coordinators when a faculty registers", async () => {
    const coordinator = await createCoordinator();
    await registerUser({
      email: "notifyprof@thapar.edu",
      role: "Faculty",
      department: "DCSE",
      employeeId: "EMP-2020",
    });

    const notifs = await listFor(coordinator.token);
    expect(
      notifs.body.notifications.some((n) => n.type === "faculty.pending")
    ).toBe(true);
  });

  it("deletes a single notification, owner-scoped", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);
    await applyTo(student.token, opportunity._id);

    const id = (await listFor(faculty.token)).body.notifications[0]._id;

    // A non-owner cannot delete it (owner-scoped no-op, still 200).
    await request(app)
      .delete(`/api/notifications/${id}`)
      .set("Authorization", `Bearer ${student.token}`)
      .expect(200);
    expect((await listFor(faculty.token)).body.notifications).toHaveLength(1);

    // The owner deletes it.
    await request(app)
      .delete(`/api/notifications/${id}`)
      .set("Authorization", `Bearer ${faculty.token}`)
      .expect(200);
    expect((await listFor(faculty.token)).body.notifications).toHaveLength(0);
  });

  it("clears all of the caller's notifications", async () => {
    const faculty = await asFaculty();
    const opportunity = await createOpportunity(faculty.token);
    const student = await asStudent();
    await applyTo(student.token, opportunity._id);
    const student2 = await registerAndLogin({
      email: "s2@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
    });
    await applyTo(student2.token, opportunity._id);

    expect(
      (await listFor(faculty.token)).body.notifications.length
    ).toBeGreaterThanOrEqual(2);

    await request(app)
      .delete("/api/notifications")
      .set("Authorization", `Bearer ${faculty.token}`)
      .expect(200);

    expect((await listFor(faculty.token)).body.notifications).toHaveLength(0);
    expect((await unreadFor(faculty.token)).body.count).toBe(0);
  });
});

// ── Messaging ─────────────────────────────────────────────────────

describe("messaging", () => {
  const auth = (token) => ({ Authorization: `Bearer ${token}` });

  // Drives an application to Shortlisted — the point a conversation may open.
  const setupShortlisted = async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);
    const apply = await applyTo(student.token, opportunity._id);
    const applicationId = apply.body.application._id;
    await request(app)
      .get(`/api/applications/${applicationId}`)
      .set(auth(faculty.token));
    await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set(auth(faculty.token))
      .send({ status: "Shortlisted" })
      .expect(200);
    return { faculty, student, opportunity, applicationId };
  };

  it("opens a conversation on a shortlisted applicant; both sides message", async () => {
    const { faculty, student, applicationId } = await setupShortlisted();

    const start = await request(app)
      .post("/api/conversations")
      .set(auth(faculty.token))
      .send({ applicationId, body: "Hi — are you free to discuss the role?" });
    expect(start.status).toBe(201);
    const convoId = start.body.conversation._id;

    // The student sees it in their inbox with one unread.
    const inbox = await request(app)
      .get("/api/conversations")
      .set(auth(student.token));
    expect(inbox.body.conversations).toHaveLength(1);
    expect(inbox.body.conversations[0].unread).toBe(1);

    // Opening the thread clears the reader's unread and lets them reply.
    const thread = await request(app)
      .get(`/api/conversations/${convoId}`)
      .set(auth(student.token));
    expect(thread.status).toBe(200);
    expect(thread.body.canSend).toBe(true);
    expect(thread.body.messages).toHaveLength(1);

    await request(app)
      .post(`/api/conversations/${convoId}/messages`)
      .set(auth(student.token))
      .send({ body: "Yes, this week works." })
      .expect(201);

    // The faculty member now has one unread, the thread has two messages.
    const facultyInbox = await request(app)
      .get("/api/conversations")
      .set(auth(faculty.token));
    expect(facultyInbox.body.conversations[0].unread).toBe(1);
  });

  it("refuses to open a conversation before the applicant is shortlisted", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);
    const apply = await applyTo(student.token, opportunity._id);

    const res = await request(app)
      .post("/api/conversations")
      .set(auth(faculty.token))
      .send({ applicationId: apply.body.application._id, body: "hi" });
    expect(res.status).toBe(400);
  });

  it("freezes the thread to read-only once the application is rejected", async () => {
    const { faculty, student, applicationId } = await setupShortlisted();
    const start = await request(app)
      .post("/api/conversations")
      .set(auth(faculty.token))
      .send({ applicationId, body: "Hello" });
    const convoId = start.body.conversation._id;

    await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set(auth(faculty.token))
      .send({ status: "Rejected" })
      .expect(200);

    // Sending is blocked...
    const send = await request(app)
      .post(`/api/conversations/${convoId}/messages`)
      .set(auth(student.token))
      .send({ body: "Are you still there?" });
    expect(send.status).toBe(403);

    // ...but the history is still readable.
    const thread = await request(app)
      .get(`/api/conversations/${convoId}`)
      .set(auth(student.token));
    expect(thread.status).toBe(200);
    expect(thread.body.canSend).toBe(false);
    expect(thread.body.messages).toHaveLength(1);
  });

  it("hides the conversation from non-participants, including coordinators", async () => {
    const { faculty, applicationId } = await setupShortlisted();
    const start = await request(app)
      .post("/api/conversations")
      .set(auth(faculty.token))
      .send({ applicationId, body: "Hi" });
    const convoId = start.body.conversation._id;

    const outsider = await registerAndLogin({
      email: "outsider@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
    });
    const coordinator = await createCoordinator();

    expect(
      (
        await request(app)
          .get(`/api/conversations/${convoId}`)
          .set(auth(outsider.token))
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/conversations/${convoId}`)
          .set(auth(coordinator.token))
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .post(`/api/conversations/${convoId}/messages`)
          .set(auth(outsider.token))
          .send({ body: "let me in" })
      ).status
    ).toBe(404);
  });

  it("notifies the recipient of a new message", async () => {
    const { faculty, student, applicationId } = await setupShortlisted();
    await request(app)
      .post("/api/conversations")
      .set(auth(faculty.token))
      .send({ applicationId, body: "Hello there" })
      .expect(201);

    const notifs = await request(app)
      .get("/api/notifications")
      .set(auth(student.token));
    expect(
      notifs.body.notifications.some((n) => n.type === "message.received")
    ).toBe(true);
  });
});

// ── Coordinator analytics ─────────────────────────────────────────

describe("coordinator analytics", () => {
  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  it("reports org-scoped KPIs, funnel, category and faculty breakdowns", async () => {
    const faculty = await asFaculty();
    const coordinator = await createCoordinator();

    // Two opportunities in two categories.
    const research = await createOpportunity(faculty.token); // default: Research
    await createOpportunity(faculty.token, {
      title: "Backend Internship Programme",
      category: "Internship",
    });

    // Two students; one is shortlisted, one stays applied.
    const student = await asStudent();
    const student2 = await registerAndLogin({
      email: "s2@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
    });

    const apply = await applyTo(student.token, research._id);
    const applicationId = apply.body.application._id;
    await request(app)
      .get(`/api/applications/${applicationId}`)
      .set(bearer(faculty.token));
    await request(app)
      .patch(`/api/applications/${applicationId}/status`)
      .set(bearer(faculty.token))
      .send({ status: "Shortlisted" })
      .expect(200);
    await applyTo(student2.token, research._id);

    // A pending faculty member.
    await registerUser({
      email: "pending@thapar.edu",
      role: "Faculty",
      department: "DCSE",
      employeeId: "EMP-7777",
    });

    const res = await request(app)
      .get("/api/admin/analytics")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    const a = res.body.analytics;

    expect(a.kpis.students).toBe(2);
    expect(a.kpis.activeFaculty).toBe(1);
    expect(a.kpis.pendingFaculty).toBe(1);
    expect(a.kpis.activeOpportunities).toBe(2);
    expect(a.kpis.totalApplications).toBe(2);

    expect(a.applicationFunnel.Applied).toBe(1);
    expect(a.applicationFunnel.Shortlisted).toBe(1);
    expect(a.applicationFunnel.Selected).toBe(0);

    expect(a.opportunitiesByCategory.Research).toBe(1);
    expect(a.opportunitiesByCategory.Internship).toBe(1);
    expect(a.opportunitiesByCategory["Paid Gig"]).toBe(0);

    expect(a.facultyByStatus.Active).toBe(1);
    expect(a.facultyByStatus.Pending).toBe(1);

    expect(a.topOpportunities[0].applications).toBe(2);
    expect(a.applicationsTrend).toHaveLength(30);
    expect(a.applicationsTrend.at(-1).count).toBe(2);
  });

  it("scopes analytics to the coordinator's own organization", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);
    await applyTo(student.token, opportunity._id);

    await Organization.create({
      name: "Other University",
      emailDomains: ["other.edu"],
    });
    const otherCoord = await createCoordinator("coord@other.edu", "other.edu");

    const res = await request(app)
      .get("/api/admin/analytics")
      .set(bearer(otherCoord.token));
    expect(res.status).toBe(200);
    expect(res.body.analytics.kpis.students).toBe(0);
    expect(res.body.analytics.kpis.activeOpportunities).toBe(0);
    expect(res.body.analytics.kpis.totalApplications).toBe(0);
  });

  it("forbids a non-coordinator from analytics", async () => {
    const student = await asStudent();
    const res = await request(app)
      .get("/api/admin/analytics")
      .set(bearer(student.token));
    expect(res.status).toBe(403);
  });

  it("lists the organization's faculty roster with dates and status", async () => {
    await asFaculty(); // an active faculty
    await registerUser({
      email: "pending@thapar.edu",
      role: "Faculty",
      department: "DCSE",
      employeeId: "EMP-8888",
    });
    const coordinator = await createCoordinator();

    const res = await request(app)
      .get("/api/admin/faculty")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(2);
    expect(res.body.faculty.map((f) => f.accountStatus).sort()).toEqual([
      "Active",
      "Pending",
    ]);
    expect(res.body.faculty[0]).toHaveProperty("createdAt");
  });

  it("lists the organization's students, paginated", async () => {
    await asFaculty();
    const coordinator = await createCoordinator();
    await asStudent();
    await registerAndLogin({
      email: "s2@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
    });

    const res = await request(app)
      .get("/api/admin/students?page=1&limit=20")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.students).toHaveLength(2);
    expect(res.body.hasMore).toBe(false);
  });

  it("forbids a non-coordinator from the roster endpoints", async () => {
    const student = await asStudent();
    expect(
      (await request(app).get("/api/admin/faculty").set(bearer(student.token)))
        .status
    ).toBe(403);
    expect(
      (await request(app).get("/api/admin/students").set(bearer(student.token)))
        .status
    ).toBe(403);
  });
});
