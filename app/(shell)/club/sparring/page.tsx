import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { closeSparringPost, requestSparring, respondToSparringRequest } from "@/lib/actions/sparring";
import { formatEventDate } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = { PENDING: "Pending", ACCEPTED: "Accepted", DECLINED: "Declined" };

export default async function ClubSparringPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/sparring");
  const clubId = actor.adminClubIds[0];
  if (!clubId) redirect("/club");

  const [ownPosts, openPosts] = await Promise.all([
    prisma.sparringPost.findMany({
      where: { clubId },
      orderBy: { date: "asc" },
      include: { requests: { include: { requestingClub: true } } },
    }),
    prisma.sparringPost.findMany({
      where: { status: "OPEN", clubId: { not: clubId }, date: { gte: new Date() } },
      orderBy: { date: "asc" },
      include: { club: true, requests: { where: { requestingClubId: clubId } } },
      take: 20,
    }),
  ]);

  return (
    <div className="space-y-8 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sparring</h1>
        <Link href="/club/sparring/new" className="rounded-pill bg-signal text-onsignal font-semibold px-4 py-2 text-sm">
          Post session
        </Link>
      </div>

      {ownPosts.length === 0 && openPosts.length === 0 ? (
        <p className="text-sm text-mute text-center py-10">Clubs post open sparring sessions here.</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Your posts</h2>
            {ownPosts.length === 0 ? (
              <p className="text-sm text-mute">No posts yet.</p>
            ) : (
              <div className="space-y-3">
                {ownPosts.map((post) => (
                  <div key={post.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{post.gym}</p>
                        <p className="text-xs text-mute mt-0.5">
                          {formatEventDate(post.date)} · {post.weightWindow} · {post.spots} spot{post.spots > 1 ? "s" : ""}
                        </p>
                      </div>
                      <span className="text-[11px] rounded-pill border border-white/10 px-2 py-0.5 text-mute shrink-0">
                        {post.status === "OPEN" ? "Open" : "Closed"}
                      </span>
                    </div>
                    {post.requests.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-white/10">
                        {post.requests.map((req) => (
                          <div key={req.id} className="flex items-center justify-between gap-2">
                            <p className="text-xs">
                              {req.requestingClub.name}
                              {req.status !== "PENDING" && <span className="text-mute"> · {STATUS_LABEL[req.status]}</span>}
                            </p>
                            {req.status === "PENDING" && (
                              <div className="flex gap-2 shrink-0">
                                <form
                                  action={async () => {
                                    "use server";
                                    await respondToSparringRequest(req.id, true);
                                  }}
                                >
                                  <button type="submit" className="rounded-pill bg-signal text-onsignal px-3 py-1 text-[11px] font-semibold">
                                    Accept
                                  </button>
                                </form>
                                <form
                                  action={async () => {
                                    "use server";
                                    await respondToSparringRequest(req.id, false);
                                  }}
                                >
                                  <button type="submit" className="rounded-pill border border-white/20 px-3 py-1 text-[11px] font-medium">
                                    Decline
                                  </button>
                                </form>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {post.status === "OPEN" && (
                      <form
                        action={async () => {
                          "use server";
                          await closeSparringPost(post.id, clubId);
                        }}
                      >
                        <button type="submit" className="text-xs text-mute underline">
                          Close post
                        </button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Open sessions</h2>
            {openPosts.length === 0 ? (
              <p className="text-sm text-mute">No open sessions from other clubs right now.</p>
            ) : (
              <div className="space-y-3">
                {openPosts.map((post) => {
                  const myRequest = post.requests[0] ?? null;
                  return (
                    <div key={post.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
                      <p className="text-sm font-medium">{post.club.name}</p>
                      <p className="text-xs text-mute">
                        {post.gym} · {formatEventDate(post.date)} · {post.weightWindow} · {post.spots} spot
                        {post.spots > 1 ? "s" : ""}
                      </p>
                      {post.note && <p className="text-xs text-mute">{post.note}</p>}
                      {myRequest ? (
                        <p className="text-xs text-signal">{STATUS_LABEL[myRequest.status]}</p>
                      ) : (
                        <form
                          action={async () => {
                            "use server";
                            const fd = new FormData();
                            fd.set("postId", post.id);
                            fd.set("requestingClubId", clubId);
                            await requestSparring(fd);
                          }}
                        >
                          <button type="submit" className="rounded-pill border border-white/20 text-ink font-semibold px-3 py-1.5 text-xs">
                            Request
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
