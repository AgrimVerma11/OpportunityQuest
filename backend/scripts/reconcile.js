import Application from "../models/Application.js";
import Opportunity from "../models/Opportunity.js";

// Recompute the denormalized Opportunity.applicationsCount from the real number
// of applications. The app keeps this counter accurate on apply/withdraw, but an
// out-of-band delete (a maintenance script, or a hand edit in the database) can
// leave it drifted — a card showing "Applicants · 1" for an opportunity that has
// none. This heals that drift. Assumes a live Mongoose connection.
//
// Returns the number of opportunities whose count was corrected.
export async function reconcileApplicationCounts() {
  const grouped = await Application.aggregate([
    { $group: { _id: "$opportunity", n: { $sum: 1 } } },
  ]);
  const real = new Map(grouped.map((g) => [g._id.toString(), g.n]));

  const opportunities = await Opportunity.find({}, "_id applicationsCount");
  let fixed = 0;
  for (const o of opportunities) {
    const n = real.get(o._id.toString()) || 0;
    if (o.applicationsCount !== n) {
      await Opportunity.updateOne({ _id: o._id }, { applicationsCount: n });
      fixed += 1;
    }
  }
  return fixed;
}
