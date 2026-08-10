import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import Tag from "./Tag";
import UrgencyChip from "./UrgencyChip";
import Button from "./Button";
import Card from "./Card";
import StatCard from "./StatCard";
import SkillChip from "./SkillChip";
import ProgressBar from "./ProgressBar";

const inDays = (n) => new Date(Date.now() + n * 24 * 60 * 60 * 1000);

describe("Tag", () => {
  it("maps a category to its tint slug", () => {
    render(<Tag category="Paid Gig" />);
    const el = screen.getByText("Paid Gig");
    expect(el).toHaveClass("oq-tag", "oq-tag--cat", "oq-tag--cat-paidgig");
  });

  it("renders an active status with a leading dot", () => {
    render(<Tag status="Active" />);
    const el = screen.getByText("Active");
    expect(el).toHaveClass("oq-tag--status-active", "oq-tag--dot");
  });

  it("folds a negative status onto the expired tone (no dot)", () => {
    render(<Tag status="Rejected" />);
    const el = screen.getByText("Rejected");
    expect(el).toHaveClass("oq-tag--status-expired");
    expect(el).not.toHaveClass("oq-tag--dot");
  });

  it("renders nothing without a category or status", () => {
    const { container } = render(<Tag />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("UrgencyChip", () => {
  it("is low urgency beyond a week", () => {
    render(<UrgencyChip deadline={inDays(11)} />);
    const el = screen.getByText("11 days left");
    expect(el).toHaveClass("oq-urgency--low");
  });

  it("is mid urgency within 4–7 days", () => {
    render(<UrgencyChip deadline={inDays(6)} />);
    expect(screen.getByText("6 days left")).toHaveClass("oq-urgency--mid");
  });

  it("is high urgency within 3 days", () => {
    render(<UrgencyChip deadline={inDays(2)} />);
    expect(screen.getByText("2 days left")).toHaveClass("oq-urgency--high");
  });

  it("reads Closed once the deadline has passed", () => {
    render(<UrgencyChip deadline={inDays(-2)} />);
    expect(screen.getByText("Closed")).toHaveClass("oq-urgency--high");
  });

  it("renders nothing without a deadline", () => {
    const { container } = render(<UrgencyChip />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("Button", () => {
  it("renders a primary button with the gold plus", () => {
    render(
      <Button variant="primary" leadingPlus>
        Post an opportunity
      </Button>
    );
    const btn = screen.getByRole("button", { name: /post an opportunity/i });
    expect(btn).toHaveClass("oq-btn", "oq-btn--primary", "oq-btn--md");
    expect(btn.querySelector(".oq-btn__plus")).not.toBeNull();
  });

  it("is polymorphic via `as` and forwards props", () => {
    render(
      <Button as="a" href="/x" variant="text" size="sm">
        Edit
      </Button>
    );
    const link = screen.getByRole("link", { name: "Edit" });
    expect(link).toHaveClass("oq-btn--text", "oq-btn--sm");
    expect(link).toHaveAttribute("href", "/x");
  });
});

describe("Card", () => {
  it("uses the elevated shadow when asked", () => {
    render(<Card elevated>body</Card>);
    const el = screen.getByText("body");
    expect(el).toHaveClass("oq-card", "oq-card--elevated");
  });
});

describe("StatCard", () => {
  it("tints the number by tone", () => {
    render(<StatCard value={5} label="Active" tone="active" />);
    expect(screen.getByText("5")).toHaveClass("oq-stat__num--active");
    expect(screen.getByText("Active")).toHaveClass("oq-stat__label");
  });
});

describe("SkillChip", () => {
  it("renders its label", () => {
    render(<SkillChip>Backend Development</SkillChip>);
    expect(screen.getByText("Backend Development")).toHaveClass("oq-skill");
  });
});

describe("ProgressBar", () => {
  it("clamps an over-range value to 100%", () => {
    render(<ProgressBar value={150} />);
    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar.querySelector(".oq-progress__fill")).toHaveStyle({ width: "100%" });
  });
});
