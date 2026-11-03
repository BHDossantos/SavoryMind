"""Reviewed private-account erasure. Default: dry-run plan, no writes/provider calls.

Do not execute against production without an approved retention/erasure plan.
Evidence files contain non-PII references, never tokens, emails or provider payloads.
"""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import SessionLocal
from app.models.account_deletion import AccountDeletionRequest
from app.services import account_erasure


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--request-id', required=True)
    parser.add_argument('--prepare', action='store_true')
    parser.add_argument('--reprepare', action='store_true')
    parser.add_argument('--previous-plan-sha')
    parser.add_argument('--review-ref')
    parser.add_argument('--erase-private-database', action='store_true')
    parser.add_argument('--plan-sha')
    parser.add_argument('--policy-ref')
    parser.add_argument('--evidence', type=Path)
    args = parser.parse_args()
    if sum((args.prepare, args.reprepare, args.erase_private_database)) > 1:
        parser.error('Prepare and erase are separate review steps')
    if (args.prepare or args.reprepare or args.erase_private_database) and not args.plan_sha:
        parser.error('Mutation requires the reviewed --plan-sha')
    if args.reprepare and (not args.previous_plan_sha or not args.review_ref):
        parser.error('Re-review requires --previous-plan-sha and --review-ref')
    if args.erase_private_database and not args.evidence:
        parser.error('Erasure requires --evidence')
    with SessionLocal() as db:
        request = db.get(AccountDeletionRequest, args.request_id)
        if request is None:
            parser.error('Unknown request')
        if args.prepare:
            run = account_erasure.prepare(db, request, expected_sha=args.plan_sha, policy_ref=args.policy_ref)
            result = {'state': run.state}
            db.commit()
        elif args.reprepare:
            run = account_erasure.reprepare(db, request.id, previous_sha=args.previous_plan_sha, expected_sha=args.plan_sha, policy_ref=args.policy_ref, review_ref=args.review_ref)
            result = {'state': run.state, 'plan_sha': run.plan_sha}
            db.commit()
        elif args.erase_private_database:
            result = account_erasure.erase_private_database(db, request.id, expected_sha=args.plan_sha, evidence=json.loads(args.evidence.read_text()))
            db.commit()
        else:
            result = account_erasure.plan(db, request)
            from app.models.account_erasure import AccountErasureRun
            run = db.get(AccountErasureRun, request.id)
            if run:
                result['prepared_plan_sha'] = run.plan_sha
                result['prepared_state'] = run.state
            db.rollback()
        print(json.dumps(result))

if __name__ == '__main__':
    main()
