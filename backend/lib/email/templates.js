// Email templates. Each returns { subject, html, text }. Styles are inlined
// because email clients ignore <style> blocks and external CSS. The palette is
// the product's own: academic ink + gold on warm paper, so the mail reads as
// part of Opportunity Quest rather than a generic transactional notice.

const BRAND = "Opportunity Quest";

// Brand palette (mirrors the app's design tokens).
const INK = "#14172e"; // headings, primary button, monogram tile
const INK_SOFT = "#383b5c"; // body copy
const GOLD = "#b8924a"; // the fine top-rule on the card
const GOLD_LIGHT = "#d4af5a"; // monogram lettering
const CREAM = "#f7f3ec"; // text on ink
const IVORY = "#faf9f5"; // outer ground
const PAPER = "#ffffff"; // card
const BORDER = "#e9e4d9"; // warm hairline
const MUTED = "#8a8d99"; // footer / meta

const SERIF = "Georgia, 'Times New Roman', serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Wraps a body in the shared shell: a centered wordmark lockup, a paper card
// edged with a gold rule, and a quiet footer. The mark is a pure-CSS monogram
// (ink tile, gold serif letters) rather than a hosted image, so it always
// renders — email clients block remote images, and Gmail drops SVG/data URIs.
// `heading` sits at the top of the card in serif; `bodyHtml` is trusted (built
// here), so callers must escape any user-supplied values first.
const layout = ({ heading, bodyHtml }) => `
  <div style="margin:0;padding:0;background:${IVORY};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${IVORY};">
      <tr>
        <td align="center" style="padding:36px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:520px;max-width:520px;">
            <tr>
              <td align="center" style="padding:4px 0 24px;">
                <div style="width:46px;height:46px;line-height:46px;border-radius:12px;background:${INK};font-family:${SERIF};font-size:18px;font-weight:700;letter-spacing:0.5px;color:${GOLD_LIGHT};text-align:center;">OQ</div>
                <div style="margin-top:11px;font-family:${SERIF};font-size:15px;font-weight:700;letter-spacing:0.3px;color:${INK};">${BRAND}</div>
              </td>
            </tr>
            <tr>
              <td style="background:${PAPER};border:1px solid ${BORDER};border-top:3px solid ${GOLD};border-radius:14px;padding:38px 36px;">
                <h1 style="margin:0 0 20px;font-family:${SERIF};font-size:23px;font-weight:600;line-height:1.3;letter-spacing:-0.2px;color:${INK};">
                  ${heading}
                </h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:22px 8px 4px;font-family:${SANS};font-size:12px;line-height:1.6;color:${MUTED};">
                This is an automated message from ${BRAND}. Please do not reply to this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>
`;

const paragraph = (html) =>
  `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.7;color:${INK_SOFT};">${html}</p>`;

// Bulletproof email button: a table cell carries the fill so it renders in
// Outlook too, with the anchor padded on top for the click target.
const button = (label, url) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 2px;">
    <tr>
      <td style="border-radius:9px;background:${INK};">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:13px 28px;font-family:${SANS};font-size:14px;font-weight:600;letter-spacing:0.2px;color:${CREAM};text-decoration:none;border-radius:9px;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`;

export const facultyApproval = ({ name }) => {
  const safeName = escapeHtml(name || "there");
  return {
    subject: "Your faculty account has been approved",
    html: layout({
      heading: "You're approved",
      bodyHtml:
        paragraph(`Hi ${safeName},`) +
        paragraph(
          `Your faculty account on ${BRAND} has been approved by your coordinator. You can now sign in to post opportunities, review applicants, and collaborate across campus.`
        ) +
        paragraph(`Welcome aboard.`),
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `Your faculty account on ${BRAND} has been approved by your coordinator. ` +
      `You can now sign in to post opportunities, review applicants, and collaborate across campus.\n\n` +
      `Welcome aboard.\n\n— ${BRAND}`,
  };
};

// A generic wrapper around an in-app notification: its title and body, plus an
// optional button back into the app. Used as the email "nudge" for notification
// types that warrant one, so new events don't need bespoke templates.
export const notification = ({ title, body, actionUrl }) => {
  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body || "");
  return {
    subject: title,
    html: layout({
      heading: safeTitle,
      bodyHtml:
        (safeBody ? paragraph(safeBody) : "") +
        (actionUrl ? button("Open Opportunity Quest", actionUrl) : ""),
    }),
    text:
      `${title}\n\n` +
      (body ? `${body}\n\n` : "") +
      (actionUrl ? `Open Opportunity Quest: ${actionUrl}\n\n` : "") +
      `— ${BRAND}`,
  };
};

export const accountBanned = ({ name, reason }) => {
  const safeName = escapeHtml(name || "there");
  const safeReason = reason ? escapeHtml(reason) : "";
  return {
    subject: "Your account has been suspended",
    html: layout({
      heading: "Account suspended",
      bodyHtml:
        paragraph(`Hi ${safeName},`) +
        paragraph(
          `Your account on ${BRAND} has been suspended by your coordinator. You will not be able to sign in while your account is in this state.`
        ) +
        (safeReason
          ? paragraph(`<strong style="color:${INK};font-weight:600;">Reason:</strong> ${safeReason}`)
          : "") +
        paragraph(
          `Please get in touch with your department coordinator in person to discuss this and resolve it.`
        ),
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `Your account on ${BRAND} has been suspended by your coordinator. You will not be able to sign in while your account is in this state.\n\n` +
      (reason ? `Reason: ${reason}\n\n` : "") +
      `Please get in touch with your department coordinator in person to discuss this and resolve it.\n\n— ${BRAND}`,
  };
};

export const accountUnbanned = ({ name }) => {
  const safeName = escapeHtml(name || "there");
  return {
    subject: "Your account has been restored",
    html: layout({
      heading: "You're back in",
      bodyHtml:
        paragraph(`Hi ${safeName},`) +
        paragraph(
          `Your account on ${BRAND} has been restored by your coordinator. You can sign in and use ${BRAND} again as normal.`
        ),
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `Your account on ${BRAND} has been restored by your coordinator. You can sign in and use ${BRAND} again as normal.\n\n— ${BRAND}`,
  };
};

export const accountRemoved = ({ name }) => {
  const safeName = escapeHtml(name || "there");
  return {
    subject: "Your account has been removed",
    html: layout({
      heading: "Account removed",
      bodyHtml:
        paragraph(`Hi ${safeName},`) +
        paragraph(
          `Your account on ${BRAND}, and the data associated with it, has been removed by your coordinator.`
        ) +
        paragraph(
          `If you believe this was a mistake, please get in touch with your department coordinator in person.`
        ),
    }),
    text:
      `Hi ${name || "there"},\n\n` +
      `Your account on ${BRAND}, and the data associated with it, has been removed by your coordinator.\n\n` +
      `If you believe this was a mistake, please get in touch with your department coordinator in person.\n\n— ${BRAND}`,
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
          ? paragraph(`<strong style="color:${INK};font-weight:600;">Reason:</strong> ${safeReason}`)
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
