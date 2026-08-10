# REFERRAL COMMISSION PLAN ERRATA

This addendum is part of `REFERRAL-COMMISSION-DEV-PLAN.md`. It incorporates the production audit findings and overrides any conflicting earlier wording.

## P0 Before Enablement

1. Audit and clean duplicate `users.inviteCode` values, repair affected `referral_claims`, then create the CloudBase unique index on `users.inviteCode`. The existing `scripts/manage-referral-indexes.cjs` does not create this index. Do not enable commission before this step.
2. Deploy and verify a real `processReferralJobs` trigger. `cloudbaserc.json` declares the function but not its trigger. Use `scripts/manage-referral-trigger.cjs`, or document the external scheduler, frequency, alerting, and compensation procedure.
3. Add `referral_commission_jobs` to the primary data-model section, not only the later implementation sections.

## Refund Scope

The current system has different refund capabilities:

- `recharge_orders`: no WeChat `REFUND.SUCCESS` callback; `adminManage` has a manual refund path.
- `archetype_report_orders`: xpay refund notification already calls `applyRefundNotification()`.

Both existing refund paths must call `reverseCommissionForRefund()` during commission development. Automatic WeChat refund callback support for recharge/subscription is a separate P1 and must not be assumed to exist.

Reversal policy:

```text
pending commission -> reversed, no available balance change
available commission -> subtract availableFen and create a negative ledger entry
insufficient pending + available -> set commission blocked, preserve recoveryFen, create an admin review task
```

Never make `commission_accounts` negative and never edit balances without a ledger entry.

## Canonical Payment Hooks

- The canonical prop/report file is `cloudfunctions/_shared/archetype-report-access.js`; update it first, then run the repository's shared-file sync to update function copies.
- User payment confirmation, active order reconciliation, and admin reconciliation must all continue through `fulfillPayment()` or `fulfillReportOrder()`. Enqueue the commission job only after the shared fulfillment succeeds.
- Admin reconciliation of an archetype order already calls `fulfillReportOrder()`; this is a coverage requirement, not a separate inline fulfillment implementation.

## Amount Snapshot

`enqueueCommissionJob()` must receive and persist the verified server-side snapshot immediately:

```js
{
  paidAmountFen,
  paidAt,
  transactionId
}
```

For normal flow, use `recharge_orders.amountFen` or `archetype_report_orders.actualPriceFen` at fulfillment time. Recovery scans may read those fields only to rebuild a missing job. The worker settles from the job snapshot and never from current product pricing.

## API Naming Override

Use these exact user API names everywhere, including the implementation checklist and `src/utils/api.ts`:

```text
getMyReferralCommissionSummary()
listMyReferralCommissionLedger(params)
listMyReferralInvitees(params)
```

Remove/replace the earlier ambiguous names `getMyReferralCommission` and `listMyReferralCommission`.

## Acceptance Additions

- Manual recharge/subscription refund reverses its commission or creates a review task when funds are insufficient.
- Automatic refund callback is not part of the MVP acceptance unless the callback is implemented and deployed.
- Trigger existence is checked after deployment with `fn detail processReferralJobs`.
- Duplicate invite-code cleanup and unique-index creation are recorded as deployment evidence.
