import { describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Form } from "../Form";
import { TextField } from "../fields/TextField";
import type { FieldComponentProps, FieldSchema, TextFieldSchema } from "../types";

describe("<Form/>", () => {
  it("renders all visible field types and submits flat JSON", async () => {
    const onSubmit = vi.fn();
    const schema: FieldSchema[] = [
      { type: "text", name: "fullName", label: "Name" },
      {
        type: "radio",
        name: "color",
        label: "Color",
        options: [
          { label: "Red", value: "red" },
          { label: "Blue", value: "blue" },
        ],
      },
      {
        type: "dropdown",
        name: "country",
        label: "Country",
        options: [
          { label: "GB", value: "gb" },
          { label: "US", value: "us" },
        ],
      },
    ];

    render(<Form schema={schema} onSubmit={onSubmit} />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByLabelText("Blue"));
    await user.selectOptions(screen.getByLabelText("Country"), "us");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      fullName: "Ada",
      color: "blue",
      country: "us",
    });
  });

  it("shows required error only after blur", async () => {
    const schema: FieldSchema[] = [
      {
        type: "text",
        name: "x",
        label: "X",
        validate: { required: true },
      },
    ];
    render(<Form schema={schema} onSubmit={() => {}} />);
    const user = userEvent.setup();
    const input = screen.getByLabelText("X");

    await user.type(input, "a");
    await user.clear(input);
    expect(screen.queryByRole("alert")).toBeNull();

    await user.tab(); // blur
    expect(await screen.findByRole("alert")).toHaveTextContent(/required/i);
  });

  it("blocks submit when invalid and calls onInvalidSubmit", async () => {
    const onSubmit = vi.fn();
    const onInvalidSubmit = vi.fn();
    const schema: FieldSchema[] = [
      { type: "text", name: "x", label: "X", validate: { required: true } },
    ];
    render(
      <Form
        schema={schema}
        onSubmit={onSubmit}
        onInvalidSubmit={onInvalidSubmit}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onInvalidSubmit).toHaveBeenCalled();
  });

  it("hides conditional fields and excludes them from submission", async () => {
    const onSubmit = vi.fn();
    const schema: FieldSchema[] = [
      {
        type: "dropdown",
        name: "role",
        label: "Role",
        options: [
          { label: "User", value: "user" },
          { label: "Admin", value: "admin" },
        ],
      },
      {
        type: "text",
        name: "adminCode",
        label: "Admin code",
        visibleWhen: (v) => v.role === "admin",
        validate: { required: true },
      },
    ];

    render(
      <Form
        schema={schema}
        initialValues={{ role: "user" }}
        onSubmit={onSubmit}
      />,
    );
    const user = userEvent.setup();

    expect(screen.queryByLabelText("Admin code")).toBeNull();
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith({ role: "user" });

    onSubmit.mockClear();
    await user.selectOptions(screen.getByLabelText("Role"), "admin");
    expect(screen.getByLabelText("Admin code")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Admin code"), "secret");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      role: "admin",
      adminCode: "secret",
    });
  });

  it("typing in one field does not re-render unrelated fields", async () => {
    const renderCounts: Record<string, number> = { a: 0, b: 0 };

    function makeCounted(key: "a" | "b") {
      return function Counted(props: FieldComponentProps<TextFieldSchema>) {
        renderCounts[key] += 1;
        return <TextField {...props} />;
      };
    }

    const fields = {
      "counted-a": makeCounted("a"),
      "counted-b": makeCounted("b"),
    };

    const schema: FieldSchema[] = [
      { type: "counted-a", name: "a", label: "A" } as FieldSchema,
      { type: "counted-b", name: "b", label: "B" } as FieldSchema,
    ];

    render(<Form schema={schema} fields={fields} onSubmit={() => {}} />);
    const initialB = renderCounts.b;

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("A"), "abc");

    // B must not re-render while A is being typed into.
    expect(renderCounts.b).toBe(initialB);
    // A should re-render on each keystroke.
    expect(renderCounts.a).toBeGreaterThanOrEqual(3);
  });
});

describe("<Form/> image field", () => {
  it("reads file to base64 and includes in submission", async () => {
    const onSubmit = vi.fn();
    const schema: FieldSchema[] = [
      { type: "image", name: "avatar", label: "Avatar" },
    ];
    render(<Form schema={schema} onSubmit={onSubmit} />);
    const user = userEvent.setup();

    const file = new File(["hello"], "hello.png", { type: "image/png" });
    const input = screen.getByLabelText("Avatar") as HTMLInputElement;

    await act(async () => {
      await user.upload(input, file);
    });

    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const submitted = onSubmit.mock.calls[0][0];
    expect(typeof submitted.avatar).toBe("string");
    expect(submitted.avatar).toMatch(/^data:image\/png;base64,/);
  });

  it("rejects oversized images on validation", async () => {
    const onSubmit = vi.fn();
    const onInvalidSubmit = vi.fn();
    const schema: FieldSchema[] = [
      {
        type: "image",
        name: "avatar",
        label: "Avatar",
        maxSizeBytes: 3,
      },
    ];
    render(
      <Form
        schema={schema}
        onSubmit={onSubmit}
        onInvalidSubmit={onInvalidSubmit}
      />,
    );
    const user = userEvent.setup();

    const file = new File(["this-is-too-big"], "big.png", { type: "image/png" });
    const input = screen.getByLabelText("Avatar") as HTMLInputElement;
    await act(async () => {
      await user.upload(input, file);
    });

    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onInvalidSubmit).toHaveBeenCalled();
    expect(onInvalidSubmit.mock.calls[0][0]).toHaveProperty("avatar");
  });
});
