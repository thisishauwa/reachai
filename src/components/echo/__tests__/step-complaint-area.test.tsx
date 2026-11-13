import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StepComplaintArea } from "../step-complaint-area";

describe("StepComplaintArea", () => {
  it("shows six single-select areas and disables Continue until one is selected", () => {
    const onContinue = vi.fn();
    render(<StepComplaintArea onContinue={onContinue} />);
    expect(screen.getAllByRole("radio")).toHaveLength(6);
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    fireEvent.click(screen.getByRole("radio", { name: /Fever or hot body/ }));
    expect(continueButton).toBeEnabled();
    expect(screen.getByRole("radio", { name: /Fever or hot body/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getAllByRole("radio").filter((item) => item.getAttribute("aria-checked") === "true")).toHaveLength(1);
    fireEvent.click(continueButton);
    expect(onContinue).toHaveBeenCalledWith("A");
  });
});
