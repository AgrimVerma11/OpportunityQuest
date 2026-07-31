import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import CategoryTag from "./CategoryTag";

describe("CategoryTag", () => {
  it("renders the category with a slugged tone class", () => {
    render(<CategoryTag category="Paid Gig" />);
    expect(screen.getByText("Paid Gig")).toHaveClass(
      "category-tag",
      "category-tag-paid-gig"
    );
  });

  it("renders nothing without a category", () => {
    const { container } = render(<CategoryTag />);
    expect(container).toBeEmptyDOMElement();
  });
});
