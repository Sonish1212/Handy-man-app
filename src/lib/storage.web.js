// In the browser, use its own localStorage (undefined during server rendering).
export const storage = typeof window === 'undefined' ? undefined : window.localStorage;
