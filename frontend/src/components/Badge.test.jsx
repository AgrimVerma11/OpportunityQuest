import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import Badge from "./Badge";

describe("Badge", () => {
  it("applies the tone class", () => {
    render(<Badge tone="primary">Faculty</Badge>);
    expect(screen.getByText("Faculty")).toHaveClass("badge", "badge-primary");
  });

  it("defaults to the neutral tone", () => {
    render(<Badge>Draft</Badge>);
    expect(screen.getByText("Draft")).toHaveClass("badge-neutral");
  });
});
