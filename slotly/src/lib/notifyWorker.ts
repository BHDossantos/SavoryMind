import {
  MAX_ATTEMPTS,
  claimPending,
  dispatch,
  markDelivered,
  markFailed,
} from "./notifications";

const TICK_MS = 5000;
const BATCH_SIZE = 10;

declare global {
  // eslint-disable-next-line no-var
  var __slotlyNotifyWorker:
    | { interval: NodeJS.Timeout; running: boolean; tick: () => Promise<void> }
    | undefined;
}

async function tick(): Promise<void> {
  const state = global.__slotlyNotifyWorker;
  if (!state || state.running) return;
  state.running = true;
  try {
    const rows = claimPending(BATCH_SIZE);
    for (const row of rows) {
      try {
        await dispatch(row);
        markDelivered(row.id);
      } catch (err) {
        markFailed(row.id, row.attempts, err);
        if (row.attempts + 1 >= MAX_ATTEMPTS) {
          console.error(
            `[notify-worker] giving up on notification ${row.id} after ${MAX_ATTEMPTS} attempts`,
          );
        }
      }
    }
  } finally {
    state.running = false;
  }
}

export function startWorker(): void {
  if (global.__slotlyNotifyWorker) return;
  const state = {
    interval: undefined as unknown as NodeJS.Timeout,
    running: false,
    tick,
  };
  global.__slotlyNotifyWorker = state;
  state.interval = setInterval(() => {
    void tick();
  }, TICK_MS);
  // First tick a beat after boot so we don't race the rest of init.
  setTimeout(() => void tick(), 250);
  console.log(`[notify-worker] started, ticking every ${TICK_MS}ms`);
}

/** For tests: drain the queue synchronously without waiting for the interval. */
export async function drainOnce(): Promise<void> {
  await tick();
}
