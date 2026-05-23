import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Form } from "../Form";
import { FieldRegistryProvider } from "../registry";
import { useField } from "../useField";
import type { BaseFieldSchema, FieldComponentProps, FieldSchema } from "../types";

interface ColorSchema extends BaseFieldSchema {
  type: "color";
}

function ColorField({ schema }: FieldComponentProps<ColorSchema>) {
  const { value, setValue, onBlur } = useField(schema.name);
  return (
    <label>
      {schema.label}
      <input
        type="color"
        value={(value as string) || "#000000"}
        onChange={(e) => setValue(e.target.value)}
        onBlur={onBlur}
      />
    </label>
  );
}

describe("FieldRegistry", () => {
  it("resolves a custom field from context registry", async () => {
    const onSubmit = vi.fn();
    const schema = [
      { type: "color", name: "fav", label: "Fav" },
    ] as FieldSchema[];

    render(
      <FieldRegistryProvider value={{ color: ColorField }}>
        <Form schema={schema} onSubmit={onSubmit} initialValues={{ fav: "#ff0000" }} />
      </FieldRegistryProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith({ fav: "#ff0000" });
  });

  it("per-form `fields` prop overrides context registry", async () => {
    const ContextColor = (_: FieldComponentProps<ColorSchema>) => (
      <div data-testid="from-context" />
    );
    const PropColor = (_: FieldComponentProps<ColorSchema>) => (
      <div data-testid="from-prop" />
    );

    render(
      <FieldRegistryProvider value={{ color: ContextColor }}>
        <Form
          schema={[{ type: "color", name: "fav" }] as FieldSchema[]}
          fields={{ color: PropColor }}
          onSubmit={() => {}}
        />
      </FieldRegistryProvider>,
    );
    expect(screen.queryByTestId("from-context")).toBeNull();
    expect(screen.getByTestId("from-prop")).toBeInTheDocument();
  });
});
