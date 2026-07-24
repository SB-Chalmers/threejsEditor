# EPSM External API Guide

How to query the EPSM materials database, build an EnergyPlus IDF using those materials, and submit it for simulation — all from outside the EPSM application.

**Base URL**: `https://epsm.chalmers.se`

---

## Authentication

Most read and simulation endpoints are **publicly accessible — no login required**. The only endpoint that requires authentication is `POST /api/components/add/` (saving new components to the database).

| Endpoint | Auth required |
|---|---|
| `GET /api/materials/` | No |
| `GET /api/construction-sets/` | No |
| `POST /api/parse/idf/` | No |
| `POST /api/simulation/run/` | No |
| `GET /api/simulation/{id}/status/` | No |
| `GET /api/simulation/{id}/results/` | No |
| `POST /api/components/add/` | **Yes** |

If you do need to log in:

```bash
curl -c cookies.txt -X POST https://epsm.chalmers.se/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"username": "your_username", "password": "your_password"}'
```

---

## 1. Browse the Materials Database

Fetch all available materials and their thermal properties:

```bash
curl https://epsm.chalmers.se/api/materials/
```

Example response entry:
```json
{
  "name": "Concrete 200mm",
  "roughness": "MediumRough",
  "thickness_m": 0.2,
  "conductivity_w_mk": 1.95,
  "density_kg_m3": 2300.0,
  "specific_heat_j_kgk": 900.0,
  "thermal_absorptance": 0.9,
  "solar_absorptance": 0.7,
  "visible_absorptance": 0.7,
  "wall_allowed": true,
  "roof_allowed": false,
  "floor_allowed": true,
  "window_layer_allowed": false
}
```

Use the `wall_allowed`, `roof_allowed`, `floor_allowed`, and `window_layer_allowed` flags to filter materials suitable for each element type.

### Browse Construction Sets

Pre-configured wall/roof/floor/window groupings:

```bash
curl https://epsm.chalmers.se/api/construction-sets/
```

Response includes `wall_construction_name`, `roof_construction_name`, etc. — these map directly to EnergyPlus `Construction` object names.

---

## 2. Build Your IDF

Use the material and construction names returned by the API directly in your EnergyPlus IDF. The names must match exactly.

### Material block (from `/api/materials/` response)

```idf
Material,
  Concrete 200mm,   ! name — must match EPSM material name exactly
  MediumRough,      ! roughness
  0.2,              ! thickness {m}
  1.95,             ! conductivity {W/m-K}
  2300.0,           ! density {kg/m3}
  900.0,            ! specific heat {J/kg-K}
  0.9,              ! thermal absorptance
  0.7,              ! solar absorptance
  0.7;              ! visible absorptance
```

### Construction block

```idf
Construction,
  ExteriorWall,         ! construction name
  Concrete 200mm,       ! layer 1 (outside → inside)
  Insulation 100mm,     ! layer 2
  Plasterboard 12mm;    ! layer 3
```

> **Tip**: Use `GET /api/constructions/` to see existing construction definitions and their layer order, so you don't have to assemble layers manually.

---

## 3. Validate Your IDF (Optional)

Before running, you can parse the IDF to check that EPSM recognises all materials and constructions:

```bash
curl -X POST https://epsm.chalmers.se/api/parse/idf/ \
  -F "files=@building.idf"
```

The response shows each material and construction along with `"existsInDatabase": true/false`. Any `false` entries mean the name doesn't match an EPSM database entry and the simulation may produce unexpected results.

---

## 4. Run the Simulation

Submit your IDF and an EPW weather file:

```bash
curl -X POST https://epsm.chalmers.se/api/simulation/run/ \
  -F "idf_files=@building.idf" \
  -F "weather_file=@Gothenburg.epw"
```

Optional form fields:

| Field | Type | Default | Description |
|---|---|---|---|
| `parallel` | `true`/`false` | `false` | Run multiple IDF files in parallel |
| `batch_mode` | `true`/`false` | `false` | Batch processing mode |
| `max_workers` | integer | `4` | Max parallel workers |
| `scenario_id` | UUID | — | Use a saved EPSM scenario's construction sets |
| `construction_mode` | `combinatorial` / `per_construction` | `combinatorial` | How construction sets are applied when using a scenario |

Response:
```json
{
  "simulation_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "running"
}
```

---

## 5. Poll for Status

```bash
curl https://epsm.chalmers.se/api/simulation/{simulation_id}/status/
```

Response:
```json
{
  "simulation_id": "...",
  "status": "running",
  "progress": 65
}
```

`status` values: `pending` → `running` → `completed` / `failed`

---

## 6. Retrieve Results

Once `status` is `completed`:

```bash
curl https://epsm.chalmers.se/api/simulation/{simulation_id}/results/
```

Key fields in the response:

```json
{
  "simulationId": "...",
  "total_energy_kwh": 15420.5,
  "heating_energy_kwh": 8320.2,
  "cooling_energy_kwh": 4100.1,
  "hourly_timeseries": { ... }
}
```

### Download raw output files

```bash
curl -OJ https://epsm.chalmers.se/api/simulation/{simulation_id}/download/
```

---

## Full Python Example

```python
import requests

BASE = "https://epsm.chalmers.se"
session = requests.Session()  # no login needed

# 1. Fetch materials to check names
materials = session.get(f"{BASE}/api/materials/").json()
wall_materials = [m for m in materials if m["wall_allowed"]]
print("Available wall materials:", [m["name"] for m in wall_materials])

# 3. Validate IDF
with open("building.idf", "rb") as idf:
    parse_result = session.post(
        f"{BASE}/api/parse/idf/",
        files={"files": idf}
    ).json()

unrecognised = [
    m["name"] for m in parse_result.get("materials", [])
    if not m.get("existsInDatabase")
]
if unrecognised:
    print("Warning: materials not in EPSM database:", unrecognised)

# 4. Submit simulation
with open("building.idf", "rb") as idf, open("Gothenburg.epw", "rb") as epw:
    run_result = session.post(
        f"{BASE}/api/simulation/run/",
        files={
            "idf_files": idf,
            "weather_file": epw,
        }
    ).json()

sim_id = run_result["simulation_id"]
print("Simulation started:", sim_id)

# 5. Poll status
import time
while True:
    status = session.get(f"{BASE}/api/simulation/{sim_id}/status/").json()
    print(f"  Status: {status['status']}  Progress: {status.get('progress', '?')}%")
    if status["status"] in ("completed", "failed"):
        break
    time.sleep(10)

# 6. Get results
results = session.get(f"{BASE}/api/simulation/{sim_id}/results/").json()
print("Total energy (kWh):", results.get("total_energy_kwh"))
```

---

## Notes

- Material and construction **names are case-sensitive** and must match the EPSM database exactly.
- The EPW file must be a valid EnergyPlus weather file for your climate location.
- Multiple IDF files can be submitted in a single request by repeating `-F "idf_files=@fileN.idf"`.
- Most endpoints are public. Only `POST /api/components/add/` requires a logged-in session.
- Token-based auth (API keys) is not currently supported.

---

## Embodied Carbon (GWP) Calculation — Frontend

Embodied carbon is calculated **client-side in threejsEditor** — no simulation run required.

### Formula

$$\text{GWP}_\text{total} = \sum_{\text{element}} \text{gwp\_kgco2e\_per\_m}^2_{\text{construction}} \times A_{\text{element}}$$

| Element | Area source |
|---|---|
| Opaque wall | `perimeter × floors × floorHeight × (1 − WWR)` |
| Windows | `perimeter × floors × floorHeight × WWR` |
| Floor | `footprint_area × floors` |
| Roof | `footprint_area` (top surface only) |

Where:
- `perimeter` — sum of footprint edge lengths from `building.points[]` (actual polygon vertices); falls back to `√footprint_area × 4` if not available
- `footprint_area` — stored on `BuildingData.area`, computed when the building footprint is drawn
- `floors`, `floorHeight`, `WWR` — user-editable values from the Edit Building panel

### Data source

`gwp_kgco2e_per_m2` is a **pre-computed field** on each `Construction` record in EPSM (`GET /api/constructions/`). It is the sum of `gwp_kgco2e_per_m2` across all material layers in that construction. No material-level summing is needed in the frontend.

### Normalised result

$$\text{GWP}_{\text{normalised}} = \frac{\text{GWP}_\text{total}}{A_\text{floor}} \quad \text{[kg CO}_2\text{e/m}^2\text{]}$$

This is displayed live in the **Envelope & Materials** section of the Edit Building panel as each construction is changed.
