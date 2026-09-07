import { getActor } from "@/lib/actor";
import { TabBar } from "@/components/nav/TabBar";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const actor = await getActor();

  return (
    <div className="min-h-screen pb-24">
      <main className="mx-auto w-full max-w-md px-4 pt-6">{children}</main>
      <TabBar activeHat={actor?.activeHat ?? null} />
    </div>
  );
}
