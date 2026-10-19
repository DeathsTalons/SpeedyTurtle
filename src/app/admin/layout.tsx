import { requireAdmin } from "@/lib/admin";

export const metadata = { title: "Admin · Speedy Turtle" };

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return <div className="admin-wide">{children}</div>;
}
