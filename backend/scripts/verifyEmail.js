import dotenv from "dotenv";

dotenv.config();

// Sends a test email through the configured provider to confirm it works. Pass
// the recipient as an argument (or set EMAIL_TEST_TO):
//
//   node scripts/verifyEmail.js you@example.com
//
// With EMAIL_PROVIDER=log (the default) it just prints what it would send. With
// resend, note the sandbox sender (onboarding@resend.dev) can only deliver to
// your own account email until you verify a sending domain.

async function run() {
  const to = process.argv[2] || process.env.EMAIL_TEST_TO;
  if (!to) {
    console.error(
      "Provide a recipient: node scripts/verifyEmail.js you@example.com"
    );
    process.exit(1);
  }

  // Imported after dotenv so config validation sees the loaded environment.
  const { default: config } = await import("../config/email.js");
  const { sendEmail } = await import("../lib/email/index.js");

  console.log(`Email provider: ${config.provider}\n`);

  await sendEmail({
    to,
    subject: "Opportunity Quest — test email",
    html: "<p>If you're reading this, transactional email is working. ✅</p>",
    text: "If you're reading this, transactional email is working.",
  });

  console.log(`✓ Sent (or logged) a test email to ${to}.`);
}

run().catch((err) => {
  console.error("\n✗ Email check FAILED:", err.message);
  process.exit(1);
});
