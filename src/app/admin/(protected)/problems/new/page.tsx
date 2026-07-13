import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";
import { ProblemForm } from "@/components/admin/ProblemForm";

export default async function NewProblemPage() {
  const user = await getSessionUserFromCookies();

  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">New problem</h1>
      <div className="mt-6">
        <ProblemForm mode="create" />
      </div>
    </main>
  );
}
