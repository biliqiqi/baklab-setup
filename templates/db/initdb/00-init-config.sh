#!/bin/bash
set -e

# Configure PostgreSQL log level based on DEBUG mode
if [ "$DEBUG" = "true" ]; then
    LOG_STATEMENT="all"
    echo "DEBUG mode enabled: Setting log_statement to 'all'"
else
    LOG_STATEMENT="ddl"
    echo "Production mode: Setting log_statement to 'ddl'"
fi

# Update postgresql.conf with appropriate log level
sed -i "s/log_statement = .*/log_statement = '$LOG_STATEMENT'/" /etc/postgresql/custom/postgresql.conf

echo "PostgreSQL log configuration applied: log_statement=$LOG_STATEMENT"
