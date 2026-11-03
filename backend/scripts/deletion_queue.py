"""List/read durable requests, or record reviewed operator progress.

No erasure is performed here. Do not run against production without authorization.
Completion evidence is a JSON file of non-PII references: database, providers,
backups, retained_data. The inventory covers direct user foreign keys and legacy
employer links, not indirect rows, object storage, analytics, logs or processors.
"""
import argparse
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.core.database import SessionLocal
from app.models.account_deletion import AccountDeletionRequest
from app.services import deletion_queue


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--request-id')
    action = parser.add_mutually_exclusive_group()
    action.add_argument('--hold', help='Retention basis, scope and review date')
    action.add_argument('--complete', type=Path, help='File containing completion evidence references')
    args = parser.parse_args()
    if (args.hold or args.complete) and not args.request_id:
        parser.error('Mutations require --request-id')
    with SessionLocal() as db:
        query = db.query(AccountDeletionRequest)
        if args.request_id:
            row = query.filter_by(id=args.request_id).one()
            if args.hold:
                deletion_queue.hold(db, row, args.hold)
            elif args.complete:
                deletion_queue.complete(db, row, json.loads(args.complete.read_text()))
            print(json.dumps({'id': row.id, 'status': row.status, 'direct_record_counts': deletion_queue.inventory(db, row)}))
        else:
            print(json.dumps([{'id': row.id, 'status': row.status, 'created_at': row.created_at.isoformat(), 'notification_sent': bool(row.notification_sent_at)} for row in query.filter(AccountDeletionRequest.status != 'completed').order_by(AccountDeletionRequest.created_at).limit(100)]))


if __name__ == '__main__':
    main()
