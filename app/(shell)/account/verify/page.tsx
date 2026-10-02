import Link from "next/link";
import { ResendVerificationButton, VerifyEmailForm } from "@/components/account/AccountSecurityForms";

export const metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; needed?: string }> }) {
  const { token, needed } = await searchParams;

  return (
    <div className="space-y-6 pt-4">
      <h1 className="text-2xl font-semibold">Confirm your email</h1>
      {token ? (
        <VerifyEmailForm token={token} />
      ) : needed ? (
        <div className="space-y-4">
          <p className="text-sm text-mute">
            Hosting events and managing clubs needs a confirmed email address. Use the link we emailed when you signed up, or
            send yourself a new one.
          </p>
          <ResendVerificationButton />
        </div>
      ) : (
        <p className="text-sm text-mute">
          This page needs the link from your confirmation email.{" "}
          <Link href="/account" className="text-signal font-semibold underline underline-offset-2">
            Go to your account
          </Link>{" "}
          to request a new one.
        </p>
      )}
    </div>
  );
}
