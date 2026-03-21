import type { CookieOptions, Request } from "express";

function isSecureRequest(req?: Request) {
  if (!req) return false;
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto)
    ? forwardedProto
    : forwardedProto.split(",");
  return protoList.some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(
  req?: Request
): Pick<CookieOptions, "domain" | "httpOnly" | "path" | "sameSite" | "secure"> {
  const secure = isSecureRequest(req);
  const domain = process.env.COOKIE_DOMAIN?.trim() || undefined;

  return {
    ...(domain ? { domain } : {}),
    httpOnly: true,
    path: "/",
    // sameSite "none" requires secure:true — on HTTP localhost use "lax" instead
    sameSite: secure ? "none" : "lax",
    secure,
  };
}
