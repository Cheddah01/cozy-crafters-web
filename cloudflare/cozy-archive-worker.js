const ARCHIVE_URL =
  "https://cozycrafters.net/archive.html";

const REDIRECT_URI =
  "https://cozy-archive.colbysthickey.workers.dev/auth/callback";

const STATE_COOKIE =
  "cozy_archive_oauth_state";

const STATE_MAX_AGE_SECONDS =
  10 * 60;

const SESSION_MAX_AGE_SECONDS =
  12 * 60 * 60;

const MAX_FILE_SIZE =
  8 * 1024 * 1024;

const MAX_REQUEST_SIZE =
  9 * 1024 * 1024;

const MAX_CAPTION_LENGTH =
  240;

const MAX_PENDING_PER_USER =
  5;

const MAX_UPLOADS_PER_24_HOURS =
  10;

const MAX_ADMIN_QUEUE_RESULTS =
  50;

const DEFAULT_GALLERY_LIMIT =
  24;

const MAX_GALLERY_LIMIT =
  48;

const DEFAULT_ADMIN_APPROVED_LIMIT =
  30;

const MAX_ADMIN_APPROVED_LIMIT =
  50;

const DEFAULT_MY_UPLOADS_LIMIT =
  30;

const MAX_MY_UPLOADS_LIMIT =
  50;

const MAX_TIMELINE_TITLE_LENGTH = 80;
const MAX_TIMELINE_DESCRIPTION_LENGTH = 280;
const MAX_TIMELINE_RESULTS = 500;
const MAX_TIMELINE_PERIOD_LABEL_LENGTH = 50;
const MAX_TIMELINE_PERIOD_RESULTS = 100;
const MAX_FUNDING_TITLE_LENGTH = 80;
const MAX_FUNDING_DESCRIPTION_LENGTH = 240;
const MAX_FUNDING_URL_LENGTH = 500;
const MAX_FUNDING_CENTS = 100000000;
const FUNDING_CURRENCIES = new Set(["USD", "CAD", "EUR", "GBP", "AUD", "NZD"]);

const ALLOWED_ORIGINS =
  new Set([
    "https://cozycrafters.net",
    "https://www.cozycrafters.net",
  ]);

export default {
  async fetch(request, env) {
    const url =
      new URL(request.url);

    // ==================================================
    // CONFIGURATION
    // ==================================================

    if (
      !env.DISCORD_CLIENT_ID ||
      !env.DISCORD_CLIENT_SECRET ||
      !env.ARCHIVE_SESSION_SECRET
    ) {
      return noStoreResponse(
        "Archive authentication is not configured.",
        500
      );
    }

    // ==================================================
    // CORS
    // ==================================================

    if (
      request.method === "OPTIONS"
    ) {
      return handleOptions(
        request
      );
    }

    // ==================================================
    // FAVICON
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/favicon.ico"
    ) {
      return new Response(
        null,
        {
          status: 204,
        }
      );
    }

    // ==================================================
    // HEALTH
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/"
    ) {
      return json(
        {
          ok: true,
          service: "cozy-archive",
        },
        200
      );
    }

    // ==================================================
    // PUBLIC GALLERY
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/api/gallery"
    ) {
      return handlePublicGallery(
        request,
        env
      );
    }

    const publicImageMatch =
      url.pathname.match(
        /^\/api\/gallery\/uploads\/([1-9]\d*)\/image$/
      );

    if (
      request.method === "GET" &&
      publicImageMatch
    ) {
      return handlePublicGalleryImage(
        request,
        env,
        Number(
          publicImageMatch[1]
        )
      );
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/timeline"
    ) {
      return handlePublicTimeline(request, env);
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/funding-goal"
    ) {
      return handlePublicFundingGoal(request, env);
    }

    const publicTimelineImageMatch =
      url.pathname.match(
        /^\/api\/timeline\/events\/([1-9]\d*)\/image$/
      );

    if (
      request.method === "GET" &&
      publicTimelineImageMatch
    ) {
      return handlePublicTimelineImage(
        request,
        env,
        Number(publicTimelineImageMatch[1])
      );
    }

    // ==================================================
    // AUTH
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/auth/discord"
    ) {
      return startDiscordLogin(
        env
      );
    }

    if (
      request.method === "GET" &&
      url.pathname === "/auth/callback"
    ) {
      return handleDiscordCallback(
        request,
        env
      );
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/me"
    ) {
      return handleMe(
        request,
        env
      );
    }

    // ==================================================
    // USER UPLOAD
    // ==================================================

    if (
      request.method === "POST" &&
      url.pathname === "/api/upload"
    ) {
      return handleUpload(
        request,
        env
      );
    }

    // ==================================================
    // MY UPLOADS
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/api/my/uploads"
    ) {
      return handleMyUploads(
        request,
        env
      );
    }

    const myUploadImageMatch =
      url.pathname.match(
        /^\/api\/my\/uploads\/([1-9]\d*)\/image$/
      );

    if (
      request.method === "GET" &&
      myUploadImageMatch
    ) {
      return handleMyUploadImage(
        request,
        env,
        Number(
          myUploadImageMatch[1]
        )
      );
    }

    // ==================================================
    // ADMIN: PENDING
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/api/admin/pending"
    ) {
      return handleAdminPending(
        request,
        env
      );
    }

    // ==================================================
    // ADMIN: APPROVED
    // ==================================================

    if (
      request.method === "GET" &&
      url.pathname === "/api/admin/approved"
    ) {
      return handleAdminApproved(
        request,
        env
      );
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/admin/funding-goal"
    ) {
      return handleAdminFundingGoal(request, env);
    }

    if (
      request.method === "PUT" &&
      url.pathname === "/api/admin/funding-goal"
    ) {
      return handleAdminFundingGoalUpdate(request, env);
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/admin/timeline"
    ) {
      return handleAdminTimeline(request, env);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/timeline"
    ) {
      return handleAdminTimelineCreate(request, env);
    }

    if (
      request.method === "POST" &&
      url.pathname === "/api/admin/timeline/periods"
    ) {
      return handleAdminTimelinePeriodCreate(request, env);
    }

    const adminTimelinePeriodMatch =
      url.pathname.match(
        /^\/api\/admin\/timeline\/periods\/([1-9]\d*)$/
      );

    if (
      request.method === "PUT" &&
      adminTimelinePeriodMatch
    ) {
      return handleAdminTimelinePeriodUpdate(
        request,
        env,
        Number(adminTimelinePeriodMatch[1])
      );
    }

    if (
      request.method === "DELETE" &&
      adminTimelinePeriodMatch
    ) {
      return handleAdminTimelinePeriodDelete(
        request,
        env,
        Number(adminTimelinePeriodMatch[1])
      );
    }

    const adminTimelineMatch =
      url.pathname.match(
        /^\/api\/admin\/timeline\/([1-9]\d*)$/
      );

    if (
      request.method === "PUT" &&
      adminTimelineMatch
    ) {
      return handleAdminTimelineUpdate(
        request,
        env,
        Number(adminTimelineMatch[1])
      );
    }

    if (
      request.method === "DELETE" &&
      adminTimelineMatch
    ) {
      return handleAdminTimelineDelete(
        request,
        env,
        Number(adminTimelineMatch[1])
      );
    }

    // ==================================================
    // ADMIN: PRIVATE PENDING IMAGE
    // ==================================================

    const adminImageMatch =
      url.pathname.match(
        /^\/api\/admin\/uploads\/([1-9]\d*)\/image$/
      );

    if (
      request.method === "GET" &&
      adminImageMatch
    ) {
      return handleAdminImage(
        request,
        env,
        Number(
          adminImageMatch[1]
        )
      );
    }

    // ==================================================
    // ADMIN: APPROVE
    // ==================================================

    const approveMatch =
      url.pathname.match(
        /^\/api\/admin\/uploads\/([1-9]\d*)\/approve$/
      );

    if (
      request.method === "POST" &&
      approveMatch
    ) {
      return handleAdminApprove(
        request,
        env,
        Number(
          approveMatch[1]
        )
      );
    }

    // ==================================================
    // ADMIN: REJECT
    // ==================================================

    const rejectMatch =
      url.pathname.match(
        /^\/api\/admin\/uploads\/([1-9]\d*)\/reject$/
      );

    if (
      request.method === "POST" &&
      rejectMatch
    ) {
      return handleAdminReject(
        request,
        env,
        Number(
          rejectMatch[1]
        )
      );
    }

    // ==================================================
    // ADMIN: REMOVE
    // ==================================================

    const removeMatch =
      url.pathname.match(
        /^\/api\/admin\/uploads\/([1-9]\d*)\/remove$/
      );

    if (
      request.method === "POST" &&
      removeMatch
    ) {
      return handleAdminRemove(
        request,
        env,
        Number(
          removeMatch[1]
        )
      );
    }

    return noStoreResponse(
      "Not Found",
      404
    );
  },
};


// ==================================================
// PUBLIC GALLERY
// ==================================================

async function handlePublicGallery(
  request,
  env
) {
  const corsResult =
    getCorsResult(
      request
    );

  if (!corsResult.allowed) {
    return apiJson(
      {
        error:
          "Origin not allowed.",
      },
      403,
      null
    );
  }

  if (!env.DB) {
    return apiJson(
      {
        error:
          "The Community Archive is temporarily unavailable.",
      },
      503,
      corsResult.headers
    );
  }

  const url =
    new URL(
      request.url
    );

  let limit =
    Number(
      url.searchParams.get(
        "limit"
      )
    );

  if (
    !Number.isSafeInteger(
      limit
    ) ||
    limit <= 0
  ) {
    limit =
      DEFAULT_GALLERY_LIMIT;
  }

  limit =
    Math.min(
      limit,
      MAX_GALLERY_LIMIT
    );

  const cursorRaw =
    url.searchParams.get(
      "before"
    );

  let beforeId =
    null;

  if (
    cursorRaw !== null
  ) {
    const parsed =
      Number(
        cursorRaw
      );

    if (
      !Number.isSafeInteger(
        parsed
      ) ||
      parsed <= 0
    ) {
      return apiJson(
        {
          error:
            "Invalid gallery cursor.",
        },
        400,
        corsResult.headers
      );
    }

    beforeId =
      parsed;
  }

  let result;

  try {
    if (
      beforeId === null
    ) {
      result =
        await env.DB
          .prepare(
            `
            SELECT
              id,
              discord_username,
              caption,
              mime_type,
              file_size,
              uploaded_at,
              reviewed_at

            FROM archive_uploads

            WHERE status = 'approved'

            ORDER BY id DESC

            LIMIT ?
            `
          )
          .bind(
            limit + 1
          )
          .all();
    } else {
      result =
        await env.DB
          .prepare(
            `
            SELECT
              id,
              discord_username,
              caption,
              mime_type,
              file_size,
              uploaded_at,
              reviewed_at

            FROM archive_uploads

            WHERE
              status = 'approved'
              AND id < ?

            ORDER BY id DESC

            LIMIT ?
            `
          )
          .bind(
            beforeId,
            limit + 1
          )
          .all();
    }
  } catch (error) {
    console.error(
      "Public archive gallery query failed:",
      error
    );

    return apiJson(
      {
        error:
          "The Community Archive could not be loaded.",
      },
      500,
      corsResult.headers
    );
  }

  const rows =
    Array.isArray(
      result?.results
    )
      ? result.results
      : [];

  const hasMore =
    rows.length >
    limit;

  const visibleRows =
    hasMore
      ? rows.slice(
          0,
          limit
        )
      : rows;

  const workerOrigin =
    new URL(
      request.url
    ).origin;

  const uploads =
    visibleRows.map(
      (row) => {
        const id =
          Number(
            row.id
          );

        return {
          id,

          uploader:
            String(
              row.discord_username ||
              ""
            ),

          caption:
            row.caption === null
              ? null
              : String(
                  row.caption
                ),

          mimeType:
            String(
              row.mime_type ||
              ""
            ),

          fileSize:
            Number(
              row.file_size ||
              0
            ),

          uploadedAt:
            String(
              row.uploaded_at ||
              ""
            ),

          approvedAt:
            row.reviewed_at === null
              ? null
              : String(
                  row.reviewed_at
                ),

          imageUrl:
            `${workerOrigin}/api/gallery/uploads/${id}/image`,
        };
      }
    );

  const nextCursor =
    hasMore &&
    visibleRows.length > 0
      ? Number(
          visibleRows[
            visibleRows.length - 1
          ].id
        )
      : null;

  const headers =
    corsResult.headers
      ? new Headers(
          corsResult.headers
        )
      : new Headers();

  headers.set(
    "Cache-Control",
    "public, max-age=30, stale-while-revalidate=60"
  );

  return apiJsonWithHeaders(
    {
      ok: true,
      uploads,
      hasMore,
      nextCursor,
    },
    200,
    headers
  );
}


// ==================================================
// PUBLIC APPROVED IMAGE
// ==================================================

async function handlePublicGalleryImage(
  request,
  env,
  uploadId
) {
  if (
    !env.DB ||
    !env.ARCHIVE_BUCKET
  ) {
    return noStoreResponse(
      "Archive storage unavailable.",
      503
    );
  }

  if (
    !Number.isSafeInteger(
      uploadId
    ) ||
    uploadId <= 0
  ) {
    return noStoreResponse(
      "Invalid screenshot.",
      400
    );
  }

  let row;

  try {
    row =
      await env.DB
        .prepare(
          `
          SELECT
            r2_key,
            mime_type

          FROM archive_uploads

          WHERE
            id = ?
            AND status = 'approved'

          LIMIT 1
          `
        )
        .bind(
          uploadId
        )
        .first();
  } catch (error) {
    console.error(
      "Public archive image lookup failed:",
      error
    );

    return noStoreResponse(
      "Screenshot unavailable.",
      500
    );
  }

  if (!row) {
    return noStoreResponse(
      "Screenshot not found.",
      404
    );
  }

  const r2Key =
    String(
      row.r2_key ||
      ""
    );

  if (!r2Key) {
    return noStoreResponse(
      "Screenshot unavailable.",
      500
    );
  }

  let object;

  try {
    object =
      await env.ARCHIVE_BUCKET.get(
        r2Key
      );
  } catch (error) {
    console.error(
      `Public R2 read failed for upload ${uploadId}:`,
      error
    );

    return noStoreResponse(
      "Screenshot unavailable.",
      500
    );
  }

  if (!object) {
    return noStoreResponse(
      "Screenshot not found.",
      404
    );
  }

  const contentType =
    selectImageContentType(
      object.httpMetadata?.contentType,
      row.mime_type
    );

  const headers =
    createImageHeaders(
      contentType,
      object,
      "public, max-age=3600"
    );

  headers.set(
    "Cross-Origin-Resource-Policy",
    "cross-origin"
  );

  const origin =
    request.headers.get(
      "Origin"
    );

  if (
    origin &&
    ALLOWED_ORIGINS.has(
      origin
    )
  ) {
    headers.set(
      "Access-Control-Allow-Origin",
      origin
    );

    headers.set(
      "Vary",
      "Origin"
    );
  }

  return new Response(
    object.body,
    {
      status: 200,
      headers,
    }
  );
}


// ==================================================
// COMMUNITY FUNDING GOAL
// ==================================================

async function handlePublicFundingGoal(request, env) {
  const cors = getCorsResult(request);
  if (!cors.allowed) {
    return apiJson({ error: "Origin not allowed." }, 403);
  }
  if (!env.DB) {
    return apiJson(
      { error: "The community funding goal is temporarily unavailable." },
      503,
      cors.headers
    );
  }

  try {
    const row = await getFundingGoal(env);
    if (!row) {
      return apiJson(
        { error: "The community funding goal has not been configured." },
        404,
        cors.headers
      );
    }
    const headers = new Headers(cors.headers || undefined);
    headers.set("Cache-Control", "public, max-age=30, stale-while-revalidate=60");
    return apiJsonWithHeaders(
      { ok: true, goal: fundingGoalJson(row) },
      200,
      headers
    );
  } catch (error) {
    console.error("Public funding goal query failed:", error);
    return apiJson(
      { error: "The community funding goal could not be loaded." },
      500,
      cors.headers
    );
  }
}

async function handleAdminFundingGoal(request, env) {
  const access = await requireAdmin(request, env);
  if (access.response) return access.response;
  if (!env.DB) {
    return apiJson(
      { error: "The community funding goal database is temporarily unavailable." },
      503,
      access.corsHeaders
    );
  }

  try {
    const row = await getFundingGoal(env);
    if (!row) {
      return apiJson(
        { error: "The community funding goal has not been configured." },
        404,
        access.corsHeaders
      );
    }
    return apiJson(
      { ok: true, goal: fundingGoalJson(row) },
      200,
      access.corsHeaders
    );
  } catch (error) {
    console.error("Admin funding goal query failed:", error);
    return apiJson(
      { error: "The community funding goal could not be loaded." },
      500,
      access.corsHeaders
    );
  }
}

async function handleAdminFundingGoalUpdate(request, env) {
  const access = await requireAdmin(request, env);
  if (access.response) return access.response;
  if (!env.DB) {
    return apiJson(
      { error: "The community funding goal database is temporarily unavailable." },
      503,
      access.corsHeaders
    );
  }

  const parsed = await parseFundingGoalJson(request, access.corsHeaders);
  if (parsed.error) return parsed.error;

  try {
    await env.DB.prepare(
      `INSERT INTO community_funding_goal
       (id, enabled, title, description, current_cents, target_cents,
        currency, contribution_url, updated_by_discord_id, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         enabled = excluded.enabled,
         title = excluded.title,
         description = excluded.description,
         current_cents = excluded.current_cents,
         target_cents = excluded.target_cents,
         currency = excluded.currency,
         contribution_url = excluded.contribution_url,
         updated_by_discord_id = excluded.updated_by_discord_id,
         updated_at = CURRENT_TIMESTAMP`
    ).bind(
      parsed.enabled ? 1 : 0,
      parsed.title,
      parsed.description,
      parsed.currentCents,
      parsed.targetCents,
      parsed.currency,
      parsed.contributionUrl,
      access.session.discordId
    ).run();

    const row = await getFundingGoal(env);
    return apiJson(
      { ok: true, goal: fundingGoalJson(row) },
      200,
      access.corsHeaders
    );
  } catch (error) {
    console.error("Funding goal update failed:", error);
    return apiJson(
      { error: "The community funding goal could not be saved." },
      500,
      access.corsHeaders
    );
  }
}

async function parseFundingGoalJson(request, corsHeaders) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return {
      error: apiJson({ error: "The funding goal request is too large." }, 413, corsHeaders),
    };
  }

  const contentType = String(request.headers.get("Content-Type") || "").toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return {
      error: apiJson({ error: "Funding goal changes must use JSON." }, 415, corsHeaders),
    };
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return {
      error: apiJson({ error: "The funding goal request could not be read." }, 400, corsHeaders),
    };
  }

  const title = normalizeText(data?.title, MAX_FUNDING_TITLE_LENGTH + 1);
  const description = normalizeText(
    data?.description,
    MAX_FUNDING_DESCRIPTION_LENGTH + 1
  );
  const currency = String(data?.currency || "").trim().toUpperCase();
  const contributionUrl = normalizeFundingUrl(data?.contributionUrl);
  const currentCents = fundingAmountToCents(data?.currentAmount, true);
  const targetCents = fundingAmountToCents(data?.targetAmount, false);

  if (typeof data?.enabled !== "boolean") {
    return { error: apiJson({ error: "Choose whether the funding goal is visible." }, 400, corsHeaders) };
  }
  if (!title || title.length > MAX_FUNDING_TITLE_LENGTH) {
    return { error: apiJson({ error: "Enter a goal title of 80 characters or fewer." }, 400, corsHeaders) };
  }
  if (!description || description.length > MAX_FUNDING_DESCRIPTION_LENGTH) {
    return { error: apiJson({ error: "Enter a goal description of 240 characters or fewer." }, 400, corsHeaders) };
  }
  if (currentCents === null) {
    return { error: apiJson({ error: "Enter a valid amount raised." }, 400, corsHeaders) };
  }
  if (targetCents === null) {
    return { error: apiJson({ error: "Enter a valid target amount greater than zero." }, 400, corsHeaders) };
  }
  if (!FUNDING_CURRENCIES.has(currency)) {
    return { error: apiJson({ error: "Choose a supported currency." }, 400, corsHeaders) };
  }
  if (!contributionUrl) {
    return { error: apiJson({ error: "Enter a valid HTTPS or site-relative support link." }, 400, corsHeaders) };
  }

  return {
    error: null,
    enabled: data.enabled,
    title,
    description,
    currentCents,
    targetCents,
    currency,
    contributionUrl,
  };
}

function fundingAmountToCents(value, allowZero) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  const cents = Math.round(amount * 100);
  if ((!allowZero && cents === 0) || cents > MAX_FUNDING_CENTS) return null;
  if (Math.abs((cents / 100) - amount) > 0.000001) return null;
  return cents;
}

function normalizeFundingUrl(value) {
  const source = normalizeText(value, MAX_FUNDING_URL_LENGTH + 1);
  if (!source || source.length > MAX_FUNDING_URL_LENGTH || /[\\\s]/.test(source)) return "";
  if (source.startsWith("/") && !source.startsWith("//")) return source;
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function getFundingGoal(env) {
  return env.DB.prepare(
    `SELECT enabled, title, description, current_cents, target_cents,
            currency, contribution_url, updated_at
     FROM community_funding_goal
     WHERE id = 1
     LIMIT 1`
  ).first();
}

function fundingGoalJson(row) {
  return {
    enabled: Number(row?.enabled) === 1,
    title: String(row?.title || ""),
    description: String(row?.description || ""),
    currentAmount: Number(row?.current_cents || 0) / 100,
    targetAmount: Number(row?.target_cents || 0) / 100,
    currency: String(row?.currency || "USD"),
    contributionUrl: String(row?.contribution_url || "/store.html"),
    updatedAt: String(row?.updated_at || ""),
  };
}


// ==================================================
// TIMELINE
// ==================================================

async function handlePublicTimeline(request, env) {
  const cors = getCorsResult(request);
  if (!cors.allowed) {
    return apiJson({ error: "Origin not allowed." }, 403);
  }
  if (!env.DB) {
    return apiJson(
      { error: "The timeline is temporarily unavailable." },
      503,
      cors.headers
    );
  }

  try {
    const result = await env.DB.prepare(
      `SELECT id, title, event_date, description, r2_key
       FROM timeline_events
       ORDER BY event_date ASC, id ASC
       LIMIT ?`
    ).bind(MAX_TIMELINE_RESULTS).all();
    const periodResult = await getTimelinePeriods(env);
    const origin = new URL(request.url).origin;
    const headers = new Headers(cors.headers || undefined);
    headers.set(
      "Cache-Control",
      "public, max-age=30, stale-while-revalidate=60"
    );
    return apiJsonWithHeaders(
      {
        ok: true,
        events: (result?.results || []).map(
          (row) => timelineEventJson(row, origin)
        ),
        periods: (periodResult?.results || []).map(timelinePeriodJson),
      },
      200,
      headers
    );
  } catch (error) {
    console.error("Public timeline query failed:", error);
    return apiJson(
      { error: "The timeline could not be loaded." },
      500,
      cors.headers
    );
  }
}

async function handlePublicTimelineImage(request, env, eventId) {
  if (!env.DB || !env.ARCHIVE_BUCKET) {
    return noStoreResponse("Timeline storage unavailable.", 503);
  }

  try {
    const row = await env.DB.prepare(
      `SELECT r2_key, mime_type
       FROM timeline_events
       WHERE id = ?
       LIMIT 1`
    ).bind(eventId).first();
    const r2Key = String(row?.r2_key || "");
    if (!r2Key) {
      return noStoreResponse("Timeline image not found.", 404);
    }

    const object = await env.ARCHIVE_BUCKET.get(r2Key);
    if (!object) {
      return noStoreResponse("Timeline image not found.", 404);
    }

    const contentType = selectImageContentType(
      object.httpMetadata?.contentType,
      row.mime_type
    );
    const headers = createImageHeaders(
      contentType,
      object,
      "public, max-age=60"
    );
    headers.set("Cross-Origin-Resource-Policy", "cross-origin");

    const origin = request.headers.get("Origin");
    if (origin && ALLOWED_ORIGINS.has(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    console.error(`Timeline image failed for event ${eventId}:`, error);
    return noStoreResponse("Timeline image unavailable.", 500);
  }
}

async function handleAdminTimeline(request, env) {
  const access = await requireAdmin(request, env);
  if (access.response) return access.response;
  if (!env.DB) {
    return apiJson(
      { error: "The timeline database is temporarily unavailable." },
      503,
      access.corsHeaders
    );
  }

  try {
    const result = await env.DB.prepare(
      `SELECT id, title, event_date, description, r2_key
       FROM timeline_events
       ORDER BY event_date ASC, id ASC
       LIMIT ?`
    ).bind(MAX_TIMELINE_RESULTS).all();
    const periodResult = await getTimelinePeriods(env);
    const origin = new URL(request.url).origin;
    return apiJson(
      {
        ok: true,
        events: (result?.results || []).map(
          (row) => timelineEventJson(row, origin)
        ),
        periods: (periodResult?.results || []).map(timelinePeriodJson),
      },
      200,
      access.corsHeaders
    );
  } catch (error) {
    console.error("Admin timeline query failed:", error);
    return apiJson(
      { error: "The timeline events could not be loaded." },
      500,
      access.corsHeaders
    );
  }
}

async function handleAdminTimelineCreate(request, env) {
  const access = await requireAdmin(request, env);
  if (access.response) return access.response;
  if (!env.DB) {
    return apiJson(
      { error: "The timeline database is temporarily unavailable." },
      503,
      access.corsHeaders
    );
  }

  const form = await parseTimelineForm(request, access.corsHeaders);
  if (form.error) return form.error;

  let image = null;
  if (form.image) {
    if (!env.ARCHIVE_BUCKET) {
      return apiJson(
        { error: "Timeline image storage is temporarily unavailable." },
        503,
        access.corsHeaders
      );
    }
    image = await storeTimelineImage(env, form.eventDate, form.image);
    if (!image) {
      return apiJson(
        { error: "The timeline image could not be stored." },
        500,
        access.corsHeaders
      );
    }
  }

  try {
    const result = await env.DB.prepare(
      `INSERT INTO timeline_events
       (title, event_date, description, r2_key, mime_type, file_size,
        created_by_discord_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      form.title,
      form.eventDate,
      form.description,
      image?.r2Key || null,
      image?.mimeType || null,
      image?.fileSize || null,
      access.session.discordId
    ).run();
    const id = Number(result?.meta?.last_row_id || 0);
    return apiJson(
      {
        ok: true,
        event: timelineEventJson(
          {
            id,
            title: form.title,
            event_date: form.eventDate,
            description: form.description,
            r2_key: image?.r2Key || null,
          },
          new URL(request.url).origin
        ),
      },
      201,
      access.corsHeaders
    );
  } catch (error) {
    console.error("Timeline event insert failed:", error);
    if (image) {
      await deleteTimelineImage(env, image.r2Key, "create rollback");
    }
    return apiJson(
      { error: "The timeline event could not be created." },
      500,
      access.corsHeaders
    );
  }
}

async function handleAdminTimelineUpdate(request, env, eventId) {
  const access = await requireAdmin(request, env);
  if (access.response) return access.response;
  if (!env.DB) {
    return apiJson(
      { error: "The timeline database is temporarily unavailable." },
      503,
      access.corsHeaders
    );
  }

  let existing;
  try {
    existing = await getTimelineEvent(env, eventId);
  } catch (error) {
    console.error("Timeline event lookup failed:", error);
    return apiJson(
      { error: "The timeline event could not be loaded." },
      500,
      access.corsHeaders
    );
  }
  if (!existing) {
    return apiJson(
      { error: "Timeline event not found." },
      404,
      access.corsHeaders
    );
  }

  const form = await parseTimelineForm(request, access.corsHeaders);
  if (form.error) return form.error;

  let replacement = null;
  if (form.image) {
    if (!env.ARCHIVE_BUCKET) {
      return apiJson(
        { error: "Timeline image storage is temporarily unavailable." },
        503,
        access.corsHeaders
      );
    }
    replacement = await storeTimelineImage(env, form.eventDate, form.image);
    if (!replacement) {
      return apiJson(
        { error: "The timeline image could not be stored." },
        500,
        access.corsHeaders
      );
    }
  }

  const removing = !replacement && form.removeImage;
  const nextR2Key = replacement
    ? replacement.r2Key
    : removing ? null : existing.r2_key;
  const nextMimeType = replacement
    ? replacement.mimeType
    : removing ? null : existing.mime_type;
  const nextFileSize = replacement
    ? replacement.fileSize
    : removing ? null : existing.file_size;

  try {
    const result = await env.DB.prepare(
      `UPDATE timeline_events
       SET title = ?, event_date = ?, description = ?, r2_key = ?,
           mime_type = ?, file_size = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      form.title,
      form.eventDate,
      form.description,
      nextR2Key,
      nextMimeType,
      nextFileSize,
      eventId
    ).run();

    if (Number(result?.meta?.changes || 0) !== 1) {
      if (replacement) {
        await deleteTimelineImage(env, replacement.r2Key, "update rollback");
      }
      return apiJson(
        { error: "Timeline event not found." },
        404,
        access.corsHeaders
      );
    }

    const oldKey = String(existing.r2_key || "");
    if (oldKey && (replacement || removing)) {
      await deleteTimelineImage(env, oldKey, `event ${eventId} cleanup`);
    }

    return apiJson(
      {
        ok: true,
        event: timelineEventJson(
          {
            id: eventId,
            title: form.title,
            event_date: form.eventDate,
            description: form.description,
            r2_key: nextR2Key,
          },
          new URL(request.url).origin
        ),
      },
      200,
      access.corsHeaders
    );
  } catch (error) {
    console.error("Timeline event update failed:", error);
    if (replacement) {
      await deleteTimelineImage(env, replacement.r2Key, "update rollback");
    }
    return apiJson(
      { error: "The timeline event could not be updated." },
      500,
      access.corsHeaders
    );
  }
}

async function handleAdminTimelineDelete(request, env, eventId) {
  const access = await requireAdmin(request, env);
  if (access.response) return access.response;
  if (!env.DB) {
    return apiJson(
      { error: "The timeline database is temporarily unavailable." },
      503,
      access.corsHeaders
    );
  }

  try {
    const existing = await getTimelineEvent(env, eventId);
    if (!existing) {
      return apiJson(
        { error: "Timeline event not found." },
        404,
        access.corsHeaders
      );
    }
    const result = await env.DB.prepare(
      "DELETE FROM timeline_events WHERE id = ?"
    ).bind(eventId).run();
    if (Number(result?.meta?.changes || 0) !== 1) {
      return apiJson(
        { error: "Timeline event not found." },
        404,
        access.corsHeaders
      );
    }
    if (existing.r2_key) {
      await deleteTimelineImage(
        env,
        String(existing.r2_key),
        `deleted event ${eventId}`
      );
    }
    return apiJson({ ok: true }, 200, access.corsHeaders);
  } catch (error) {
    console.error("Timeline event delete failed:", error);
    return apiJson(
      { error: "The timeline event could not be deleted." },
      500,
      access.corsHeaders
    );
  }
}

async function handleAdminTimelinePeriodCreate(request, env) {
  const access = await requireAdmin(request, env);
  if (access.response) return access.response;
  if (!env.DB) {
    return apiJson(
      { error: "The timeline database is temporarily unavailable." },
      503,
      access.corsHeaders
    );
  }

  const input = await parseTimelinePeriodJson(request, access.corsHeaders);
  if (input.error) return input.error;

  try {
    const overlap = await findOverlappingTimelinePeriod(
      env,
      input.startDate,
      input.endDate,
      null
    );
    if (overlap) {
      return apiJson(
        { error: `This date range overlaps “${String(overlap.label || "another period")}”.` },
        409,
        access.corsHeaders
      );
    }

    const result = await env.DB.prepare(
      `INSERT INTO timeline_periods
       (label, start_date, end_date, color, created_by_discord_id)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      input.label,
      input.startDate,
      input.endDate,
      input.color,
      access.session.discordId
    ).run();
    const id = Number(result?.meta?.last_row_id || 0);
    return apiJson(
      {
        ok: true,
        period: timelinePeriodJson({
          id,
          label: input.label,
          start_date: input.startDate,
          end_date: input.endDate,
          color: input.color,
        }),
      },
      201,
      access.corsHeaders
    );
  } catch (error) {
    console.error("Timeline period insert failed:", error);
    return apiJson(
      { error: "The timeline period could not be created." },
      500,
      access.corsHeaders
    );
  }
}

async function handleAdminTimelinePeriodUpdate(request, env, periodId) {
  const access = await requireAdmin(request, env);
  if (access.response) return access.response;
  if (!env.DB) {
    return apiJson(
      { error: "The timeline database is temporarily unavailable." },
      503,
      access.corsHeaders
    );
  }

  const input = await parseTimelinePeriodJson(request, access.corsHeaders);
  if (input.error) return input.error;

  try {
    const existing = await getTimelinePeriod(env, periodId);
    if (!existing) {
      return apiJson(
        { error: "Timeline period not found." },
        404,
        access.corsHeaders
      );
    }

    const overlap = await findOverlappingTimelinePeriod(
      env,
      input.startDate,
      input.endDate,
      periodId
    );
    if (overlap) {
      return apiJson(
        { error: `This date range overlaps “${String(overlap.label || "another period")}”.` },
        409,
        access.corsHeaders
      );
    }

    const result = await env.DB.prepare(
      `UPDATE timeline_periods
       SET label = ?, start_date = ?, end_date = ?, color = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(
      input.label,
      input.startDate,
      input.endDate,
      input.color,
      periodId
    ).run();
    if (Number(result?.meta?.changes || 0) !== 1) {
      return apiJson(
        { error: "Timeline period not found." },
        404,
        access.corsHeaders
      );
    }

    return apiJson(
      {
        ok: true,
        period: timelinePeriodJson({
          id: periodId,
          label: input.label,
          start_date: input.startDate,
          end_date: input.endDate,
          color: input.color,
        }),
      },
      200,
      access.corsHeaders
    );
  } catch (error) {
    console.error("Timeline period update failed:", error);
    return apiJson(
      { error: "The timeline period could not be updated." },
      500,
      access.corsHeaders
    );
  }
}

async function handleAdminTimelinePeriodDelete(request, env, periodId) {
  const access = await requireAdmin(request, env);
  if (access.response) return access.response;
  if (!env.DB) {
    return apiJson(
      { error: "The timeline database is temporarily unavailable." },
      503,
      access.corsHeaders
    );
  }

  try {
    const result = await env.DB.prepare(
      "DELETE FROM timeline_periods WHERE id = ?"
    ).bind(periodId).run();
    if (Number(result?.meta?.changes || 0) !== 1) {
      return apiJson(
        { error: "Timeline period not found." },
        404,
        access.corsHeaders
      );
    }
    return apiJson({ ok: true }, 200, access.corsHeaders);
  } catch (error) {
    console.error("Timeline period delete failed:", error);
    return apiJson(
      { error: "The timeline period could not be deleted." },
      500,
      access.corsHeaders
    );
  }
}

async function parseTimelinePeriodJson(request, corsHeaders) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > 4096) {
    return {
      error: apiJson(
        { error: "The timeline period request is too large." },
        413,
        corsHeaders
      ),
    };
  }
  const contentType = String(request.headers.get("Content-Type") || "")
    .toLowerCase();
  if (!contentType.startsWith("application/json")) {
    return {
      error: apiJson(
        { error: "Timeline periods must use JSON." },
        415,
        corsHeaders
      ),
    };
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return {
      error: apiJson(
        { error: "The timeline period request could not be read." },
        400,
        corsHeaders
      ),
    };
  }

  const label = normalizeText(
    data?.label,
    MAX_TIMELINE_PERIOD_LABEL_LENGTH + 1
  );
  const startDate = String(data?.startDate || "").trim();
  const endDate = String(data?.endDate || "").trim();
  const color = String(data?.color || "").trim().toLowerCase();

  if (!label || label.length > MAX_TIMELINE_PERIOD_LABEL_LENGTH) {
    return {
      error: apiJson(
        { error: "Enter a period name of 50 characters or fewer." },
        400,
        corsHeaders
      ),
    };
  }
  if (!isValidTimelineDate(startDate) || !isValidTimelineDate(endDate)
    || startDate > endDate) {
    return {
      error: apiJson(
        { error: "Choose a valid period start and end date." },
        400,
        corsHeaders
      ),
    };
  }
  if (!/^#[0-9a-f]{6}$/.test(color)) {
    return {
      error: apiJson(
        { error: "Choose a valid six-digit period color." },
        400,
        corsHeaders
      ),
    };
  }

  return { error: null, label, startDate, endDate, color };
}

function getTimelinePeriods(env) {
  return env.DB.prepare(
    `SELECT id, label, start_date, end_date, color
     FROM timeline_periods
     ORDER BY start_date ASC, id ASC
     LIMIT ?`
  ).bind(MAX_TIMELINE_PERIOD_RESULTS).all();
}

function getTimelinePeriod(env, periodId) {
  return env.DB.prepare(
    `SELECT id, label, start_date, end_date, color
     FROM timeline_periods
     WHERE id = ?
     LIMIT 1`
  ).bind(periodId).first();
}

function findOverlappingTimelinePeriod(env, startDate, endDate, excludeId) {
  if (excludeId === null) {
    return env.DB.prepare(
      `SELECT id, label
       FROM timeline_periods
       WHERE start_date <= ? AND end_date >= ?
       LIMIT 1`
    ).bind(endDate, startDate).first();
  }
  return env.DB.prepare(
    `SELECT id, label
     FROM timeline_periods
     WHERE start_date <= ? AND end_date >= ? AND id <> ?
     LIMIT 1`
  ).bind(endDate, startDate, excludeId).first();
}

function timelinePeriodJson(row) {
  return {
    id: Number(row.id),
    label: String(row.label || ""),
    startDate: String(row.start_date || ""),
    endDate: String(row.end_date || ""),
    color: String(row.color || "").toLowerCase(),
  };
}

async function parseTimelineForm(request, corsHeaders) {
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_SIZE) {
    return {
      error: apiJson(
        { error: "Timeline images must be 8 MB or smaller." },
        413,
        corsHeaders
      ),
    };
  }
  const contentType = String(request.headers.get("Content-Type") || "")
    .toLowerCase();
  if (!contentType.startsWith("multipart/form-data")) {
    return {
      error: apiJson(
        { error: "Timeline changes must use multipart form data." },
        415,
        corsHeaders
      ),
    };
  }

  let data;
  try {
    data = await request.formData();
  } catch {
    return {
      error: apiJson(
        { error: "The timeline form could not be read." },
        400,
        corsHeaders
      ),
    };
  }

  const title = normalizeText(
    data.get("title"),
    MAX_TIMELINE_TITLE_LENGTH + 1
  );
  if (!title || title.length > MAX_TIMELINE_TITLE_LENGTH) {
    return {
      error: apiJson(
        { error: "Enter a timeline title of 80 characters or fewer." },
        400,
        corsHeaders
      ),
    };
  }

  const eventDate = String(data.get("eventDate") || "").trim();
  if (!isValidTimelineDate(eventDate)) {
    return {
      error: apiJson(
        { error: "Choose a valid timeline event date." },
        400,
        corsHeaders
      ),
    };
  }

  const descriptionText = normalizeCaption(data.get("description"));
  if (descriptionText.length > MAX_TIMELINE_DESCRIPTION_LENGTH) {
    return {
      error: apiJson(
        { error: "Timeline descriptions must be 280 characters or fewer." },
        400,
        corsHeaders
      ),
    };
  }

  let image = null;
  const file = data.get("image");
  if (
    file &&
    typeof file === "object" &&
    typeof file.arrayBuffer === "function" &&
    Number(file.size) > 0
  ) {
    const fileSize = Number(file.size);
    if (!Number.isFinite(fileSize) || fileSize > MAX_FILE_SIZE) {
      return {
        error: apiJson(
          { error: "Timeline images must be 8 MB or smaller." },
          413,
          corsHeaders
        ),
      };
    }
    let bytes;
    try {
      bytes = new Uint8Array(await file.arrayBuffer());
    } catch {
      return {
        error: apiJson(
          { error: "The timeline image could not be read." },
          400,
          corsHeaders
        ),
      };
    }
    if (bytes.byteLength !== fileSize) {
      return {
        error: apiJson(
          { error: "The timeline image upload was incomplete." },
          400,
          corsHeaders
        ),
      };
    }
    const detected = detectImageType(bytes);
    if (!detected) {
      return {
        error: apiJson(
          { error: "Only PNG, JPEG, and WebP images are supported." },
          415,
          corsHeaders
        ),
      };
    }
    image = {
      bytes,
      fileSize,
      mimeType: detected.mimeType,
      extension: detected.extension,
    };
  }

  return {
    error: null,
    title,
    eventDate,
    description: descriptionText || null,
    removeImage:
      String(data.get("removeImage") || "").toLowerCase() === "true",
    image,
  };
}

function isValidTimelineDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(`${value}T00:00:00.000Z`);
  return year >= 1 &&
    !Number.isNaN(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day;
}

function timelineEventJson(row, origin) {
  const id = Number(row.id);
  const hasImage = Boolean(row.r2_key);
  return {
    id,
    title: String(row.title || ""),
    eventDate: String(row.event_date || ""),
    description: row.description === null
      ? null
      : String(row.description || ""),
    hasImage,
    imageUrl: hasImage
      ? `${origin}/api/timeline/events/${id}/image`
      : null,
  };
}

function getTimelineEvent(env, eventId) {
  return env.DB.prepare(
    `SELECT id, title, event_date, description, r2_key, mime_type, file_size
     FROM timeline_events
     WHERE id = ?
     LIMIT 1`
  ).bind(eventId).first();
}

async function storeTimelineImage(env, eventDate, image) {
  const r2Key =
    `timeline/${eventDate.slice(0, 4)}/${eventDate.slice(5, 7)}/` +
    `${crypto.randomUUID()}.${image.extension}`;
  try {
    await env.ARCHIVE_BUCKET.put(r2Key, image.bytes, {
      httpMetadata: {
        contentType: image.mimeType,
        cacheControl: "public, max-age=60",
      },
      customMetadata: { state: "timeline" },
    });
    return {
      r2Key,
      mimeType: image.mimeType,
      fileSize: image.fileSize,
    };
  } catch (error) {
    console.error("Timeline R2 write failed:", error);
    return null;
  }
}

async function deleteTimelineImage(env, r2Key, context) {
  if (!r2Key || !env.ARCHIVE_BUCKET) return;
  try {
    await env.ARCHIVE_BUCKET.delete(r2Key);
  } catch (error) {
    console.error(`Timeline R2 cleanup failed (${context}):`, error);
  }
}


// ==================================================
// DISCORD LOGIN
// ==================================================

function startDiscordLogin(
  env
) {
  const state =
    randomToken();

  const params =
    new URLSearchParams({
      client_id:
        env.DISCORD_CLIENT_ID,

      response_type:
        "code",

      redirect_uri:
        REDIRECT_URI,

      scope:
        "identify",

      state,
    });

  const headers =
    new Headers();

  headers.set(
    "Location",
    `https://discord.com/oauth2/authorize?${params.toString()}`
  );

  headers.set(
    "Cache-Control",
    "no-store"
  );

  headers.append(
    "Set-Cookie",
    serializeCookie(
      STATE_COOKIE,
      state,
      {
        maxAge:
          STATE_MAX_AGE_SECONDS,

        httpOnly:
          true,

        secure:
          true,

        sameSite:
          "Lax",

        path:
          "/",
      }
    )
  );

  return new Response(
    null,
    {
      status: 302,
      headers,
    }
  );
}


// ==================================================
// DISCORD CALLBACK
// ==================================================

async function handleDiscordCallback(
  request,
  env
) {
  const url =
    new URL(
      request.url
    );

  const code =
    url.searchParams.get(
      "code"
    );

  const returnedState =
    url.searchParams.get(
      "state"
    );

  const oauthError =
    url.searchParams.get(
      "error"
    );

  const cookies =
    parseCookies(
      request.headers.get(
        "Cookie"
      ) || ""
    );

  const expectedState =
    cookies[
      STATE_COOKIE
    ];

  if (oauthError) {
    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  if (
    !code ||
    !returnedState ||
    !expectedState ||
    !constantTimeEqual(
      returnedState,
      expectedState
    )
  ) {
    console.warn(
      "Archive OAuth callback rejected due to invalid state."
    );

    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  let tokenResponse;

  try {
    tokenResponse =
      await fetch(
        "https://discord.com/api/v10/oauth2/token",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            new URLSearchParams({
              client_id:
                env.DISCORD_CLIENT_ID,

              client_secret:
                env.DISCORD_CLIENT_SECRET,

              grant_type:
                "authorization_code",

              code,

              redirect_uri:
                REDIRECT_URI,
            }).toString(),
        }
      );
  } catch (error) {
    console.error(
      "Discord token request failed:",
      error
    );

    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  if (!tokenResponse.ok) {
    console.error(
      "Discord token exchange failed:",
      tokenResponse.status
    );

    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  let tokenData;

  try {
    tokenData =
      await tokenResponse.json();
  } catch {
    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  const discordAccessToken =
    String(
      tokenData.access_token ||
      ""
    );

  if (!discordAccessToken) {
    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  let userResponse;

  try {
    userResponse =
      await fetch(
        "https://discord.com/api/v10/users/@me",
        {
          headers: {
            Authorization:
              `Bearer ${discordAccessToken}`,
          },
        }
      );
  } catch (error) {
    console.error(
      "Discord user request failed:",
      error
    );

    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  if (!userResponse.ok) {
    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  let discordUser;

  try {
    discordUser =
      await userResponse.json();
  } catch {
    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  const discordId =
    String(
      discordUser.id ||
      ""
    );

  const username =
    normalizeText(
      discordUser.username,
      80
    );

  const displayName =
    normalizeText(
      discordUser.global_name ||
      discordUser.username ||
      "Discord User",
      100
    );

  if (
    !discordId ||
    !/^\d+$/.test(
      discordId
    ) ||
    !username
  ) {
    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  let sessionToken;

  try {
    sessionToken =
      await createSessionToken(
        {
          discordId,
          username,
          displayName,
        },
        env
      );
  } catch (error) {
    console.error(
      "Archive session token creation failed:",
      error
    );

    return redirectToArchive(
      clearCookie(
        STATE_COOKIE
      )
    );
  }

  return redirectToArchiveWithSession(
    sessionToken,
    clearCookie(
      STATE_COOKIE
    )
  );
}


// ==================================================
// CURRENT USER
// ==================================================

async function handleMe(
  request,
  env
) {
  const corsResult =
    getCorsResult(
      request
    );

  if (!corsResult.allowed) {
    return apiJson(
      {
        error:
          "Origin not allowed.",
      },
      403,
      null
    );
  }

  const session =
    await authenticateRequest(
      request,
      env
    );

  if (!session) {
    return apiJson(
      {
        authenticated:
          false,
      },
      401,
      corsResult.headers
    );
  }

  return apiJson(
    {
      authenticated:
        true,

      user: {
        discordId:
          session.discordId,

        username:
          session.username,

        displayName:
          session.displayName,

        isAdmin:
          isArchiveAdmin(
            session.discordId,
            env
          ),
      },
    },
    200,
    corsResult.headers
  );
}


// ==================================================
// USER UPLOAD
// ==================================================

async function handleUpload(
  request,
  env
) {
  const corsResult =
    getCorsResult(
      request
    );

  if (!corsResult.allowed) {
    return apiJson(
      {
        error:
          "Origin not allowed.",
      },
      403,
      null
    );
  }

  if (
    !env.DB ||
    !env.ARCHIVE_BUCKET
  ) {
    return apiJson(
      {
        error:
          "Archive storage is temporarily unavailable.",
      },
      503,
      corsResult.headers
    );
  }

  const session =
    await authenticateRequest(
      request,
      env
    );

  if (!session) {
    return apiJson(
      {
        error:
          "Your archive session has expired. Please sign in again.",
      },
      401,
      corsResult.headers
    );
  }

  const contentLengthHeader =
    request.headers.get(
      "Content-Length"
    );

  if (contentLengthHeader) {
    const contentLength =
      Number(
        contentLengthHeader
      );

    if (
      Number.isFinite(
        contentLength
      ) &&
      contentLength >
        MAX_REQUEST_SIZE
    ) {
      return apiJson(
        {
          error:
            "The upload is too large. Screenshots must be 8 MB or smaller.",
        },
        413,
        corsResult.headers
      );
    }
  }

  const contentType =
    String(
      request.headers.get(
        "Content-Type"
      ) || ""
    ).toLowerCase();

  if (
    !contentType.startsWith(
      "multipart/form-data"
    )
  ) {
    return apiJson(
      {
        error:
          "Upload must use multipart form data.",
      },
      415,
      corsResult.headers
    );
  }

  let limits;

  try {
    limits =
      await env.DB
        .prepare(
          `
          SELECT
            SUM(
              CASE
                WHEN status = 'pending'
                THEN 1
                ELSE 0
              END
            ) AS pending_count,

            SUM(
              CASE
                WHEN uploaded_at >= datetime('now', '-1 day')
                THEN 1
                ELSE 0
              END
            ) AS recent_count

          FROM archive_uploads

          WHERE discord_user_id = ?
          `
        )
        .bind(
          session.discordId
        )
        .first();
  } catch (error) {
    console.error(
      "Archive upload limit query failed:",
      error
    );

    return apiJson(
      {
        error:
          "The archive is temporarily unavailable. Please try again later.",
      },
      503,
      corsResult.headers
    );
  }

  const pendingCount =
    Number(
      limits?.pending_count ||
      0
    );

  const recentCount =
    Number(
      limits?.recent_count ||
      0
    );

  if (
    pendingCount >=
    MAX_PENDING_PER_USER
  ) {
    return apiJson(
      {
        error:
          "You already have several screenshots waiting for review. Please wait for them to be reviewed before uploading more.",
      },
      429,
      corsResult.headers
    );
  }

  if (
    recentCount >=
    MAX_UPLOADS_PER_24_HOURS
  ) {
    return apiJson(
      {
        error:
          "You have reached the archive upload limit for the last 24 hours. Please try again later.",
      },
      429,
      corsResult.headers
    );
  }

  let form;

  try {
    form =
      await request.formData();
  } catch {
    return apiJson(
      {
        error:
          "The upload could not be read.",
      },
      400,
      corsResult.headers
    );
  }

  const captionRaw =
    normalizeCaption(
      form.get(
        "caption"
      )
    );

  if (
    captionRaw.length >
    MAX_CAPTION_LENGTH
  ) {
    return apiJson(
      {
        error:
          `Captions must be ${MAX_CAPTION_LENGTH} characters or fewer.`,
      },
      400,
      corsResult.headers
    );
  }

  const caption =
    captionRaw ||
    null;

  const file =
    form.get(
      "screenshot"
    );

  if (
    !file ||
    typeof file !== "object" ||
    typeof file.arrayBuffer !==
      "function"
  ) {
    return apiJson(
      {
        error:
          "Choose a screenshot to upload.",
      },
      400,
      corsResult.headers
    );
  }

  const fileSize =
    Number(
      file.size
    );

  if (
    !Number.isFinite(
      fileSize
    ) ||
    fileSize <= 0
  ) {
    return apiJson(
      {
        error:
          "The selected screenshot is empty.",
      },
      400,
      corsResult.headers
    );
  }

  if (
    fileSize >
    MAX_FILE_SIZE
  ) {
    return apiJson(
      {
        error:
          "Screenshots must be 8 MB or smaller.",
      },
      413,
      corsResult.headers
    );
  }

  let bytes;

  try {
    bytes =
      new Uint8Array(
        await file.arrayBuffer()
      );
  } catch {
    return apiJson(
      {
        error:
          "The screenshot could not be read.",
      },
      400,
      corsResult.headers
    );
  }

  if (
    bytes.byteLength !==
    fileSize
  ) {
    return apiJson(
      {
        error:
          "The uploaded screenshot was incomplete.",
      },
      400,
      corsResult.headers
    );
  }

  const detectedType =
    detectImageType(
      bytes
    );

  if (!detectedType) {
    return apiJson(
      {
        error:
          "Only PNG, JPEG, and WebP screenshots are supported.",
      },
      415,
      corsResult.headers
    );
  }

  const now =
    new Date();

  const year =
    String(
      now.getUTCFullYear()
    );

  const month =
    String(
      now.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const objectId =
    crypto.randomUUID();

  const r2Key =
    `uploads/${year}/${month}/${objectId}.${detectedType.extension}`;

  try {
    await env.ARCHIVE_BUCKET.put(
      r2Key,
      bytes,
      {
        httpMetadata: {
          contentType:
            detectedType.mimeType,

          cacheControl:
            "private, no-store",
        },

        customMetadata: {
          state:
            "pending",
        },
      }
    );
  } catch (error) {
    console.error(
      "Archive R2 write failed:",
      error
    );

    return apiJson(
      {
        error:
          "The screenshot could not be stored. Please try again.",
      },
      500,
      corsResult.headers
    );
  }

  let insertResult;

  try {
    insertResult =
      await env.DB
        .prepare(
          `
          INSERT INTO archive_uploads (
            discord_user_id,
            discord_username,
            caption,
            r2_key,
            mime_type,
            file_size,
            status
          )

          VALUES (
            ?,
            ?,
            ?,
            ?,
            ?,
            ?,
            'pending'
          )
          `
        )
        .bind(
          session.discordId,
          session.username,
          caption,
          r2Key,
          detectedType.mimeType,
          bytes.byteLength
        )
        .run();
  } catch (error) {
    console.error(
      "Archive D1 insert failed:",
      error
    );

    try {
      await env.ARCHIVE_BUCKET.delete(
        r2Key
      );
    } catch (rollbackError) {
      console.error(
        "Archive R2 rollback failed:",
        rollbackError
      );
    }

    return apiJson(
      {
        error:
          "The screenshot could not be submitted. Please try again.",
      },
      500,
      corsResult.headers
    );
  }

  const uploadId =
    insertResult?.meta?.last_row_id ??
    null;

  console.log(
    `Archive screenshot submitted: user=${session.discordId} upload=${uploadId ?? "unknown"}`
  );

  return apiJson(
    {
      ok: true,

      upload: {
        id:
          uploadId,

        status:
          "pending",
      },

      message:
        "Your screenshot was submitted and is waiting for review.",
    },
    201,
    corsResult.headers
  );
}


// ==================================================
// MY UPLOADS LIST
// ==================================================

async function handleMyUploads(
  request,
  env
) {
  const corsResult =
    getCorsResult(
      request
    );

  if (!corsResult.allowed) {
    return apiJson(
      {
        error:
          "Origin not allowed.",
      },
      403,
      null
    );
  }

  if (!env.DB) {
    return apiJson(
      {
        error:
          "Your Archive uploads are temporarily unavailable.",
      },
      503,
      corsResult.headers
    );
  }

  const session =
    await authenticateRequest(
      request,
      env
    );

  if (!session) {
    return apiJson(
      {
        error:
          "Your archive session has expired. Please sign in again.",
      },
      401,
      corsResult.headers
    );
  }

  const url =
    new URL(
      request.url
    );

  let limit =
    Number(
      url.searchParams.get(
        "limit"
      )
    );

  if (
    !Number.isSafeInteger(
      limit
    ) ||
    limit <= 0
  ) {
    limit =
      DEFAULT_MY_UPLOADS_LIMIT;
  }

  limit =
    Math.min(
      limit,
      MAX_MY_UPLOADS_LIMIT
    );

  const beforeRaw =
    url.searchParams.get(
      "before"
    );

  let beforeId =
    null;

  if (
    beforeRaw !== null
  ) {
    const parsed =
      Number(
        beforeRaw
      );

    if (
      !Number.isSafeInteger(
        parsed
      ) ||
      parsed <= 0
    ) {
      return apiJson(
        {
          error:
            "Invalid upload cursor.",
        },
        400,
        corsResult.headers
      );
    }

    beforeId =
      parsed;
  }

  let result;

  try {
    if (
      beforeId === null
    ) {
      result =
        await env.DB
          .prepare(
            `
            SELECT
              id,
              caption,
              mime_type,
              file_size,
              status,
              uploaded_at,
              reviewed_at,
              removed_at

            FROM archive_uploads

            WHERE discord_user_id = ?

            ORDER BY id DESC

            LIMIT ?
            `
          )
          .bind(
            session.discordId,
            limit + 1
          )
          .all();
    } else {
      result =
        await env.DB
          .prepare(
            `
            SELECT
              id,
              caption,
              mime_type,
              file_size,
              status,
              uploaded_at,
              reviewed_at,
              removed_at

            FROM archive_uploads

            WHERE
              discord_user_id = ?
              AND id < ?

            ORDER BY id DESC

            LIMIT ?
            `
          )
          .bind(
            session.discordId,
            beforeId,
            limit + 1
          )
          .all();
    }
  } catch (error) {
    console.error(
      "My Uploads query failed:",
      error
    );

    return apiJson(
      {
        error:
          "Your Archive uploads could not be loaded.",
      },
      500,
      corsResult.headers
    );
  }

  const rows =
    Array.isArray(
      result?.results
    )
      ? result.results
      : [];

  const hasMore =
    rows.length >
    limit;

  const visibleRows =
    hasMore
      ? rows.slice(
          0,
          limit
        )
      : rows;

  const workerOrigin =
    new URL(
      request.url
    ).origin;

  const uploads =
    visibleRows.map(
      (row) => {
        const id =
          Number(
            row.id
          );

        const status =
          normalizeUploadStatus(
            row.status
          );

        const hasImage =
          status === "pending" ||
          status === "approved";

        return {
          id,

          caption:
            row.caption === null
              ? null
              : String(
                  row.caption
                ),

          mimeType:
            String(
              row.mime_type ||
              ""
            ),

          fileSize:
            Number(
              row.file_size ||
              0
            ),

          status,

          uploadedAt:
            String(
              row.uploaded_at ||
              ""
            ),

          reviewedAt:
            row.reviewed_at === null
              ? null
              : String(
                  row.reviewed_at
                ),

          removedAt:
            row.removed_at === null
              ? null
              : String(
                  row.removed_at
                ),

          hasImage,

          imageUrl:
            hasImage
              ? `${workerOrigin}/api/my/uploads/${id}/image`
              : null,
        };
      }
    );

  const nextCursor =
    hasMore &&
    visibleRows.length > 0
      ? Number(
          visibleRows[
            visibleRows.length - 1
          ].id
        )
      : null;

  return apiJson(
    {
      ok: true,
      uploads,
      hasMore,
      nextCursor,
    },
    200,
    corsResult.headers
  );
}


// ==================================================
// MY UPLOAD PRIVATE IMAGE
// ==================================================

async function handleMyUploadImage(
  request,
  env,
  uploadId
) {
  const corsResult =
    getCorsResult(
      request
    );

  if (!corsResult.allowed) {
    return apiJson(
      {
        error:
          "Origin not allowed.",
      },
      403,
      null
    );
  }

  if (
    !env.DB ||
    !env.ARCHIVE_BUCKET
  ) {
    return apiJson(
      {
        error:
          "Archive storage is temporarily unavailable.",
      },
      503,
      corsResult.headers
    );
  }

  const session =
    await authenticateRequest(
      request,
      env
    );

  if (!session) {
    return apiJson(
      {
        error:
          "Your archive session has expired. Please sign in again.",
      },
      401,
      corsResult.headers
    );
  }

  if (
    !Number.isSafeInteger(
      uploadId
    ) ||
    uploadId <= 0
  ) {
    return apiJson(
      {
        error:
          "Invalid upload.",
      },
      400,
      corsResult.headers
    );
  }

  let row;

  try {
    row =
      await env.DB
        .prepare(
          `
          SELECT
            r2_key,
            mime_type,
            status

          FROM archive_uploads

          WHERE
            id = ?
            AND discord_user_id = ?

          LIMIT 1
          `
        )
        .bind(
          uploadId,
          session.discordId
        )
        .first();
  } catch (error) {
    console.error(
      "My Upload image lookup failed:",
      error
    );

    return apiJson(
      {
        error:
          "The screenshot could not be loaded.",
      },
      500,
      corsResult.headers
    );
  }

  if (!row) {
    return apiJson(
      {
        error:
          "Screenshot not found.",
      },
      404,
      corsResult.headers
    );
  }

  const status =
    normalizeUploadStatus(
      row.status
    );

  if (
    status !== "pending" &&
    status !== "approved"
  ) {
    return apiJson(
      {
        error:
          "This screenshot is no longer available.",
      },
      404,
      corsResult.headers
    );
  }

  const r2Key =
    String(
      row.r2_key ||
      ""
    );

  if (!r2Key) {
    return apiJson(
      {
        error:
          "Screenshot file is unavailable.",
      },
      404,
      corsResult.headers
    );
  }

  let object;

  try {
    object =
      await env.ARCHIVE_BUCKET.get(
        r2Key
      );
  } catch (error) {
    console.error(
      "My Upload R2 read failed:",
      error
    );

    return apiJson(
      {
        error:
          "The screenshot could not be loaded.",
      },
      500,
      corsResult.headers
    );
  }

  if (!object) {
    return apiJson(
      {
        error:
          "Screenshot file not found.",
      },
      404,
      corsResult.headers
    );
  }

  const contentType =
    selectImageContentType(
      object.httpMetadata?.contentType,
      row.mime_type
    );

  const headers =
    createImageHeaders(
      contentType,
      object,
      "private, no-store"
    );

  appendHeaders(
    headers,
    corsResult.headers
  );

  return new Response(
    object.body,
    {
      status: 200,
      headers,
    }
  );
}


// ==================================================
// ADMIN: PENDING
// ==================================================

async function handleAdminPending(
  request,
  env
) {
  const access =
    await requireAdmin(
      request,
      env
    );

  if (access.response) {
    return access.response;
  }

  if (!env.DB) {
    return apiJson(
      {
        error:
          "Archive database is temporarily unavailable.",
      },
      503,
      access.corsHeaders
    );
  }

  let result;

  try {
    result =
      await env.DB
        .prepare(
          `
          SELECT
            id,
            discord_username,
            caption,
            mime_type,
            file_size,
            uploaded_at

          FROM archive_uploads

          WHERE status = 'pending'

          ORDER BY
            uploaded_at ASC,
            id ASC

          LIMIT ?
          `
        )
        .bind(
          MAX_ADMIN_QUEUE_RESULTS + 1
        )
        .all();
  } catch (error) {
    console.error(
      "Archive pending moderation query failed:",
      error
    );

    return apiJson(
      {
        error:
          "The moderation queue could not be loaded.",
      },
      500,
      access.corsHeaders
    );
  }

  const rows =
    Array.isArray(
      result?.results
    )
      ? result.results
      : [];

  const hasMore =
    rows.length >
    MAX_ADMIN_QUEUE_RESULTS;

  const visibleRows =
    hasMore
      ? rows.slice(
          0,
          MAX_ADMIN_QUEUE_RESULTS
        )
      : rows;

  return apiJson(
    {
      ok: true,

      uploads:
        visibleRows.map(
          (row) => ({
            id:
              Number(
                row.id
              ),

            uploader:
              String(
                row.discord_username ||
                ""
              ),

            caption:
              row.caption === null
                ? null
                : String(
                    row.caption
                  ),

            mimeType:
              String(
                row.mime_type ||
                ""
              ),

            fileSize:
              Number(
                row.file_size ||
                0
              ),

            uploadedAt:
              String(
                row.uploaded_at ||
                ""
              ),
          })
        ),

      hasMore,
    },
    200,
    access.corsHeaders
  );
}


// ==================================================
// ADMIN: APPROVED
// ==================================================

async function handleAdminApproved(
  request,
  env
) {
  const access =
    await requireAdmin(
      request,
      env
    );

  if (access.response) {
    return access.response;
  }

  if (!env.DB) {
    return apiJson(
      {
        error:
          "Archive database is temporarily unavailable.",
      },
      503,
      access.corsHeaders
    );
  }

  const url =
    new URL(
      request.url
    );

  let limit =
    Number(
      url.searchParams.get(
        "limit"
      )
    );

  if (
    !Number.isSafeInteger(
      limit
    ) ||
    limit <= 0
  ) {
    limit =
      DEFAULT_ADMIN_APPROVED_LIMIT;
  }

  limit =
    Math.min(
      limit,
      MAX_ADMIN_APPROVED_LIMIT
    );

  const beforeRaw =
    url.searchParams.get(
      "before"
    );

  let beforeId =
    null;

  if (
    beforeRaw !== null
  ) {
    const parsed =
      Number(
        beforeRaw
      );

    if (
      !Number.isSafeInteger(
        parsed
      ) ||
      parsed <= 0
    ) {
      return apiJson(
        {
          error:
            "Invalid approved-gallery cursor.",
        },
        400,
        access.corsHeaders
      );
    }

    beforeId =
      parsed;
  }

  let result;

  try {
    if (
      beforeId === null
    ) {
      result =
        await env.DB
          .prepare(
            `
            SELECT
              id,
              discord_username,
              caption,
              mime_type,
              file_size,
              uploaded_at,
              reviewed_at

            FROM archive_uploads

            WHERE status = 'approved'

            ORDER BY id DESC

            LIMIT ?
            `
          )
          .bind(
            limit + 1
          )
          .all();
    } else {
      result =
        await env.DB
          .prepare(
            `
            SELECT
              id,
              discord_username,
              caption,
              mime_type,
              file_size,
              uploaded_at,
              reviewed_at

            FROM archive_uploads

            WHERE
              status = 'approved'
              AND id < ?

            ORDER BY id DESC

            LIMIT ?
            `
          )
          .bind(
            beforeId,
            limit + 1
          )
          .all();
    }
  } catch (error) {
    console.error(
      "Archive approved-management query failed:",
      error
    );

    return apiJson(
      {
        error:
          "Approved screenshots could not be loaded.",
      },
      500,
      access.corsHeaders
    );
  }

  const rows =
    Array.isArray(
      result?.results
    )
      ? result.results
      : [];

  const hasMore =
    rows.length >
    limit;

  const visibleRows =
    hasMore
      ? rows.slice(
          0,
          limit
        )
      : rows;

  const workerOrigin =
    new URL(
      request.url
    ).origin;

  const uploads =
    visibleRows.map(
      (row) => {
        const id =
          Number(
            row.id
          );

        return {
          id,

          uploader:
            String(
              row.discord_username ||
              ""
            ),

          caption:
            row.caption === null
              ? null
              : String(
                  row.caption
                ),

          mimeType:
            String(
              row.mime_type ||
              ""
            ),

          fileSize:
            Number(
              row.file_size ||
              0
            ),

          uploadedAt:
            String(
              row.uploaded_at ||
              ""
            ),

          approvedAt:
            row.reviewed_at === null
              ? null
              : String(
                  row.reviewed_at
                ),

          imageUrl:
            `${workerOrigin}/api/gallery/uploads/${id}/image`,
        };
      }
    );

  const nextCursor =
    hasMore &&
    visibleRows.length > 0
      ? Number(
          visibleRows[
            visibleRows.length - 1
          ].id
        )
      : null;

  return apiJson(
    {
      ok: true,
      uploads,
      hasMore,
      nextCursor,
    },
    200,
    access.corsHeaders
  );
}


// ==================================================
// ADMIN PRIVATE PENDING IMAGE
// ==================================================

async function handleAdminImage(
  request,
  env,
  uploadId
) {
  const access =
    await requireAdmin(
      request,
      env
    );

  if (access.response) {
    return access.response;
  }

  if (
    !env.DB ||
    !env.ARCHIVE_BUCKET
  ) {
    return apiJson(
      {
        error:
          "Archive storage is temporarily unavailable.",
      },
      503,
      access.corsHeaders
    );
  }

  if (
    !Number.isSafeInteger(
      uploadId
    ) ||
    uploadId <= 0
  ) {
    return apiJson(
      {
        error:
          "Invalid upload.",
      },
      400,
      access.corsHeaders
    );
  }

  let row;

  try {
    row =
      await env.DB
        .prepare(
          `
          SELECT
            r2_key,
            mime_type,
            status

          FROM archive_uploads

          WHERE id = ?

          LIMIT 1
          `
        )
        .bind(
          uploadId
        )
        .first();
  } catch {
    return apiJson(
      {
        error:
          "The screenshot could not be loaded.",
      },
      500,
      access.corsHeaders
    );
  }

  if (
    !row ||
    row.status !== "pending"
  ) {
    return apiJson(
      {
        error:
          "Pending screenshot not found.",
      },
      404,
      access.corsHeaders
    );
  }

  const r2Key =
    String(
      row.r2_key ||
      ""
    );

  if (!r2Key) {
    return apiJson(
      {
        error:
          "Screenshot storage reference is missing.",
      },
      500,
      access.corsHeaders
    );
  }

  let object;

  try {
    object =
      await env.ARCHIVE_BUCKET.get(
        r2Key
      );
  } catch {
    return apiJson(
      {
        error:
          "The screenshot could not be loaded.",
      },
      500,
      access.corsHeaders
    );
  }

  if (!object) {
    return apiJson(
      {
        error:
          "Screenshot file not found.",
      },
      404,
      access.corsHeaders
    );
  }

  const contentType =
    selectImageContentType(
      object.httpMetadata?.contentType,
      row.mime_type
    );

  const headers =
    createImageHeaders(
      contentType,
      object,
      "private, no-store"
    );

  appendHeaders(
    headers,
    access.corsHeaders
  );

  return new Response(
    object.body,
    {
      status: 200,
      headers,
    }
  );
}


// ==================================================
// ADMIN APPROVE
// ==================================================

async function handleAdminApprove(
  request,
  env,
  uploadId
) {
  const access =
    await requireAdmin(
      request,
      env
    );

  if (access.response) {
    return access.response;
  }

  if (!env.DB) {
    return apiJson(
      {
        error:
          "Archive database is temporarily unavailable.",
      },
      503,
      access.corsHeaders
    );
  }

  let updateResult;

  try {
    updateResult =
      await env.DB
        .prepare(
          `
          UPDATE archive_uploads

          SET
            status = 'approved',
            reviewed_at = CURRENT_TIMESTAMP,
            reviewed_by_discord_id = ?

          WHERE
            id = ?
            AND status = 'pending'
          `
        )
        .bind(
          access.session.discordId,
          uploadId
        )
        .run();
  } catch {
    return apiJson(
      {
        error:
          "The screenshot could not be approved.",
      },
      500,
      access.corsHeaders
    );
  }

  const changes =
    Number(
      updateResult?.meta?.changes ||
      0
    );

  if (changes !== 1) {
    return moderationConflictResponse(
      uploadId,
      env,
      access.corsHeaders
    );
  }

  return apiJson(
    {
      ok: true,

      upload: {
        id:
          uploadId,

        status:
          "approved",
      },
    },
    200,
    access.corsHeaders
  );
}


// ==================================================
// ADMIN REJECT
// ==================================================

async function handleAdminReject(
  request,
  env,
  uploadId
) {
  const access =
    await requireAdmin(
      request,
      env
    );

  if (access.response) {
    return access.response;
  }

  if (
    !env.DB ||
    !env.ARCHIVE_BUCKET
  ) {
    return apiJson(
      {
        error:
          "Archive storage is temporarily unavailable.",
      },
      503,
      access.corsHeaders
    );
  }

  let row;

  try {
    row =
      await env.DB
        .prepare(
          `
          SELECT
            r2_key,
            status

          FROM archive_uploads

          WHERE id = ?

          LIMIT 1
          `
        )
        .bind(
          uploadId
        )
        .first();
  } catch {
    return apiJson(
      {
        error:
          "The screenshot could not be rejected.",
      },
      500,
      access.corsHeaders
    );
  }

  if (
    !row ||
    row.status !== "pending"
  ) {
    return moderationConflictResponse(
      uploadId,
      env,
      access.corsHeaders
    );
  }

  const r2Key =
    String(
      row.r2_key ||
      ""
    );

  let updateResult;

  try {
    updateResult =
      await env.DB
        .prepare(
          `
          UPDATE archive_uploads

          SET
            status = 'rejected',
            reviewed_at = CURRENT_TIMESTAMP,
            reviewed_by_discord_id = ?

          WHERE
            id = ?
            AND status = 'pending'
          `
        )
        .bind(
          access.session.discordId,
          uploadId
        )
        .run();
  } catch {
    return apiJson(
      {
        error:
          "The screenshot could not be rejected.",
      },
      500,
      access.corsHeaders
    );
  }

  const changes =
    Number(
      updateResult?.meta?.changes ||
      0
    );

  if (changes !== 1) {
    return moderationConflictResponse(
      uploadId,
      env,
      access.corsHeaders
    );
  }

  if (r2Key) {
    try {
      await env.ARCHIVE_BUCKET.delete(
        r2Key
      );
    } catch (error) {
      console.error(
        `Rejected image cleanup failed for upload ${uploadId}:`,
        error
      );
    }
  }

  return apiJson(
    {
      ok: true,

      upload: {
        id:
          uploadId,

        status:
          "rejected",
      },
    },
    200,
    access.corsHeaders
  );
}


// ==================================================
// ADMIN REMOVE
// ==================================================

async function handleAdminRemove(
  request,
  env,
  uploadId
) {
  const access =
    await requireAdmin(
      request,
      env
    );

  if (access.response) {
    return access.response;
  }

  if (
    !env.DB ||
    !env.ARCHIVE_BUCKET
  ) {
    return apiJson(
      {
        error:
          "Archive storage is temporarily unavailable.",
      },
      503,
      access.corsHeaders
    );
  }

  let row;

  try {
    row =
      await env.DB
        .prepare(
          `
          SELECT
            r2_key,
            status

          FROM archive_uploads

          WHERE id = ?

          LIMIT 1
          `
        )
        .bind(
          uploadId
        )
        .first();
  } catch {
    return apiJson(
      {
        error:
          "The screenshot could not be removed.",
      },
      500,
      access.corsHeaders
    );
  }

  if (!row) {
    return apiJson(
      {
        error:
          "Screenshot not found.",
      },
      404,
      access.corsHeaders
    );
  }

  if (
    row.status !== "approved"
  ) {
    return removalConflictResponse(
      uploadId,
      env,
      access.corsHeaders
    );
  }

  const r2Key =
    String(
      row.r2_key ||
      ""
    );

  let updateResult;

  try {
    updateResult =
      await env.DB
        .prepare(
          `
          UPDATE archive_uploads

          SET
            status = 'removed',
            removed_at = CURRENT_TIMESTAMP,
            removed_by_discord_id = ?

          WHERE
            id = ?
            AND status = 'approved'
          `
        )
        .bind(
          access.session.discordId,
          uploadId
        )
        .run();
  } catch {
    return apiJson(
      {
        error:
          "The screenshot could not be removed.",
      },
      500,
      access.corsHeaders
    );
  }

  const changes =
    Number(
      updateResult?.meta?.changes ||
      0
    );

  if (changes !== 1) {
    return removalConflictResponse(
      uploadId,
      env,
      access.corsHeaders
    );
  }

  if (r2Key) {
    try {
      await env.ARCHIVE_BUCKET.delete(
        r2Key
      );
    } catch (error) {
      console.error(
        `Removed image cleanup failed for upload ${uploadId}:`,
        error
      );
    }
  }

  return apiJson(
    {
      ok: true,

      upload: {
        id:
          uploadId,

        status:
          "removed",
      },
    },
    200,
    access.corsHeaders
  );
}


// ==================================================
// CONFLICT HELPERS
// ==================================================

async function moderationConflictResponse(
  uploadId,
  env,
  corsHeaders
) {
  let row =
    null;

  try {
    row =
      await env.DB
        .prepare(
          `
          SELECT status
          FROM archive_uploads
          WHERE id = ?
          LIMIT 1
          `
        )
        .bind(
          uploadId
        )
        .first();
  } catch {
    // Generic response below.
  }

  if (!row) {
    return apiJson(
      {
        error:
          "Screenshot not found.",
      },
      404,
      corsHeaders
    );
  }

  return apiJson(
    {
      error:
        "This screenshot has already been reviewed.",

      status:
        String(
          row.status ||
          ""
        ),
    },
    409,
    corsHeaders
  );
}


async function removalConflictResponse(
  uploadId,
  env,
  corsHeaders
) {
  let row =
    null;

  try {
    row =
      await env.DB
        .prepare(
          `
          SELECT status
          FROM archive_uploads
          WHERE id = ?
          LIMIT 1
          `
        )
        .bind(
          uploadId
        )
        .first();
  } catch {
    // Generic response below.
  }

  if (!row) {
    return apiJson(
      {
        error:
          "Screenshot not found.",
      },
      404,
      corsHeaders
    );
  }

  const status =
    String(
      row.status ||
      ""
    );

  return apiJson(
    {
      error:
        status === "removed"
          ? "This screenshot has already been removed."
          : "This screenshot is no longer approved.",

      status,
    },
    409,
    corsHeaders
  );
}


// ==================================================
// ADMIN AUTHORIZATION
// ==================================================

async function requireAdmin(
  request,
  env
) {
  const corsResult =
    getCorsResult(
      request
    );

  if (!corsResult.allowed) {
    return {
      response:
        apiJson(
          {
            error:
              "Origin not allowed.",
          },
          403,
          null
        ),

      session: null,
      corsHeaders: null,
    };
  }

  const session =
    await authenticateRequest(
      request,
      env
    );

  if (!session) {
    return {
      response:
        apiJson(
          {
            error:
              "Your archive session has expired. Please sign in again.",
          },
          401,
          corsResult.headers
        ),

      session: null,
      corsHeaders:
        corsResult.headers,
    };
  }

  if (
    !isArchiveAdmin(
      session.discordId,
      env
    )
  ) {
    return {
      response:
        apiJson(
          {
            error:
              "You do not have permission to access archive moderation.",
          },
          403,
          corsResult.headers
        ),

      session,
      corsHeaders:
        corsResult.headers,
    };
  }

  return {
    response: null,
    session,
    corsHeaders:
      corsResult.headers,
  };
}


function isArchiveAdmin(
  discordId,
  env
) {
  const adminIds =
    parseAdminDiscordIds(
      env.ARCHIVE_ADMIN_DISCORD_IDS
    );

  return adminIds.has(
    String(
      discordId
    )
  );
}


function parseAdminDiscordIds(
  rawValue
) {
  return new Set(
    String(
      rawValue ||
      ""
    )
      .split(
        /[\s,]+/
      )
      .map(
        (value) =>
          value.trim()
      )
      .filter(
        (value) =>
          /^\d+$/.test(
            value
          )
      )
  );
}


// ==================================================
// IMAGE HELPERS
// ==================================================

function detectImageType(
  bytes
) {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return {
      mimeType:
        "image/png",

      extension:
        "png",
    };
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return {
      mimeType:
        "image/jpeg",

      extension:
        "jpg",
    };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return {
      mimeType:
        "image/webp",

      extension:
        "webp",
    };
  }

  return null;
}


function isAllowedImageMime(
  value
) {
  return (
    value === "image/png" ||
    value === "image/jpeg" ||
    value === "image/webp"
  );
}


function selectImageContentType(
  storedValue,
  databaseValue
) {
  const stored =
    String(
      storedValue ||
      ""
    );

  const database =
    String(
      databaseValue ||
      ""
    );

  if (
    isAllowedImageMime(
      stored
    )
  ) {
    return stored;
  }

  if (
    isAllowedImageMime(
      database
    )
  ) {
    return database;
  }

  return "application/octet-stream";
}


function createImageHeaders(
  contentType,
  object,
  cacheControl
) {
  const headers =
    new Headers();

  headers.set(
    "Content-Type",
    contentType
  );

  headers.set(
    "Content-Disposition",
    "inline"
  );

  headers.set(
    "Cache-Control",
    cacheControl
  );

  headers.set(
    "X-Content-Type-Options",
    "nosniff"
  );

  if (
    object.size !==
    undefined
  ) {
    headers.set(
      "Content-Length",
      String(
        object.size
      )
    );
  }

  if (
    object.httpEtag
  ) {
    headers.set(
      "ETag",
      object.httpEtag
    );
  }

  return headers;
}


// ==================================================
// AUTHENTICATION
// ==================================================

async function authenticateRequest(
  request,
  env
) {
  const token =
    readBearerToken(
      request
    );

  if (!token) {
    return null;
  }

  return verifySessionToken(
    token,
    env
  );
}


function readBearerToken(
  request
) {
  const header =
    request.headers.get(
      "Authorization"
    );

  if (!header) {
    return null;
  }

  const match =
    header.match(
      /^Bearer\s+(.+)$/i
    );

  if (!match) {
    return null;
  }

  const token =
    match[1].trim();

  if (
    !token ||
    token.length > 4096
  ) {
    return null;
  }

  return token;
}


// ==================================================
// SESSION TOKENS
// ==================================================

async function createSessionToken(
  user,
  env
) {
  const now =
    Math.floor(
      Date.now() / 1000
    );

  const payload = {
    v: 1,
    iss: "cozy-archive",
    sub: user.discordId,
    username: user.username,
    displayName: user.displayName,
    iat: now,
    exp:
      now +
      SESSION_MAX_AGE_SECONDS,
    jti:
      crypto.randomUUID(),
  };

  const encodedPayload =
    base64UrlEncodeString(
      JSON.stringify(
        payload
      )
    );

  const signature =
    await signValue(
      encodedPayload,
      env.ARCHIVE_SESSION_SECRET
    );

  return (
    `${encodedPayload}.${signature}`
  );
}


async function verifySessionToken(
  rawToken,
  env
) {
  if (
    typeof rawToken !==
      "string" ||
    rawToken.length < 20 ||
    rawToken.length > 4096
  ) {
    return null;
  }

  const separator =
    rawToken.lastIndexOf(
      "."
    );

  if (
    separator <= 0 ||
    separator ===
      rawToken.length - 1
  ) {
    return null;
  }

  const payloadPart =
    rawToken.slice(
      0,
      separator
    );

  const signaturePart =
    rawToken.slice(
      separator + 1
    );

  let expectedSignature;

  try {
    expectedSignature =
      await signValue(
        payloadPart,
        env.ARCHIVE_SESSION_SECRET
      );
  } catch {
    return null;
  }

  if (
    !constantTimeEqual(
      signaturePart,
      expectedSignature
    )
  ) {
    return null;
  }

  let payload;

  try {
    payload =
      JSON.parse(
        base64UrlDecodeString(
          payloadPart
        )
      );
  } catch {
    return null;
  }

  if (
    !payload ||
    payload.v !== 1 ||
    payload.iss !==
      "cozy-archive"
  ) {
    return null;
  }

  const discordId =
    String(
      payload.sub ||
      ""
    );

  const username =
    normalizeText(
      payload.username,
      80
    );

  const displayName =
    normalizeText(
      payload.displayName ||
      payload.username,
      100
    );

  const issuedAt =
    Number(
      payload.iat
    );

  const expiresAt =
    Number(
      payload.exp
    );

  if (
    !discordId ||
    !/^\d+$/.test(
      discordId
    ) ||
    !username ||
    !Number.isInteger(
      issuedAt
    ) ||
    !Number.isInteger(
      expiresAt
    )
  ) {
    return null;
  }

  const now =
    Math.floor(
      Date.now() / 1000
    );

  if (
    expiresAt <= now ||
    issuedAt > now + 60 ||
    expiresAt - issuedAt >
      SESSION_MAX_AGE_SECONDS
  ) {
    return null;
  }

  return {
    discordId,
    username,
    displayName,
    issuedAt,
    expiresAt,
  };
}


// ==================================================
// CORS
// ==================================================

function getCorsResult(
  request
) {
  const origin =
    request.headers.get(
      "Origin"
    );

  if (!origin) {
    return {
      allowed: true,
      headers: null,
    };
  }

  if (
    !ALLOWED_ORIGINS.has(
      origin
    )
  ) {
    return {
      allowed: false,
      headers: null,
    };
  }

  const headers =
    new Headers();

  headers.set(
    "Access-Control-Allow-Origin",
    origin
  );

  headers.set(
    "Vary",
    "Origin"
  );

  return {
    allowed: true,
    headers,
  };
}


function handleOptions(
  request
) {
  const origin =
    request.headers.get(
      "Origin"
    );

  if (
    !origin ||
    !ALLOWED_ORIGINS.has(
      origin
    )
  ) {
    return new Response(
      null,
      {
        status: 403,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const requestedMethod =
    String(
      request.headers.get(
        "Access-Control-Request-Method"
      ) || ""
    ).toUpperCase();

  if (
    requestedMethod &&
    requestedMethod !== "GET" &&
    requestedMethod !== "POST" &&
    requestedMethod !== "PUT" &&
    requestedMethod !== "DELETE"
  ) {
    return new Response(
      null,
      {
        status: 405,

        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  }

  const headers =
    new Headers();

  headers.set(
    "Access-Control-Allow-Origin",
    origin
  );

  headers.set(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );

  headers.set(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type"
  );

  headers.set(
    "Access-Control-Max-Age",
    "600"
  );

  headers.set(
    "Cache-Control",
    "no-store"
  );

  headers.set(
    "Vary",
    "Origin"
  );

  return new Response(
    null,
    {
      status: 204,
      headers,
    }
  );
}


// ==================================================
// COOKIES / REDIRECTS
// ==================================================

function parseCookies(
  cookieHeader
) {
  const result = {};

  for (
    const part of
    cookieHeader.split(";")
  ) {
    const separator =
      part.indexOf("=");

    if (
      separator === -1
    ) {
      continue;
    }

    const name =
      part
        .slice(
          0,
          separator
        )
        .trim();

    const value =
      part
        .slice(
          separator + 1
        )
        .trim();

    if (!name) {
      continue;
    }

    try {
      result[name] =
        decodeURIComponent(
          value
        );
    } catch {
      result[name] =
        value;
    }
  }

  return result;
}


function serializeCookie(
  name,
  value,
  options = {}
) {
  let cookie =
    `${name}=${encodeURIComponent(value)}`;

  if (
    options.maxAge !==
    undefined
  ) {
    cookie +=
      `; Max-Age=${options.maxAge}`;
  }

  if (options.path) {
    cookie +=
      `; Path=${options.path}`;
  }

  if (options.httpOnly) {
    cookie +=
      "; HttpOnly";
  }

  if (options.secure) {
    cookie +=
      "; Secure";
  }

  if (options.sameSite) {
    cookie +=
      `; SameSite=${options.sameSite}`;
  }

  return cookie;
}


function clearCookie(
  name
) {
  return (
    `${name}=; ` +
    "Max-Age=0; " +
    "Path=/; " +
    "HttpOnly; " +
    "Secure; " +
    "SameSite=Lax"
  );
}


function redirectToArchive(
  cookie = null
) {
  const headers =
    new Headers();

  headers.set(
    "Location",
    ARCHIVE_URL
  );

  headers.set(
    "Cache-Control",
    "no-store"
  );

  if (cookie) {
    headers.append(
      "Set-Cookie",
      cookie
    );
  }

  return new Response(
    null,
    {
      status: 302,
      headers,
    }
  );
}


function redirectToArchiveWithSession(
  sessionToken,
  cookie = null
) {
  const destination =
    `${ARCHIVE_URL}#session=${encodeURIComponent(sessionToken)}`;

  const headers =
    new Headers();

  headers.set(
    "Location",
    destination
  );

  headers.set(
    "Cache-Control",
    "no-store"
  );

  headers.set(
    "Referrer-Policy",
    "no-referrer"
  );

  if (cookie) {
    headers.append(
      "Set-Cookie",
      cookie
    );
  }

  return new Response(
    null,
    {
      status: 302,
      headers,
    }
  );
}


// ==================================================
// CRYPTO
// ==================================================

async function signValue(
  value,
  secret
) {
  const encoder =
    new TextEncoder();

  const key =
    await crypto.subtle.importKey(
      "raw",
      encoder.encode(
        secret
      ),
      {
        name:
          "HMAC",

        hash:
          "SHA-256",
      },
      false,
      [
        "sign",
      ]
    );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(
        value
      )
    );

  return bytesToBase64Url(
    new Uint8Array(
      signature
    )
  );
}


function randomToken() {
  const bytes =
    new Uint8Array(
      32
    );

  crypto.getRandomValues(
    bytes
  );

  return bytesToBase64Url(
    bytes
  );
}


function constantTimeEqual(
  a,
  b
) {
  if (
    typeof a !== "string" ||
    typeof b !== "string" ||
    a.length !== b.length
  ) {
    return false;
  }

  let difference =
    0;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    difference |=
      a.charCodeAt(i) ^
      b.charCodeAt(i);
  }

  return (
    difference === 0
  );
}


// ==================================================
// BASE64URL
// ==================================================

function base64UrlEncodeString(
  value
) {
  return bytesToBase64Url(
    new TextEncoder()
      .encode(
        value
      )
  );
}


function base64UrlDecodeString(
  value
) {
  if (
    !/^[A-Za-z0-9_-]+$/.test(
      value
    )
  ) {
    throw new Error(
      "Invalid base64url."
    );
  }

  const base64 =
    value
      .replace(
        /-/g,
        "+"
      )
      .replace(
        /_/g,
        "/"
      );

  const padded =
    base64 +
    "=".repeat(
      (
        4 -
        (
          base64.length %
          4
        )
      ) %
      4
    );

  const binary =
    atob(
      padded
    );

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return new TextDecoder(
    "utf-8",
    {
      fatal: true,
    }
  ).decode(
    bytes
  );
}


function bytesToBase64Url(
  bytes
) {
  let binary =
    "";

  for (
    const byte of
    bytes
  ) {
    binary +=
      String.fromCharCode(
        byte
      );
  }

  return btoa(
    binary
  )
    .replace(
      /\+/g,
      "-"
    )
    .replace(
      /\//g,
      "_"
    )
    .replace(
      /=+$/g,
      ""
    );
}


// ==================================================
// RESPONSES
// ==================================================

function apiJson(
  value,
  status,
  corsHeaders = null
) {
  const headers =
    new Headers();

  headers.set(
    "Content-Type",
    "application/json; charset=UTF-8"
  );

  headers.set(
    "Cache-Control",
    "no-store"
  );

  headers.set(
    "X-Content-Type-Options",
    "nosniff"
  );

  appendHeaders(
    headers,
    corsHeaders
  );

  return new Response(
    JSON.stringify(
      value
    ),
    {
      status,
      headers,
    }
  );
}


function apiJsonWithHeaders(
  value,
  status,
  suppliedHeaders
) {
  const headers =
    new Headers(
      suppliedHeaders ||
      undefined
    );

  headers.set(
    "Content-Type",
    "application/json; charset=UTF-8"
  );

  headers.set(
    "X-Content-Type-Options",
    "nosniff"
  );

  return new Response(
    JSON.stringify(
      value
    ),
    {
      status,
      headers,
    }
  );
}


function json(
  value,
  status = 200
) {
  return apiJson(
    value,
    status,
    null
  );
}


function noStoreResponse(
  body,
  status
) {
  return new Response(
    body,
    {
      status,

      headers: {
        "Content-Type":
          "text/plain; charset=UTF-8",

        "Cache-Control":
          "no-store",

        "X-Content-Type-Options":
          "nosniff",
      },
    }
  );
}


function appendHeaders(
  target,
  source
) {
  if (!source) {
    return;
  }

  for (
    const [
      name,
      value
    ] of source
  ) {
    target.set(
      name,
      value
    );
  }
}


// ==================================================
// NORMALIZATION
// ==================================================

function normalizeText(
  value,
  maxLength
) {
  const text =
    String(
      value ||
      ""
    )
      .replace(
        /[\u0000-\u001F\u007F]/g,
        ""
      )
      .trim();

  if (!text) {
    return "";
  }

  return text.slice(
    0,
    maxLength
  );
}


function normalizeCaption(
  value
) {
  return String(
    value ||
    ""
  )
    .replace(
      /\r\n/g,
      "\n"
    )
    .replace(
      /\r/g,
      "\n"
    )
    .replace(
      /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g,
      ""
    )
    .trim();
}


function normalizeUploadStatus(
  value
) {
  const status =
    String(
      value ||
      ""
    );

  switch (status) {
    case "pending":
    case "approved":
    case "rejected":
    case "removed":
      return status;

    default:
      return "unknown";
  }
}
