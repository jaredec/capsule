/** The site is served at jaredconnolly.com/capsule. */
export const BASE_PATH = "/capsule";

/** next/image doesn't apply basePath, so media paths from data/ need it prepended. */
export function mediaSrc(path: string): string {
  return `${BASE_PATH}${path}`;
}
