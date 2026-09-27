#!/usr/bin/env bash
# Downloads the open-licensed source data into data/raw (not committed: ~100 MB).
set -euo pipefail
mkdir -p data/raw && cd data/raw
S="https://raw.githubusercontent.com/STEPBible/STEPBible-Data/master"
curl -sSL -o tagnt1.txt "$S/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Mat-Jhn%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt"
curl -sSL -o tagnt2.txt "$S/Translators%20Amalgamated%20OT%2BNT/TAGNT%20Act-Rev%20-%20Translators%20Amalgamated%20Greek%20NT%20-%20STEPBible.org%20CC-BY.txt"
curl -sSL -o tbesg.txt  "$S/Lexicons/TBESG%20-%20Translators%20Brief%20lexicon%20of%20Extended%20Strongs%20for%20Greek%20-%20STEPBible.org%20CC%20BY.txt"
curl -sSL -o web.zip  https://ebible.org/Scriptures/engwebp_usfm.zip
curl -sSL -o amh.zip  https://ebible.org/Scriptures/amh_usfm.zip
curl -sSL -o xref.zip https://a.openbible.info/data/cross-references.zip
unzip -qo web.zip -d web && unzip -qo amh.zip -d amh && unzip -qo xref.zip -d xref
for id in eng-kjv engbsb eng-asv engylt; do curl -sSL -o $id.zip "https://ebible.org/Scriptures/${id}_usfm.zip" && unzip -qo $id.zip -d $id; done
echo "data ready"
