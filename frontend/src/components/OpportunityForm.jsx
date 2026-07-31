import Field from "./Field";
import { BRANCH_OPTIONS } from "../constants/profileOptions";
import "./OpportunityForm.css";

const BRANCH_CHOICES = ["All", ...BRANCH_OPTIONS];
const YEAR_CHOICES = ["All", "1", "2", "3", "4"];

// The opportunity field set, shared by Create and Edit (the two pages were ~90%
// the same form). Pages own the surrounding chrome (header, submit, attachments).
export default function OpportunityForm({ form, onChange, onMultiSelect }) {
  const toggleClass = (field, value) =>
    `opp-chip${form[field].includes(value) ? " selected" : ""}`;

  return (
    <div className="opp-fields">
      <Field id="opp-title" label="Title" required>
        <input
          name="title"
          value={form.title}
          onChange={onChange}
          placeholder="e.g. Backend Developer for the Research Portal"
          required
        />
      </Field>

      <Field id="opp-description" label="Description" required>
        <textarea
          name="description"
          value={form.description}
          onChange={onChange}
          rows={6}
          placeholder="Describe the role, the responsibilities, and what you are looking for."
          required
        />
      </Field>

      <div className="opp-row">
        <Field id="opp-category" label="Category">
          <select name="category" value={form.category} onChange={onChange}>
            <option>Internship</option>
            <option>Research</option>
            <option>Paid Gig</option>
            <option>Faculty Project</option>
          </select>
        </Field>

        <Field id="opp-deadline" label="Application deadline" required>
          <input
            type="date"
            name="deadline"
            value={form.deadline}
            onChange={onChange}
            required
          />
        </Field>
      </div>

      <div className="opp-row">
        <Field id="opp-contact" label="Contact email" required>
          <input
            type="email"
            name="contactEmail"
            value={form.contactEmail}
            onChange={onChange}
            placeholder="you@thapar.edu"
            required
          />
        </Field>

        <Field id="opp-gender" label="Eligible gender">
          <select
            name="eligibleGender"
            value={form.eligibleGender}
            onChange={onChange}
          >
            <option value="Any">Any</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </Field>
      </div>

      <div className="opp-multi">
        <span className="opp-multi-label">Eligible branches</span>
        <div className="opp-chips" role="group" aria-label="Eligible branches">
          {BRANCH_CHOICES.map((b) => (
            <button
              type="button"
              key={b}
              className={toggleClass("eligibleBranches", b)}
              aria-pressed={form.eligibleBranches.includes(b)}
              onClick={() => onMultiSelect("eligibleBranches", b)}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="opp-multi">
        <span className="opp-multi-label">Eligible years</span>
        <div className="opp-chips" role="group" aria-label="Eligible years">
          {YEAR_CHOICES.map((y) => (
            <button
              type="button"
              key={y}
              className={toggleClass("eligibleYears", y)}
              aria-pressed={form.eligibleYears.includes(y)}
              onClick={() => onMultiSelect("eligibleYears", y)}
            >
              {y === "All" ? "All" : `Year ${y}`}
            </button>
          ))}
        </div>
      </div>

      <Field
        id="opp-tags"
        label="Tags"
        hint="Separate with commas, e.g. Python, Machine Learning, Backend."
      >
        <input
          name="tags"
          value={form.tags}
          onChange={onChange}
          placeholder="Python, Machine Learning, Backend"
        />
      </Field>
    </div>
  );
}
