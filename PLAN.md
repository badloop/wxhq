# WXHQ Implementation Plan

## Project Structure

```
wxhq/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── public/
│   └── favicon.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── vite-env.d.ts
│   ├── context/
│   │   ├── AppContext.tsx          # Global state (React Context + useReducer)
│   │   └── AppReducer.ts
│   ├── components/
│   │   ├── Map/
│   │   │   ├── RadarMap.tsx        # Main Leaflet MapContainer
│   │   │   ├── NexradMosaic.tsx    # NEXRAD mosaic TMS tile layer
│   │   │   ├── NexradMarkers.tsx   # NEXRAD site dot markers
│   │   │   ├── SingleSiteRadar.tsx # Single-site RIDGE overlay
│   │   │   └── AnimationControls.tsx
│   │   ├── Overlays/
│   │   │   ├── OverlayManager.tsx  # Toggle panel UI
│   │   │   ├── SPCOutlookLayer.tsx
│   │   │   ├── SPCMCDLayer.tsx
│   │   │   ├── SPCWatchLayer.tsx
│   │   │   ├── NWSWarningLayer.tsx
│   │   │   └── CustomOverlayInput.tsx
│   │   ├── Sidebar/
│   │   │   ├── ContextSidebar.tsx
│   │   │   ├── Hodograph.tsx       # Canvas-rendered hodograph
│   │   │   ├── SoundingParams.tsx  # CAPE/CIN/SRH display
│   │   │   ├── OverlayDetails.tsx
│   │   │   └── PointForecast.tsx
│   │   └── IEMBot/
│   │       ├── IEMBotMonitor.tsx
│   │       ├── IEMBotBadge.tsx
│   │       ├── MessageList.tsx
│   │       └── IEMBotFilter.tsx
│   ├── hooks/
│   │   ├── useRadarAnimation.ts
│   │   ├── useAutoRefresh.ts
│   │   ├── useMapClick.ts
│   │   └── useIEMBot.ts
│   ├── services/
│   │   ├── fetchClient.ts         # Wrapper with retry, User-Agent for NWS
│   │   ├── radarApi.ts
│   │   ├── overlayApi.ts
│   │   ├── soundingApi.ts
│   │   └── iembotApi.ts
│   ├── utils/
│   │   ├── soundingCalc.ts        # CAPE/CIN/shear from raw RAOB
│   │   └── geoUtils.ts            # Nearest station, point-in-polygon
│   ├── types/
│   │   ├── radar.ts
│   │   ├── overlays.ts
│   │   ├── sounding.ts
│   │   └── iembot.ts
│   ├── data/
│   │   └── nexradSites.ts         # Static NEXRAD locations (fallback)
│   └── styles/
│       ├── global.css             # CSS custom properties, scanlines, fonts
│       ├── theme.ts               # Theme constants for JS usage
│       └── components/            # CSS modules per component
```

## Component Hierarchy

```
App
├── AppProvider (Context)
├── RadarMap
│   ├── MapContainer (react-leaflet)
│   ├── NexradMosaic (TileLayer for mosaic)
│   ├── NexradMarkers (CircleMarkers for sites)
│   ├── SingleSiteRadar (conditional TileLayer)
│   ├── SPCOutlookLayer (GeoJSON)
│   ├── SPCMCDLayer (GeoJSON)
│   ├── SPCWatchLayer (GeoJSON)
│   ├── NWSWarningLayer (GeoJSON)
│   └── [Custom overlay layers]
├── AnimationControls (fixed bottom bar)
├── OverlayManager (fixed top-right panel)
├── ContextSidebar (slides from right on map click)
│   ├── Hodograph
│   ├── SoundingParams
│   ├── OverlayDetails
│   └── PointForecast
├── IEMBotBadge (fixed bottom-left)
└── IEMBotMonitor (expandable panel)
```

## Data Sources & API Endpoints

### Radar (IEM — Iowa Environmental Mesonet)

| Purpose | Endpoint | Notes |
|---------|----------|-------|
| NEXRAD Mosaic (current) | `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q/{z}/{x}/{y}.png` | TMS, 5-min cache |
| Mosaic history (N min ago) | `nexrad-n0q-m{XX}m` where XX=05,10,...55 | Up to 55 min back, 5-min steps |
| Single site (current) | `ridge::{SITE}-N0B-0` via same TMS | N0B = 8-bit high-res reflectivity |
| Single site (archived) | `ridge::{SITE}-N0B-{YYYYMMDDHHmm}` | Need volume scan times first |
| Volume scan list | `/json/radar.py?operation=list&radar=XXX&product=N0B&start=...&end=...` | Returns available scan times |
| Available radars | `/json/radar.py?operation=available&start=...` | Radar IDs near a point |
| Current metadata | `/json/ridge_current.py?product=N0B&radar=XXX` | Latest scan time |
| NEXRAD network | `/geojson/network.py?network=NEXRAD` | All site locations as GeoJSON |

**DNS load balancing**: Use `mesonet1.agron.iastate.edu`, `mesonet2.agron.iastate.edu`, `mesonet3.agron.iastate.edu` for tile requests to distribute load.

### NWS Warnings & Watches

| Purpose | Endpoint | Notes |
|---------|----------|-------|
| Active alerts | `https://api.weather.gov/alerts/active` | GeoJSON FeatureCollection |
| By area | `/alerts/active?area={state}` | Filter by state |
| By event | `/alerts/active?event=Tornado Warning` | Filter by type |
| By zone | `/alerts/active/zone/{zoneId}` | Specific zone |

**Required header**: `User-Agent: (WXHQ, contact@example.com)` per NWS API policy.

### SPC (Storm Prediction Center)

| Purpose | Endpoint | Notes |
|---------|----------|-------|
| Day 1 Outlook | `https://www.spc.noaa.gov/products/outlook/day1otlk_cat.lyr.geojson` | Categorical |
| Day 1 Tornado | `https://www.spc.noaa.gov/products/outlook/day1otlk_torn.lyr.geojson` | Tornado probs |
| Day 1 Wind | `https://www.spc.noaa.gov/products/outlook/day1otlk_wind.lyr.geojson` | Wind probs |
| Day 1 Hail | `https://www.spc.noaa.gov/products/outlook/day1otlk_hail.lyr.geojson` | Hail probs |
| Day 2 Outlook | `https://www.spc.noaa.gov/products/outlook/day2otlk_cat.lyr.geojson` | Day 2 categorical |
| Day 3 Outlook | `https://www.spc.noaa.gov/products/outlook/day3otlk_cat.lyr.geojson` | Day 3 categorical |
| Mesoscale Discussions | `https://www.spc.noaa.gov/products/md/md.geojson` | Active MDs |
| Active Watches | `https://www.spc.noaa.gov/products/watch/activeWW.geojson` | Tornado/SVR watches |

### Soundings (for Hodograph)

| Purpose | Endpoint | Notes |
|---------|----------|-------|
| Upper air data | `https://mesonet.agron.iastate.edu/json/raob.py?ts=YYYYMMDDHHNN&station=KXXX` | RAOB JSON |
| Sounding stations | `https://mesonet.agron.iastate.edu/geojson/network.py?network=RAOB` | Station locations |
| SPC Analysis | `https://www.spc.noaa.gov/exper/soundings/` | Latest analysis soundings |

### IEMBot

| Purpose | Endpoint | Notes |
|---------|----------|-------|
| WebSocket feed | `wss://weather.im/live/` | Real-time NWS product stream |
| REST polling | `https://weather.im/iembot/api/v1/` | Historical messages |

## Implementation Phases

### Phase 1: Foundation (COMPLETE)
- Vite + React + TypeScript scaffold
- Leaflet map with CartoDB Dark Matter basemap
- NEXRAD mosaic tile layer
- NEXRAD site markers with tooltips
- Site selection + single-site radar overlay
- Animation controls (play/pause/step/speed/frame count)
- Cyberpunk theme (dark bg, neon accents, scanlines, tech fonts)
- AppContext + useReducer state management
- Fetch client with retry/backoff

### Phase 2: Shapefile Overlays
- SPC Day 1/2/3 outlook GeoJSON layers
- Mesoscale Discussion layer
- Watch layer (tornado/severe)
- NWS Warning layer (tornado/SVR tstorm/flash flood)
- Overlay toggle panel (grouped by category)
- Auto-refresh on configurable intervals
- Custom overlay URL input

### Phase 3: Context Sidebar
- Right sidebar slide-in on map click
- Hodograph rendering (HTML5 Canvas)
- Nearest sounding station lookup
- RAOB data fetch and parsing
- CAPE/CIN/SRH/shear parameter display
- Point-in-polygon detection for active overlays
- Collapsible overlay detail sections

### Phase 4: IEMBot Integration
- WebSocket connection to weather.im
- Message parsing and categorization
- Notification badge with unread count
- Expandable message panel
- Message filtering by type/source
- Queue management (clear/mark read)

### Phase 5: Polish
- Responsive layout adjustments
- Keyboard shortcuts
- URL state (share map position/selected site)
- Performance optimization (memoization, lazy loading)
- PWA support (offline basemap caching)

## Key Technical Decisions

1. **State management**: React Context + useReducer (no Redux — app is small enough)
2. **Data fetching**: Custom hooks with useAutoRefresh for polling, no SWR/React Query needed
3. **Map library**: react-leaflet v4 (declarative, good React integration)
4. **Basemap**: CartoDB Dark Matter (fits cyberpunk theme, free, no API key)
5. **Radar source**: IEM exclusively (most reliable free NEXRAD tile service)
6. **Hodograph**: Custom Canvas rendering (no charting library needed for wind profile)
7. **Styling**: CSS custom properties + CSS modules (no runtime CSS-in-JS overhead)
8. **TypeScript**: Strict mode, all types defined upfront
9. **No backend**: All APIs are public and CORS-friendly (IEM, NWS) or proxied via CORS-anywhere fallback
