import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ToastProvider, useToast } from "./ToastProvider";

function Trigger() {
  const toast = useToast();
  return (
    <button type="button" onClick={() => toast.success("Profile saved.")}>
      save
    </button>
  );
}

describe("ToastProvider", () => {
  it("shows a toast when requested", async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>
    );
    await user.click(screen.getByRole("button", { name: "save" }));
    expect(await screen.findByText("Profile saved.")).toBeInTheDocument();
  });
});
