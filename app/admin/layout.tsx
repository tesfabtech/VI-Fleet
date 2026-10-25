import { auth } from "@/auth";
import AdminShell from "@/components/admin/admin-shell";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "SYSTEM_ADMINISTRATOR") {
    redirect("/");
  }

  return <AdminShell>{children}</AdminShell>;
}