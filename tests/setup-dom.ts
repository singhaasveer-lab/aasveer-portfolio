/**
 * Browser APIs that jsdom lacks but the motion hooks use. Node-environment test files have no
 * window, so nothing is installed there.
 */
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) as MediaQueryList;
  }
  if (!("IntersectionObserver" in window)) {
    class StubObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    Object.assign(window, { IntersectionObserver: StubObserver });
    Object.assign(globalThis, { IntersectionObserver: StubObserver });
  }
}
