import request from "supertest";
import { describe, it, expect, beforeEach, vi } from "vitest";
import mongoose from "mongoose";

import { createApp } from "../app.js";
import Organization from "../models/Organization.js";
import User from "../models/User.js";
import Message from "../models/Message.js";
import Application from "../models/Application.js";
import Opportunity from "../models/Opportunity.js";
import AuditLog from "../models/AuditLog.js";
import { reconcileApplicationCounts } from "../scripts/reconcile.js";
import * as auditRepo from "../repositories/auditRepository.js";
import bcrypt from "bcryptjs";
import { verifyGoogleCredential } from "../config/googleClient.js";
import * as storage from "../lib/storage/index.js";
import { avatarKey, resumeKey } from "../lib/storage/keys.js";
import { ResilientStore } from "../middleware/resilientStore.js";
import { byUserThenIp, loginKeyGenerator } from "../middleware/rateLimiters.js";
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
    password: "Password@123",
    confirmPassword: "Password@123",
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

async function loginUser(email, password = "Password@123") {
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
  const passwordHash = await bcrypt.hash("Password@123", 10);
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
      password: "Password@123",
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
      password: "Password@123",
      confirmPassword: "Password@123",
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
      password: "Password@123",
      confirmPassword: "Password@123",
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

  it("rejects a password that lacks complexity", async () => {
    // Long enough (8+) but no uppercase, digit, or special character.
    const res = await request(app).post("/api/auth/register").send({
      name: "Weakpass",
      email: "weakpass@thapar.edu",
      password: "onlylowercase",
      confirmPassword: "onlylowercase",
      role: "Student",
      gender: "Male",
    });
    expect(res.status).toBe(400);
  });

  it("rejects a name that is not a real name", async () => {
    const res = await request(app).post("/api/auth/register").send({
      name: "12345",
      email: "numname@thapar.edu",
      password: "Password@123",
      confirmPassword: "Password@123",
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

  it("lets a coordinator post and manage an opportunity (Phase VMAX)", async () => {
    const coordinator = await createCoordinator();
    const student = await asStudent();

    // A coordinator can post — they own it via postedBy, so every downstream
    // ownership check treats them like the posting faculty.
    const opportunity = await createOpportunity(coordinator.token, {
      contactEmail: "coord@thapar.edu",
    });

    const apply = await applyTo(student.token, opportunity._id);
    expect(apply.status).toBe(201);

    // The owner (coordinator) can review the applicants.
    const applicants = await request(app)
      .get(`/api/applications/opportunity/${opportunity._id}`)
      .set("Authorization", `Bearer ${coordinator.token}`);
    expect(applicants.status).toBe(200);
    expect(applicants.body.count).toBe(1);
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

// ── Application count reconciliation ──────────────────────────────

describe("application count reconciliation", () => {
  it("heals a drifted applicationsCount after an out-of-band delete", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const opportunity = await createOpportunity(faculty.token);

    await applyTo(student.token, opportunity._id).expect(201);
    expect((await Opportunity.findById(opportunity._id)).applicationsCount).toBe(
      1
    );

    // An application removed directly (a maintenance script or hand edit)
    // bypasses the -1, leaving the denormalized counter stale.
    await Application.deleteMany({ opportunity: opportunity._id });
    expect((await Opportunity.findById(opportunity._id)).applicationsCount).toBe(
      1
    );

    // Reconciliation recomputes it from the real number of applications.
    const fixed = await reconcileApplicationCounts();
    expect(fixed).toBe(1);
    expect((await Opportunity.findById(opportunity._id)).applicationsCount).toBe(
      0
    );
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
      .send({ email: "newprof@thapar.edu", password: "Password@123" });
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
      .send({ email: "newprof@thapar.edu", password: "Password@123" });
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
      .send({ email: "badprof@thapar.edu", password: "Password@123" });
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

// ── Account moderation: ban / unban / remove ──────────────────────

describe("account moderation", () => {
  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  it("bans an active student, blocking login, with an audit entry and email", async () => {
    const coordinator = await createCoordinator();
    const student = await asStudent();

    const spy = vi.spyOn(emailTransport, "sendEmail").mockResolvedValue();

    const ban = await request(app)
      .patch(`/api/admin/users/${student.user.id}/ban`)
      .set(bearer(coordinator.token))
      .send({ reason: "Reported for harassment in messages" });
    expect(ban.status).toBe(200);
    expect(ban.body.user.accountStatus).toBe("Suspended");

    const blocked = await request(app)
      .post("/api/auth/login")
      .send({ email: "student@thapar.edu", password: "Password@123" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toMatch(/suspended/i);
    expect(blocked.body.message).toMatch(/coordinator/i);

    const entries = await AuditLog.find({ targetUser: student.user.id });
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe("user.banned");
    expect(entries[0].actor.toString()).toBe(coordinator.user.id);
    expect(entries[0].targetEmail).toBe("student@thapar.edu");
    expect(entries[0].reason).toBe("Reported for harassment in messages");

    expect(spy).toHaveBeenCalledTimes(1);
    const email = spy.mock.calls[0][0];
    expect(email.to).toBe("student@thapar.edu");
    expect(email.subject).toMatch(/suspended/i);
    expect(email.text).toContain("Reported for harassment in messages");
    spy.mockRestore();
  });

  it("blocks re-registration of a banned account with a specific message", async () => {
    const coordinator = await createCoordinator();
    const student = await asStudent();
    await request(app)
      .patch(`/api/admin/users/${student.user.id}/ban`)
      .set(bearer(coordinator.token))
      .send({ reason: "Policy violation" })
      .expect(200);

    const res = await request(app).post("/api/auth/register").send({
      name: "Test Person",
      email: "student@thapar.edu",
      password: "Password@123",
      confirmPassword: "Password@123",
      role: "Student",
      gender: "Male",
    });
    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/suspended/i);
    expect(res.body.message).toMatch(/coordinator/i);
  });

  it("unbans a suspended account, restoring login, with an audit entry and email", async () => {
    const coordinator = await createCoordinator();
    const student = await asStudent();
    await request(app)
      .patch(`/api/admin/users/${student.user.id}/ban`)
      .set(bearer(coordinator.token))
      .send({ reason: "Under review" })
      .expect(200);

    const spy = vi.spyOn(emailTransport, "sendEmail").mockResolvedValue();

    const unban = await request(app)
      .patch(`/api/admin/users/${student.user.id}/unban`)
      .set(bearer(coordinator.token));
    expect(unban.status).toBe(200);
    expect(unban.body.user.accountStatus).toBe("Active");

    const ok = await request(app)
      .post("/api/auth/login")
      .send({ email: "student@thapar.edu", password: "Password@123" });
    expect(ok.status).toBe(200);

    const entries = await AuditLog.find({
      targetUser: student.user.id,
      action: "user.unbanned",
    });
    expect(entries).toHaveLength(1);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0].subject).toMatch(/restored/i);
    spy.mockRestore();
  });

  it("rejects banning an account that is not currently active", async () => {
    const coordinator = await createCoordinator();
    await registerUser({
      email: "pendingprof@thapar.edu",
      role: "Faculty",
      department: "DCSE",
      employeeId: "EMP-BAN-1",
    });
    const pending = await User.findOne({ email: "pendingprof@thapar.edu" });

    const res = await request(app)
      .patch(`/api/admin/users/${pending._id}/ban`)
      .set(bearer(coordinator.token))
      .send({ reason: "Testing" });
    expect(res.status).toBe(400);
  });

  it("rejects unbanning an account that is not currently suspended", async () => {
    const coordinator = await createCoordinator();
    const student = await asStudent();

    const res = await request(app)
      .patch(`/api/admin/users/${student.user.id}/unban`)
      .set(bearer(coordinator.token));
    expect(res.status).toBe(400);
  });

  it("refuses to let a coordinator ban their own account", async () => {
    const coordinator = await createCoordinator();
    const res = await request(app)
      .patch(`/api/admin/users/${coordinator.user.id}/ban`)
      .set(bearer(coordinator.token))
      .send({ reason: "Testing" });
    expect(res.status).toBe(400);
  });

  it("refuses to let a coordinator ban a peer coordinator", async () => {
    const coordinator = await createCoordinator();
    const peer = await createCoordinator("peer@thapar.edu");

    const res = await request(app)
      .patch(`/api/admin/users/${peer.user.id}/ban`)
      .set(bearer(coordinator.token))
      .send({ reason: "Testing" });
    expect(res.status).toBe(400);
  });

  it("does not let a coordinator ban an account outside their organization", async () => {
    const student = await asStudent();
    await Organization.create({
      name: "Other University",
      emailDomains: ["other.edu"],
    });
    const otherCoord = await createCoordinator("coord@other.edu", "other.edu");

    const res = await request(app)
      .patch(`/api/admin/users/${student.user.id}/ban`)
      .set(bearer(otherCoord.token))
      .send({ reason: "Testing" });
    expect(res.status).toBe(404);
  });

  it("rolls back the ban if writing the audit entry fails", async () => {
    const coordinator = await createCoordinator();
    const student = await asStudent();

    const spy = vi
      .spyOn(auditRepo, "record")
      .mockRejectedValueOnce(new Error("audit write failed"));

    const res = await request(app)
      .patch(`/api/admin/users/${student.user.id}/ban`)
      .set(bearer(coordinator.token))
      .send({ reason: "Testing" });
    expect(res.status).toBe(500);

    spy.mockRestore();

    const stillActive = await User.findById(student.user.id);
    expect(stillActive.accountStatus).toBe("Active");
    expect(await AuditLog.countDocuments({ targetUser: student.user.id })).toBe(
      0
    );
  });

  it("requires a reason to ban or remove an account", async () => {
    const coordinator = await createCoordinator();
    const student = await asStudent();

    const ban = await request(app)
      .patch(`/api/admin/users/${student.user.id}/ban`)
      .set(bearer(coordinator.token))
      .send({});
    expect(ban.status).toBe(400);

    const remove = await request(app)
      .delete(`/api/admin/users/${student.user.id}`)
      .set(bearer(coordinator.token))
      .send({});
    expect(remove.status).toBe(400);
  });

  it("forbids a non-coordinator from every moderation endpoint", async () => {
    const student = await asStudent();
    const other = await registerAndLogin({
      email: "other@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
    });

    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${student.user.id}/ban`)
          .set(bearer(other.token))
          .send({ reason: "x" })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/admin/users/${student.user.id}/unban`)
          .set(bearer(other.token))
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .delete(`/api/admin/users/${student.user.id}`)
          .set(bearer(other.token))
          .send({ reason: "x" })
      ).status
    ).toBe(403);
  });

  it("removes an account, cascading its footprint, with a permanent audit record and email", async () => {
    const coordinator = await createCoordinator();
    const faculty = await asFaculty();
    const opportunity = await createOpportunity(faculty.token);
    const student = await asStudent();
    await applyTo(student.token, opportunity._id).expect(201);

    expect(await Application.countDocuments({ student: student.user.id })).toBe(
      1
    );

    const spy = vi.spyOn(emailTransport, "sendEmail").mockResolvedValue();

    const remove = await request(app)
      .delete(`/api/admin/users/${student.user.id}`)
      .set(bearer(coordinator.token))
      .send({ reason: "Requested account deletion" });
    expect(remove.status).toBe(200);
    expect(remove.body.removed.applications).toBe(1);

    // The student's footprint is gone.
    expect(await User.findById(student.user.id)).toBeNull();
    expect(await Application.countDocuments({ student: student.user.id })).toBe(
      0
    );

    // The audit entry survives the deletion, and stays readable via its
    // snapshot — the same ghost-record problem already fixed once for
    // messaging, now guarded against for the audit trail too.
    const entries = await AuditLog.find({
      action: "user.deleted",
      targetEmail: "student@thapar.edu",
    });
    expect(entries).toHaveLength(1);
    expect(entries[0].targetName).toBe("Test Person");
    expect(entries[0].reason).toBe("Requested account deletion");

    // The email used the name/email captured before deletion.
    expect(spy).toHaveBeenCalledTimes(1);
    const email = spy.mock.calls[0][0];
    expect(email.to).toBe("student@thapar.edu");
    expect(email.subject).toMatch(/removed/i);
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

// ── Rate-limit key generators ──────────────────────────────────────
// Rate limiting itself is skipped under NODE_ENV=test (setup.js), so these
// exercise the exported keying functions directly, the same technique already
// used for ResilientStore above — proving two different real users never share
// a rate-limit budget just because they share an IP (the campus-NAT problem),
// while an anonymous request still falls back to a real, per-IP key.

describe("rate-limit key generators", () => {
  it("byUserThenIp keys by the authenticated user, not the shared IP", () => {
    const sameIp = "10.0.0.5";
    const reqA = { user: { id: "user-a" }, ip: sameIp };
    const reqB = { user: { id: "user-b" }, ip: sameIp };

    const keyA = byUserThenIp(reqA);
    const keyB = byUserThenIp(reqB);

    expect(keyA).toBe("user-a");
    expect(keyB).toBe("user-b");
    expect(keyA).not.toBe(keyB);
  });

  it("byUserThenIp falls back to req.rateLimitUserId when req.user is absent", () => {
    const req = { rateLimitUserId: "soft-identified-user", ip: "10.0.0.5" };
    expect(byUserThenIp(req)).toBe("soft-identified-user");
  });

  it("byUserThenIp falls back to a real per-IP key for an anonymous request", () => {
    const req = { ip: "203.0.113.7" };
    expect(byUserThenIp(req)).toBe("203.0.113.7");
  });

  it("loginKeyGenerator keys by the attempted email, case- and whitespace-insensitively", () => {
    const sameIp = "10.0.0.5";
    const reqAlice = { body: { email: "Alice@Thapar.edu " }, ip: sameIp };
    const reqBob = { body: { email: "bob@thapar.edu" }, ip: sameIp };

    expect(loginKeyGenerator(reqAlice)).toBe("alice@thapar.edu");
    expect(loginKeyGenerator(reqBob)).toBe("bob@thapar.edu");
    expect(loginKeyGenerator(reqAlice)).not.toBe(loginKeyGenerator(reqBob));
  });

  it("loginKeyGenerator falls back to IP when the body has no usable email", () => {
    const req = { body: {}, ip: "203.0.113.7" };
    expect(loginKeyGenerator(req)).toBe("203.0.113.7");
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

  it("lets a participant delete the conversation and cascades its messages", async () => {
    const { faculty, student, applicationId } = await setupShortlisted();
    const start = await request(app)
      .post("/api/conversations")
      .set(auth(faculty.token))
      .send({ applicationId, body: "First message" });
    const convoId = start.body.conversation._id;

    // A reply, so the cascade has more than one message to remove.
    await request(app)
      .post(`/api/conversations/${convoId}/messages`)
      .set(auth(student.token))
      .send({ body: "A reply" })
      .expect(201);
    expect(await Message.countDocuments({ conversationId: convoId })).toBe(2);

    // A participant (the student) deletes it.
    await request(app)
      .delete(`/api/conversations/${convoId}`)
      .set(auth(student.token))
      .expect(200);

    // Gone for both sides, and its messages were cascaded away.
    expect(
      (
        await request(app)
          .get(`/api/conversations/${convoId}`)
          .set(auth(faculty.token))
      ).status
    ).toBe(404);
    expect(await Message.countDocuments({ conversationId: convoId })).toBe(0);
  });

  it("does not let a non-participant delete a conversation", async () => {
    const { faculty, applicationId } = await setupShortlisted();
    const start = await request(app)
      .post("/api/conversations")
      .set(auth(faculty.token))
      .send({ applicationId, body: "Private" });
    const convoId = start.body.conversation._id;

    const outsider = await registerAndLogin({
      email: "outsider@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
    });

    await request(app)
      .delete(`/api/conversations/${convoId}`)
      .set(auth(outsider.token))
      .expect(404);

    // Still there for its participants.
    expect(
      (
        await request(app)
          .get(`/api/conversations/${convoId}`)
          .set(auth(faculty.token))
      ).status
    ).toBe(200);
  });

  it("blocks messaging once the other participant is deleted", async () => {
    const { faculty, applicationId } = await setupShortlisted();
    const start = await request(app)
      .post("/api/conversations")
      .set(auth(faculty.token))
      .send({ applicationId, body: "Hello" });
    const convoId = start.body.conversation._id;

    // The student's account is removed directly, as an operator might.
    await User.deleteOne({ email: "student@thapar.edu" });

    // Sending into the void is refused rather than silently succeeding.
    const res = await request(app)
      .post(`/api/conversations/${convoId}/messages`)
      .set(auth(faculty.token))
      .send({ body: "Are you there?" });
    expect(res.status).toBe(410);
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

    // The funnel is cumulative ("reached at least this stage"): both
    // applications reached Applied, so it reads 2, not the 1 that's
    // currently *sitting* in Applied — that's awaitingFirstReview below.
    expect(a.applicationFunnel.Applied).toBe(2);
    expect(a.applicationFunnel.Shortlisted).toBe(1);
    expect(a.applicationFunnel.Selected).toBe(0);
    expect(a.awaitingFirstReview).toBe(1);

    expect(a.opportunitiesByCategory.Research).toBe(1);
    expect(a.opportunitiesByCategory.Internship).toBe(1);
    expect(a.opportunitiesByCategory["Paid Gig"]).toBe(0);

    expect(a.facultyByStatus.Active).toBe(1);
    expect(a.facultyByStatus.Pending).toBe(1);

    expect(a.topOpportunities[0].applications).toBe(2);
    expect(a.topOpportunities[0].category).toBe("Research");
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
    expect(res.body.capped).toBe(false);
    expect(res.body.faculty.map((f) => f.accountStatus).sort()).toEqual([
      "Active",
      "Pending",
    ]);
    expect(res.body.faculty[0]).toHaveProperty("createdAt");
  });

  it("caps the faculty roster and reports when results were truncated", async () => {
    const coordinator = await createCoordinator();
    const org = await Organization.findOne({ emailDomains: "thapar.edu" });
    const passwordHash = await bcrypt.hash("Password@123", 10);

    // Bulk-inserted directly — 2,001 real registrations through the HTTP API
    // would be far too slow for a test; the cap logic only cares about row
    // count, not how the rows got there.
    const docs = Array.from({ length: 2001 }, (_, i) => ({
      organizationId: org._id,
      name: `Bulk Faculty ${i}`,
      email: `bulk-faculty-${i}@thapar.edu`,
      password: passwordHash,
      role: "Faculty",
      gender: "Other",
      accountStatus: "Active",
      department: "DCSE",
    }));
    await User.insertMany(docs);

    const res = await request(app)
      .get("/api/admin/faculty")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.capped).toBe(true);
    expect(res.body.faculty).toHaveLength(2000);
    expect(res.body.count).toBe(2000);
  });

  it("annotates each faculty member with how many opportunities they currently have posted", async () => {
    const faculty = await asFaculty();
    await registerUser({
      email: "pending@thapar.edu",
      role: "Faculty",
      department: "DCSE",
      employeeId: "EMP-8888",
    });
    const coordinator = await createCoordinator();

    await createOpportunity(faculty.token, { title: "Posting One" });
    await createOpportunity(faculty.token, { title: "Posting Two" });

    const res = await request(app)
      .get("/api/admin/faculty")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    const active = res.body.faculty.find((f) => f.accountStatus === "Active");
    const pending = res.body.faculty.find((f) => f.accountStatus === "Pending");
    expect(active.opportunitiesPosted).toBe(2);
    expect(pending.opportunitiesPosted).toBe(0);
  });

  it("returns a faculty member's detail card with all-time postings and applications, not scoped to any date range", async () => {
    const faculty = await asFaculty();
    const coordinator = await createCoordinator();

    const opp = await createOpportunity(faculty.token, { title: "Old Posting" });
    // Backdated well outside any leaderboard range — the detail card must
    // still count it, unlike the range-scoped leaderboard. Mongoose's
    // timestamps option silently ignores a user-supplied createdAt on
    // Model#updateOne, so this goes through the raw driver instead (same
    // reason setCreatedAt exists in the Phase 1 additions block below).
    await mongoose.connection
      .collection("opportunities")
      .updateOne({ _id: opp._id }, { $set: { createdAt: new Date("2020-01-01") } });
    const student = await asStudent();
    await applyTo(student.token, opp._id);

    const res = await request(app)
      .get(`/api/admin/faculty/${faculty.user.id}`)
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.faculty).toMatchObject({
      name: "Test Person",
      department: "DCSE",
      accountStatus: "Active",
      employeeId: "EMP-1001",
      opportunitiesPosted: 1,
      applicationsReceived: 1,
    });
    expect(res.body.faculty).toHaveProperty("office");
  });

  it("404s the faculty detail route for a student id or a non-existent id", async () => {
    const coordinator = await createCoordinator();
    const student = await asStudent();

    const asStudentId = await request(app)
      .get(`/api/admin/faculty/${student.user.id}`)
      .set(bearer(coordinator.token));
    expect(asStudentId.status).toBe(404);

    const fakeId = new mongoose.Types.ObjectId().toString();
    const missing = await request(app)
      .get(`/api/admin/faculty/${fakeId}`)
      .set(bearer(coordinator.token));
    expect(missing.status).toBe(404);
  });

  it("scopes the faculty detail route to the coordinator's own organization", async () => {
    const faculty = await asFaculty();

    await Organization.create({
      name: "Other University",
      emailDomains: ["other.edu"],
    });
    const otherCoord = await createCoordinator("coord@other.edu", "other.edu");

    const res = await request(app)
      .get(`/api/admin/faculty/${faculty.user.id}`)
      .set(bearer(otherCoord.token));
    expect(res.status).toBe(404);
  });

  it("forbids a non-coordinator from the faculty detail route", async () => {
    const faculty = await asFaculty();
    const student = await asStudent();
    const res = await request(app)
      .get(`/api/admin/faculty/${faculty.user.id}`)
      .set(bearer(student.token));
    expect(res.status).toBe(403);
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
    // accountStatus must be projected — the coordinator UI's ban/unban row
    // actions decide what to show per student from this exact field.
    expect(res.body.students[0]).toHaveProperty("accountStatus", "Active");
  });

  it("filters the student roster by gender and by year", async () => {
    const coordinator = await createCoordinator();
    await registerAndLogin({
      email: "male-y2@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
      gender: "Male",
    });
    await registerAndLogin({
      email: "female-y3@thapar.edu",
      role: "Student",
      branch: "CSE",
      year: 3,
      gender: "Female",
    });

    const byGender = await request(app)
      .get("/api/admin/students?gender=Female")
      .set(bearer(coordinator.token));
    expect(byGender.status).toBe(200);
    expect(byGender.body.total).toBe(1);
    expect(byGender.body.students[0].email).toBe("female-y3@thapar.edu");

    const byYear = await request(app)
      .get("/api/admin/students?year=2")
      .set(bearer(coordinator.token));
    expect(byYear.status).toBe(200);
    expect(byYear.body.total).toBe(1);
    expect(byYear.body.students[0].email).toBe("male-y2@thapar.edu");

    const byBranch = await request(app)
      .get("/api/admin/students?branch=CSE")
      .set(bearer(coordinator.token));
    expect(byBranch.status).toBe(200);
    expect(byBranch.body.total).toBe(1);
    expect(byBranch.body.students[0].email).toBe("female-y3@thapar.edu");

    // Composes with year — branch alone isn't the whole story.
    const byBranchAndYear = await request(app)
      .get("/api/admin/students?branch=COE&year=2")
      .set(bearer(coordinator.token));
    expect(byBranchAndYear.status).toBe(200);
    expect(byBranchAndYear.body.total).toBe(1);
    expect(byBranchAndYear.body.students[0].email).toBe("male-y2@thapar.edu");
  });

  it("reports the distinct branches actually in use, sorted, excluding blanks", async () => {
    const coordinator = await createCoordinator();
    await registerAndLogin({
      email: "s1@thapar.edu", role: "Student", branch: "Mechanical", year: 1,
    });
    await registerAndLogin({
      email: "s2@thapar.edu", role: "Student", branch: "COE", year: 1,
    });
    // No branch given — registerUser's payload omits it entirely, so this
    // student must not produce a blank entry in the branch list.
    await registerAndLogin({ email: "s3@thapar.edu", role: "Student", year: 1 });

    const res = await request(app)
      .get("/api/admin/students/branches")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.branches).toEqual(["COE", "Mechanical"]);
  });

  it("year-counts composes with a branch filter", async () => {
    const coordinator = await createCoordinator();
    await registerAndLogin({
      email: "coe-y1@thapar.edu", role: "Student", branch: "COE", year: 1,
    });
    await registerAndLogin({
      email: "cse-y1@thapar.edu", role: "Student", branch: "CSE", year: 1,
    });

    const res = await request(app)
      .get("/api/admin/students/year-counts?branch=COE")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0 });
  });

  it("reports student counts by year, optionally scoped to one gender", async () => {
    const coordinator = await createCoordinator();
    await registerAndLogin({
      email: "a@thapar.edu", role: "Student", branch: "COE", year: 1, gender: "Male",
    });
    await registerAndLogin({
      email: "b@thapar.edu", role: "Student", branch: "COE", year: 1, gender: "Female",
    });
    await registerAndLogin({
      email: "c@thapar.edu", role: "Student", branch: "COE", year: 4, gender: "Male",
    });

    const all = await request(app)
      .get("/api/admin/students/year-counts")
      .set(bearer(coordinator.token));
    expect(all.status).toBe(200);
    expect(all.body.counts).toEqual({ 1: 2, 2: 0, 3: 0, 4: 1 });

    const femaleOnly = await request(app)
      .get("/api/admin/students/year-counts?gender=Female")
      .set(bearer(coordinator.token));
    expect(femaleOnly.body.counts).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0 });
  });

  it("rejects unrecognised gender/year values on the student roster and year-counts routes", async () => {
    const coordinator = await createCoordinator();
    const routes = [
      "/api/admin/students?gender=NotAGender",
      "/api/admin/students?year=5",
      "/api/admin/students?year=0",
      "/api/admin/students/year-counts?gender=NotAGender",
    ];
    for (const url of routes) {
      const res = await request(app).get(url).set(bearer(coordinator.token));
      expect(res.status).toBe(400);
    }
  });

  it("forbids a non-coordinator from the student year-counts route", async () => {
    const student = await asStudent();
    const res = await request(app)
      .get("/api/admin/students/year-counts")
      .set(bearer(student.token));
    expect(res.status).toBe(403);
  });

  it("scopes student year-counts to the coordinator's own organization", async () => {
    await registerAndLogin({
      email: "own-org@thapar.edu", role: "Student", branch: "COE", year: 2, gender: "Male",
    });
    await Organization.create({
      name: "Other University",
      emailDomains: ["other.edu"],
    });
    const otherCoord = await createCoordinator("coord@other.edu", "other.edu");

    const res = await request(app)
      .get("/api/admin/students/year-counts")
      .set(bearer(otherCoord.token));
    expect(res.status).toBe(200);
    expect(res.body.counts).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0 });
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

// ── Coordinator analytics: Phase 1 additions ─────────────────────────
// Funnel-by-category, category demand, faculty activity (Month / Year-to-Date
// / topN), student engagement (by year / by category / gender), and the new
// opportunities listing — plus the security properties every one of them must
// hold: strict allow-list validation (rejecting both nonsense values and
// bracket-injection attempts), coordinator-only access, and organization
// scoping.
describe("coordinator analytics — Phase 1 additions", () => {
  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  const MONTH_ABBR = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  const monthToken = (date) => `${MONTH_ABBR[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  const monthsAgo = (n) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() - n);
    return d;
  };

  // Mongoose's `timestamps: true` schema option silently strips a
  // user-supplied createdAt from Model#updateOne (it still reports
  // modifiedCount: 1, from touching updatedAt, but createdAt itself never
  // changes) — so backdating a fixture for these range tests has to go
  // through the raw driver, bypassing Mongoose's Model/hook layer entirely.
  const setCreatedAt = (id, date) =>
    mongoose.connection
      .collection("opportunities")
      .updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        { $set: { createdAt: date } }
      );

  const asFaculty2 = async () => {
    await registerUser({
      email: "prof2@thapar.edu",
      role: "Faculty",
      department: "DME",
      employeeId: "EMP-1002",
    });
    await User.updateOne(
      { email: "prof2@thapar.edu" },
      { accountStatus: "Active" }
    );
    return loginUser("prof2@thapar.edu");
  };

  const asFaculty3 = async () => {
    await registerUser({
      email: "prof3@thapar.edu",
      role: "Faculty",
      department: "DEE",
      employeeId: "EMP-1003",
    });
    await User.updateOne(
      { email: "prof3@thapar.edu" },
      { accountStatus: "Active" }
    );
    return loginUser("prof3@thapar.edu");
  };

  it("scopes the application funnel to a single category", async () => {
    const faculty = await asFaculty();
    const coordinator = await createCoordinator();
    const research = await createOpportunity(faculty.token); // default: Research
    const internship = await createOpportunity(faculty.token, {
      title: "Backend Internship Programme",
      category: "Internship",
    });

    const student = await asStudent();
    const apply = await applyTo(student.token, research._id);
    await request(app)
      .patch(`/api/applications/${apply.body.application._id}/status`)
      .set(bearer(faculty.token))
      .send({ status: "Shortlisted" })
      .expect(200);

    const student2 = await registerAndLogin({
      email: "s2@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 3,
    });
    await applyTo(student2.token, internship._id);

    const researchRes = await request(app)
      .get("/api/admin/analytics/funnel?category=Research")
      .set(bearer(coordinator.token));
    expect(researchRes.status).toBe(200);
    expect(researchRes.body.funnel.Shortlisted).toBe(1);
    // Cumulative: the one Research application reached Shortlisted, so it
    // also reached Applied (and Viewed) on the way there, even though it
    // skipped an explicit Viewed status (Applied → Shortlisted is a legal
    // direct transition) — it must never read 0 here.
    expect(researchRes.body.funnel.Applied).toBe(1);

    const internshipRes = await request(app)
      .get("/api/admin/analytics/funnel?category=Internship")
      .set(bearer(coordinator.token));
    expect(internshipRes.body.funnel.Applied).toBe(1);
    expect(internshipRes.body.funnel.Shortlisted).toBe(0);

    // Unscoped call combines both categories' applications.
    const allRes = await request(app)
      .get("/api/admin/analytics/funnel")
      .set(bearer(coordinator.token));
    expect(allRes.body.funnel.Applied).toBe(2);
    expect(allRes.body.funnel.Shortlisted).toBe(1);
  });

  it("never shows an earlier funnel stage as 0 while a later stage is non-zero, even when Viewed was skipped entirely", async () => {
    const faculty = await asFaculty();
    const coordinator = await createCoordinator();
    const opp = await createOpportunity(faculty.token);

    // Two applications, both taken straight from Applied to Selected without
    // ever passing through an explicit Viewed status (Applied → Shortlisted
    // → Selected are both legal direct transitions) — the exact shape that
    // previously produced Applied: 0, Viewed: 0, Shortlisted: 0, Selected: 2.
    for (const email of ["sel1@thapar.edu", "sel2@thapar.edu"]) {
      const student = await registerAndLogin({
        email,
        role: "Student",
        branch: "COE",
        year: 2,
      });
      const apply = await applyTo(student.token, opp._id);
      const id = apply.body.application._id;
      await request(app)
        .patch(`/api/applications/${id}/status`)
        .set(bearer(faculty.token))
        .send({ status: "Shortlisted" })
        .expect(200);
      await request(app)
        .patch(`/api/applications/${id}/status`)
        .set(bearer(faculty.token))
        .send({ status: "Selected" })
        .expect(200);
    }

    const res = await request(app)
      .get("/api/admin/analytics/funnel")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    const { funnel } = res.body;
    expect(funnel).toEqual({
      Applied: 2,
      Viewed: 2,
      Shortlisted: 2,
      Selected: 2,
      Rejected: 0,
      Withdrawn: 0,
    });
    // Monotonically non-increasing down the main funnel path, by construction.
    expect(funnel.Applied).toBeGreaterThanOrEqual(funnel.Viewed);
    expect(funnel.Viewed).toBeGreaterThanOrEqual(funnel.Shortlisted);
    expect(funnel.Shortlisted).toBeGreaterThanOrEqual(funnel.Selected);
  });

  it("reports category demand as postings vs. applications", async () => {
    const faculty = await asFaculty();
    const coordinator = await createCoordinator();
    const research = await createOpportunity(faculty.token);
    await createOpportunity(faculty.token, {
      title: "Backend Internship Programme",
      category: "Internship",
    });
    const student = await asStudent();
    await applyTo(student.token, research._id);

    const res = await request(app)
      .get("/api/admin/analytics/category-demand")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    const byCategory = Object.fromEntries(
      res.body.demand.map((d) => [d.category, d])
    );
    expect(byCategory.Research).toEqual({
      category: "Research",
      postings: 1,
      applications: 1,
    });
    expect(byCategory.Internship).toEqual({
      category: "Internship",
      postings: 1,
      applications: 0,
    });
    expect(byCategory["Paid Gig"]).toEqual({
      category: "Paid Gig",
      postings: 0,
      applications: 0,
    });
  });

  it("reports faculty activity for the requested month only", async () => {
    const facultyA = await asFaculty();
    const facultyB = await asFaculty2();
    const coordinator = await createCoordinator();

    const oppA = await createOpportunity(facultyA.token, {
      title: "This Month's Posting",
    });
    await setCreatedAt(oppA._id, new Date());

    const oppB = await createOpportunity(facultyB.token, {
      title: "Two Months Ago Posting",
    });
    await setCreatedAt(oppB._id, monthsAgo(2));

    const student = await asStudent();
    await applyTo(student.token, oppA._id);

    const thisMonth = monthToken(new Date());
    const res = await request(app)
      .get(
        `/api/admin/analytics/faculty-activity?mode=month&month=${encodeURIComponent(
          thisMonth
        )}`
      )
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.faculty).toHaveLength(1);
    expect(res.body.faculty[0].postings).toBe(1);
    expect(res.body.faculty[0].apps).toBe(1);
  });

  it("excludes postings from before the current year under Year to Date", async () => {
    const facultyA = await asFaculty();
    const coordinator = await createCoordinator();

    const recent = await createOpportunity(facultyA.token, {
      title: "Recent Posting",
    });
    await setCreatedAt(recent._id, new Date());

    const stale = await createOpportunity(facultyA.token, {
      title: "Last Year's Posting",
    });
    await setCreatedAt(stale._id, monthsAgo(13));

    const res = await request(app)
      .get("/api/admin/analytics/faculty-activity?mode=ytd")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.faculty).toHaveLength(1);
    expect(res.body.faculty[0].postings).toBe(1);
  });

  it("caps the faculty-activity leaderboard at the requested topN", async () => {
    const facultyA = await asFaculty();
    const facultyB = await asFaculty2();
    const facultyC = await asFaculty3();
    const coordinator = await createCoordinator();

    for (const f of [facultyA, facultyB, facultyC]) {
      const opp = await createOpportunity(f.token, {
        title: `Posting by ${f.user.email}`,
      });
      await setCreatedAt(opp._id, new Date());
    }

    const res = await request(app)
      .get("/api/admin/analytics/faculty-activity?mode=ytd&topN=2")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.faculty).toHaveLength(2);
    // `participation` reflects everyone who posted, not just the capped
    // leaderboard — otherwise "3 of 12 posted" would be unrecoverable once
    // topN trims the list to 2.
    expect(res.body.participation).toBe(3);
  });

  it("ranks the leaderboard by postings or by applications, per sortBy", async () => {
    const facultyA = await asFaculty(); // department: DCSE
    const facultyB = await asFaculty2(); // department: DME
    const coordinator = await createCoordinator();

    // Faculty A: one posting, three applications.
    const oppA = await createOpportunity(facultyA.token, { title: "High-demand posting" });
    await setCreatedAt(oppA._id, new Date());
    const s1 = await asStudent();
    const s2 = await registerAndLogin({
      email: "s2@thapar.edu", role: "Student", branch: "COE", year: 2,
    });
    const s3 = await registerAndLogin({
      email: "s3@thapar.edu", role: "Student", branch: "COE", year: 2,
    });
    await applyTo(s1.token, oppA._id);
    await applyTo(s2.token, oppA._id);
    await applyTo(s3.token, oppA._id);

    // Faculty B: two postings, no applications.
    const oppB1 = await createOpportunity(facultyB.token, { title: "Posting B1" });
    await setCreatedAt(oppB1._id, new Date());
    const oppB2 = await createOpportunity(facultyB.token, { title: "Posting B2" });
    await setCreatedAt(oppB2._id, new Date());

    const byApps = await request(app)
      .get("/api/admin/analytics/faculty-activity?mode=ytd")
      .set(bearer(coordinator.token));
    expect(byApps.body.faculty[0].department).toBe("DCSE");

    const byPostings = await request(app)
      .get("/api/admin/analytics/faculty-activity?mode=ytd&sortBy=postings")
      .set(bearer(coordinator.token));
    expect(byPostings.body.faculty[0].department).toBe("DME");
  });

  it("rejects an unrecognised sortBy value", async () => {
    const coordinator = await createCoordinator();
    const res = await request(app)
      .get("/api/admin/analytics/faculty-activity?sortBy=nonsense")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(400);
  });

  it("scopes student engagement to a gender", async () => {
    const faculty = await asFaculty();
    const coordinator = await createCoordinator();
    const opp = await createOpportunity(faculty.token);

    const male = await asStudent(); // default gender: Male, year 2
    const female = await registerAndLogin({
      email: "f-student@thapar.edu",
      role: "Student",
      branch: "COE",
      year: 2,
      gender: "Female",
    });
    await applyTo(male.token, opp._id);
    await applyTo(female.token, opp._id);

    const all = await request(app)
      .get("/api/admin/analytics/student-engagement")
      .set(bearer(coordinator.token));
    expect(all.status).toBe(200);
    expect(all.body.engagement.byYear[2]).toBe(2);
    expect(all.body.engagement.byCategory.Research).toBe(2);

    const femaleOnly = await request(app)
      .get("/api/admin/analytics/student-engagement?gender=Female")
      .set(bearer(coordinator.token));
    expect(femaleOnly.body.engagement.byYear[2]).toBe(1);
    expect(femaleOnly.body.engagement.byCategory.Research).toBe(1);
  });

  it("lists opportunities with the poster's name, filterable and sortable", async () => {
    const faculty = await asFaculty();
    const coordinator = await createCoordinator();

    await createOpportunity(faculty.token, {
      title: "Closing Soon",
      deadline: futureISO(2),
    });
    await createOpportunity(faculty.token, {
      title: "Closing Later",
      category: "Internship",
      deadline: futureISO(20),
    });

    const listAll = await request(app)
      .get("/api/admin/opportunities")
      .set(bearer(coordinator.token));
    expect(listAll.status).toBe(200);
    expect(listAll.body.count).toBe(2);
    expect(listAll.body.capped).toBe(false);
    expect(listAll.body.opportunities[0]).toHaveProperty(
      "postedBy",
      "Test Person"
    );

    const byCategory = await request(app)
      .get("/api/admin/opportunities?category=Internship")
      .set(bearer(coordinator.token));
    expect(byCategory.body.count).toBe(1);
    expect(byCategory.body.opportunities[0].title).toBe("Closing Later");

    const byDeadline = await request(app)
      .get("/api/admin/opportunities?sort=deadline")
      .set(bearer(coordinator.token));
    expect(byDeadline.body.opportunities.map((o) => o.title)).toEqual([
      "Closing Soon",
      "Closing Later",
    ]);
  });

  it("caps the opportunities listing and reports when results were truncated", async () => {
    const faculty = await asFaculty();
    const coordinator = await createCoordinator();
    const org = await Organization.findOne({ emailDomains: "thapar.edu" });
    const facultyUser = await User.findOne({ email: "prof@thapar.edu" });

    // Bulk-inserted directly, same reasoning as the faculty-roster cap test:
    // 2,001 real postings through the HTTP API would be far too slow here.
    const docs = Array.from({ length: 2001 }, (_, i) => ({
      organizationId: org._id,
      title: `Bulk Opportunity ${i}`,
      description: "Bulk-seeded directly for the listing cap test.",
      category: "Research",
      postedBy: facultyUser._id,
      eligibleBranches: ["All"],
      eligibleYears: ["All"],
      eligibleGender: "Any",
      contactEmail: "prof@thapar.edu",
      deadline: futureISO(30),
      status: "Active",
    }));
    await Opportunity.insertMany(docs);

    const res = await request(app)
      .get("/api/admin/opportunities")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(200);
    expect(res.body.capped).toBe(true);
    expect(res.body.opportunities).toHaveLength(2000);
    expect(res.body.count).toBe(2000);
  });

  it("rejects unrecognised filter values on the new analytics routes", async () => {
    const coordinator = await createCoordinator();
    const routes = [
      "/api/admin/analytics/funnel?category=NotACategory",
      "/api/admin/opportunities?status=NotAStatus",
      "/api/admin/opportunities?sort=NotASort",
      "/api/admin/analytics/student-engagement?gender=NotAGender",
      "/api/admin/analytics/faculty-activity?mode=NotAMode",
      "/api/admin/analytics/faculty-activity?mode=month&month=NotAMonth",
      // topN outside the allowed range.
      "/api/admin/analytics/faculty-activity?mode=ytd&topN=1000",
    ];
    for (const url of routes) {
      const res = await request(app).get(url).set(bearer(coordinator.token));
      expect(res.status).toBe(400);
    }
  });

  it("rejects a query value that doesn't match the expected shape", async () => {
    const coordinator = await createCoordinator();
    // Express 5's default query parser is "simple" (Node's querystring), not
    // the older "extended" (qs) parser — a bracketed key like
    // "category[$ne]=null" is not nested into an object here, it's just a
    // literal (harmless) key named "category[$ne]". The shape this parser
    // *does* produce unexpectedly is an array, from a repeated key — and the
    // allow-list (Joi .string().valid(...)) must reject that too, not just a
    // wrong value.
    const res = await request(app)
      .get("/api/admin/analytics/funnel?category=Research&category=Internship")
      .set(bearer(coordinator.token));
    expect(res.status).toBe(400);
  });

  it("forbids a non-coordinator from every new analytics/opportunities route", async () => {
    const student = await asStudent();
    const routes = [
      "/api/admin/analytics/funnel",
      "/api/admin/analytics/category-demand",
      "/api/admin/analytics/faculty-activity",
      "/api/admin/analytics/student-engagement",
      "/api/admin/opportunities",
    ];
    for (const url of routes) {
      const res = await request(app).get(url).set(bearer(student.token));
      expect(res.status).toBe(403);
    }
  });

  it("scopes the new analytics/opportunities routes to the coordinator's own organization", async () => {
    const faculty = await asFaculty();
    const opportunity = await createOpportunity(faculty.token);
    const student = await asStudent();
    await applyTo(student.token, opportunity._id);

    await Organization.create({
      name: "Other University",
      emailDomains: ["other.edu"],
    });
    const otherCoord = await createCoordinator("coord@other.edu", "other.edu");

    const funnel = await request(app)
      .get("/api/admin/analytics/funnel")
      .set(bearer(otherCoord.token));
    expect(funnel.body.funnel.Applied).toBe(0);

    const demand = await request(app)
      .get("/api/admin/analytics/category-demand")
      .set(bearer(otherCoord.token));
    expect(demand.body.demand.every((d) => d.postings === 0 && d.applications === 0)).toBe(true);

    const opportunities = await request(app)
      .get("/api/admin/opportunities")
      .set(bearer(otherCoord.token));
    expect(opportunities.body.count).toBe(0);

    const facultyActivity = await request(app)
      .get("/api/admin/analytics/faculty-activity?mode=ytd")
      .set(bearer(otherCoord.token));
    expect(facultyActivity.body.faculty).toHaveLength(0);

    const engagement = await request(app)
      .get("/api/admin/analytics/student-engagement")
      .set(bearer(otherCoord.token));
    expect(Object.values(engagement.body.engagement.byYear).every((c) => c === 0)).toBe(true);
  });
});

describe("coordinator analytics — Phase 6 (applications queue + activity trend)", () => {
  const bearer = (token) => ({ Authorization: `Bearer ${token}` });

  describe("applications queue", () => {
    it("lists the organization's applications with student/opportunity summaries, newest first", async () => {
      const faculty = await asFaculty();
      const coordinator = await createCoordinator();
      const opp = await createOpportunity(faculty.token, { title: "Research Assistant Position" });
      const student = await asStudent();
      await applyTo(student.token, opp._id);

      const res = await request(app)
        .get("/api/admin/applications")
        .set(bearer(coordinator.token));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.hasMore).toBe(false);
      const [row] = res.body.applications;
      expect(row.status).toBe("Applied");
      expect(row.student.name).toBe("Test Person");
      expect(row.opportunity.title).toBe("Research Assistant Position");
      expect(row.opportunity.category).toBe("Research");
    });

    it("never exposes coverLetter or resume in the applications queue", async () => {
      const faculty = await asFaculty();
      const coordinator = await createCoordinator();
      const opp = await createOpportunity(faculty.token);
      const student = await asStudent();
      await applyTo(student.token, opp._id, "Something that must never leak into an org-wide list.");

      const res = await request(app)
        .get("/api/admin/applications")
        .set(bearer(coordinator.token));
      expect(res.status).toBe(200);
      expect(res.body.applications[0]).not.toHaveProperty("coverLetter");
      expect(res.body.applications[0]).not.toHaveProperty("resume");
      expect(res.body.applications[0]).not.toHaveProperty("statusHistory");
    });

    it("filters the applications queue by status", async () => {
      const faculty = await asFaculty();
      const coordinator = await createCoordinator();
      const opp = await createOpportunity(faculty.token);
      const student = await asStudent();
      const student2 = await registerAndLogin({
        email: "s2@thapar.edu",
        role: "Student",
        branch: "COE",
        year: 2,
      });

      const apply = await applyTo(student.token, opp._id);
      await request(app)
        .patch(`/api/applications/${apply.body.application._id}/status`)
        .set(bearer(faculty.token))
        .send({ status: "Shortlisted" })
        .expect(200);
      await applyTo(student2.token, opp._id);

      const shortlisted = await request(app)
        .get("/api/admin/applications?status=Shortlisted")
        .set(bearer(coordinator.token));
      expect(shortlisted.body.total).toBe(1);
      expect(shortlisted.body.applications[0].status).toBe("Shortlisted");

      const applied = await request(app)
        .get("/api/admin/applications?status=Applied")
        .set(bearer(coordinator.token));
      expect(applied.body.total).toBe(1);
      expect(applied.body.applications[0].status).toBe("Applied");
    });

    it("paginates the applications queue", async () => {
      const faculty = await asFaculty();
      const coordinator = await createCoordinator();
      const opp = await createOpportunity(faculty.token);
      for (let i = 0; i < 3; i += 1) {
        const student = await registerAndLogin({
          email: `s${i}@thapar.edu`,
          role: "Student",
          branch: "COE",
          year: 2,
        });
        await applyTo(student.token, opp._id);
      }

      const page1 = await request(app)
        .get("/api/admin/applications?page=1&limit=2")
        .set(bearer(coordinator.token));
      expect(page1.body.total).toBe(3);
      expect(page1.body.applications).toHaveLength(2);
      expect(page1.body.hasMore).toBe(true);

      const page2 = await request(app)
        .get("/api/admin/applications?page=2&limit=2")
        .set(bearer(coordinator.token));
      expect(page2.body.applications).toHaveLength(1);
      expect(page2.body.hasMore).toBe(false);
    });

    it("scopes the applications queue to the coordinator's own organization", async () => {
      const faculty = await asFaculty();
      const opp = await createOpportunity(faculty.token);
      const student = await asStudent();
      await applyTo(student.token, opp._id);

      await Organization.create({
        name: "Other University",
        emailDomains: ["other.edu"],
      });
      const otherCoord = await createCoordinator("coord@other.edu", "other.edu");

      const res = await request(app)
        .get("/api/admin/applications")
        .set(bearer(otherCoord.token));
      expect(res.body.total).toBe(0);
      expect(res.body.applications).toHaveLength(0);
    });

    it("rejects an unrecognised status value", async () => {
      const coordinator = await createCoordinator();
      const res = await request(app)
        .get("/api/admin/applications?status=NotAStatus")
        .set(bearer(coordinator.token));
      expect(res.status).toBe(400);
    });

    it("forbids a non-coordinator from the applications queue", async () => {
      const student = await asStudent();
      const res = await request(app)
        .get("/api/admin/applications")
        .set(bearer(student.token));
      expect(res.status).toBe(403);
    });
  });

  describe("activity trend", () => {
    it("defaults to a gap-free 30-day applications series", async () => {
      const faculty = await asFaculty();
      const coordinator = await createCoordinator();
      const opp = await createOpportunity(faculty.token);
      const student = await asStudent();
      await applyTo(student.token, opp._id);

      const res = await request(app)
        .get("/api/admin/analytics/trend")
        .set(bearer(coordinator.token));
      expect(res.status).toBe(200);
      expect(res.body.trend).toHaveLength(30);
      expect(res.body.trend.at(-1).count).toBe(1);
    });

    it("honors the period toggle (7d/30d/90d)", async () => {
      const coordinator = await createCoordinator();
      for (const [period, days] of [["7d", 7], ["30d", 30], ["90d", 90]]) {
        const res = await request(app)
          .get(`/api/admin/analytics/trend?period=${period}`)
          .set(bearer(coordinator.token));
        expect(res.status).toBe(200);
        expect(res.body.trend).toHaveLength(days);
      }
    });

    it("counts only Student/Faculty registrations on the signups series, never Coordinator", async () => {
      const coordinator = await createCoordinator();
      await asFaculty();
      await asStudent();

      const res = await request(app)
        .get("/api/admin/analytics/trend?series=signups")
        .set(bearer(coordinator.token));
      expect(res.status).toBe(200);
      // Faculty + Student registered just now; the Coordinator itself (created
      // in the same organization, in the same instant) must not be counted.
      expect(res.body.trend.at(-1).count).toBe(2);
    });

    it("counts new opportunities on the postings series", async () => {
      const faculty = await asFaculty();
      const coordinator = await createCoordinator();
      await createOpportunity(faculty.token, { title: "First Posting" });
      await createOpportunity(faculty.token, { title: "Second Posting" });

      const res = await request(app)
        .get("/api/admin/analytics/trend?series=postings")
        .set(bearer(coordinator.token));
      expect(res.status).toBe(200);
      expect(res.body.trend.at(-1).count).toBe(2);
    });

    it("scopes the activity trend to the coordinator's own organization", async () => {
      const faculty = await asFaculty();
      const opp = await createOpportunity(faculty.token);
      const student = await asStudent();
      await applyTo(student.token, opp._id);

      await Organization.create({
        name: "Other University",
        emailDomains: ["other.edu"],
      });
      const otherCoord = await createCoordinator("coord@other.edu", "other.edu");

      const res = await request(app)
        .get("/api/admin/analytics/trend")
        .set(bearer(otherCoord.token));
      expect(res.body.trend.every((d) => d.count === 0)).toBe(true);
    });

    it("rejects unrecognised period/series values", async () => {
      const coordinator = await createCoordinator();
      const routes = [
        "/api/admin/analytics/trend?period=14d",
        "/api/admin/analytics/trend?series=views",
      ];
      for (const url of routes) {
        const res = await request(app).get(url).set(bearer(coordinator.token));
        expect(res.status).toBe(400);
      }
    });

    it("forbids a non-coordinator from the activity trend", async () => {
      const student = await asStudent();
      const res = await request(app)
        .get("/api/admin/analytics/trend")
        .set(bearer(student.token));
      expect(res.status).toBe(403);
    });
  });
});
