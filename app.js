require([
  "esri/Map",
  "esri/views/MapView",
  "esri/Graphic",
  "esri/layers/GraphicsLayer",
  "esri/geometry/Polyline",
  "esri/geometry/Point",
  "esri/widgets/LayerList",
  "esri/widgets/Expand",
  "esri/widgets/BasemapGallery"
], (Map, MapView, Graphic, GraphicsLayer, Polyline, Point, LayerList, Expand, BasemapGallery) => {
  const routeLayer = new GraphicsLayer({ title: "Solved route" });
  const stopLayer = new GraphicsLayer({ title: "Solved stops" });

  const map = new Map({ basemap: "osm", layers: [routeLayer, stopLayer] });
  const view = new MapView({
    container: "viewDiv",
    map,
    center: [-79.45, 43.66],
    zoom: 11,
    popup: { dockEnabled: true, dockOptions: { position: "top-right", breakpoint: false } }
  });

  let routeGraphic;
  let stopGraphics = [];

  const layerList = new LayerList({ view });
  view.ui.add(new Expand({
    view,
    content: layerList,
    group: "top-right",
    expandTooltip: "Map layers",
    collapseTooltip: "Close layers"
  }), "top-right");

  const basemapGallery = new BasemapGallery({ view });
  view.ui.add(new Expand({
    view,
    content: basemapGallery,
    group: "top-right",
    expandTooltip: "Choose basemap",
    collapseTooltip: "Close basemap gallery"
  }), "top-right");

  const formatDate = (value) => value ? new Intl.DateTimeFormat(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto"
  }).format(new Date(Number(value))) : "—";
  const minutesAsDuration = (minutes) => {
    const total = Math.round(Number(minutes) || 0);
    const days = Math.floor(total / 1440);
    const hours = Math.floor((total % 1440) / 60);
    const mins = total % 60;
    return [days && `${days}d`, hours && `${hours}h`, `${mins}m`].filter(Boolean).join(" ");
  };

  function popupContent(attributes, isDepot = false) {
    const rows = [
      ["Type", isDepot ? "Depot" : "Order"],
      ["Route", attributes.RouteName || "—"],
      ["Sequence", attributes.Sequence ?? "—"],
      ["Arrival", formatDate(attributes.ArriveTimeUTC)],
      ["Departure", formatDate(attributes.DepartTimeUTC)],
      ["Travel from previous", `${Number(attributes.FromPrevTravelTime || 0).toFixed(1)} min`],
      ["Distance from previous", `${Number(attributes.FromPrevDistance || 0).toFixed(2)} km`],
      ["Violation", `${Number(attributes.ViolationTime || 0).toFixed(1)} min`]
    ];
    const container = document.createElement("div");
    for (const [label, value] of rows) {
      const row = document.createElement("div");
      row.className = "popup-row";
      const strong = document.createElement("strong");
      strong.textContent = `${label}: `;
      row.append(strong, document.createTextNode(String(value)));
      container.append(row);
    }
    return container;
  }

  function buildRoute(routeResponse) {
    const feature = routeResponse.value.features[0];
    const geometry = new Polyline({ paths: feature.geometry.paths, spatialReference: { wkid: 4326 } });
    routeLayer.add(new Graphic({
      geometry,
      symbol: { type: "simple-line", color: [255, 255, 255, 0.92], width: 8 }
    }));
    routeGraphic = new Graphic({
      geometry,
      attributes: feature.attributes,
      symbol: { type: "simple-line", color: [9, 78, 112, 0.96], width: 4 },
      popupTemplate: {
        title: "Route {Name}",
        content: [
          { type: "fields", fieldInfos: [
            { fieldName: "OrderCount", label: "Orders" },
            { fieldName: "TotalDistance", label: "Distance (km)", format: { places: 2 } },
            { fieldName: "TotalTime", label: "Total time (min)", format: { places: 1 } },
            { fieldName: "TotalTravelTime", label: "Travel time (min)", format: { places: 1 } },
            { fieldName: "TotalViolationTime", label: "Violation time (min)", format: { places: 1 } }
          ] }
        ]
      }
    });
    routeLayer.add(routeGraphic);
    return feature.attributes;
  }

  function buildStops(stopsResponse) {
    const sorted = stopsResponse.value.features
      .filter((feature) => Number.isFinite(feature.geometry?.x) && Number.isFinite(feature.geometry?.y))
      .sort((a, b) => a.attributes.Sequence - b.attributes.Sequence);
    const stopLabels = [];
    stopGraphics = sorted.map((feature) => {
      const isDepot = feature.attributes.StopType === 1;
      const geometry = new Point({ ...feature.geometry, spatialReference: { wkid: 4326 } });
      const graphic = new Graphic({
        geometry,
        attributes: feature.attributes,
        symbol: isDepot
          ? { type: "simple-marker", style: "diamond", size: 24, color: "#ffad32", outline: { color: "#ffffff", width: 2 } }
          : { type: "simple-marker", size: 20, color: "#08a39c", outline: { color: "#ffffff", width: 1.4 } },
        popupTemplate: {
          title: isDepot ? "Depot" : "Order {Name}",
          content: () => popupContent(feature.attributes, isDepot)
        }
      });
      stopLabels.push(new Graphic({
        geometry,
        attributes: feature.attributes,
        symbol: {
          type: "text",
          text: String(feature.attributes.Sequence ?? ""),
          color: isDepot ? "#3b2a00" : "#ffffff",
          font: { family: "Arial", size: 9, weight: "bold" },
          horizontalAlignment: "center",
          verticalAlignment: "middle"
        },
        popupTemplate: graphic.popupTemplate
      }));
      return graphic;
    });
    stopLayer.addMany([...stopGraphics, ...stopLabels]);
    renderStopList(stopGraphics);
  }

  function renderStopList(graphics, query = "") {
    const list = document.getElementById("stopList");
    list.replaceChildren();
    const normalized = query.trim().toLowerCase();
    const orders = graphics.filter((graphic) => graphic.attributes.StopType === 0 &&
      String(graphic.attributes.Name).toLowerCase().includes(normalized));
    document.getElementById("stopCount").textContent = `${orders.length} shown`;

    for (const graphic of orders) {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "stop-button";
      const sequence = document.createElement("span");
      sequence.className = "sequence";
      sequence.textContent = graphic.attributes.Sequence;
      const details = document.createElement("span");
      const name = document.createElement("span");
      name.className = "stop-name";
      name.textContent = graphic.attributes.Name;
      const meta = document.createElement("span");
      meta.className = "stop-meta";
      meta.textContent = `${formatDate(graphic.attributes.ArriveTimeUTC)} · ${Number(graphic.attributes.FromPrevDistance).toFixed(2)} km from previous`;
      details.append(name, meta);
      button.append(sequence, details);
      button.addEventListener("click", () => {
        view.goTo({ target: graphic.geometry, zoom: 17 });
        view.openPopup({ features: [graphic], location: graphic.geometry });
      });
      item.append(button);
      list.append(item);
    }
  }

  function updateSummary(attributes, sourceName) {
    const jobId = document.getElementById("jobId");
    jobId.textContent = sourceName;
    jobId.title = sourceName;
    document.getElementById("orderCount").textContent = attributes.OrderCount;
    document.getElementById("totalDistance").textContent = Number(attributes.TotalDistance).toFixed(1);
    document.getElementById("totalTime").textContent = minutesAsDuration(attributes.TotalTime);
    document.getElementById("violationTime").textContent = minutesAsDuration(attributes.TotalViolationTime);
    const status = document.getElementById("status");
    status.className = "status";
    status.textContent = `Loaded ${attributes.OrderCount} orders on route ${attributes.Name}.`;
  }

  function findFeatureSets(payloads) {
    const found = { routes: null, stops: null };
    const visited = new Set();

    function inspect(value) {
      if (!value || typeof value !== "object" || visited.has(value)) return;
      visited.add(value);

      if (typeof value.ResponseJson === "string") {
        try { inspect(JSON.parse(value.ResponseJson)); } catch { /* Continue inspecting the envelope. */ }
      }

      const featureSet = value.value?.features ? value.value : value.features ? value : null;
      if (featureSet) {
        const geometryType = featureSet.geometryType || value.geometryType;
        const sampleGeometry = featureSet.features.find((feature) => feature.geometry)?.geometry;
        if (!found.routes && (geometryType === "esriGeometryPolyline" || sampleGeometry?.paths)) {
          found.routes = { value: featureSet };
        }
        if (!found.stops && (geometryType === "esriGeometryPoint" || (Number.isFinite(sampleGeometry?.x) && Number.isFinite(sampleGeometry?.y)))) {
          found.stops = { value: featureSet };
        }
      }

      for (const child of Object.values(value)) {
        if (child && typeof child === "object") inspect(child);
      }
    }

    payloads.forEach(inspect);
    return found;
  }

  async function displayPayloads(payloads, sourceName) {
    try {
      const { routes, stops } = findFeatureSets(payloads);
      if (!routes || !stops) {
        const missing = [!routes && "route polyline", !stops && "stops"].filter(Boolean).join(" and ");
        throw new Error(`The JSON does not contain ${missing} output`);
      }

      routeLayer.removeAll();
      stopLayer.removeAll();
      stopGraphics = [];
      const attributes = buildRoute(routes);
      buildStops(stops);
      updateSummary(attributes, sourceName);
      await view.when();
      await view.goTo(routeGraphic.geometry.extent.expand(1.08));
    } catch (error) {
      console.error(error);
      const status = document.getElementById("status");
      status.className = "status error";
      status.textContent = error.message;
    }
  }

  document.getElementById("jsonFiles").addEventListener("change", async (event) => {
    const files = [...event.target.files];
    if (!files.length) return;
    try {
      const payloads = await Promise.all(files.map(async (file) => JSON.parse((await file.text()).replace(/^\uFEFF/, ""))));
      displayPayloads(payloads, files.map((file) => file.name).join(", "));
    } catch (error) {
      const status = document.getElementById("status");
      status.className = "status error";
      status.textContent = `Invalid JSON: ${error.message}`;
    }
  });

  document.getElementById("loadJsonButton").addEventListener("click", () => {
    try {
      displayPayloads([JSON.parse(document.getElementById("jsonInput").value)], "Pasted JSON payload");
    } catch (error) {
      const status = document.getElementById("status");
      status.className = "status error";
      status.textContent = `Invalid JSON: ${error.message}`;
    }
  });

  document.getElementById("zoomButton").addEventListener("click", () => routeGraphic && view.goTo(routeGraphic.geometry.extent.expand(1.08)));
  document.getElementById("stopSearch").addEventListener("input", (event) => renderStopList(stopGraphics, event.target.value));
});
