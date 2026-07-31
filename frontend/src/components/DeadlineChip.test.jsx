import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import DeadlineChip from "./DeadlineChip";

const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString();

describe("DeadlineChip", () => {
  it("shows days remaining for a near-future deadline", () => {
    render(<DeadlineChip deadline={inDays(3)} />);
    expect(screen.getByText(/days left/i)).toBeInTheDocument();
  });

  it("shows Closed for a past deadline", () => {
    render(<DeadlineChip deadline={inDays(-2)} />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });

  it("renders nothing without a deadline", () => {
    const { container } = render(<DeadlineChip />);
    expect(container).toBeEmptyDOMElement();
  });
});
