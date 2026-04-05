import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ensureUserRecord } from "@/lib/auth";

export default async function SignInContinuePage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }
  const user = await ensureUserRecord();
  redirect(user.role === "driver" ? "/driver" : "/dashboard");
}
