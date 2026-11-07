import { currentUser } from "@/server/auth";
import { listBoards } from "@/server/boards";
import { summariesFor } from "@/server/summaries";

/** The signed-in user's boards, with summaries for followed repositories that left the overview. */
export async function GET(request: Request) {
  const user = await currentUser(request.headers);
  if (!user) return Response.json({ user: null, boards: [], repos: [] });
  const boards = await listBoards(user.id);
  const keys = [...new Set(boards.flatMap((b) => b.repos.map((r) => r.key)))];
  return Response.json({
    user: { id: user.id, name: user.name, email: user.email, image: user.image ?? null },
    boards,
    repos: await summariesFor(keys),
  });
}
