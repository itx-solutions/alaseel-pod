import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/sign-in/continue");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-gray-50 px-4 py-16">
      <h1 className="text-2xl font-bold text-gray-900">Mazati POD</h1>
      <p className="mt-2 max-w-md text-center text-sm text-gray-600">
        Proof of Delivery for Mazati / Al Aseel Food Services
      </p>
      <Link
        href="/sign-in"
        className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg px-6 text-sm font-medium text-white transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#51836D" }}
      >
        Sign in
      </Link>
    </div>
  );
}
