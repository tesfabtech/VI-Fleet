import HeaderClient from "./header-client";

export default async function Header() {
  let session = null;

  if (process.env.DATABASE_URL) {
    try {
      const { auth } = await import("@/auth");
      session = await auth();
    } catch {
      session = null;
    }
  }

  return (
    <HeaderClient
      user={
        session?.user
          ? {
              name: session.user.name,
              role: session.user.role,
            }
          : undefined
      }
    />
  );
}
