export const PUBLIC_HOME_PATH = "/";
export const CONTACT_PATH = "/contact";
export const APP_HOME_PATH = "/app";

export function isPublicMarketingPath(pathname: string) {
  return pathname === PUBLIC_HOME_PATH || pathname === CONTACT_PATH;
}
