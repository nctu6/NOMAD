# City data sources

The Cities section (`/cities`) ranks a fixed starter list of places. NOMAD does not invent measurements. Every number in the database was returned by one of the sources below, or is a documented rescaling of those numbers. If a source has no value, the metric is omitted and the UI shows **No data**.

The starter list is `server/scripts/nomad-cities.json` (English place names and ISO country codes only). Coordinates, population, and every score input are fetched by:

```bash
cd server
npm run seed:cities
```

Re-runs fill gaps. `--refresh` replaces stored measurements. Each metric row keeps `source`, `license`, `fetched_at`, `period`, and `scope` (`city`, `country`, or `tile`).

There is **no city monthly budget**. No openly licensed dataset of nomad monthly costs was found that could be redistributed here. The cost row is the country price level, and “Monthly cost” stays empty on purpose.

## Sources

### Place and coordinates

- **What:** latitude, longitude, elevation, population, timezone, GeoNames id, English country name.
- **Source:** [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api), which serves GeoNames.
- **License:** GeoNames [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Please also credit Open-Meteo. The Open-Meteo API itself is offered for non-commercial use; commercial use of the API needs their plan.
- **How:** search by the list name (or an ASCII `search` alias) and keep the highest-population hit in the requested country. If nothing matches, that city is skipped.

### Country facts

- **What:** continent (Wikidata P30, preferred rank, otherwise normal rank), official languages (P37), whether English is an official language, and whether Wikidata records English as a language used (P2936).
- **Source:** [Wikidata Query Service](https://query.wikidata.org/).
- **License:** [CC0](https://creativecommons.org/publicdomain/zero/1.0/).
- **How:** one SPARQL query per fact, limited to the countries in the starter list. “English used” is stored only when the statement exists. Absence of P2936 is **No data**, not a “no”. Official-language “no” is stored only when the country has official-language statements and English is not among them.

### Cost (country price level)

- **What:** price level ratio for the latest year in which both inputs exist. United States ≈ 1. Lower means cheaper.
- **Inputs:** World Bank `PA.NUS.PPP` (PPP conversion factor, LCU per international dollar) divided by `PA.NUS.FCRF` (official exchange rate, LCU per US dollar) for the **same year**. This is the definition of the retired World Bank series `PA.NUS.PPPC.RF`. Both raw inputs are stored in `detail_json`.
- **Source:** [World Bank Open Data](https://data.worldbank.org/).
- **License:** [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Scope:** country, copied onto each city in that country and labeled “Country”.

### Safety

- **What:** intentional homicides per 100,000 people (`VC.IHR.PSRC.P5`).
- **Source:** UNODC, via the World Bank API.
- **License:** World Bank [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Scope:** country.

### Healthcare

- **What:** physicians per 1,000 people (`SH.MED.PHYS.ZS`).
- **Source:** World Health Organization, via the World Bank API.
- **License:** World Bank [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
- **Scope:** country. This is not a hospital-quality rating.

### Climate

- **What:** for each calendar month, the mean of daily ERA5 mean, minimum, and maximum temperature (°C), and the mean monthly precipitation total (mm).
- **Period:** 1 January 2021 through 31 December 2023 (three years, not a 30-year WMO normal). A month is stored as empty when fewer than 60 daily means came back.
- **Source:** [Open-Meteo Historical Weather API](https://open-meteo.com/en/docs/historical-weather-api) (ERA5 / Copernicus Climate Change Service).
- **License:** ERA5 is [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) (Copernicus). Credit Open-Meteo. Same non-commercial API terms as above.
- **“Right now”** on the city page is a separate live call to the Open-Meteo forecast API (`current=temperature_2m`), cached in memory for 15 minutes. It is not written as a permanent score. If the call fails, the page shows No data.

### Air

- **City:** mean hourly PM2.5 (µg/m³) from the [Open-Meteo Air Quality API](https://open-meteo.com/en/docs/air-quality-api) over the past 30 days (CAMS). Stored only when at least seven days of hours are present. The exact timestamp range is saved in `period`.
- **Country:** World Bank `EN.ATM.PM25.MC.M3`, mean annual exposure. Shown beside the city figure. The score uses the city mean when it exists, otherwise the country figure, and the badge says which.
- **License:** CAMS via Copernicus (credit Open-Meteo; non-commercial API terms). World Bank series is CC BY 4.0.

### Internet

- **What:** tests-weighted mean fixed download (Mbps), upload (Mbps), and latency (ms) for Ookla zoom-16 tiles in the 5×5 neighborhood around the city-center tile (about 1–3 km, depending on latitude). Tile counts, test counts, and device counts are stored in `detail_json`.
- **Source:** [Speedtest by Ookla Global Fixed Network Performance](https://github.com/teamookla/ookla-open-data) parquet on AWS (`type=fixed`). The script picks the newest quarter file that responds, from 2026 Q3 back to 2025 Q4.
- **License:** [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/). Non-commercial, and share-alike if you redistribute the measurements. Ookla asks for this attribution: Speedtest® by Ookla® Global Fixed and Mobile Network Performance Maps, accessed from AWS. Ookla trademarks are used under their license.
- **Scope:** labeled “City center”, not a citywide average. Mobile networks are not included. `--skip=internet` leaves the metric empty.

### Things to do

- **What:** count of OpenStreetMap **nodes** within 5 km tagged as cafe, bar, restaurant, pub, cinema, theatre, nightclub, arts centre, attraction, museum, gallery, viewpoint, theme park, zoo, aquarium, artwork, park, garden, stadium, sports centre, or nature reserve.
- **Source:** [Overpass API](https://overpass-api.de/api/interpreter) (`out count`).
- **License:** [ODbL 1.0](https://opendatacommons.org/licenses/odbl/).
- This is a density count. It is not Nomad List’s subjective “fun” score, and it under-counts features drawn as ways or relations.

## Scores

Scores are integers from 0 to 100, computed when the API is read (`server/src/services/cityScores.ts`, `SCORE_VERSION`). They are not stored, so a formula change does not require a reseed. A null measurement produces a null score.

| Score | Input | Map |
| --- | --- | --- |
| Cost | price level ratio R (US ≈ 1) | `(1.5 − R) / 1.5 × 100`, clamped. 0 → 100, 1.5 → 0. |
| Internet | fixed download Mbps | `Mbps / 100 × 100`, clamped. 100 Mbps → 100. |
| Safety | homicides per 100,000 | `(15 − rate) / 15 × 100`, clamped. |
| Climate | months with mean temperature 18–28°C | `months / 12 × 100`. Null unless all 12 months have a mean. |
| Healthcare | physicians per 1,000 | `physicians / 5 × 100`, clamped. |
| Air | PM2.5 µg/m³ (city recent, else country annual) | `(35 − pm25) / 30 × 100`, clamped. 5 → 100, 35 → 0 (WHO 2021 guideline and interim target 1). |
| Things to do | OSM node count N | `log10(N + 1) / log10(2001) × 100`, clamped. 2,000 nodes → 100. |

**Overall** is the unweighted mean of whichever of those seven scores exist. It is null when none exist. English is not a number: the page shows official languages and the two Wikidata facts.

**Comfortable months** (separate from the climate score) are months whose mean is 18–28°C **and** whose mean precipitation is at most 150 mm. A month with no rain figure is not listed.

## Filters

Cities that lack the measurement are hidden, not treated as a zero.

| Filter | Rule |
| --- | --- |
| Warm this month | That city’s current calendar month (in its timezone) has a climate-normal mean ≥ 20°C. |
| Lower prices | Cost score ≥ 60 (price level ratio ≤ 0.6). |
| Fast internet | Fixed download ≥ 50 Mbps. |
| Safer | Homicide rate ≤ 3 per 100,000. |
| Healthcare | Healthcare score ≥ 70 (at least 3.5 physicians per 1,000). |
| English official | Wikidata lists English as an official language. |

## What this is not

Flight prices and “going” meetup counts are not included. They need a key or a provider whose data cannot be redistributed. Numbeo, the EF English Proficiency Index, and Nomad List’s own scores are not used.
