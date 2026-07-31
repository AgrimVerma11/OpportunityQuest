import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import OpportunityForm from "./OpportunityForm";

const emptyForm = {
  title: "",
  description: "",
  category: "Internship",
  contactEmail: "",
  eligibleBranches: [],
  eligibleYears: [],
  eligibleGender: "Any",
  tags: "",
  deadline: "",
};

describe("OpportunityForm", () => {
  it("renders the core labelled fields", () => {
    render(
      <OpportunityForm
        form={emptyForm}
        onChange={() => {}}
        onMultiSelect={() => {}}
      />
    );
    expect(screen.getByLabelText(/Title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contact email/i)).toBeInTheDocument();
  });

  it("toggles an eligibility chip through onMultiSelect", async () => {
    const user = userEvent.setup();
    const onMultiSelect = vi.fn();
    render(
      <OpportunityForm
        form={emptyForm}
        onChange={() => {}}
        onMultiSelect={onMultiSelect}
      />
    );
    await user.click(screen.getByRole("button", { name: "COE" }));
    expect(onMultiSelect).toHaveBeenCalledWith("eligibleBranches", "COE");
  });

  it("marks selected chips with aria-pressed", () => {
    render(
      <OpportunityForm
        form={{ ...emptyForm, eligibleBranches: ["COE"] }}
        onChange={() => {}}
        onMultiSelect={() => {}}
      />
    );
    expect(screen.getByRole("button", { name: "COE" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });
});
