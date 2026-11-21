import { redirect } from "next/navigation";

// Admins now sign in with their normal account; admin access comes from the Cognito "admins" group.
export default function AdminLoginPage() {
  redirect("/login?returnTo=/admin");
}
