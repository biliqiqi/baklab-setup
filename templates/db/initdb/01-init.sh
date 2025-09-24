#!/bin/bash
set -e

# Temporarily disable statement logging to prevent password leakage
export PGCLIENTENCODING=UTF8

# Create user if not exists (using CREATE ROLE IF NOT EXISTS - PostgreSQL 9.1+)
PGPASSWORD="${POSTGRES_PASSWORD}" psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres \
-v app_user="${APP_DB_USER}" -v app_password="${APP_DB_PASSWORD}" << EOF > /dev/null 2>&1
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'app_user', :'app_password')
WHERE NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = :'app_user')
\\gexec
EOF

# Create database if not exists
cat > /tmp/create-db.sql << EOF
SELECT 'CREATE DATABASE ${APP_DB_NAME} WITH OWNER ${APP_DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${APP_DB_NAME}')
\gexec
EOF

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -f /tmp/create-db.sql

# Grant permissions and setup database
cat > /tmp/setup-permissions.sql << EOF
GRANT CONNECT ON DATABASE ${APP_DB_NAME} TO ${APP_DB_USER};

\c ${APP_DB_NAME}

GRANT USAGE ON SCHEMA public TO ${APP_DB_USER};
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${APP_DB_USER};
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ${APP_DB_USER};

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO ${APP_DB_USER};
EOF

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname postgres -f /tmp/setup-permissions.sql

# Cleanup temporary files
rm -f /tmp/create-db.sql /tmp/setup-permissions.sql