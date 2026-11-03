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
    parser.add_argument('--erase-private-database', action='store_true')
    parser.add_argument('--plan-sha')
    parser.add_argument('--policy-ref')
    parser.add_argument('--evidence', type=Path)
    args = parser.parse_args()
    if args.prepare and args.erase_private_database:
        parser.error('Prepare and erase are separate review steps')
    if (args.prepare or args.erase_private_database) and not args.plan_sha:
        parser.error('Mutation requires the reviewed --plan-sha')
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
        elif args.erase_private_database:
            result = account_erasure.erase_private_database(db, request.id, expected_sha=args.plan_sha, evidence=json.loads(args.evidence.read_text()))
            db.commit()
        else:
            result = account_erasure.plan(db, request)
            db.rollback()
        print(json.dumps(result))

if __name__ == '__main__':
    main()
