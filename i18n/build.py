"""Build i18n/tr-<site>.js from strings-en.json + src/<site>-*.tsv (lines: index<TAB>turkish).
Later files override earlier ones. Usage: python3 -I build.py [site ...]"""
import json, os, sys, glob

HERE = os.path.dirname(os.path.abspath(__file__))
EN = json.load(open(os.path.join(HERE, "strings-en.json")))

def pairs(path):
    """english<TAB>turkish lines (for strings the collector could not see, and shared demo UI)."""
    d = {}
    if os.path.exists(path):
        for n, line in enumerate(open(path, encoding="utf-8"), 1):
            line = line.rstrip("\n")
            if not line.strip(): continue
            en, _, tr = line.partition("\t")
            assert en and tr, f"{path}:{n} bad line: {line[:60]!r}"
            d[en] = tr
    return d

def build(site):
    en = EN[site]
    d = {} if site == "studio" else pairs(os.path.join(HERE, "src", "common.pairs"))
    d.update(pairs(os.path.join(HERE, "src", f"{site}.pairs")))
    for f in sorted(glob.glob(os.path.join(HERE, "src", f"{site}-*.tsv"))):
        for n, line in enumerate(open(f, encoding="utf-8"), 1):
            line = line.rstrip("\n")
            if not line.strip(): continue
            i, _, tr = line.partition("\t")
            assert i.isdigit() and tr, f"{f}:{n} bad line: {line[:60]!r}"
            i = int(i)
            assert i < len(en), f"{f}:{n} index {i} out of range ({len(en)})"
            if tr != en[i]: d[en[i]] = tr
    out = os.path.join(HERE, f"tr-{site}.js")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("window.I18N_TR=" + json.dumps(d, ensure_ascii=False, indent=0) + ";\n")
    print(f"{site}: {len(d)} of {len(en)} strings translated")

for s in (sys.argv[1:] or sorted(EN)):
    build(s)
