/**
 * End-to-end test for the logout flow.
 *
 * Creates a throwaway admin, logs in, verifies the admin_session cookie is
 * set, calls POST /api/admin/logout, verifies the cookie is cleared, and
 * confirms the middleware redirects /dashboard to /login afterwards.
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

// Read .env.local manually because dotenv is not a project dependency.
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

const BASE_URL = "http://127.0.0.1:8090";
const TEST_EMAIL = `logout-test-${Date.now()}@example.com`;
const TEST_PASSWORD = `p${Math.random().toString(36).slice(2)}!`;
const PORT = 8090;

const { hashPassword } = require("../lib/password.ts");

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          const setCookie = Array.isArray(res.headers["set-cookie"])
            ? res.headers["set-cookie"]
            : res.headers["set-cookie"]
            ? [res.headers["set-cookie"]]
            : [];
          resolve({
            status: res.statusCode,
            headers: res.headers,
            setCookie,
            body,
            location: res.headers.location,
          });
        });
      }
    );
    req.on("error", reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function findAdminSessionCookie(setCookie) {
  return setCookie.find((c) => c.startsWith("admin_session="));
}

async function main() {
  const pool = new Pool({
    host: process.env.DATABASE_HOST,
    port: Number(process.env.DATABASE_PORT ?? "5432"),
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    ssl: process.env.DATABASE_SSL === "true" ? true : false,
  });

  // Insert throwaway admin with known password.
  const hash = hashPassword(TEST_PASSWORD);
  const insertResult = await pool.query(
    "INSERT INTO admin_users (email, password_hash) VALUES ($1, $2) RETURNING id",
    [TEST_EMAIL, hash]
  );
  const adminId = insertResult.rows[0].id;
  console.log(`Created test admin id=${adminId}`);

  try {
    // 1. Login with JSON endpoint used by the login form.
    const loginRes = await request("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
    });

    if (loginRes.status !== 200) {
      throw new Error(`Login failed: ${loginRes.status} ${loginRes.body}`);
    }

    const loginCookie = findAdminSessionCookie(loginRes.setCookie);
    if (!loginCookie) {
      throw new Error("Login did not set admin_session cookie");
    }
    if (loginCookie.includes("admin_session=;")) {
      throw new Error("Login set an empty admin_session cookie");
    }
    console.log("Login set admin_session cookie:", loginCookie.split(";")[0]);

    // 2. Access dashboard with the cookie.
    const dashboardRes = await request("/dashboard", {
      headers: { Cookie: loginCookie },
    });
    if (dashboardRes.status !== 200) {
      throw new Error(`Dashboard request failed: ${dashboardRes.status}`);
    }
    console.log("Dashboard accessible with session cookie");

    // 3. Call logout endpoint.
    const logoutRes = await request("/api/admin/logout", {
      method: "POST",
      headers: { Cookie: loginCookie },
    });

    if (logoutRes.status !== 303 || !logoutRes.location || !logoutRes.location.includes("/login")) {
      throw new Error(
        `Logout did not redirect to /login: status=${logoutRes.status} location=${logoutRes.location}`
      );
    }

    const logoutCookie = findAdminSessionCookie(logoutRes.setCookie);
    if (!logoutCookie) {
      throw new Error("Logout response did not include a Set-Cookie for admin_session");
    }
    if (!logoutCookie.includes("admin_session=;") || !logoutCookie.includes("Max-Age=0")) {
      throw new Error(`Logout did not clear admin_session cookie: ${logoutCookie}`);
    }
    console.log("Logout cleared admin_session cookie:", logoutCookie.split(";")[0]);

    // 4. Try dashboard again with the cleared cookie.
    const afterLogoutRes = await request("/dashboard", {
      headers: { Cookie: logoutCookie },
    });
    if (afterLogoutRes.status !== 307 && afterLogoutRes.status !== 302 && afterLogoutRes.status !== 303) {
      throw new Error(
        `Dashboard did not redirect after logout: status=${afterLogoutRes.status}`
      );
    }
    if (!afterLogoutRes.location || !afterLogoutRes.location.includes("/login")) {
      throw new Error(
        `Dashboard redirect target is not /login: ${afterLogoutRes.location}`
      );
    }
    console.log("Dashboard redirected to login after logout");

    console.log("\nAll logout flow tests passed.");
  } finally {
    await pool.query("DELETE FROM admin_users WHERE id = $1", [adminId]);
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
