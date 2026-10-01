import { ORGANIZATION_CONTEXT_COOKIE } from "./context-cookie";

export function preferredOrganizationFromCookieHeader(header: string | null) {
  const prefix = `${ORGANIZATION_CONTEXT_COOKIE}=`;
  const raw = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(prefix))?.slice(prefix.length);
  return raw && /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : null;
}
