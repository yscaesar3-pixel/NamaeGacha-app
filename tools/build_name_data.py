#!/usr/bin/env python3
"""Build deterministic NamaeGacha JSON files from jmdict-simplified JMnedict JSON."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

SURNAME_COUNT = 10_000
PRIMARY_COUNTS = {"male": 5_000, "female": 5_000, "unspecified": 2_000}
RARITY_SPLIT = (0.20, 0.30)  # common 20%, uncommon 30%, rare 50%

# Conservative, spelling-specific neutral set. A reading alone is insufficient:
# e.g. many unusual kanji combinations can share the reading「あきら」.
NEUTRAL_PAIRS = {
    ("葵", "あおい"), ("碧", "あおい"), ("蒼", "あおい"),
    ("明", "あきら"), ("亮", "あきら"), ("晶", "あきら"), ("晃", "あきら"),
    ("朝日", "あさひ"), ("旭", "あさひ"), ("歩", "あゆむ"),
    ("伊織", "いおり"), ("泉", "いずみ"), ("樹", "いつき"), ("伊吹", "いぶき"),
    ("薫", "かおる"), ("香", "かおる"), ("奏", "かなで"),
    ("和美", "かずみ"), ("和実", "かずみ"), ("一美", "かずみ"),
    ("圭", "けい"), ("慧", "けい"), ("桂", "けい"), ("啓", "けい"),
    ("忍", "しのぶ"), ("純", "じゅん"), ("淳", "じゅん"), ("潤", "じゅん"),
    ("空", "そら"), ("匠", "たくみ"), ("巧", "たくみ"),
    ("千秋", "ちあき"), ("千尋", "ちひろ"), ("司", "つかさ"), ("翼", "つばさ"),
    ("友美", "ともみ"), ("智美", "ともみ"), ("尚", "なお"), ("直", "なお"),
    ("凪", "なぎ"), ("夏希", "なつき"), ("夏樹", "なつき"), ("夏紀", "なつき"),
    ("望", "のぞみ"), ("希", "のぞみ"), ("春", "はる"), ("晴", "はる"),
    ("遥", "はるか"), ("悠", "はるか"), ("光", "ひかる"), ("輝", "ひかる"),
    ("日向", "ひなた"), ("陽向", "ひなた"), ("響", "ひびき"),
    ("博美", "ひろみ"), ("宏美", "ひろみ"), ("誠", "まこと"), ("真", "まこと"),
    ("雅美", "まさみ"), ("正美", "まさみ"), ("真尋", "まひろ"), ("真宏", "まひろ"),
    ("瑞希", "みずき"), ("瑞樹", "みずき"), ("美月", "みづき"), ("光希", "みつき"),
    ("優", "ゆう"), ("悠", "ゆう"), ("佑", "ゆう"),
    ("優希", "ゆうき"), ("悠希", "ゆうき"), ("優樹", "ゆうき"), ("勇気", "ゆうき"),
    ("柚希", "ゆずき"), ("柚季", "ゆずき"), ("怜", "れい"), ("玲", "れい"),
    ("礼", "れい"), ("蓮", "れん"), ("恋", "れん"), ("莉央", "りお"),
    ("理央", "りお"), ("律", "りつ"), ("凛", "りん"), ("鈴", "りん"),
    ("類", "るい"), ("瑠衣", "るい"),
}

DISALLOWED_GIVEN_CHARACTERS = set("裸糞屍死姦淫呪癌痔尻屁")

RENDAKU = {
    "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
    "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
    "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
    "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
}


def is_basic_kanji(ch: str) -> bool:
    cp = ord(ch)
    return 0x4E00 <= cp <= 0x9FFF


def valid_written(text: str, max_len: int) -> bool:
    return (
        1 <= len(text) <= max_len
        and any(is_basic_kanji(ch) for ch in text)
        and all(is_basic_kanji(ch) or ch == "々" for ch in text)
    )


def valid_reading(text: str, max_len: int) -> bool:
    return 1 <= len(text) <= max_len and all("ぁ" <= ch <= "ゖ" for ch in text)


def stable_numeric_id(prefix: str, written: str, reading: str) -> str:
    digest = hashlib.sha256(f"{written}\0{reading}".encode("utf-8")).digest()
    number = int.from_bytes(digest[:8], "big")
    return f"{prefix}_{number:020d}"


def word_types(word: dict) -> set[str]:
    return {
        item
        for translation in word.get("translation", [])
        for item in translation.get("type", [])
    }


def iter_pairs(word: dict):
    for kanji in word.get("kanji", []):
        written = unicodedata.normalize("NFC", kanji.get("text", "")).strip()
        for kana in word.get("kana", []):
            reading = unicodedata.normalize("NFC", kana.get("text", "")).strip()
            applies = kana.get("appliesToKanji", [])
            if applies and "*" not in applies and written not in applies:
                continue
            yield written, reading


def katakana_to_hiragana(text: str) -> str:
    return "".join(
        chr(ord(ch) - 0x60) if 0x30A1 <= ord(ch) <= 0x30F6 else ch
        for ch in text
    )


def reading_variants(value: str) -> set[str]:
    value = katakana_to_hiragana(value).replace("-", "")
    values = {value.replace(".", "")}
    if "." in value:
        values.add(value.split(".", 1)[0])
    result = set()
    for item in values:
        if not item or not all("ぁ" <= ch <= "ゖ" for ch in item):
            continue
        result.add(item)
        if item[0] in RENDAKU:
            result.add(RENDAKU[item[0]] + item[1:])
        if item.endswith(("く", "ち", "つ")):
            result.add(item[:-1] + "っ")
    return result


def load_kanjidic(path: Path):
    with path.open(encoding="utf-8") as handle:
        root = json.load(handle)
    readings = {}
    allowed = set()
    for character in root["characters"]:
        literal = character["literal"]
        grade = character.get("misc", {}).get("grade")
        if grade in range(1, 11):
            allowed.add(literal)
        values = set()
        reading_meaning = character.get("readingMeaning") or {}
        for group in reading_meaning.get("groups", []):
            for reading in group.get("readings", []):
                if reading.get("type") in {"ja_on", "ja_kun"}:
                    values.update(reading_variants(reading.get("value", "")))
        for nanori in reading_meaning.get("nanori", []):
            values.update(reading_variants(nanori))
        readings[literal] = values
    metadata = {
        "kanjidicDate": root.get("dictDate"),
        "kanjidicDatabaseVersion": root.get("databaseVersion"),
        "kanjidicCharacterCount": len(root["characters"]),
    }
    return readings, allowed, metadata


def reading_matches(written: str, reading: str, kanji_readings: dict[str, set[str]]) -> bool:
    memo = {}

    def visit(index: int, offset: int, previous: str | None) -> bool:
        state = (index, offset, previous)
        if state in memo:
            return memo[state]
        if index == len(written):
            return offset == len(reading)
        char = written[index]
        source_char = previous if char == "々" else char
        if not source_char:
            return False
        for candidate in kanji_readings.get(source_char, set()):
            if reading.startswith(candidate, offset) and visit(
                index + 1, offset + len(candidate), source_char
            ):
                memo[state] = True
                return True
        memo[state] = False
        return False

    return visit(0, 0, None)


def load_candidates(source: Path, kanjidic: Path):
    kanji_readings, allowed_kanji, kanjidic_metadata = load_kanjidic(kanjidic)
    with source.open(encoding="utf-8") as handle:
        root = json.load(handle)

    surnames: dict[tuple[str, str], set[str]] = defaultdict(set)
    given: dict[tuple[str, str], set[str]] = defaultdict(set)

    for word in root["words"]:
        types = word_types(word)
        if not types.intersection({"surname", "masc", "fem", "given"}):
            continue
        for written, reading in iter_pairs(word):
            key = (written, reading)
            written_allowed = all(ch == "々" or ch in allowed_kanji for ch in written)
            matched = reading_matches(written, reading, kanji_readings)
            if "surname" in types and valid_written(written, 4) and valid_reading(reading, 8) and written_allowed and matched:
                surnames[key].add("surname")
                if "place" in types:
                    surnames[key].add("place")
            if (valid_written(written, 3) and valid_reading(reading, 6)
                    and written_allowed and matched
                    and not set(written).intersection(DISALLOWED_GIVEN_CHARACTERS)):
                if "masc" in types:
                    given[key].add("male")
                if "fem" in types:
                    given[key].add("female")
                if "given" in types:
                    given[key].add("unspecified")

    metadata = {
        "converterVersion": root.get("version"),
        "dictDate": root.get("dictDate"),
        "dictRevisions": root.get("dictRevisions", []),
        "sourceWordCount": len(root["words"]),
        **kanjidic_metadata,
    }
    return surnames, given, metadata


def char_frequencies(keys) -> Counter:
    result = Counter()
    for written, _ in keys:
        result.update(ch for ch in written if ch != "々")
    return result


def quality_score(key: tuple[str, str], frequencies: Counter, reading_frequencies: Counter, kind: str) -> float:
    written, reading = key
    char_scores = [math.log1p(frequencies[ch]) for ch in written if ch != "々"]
    score = sum(char_scores) / len(char_scores)
    score += math.log1p(reading_frequencies[reading]) * (1.4 if kind == "surname" else 0.8)
    if kind == "surname":
        preferred_written, preferred_reading = 2, 4
        score -= abs(len(written) - preferred_written) * 1.4
        score -= abs(len(reading) - preferred_reading) * 0.35
        if len(written) == 4:
            score -= 1.5
    else:
        preferred_written, preferred_reading = 2, 3
        score -= abs(len(written) - preferred_written) * 1.2
        score -= abs(len(reading) - preferred_reading) * 0.45
        if len(written) == 3:
            score -= 0.8
    return score


def ranked(keys, frequencies, kind):
    keys = list(keys)
    reading_frequencies = Counter(reading for _, reading in keys)
    return sorted(
        keys,
        key=lambda key: (-quality_score(key, frequencies, reading_frequencies, kind), key[0], key[1]),
    )


def best_per_written(ordered):
    seen = set()
    result = []
    for key in ordered:
        if key[0] in seen:
            continue
        seen.add(key[0])
        result.append(key)
    return result


def prefer_curated_neutral(ordered):
    """Keep curated readings from being displaced by another reading of the same kanji."""
    ordered = list(ordered)
    return best_per_written(
        [key for key in ordered if key in NEUTRAL_PAIRS]
        + [key for key in ordered if key not in NEUTRAL_PAIRS]
    )


def take_with_reading_cap(ordered, predicate, count, already, cap):
    chosen = []
    reading_counts = Counter()
    for key in ordered:
        if key in already or not predicate(key):
            continue
        if reading_counts[key[1]] >= cap:
            continue
        chosen.append(key)
        reading_counts[key[1]] += 1
        if len(chosen) == count:
            return chosen
    raise RuntimeError(f"Not enough candidates under reading cap={cap}: {len(chosen)}/{count}")


def assign_rarity(records: list[dict]) -> None:
    count = len(records)
    common_end = round(count * RARITY_SPLIT[0])
    uncommon_end = common_end + round(count * RARITY_SPLIT[1])
    for index, record in enumerate(records):
        record["rarity"] = (
            "common" if index < common_end else "uncommon" if index < uncommon_end else "rare"
        )


def load_surname_frequency(path: Path | None) -> list[str]:
    if path is None:
        return []
    with path.open(encoding="utf-8-sig", newline="") as handle:
        rows = csv.DictReader(handle)
        result = []
        seen = set()
        for row in rows:
            written = (row.get("sei") or "").strip()
            if written and written not in seen:
                seen.add(written)
                result.append(written)
        return result


def build_surnames(
    candidates: dict[tuple[str, str], set[str]], frequency_order: list[str]
) -> list[dict]:
    frequencies = char_frequencies(candidates)
    overall = ranked(candidates, frequencies, "surname")
    by_written: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for key in overall:
        by_written[key[0]].append(key)

    chosen = []
    chosen_set = set()

    # Population-ranked spellings come first. When JMnedict also marks a reading
    # as a place name, it is a substantially stronger representative-reading
    # signal than the old character-frequency heuristic (e.g. 関=せき,
    # 田中=たなか, 渡辺=わたなべ).
    for written in frequency_order:
        pairs = by_written.get(written, [])
        if not pairs:
            continue
        place_pairs = [key for key in pairs if "place" in candidates[key]]
        preferred = place_pairs or pairs[:1]
        for key in preferred:
            if key not in chosen_set:
                chosen.append(key)
                chosen_set.add(key)
                if len(chosen) == SURNAME_COUNT:
                    break
        if len(chosen) == SURNAME_COUNT:
            break

    # Frequency source and JMnedict do not have perfect coverage overlap.
    # Deterministically fill any remainder with the existing quality score.
    if len(chosen) < SURNAME_COUNT:
        for key in overall:
            if key in chosen_set:
                continue
            chosen.append(key)
            chosen_set.add(key)
            if len(chosen) == SURNAME_COUNT:
                break
    if len(chosen) != SURNAME_COUNT:
        raise RuntimeError(f"Not enough surnames: {len(chosen)}")
    records = [
        {
            "id": stable_numeric_id("surname", written, reading),
            "kanji": written,
            "reading": reading,
        }
        for written, reading in chosen
    ]
    assign_rarity(records)
    return records


def build_given_names(candidates: dict[tuple[str, str], set[str]]) -> list[dict]:
    frequencies = char_frequencies(candidates)
    selected: dict[tuple[str, str], str] = {}

    for primary in ("male", "female"):
        ordered = prefer_curated_neutral(
            ranked((key for key in candidates if primary in candidates[key]), frequencies, "given")
        )
        chosen = take_with_reading_cap(
            ordered,
            lambda key, category=primary: category in candidates[key],
            PRIMARY_COUNTS[primary],
            selected,
            8,
        )
        selected.update({key: primary for key in chosen})

    # Reserve spelling-specific neutral candidates in the unspecified bucket.
    unspecified_pool = [
        key
        for key in prefer_curated_neutral(
            ranked((key for key in candidates if "unspecified" in candidates[key]), frequencies, "given")
        )
        if key not in selected
    ]
    reserved_neutral = [key for key in unspecified_pool if key in NEUTRAL_PAIRS]
    for key in reserved_neutral:
        selected[key] = "unspecified"
    unspecified_needed = PRIMARY_COUNTS["unspecified"] - len(reserved_neutral)
    extra_unspecified = take_with_reading_cap(
        unspecified_pool,
        lambda key: True,
        unspecified_needed,
        selected,
        8,
    )
    selected.update({key: "unspecified" for key in extra_unspecified})

    by_primary: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for key, primary in selected.items():
        by_primary[primary].append(key)
    for primary in by_primary:
        by_primary[primary] = ranked(by_primary[primary], frequencies, "given")

    rarity_by_key: dict[tuple[str, str], str] = {}
    for primary in ("male", "female", "unspecified"):
        temporary = [{"key": key} for key in by_primary[primary]]
        assign_rarity(temporary)
        for item in temporary:
            rarity_by_key[item["key"]] = item["rarity"]

    neutral_keys = set(selected).intersection(NEUTRAL_PAIRS)

    records = []
    for primary in ("male", "female", "unspecified"):
        for written, reading in by_primary[primary]:
            source_categories = candidates[(written, reading)]
            categories = [cat for cat in ("male", "female") if cat in source_categories]
            if (written, reading) in neutral_keys:
                categories.append("neutral")
            records.append(
                {
                    "id": stable_numeric_id("given", written, reading),
                    "kanji": written,
                    "reading": reading,
                    "primaryCategory": primary,
                    "categories": categories,
                    "rarity": rarity_by_key[(written, reading)],
                }
            )

    if len(records) != 12_000:
        raise RuntimeError(f"Wrong given-name count: {len(records)}")
    return records


def write_json(path: Path, value) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )


def write_browser_fallback(path: Path, surnames, given_names) -> None:
    payload = json.dumps(
        {"surnames": surnames, "givenNames": given_names},
        ensure_ascii=False,
        separators=(",", ":"),
    )
    path.write_text(
        "window.NAMAE_GACHA_DATA=" + payload + ";\n",
        encoding="utf-8",
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("kanjidic", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument(
        "--surname-frequency",
        type=Path,
        help="CSV with columns sei,rank,number; rows ordered by population rank",
    )
    args = parser.parse_args()

    surnames_raw, given_raw, metadata = load_candidates(args.source, args.kanjidic)
    surname_frequency = load_surname_frequency(args.surname_frequency)
    surnames = build_surnames(surnames_raw, surname_frequency)
    given_names = build_given_names(given_raw)
    args.output.mkdir(parents=True, exist_ok=True)
    write_json(args.output / "surnames.json", surnames)
    write_json(args.output / "given_names.json", given_names)
    write_browser_fallback(args.output / "name_data.js", surnames, given_names)
    write_json(
        args.output / "data_sources.json",
        {
            "generatedAt": "2026-09-05",
            "sources": [
                {
                    "name": "JMnedict via jmdict-simplified",
                    "upstream": "https://www.edrdg.org/enamdict/enamdict_doc.html",
                    "converter": "https://github.com/scriptin/jmdict-simplified",
                    "license": "CC BY-SA 4.0 / EDRDG licence conditions",
                    "licenseUrl": "https://www.edrdg.org/edrdg/licence.html",
                    "converterVersion": metadata.get("converterVersion"),
                    "dictDate": metadata.get("dictDate"),
                    "dictRevisions": metadata.get("dictRevisions"),
                    "sourceWordCount": metadata.get("sourceWordCount"),
                },
                {
                    "name": "KANJIDIC2 via jmdict-simplified",
                    "upstream": "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
                    "converter": "https://github.com/scriptin/jmdict-simplified",
                    "license": "CC BY-SA 4.0 / EDRDG licence conditions",
                    "licenseUrl": "https://www.edrdg.org/edrdg/licence.html",
                    "dictDate": metadata.get("kanjidicDate"),
                    "databaseVersion": metadata.get("kanjidicDatabaseVersion"),
                    "characterCount": metadata.get("kanjidicCharacterCount"),
                },
            ] + ([{
                "name": "日本の姓の人口順のデータ",
                "publisher": "静岡大学学術リポジトリ",
                "author": "城岡啓二",
                "published": "2018-08-10",
                "upstream": "https://shizuoka.repo.nii.ac.jp/records/10691",
                "fileSha256": "77fa934ad952437fd0caa0da91eb64476d8bb0c5a31161571ad159f060f8d237",
                "usage": "surname spelling selection order only; source CSV is not bundled",
            }] if args.surname_frequency else []),
            "selection": {
                "surnameCount": len(surnames),
                "givenNameCount": len(given_names),
                "primaryCounts": PRIMARY_COUNTS,
                "neutralEligibleCount": sum(
                    "neutral" in item["categories"] for item in given_names
                ),
                "notes": [
                    "primaryCategory=unspecified is not treated as neutral.",
                    "Neutral eligibility uses a conservative spelling-and-reading allowlist and is not a demographic claim.",
                    "Surname rarity follows selection order based on the referenced population-ranked dataset; given-name rarity remains an internal heuristic.",
                    "Records use basic CJK ideographs plus the iteration mark 々; readings are hiragana-only.",
                ],
            },
        },
    )
    print(json.dumps({
        "surnames": len(surnames),
        "givenNames": len(given_names),
        "neutralEligible": sum("neutral" in item["categories"] for item in given_names),
        "metadata": metadata,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
