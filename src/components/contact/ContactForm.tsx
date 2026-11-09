"use client";

import { useId, useRef, useState } from "react";
import {
  contactEndpoint,
  LIMITS,
  submitContact,
  validateContact,
  type ContactErrors,
  type ContactFields,
} from "@/lib/contact";

// Inlined at build time. Never a secret: form-service endpoints are public by design.
const ENDPOINT = contactEndpoint(process.env.NEXT_PUBLIC_CONTACT_FORM_ENDPOINT);
const DEV = process.env.NODE_ENV !== "production";

type Status = "idle" | "sending" | "sent" | "failed" | "unavailable";

const EMPTY: ContactFields = { name: "", email: "", message: "" };

const FIELDS: {
  key: keyof ContactFields;
  label: string;
  placeholder: string;
  type?: string;
  autoComplete: string;
}[] = [
  { key: "name", label: "Full name", placeholder: "Enter your full name", autoComplete: "name" },
  {
    key: "email",
    label: "Email address",
    placeholder: "Enter your email address",
    type: "email",
    autoComplete: "email",
  },
  {
    key: "message",
    label: "Your message",
    placeholder: "Tell me what you'd like to discuss...",
    autoComplete: "off",
  },
];

/**
 * The contact form. It validates as you go, sends to the configured form service and reports
 * success only once the service confirms it. Without an endpoint it says so and never pretends a
 * message was sent. Nothing typed here is logged or stored by the page.
 */
export function ContactForm() {
  const id = useId();
  const form = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<ContactFields>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<keyof ContactFields, boolean>>>({});
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState("");

  const update = (key: keyof ContactFields, value: string) => {
    const next = { ...fields, [key]: value };
    setFields(next);
    if (touched[key]) setErrors(validateContact(next));
    if (status === "failed" || status === "unavailable") setStatus("idle");
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === "sending") return;
    const found = validateContact(fields);
    setErrors(found);
    setTouched({ name: true, email: true, message: true });
    const first = FIELDS.find((f) => found[f.key]);
    if (first) {
      form.current?.querySelector<HTMLElement>(`[name="${first.key}"]`)?.focus();
      return;
    }
    if (!ENDPOINT) {
      setStatus("unavailable");
      return;
    }
    setStatus("sending");
    const honeypot = form.current?.querySelector<HTMLInputElement>('[name="_gotcha"]')?.value ?? "";
    const result = await submitContact(ENDPOINT, { ...fields, honeypot });
    if (result.ok) {
      setStatus("sent");
      setFields(EMPTY);
      setTouched({});
      return;
    }
    // The typed message stays in place on every failure, so nothing has to be written again.
    setFailure(
      result.fields
        ? "Your message was not sent. Check the highlighted field and try again."
        : result.reason === "timeout"
          ? "The message service took too long to respond. Your message was not sent; please try again."
          : result.reason === "rate-limited"
            ? "Too many messages were sent in a short time. Your message was not sent; please wait a few minutes and try again."
            : "Your message could not be sent. Nothing was delivered; please try again in a moment.",
    );
    setStatus("failed");
    if (result.fields) {
      const rejected = result.fields;
      setErrors(rejected);
      const firstRejected = FIELDS.find((f) => rejected[f.key]);
      // Focus after the inputs are re-enabled on the next render.
      if (firstRejected) {
        requestAnimationFrame(() =>
          form.current?.querySelector<HTMLElement>(`[name="${firstRejected.key}"]`)?.focus(),
        );
      }
    }
  };

  if (status === "sent") {
    return (
      <div className="cf cf-done" role="status" data-testid="contact-success">
        <p className="cf-done-mark" aria-hidden="true">
          ✓
        </p>
        <p className="cf-done-title">Message sent.</p>
        <p className="cf-done-text">
          Thank you for getting in touch. The message service confirmed your message was delivered.
        </p>
        <button
          type="button"
          className="btn btn-outline btn-caps"
          onClick={() => setStatus("idle")}
        >
          Send another message
        </button>
      </div>
    );
  }

  const sending = status === "sending";
  return (
    <form
      ref={form}
      className="cf"
      data-testid="contact-form"
      noValidate
      onSubmit={onSubmit}
      // Without JavaScript the browser posts straight to the service, when one is configured.
      action={ENDPOINT ?? undefined}
      method="POST"
      aria-busy={sending}
    >
      <div className="cf-head">
        <p className="cf-head-label">
          <span className="cf-dot" data-ready={ENDPOINT ? "true" : "false"} aria-hidden="true" />
          New message
        </p>
        <p className="cf-head-note">All fields are required</p>
      </div>

      {!ENDPOINT && (
        <p className="cf-notice" data-testid="contact-unconfigured">
          {DEV
            ? "Development: NEXT_PUBLIC_CONTACT_FORM_ENDPOINT is not set, so this form cannot send messages. See .env.example."
            : "This form is not accepting messages yet. My GitHub and LinkedIn profiles are linked alongside it."}
        </p>
      )}

      <div className="cf-grid">
        {FIELDS.map((field) => {
          const error = touched[field.key] ? errors[field.key] : undefined;
          const inputId = `${id}-${field.key}`;
          const errorId = `${inputId}-error`;
          const shared = {
            id: inputId,
            name: field.key,
            placeholder: field.placeholder,
            autoComplete: field.autoComplete,
            required: true,
            maxLength: LIMITS[field.key],
            value: fields[field.key],
            disabled: sending,
            "aria-invalid": error ? true : undefined,
            "aria-describedby": error ? errorId : undefined,
            className: "cf-input",
            onChange: (
              e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>,
            ) => update(field.key, e.target.value),
            onBlur: () => {
              setTouched((t) => ({ ...t, [field.key]: true }));
              setErrors(validateContact(fields));
            },
          };
          return (
            <div key={field.key} className={`cf-field cf-field-${field.key}`}>
              <label htmlFor={inputId} className="cf-label">
                {field.label}
              </label>
              {field.key === "message" ? (
                <textarea {...shared} rows={7} />
              ) : (
                <input {...shared} type={field.type ?? "text"} />
              )}
              {error && (
                <p id={errorId} className="cf-error" data-testid={`contact-error-${field.key}`}>
                  {error}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* The honeypot: hidden from people and assistive technology, tempting to bots. */}
      <div className="cf-trap" aria-hidden="true">
        <label htmlFor={`${id}-gotcha`}>Leave this field empty</label>
        <input id={`${id}-gotcha`} name="_gotcha" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="cf-actions">
        <button
          type="submit"
          className="btn btn-primary btn-caps cf-submit"
          disabled={sending}
          data-testid="contact-submit"
        >
          {sending ? (
            <>
              <span className="cf-spinner" aria-hidden="true" />
              Sending…
            </>
          ) : (
            <>
              Send message <span aria-hidden="true">→</span>
            </>
          )}
        </button>
        <div aria-live="assertive" className="cf-feedback">
          {status === "failed" && (
            <p className="cf-alert" role="alert" data-testid="contact-failure">
              {failure}
            </p>
          )}
          {status === "unavailable" && (
            <p className="cf-alert" role="alert" data-testid="contact-unavailable">
              The message was not sent: this form is not connected to a message service yet.
            </p>
          )}
        </div>
      </div>
    </form>
  );
}
