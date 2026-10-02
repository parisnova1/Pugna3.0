import Link from "next/link";
import { ForgotPasswordForm } from "@/components/account/AccountSecurityForms";

export const metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-6 pt-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Reset your password</h1>
        <p className="text-mute text-sm">Enter your account email and we&apos;ll send you a link to choose a new password.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-center text-sm text-mute">
        <Link href="/account?mode=signin" className="text-signal font-semibold underline underline-offset-2">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
