export function Forbidden() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6">
      <h1 className="text-xl font-semibold text-danger">403 &mdash; Forbidden</h1>
      <p className="mt-2 text-sm text-text-muted">
        This area is restricted to admins. Use the role switcher above to set{" "}
        <span className="text-foreground">admin</span> while auth is stubbed out.
      </p>
    </main>
  );
}
