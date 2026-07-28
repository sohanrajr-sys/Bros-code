import { getSessionUserFromCookies } from "@/lib/session";
import { Forbidden } from "@/components/admin/Forbidden";
import { QuizForm } from "@/components/admin/QuizForm";

export default async function NewQuizPage() {
  const user = await getSessionUserFromCookies();
  if (!user || user.role !== "admin") {
    return <Forbidden />;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-foreground">New quiz</h1>
      <div className="mt-6">
        <QuizForm mode="create" />
      </div>
    </main>
  );
}
