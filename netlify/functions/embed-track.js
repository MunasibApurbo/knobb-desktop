const DEFAULT_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=300",
};

const DEFAULT_SITE_ORIGIN = "https://knobb.netlify.app";
const DEFAULT_IMAGE_PATH = "/brand/knobb-share.png";

function getSiteOrigin(event) {
  const configured = process.env.VITE_SITE_URL?.trim();
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Fall through to request-derived origin.
    }
  }

  const host = event.headers["x-forwarded-host"] || event.headers.host;
  const protocol = event.headers["x-forwarded-proto"] || "https";
  return host ? `${protocol}://${host}` : DEFAULT_SITE_ORIGIN;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toAbsoluteUrl(origin, value) {
  if (!value) return `${origin}${DEFAULT_IMAGE_PATH}`;

  try {
    return new URL(value).toString();
  } catch {
    return new URL(value, origin).toString();
  }
}

function buildDescription({ title, artist, album }) {
  if (album) {
    return `Embedded track player for ${title} by ${artist} from ${album}.`;
  }

  return `Embedded track player for ${title} by ${artist}.`;
}

function buildRedirectUrl(siteOrigin, trackId, query) {
  const redirectQuery = new URLSearchParams();
  ["title", "artist", "album", "cover", "theme", "size"].forEach((key) => {
    const value = query[key];
    if (value) redirectQuery.set(key, value);
  });

  const queryString = redirectQuery.toString();
  return `${siteOrigin}/embed-player/track/${encodeURIComponent(trackId)}${queryString ? `?${queryString}` : ""}`;
}

function buildHtml({
  publicUrl,
  redirectUrl,
  title,
  artist,
  album,
  imageUrl,
  description,
}) {
  const safeTitle = escapeHtml(`${title} - ${artist} • Knobb`);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(imageUrl);
  const safePublicUrl = escapeHtml(publicUrl);
  const safeRedirectUrl = escapeHtml(redirectUrl);
  const safeTrackTitle = escapeHtml(title);
  const safeArtist = escapeHtml(artist);
  const safeAlbum = escapeHtml(album);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safePublicUrl}" />

    <meta property="og:site_name" content="Knobb" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:type" content="music.song" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safePublicUrl}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeTrackTitle} cover art" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />

    <meta http-equiv="refresh" content="0;url=${safeRedirectUrl}" />

    <style>
      :root {
        color-scheme: dark;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #090909;
        color: #fff;
        font-family: Outfit, system-ui, sans-serif;
      }
      .shell {
        width: min(560px, calc(100vw - 32px));
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 28px;
        background: rgba(255,255,255,0.04);
        padding: 24px;
        box-shadow: 0 30px 120px rgba(0,0,0,0.45);
      }
      .meta {
        display: grid;
        gap: 16px;
        grid-template-columns: 92px minmax(0, 1fr);
        align-items: center;
      }
      img {
        width: 92px;
        height: 92px;
        border-radius: 18px;
        object-fit: cover;
        background: #111;
      }
      h1 {
        margin: 0;
        font-size: 32px;
        line-height: 1;
        font-weight: 800;
      }
      p {
        margin: 8px 0 0;
        color: rgba(255,255,255,0.72);
        font-size: 18px;
      }
      .album {
        color: rgba(255,255,255,0.48);
        font-size: 14px;
      }
      a {
        display: inline-flex;
        margin-top: 18px;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 0 18px;
        border-radius: 999px;
        background: #d3b36a;
        color: #000;
        font-weight: 700;
        text-decoration: none;
      }
    </style>
    <script>
      window.location.replace(${JSON.stringify(redirectUrl)});
    </script>
  </head>
  <body>
    <main class="shell">
      <div class="meta">
        <img src="${safeImage}" alt="" />
        <div>
          <h1>${safeTrackTitle}</h1>
          <p>${safeArtist}</p>
          ${safeAlbum ? `<p class="album">${safeAlbum}</p>` : ""}
        </div>
      </div>
      <a href="${safeRedirectUrl}">Open embed</a>
    </main>
  </body>
</html>`;
}

export async function handler(event) {
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: DEFAULT_HEADERS,
      body: "Method not allowed",
    };
  }

  const siteOrigin = getSiteOrigin(event);
  const query = event.queryStringParameters || {};
  const trackId = String(query.trackId || "").trim();
  if (!trackId) {
    return {
      statusCode: 302,
      headers: {
        ...DEFAULT_HEADERS,
        Location: "/",
      },
      body: "",
    };
  }

  const publicQuery = new URLSearchParams();
  ["title", "artist", "album", "cover", "theme", "size"].forEach((key) => {
    const value = String(query[key] || "").trim();
    if (value) publicQuery.set(key, value);
  });

  const title = String(query.title || "Track").trim() || "Track";
  const artist = String(query.artist || "Unknown artist").trim() || "Unknown artist";
  const album = String(query.album || "").trim();
  const cover = String(query.cover || "").trim();
  const publicUrl = `${siteOrigin}/embed/track/${encodeURIComponent(trackId)}${publicQuery.toString() ? `?${publicQuery.toString()}` : ""}`;
  const redirectUrl = buildRedirectUrl(siteOrigin, trackId, query);
  const imageUrl = toAbsoluteUrl(siteOrigin, cover || DEFAULT_IMAGE_PATH);
  const description = buildDescription({ title, artist, album });

  return {
    statusCode: 200,
    headers: DEFAULT_HEADERS,
    body: buildHtml({
      publicUrl,
      redirectUrl,
      title,
      artist,
      album,
      imageUrl,
      description,
    }),
  };
}
