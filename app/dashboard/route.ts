import { auth } from "@/auth";
import { getDashboardPath } from "@/lib/dashboard";
import { redirect } from "next/navigation";

export async function GET() {
  const session = await auth();

  if (!session?.user?.role) {
    redirect("/login");
  }

  redirect(getDashboardPath(session.user.role));
}