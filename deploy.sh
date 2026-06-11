#!/bin/bash
# Deploy script with all env vars explicitly set

# Read from .env.local
source .env.local

# Deploy with force
vercel --prod --yes --force \
  -e NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY" \
  -e SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  -e NEXT_PUBLIC_APP_URL="https://don-carlos-rewards.vercel.app"
