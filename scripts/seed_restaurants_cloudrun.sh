#!/usr/bin/env bash
#
# Seed the production restaurant accounts by running the seeder
# (backend/scripts/seed_restaurants.py) as a one-off Cloud Run Job.
#
# WHY A JOB: production stores its database as a SQLite file on a Cloud Storage
# bucket — DATABASE_URL=sqlite:////data/savorymind.db, mounted from
# gs://<project>-savorymind-db (see cloudbuild.yaml). The only safe way to write
# that file is from inside Cloud Run with the same bucket volume mounted. This
# Job reuses the already-deployed API image and the same volume, but runs the
# seeder instead of uvicorn.
#
# USAGE:
#   PROJECT_ID=my-gcp-project ./scripts/seed_restaurants_cloudrun.sh
#   PROJECT_ID=my-gcp-project REGION=europe-west1 ./scripts/seed_restaurants_cloudrun.sh
#
# PREREQUISITES:
#   - gcloud CLI authenticated (`gcloud auth login`) with Cloud Run admin rights
#   - The API image already built and pushed (gcr.io/$PROJECT_ID/savorymind-api)
#
# SAFE TO RE-RUN: the seeder skips restaurants that already exist.
#
# CAUTION: the live API service and this Job both write the same SQLite file
# over GCSFuse. Seeding is a brief, append-only insert, but run it during low
# traffic to be safe. Once it finishes, this script restarts the API service so
# running instances re-open the updated database file (pass SKIP_RESTART=1 to
# skip that).
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:?set PROJECT_ID to your GCP project id}"
REGION="${REGION:-europe-west1}"
JOB_NAME="${JOB_NAME:-seed-restaurants}"
SERVICE="${SERVICE:-savorymind-api}"
IMAGE="gcr.io/${PROJECT_ID}/savorymind-api"
BUCKET="${PROJECT_ID}-savorymind-db"

echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo "Job     : ${JOB_NAME}"
echo "Image   : ${IMAGE}"
echo "Bucket  : gs://${BUCKET}"
echo

# Create or update the Job definition (idempotent).
gcloud run jobs deploy "${JOB_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --image "${IMAGE}" \
  --command python \
  --args=-m,scripts.seed_restaurants \
  --add-volume "name=db,type=cloud-storage,bucket=${BUCKET}" \
  --add-volume-mount "volume=db,mount-path=/data" \
  --set-env-vars "DATABASE_URL=sqlite:////data/savorymind.db" \
  --max-retries 0 \
  --task-timeout 300

# Run it and wait for completion (exits non-zero if the task fails).
gcloud run jobs execute "${JOB_NAME}" \
  --project "${PROJECT_ID}" \
  --region "${REGION}" \
  --wait

echo
echo "Seed job finished."

if [[ "${SKIP_RESTART:-0}" != "1" ]]; then
  echo "Restarting ${SERVICE} so live instances re-read the database file..."
  gcloud run services update "${SERVICE}" \
    --project "${PROJECT_ID}" \
    --region "${REGION}" \
    --update-labels "seeded-at=$(date +%Y%m%d%H%M%S)"
fi

echo
echo "Done. Verify with:"
echo "  curl \"\$(gcloud run services describe ${SERVICE} --region ${REGION} --format='value(status.url)')/api/discover/restaurants\""
