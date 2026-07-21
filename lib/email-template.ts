const COLORS = {
  bg: "#f6f3ee",
  card: "#ffffff",
  border: "#e6e1d6",
  ink: "#211c15",
  mute: "#7a6f5e",
  accent: "#f2a51c",
  accentInk: "#1a1508",
};

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type EmailContent = {
  heading: string;
  intro: string;
  highlight?: string;
  details?: string[];
  quote?: string;
  cta?: { label: string; url: string };
};

function buildBodyHtml(content: EmailContent): string {
  const parts: string[] = [];

  parts.push(
    `<p style="margin:0 0 16px; font-size:15px; line-height:1.5; color:${COLORS.ink};">${escapeHtml(content.intro)}</p>`
  );

  if (content.highlight) {
    parts.push(
      `<p style="margin:0 0 16px; padding:14px 16px; border-radius:10px; background:${COLORS.bg}; border:1px solid ${COLORS.border}; font-size:16px; font-weight:700; color:${COLORS.ink};">${escapeHtml(content.highlight)}</p>`
    );
  }

  if (content.details && content.details.length > 0) {
    const items = content.details
      .map(
        (line) =>
          `<div style="margin:0 0 4px; font-size:14px; color:${COLORS.mute};">${escapeHtml(line)}</div>`
      )
      .join("");
    parts.push(`<div style="margin:0 0 16px;">${items}</div>`);
  }

  if (content.quote) {
    parts.push(
      `<p style="margin:0 0 16px; padding:12px 16px; border-left:3px solid ${COLORS.accent}; font-size:14px; line-height:1.5; color:${COLORS.ink}; font-style:italic; white-space:pre-line;">${escapeHtml(content.quote)}</p>`
    );
  }

  if (content.cta) {
    parts.push(
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
        <tr>
          <td style="border-radius:8px; background:${COLORS.accent};">
            <a href="${content.cta.url}" style="display:inline-block; padding:10px 20px; font-size:14px; font-weight:700; color:${COLORS.accentInk}; text-decoration:none;">${escapeHtml(content.cta.label)}</a>
          </td>
        </tr>
      </table>`
    );
  }

  return parts.join("\n");
}

export function buildEmailHtml(
  content: EmailContent & { preheader: string }
): string {
  const appUrl = process.env.APP_URL ?? "";
  const logo = appUrl
    ? `<img src="${appUrl}/icon-192.png" width="32" height="32" alt="" style="display:block; border-radius:7px;">`
    : "";

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0; padding:0; background:${COLORS.bg}; font-family:${FONT_STACK};">
<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.bg};">
<tr>
<td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;">
<tr>
<td style="padding-bottom:20px;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
${logo ? `<td style="padding-right:10px;">${logo}</td>` : ""}
<td style="font-size:17px; font-weight:800; color:${COLORS.ink}; font-family:${FONT_STACK};">BandMate<span style="color:${COLORS.accent};"> ●</span></td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="background:${COLORS.card}; border:1px solid ${COLORS.border}; border-radius:14px; padding:28px;">
<h1 style="margin:0 0 16px; font-size:19px; font-weight:800; color:${COLORS.ink}; font-family:${FONT_STACK};">${escapeHtml(content.heading)}</h1>
${buildBodyHtml(content)}
</td>
</tr>
<tr>
<td style="padding:20px 4px 0; text-align:center; font-size:12px; color:${COLORS.mute};">
BandMate · Internes Band-Dashboard<br>
${appUrl ? `<a href="${appUrl}/profil" style="color:${COLORS.mute};">Benachrichtigungen verwalten</a>` : ""}
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}

export function buildEmailText(content: EmailContent): string {
  const lines = [content.intro];
  if (content.highlight) lines.push("", content.highlight);
  if (content.details) lines.push(...content.details);
  if (content.quote) lines.push("", content.quote);
  if (content.cta) lines.push("", `${content.cta.label}: ${content.cta.url}`);
  return lines.join("\n");
}
