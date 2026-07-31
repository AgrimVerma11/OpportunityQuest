import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import Footer from "./Footer";

describe("Footer", () => {
  it("renders the internal nav links and external social links", () => {
    render(
      <MemoryRouter>
        <Footer />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/home"
    );
    expect(screen.getByRole("link", { name: /GitHub/i })).toHaveAttribute(
      "href",
      expect.stringContaining("github.com")
    );
    expect(screen.getByRole("link", { name: /LinkedIn/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Substack/i })).toBeInTheDocument();
  });
});
