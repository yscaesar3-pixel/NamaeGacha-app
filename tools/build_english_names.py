"""Build compact English-name data from the Census and SSA national ZIPs."""
import csv
import io
import json
import re
import sys
from collections import Counter
from pathlib import Path
from zipfile import ZipFile


def surname_rows(path):
    with ZipFile(path) as archive:
        reader = csv.DictReader(io.StringIO(archive.read("Names_2010Census.csv").decode("utf-8-sig")))
        names = sorted((int(r["rank"]), r["name"].title()) for r in reader
                       if re.fullmatch(r"[A-Z]+", r["name"]))
    return [name for _, name in names[:10000]]


def given_rows(path):
    counts = {"M": Counter(), "F": Counter()}
    with ZipFile(path) as archive:
        for year in range(2000, 2026):
            for name, sex, count in csv.reader(io.StringIO(archive.read(f"yob{year}.txt").decode("ascii"))):
                if re.fullmatch(r"[A-Za-z]+", name):
                    counts[sex][name] += int(count)
    males, females = counts["M"], counts["F"]
    order = lambda counts: sorted(counts, key=lambda n: (-counts[n], n))
    ranked = order(males + females)
    selected = set(order(males)[:5000]) | set(order(females)[:5000])
    for name in ranked:
        if len(selected) >= 10000:
            break
        selected.add(name)
    rows = []
    for name in ranked:
        if name not in selected:
            continue
        m, f = males[name], females[name]
        neutral = min(m, f) >= 25 and min(m, f) * 5 >= m + f
        rows.append([name, 7 if neutral else (1 if m >= f else 2)])
    return rows


if __name__ == "__main__":
    surnames, given = surname_rows(sys.argv[1]), given_rows(sys.argv[2])
    assert len(surnames) == len(set(surnames)) == len(given) == 10000
    assert len({name for name, _ in given}) == 10000
    output = Path(sys.argv[3])
    output.write_text(json.dumps({"surnames": surnames, "given": given}, separators=(",", ":")) + "\n", encoding="utf-8")
