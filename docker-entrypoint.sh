#!/bin/sh
set -eu

cd /app

# Run Drizzle migrations before starting the app.
echo "Running database migrations..."
npx drizzle-kit migrate

# Seed admin credentials; ON CONFLICT UPDATE keeps them in sync with env.
echo "Seeding admin users..."
node /app/scripts/seed.js

echo "Starting Next.js standalone server..."
exec "$@"
