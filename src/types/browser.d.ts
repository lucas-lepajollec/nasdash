export {};

declare global {
  interface Window {
    globalEventSource?: EventSource | null;
  }
}
