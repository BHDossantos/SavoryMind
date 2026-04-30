import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getSession } from "@/lib/auth";

export default async function SignupPage() {
  if (await getSession()) redirect("/dashboard");
  return (
    <div className="space-y-6">
      <AuthForm mode="signup" />
      <p className="text-center text-sm text-ink/60">
        Already a member?{" "}
        <Link href="/login" className="underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
