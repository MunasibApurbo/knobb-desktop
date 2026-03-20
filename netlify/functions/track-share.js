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
    return `Listen to ${title} by ${artist} from ${album} on Knobb.`;
  }

  return `Listen to ${title} by ${artist} on Knobb.`;
}

function buildEmbedUrl(siteOrigin, trackId, query) {
  const embedQuery = new URLSearchParams();
  ["title", "artist", "album", "cover", "theme", "size"].forEach((key) => {
    const value = String(query[key] || "").trim();
    if (value) embedQuery.set(key, value);
  });

  const queryString = embedQuery.toString();
  return `${siteOrigin}/embed/track/${encodeURIComponent(trackId)}${queryString ? `?${queryString}` : ""}`;
}

function buildHtml({
  siteOrigin,
  shareUrl,
  redirectUrl,
  embedUrl,
  title,
  artist,
  album,
  imageUrl,
  description,
}) {
  const safeTitle = escapeHtml(`${title} - ${artist} • Knobb`);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(imageUrl);
  const safeShareUrl = escapeHtml(shareUrl);
  const safeRedirectUrl = escapeHtml(redirectUrl);
  const safeEmbedUrl = escapeHtml(embedUrl);
  const safeTrackTitle = escapeHtml(title);
  const safeArtist = escapeHtml(artist);
  const safeAlbum = escapeHtml(album);
  const safeBrand = escapeHtml(`${siteOrigin}/brand/logo-k-black-square-512.png`);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${safeDescription}" />
    <link rel="canonical" href="${safeShareUrl}" />

    <meta property="og:site_name" content="Knobb" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:type" content="music.song" />
    <meta property="og:title" content="${safeTitle}" />
    <meta property="og:description" content="${safeDescription}" />
    <meta property="og:url" content="${safeShareUrl}" />
    <meta property="og:image" content="${safeImage}" />
    <meta property="og:image:alt" content="${safeTrackTitle} cover art" />

    <meta name="twitter:card" content="player" />
    <meta name="twitter:title" content="${safeTitle}" />
    <meta name="twitter:description" content="${safeDescription}" />
    <meta name="twitter:image" content="${safeImage}" />
    <meta name="twitter:player" content="${safeEmbedUrl}" />
    <meta name="twitter:player:width" content="640" />
    <meta name="twitter:player:height" content="352" />

    <meta http-equiv="refresh" content="0;url=${safeRedirectUrl}" />

    <style>
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #090909;
        color: #fff;
        font-family: Outfit, system-ui, sans-serif;
      }
      .card {
        width: min(560px, calc(100vw - 32px));
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 28px;
        background: rgba(255,255,255,0.04);
        padding: 24px;
        box-shadow: 0 30px 120px rgba(0,0,0,0.45);
      }
      .meta {
        display: flex;
        gap: 16px;
        align-items: center;
      }
      .meta img.cover {
        width: 92px;
        height: 92px;
        border-radius: 18px;
        object-fit: cover;
        background: #111;
      }
      .meta img.brand {
        width: 36px;
        height: 36px;
        border-radius: 999px;
        object-fit: cover;
      }
      .body {
        min-width: 0;
        flex: 1;
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
        background: #1ed760;
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
    <main class="card">
      <div class="meta">
        <img class="cover" src="${safeImage}" alt="" />
        <div class="body">
          <h1>${safeTrackTitle}</h1>
          <p>${safeArtist}</p>
          ${safeAlbum ? `<p class="album">${safeAlbum}</p>` : ""}
        </div>
        <img class="brand" src="${safeBrand}" alt="Knobb" />
      </div>
      <a href="${safeRedirectUrl}">Open in Knobb</a>
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
  const title = String(query.title || "Track").trim() || "Track";
  const artist = String(query.artist || "Unknown artist").trim() || "Unknown artist";
  const album = String(query.album || "").trim();
  const cover = String(query.cover || "").trim();
  const redirectPath = String(query.redirect || "/").trim() || "/";

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
  if (title) publicQuery.set("title", title);
  if (artist) publicQuery.set("artist", artist);
  if (album) publicQuery.set("album", album);
  if (cover) publicQuery.set("cover", cover);
  if (redirectPath) publicQuery.set("redirect", redirectPath);
  const shareUrl = `${siteOrigin}/track/${encodeURIComponent(trackId)}${publicQuery.toString() ? `?${publicQuery.toString()}` : ""}`;
  const redirectUrl = toAbsoluteUrl(siteOrigin, redirectPath);
  const embedUrl = buildEmbedUrl(siteOrigin, trackId, query);
  const imageUrl = toAbsoluteUrl(siteOrigin, cover || DEFAULT_IMAGE_PATH);
  const description = buildDescription({ title, artist, album });

  return {
    statusCode: 200,
    headers: DEFAULT_HEADERS,
    body: buildHtml({
      siteOrigin,
      shareUrl,
      redirectUrl,
      embedUrl,
      title,
      artist,
      album,
      imageUrl,
      description,
    }),
  };
}
