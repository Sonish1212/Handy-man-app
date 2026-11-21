// Bound requests so a disconnected phone can recover instead of spinning
// forever. Preserve caller cancellation, and always release timers/listeners.
export async function fetchWithTimeout(input, init = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const signal = init.signal;
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
