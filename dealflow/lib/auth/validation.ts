export interface SignupValues {
  email: string;
  name?: string;
  password: string;
}

export type Validation<T> =
  | { ok: true; value: T }
  | { ok: false; errors: Record<string, string> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignup(input: unknown): Validation<SignupValues> {
  const errors: Record<string, string> = {};
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: { _: "Body must be a JSON object" } };
  }
  const body = input as Record<string, unknown>;

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name =
    typeof body.name === "string" && body.name.trim().length > 0
      ? body.name.trim()
      : undefined;

  if (!email) errors.email = "Email is required";
  else if (!EMAIL_RE.test(email)) errors.email = "Email is not valid";

  if (!password) errors.password = "Password is required";
  else if (password.length < 8)
    errors.password = "Password must be at least 8 characters";

  if (name !== undefined && name.length > 120)
    errors.name = "Name must be 120 characters or fewer";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { email, password, name } };
}
