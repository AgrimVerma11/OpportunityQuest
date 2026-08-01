import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import ProfileView from "./ProfileView";

describe("ProfileView", () => {
  it("renders the professional layout for a coordinator, not the bare student view", () => {
    render(
      <ProfileView
        profile={{
          role: "Coordinator",
          name: "Neha Gupta",
          prefix: "Prof.",
          department: "DCSE",
          designation: "Associate Professor",
          interests: "Databases, Distributed Systems",
        }}
      />
    );

    // Prefixed name + department · designation subline (faculty-style).
    expect(screen.getByText("Prof. Neha Gupta")).toBeInTheDocument();
    expect(screen.getByText(/DCSE.*Associate Professor/)).toBeInTheDocument();

    // The professional "Research Interests" section renders its content.
    expect(screen.getByText("Research Interests")).toBeInTheDocument();
    expect(
      screen.getByText("Databases, Distributed Systems")
    ).toBeInTheDocument();
  });
});
