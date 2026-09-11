"use client";

/**
 * The full-screen "we have nothing to show you yet" states.
 *
 * Both station pages drew these by hand, and the error one was
 * character-for-character identical between them, `window.location.reload()`
 * included. The landing page keeps its own loading state: it sizes with
 * `min-h-screen` rather than `h-screen`, so sharing this one would have moved
 * it for no gain.
 *
 * `"use client"` is not incidental — `ErrorScreen` attaches an event handler,
 * so it can only ever be a client component. Both importers happen to carry
 * the directive already; declaring it here means a server-rendered caller gets
 * a sensible error instead of a confusing one.
 */

export function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
        <p className="text-on-surface-variant">{message}</p>
      </div>
    </div>
  );
}

/**
 * Replaces the whole screen, so it suits a failure that leaves nothing worth
 * showing — the initial load. A transient failure with usable data still on
 * screen wants a banner instead, not this.
 */
export function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex h-screen items-center justify-center bg-surface">
      <div className="text-center">
        <p className="text-error mb-4">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-primary px-6 py-2 text-on-primary"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
