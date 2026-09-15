#!/usr/bin/env bash
# Reset geocode / leave-by caches and ride-related rows for local debugging.
#
# Keeps: adults, sessions, family circles, memberships, kids, feeds, calendar
#        items, carpool spaces/memberships, and family_places that already have
#        latitude + longitude.
# Deletes: carpool ride requests (+ kids/legs/passes), coverage assignments,
#          geocode_cache, leaveby_route_cache, leaveby_itineraries, one-time
#          leave-from overrides, and family_places missing coordinates.
#
# Usage:
#   ./scripts/reset-geocode-and-rides.sh           # prompts for confirmation
#   ./scripts/reset-geocode-and-rides.sh --yes     # no prompt
#
# Connection (defaults match backend application.yml):
#   PGHOST / PGPORT / PGDATABASE / PGUSER / PGPASSWORD
#   or DATABASE_URL=jdbc:postgresql://host:port/db

set -euo pipefail

YES=0
for arg in "$@"; do
  case "$arg" in
    -y|--yes) YES=1 ;;
    -h|--help)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

if [[ -n "${DATABASE_URL:-}" ]]; then
  url="${DATABASE_URL#jdbc:}"
  if [[ "$url" =~ ^postgresql://([^:/]+):([0-9]+)/([^?]+) ]]; then
    export PGHOST="${PGHOST:-${BASH_REMATCH[1]}}"
    export PGPORT="${PGPORT:-${BASH_REMATCH[2]}}"
    export PGDATABASE="${PGDATABASE:-${BASH_REMATCH[3]}}"
  fi
fi

export PGHOST="${PGHOST:-localhost}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-family_carpool}"
export PGUSER="${PGUSER:-${DATABASE_USERNAME:-family_carpool}}"
export PGPASSWORD="${PGPASSWORD:-${DATABASE_PASSWORD:-family_carpool}}"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql not found; install PostgreSQL client tools." >&2
  exit 1
fi

echo "Target: ${PGUSER}@${PGHOST}:${PGPORT}/${PGDATABASE}"

if [[ "$YES" -ne 1 ]]; then
  read -r -p "Reset geocode caches, rides, coverage, and unresolved places? [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

psql -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;

SELECT 'before' AS phase,
       (SELECT count(*) FROM geocode_cache) AS geocode_cache,
       (SELECT count(*) FROM leaveby_route_cache) AS route_cache,
       (SELECT count(*) FROM leaveby_itineraries) AS itineraries,
       (SELECT count(*) FROM carpool_ride_requests) AS ride_requests,
       (SELECT count(*) FROM coverage_assignments) AS coverage,
       (SELECT count(*) FROM family_places) AS places,
       (SELECT count(*) FROM family_places
         WHERE latitude IS NULL OR longitude IS NULL) AS unresolved_places,
       (SELECT count(*) FROM calendar_leave_from
         WHERE leave_from_address IS NOT NULL) AS one_time_leave_from;

-- Team rides (cascades kids, legs, passes).
DELETE FROM carpool_ride_requests;

-- Household driver / coverage assignments (cascades coverage_assignment_kids).
DELETE FROM coverage_assignments;

-- Leave-by caches (sticky UNAVAILABLE lived here + geocode_cache misses).
DELETE FROM leaveby_itineraries;
DELETE FROM leaveby_route_cache;
DELETE FROM geocode_cache;

-- One-time leave-from addresses (not resolvable places).
DELETE FROM calendar_leave_from WHERE leave_from_address IS NOT NULL;

-- Places that never got coordinates (FK refs SET NULL / CASCADE as defined).
DELETE FROM family_places WHERE latitude IS NULL OR longitude IS NULL;

SELECT 'after' AS phase,
       (SELECT count(*) FROM geocode_cache) AS geocode_cache,
       (SELECT count(*) FROM leaveby_route_cache) AS route_cache,
       (SELECT count(*) FROM leaveby_itineraries) AS itineraries,
       (SELECT count(*) FROM carpool_ride_requests) AS ride_requests,
       (SELECT count(*) FROM coverage_assignments) AS coverage,
       (SELECT count(*) FROM family_places) AS places,
       (SELECT count(*) FROM family_places
         WHERE latitude IS NULL OR longitude IS NULL) AS unresolved_places,
       (SELECT count(*) FROM calendar_leave_from
         WHERE leave_from_address IS NOT NULL) AS one_time_leave_from;

COMMIT;
SQL

echo "Done. Restart or refresh the app so leave-by re-geocodes and rebuilds routes."
