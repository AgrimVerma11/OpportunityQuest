import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import Field from "./Field";

describe("Field", () => {
  it("links the label to the control and applies the shared control class", () => {
    render(
      <Field id="email" label="Email">
        <input />
      </Field>
    );
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("id", "email");
    expect(input).toHaveClass("field-control");
  });

  it("shows a hint and wires aria-describedby to it", () => {
    render(
      <Field id="pw" label="Password" hint="At least 8 characters">
        <input />
      </Field>
    );
    expect(screen.getByText("At least 8 characters")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "aria-describedby",
      "pw-hint"
    );
  });

  it("marks the control invalid and describes it by the error", () => {
    render(
      <Field id="branch" label="Branch" error="Please select your branch.">
        <input />
      </Field>
    );
    const input = screen.getByLabelText("Branch");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "branch-error");
    expect(input).toHaveClass("field-control-error");
    expect(screen.getByText("Please select your branch.")).toBeInTheDocument();
  });
});
