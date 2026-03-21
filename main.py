"""
DEPRECATED: This Python/FastAPI backend has been fully superseded by the
Node.js/Express + tRPC server in server/_core/index.ts.

All functionality (auth, SMS webhooks, automations, dashboard) is now
handled by the Node.js server. This file is kept only for reference and
will be removed in a future release.

Do NOT run this file in production.
"""

raise SystemExit(
    "main.py is deprecated. Run the Node.js server instead: pnpm dev"
)
