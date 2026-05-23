import { describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Form } from "../Form";
import { TextField } from "../fields/TextField";
import type {
  FieldComponentProps,
  FieldSchema,
  TextFieldSchema,
} from "../types";

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

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toEqual({
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

    await user.tab();
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

  it("focuses the first invalid field on submit", async () => {
    const schema: FieldSchema[] = [
      {
        type: "text",
        name: "first",
        label: "First",
        validate: { required: true },
      },
      {
        type: "text",
        name: "second",
        label: "Second",
        validate: { required: true },
      },
    ];
    render(<Form schema={schema} onSubmit={() => {}} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(document.activeElement).toBe(screen.getByLabelText("First"));
  });

  it("focuses the second field when the first is valid but second is not", async () => {
    const schema: FieldSchema[] = [
      {
        type: "text",
        name: "first",
        label: "First",
        validate: { required: true },
      },
      {
        type: "text",
        name: "second",
        label: "Second",
        validate: { required: true },
      },
    ];
    render(
      <Form
        schema={schema}
        initialValues={{ first: "filled" }}
        onSubmit={() => {}}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(document.activeElement).toBe(screen.getByLabelText("Second"));
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
    expect(onSubmit.mock.calls[0][0]).toEqual({ role: "user" });

    onSubmit.mockClear();
    await user.selectOptions(screen.getByLabelText("Role"), "admin");
    expect(screen.getByLabelText("Admin code")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Admin code"), "secret");
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(onSubmit.mock.calls[0][0]).toEqual({
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

    expect(renderCounts.b).toBe(initialB);
    expect(renderCounts.a).toBeGreaterThanOrEqual(3);
  });
});

describe("<Form/> async submission", () => {
  it("disables button + shows pending label while onSubmit is in flight", async () => {
    let resolve!: () => void;
    const slowSubmit = vi.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    );

    render(
      <Form
        schema={[{ type: "text", name: "x", label: "X" }]}
        onSubmit={slowSubmit}
        submitLabel="Send"
        submittingLabel="Sending…"
      />,
    );

    const user = userEvent.setup();
    const button = screen.getByRole("button");
    await user.click(button);

    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/sending/i);

    await act(async () => {
      resolve();
    });
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(button).toHaveTextContent("Send");
  });

  it("displays form error banner when helpers.setFormError is called", async () => {
    render(
      <Form
        schema={[{ type: "text", name: "x", label: "X" }]}
        onSubmit={async (_v, { setFormError }) => {
          setFormError("Server unavailable");
        }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Server unavailable",
    );
  });

  it("displays inline field error when helpers.setFieldError is called", async () => {
    render(
      <Form
        schema={[
          { type: "text", name: "email", label: "Email" },
          { type: "text", name: "name", label: "Name" },
        ]}
        onSubmit={async (_v, { setFieldError }) => {
          setFieldError("email", "Already in use");
        }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByText("Already in use")).toBeInTheDocument();
  });

  it("focuses the field that received a server-side error", async () => {
    render(
      <Form
        schema={[
          { type: "text", name: "name", label: "Name" },
          { type: "text", name: "email", label: "Email" },
        ]}
        onSubmit={async (_v, { setFieldError }) => {
          setFieldError("email", "Taken");
        }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText("Email")),
    );
  });

  it("smooth-scrolls the form error banner into view when it appears", async () => {
    const scrollSpy = vi.spyOn(Element.prototype, "scrollIntoView");

    render(
      <Form
        schema={[{ type: "text", name: "x", label: "X" }]}
        onSubmit={async (_v, { setFormError }) => {
          setFormError("Server unavailable");
        }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Server unavailable"),
    );

    const bannerScroll = scrollSpy.mock.calls.find((args) => {
      const opts = args[0] as ScrollIntoViewOptions | boolean | undefined;
      return (
        typeof opts === "object" &&
        opts !== null &&
        opts.behavior === "smooth" &&
        opts.block === "start"
      );
    });
    expect(bannerScroll).toBeDefined();

    scrollSpy.mockRestore();
  });

  it("catches thrown errors and surfaces them as a form error", async () => {
    render(
      <Form
        schema={[{ type: "text", name: "x", label: "X" }]}
        onSubmit={async () => {
          throw new Error("boom");
        }}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /submit/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
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
    const submitted = onSubmit.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof submitted.avatar).toBe("string");
    expect(submitted.avatar as string).toMatch(/^data:image\/png;base64,/);
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
