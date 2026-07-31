import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import Modal from "./Modal";

describe("Modal", () => {
  it("renders only when open, as a labelled dialog", () => {
    const { rerender } = render(
      <Modal open={false} onClose={() => {}} title="Hi">
        body
      </Modal>
    );
    expect(screen.queryByText("body")).not.toBeInTheDocument();

    rerender(
      <Modal open onClose={() => {}} title="Hi">
        body
      </Modal>
    );
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  });

  it("closes on Escape and via the close button", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} title="Hi">
        body
      </Modal>
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(screen.getByLabelText("Close dialog"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("keeps focus in a field while typing, even as the parent re-renders (regression)", async () => {
    const user = userEvent.setup();

    // Reproduces the bug shape: a fresh onClose function on every render. The
    // focus-lock effect must not re-run on that and steal the caret.
    function Harness() {
      const [value, setValue] = useState("");
      return (
        <Modal open onClose={() => {}} title="Compose">
          <textarea
            aria-label="message"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </Modal>
      );
    }

    render(<Harness />);
    const box = screen.getByLabelText("message");
    box.focus();
    await user.type(box, "hello there");

    expect(box).toHaveValue("hello there");
    expect(box).toHaveFocus();
  });
});
