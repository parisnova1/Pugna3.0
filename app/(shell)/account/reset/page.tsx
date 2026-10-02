import Link from "next/link";
import { ResetPasswordForm } from "@/components/account/AccountSecurityForms";

export const metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <p className="text-sm text-mute">
          This page needs the link from your email.{" "}
          <Link href="/account/forgot" className="text-signal font-semibold underline underline-offset-2">
            Request a new one
          </Link>
          .
        </p>
      )}
    </div>
  );
}
