/**
 * Next.js calls register() once per server process at boot. We use it to
 * start the in-process notification worker — better-sqlite3 only runs in
 * a long-lived Node server (not edge), so the runtime guard below is just
 * defense in depth.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startWorker } = await import("./lib/notifyWorker");
  startWorker();
}
