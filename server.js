// ═══════════════════════════════════════════════════════════════
// ST NEGATION TOOL — Web Server
// Handles Amazon OAuth + proxies API calls
// ═══════════════════════════════════════════════════════════════

const express = require("express");
const session = require("express-session");
const fetch = require("node-fetch");
const path = require("path");
const pako = require("pako");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Session for storing tokens per user
app.use(session({
  secret: process.env.SESSION_SECRET || "st-negation-secret-change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 30 * 24 * 60 * 60 * 1000 } // 30 days
}));

// Serve static files
app.use(express.static(path.join(__dirname, "public")));

// ─── Config ───
const CLIENT_ID = process.env.AMAZON_CLIENT_ID || "";
const CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";
const TOKEN_URL = "https://api.amazon.com/auth/o2/token";

const REGIONS = {
  NA: "https://advertising-api.amazon.com",
  EU: "https://advertising-api-eu.amazon.com",
  FE: "https://advertising-api-fe.amazon.com"
};

// ═══════════════════════════════════════════════════════════════
// OAUTH ROUTES
// ═══════════════════════════════════════════════════════════════

// Step 1: Redirect user to Amazon login
app.get("/auth/amazon", (req, res) => {
  if (!CLIENT_ID) return res.status(500).json({ error: "AMAZON_CLIENT_ID not configured" });

  const scope = "advertising::campaign_management";
  const redirectUri = APP_URL + "/auth/callback";
  const url = "https://www.amazon.com/ap/oa?" + new URLSearchParams({
    client_id: CLIENT_ID,
    scope: scope,
    response_type: "code",
    redirect_uri: redirectUri
  }).toString();

  res.redirect(url);
});

// Step 2: Amazon redirects back with authorization code
app.get("/auth/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.redirect("/?error=no_code");

  try {
    // Exchange code for tokens
    const tokenResp = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: APP_URL + "/auth/callback"
      })
    });

    const tokenData = await tokenResp.json();

    if (tokenData.error) {
      console.error("Token error:", tokenData);
      return res.redirect("/?error=token_failed&msg=" + encodeURIComponent(tokenData.error_description || tokenData.error));
    }

    // Store tokens in session
    req.session.accessToken = tokenData.access_token;
    req.session.refreshToken = tokenData.refresh_token;
    req.session.tokenExpires = Date.now() + (tokenData.expires_in * 1000);
    req.session.connected = true;

    // Load profiles immediately
    try {
      const profiles = await fetchProfiles(tokenData.access_token);
      req.session.profiles = profiles;
    } catch (e) {
      console.error("Profile fetch error:", e.message);
    }

    res.redirect("/?connected=true");
  } catch (e) {
    console.error("Auth error:", e);
    res.redirect("/?error=auth_failed&msg=" + encodeURIComponent(e.message));
  }
});

// Disconnect
app.post("/auth/disconnect", (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// Check connection status
app.get("/auth/status", (req, res) => {
  res.json({
    connected: !!req.session.connected,
    profiles: req.session.profiles || [],
    hasToken: !!req.session.refreshToken
  });
});

// ═══════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════

async function getValidToken(session) {
  // Token still valid?
  if (session.accessToken && Date.now() < (session.tokenExpires || 0) - 60000) {
    return session.accessToken;
  }

  // Refresh it
  if (!session.refreshToken) throw new Error("Not connected. Please connect your Amazon account.");

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: session.refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    })
  });

  const data = await resp.json();
  if (data.error) throw new Error("Token refresh failed: " + (data.error_description || data.error));

  session.accessToken = data.access_token;
  session.tokenExpires = Date.now() + (data.expires_in * 1000);
  return data.access_token;
}

// ═══════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════

// Middleware: require auth
function requireAuth(req, res, next) {
  if (!req.session.connected || !req.session.refreshToken) {
    return res.status(401).json({ error: "Not connected. Please connect your Amazon account." });
  }
  next();
}

// Get advertising profiles (accounts)
app.get("/api/profiles", requireAuth, async (req, res) => {
  try {
    const token = await getValidToken(req.session);
    const profiles = await fetchProfiles(token);
    req.session.profiles = profiles;
    res.json(profiles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function fetchProfiles(token) {
  // Try all regions and merge results
  const allProfiles = [];

  for (const [region, endpoint] of Object.entries(REGIONS)) {
    try {
      const resp = await fetch(endpoint + "/v2/profiles", {
        headers: {
          "Authorization": "Bearer " + token,
          "Amazon-Advertising-API-ClientId": CLIENT_ID,
          "Content-Type": "application/json"
        }
      });
      if (resp.ok) {
        const profiles = await resp.json();
        profiles.forEach(p => {
          if (p.accountInfo && (p.accountInfo.type === "seller" || p.accountInfo.type === "vendor" || p.accountInfo.type === "agency")) {
            allProfiles.push({
              profileId: p.profileId,
              countryCode: p.countryCode,
              currencyCode: p.currencyCode,
              timezone: p.timezone,
              accountName: (p.accountInfo.name || p.accountInfo.id || "Unknown"),
              accountType: p.accountInfo.type,
              marketplace: p.accountInfo.marketplaceStringId || p.countryCode,
              region: region
            });
          }
        });
      }
    } catch (e) {
      // Skip regions with errors
    }
  }

  return allProfiles;
}

// Request search term report
app.post("/api/report/request", requireAuth, async (req, res) => {
  try {
    const { profileId, days, region } = req.body;
    const token = await getValidToken(req.session);
    const endpoint = REGIONS[region || "NA"];

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days || 30));
    const fmtDate = d => d.toISOString().split("T")[0].replace(/-/g, "");

    // Try V2 SP search term report
    const reportBody = {
      reportDate: fmtDate(endDate),
      metrics: "impressions,clicks,cost,attributedSales14d,attributedUnitsOrdered14d",
      segment: "query",
      reportType: "searchTerm"
    };

    const resp = await fetch(endpoint + "/v2/sp/targets/report", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Amazon-Advertising-API-ClientId": CLIENT_ID,
        "Amazon-Advertising-API-Scope": String(profileId),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(reportBody)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return res.status(resp.status).json({ error: "Report request failed: " + errText });
    }

    const result = await resp.json();
    res.json({ reportId: result.reportId, status: result.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Poll report status
app.get("/api/report/status/:reportId", requireAuth, async (req, res) => {
  try {
    const { profileId, region } = req.query;
    const token = await getValidToken(req.session);
    const endpoint = REGIONS[region || "NA"];

    const resp = await fetch(endpoint + "/v2/reports/" + req.params.reportId, {
      headers: {
        "Authorization": "Bearer " + token,
        "Amazon-Advertising-API-ClientId": CLIENT_ID,
        "Amazon-Advertising-API-Scope": String(profileId)
      }
    });

    if (!resp.ok) return res.status(resp.status).json({ error: "Status check failed" });

    const status = await resp.json();
    res.json(status);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Download report data
app.get("/api/report/download", requireAuth, async (req, res) => {
  try {
    const { url, profileId, region } = req.query;
    const token = await getValidToken(req.session);

    const resp = await fetch(url, {
      headers: {
        "Authorization": "Bearer " + token,
        "Amazon-Advertising-API-ClientId": CLIENT_ID,
        "Amazon-Advertising-API-Scope": String(profileId)
      }
    });

    if (!resp.ok) return res.status(resp.status).json({ error: "Download failed" });

    // Handle gzip response
    const buffer = await resp.buffer();
    let jsonData;
    try {
      // Try decompressing gzip
      const decompressed = pako.ungzip(buffer, { to: "string" });
      jsonData = JSON.parse(decompressed);
    } catch (e) {
      // Not gzipped, try as plain JSON
      jsonData = JSON.parse(buffer.toString());
    }

    // Normalize the data
    const normalized = (Array.isArray(jsonData) ? jsonData : []).map(r => ({
      campaign: r.campaignName || "",
      campaignId: String(r.campaignId || ""),
      adGroup: r.adGroupName || "",
      adGroupId: String(r.adGroupId || ""),
      searchTerm: r.query || r.searchTerm || r.keywordText || "",
      targeting: r.targeting || r.keywordText || "",
      matchType: r.matchType || "",
      impressions: Number(r.impressions) || 0,
      clicks: Number(r.clicks) || 0,
      spend: Number(r.cost) || 0,
      sales: Number(r.attributedSales14d || r.attributedSales7d || r.sales) || 0,
      orders: Number(r.attributedUnitsOrdered14d || r.attributedUnitsOrdered7d || r.orders) || 0,
    })).filter(r => r.searchTerm && r.searchTerm !== "—").map(r => {
      r.ctr = r.impressions > 0 ? r.clicks / r.impressions : 0;
      r.cpc = r.clicks > 0 ? r.spend / r.clicks : 0;
      r.acos = r.sales > 0 ? r.spend / r.sales : 0;
      return r;
    });

    res.json(normalized);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create negative keywords
app.post("/api/negate", requireAuth, async (req, res) => {
  try {
    const { profileId, region, keywords, level } = req.body;
    const token = await getValidToken(req.session);
    const endpoint = REGIONS[region || "NA"];

    const apiPath = level === "campaign"
      ? "/v2/sp/campaignNegativeKeywords"
      : "/v2/sp/negativeKeywords";

    const body = keywords.map(kw => ({
      campaignId: Number(kw.campaignId),
      ...(level !== "campaign" && kw.adGroupId ? { adGroupId: Number(kw.adGroupId) } : {}),
      keywordText: kw.searchTerm,
      matchType: kw.matchType || "negativeExact",
      state: "enabled"
    }));

    // Batch in groups of 1000
    const results = [];
    for (let i = 0; i < body.length; i += 1000) {
      const batch = body.slice(i, i + 1000);
      const resp = await fetch(endpoint + apiPath, {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Amazon-Advertising-API-ClientId": CLIENT_ID,
          "Amazon-Advertising-API-Scope": String(profileId),
          "Content-Type": "application/json"
        },
        body: JSON.stringify(batch)
      });

      if (resp.ok) {
        const data = await resp.json();
        results.push({ batch: i, count: batch.length, success: true, data });
      } else {
        const errText = await resp.text();
        results.push({ batch: i, count: batch.length, success: false, error: errText });
      }
    }

    const applied = results.filter(r => r.success).reduce((s, r) => s + r.count, 0);
    const failed = results.filter(r => !r.success).length;

    res.json({
      applied: applied,
      failed: failed,
      total: keywords.length,
      msg: applied + " negative keywords created" + (failed > 0 ? " (" + failed + " batches failed)" : ""),
      results
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Save/load user settings (stored in session)
app.post("/api/settings", (req, res) => {
  req.session.userSettings = req.body;
  res.json({ ok: true });
});
app.get("/api/settings", (req, res) => {
  res.json(req.session.userSettings || {});
});

// Save/load profiles
app.post("/api/profiles/saved", (req, res) => {
  req.session.savedProfiles = req.body;
  res.json({ ok: true });
});
app.get("/api/profiles/saved", (req, res) => {
  res.json(req.session.savedProfiles || []);
});

// Catch-all: serve the app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n⛔ ST Negation Tool running at http://localhost:${PORT}`);
  console.log(`\n  Amazon Client ID: ${CLIENT_ID ? "✅ Set" : "❌ Missing"}`);
  console.log(`  Amazon Client Secret: ${CLIENT_SECRET ? "✅ Set" : "❌ Missing"}`);
  console.log(`  App URL: ${APP_URL}\n`);
});
