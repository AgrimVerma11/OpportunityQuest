import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

import connectDB from "./config/db.js";
import Organization from "./models/Organization.js";
import User from "./models/User.js";
import Opportunity from "./models/Opportunity.js";
import Application from "./models/Application.js";
import { APPLICATION_STATUS } from "./constants/applicationConstants.js";

dotenv.config();

// Deterministic development seed. Wipes and repopulates the collections with a
// small, known dataset — one organization and the users, opportunities and
// applications that belong to it — so local work and staging share the same
// starting point. Refuses to run against production.

const DEMO_PASSWORD = "Password@123";

const daysFromNow = (days) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000);

async function seed() {
  if (process.env.NODE_ENV === "production") {
    console.error("Refusing to seed: NODE_ENV is production.");
    process.exit(1);
  }

  await connectDB();
  console.log(`Seeding database: ${mongoose.connection.host}/${mongoose.connection.name}`);

  await Promise.all([
    Organization.deleteMany({}),
    User.deleteMany({}),
    Opportunity.deleteMany({}),
    Application.deleteMany({}),
  ]);

  const organization = await Organization.create({
    name: "Thapar Institute of Engineering and Technology",
    emailDomains: ["thapar.edu"],
  });
  const organizationId = organization._id;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const faculty = await User.create({
    organizationId,
    name: "Ananya Rao",
    email: "prof@thapar.edu",
    password: passwordHash,
    role: "Faculty",
    gender: "Female",
    prefix: "Dr.",
    department: "DCSE",
    designation: "Assistant Professor",
    interests: "Distributed Systems, Databases",
  });

  const [studentCOE] = await User.create([
    {
      organizationId,
      name: "Rahul Sharma",
      email: "rahul@thapar.edu",
      password: passwordHash,
      role: "Student",
      gender: "Male",
      branch: "COE",
      year: 2,
    },
    {
      organizationId,
      name: "Priya Singh",
      email: "priya@thapar.edu",
      password: passwordHash,
      role: "Student",
      gender: "Female",
      branch: "ECE",
      year: 3,
    },
  ]);

  await User.create({
    organizationId,
    name: "Neha Gupta",
    email: "coordinator@thapar.edu",
    password: passwordHash,
    role: "Coordinator",
    gender: "Female",
    accountStatus: "Active",
  });

  // A faculty account still awaiting approval, to exercise the coordinator queue.
  await User.create({
    organizationId,
    name: "Vikram Mehta",
    email: "pending@thapar.edu",
    password: passwordHash,
    role: "Faculty",
    gender: "Male",
    department: "DCSE",
    employeeId: "EMP-9001",
    accountStatus: "Pending",
  });

  const [research] = await Opportunity.create([
    {
      organizationId,
      title: "Research Assistant — Distributed Systems",
      description:
        "Support an ongoing research project on consensus protocols. Involves reading papers, running experiments and writing up results.",
      category: "Research",
      postedBy: faculty._id,
      eligibleBranches: ["All"],
      eligibleYears: ["All"],
      eligibleGender: "Any",
      contactEmail: "prof@thapar.edu",
      deadline: daysFromNow(30),
      status: "Active",
    },
    {
      organizationId,
      title: "Summer Internship — Backend Engineering",
      description:
        "Build and maintain internal tooling for the department. Node.js and MongoDB experience preferred but not required.",
      category: "Internship",
      postedBy: faculty._id,
      eligibleBranches: ["COE", "COPC", "DSAI"],
      eligibleYears: ["2", "3"],
      eligibleGender: "Any",
      contactEmail: "prof@thapar.edu",
      deadline: daysFromNow(45),
      status: "Active",
    },
  ]);

  await Application.create({
    organizationId,
    student: studentCOE._id,
    opportunity: research._id,
    coverLetter:
      "I have worked with distributed key-value stores in a course project and would love to go deeper on consensus.",
    status: APPLICATION_STATUS.APPLIED,
    statusHistory: [
      { status: APPLICATION_STATUS.APPLIED, changedBy: studentCOE._id },
    ],
  });

  await Opportunity.findByIdAndUpdate(research._id, {
    $inc: { applicationsCount: 1 },
  });
  await User.findByIdAndUpdate(studentCOE._id, {
    $inc: { applicationsSubmitted: 1 },
  });

  console.log("Seed complete:");
  console.log(`  Organization: ${organization.name}`);
  console.log(`  Coordinator: coordinator@thapar.edu / ${DEMO_PASSWORD}`);
  console.log(`  Faculty:  prof@thapar.edu / ${DEMO_PASSWORD}  (active)`);
  console.log(`  Faculty:  pending@thapar.edu / ${DEMO_PASSWORD}  (awaiting approval)`);
  console.log(`  Student:  rahul@thapar.edu / ${DEMO_PASSWORD}  (COE, applied to Research)`);
  console.log(`  Student:  priya@thapar.edu / ${DEMO_PASSWORD}  (ECE)`);
  console.log(`  Opportunities: 2, Applications: 1`);

  await mongoose.disconnect();
}

seed().catch(async (err) => {
  console.error("Seed failed:", err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
