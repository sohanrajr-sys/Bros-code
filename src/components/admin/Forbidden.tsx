export function Forbidden({ loginId }: { loginId?: string }) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-danger">403 &mdash; Forbidden</h1>
      <p className="mt-2 text-sm text-text-muted">
        This area is restricted to admins.
        {loginId
          ? ` You're currently signed in as ${loginId}, which doesn't have admin access. Log out and sign in with an admin account to continue.`
          : " Sign in with an admin account to continue."}
      </p>
    </main>
  );
}
