#!/usr/bin/env bash
# Phase 6 — drive the subscription lifecycle + edge cases through the signed
# webhook against the LOCAL Worker, asserting DB state at each step. Uses a
# scratch subscription (sub_E2E_P6); temporarily parks any real live one and
# restores it at the end.
#
# Requires: local API running on :8787, RAZORPAY_WEBHOOK_SECRET in root .env.
set -uo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env 2>/dev/null; set +a

SUB="sub_E2E_P6"
FW=(node scripts/razorpay-fake-webhook.mjs)
Q(){ psql "$DATABASE_URL" -tAc "$1"; }
FAILED=0
ok(){ echo "  PASS  $1"; }
no(){ echo "  FAIL  $1"; FAILED=1; }
# assert a boolean expression evaluated against the scratch subscription row
chk(){ local expr="$1" msg="$2"; [ "$(Q "select ($expr) from subscriptions where razorpay_subscription_id='$SUB'")" = "t" ] && ok "$msg" || no "$msg"; }
# assert a standalone boolean expression (e.g. an event-count subquery)
chkq(){ local expr="$1" msg="$2"; [ "$(Q "select ($expr)")" = "t" ] && ok "$msg" || no "$msg"; }

echo "== setup: park real live subscription, seed scratch =="
REAL=$(Q "select razorpay_subscription_id from subscriptions where status in ('active','authenticated','pending','halted','created') and razorpay_subscription_id<>'$SUB' order by updated_at desc limit 1")
REAL_END=$(Q "select coalesce(extract(epoch from current_end)::bigint,0) from subscriptions where razorpay_subscription_id='$REAL'")
if [ -n "$REAL" ]; then Q "update subscriptions set status='completed', updated_at=now() where razorpay_subscription_id='$REAL'" >/dev/null; echo "  parked $REAL (end=$REAL_END)"; fi

restore(){
  Q "delete from subscription_events where razorpay_subscription_id='$SUB'; delete from subscriptions where razorpay_subscription_id='$SUB'" >/dev/null
  if [ -n "$REAL" ]; then Q "update subscriptions set status='active', current_end=to_timestamp($REAL_END), grace_until=null, updated_at=now() where razorpay_subscription_id='$REAL'" >/dev/null; echo "== restored $REAL to active =="; fi
}
trap restore EXIT

Q "delete from subscription_events where razorpay_subscription_id='$SUB'; delete from subscriptions where razorpay_subscription_id='$SUB'" >/dev/null
Q "insert into subscriptions (razorpay_subscription_id,razorpay_plan_id,status,quantity,unit_amount_paisa) values ('$SUB','plan_test','created',8,70800)" >/dev/null

echo "== EC19/1: first activation =="
"${FW[@]}" subscription.activated --sub=$SUB --qty=8 --end=+30d --event-id=p6_act >/dev/null 2>&1
chk "status='active'" "activation → active"
chk "current_end > now() + interval '25 days'" "current_end ~+30d set"

echo "== EC3: duplicate delivery ignored =="
"${FW[@]}" subscription.activated --sub=$SUB --qty=8 --end=+30d --event-id=p6_act >/dev/null 2>&1
chkq "(select count(*) from subscription_events where razorpay_event_id='p6_act')=1" "duplicate event recorded once"

echo "== EC4: out-of-order stale (older end) does not move current_end back =="
"${FW[@]}" subscription.charged --sub=$SUB --qty=8 --end=+10d --event-id=p6_stale >/dev/null 2>&1
chk "current_end > now() + interval '25 days'" "stale charged ignored (end still ~+30d)"

echo "== EC5: invalid signature → 400, nothing written =="
RAZORPAY_WEBHOOK_SECRET="wrong_secret" "${FW[@]}" subscription.cancelled --sub=$SUB --event-id=p6_badsig >/dev/null 2>&1
chkq "(select count(*) from subscription_events where razorpay_event_id='p6_badsig')=0" "bad-signature event not recorded"
chk "status='active'" "bad-signature did not change status"

echo "== EC6: failed renewal (pending) sets grace, then day-3 charge clears it =="
"${FW[@]}" subscription.pending --sub=$SUB --qty=8 --end=+30d --event-id=p6_pending >/dev/null 2>&1
chk "status='pending'" "pending → status pending"
chk "grace_until > now() + interval '6 days'" "grace ~now+7d set"
"${FW[@]}" subscription.charged --sub=$SUB --qty=8 --end=+60d --event-id=p6_recover >/dev/null 2>&1
chk "status='active'" "recovery charge → active"
chk "grace_until is null" "grace cleared on recovery"

echo "== EC8: halted keeps grace (access honoured until grace) =="
"${FW[@]}" subscription.pending --sub=$SUB --qty=8 --end=+60d --event-id=p6_pending2 >/dev/null 2>&1
"${FW[@]}" subscription.halted --sub=$SUB --qty=8 --end=+60d --event-id=p6_halt >/dev/null 2>&1
chk "status='halted'" "halted → status halted"
chk "grace_until is not null" "halted retains grace_until"

echo "== EC12/16: cancellation (also UPI mandate revoke) =="
"${FW[@]}" subscription.cancelled --sub=$SUB --qty=8 --end=+60d --event-id=p6_cancel >/dev/null 2>&1
chk "status='cancelled'" "cancelled → status cancelled"

echo
if [ "$FAILED" = "0" ]; then echo "ALL PHASE-6 WEBHOOK ASSERTIONS PASSED"; else echo "SOME ASSERTIONS FAILED"; fi
exit $FAILED
