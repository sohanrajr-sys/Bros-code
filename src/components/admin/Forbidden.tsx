export function Forbidden({
  loginId,
  restrictedTo = "admins",
}: {
  loginId?: string;
  restrictedTo?: string;
}) {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-danger">403 &mdash; Forbidden</h1>
      <p className="mt-2 text-sm text-text-muted">
        This area is restricted to {restrictedTo}.
        {loginId
          ? ` You're currently signed in as ${loginId}, which doesn't have access. Log out and sign in with a ${restrictedTo.replace(/s$/, "")} account to continue.`
          : ` Sign in with a ${restrictedTo.replace(/s$/, "")} account to continue.`}
      </p>
    </main>
  );
}
