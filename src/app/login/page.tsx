import { AuthForms } from "./auth-forms";

export const metadata = { title: "Sign in · Speedy Turtle" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <div className="max-w-md mx-auto pt-6">
      <h1 className="text-3xl font-extrabold mb-2">Your groceries, shopped by Cody</h1>
      <p className="text-muted mb-6">Sign in to start an order from Kroger, Meijer, or both.</p>
      <AuthForms next={typeof next === "string" ? next : "/shop"} />
    </div>
  );
}
