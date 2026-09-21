"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type LoginFormProps = {
  nextPath: string;
};

type AuthMode = "signin" | "signup";
type FieldErrors = Record<string, string[]>;

export default function LoginForm({ nextPath }: LoginFormProps) {
  const router = useRouter();
  const [authMode, setAuthMode] = useState<AuthMode>("signin");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const isSignup = authMode === "signup";

  function changeMode(nextMode: AuthMode) {
    setAuthMode(nextMode);
    setFieldErrors({});
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);

    setFieldErrors({});
    setMessage("");
    setPending(true);

    try {
      if (isSignup) {
        await handleSignup(formData);
        return;
      }

      const result = await signIn("credentials", {
        redirect: false,
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        callbackUrl: nextPath,
      });

      if (!result?.ok) {
        setMessage(
          result?.error === "CredentialsSignin"
            ? "Invalid email or password."
            : "Unable to sign in right now. Please try again.",
        );
        return;
      }

      router.push(result.url ?? nextPath);
      router.refresh();
    } catch {
      setMessage("Unable to sign in right now. Please try again.");
    } finally {
      setPending(false);
    }
  }

  async function handleSignup(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        email,
        password,
        businessLegalName: String(formData.get("businessLegalName") ?? ""),
        businessGstin: String(formData.get("businessGstin") ?? ""),
      }),
    });
    const responseBody: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const apiFieldErrors = getFieldErrors(responseBody);
      setFieldErrors(apiFieldErrors);
      setMessage(
        hasFieldErrors(apiFieldErrors)
          ? "Please fix the highlighted fields."
          : getApiErrorMessage(responseBody),
      );
      return;
    }

    const signInResult = await signIn("credentials", {
      redirect: false,
      email,
      password,
      callbackUrl: nextPath,
    });

    if (!signInResult?.ok) {
      changeMode("signin");
      setMessage("Account created. Sign in to continue.");
      return;
    }

    router.push(signInResult.url ?? nextPath);
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 rounded-xl border border-border bg-surface p-6 shadow-card"
    >
      <div className="grid grid-cols-2 rounded-lg border border-border bg-surface-muted p-1">
        <button
          type="button"
          onClick={() => changeMode("signin")}
          aria-pressed={!isSignup}
          className={`h-9 rounded-md text-sm font-semibold transition-all ${
            !isSignup
              ? "bg-surface text-foreground shadow-card"
              : "text-slate-500 hover:text-foreground"
          }`}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => changeMode("signup")}
          aria-pressed={isSignup}
          className={`h-9 rounded-md text-sm font-semibold transition-all ${
            isSignup
              ? "bg-surface text-foreground shadow-card"
              : "text-slate-500 hover:text-foreground"
          }`}
        >
          Create account
        </button>
      </div>

      {isSignup ? (
        <>
          <div className="mt-5">
            <label
              htmlFor="name"
              className="text-sm font-medium text-foreground"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              required
              aria-describedby={fieldErrors.name ? "name-error" : undefined}
              className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <FieldError id="name-error" errors={fieldErrors.name} />
          </div>

          <div className="mt-4">
            <label
              htmlFor="businessLegalName"
              className="text-sm font-medium text-foreground"
            >
              Business legal name
            </label>
            <input
              id="businessLegalName"
              name="businessLegalName"
              type="text"
              autoComplete="organization"
              required
              aria-describedby={
                fieldErrors.businessLegalName
                  ? "businessLegalName-error"
                  : undefined
              }
              className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <FieldError
              id="businessLegalName-error"
              errors={fieldErrors.businessLegalName}
            />
          </div>

          <div className="mt-4">
            <label
              htmlFor="businessGstin"
              className="text-sm font-medium text-foreground"
            >
              Business GSTIN
            </label>
            <input
              id="businessGstin"
              name="businessGstin"
              type="text"
              autoComplete="off"
              autoCapitalize="characters"
              required
              maxLength={15}
              aria-describedby={
                fieldErrors.businessGstin ? "businessGstin-error" : undefined
              }
              className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm uppercase text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <FieldError
              id="businessGstin-error"
              errors={fieldErrors.businessGstin}
            />
          </div>
        </>
      ) : null}

      <div className={isSignup ? "mt-4" : "mt-5"}>
        <label
          htmlFor="email"
          className="text-sm font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
          className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <FieldError id="email-error" errors={fieldErrors.email} />
      </div>

      <div className="mt-4">
        <label
          htmlFor="password"
          className="text-sm font-medium text-foreground"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          required
          aria-describedby={
            fieldErrors.password ? "password-error" : undefined
          }
          className="mt-2 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
        <FieldError id="password-error" errors={fieldErrors.password} />
      </div>

      {message ? (
        <p className="mt-4 text-sm text-error-foreground">{message}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary-hover active:translate-y-px disabled:pointer-events-none disabled:opacity-50"
      >
        {pending
          ? isSignup
            ? "Creating account..."
            : "Signing in..."
          : isSignup
            ? "Create account"
            : "Sign in"}
      </button>
    </form>
  );
}

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) {
    return null;
  }

  return (
    <p id={id} className="mt-1 text-sm text-error-foreground">
      {errors[0]}
    </p>
  );
}

function getFieldErrors(responseBody: unknown): FieldErrors {
  if (!isRecord(responseBody)) {
    return {};
  }

  const error = responseBody.error;

  if (!isRecord(error) || !isRecord(error.details)) {
    return {};
  }

  return Object.entries(error.details).reduce<FieldErrors>(
    (fieldErrors, [field, errors]) => {
      if (Array.isArray(errors)) {
        const messages = errors.filter(
          (error): error is string => typeof error === "string",
        );

        if (messages.length > 0) {
          fieldErrors[field] = messages;
        }
      }

      return fieldErrors;
    },
    {},
  );
}

function getApiErrorMessage(responseBody: unknown) {
  if (!isRecord(responseBody) || !isRecord(responseBody.error)) {
    return "Unable to create your account right now. Please try again.";
  }

  return typeof responseBody.error.message === "string"
    ? responseBody.error.message
    : "Unable to create your account right now. Please try again.";
}

function hasFieldErrors(fieldErrors: FieldErrors) {
  return Object.keys(fieldErrors).length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
