import { redirect } from "next/navigation";

export default function YourHistoryRedirect() {
  redirect("/you/fights?tab=past");
}
