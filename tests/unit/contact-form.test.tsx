// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { contactEndpoint, submitContact, validateContact } from "../../src/lib/contact";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

const ENDPOINT = "https://forms.example.test/f/abc";

/** The form reads its endpoint when the module loads, so each case imports it afresh. */
async function renderForm(endpoint?: string) {
  if (endpoint !== undefined) vi.stubEnv("NEXT_PUBLIC_CONTACT_FORM_ENDPOINT", endpoint);
  vi.resetModules();
  const { ContactForm } = await import("../../src/components/contact/ContactForm");
  render(<ContactForm />);
}

function fill(name: string, email: string, message: string) {
  fireEvent.change(screen.getByLabelText("Full name"), { target: { value: name } });
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Your message"), { target: { value: message } });
}

const submit = () => fireEvent.click(screen.getByTestId("contact-submit"));

describe("contact rules", () => {
  it("requires every field and a valid email address", () => {
    expect(validateContact({ name: " ", email: "", message: "" })).toEqual({
      name: "Enter your full name.",
      email: "Enter your email address.",
      message: "Enter a message.",
    });
    expect(validateContact({ name: "A", email: "a@b", message: "Hi" }).email).toMatch(/valid/);
    expect(validateContact({ name: "A", email: "a@b.co", message: "Hi" })).toEqual({});
  });

  it("accepts only an https endpoint", () => {
    expect(contactEndpoint(undefined)).toBeNull();
    expect(contactEndpoint("  ")).toBeNull();
    expect(contactEndpoint("http://forms.example.test")).toBeNull();
    expect(contactEndpoint("not a url")).toBeNull();
    expect(contactEndpoint(ENDPOINT)).toBe(ENDPOINT);
  });

  it("reports success only for a confirmed 2xx answer", async () => {
    const answer = (status: number, body: unknown) =>
      vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
    const fields = { name: "A", email: "a@b.co", message: "Hi", honeypot: "" };
    expect(await submitContact(ENDPOINT, fields, answer(200, { ok: true }))).toEqual({ ok: true });
    expect(await submitContact(ENDPOINT, fields, answer(200, { ok: false }))).toEqual({
      ok: false,
      reason: "rejected",
    });
    expect(await submitContact(ENDPOINT, fields, answer(422, {}))).toEqual({
      ok: false,
      reason: "rejected",
    });
    const offline = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    expect(await submitContact(ENDPOINT, fields, offline)).toEqual({
      ok: false,
      reason: "network",
    });
  });

  it("gives up after the timeout and says so", async () => {
    const hang = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init!.signal!.addEventListener("abort", () => reject(new Error("aborted"))),
        ),
    );
    const result = await submitContact(
      ENDPOINT,
      { name: "A", email: "a@b.co", message: "Hi", honeypot: "" },
      hang as unknown as typeof fetch,
      20,
    );
    expect(result).toEqual({ ok: false, reason: "timeout" });
  });

  it("sends the trimmed fields and the honeypot as JSON", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    await submitContact(
      ENDPOINT,
      { name: " Ada ", email: " a@b.co ", message: " Hello ", honeypot: "" },
      fetcher,
    );
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe(ENDPOINT);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({
      name: "Ada",
      email: "a@b.co",
      message: "Hello",
      _gotcha: "",
    });
  });
});

describe("ContactForm", () => {
  it("shows a clear message under each invalid field and focuses the first", async () => {
    await renderForm("");
    submit();
    expect(screen.getByTestId("contact-error-name").textContent).toBe("Enter your full name.");
    expect(screen.getByTestId("contact-error-email").textContent).toBe("Enter your email address.");
    expect(screen.getByTestId("contact-error-message").textContent).toBe("Enter a message.");
    const name = screen.getByLabelText("Full name");
    expect(document.activeElement).toBe(name);
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(name.getAttribute("aria-describedby")).toBe(screen.getByTestId("contact-error-name").id);
  });

  it("never claims success when no endpoint is configured", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await renderForm("");
    expect(screen.getByTestId("contact-unconfigured")).toBeDefined();
    fill("Ada", "ada@example.com", "Hello");
    submit();
    expect(screen.getByTestId("contact-unavailable").textContent).toMatch(/not sent/);
    expect(screen.queryByTestId("contact-success")).toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("disables the button while sending, then confirms delivery", async () => {
    let resolve!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>((r) => (resolve = r))),
    );
    await renderForm(ENDPOINT);
    expect(screen.queryByTestId("contact-unconfigured")).toBeNull();
    fill("Ada", "ada@example.com", "Hello");
    submit();
    const button = screen.getByTestId("contact-submit");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(button.textContent).toMatch(/Sending/);
    expect(screen.getByLabelText("Full name").hasAttribute("disabled")).toBe(true);
    await act(async () => resolve(new Response('{"ok":true}', { status: 200 })));
    await waitFor(() => expect(screen.getByTestId("contact-success")).toBeDefined());
    expect(screen.getByRole("status").textContent).toMatch(/Message sent/);
  });

  it("keeps the message and shows an error when the service fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    await renderForm(ENDPOINT);
    fill("Ada", "ada@example.com", "Hello there");
    submit();
    await waitFor(() => expect(screen.getByTestId("contact-failure")).toBeDefined());
    expect(screen.getByRole("alert").textContent).toMatch(/could not be sent/);
    expect(screen.queryByTestId("contact-success")).toBeNull();
    expect((screen.getByLabelText("Your message") as HTMLTextAreaElement).value).toBe(
      "Hello there",
    );
    expect(screen.getByTestId("contact-submit").hasAttribute("disabled")).toBe(false);
  });

  it("does not write submitted details to the console", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 500 })));
    await renderForm(ENDPOINT);
    fill("Secret Name", "secret@example.com", "Secret message");
    submit();
    await waitFor(() => expect(screen.getByTestId("contact-failure")).toBeDefined());
    const logged = JSON.stringify(spies.map((s) => s.mock.calls));
    expect(logged).not.toMatch(/Secret|secret@/);
    for (const s of spies) s.mockRestore();
  });
});
