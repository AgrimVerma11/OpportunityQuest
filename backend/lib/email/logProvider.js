// Development / test email provider. Instead of sending, it prints a concise
// summary to the console so a developer can see that (and what) an email would
// have gone out — without an account, a network call, or a real inbox.
export const send = async ({ from, to, subject }) => {
  console.log(`[email:log] from=${from} to=${to} subject="${subject}"`);
};
