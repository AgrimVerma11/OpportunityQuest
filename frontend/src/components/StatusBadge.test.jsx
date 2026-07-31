import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import StatusBadge from "./StatusBadge";

describe("StatusBadge", () => {
  it("renders the status label with its status class", () => {
    render(<StatusBadge status="Shortlisted" />);
    expect(screen.getByText("Shortlisted")).toHaveClass(
      "status-badge",
      "status-Shortlisted"
    );
  });
});
