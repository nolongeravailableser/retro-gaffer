#!/usr/bin/env python3
"""
generate_players.py — build & validate the Retro Auto-Gaffer player database.

WHY THIS EXISTS
---------------
The game ships a single static `src/data/players.json` (no backend). To scale
that file to 300+ historically accurate players WITHOUT hand-editing one giant
JSON (and without truncation/format drift), we keep small, human-curated CSV
"shards" — one per league — and compile them here with strict validation.

The output schema must match the TypeScript `RawPlayer` interface exactly
(see src/lib/types.ts). The TS loader (src/data/pool.ts) then derives the pitch
role, card rarity, and chemistry keys at runtime — so keep those rules in sync
with ROLE_TO_BUCKET / rarity_from_cost below if you ever change them.

USAGE
-----
    # Validate the existing JSON (CI-friendly; exits non-zero on any error):
    python scripts/generate_players.py --check src/data/players.json

    # Compile league CSV shards -> players.json:
    python scripts/generate_players.py \
        --from data_src/epl.csv data_src/laliga.csv data_src/seriea.csv \
        --out src/data/players.json

THE "PEAK SNAPSHOT" RULE
------------------------
Each real player appears EXACTLY ONCE, captured at their lifetime peak season
within 1992/93–present (e.g. Henry -> 2003/04 Arsenal). The compiler enforces
this by de-duplicating on a normalized player name; if two shards list the same
player, the one with the higher `cost` (peak impact) wins and a warning is
printed so you can resolve it deliberately.

BLUEPRINT: SCALING TO 300+
--------------------------
1. One CSV per league under data_src/: epl.csv, laliga.csv, seriea.csv.
   Columns: name,peak_season,club,league,nationality,cost,attack,defense,role,tags
   (`tags` is pipe-separated, e.g. "invincibles|the_gunners").
2. Curate ~100 per league across eras: 90s / 00s / 10s / 20s. For each era aim
   for a spread of: global superstars (cost 5), elite starters (4), solid
   regulars (3), and cult heroes / one-season wonders (1-2). That cost spread is
   what makes drafting varied — see RARITY tiers below.
3. Cover every role bucket so all formations stay fillable: per league keep at
   least ~3 Goalkeepers, ~8 defenders (CenterBack/Fullback), ~12 midfielders
   (Anchor/BoxToBox/Playmaker), and ~10 attackers (Winger/Striker).
4. `id` is auto-generated as p_<surname-slug>_<yy> and guaranteed unique here, so
   shards don't need to track ids.
5. Run with --from to compile, then --check in CI to guarantee the committed
   JSON always validates.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from dataclasses import dataclass, asdict
from typing import Iterable

LEAGUES = {"EPL", "LaLiga", "SerieA"}

# Granular position -> pitch bucket (mirror of POSITION_TO_ROLE in pool.ts).
ROLE_TO_BUCKET = {
    "Goalkeeper": "GK",
    "CenterBack": "DEF",
    "Fullback": "DEF",
    "Anchor": "MID",
    "BoxToBox": "MID",
    "Playmaker": "MID",
    "Winger": "FWD",
    "Striker": "FWD",
}
ROLES = set(ROLE_TO_BUCKET)

SEASON_RE = re.compile(r"^\d{4}/\d{2}$")


def rarity_from_cost(cost: int) -> str:
    """Mirror of rarity_from_cost in pool.ts (for documentation/validation)."""
    if cost >= 5:
        return "icon"
    if cost == 4:
        return "gold"
    if cost == 3:
        return "silver"
    return "bronze"


def slugify(name: str) -> str:
    ascii_name = (
        unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    )
    surname = ascii_name.strip().split()[-1].lower()
    return re.sub(r"[^a-z0-9]", "", surname)


def make_id(name: str, peak_season: str) -> str:
    yy = peak_season.split("/")[-1]
    return f"p_{slugify(name)}_{yy}"


def player_key(name: str, nationality: str) -> str:
    """Identity for the peak-snapshot rule: FULL normalized name + nationality.
    (Surname alone is too coarse — distinct players share surnames.)"""
    n = (
        unicodedata.normalize("NFKD", name)
        .encode("ascii", "ignore")
        .decode("ascii")
        .lower()
    )
    n = re.sub(r"[^a-z0-9]+", " ", n).strip()
    return f"{n}|{nationality}"


@dataclass
class Player:
    id: str
    name: str
    peak_season: str
    club: str
    league: str
    nationality: str
    cost: int
    stats: dict
    role: str
    tags: list

    def to_json(self) -> dict:
        # Preserve the exact RawPlayer field order used in players.json.
        return {
            "id": self.id,
            "name": self.name,
            "peak_season": self.peak_season,
            "club": self.club,
            "league": self.league,
            "nationality": self.nationality,
            "cost": self.cost,
            "stats": self.stats,
            "role": self.role,
            "tags": self.tags,
        }


def validate(players: list[dict]) -> list[str]:
    """Return a list of human-readable errors ([] == valid)."""
    errors: list[str] = []
    seen_ids: set[str] = set()
    seen_names: set[str] = set()

    for i, p in enumerate(players):
        where = f"[{i}] {p.get('name', '?')}"

        for field in (
            "id", "name", "peak_season", "club", "league",
            "nationality", "cost", "stats", "role", "tags",
        ):
            if field not in p:
                errors.append(f"{where}: missing '{field}'")

        if p.get("id") in seen_ids:
            errors.append(f"{where}: duplicate id '{p.get('id')}'")
        seen_ids.add(p.get("id"))

        key = player_key(p.get("name", ""), p.get("nationality", ""))
        if key in seen_names:
            errors.append(f"{where}: duplicate player (peak-snapshot rule)")
        seen_names.add(key)

        if p.get("league") not in LEAGUES:
            errors.append(f"{where}: bad league '{p.get('league')}'")
        if p.get("role") not in ROLES:
            errors.append(f"{where}: bad role '{p.get('role')}'")
        if not SEASON_RE.match(str(p.get("peak_season", ""))):
            errors.append(f"{where}: peak_season must be YYYY/YY")

        cost = p.get("cost")
        if not isinstance(cost, int) or not (1 <= cost <= 5):
            errors.append(f"{where}: cost must be an int 1–5")

        stats = p.get("stats", {})
        for k in ("attack", "defense"):
            v = stats.get(k)
            if not isinstance(v, int) or not (1 <= v <= 99):
                errors.append(f"{where}: stats.{k} must be an int 1–99")

        if not isinstance(p.get("tags"), list) or not p["tags"]:
            errors.append(f"{where}: tags must be a non-empty array")

    return errors


def read_csv_shard(path: str) -> Iterable[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            yield {
                "id": make_id(row["name"], row["peak_season"]),
                "name": row["name"].strip(),
                "peak_season": row["peak_season"].strip(),
                "club": row["club"].strip(),
                "league": row["league"].strip(),
                "nationality": row["nationality"].strip(),
                "cost": int(row["cost"]),
                "stats": {"attack": int(row["attack"]), "defense": int(row["defense"])},
                "role": row["role"].strip(),
                "tags": [t for t in row["tags"].split("|") if t],
            }


def compile_shards(paths: list[str]) -> list[dict]:
    """Merge shards, applying the peak-snapshot dedup (higher cost wins)."""
    best: dict[str, dict] = {}
    for path in paths:
        for p in read_csv_shard(path):
            key = player_key(p["name"], p["nationality"])
            if key in best and best[key]["cost"] >= p["cost"]:
                print(f"  · dedup: keeping {best[key]['name']} "
                      f"({best[key]['peak_season']}) over {p['peak_season']}",
                      file=sys.stderr)
                continue
            best[key] = p
    return sorted(best.values(), key=lambda p: (p["league"], p["role"], p["name"]))


def main() -> int:
    ap = argparse.ArgumentParser(description="Build/validate players.json")
    ap.add_argument("--check", metavar="JSON", help="validate an existing players.json")
    ap.add_argument("--from", dest="shards", nargs="+", help="CSV shards to compile")
    ap.add_argument("--out", help="output players.json path")
    args = ap.parse_args()

    if args.check:
        with open(args.check, encoding="utf-8") as f:
            players = json.load(f)
        errors = validate(players)
        if errors:
            print(f"✗ {len(errors)} error(s):", file=sys.stderr)
            print("\n".join(f"  - {e}" for e in errors), file=sys.stderr)
            return 1
        print(f"✓ {len(players)} players valid.")
        return 0

    if args.shards:
        players = compile_shards(args.shards)
        errors = validate(players)
        if errors:
            print(f"✗ refusing to write — {len(errors)} error(s):", file=sys.stderr)
            print("\n".join(f"  - {e}" for e in errors), file=sys.stderr)
            return 1
        out = args.out or "src/data/players.json"
        with open(out, "w", encoding="utf-8") as f:
            f.write("[\n")
            f.write(",\n".join("  " + json.dumps(p, ensure_ascii=False) for p in players))
            f.write("\n]\n")
        print(f"✓ wrote {len(players)} players → {out}")
        return 0

    ap.print_help()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
