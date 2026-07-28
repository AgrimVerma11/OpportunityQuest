import request from "supertest";
import { describe, it, expect, beforeEach } from "vitest";

import { createApp } from "../app.js";
import Organization from "../models/Organization.js";

const app = createApp();

const futureISO = (days = 30) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

// ── Fixtures ──────────────────────────────────────────────────────

async function registerAndLogin(overrides = {}) {
  const payload = {
    name: "Test Person",
    password: "password123",
    confirmPassword: "password123",
    role: "Student",
    gender: "Male",
    ...overrides,
  };
  if (!payload.email) {
    throw new Error("registerAndLogin requires an explicit email");
  }

  const register = await request(app).post("/api/auth/register").send(payload);
  expect(register.status).toBe(201);

  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: payload.email, password: payload.password });
  expect(login.status).toBe(200);

  return { token: login.body.data.token, user: login.body.data.user };
}

const asFaculty = () =>
  registerAndLogin({
    email: "prof@thapar.edu",
    role: "Faculty",
    department: "DCSE",
  });

const asStudent = (extra = {}) =>
  registerAndLogin({
    email: "student@thapar.edu",
    role: "Student",
    branch: "COE",
    year: 2,
    ...extra,
  });

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
