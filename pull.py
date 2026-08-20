#!/usr/bin/env python3
"""Pull training history from intervals.icu into data.json.

Reads INTERVALS_API_KEY / INTERVALS_ATHLETE_ID from .env in this folder.
Safe to re-run any time to refresh data.json.
"""
import json
import os
from datetime import datetime, timedelta, timezone

import requests

HERE = os.path.dirname(os.path.abspath(__file__))


def load_env():
    env = {}
    path = os.path.join(HERE, ".env")
    with open(path) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip()
    return env


def main():
    env = load_env()
    api_key = env.get("INTERVALS_API_KEY")
    athlete_id = env.get("INTERVALS_ATHLETE_ID", "0")
    if not api_key:
        raise SystemExit("INTERVALS_API_KEY not found in .env")

    session = requests.Session()
    session.auth = ("API_KEY", api_key)
    session.headers["User-Agent"] = "AthleteOS/1.0"

    base = "https://intervals.icu/api/v1"

    oldest = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")
    newest = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    activities_url = f"{base}/athlete/{athlete_id}/activities"
    resp = session.get(activities_url, params={"oldest": oldest, "newest": newest})
    if resp.status_code == 401:
        raise SystemExit("401 Unauthorized: bad or regenerated API key.")
    if resp.status_code == 403:
        raise SystemExit("403 Forbidden: almost always the User-Agent header is missing/blocked.")
    resp.raise_for_status()
    activities = resp.json()

    wellness_url = f"{base}/athlete/{athlete_id}/wellness"
    wresp = session.get(wellness_url, params={"oldest": oldest, "newest": newest})
    wellness = wresp.json() if wresp.status_code == 200 else []

    profile_url = f"{base}/athlete/{athlete_id}/profile"
    presp = session.get(profile_url)
    profile = presp.json() if presp.status_code == 200 else {}

    out = {
        "pulled_at": datetime.now(timezone.utc).isoformat(),
        "oldest": oldest,
        "newest": newest,
        "athlete_id": athlete_id,
        "profile": profile,
        "activities": activities,
        "wellness": wellness,
    }

    out_path = os.path.join(HERE, "data.json")
    with open(out_path, "w") as f:
        json.dump(out, f, indent=2, default=str)

    runs = [a for a in activities if a.get("type") == "Run"]
    print(f"Pulled {len(activities)} total activities ({len(runs)} runs)")
    if runs:
        dates = sorted(a.get("start_date_local", "") for a in runs)
        print(f"Run date range: {dates[0]} to {dates[-1]}")
        has_hr = sum(1 for r in runs if r.get("average_heartrate") or r.get("icu_average_hr"))
        has_pace = sum(1 for r in runs if r.get("average_speed") or r.get("distance"))
        has_power = sum(1 for r in runs if r.get("icu_average_watts") or r.get("average_watts"))
        print(f"Runs with HR: {has_hr}, with pace/distance: {has_pace}, with power: {has_power}")
    print(f"Wellness records: {len(wellness)}")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
