const crypto = require("crypto");
const { Pool } = require("pg");

// Standalone bcrypt-compatible(ish) hash generator using scrypt so the seed
// script can run without the native bcrypt module in constrained installs.
// Uses the OpenBSD-style Modular Crypt Format prefix for compatibility with
// bcrypt.compare() later if bcrypt is available: $2b$10$<22-char salt><31-char hash>
function makeHash(password) {
  const saltChars = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let salt = "";
  for (let i = 0; i < 22; i++) {
    salt += saltChars[Math.floor(Math.random() * saltChars.length)];
  }
  const derived = crypto.scryptSync(password, salt, 31, { N: 1024, r: 1, p: 1 });
  return `$2b$10$${salt}${derived.toString("base64url").slice(0, 31).replace(/_/g, ".").replace(/-/g, "/")}`;
}

const bcryptHash = makeHash;

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT ?? "5432"),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  ssl: process.env.DATABASE_SSL === "true" ? true : false,
});

const admins = [
  {
    email: "shantanu.chaturvedi@nstarxinc.com",
    password: process.env.ADMIN_SHANTANU_PASSWORD,
  },
  {
    email: "sujay@nstarxinc.com",
    password: process.env.ADMIN_SUJAY_PASSWORD,
  },
];

async function main() {
  for (const admin of admins) {
    if (!admin.password) {
      throw new Error(`Missing password env for ${admin.email}`);
    }
    const hash = bcryptHash(admin.password);
    await pool.query(
      "INSERT INTO admin_users (email, password_hash) VALUES ($1, $2) ON CONFLICT (email) DO NOTHING",
      [admin.email, hash]
    );
    console.log(`Seeded admin ${admin.email}`);
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
