#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3001}"
USER_EMAIL="${USER_EMAIL:-userA@example.com}"
USER_PASSWORD="${USER_PASSWORD:-Password123!}"

echo "Waiting for API health..."
for i in {1..30}; do
  if curl -fsS "$API_URL/health" >/dev/null; then
    echo "API healthy"
    break
  fi
  sleep 2
  if [ "$i" -eq 30 ]; then
    echo "FAIL: API not healthy"
    exit 1
  fi
done

echo "Logging in..."
TOKEN=$(
  curl -fsS -X POST "$API_URL/auth/login" \
    -H "content-type: application/json" \
    -d "{\"email\":\"$USER_EMAIL\",\"password\":\"$USER_PASSWORD\"}" \
    | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(j.accessToken||'');}catch(e){console.log('');}})"
)

if [ -z "$TOKEN" ]; then
  echo "FAIL: Login did not return access token"
  exit 1
fi

echo "Fetching rooms..."
ROOMS_JSON=$(curl -fsS "$API_URL/rooms" -H "authorization: Bearer $TOKEN")
ROOM_COUNT=$(echo "$ROOMS_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(Array.isArray(j)?j.length:0);}catch(e){console.log(0);}})")

if [ "$ROOM_COUNT" -lt 2 ]; then
  echo "FAIL: Expected at least 2 rooms, got $ROOM_COUNT"
  exit 1
fi

ROOM_ID=$(echo "$ROOMS_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);const dm=j.find(r=>r.type==='direct')||j[0];console.log(dm?dm._id:'');}catch(e){console.log('');}})")
if [ -z "$ROOM_ID" ]; then
  echo "FAIL: Could not find a room id"
  exit 1
fi

echo "Fetching messages..."
MSG_JSON=$(curl -fsS "$API_URL/rooms/$ROOM_ID/messages" -H "authorization: Bearer $TOKEN")
MSG_COUNT=$(echo "$MSG_JSON" | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{const j=JSON.parse(d);console.log(Array.isArray(j.items)?j.items.length:0);}catch(e){console.log(0);}})")

if [ "$MSG_COUNT" -lt 5 ]; then
  echo "FAIL: Expected at least 5 messages, got $MSG_COUNT"
  exit 1
fi

echo "SUCCESS"
