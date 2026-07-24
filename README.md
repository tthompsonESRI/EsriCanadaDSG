# Vehicle Route Plan Viewer

A lightweight ArcGIS Maps SDK for JavaScript application for visualizing Vehicle Routing Problem solver output.

## Live application

https://tthompsonesri.github.io/EsriCanadaDSG/

## Features

- Load route and stop result payloads from JSON files or pasted JSON
- Display solved route geometry and sequenced stops
- Search and inspect the stop schedule
- View route statistics, stop timing, travel distance, and violations
- Toggle operational layers with the Layer List
- Switch basemaps with the Basemap Gallery
- Responsive interface for desktop and mobile browsers

## Run locally

Serve the repository from any static HTTP server, then open `index.html`. For example, with Node.js installed:

```shell
npx http-server .
```

The application uses the ArcGIS Maps SDK for JavaScript from the Esri CDN. No build step or application framework is required.

## Input

Select both ArcGIS VRP output JSON files at once:

1. The `out_routes` polyline feature set
2. The `out_stops` point feature set

A combined JSON object containing both feature sets is also supported. Logged response envelopes containing a serialized `ResponseJson` property are recognized automatically.

## Data safety

The `data/` directory is excluded from source control. VRP payloads can contain customer locations, routing details, and temporary ArcGIS access tokens; do not commit client payloads.
