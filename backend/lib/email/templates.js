// Email templates. Each returns { subject, html, text }. Styles are inlined
// because email clients ignore <style> blocks and external CSS. The palette is
// kept restrained and academic, matching the product.

const BRAND = "Opportunity Quest";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Wraps a body in the shared shell: a titled header, a content card, and a
// muted footer. `heading` sits at the top of the card; `bodyHtml` is trusted
// (built here), so callers must escape any user-supplied values first.
const layout = ({ heading, bodyHtml }) => `
  <div style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:520px;margin:0 auto;">
      <div style="padding:8px 4px 16px;font-size:15px;font-weight:700;color:#1e293b;letter-spacing:-0.2px;">
        ${BRAND}
      </div>
      <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;">
        <h1 style="margin:0 0 16px;font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.3px;">
          ${heading}
        </h1>
        ${bodyHtml}
      </div>
      <div style="padding:16px 4px;font-size:12px;color:#94a3b8;line-height:1.6;">
        This is an automated message from ${BRAND}. Please do not reply to this email.
      </div>
    </div>
  </div>
`;

const paragraph = (html) =>
  `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155;">${html}</p>`;

export const facultyApproval = ({ name }) => {
  const safeName = escapeHtml(name || "there");
  return {
    subject: "Your faculty account has been approved",
    html: layout({
      heading: "You're approved",
      bodyHtml:
        paragraph(`Hi ${safeName},`) +
        paragraph(
          `Your faculty account on ${BRAND} has been approved by your coordinator. You can now sign in and start posting opportunities, reviewing applicants, and collaborating across campus.`
        ) +
        paragraph(`Welcome aboard.`),
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `Your faculty account on ${BRAND} has been approved by your coordinator. ` +
      `You can now sign in and start posting opportunities, reviewing applicants, and collaborating across campus.\n\n` +
      `Welcome aboard.\n\n— ${BRAND}`,
  };
};

export const facultyRejection = ({ name, reason }) => {
  const safeName = escapeHtml(name || "there");
  const safeReason = reason ? escapeHtml(reason) : "";
  return {
    subject: "Update on your faculty account request",
    html: layout({
      heading: "About your account request",
      bodyHtml:
        paragraph(`Hi ${safeName},`) +
        paragraph(
          `After review, your faculty account request on ${BRAND} was not approved at this time.`
        ) +
        (safeReason
          ? paragraph(`<strong>Reason:</strong> ${safeReason}`)
          : "") +
        paragraph(
          `If you believe this was a mistake, please contact your department coordinator, who can review the decision.`
        ),
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `After review, your faculty account request on ${BRAND} was not approved at this time.\n\n` +
      (reason ? `Reason: ${reason}\n\n` : "") +
      `If you believe this was a mistake, please contact your department coordinator, who can review the decision.\n\n— ${BRAND}`,
  };
};
