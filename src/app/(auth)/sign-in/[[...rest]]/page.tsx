import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <SignIn forceRedirectUrl="/sign-in/continue" />
    </div>
  );
}
