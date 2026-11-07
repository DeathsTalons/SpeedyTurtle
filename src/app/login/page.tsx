import { AuthForms } from "./auth-forms";

export const metadata = { title: "Sign in · Redbird Grocery" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <div className="max-w-md mx-auto pt-6">
      <h1 className="text-3xl font-extrabold mb-2">Hi, I&apos;m Cody. Let&apos;s get your groceries.</h1>
      <p className="text-muted mb-6">Sign in to start an order from Kroger, Meijer, or both. I&apos;ll shop it myself.</p>
      <AuthForms next={typeof next === "string" ? next : "/shop"} />
    </div>
  );
}
