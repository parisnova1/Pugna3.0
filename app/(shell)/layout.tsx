import { TabBar } from "@/components/nav/TabBar";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen pb-24">
      <main className="mx-auto w-full max-w-md px-4 pt-6">{children}</main>
      <TabBar />
    </div>
  );
}
