import { redirect } from "next/navigation";

/** Sparring requests are now one category inside the consolidated Club
 * Requests inbox — see the Club redesign's "one central inbox" principle. */
export default function SparringRequestsRedirect() {
  redirect("/club/requests");
}
