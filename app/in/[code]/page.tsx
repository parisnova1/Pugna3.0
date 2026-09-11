import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { checkInViewer } from "@/lib/actions/eventCheckin";
import { CheckInResultScreen } from "@/components/checkin/CheckInResultScreen";

export default async function CheckInCodePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const actor = await getActor();

  if (!actor) {
    redirect(`/account?returnTo=${encodeURIComponent(`/in/${code}`)}`);
  }

  // Scanning the QR / opening this link *is* the explicit check-in action —
  // no extra button needed here.
  const result = await checkInViewer({ code, source: "QR" });
  return <CheckInResultScreen result={result} />;
}
