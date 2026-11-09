"""Tenging við Power BI-gagnaveitu Samgöngustofu (bifreidatolur.samgongustofa.is), með leyfi Samgöngustofu.

Notkun:
    rows = query(["Tegund", "Undirtegund"], measures=["Talning fastanúmera"],
                 where=[eq("Umferðaskráning", "In"), isin("Tegund", ["KIA"])], top=5000)
    -> [{"Tegund": "KIA", "Undirtegund": "SPORTAGE", "Talning fastanúmera": 9123}, ...]

Persónuupplýsingar (kennitala eiganda, heimilisfang, póstnúmer eiganda) eru aldrei sóttar: PRIVATE_COLUMNS stöðvar það.
"""
import json
import time
import urllib.request
from datetime import datetime, timezone

ENDPOINT = "https://wabi-europe-north-b-api.analysis.windows.net/public/reports/querydata?synchronous=true"
RESOURCE_KEY = "9fabaea5-cbe3-4fc1-a430-e86e05d50622"   # opinber lykill „publish to web“-skýrslunnar
DATASET_ID = "7b026c30-f3e3-425e-b7dc-e27eeea9c7cf"
REPORT_ID = "6016d9d4-3bf9-432c-8c0d-1406af49a04b"
MODEL_ID = 6585848
TABLE = "Bifreiðatölur/lykiltölur (Vere_MV_1171)"
MEASURES = "Key Measures - skráningar"
PRIVATE_COLUMNS = {"Kennitala eiganda", "Heimilisfang", "Póstnúmer", "Sveitarfélag", "Tilkynnandi"}


class PowerBIError(Exception):
    pass


def _col(name):
    return {"Column": {"Expression": {"SourceRef": {"Source": "v"}}, "Property": name}}


def _lit(v):
    if isinstance(v, bool):
        return {"Literal": {"Value": "true" if v else "false"}}
    if isinstance(v, (int, float)):
        return {"Literal": {"Value": f"{v}L" if isinstance(v, int) else f"{v}D"}}
    return {"Literal": {"Value": "'" + str(v).replace("'", "''") + "'"}}


# --- skilyrði (Where) ---------------------------------------------------------
def eq(column, value):
    return {"Condition": {"Comparison": {"ComparisonKind": 0, "Left": _col(column), "Right": _lit(value)}}}


def isin(column, values):
    return {"Condition": {"In": {"Expressions": [_col(column)], "Values": [[_lit(v)] for v in values]}}}


def notin(column, values):
    return {"Condition": {"Not": {"Expression": isin(column, values)["Condition"]}}}


def between(column, start, end):
    """start <= dálkur < end, fyrir dagsetningar á sniðinu 'YYYY-MM-DD'."""
    def d(v):
        return {"Literal": {"Value": f"datetime'{v}T00:00:00'"}}
    return [{"Condition": {"Comparison": {"ComparisonKind": 2, "Left": _col(column), "Right": d(start)}}},
            {"Condition": {"Comparison": {"ComparisonKind": 3, "Left": _col(column), "Right": d(end)}}}]


PASSENGER = ["Fólksbifreið (M1)", "Fólksbifreið (M1)/Torfærubifreið", "Fólksbifreið (M1) / Torfærubifreið"]

IN_TRAFFIC = [eq("Umferðaskráning", "In"), notin("Staða skráningar", ["Afskráð"])]


def build(columns, measures=(), where=(), top=1000, order_by_measure=True):
    """Býr til Power BI SemanticQueryDataShapeCommand út frá dálkum, mælingum og skilyrðum."""
    bad = PRIVATE_COLUMNS.intersection(columns)
    if bad:
        raise ValueError(f"Persónuupplýsingar eru ekki sóttar: {', '.join(sorted(bad))}")
    sel = [dict(_col(c), Name=f"v.{c}") for c in columns]
    sel += [{"Measure": {"Expression": {"SourceRef": {"Source": "k"}}, "Property": m}, "Name": f"k.{m}"} for m in measures]
    q = {"Version": 2, "From": [{"Name": "v", "Entity": TABLE, "Type": 0}, {"Name": "k", "Entity": MEASURES, "Type": 0}], "Select": sel}
    if where:
        q["Where"] = list(where)
    if measures and order_by_measure:
        q["OrderBy"] = [{"Direction": 2, "Expression": {"Measure": {"Expression": {"SourceRef": {"Source": "k"}}, "Property": measures[0]}}}]
    return {
        "version": "1.0.0",
        "queries": [{"Query": {"Commands": [{"SemanticQueryDataShapeCommand": {
            "Query": q,
            "Binding": {"Primary": {"Groupings": [{"Projections": list(range(len(sel)))}]},
                        "DataReduction": {"DataVolume": 4, "Primary": {"Top": {"Count": top}}}, "Version": 1}}}]},
            "QueryId": "", "ApplicationContext": {"DatasetId": DATASET_ID, "Sources": [{"ReportId": REPORT_ID}]}}],
        "cancelQueries": [], "modelId": MODEL_ID,
    }


# --- afkóðun þjappaða sniðsins -------------------------------------------------
def decode(resp, names):
    """Breytir DSR-sniði Power BI í lista af dict.

    Hver röð í DM0 hefur C (gildi), R (bitamaski: dálkur endurtekinn frá fyrri röð) og Ø (bitamaski: dálkur tómur).
    Dálkar með DN vísa í ValueDicts (orðabók textagilda); tölurnar í C eru þá vísar í orðabókina.
    """
    try:
        res = resp["results"][0]["result"]
    except (KeyError, IndexError, TypeError):
        raise PowerBIError(f"Óvænt svar: {str(resp)[:300]}")
    if "error" in res or "data" not in res:
        raise PowerBIError(f"Villa frá Power BI: {json.dumps(res.get('error', res), ensure_ascii=False)[:500]}")
    ds = res["data"]["dsr"]["DS"][0]
    if ds.get("Exceptions") or res["data"]["dsr"].get("DataShapes"):
        raise PowerBIError(f"Fyrirspurn mistókst: {json.dumps(ds.get('Exceptions') or res['data']['dsr'], ensure_ascii=False)[:500]}")
    vd = ds.get("ValueDicts", {})
    rows, schema, prev = [], None, None
    for r in (ds.get("PH") or [{}])[0].get("DM0", []):
        if "S" in r:
            schema = r["S"]
        if schema is None:
            continue
        rep, nul, vals, j, out = r.get("R", 0), r.get("Ø", 0), r.get("C", []), 0, []
        for i, col in enumerate(schema):
            if rep >> i & 1:
                v = prev[i]
            elif nul >> i & 1:
                v = None
            else:
                v = vals[j] if j < len(vals) else None
                j += 1
                if col.get("DN") is not None and isinstance(v, int):
                    v = vd[col["DN"]][v]
                elif col.get("T") == 7 and isinstance(v, (int, float)):  # dagsetning sem epoch-millisekúndur
                    v = datetime.fromtimestamp(v / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            out.append(v)
        prev = out
        rows.append(dict(zip(names, out)))
    return rows


def query(columns, measures=(), where=(), top=1000, retries=3, delay=0.4):
    """Sendir fyrirspurn og skilar afkóðuðum röðum. Reynir aftur með vaxandi bið ef tenging eða Power BI bregst."""
    body = json.dumps(build(columns, measures, where, top)).encode()
    names = list(columns) + list(measures)
    err = None
    for attempt in range(retries):
        try:
            req = urllib.request.Request(ENDPOINT, data=body, headers={
                "Content-Type": "application/json;charset=UTF-8", "X-PowerBI-ResourceKey": RESOURCE_KEY})
            with urllib.request.urlopen(req, timeout=90) as r:
                rows = decode(json.load(r), names)
            time.sleep(delay)  # kurteisi gagnvart gagnaveitunni
            return rows
        except (PowerBIError, OSError, ValueError) as e:
            err = e
            time.sleep(2 ** attempt * 2)
    raise PowerBIError(f"Fyrirspurn mistókst eftir {retries} tilraunir: {err}")
