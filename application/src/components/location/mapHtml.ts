export const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body { margin: 0; padding: 0; height: 100%; background: #e8eef0; }
    #map { position: absolute; inset: 0; }
    #pin {
      position: absolute; left: 50%; top: 50%;
      transform: translate(-50%, -100%);
      z-index: 1000; pointer-events: none;
      filter: drop-shadow(0 3px 3px rgba(0,0,0,.35));
      transition: transform .12s ease-out;
    }
    #pin.lift { transform: translate(-50%, -118%); }
    #dot {
      position: absolute; left: 50%; top: 50%;
      transform: translate(-50%, -50%);
      width: 9px; height: 9px; border-radius: 50%;
      background: rgba(0,0,0,.28); z-index: 999; pointer-events: none;
    }
    .leaflet-control-attribution { font-size: 9px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="pin">
    <svg width="34" height="46" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 8.4 12 20 12 20s12-11.6 12-20C24 5.37 18.63 0 12 0z" fill="#167A45"/>
      <circle cx="12" cy="12" r="4.6" fill="#fff"/>
    </svg>
  </div>
  <div id="dot"></div>

  <script>
    function send(p) {
      if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(p));
    }
    function log(level, message) { send({ type: 'log', level: level, message: String(message) }); }
    function r6(n) { return Math.round(n * 1e6) / 1e6; }

    // send WebView JS errors back to RN for debugging
    window.onerror = function (message, source, lineno) {
      log('error', message + ' @' + lineno);
      return false;
    };
    if (typeof L === 'undefined') {
      log('error', 'Leaflet failed to load - no internet / CDN blocked');
    } else {
      log('info', 'Leaflet ' + L.version + ' loaded');
    }

    var pin = document.getElementById('pin');
    var map = L.map('map', { zoomControl: false, attributionControl: true })
      .setView([20.5937, 78.9629], 4);
    var tiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '&copy; OpenStreetMap contributors'
    });
    var tileErrors = 0;
    tiles.on('tileerror', function () {
      tileErrors++;
      if (tileErrors === 1) log('warn', 'map tiles failed to load (offline / blocked?)');
    });
    tiles.on('load', function () { log('info', 'map tiles loaded'); });
    tiles.addTo(map);

    map.on('movestart', function () { pin.classList.add('lift'); });
    map.on('moveend', function () {
      pin.classList.remove('lift');
      var c = map.getCenter();
      send({ type: 'move', latitude: r6(c.lat), longitude: r6(c.lng) });
    });
    // tapping recenters the map; the center is the selected point
    map.on('click', function (e) { map.panTo(e.latlng, { animate: true }); });

    window.MAP = {
      flyTo: function (lat, lng, zoom) {
        map.flyTo([Number(lat), Number(lng)], zoom || 16, { duration: 0.6 });
      },
      setCenter: function (lat, lng, zoom) {
        map.setView([Number(lat), Number(lng)], zoom || 16);
      }
    };

    send({ type: 'ready' });
  </script>
</body>
</html>`;
