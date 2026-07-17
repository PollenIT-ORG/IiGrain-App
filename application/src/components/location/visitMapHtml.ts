export const VISIT_MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #e8eef0; }
    #map { position: absolute; inset: 0; }

    .assessor-wrap { position: relative; width: 44px; height: 44px; }
    .assessor-pulse {
      position: absolute; left: 2px; top: 2px; width: 40px; height: 40px; border-radius: 50%;
      background: rgba(22,163,74,.35); animation: apulse 1.8s infinite;
    }
    .assessor-badge {
      position: absolute; left: 6px; top: 6px; width: 32px; height: 32px; border-radius: 50%;
      background: #16A34A; border: 3px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,.4);
      display: flex; align-items: center; justify-content: center;
    }
    @keyframes apulse {
      0%   { transform: scale(0.6); opacity: 0.85; }
      70%  { transform: scale(1.9); opacity: 0; }
      100% { opacity: 0; }
    }

    #eta {
      position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 500;
      display: none; align-items: center; gap: 6px;
      background: #fff; color: #14361f; font: 600 13px/1 -apple-system, Roboto, sans-serif;
      padding: 8px 14px; border-radius: 20px; box-shadow: 0 2px 10px rgba(0,0,0,.22);
      white-space: nowrap;
    }
    #eta .dot { width: 7px; height: 7px; border-radius: 50%; background: #16A34A; }

    #recenter {
      position: absolute; right: 12px; bottom: 16px; z-index: 500;
      width: 44px; height: 44px; border-radius: 22px; background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,.28);
      display: flex; align-items: center; justify-content: center; cursor: pointer;
    }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="eta"><span class="dot"></span><span id="eta-text"></span></div>
  <div id="recenter" onclick="recenter()">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#167A45" stroke-width="2" stroke-linecap="round">
      <circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6" fill="#167A45" stroke="none"/>
      <line x1="12" y1="1.5" x2="12" y2="4.5"/><line x1="12" y1="19.5" x2="12" y2="22.5"/>
      <line x1="1.5" y1="12" x2="4.5" y2="12"/><line x1="19.5" y1="12" x2="22.5" y2="12"/>
    </svg>
  </div>
  <script>
    var ROUTER_URL = 'https://router.project-osrm.org/route/v1/driving/';

    function send(p) { if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(p)); }
    function log(m) { send({ type: 'log', message: String(m) }); }

    var map = L.map('map', { zoomControl: true, attributionControl: true }).setView([20.5937, 78.9629], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    if (typeof L === 'undefined') log('Leaflet failed to load');

    var destMarker = null, assessorMarker = null, routeLine = null, straightLine = null;
    var fitted = false, rafId = null, routing = false, lastRouteFrom = null, lastRouteAt = 0;

    // destination (field) pin
    function destIcon() {
      return L.divIcon({
        className: '', iconSize: [36, 48], iconAnchor: [18, 48],
        html: '<svg width="36" height="48" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 3px rgba(0,0,0,.35))">'
          + '<path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.37 18.63 0 12 0z" fill="#E5484D"/>'
          + '<circle cx="12" cy="12" r="8.4" fill="#fff" opacity="0.18"/>'
          + '<g transform="translate(6.3,5.2) scale(0.46)"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" fill="#fff"/></g>'
          + '</svg>'
      });
    }
    // live assessor marker
    function assessorIcon() {
      return L.divIcon({
        className: '', iconSize: [44, 44], iconAnchor: [22, 22],
        html: '<div class="assessor-wrap"><div class="assessor-pulse"></div>'
          + '<div class="assessor-badge">'
          + '<svg width="22" height="22" viewBox="0 0 24 24" fill="#fff"><path d="M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"/></svg>'
          + '</div></div>'
      });
    }

    function haversine(p1, p2) {
      var R = 6371000, toRad = Math.PI / 180;
      var dLat = (p2[0] - p1[0]) * toRad, dLng = (p2[1] - p1[1]) * toRad;
      var la1 = p1[0] * toRad, la2 = p2[0] * toRad;
      var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.asin(Math.sqrt(x));
    }

    function showEta(distM, durS) {
      var d = distM >= 1000 ? (distM / 1000).toFixed(distM >= 10000 ? 0 : 1) + ' km' : Math.round(distM) + ' m';
      var mins = Math.max(1, Math.round(durS / 60));
      document.getElementById('eta-text').textContent = d + ' · ' + mins + ' min away';
      document.getElementById('eta').style.display = 'flex';
    }

    // straight line: shown instantly, and used when routing fails
    function drawStraight(a, d) {
      if (straightLine) { straightLine.setLatLngs([a, d]); }
      else { straightLine = L.polyline([a, d], { color: '#16A34A', weight: 3, opacity: 0.5, dashArray: '3,9', lineCap: 'round' }).addTo(map); }
    }
    function clearStraight() { if (straightLine) { map.removeLayer(straightLine); straightLine = null; } }

    // real road route via OSRM
    function fetchRoute(a, d) {
      routing = true;
      var url = ROUTER_URL + a[1] + ',' + a[0] + ';' + d[1] + ',' + d[0] + '?overview=full&geometries=geojson';
      fetch(url).then(function (r) { return r.json(); }).then(function (j) {
        routing = false;
        if (j && j.code === 'Ok' && j.routes && j.routes[0] && j.routes[0].geometry) {
          var coords = j.routes[0].geometry.coordinates.map(function (c) { return [c[1], c[0]]; });
          if (routeLine) { routeLine.setLatLngs(coords); }
          else { routeLine = L.polyline(coords, { color: '#16A34A', weight: 6, opacity: 0.9, lineJoin: 'round', lineCap: 'round' }).addTo(map); }
          clearStraight();
          showEta(j.routes[0].distance, j.routes[0].duration);
        } else {
          log('OSRM: no route (' + (j && j.code) + ')');
          drawStraight(a, d);
        }
      }).catch(function (e) { routing = false; log('OSRM error: ' + e); drawStraight(a, d); });
    }

    // re-routes on the first fix, then only after a >40m drift (max once per 8s)
    function updatePath() {
      var a = assessorMarker && assessorMarker.getLatLng();
      var d = destMarker && destMarker.getLatLng();
      if (!a || !d) { return; }
      var A = [a.lat, a.lng], D = [d.lat, d.lng];
      if (!routeLine) { drawStraight(A, D); }
      var now = Date.now();
      var moved = lastRouteFrom ? haversine(lastRouteFrom, A) : Infinity;
      if (!routing && (lastRouteFrom === null || (moved > 40 && now - lastRouteAt > 8000))) {
        lastRouteFrom = A; lastRouteAt = now;
        fetchRoute(A, D);
      }
    }

    // only the straight line tracks the marker; the road route waits for updatePath()
    function syncFallback() {
      if (routeLine) { return; }
      var a = assessorMarker && assessorMarker.getLatLng();
      var d = destMarker && destMarker.getLatLng();
      if (a && d) { drawStraight([a.lat, a.lng], [d.lat, d.lng]); }
    }

    function fitOnce() {
      var a = assessorMarker && assessorMarker.getLatLng();
      var d = destMarker && destMarker.getLatLng();
      if (a && d && !fitted) { map.fitBounds(L.latLngBounds([a, d]).pad(0.35)); fitted = true; }
    }

    function maybeFollow(to) {
      var ll = L.latLng(to[0], to[1]);
      if (!map.getBounds().pad(-0.18).contains(ll)) {
        var d = destMarker && destMarker.getLatLng();
        if (d) { map.fitBounds(L.latLngBounds([ll, d]).pad(0.3), { animate: true }); }
        else { map.panTo(ll, { animate: true, duration: 0.8 }); }
      }
    }

    function easeInOut(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }

    function animateAssessor(from, to) {
      if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
      var dur = 900, startTs = null;
      function stepFrame(ts) {
        if (startTs === null) startTs = ts;
        var t = Math.min(1, (ts - startTs) / dur);
        var e = easeInOut(t);
        assessorMarker.setLatLng([from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]);
        syncFallback();
        if (t < 1) { rafId = requestAnimationFrame(stepFrame); }
        else { rafId = null; maybeFollow(to); updatePath(); }
      }
      rafId = requestAnimationFrame(stepFrame);
    }

    window.recenter = function () {
      var a = assessorMarker && assessorMarker.getLatLng();
      var d = destMarker && destMarker.getLatLng();
      if (a && d) { map.fitBounds(L.latLngBounds([a, d]).pad(0.35), { animate: true }); }
      else if (a) { map.setView(a, 16, { animate: true }); }
      else if (d) { map.setView(d, 15, { animate: true }); }
    };

    window.VISIT = {
      setDestination: function (lat, lng) {
        var ll = [Number(lat), Number(lng)];
        if (destMarker) { destMarker.setLatLng(ll); }
        else { destMarker = L.marker(ll, { icon: destIcon() }).addTo(map); }
        if (!assessorMarker) { map.setView(ll, 14); }
        fitOnce();
        updatePath();
      },
      setAssessor: function (lat, lng) {
        var to = [Number(lat), Number(lng)];
        if (assessorMarker) {
          var from = assessorMarker.getLatLng();
          animateAssessor([from.lat, from.lng], to);
        } else {
          assessorMarker = L.marker(to, { icon: assessorIcon(), zIndexOffset: 1000 }).addTo(map);
          if (!destMarker) { map.setView(to, 15); }
          fitOnce();
          updatePath();
        }
      }
    };

    send({ type: 'ready' });
  </script>
</body>
</html>`;
