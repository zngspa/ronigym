import { createServerFn } from "@tanstack/react-start";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Scopes requested when a coach connects their Google account.
// spreadsheets: create/edit the backup Google Sheet.
// drive.file: (reserved for future use, e.g. moving the file into a folder) — only grants access to files the app itself created.
// userinfo.email: so we can show which Google account is connected.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function requireServerEnv() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Google OAuth אינו מוגדר בשרת (חסרים משתני סביבה GOOGLE_*)");
  }
  return { clientId, clientSecret, redirectUri };
}

export const exchangeGoogleCode = createServerFn({ method: "POST" })
  .validator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    const { clientId, clientSecret, redirectUri } = requireServerEnv();

    const params = new URLSearchParams({
      code: data.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const tokenData: any = await res.json();
    if (!res.ok) {
      throw new Error(tokenData.error_description || tokenData.error || "שגיאה בקבלת אסימון מגוגל");
    }

    let email: string | null = null;
    try {
      const userRes = await fetch(USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userRes.ok) {
        const userData: any = await userRes.json();
        email = userData.email ?? null;
      }
    } catch {
      // non-fatal — connection still succeeds without a display email
    }

    return {
      access_token: tokenData.access_token as string,
      refresh_token: (tokenData.refresh_token as string | undefined) ?? null,
      expires_in: (tokenData.expires_in as number) ?? 3600,
      scope: (tokenData.scope as string) ?? GOOGLE_SCOPES,
      email,
    };
  });

export const refreshGoogleToken = createServerFn({ method: "POST" })
  .validator((data: { refreshToken: string }) => data)
  .handler(async ({ data }) => {
    const { clientId, clientSecret } = requireServerEnv();

    const params = new URLSearchParams({
      refresh_token: data.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    });

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });
    const tokenData: any = await res.json();
    if (!res.ok) {
      throw new Error(
        tokenData.error_description || tokenData.error || "שגיאה בריענון החיבור ל-Google",
      );
    }

    return {
      access_token: tokenData.access_token as string,
      expires_in: (tokenData.expires_in as number) ?? 3600,
    };
  });
