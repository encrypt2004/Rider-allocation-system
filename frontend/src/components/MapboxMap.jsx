import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const RESTAURANT = [85.3120, 23.3440];
const CUSTOMER = [85.3170, 23.3405];

export default function MapboxMap({ riders }) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef(new Map());
  const [message, setMessage] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_TOKEN;
    if (!token || token === "your_mapbox_public_token_here") {
      setMessage("Add your Mapbox public token to frontend/.env to load the real map.");
      return undefined;
    }

    mapboxgl.accessToken = token;
    map.current = new mapboxgl.Map({
      container: container.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [85.312, 23.344],
      zoom: 14.5
    });
    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.current.on("load", () => {
      setMapLoaded(true);
      const restaurant = document.createElement("div");
      restaurant.className = "map-place-marker restaurant";
      restaurant.textContent = "R";
      new mapboxgl.Marker({ element: restaurant }).setLngLat(RESTAURANT).setPopup(new mapboxgl.Popup({ offset: 18 }).setText("Demo restaurant")).addTo(map.current);

      const customer = document.createElement("div");
      customer.className = "map-place-marker customer";
      customer.textContent = "C";
      new mapboxgl.Marker({ element: customer }).setLngLat(CUSTOMER).setPopup(new mapboxgl.Popup({ offset: 18 }).setText("Demo customer")).addTo(map.current);
    });

    map.current.on("error", () => setMessage("Mapbox could not load. Check your public token and internet connection."));
    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current.clear();
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    riders.forEach((rider) => {
      const lat = Number(rider.lat);
      const lng = Number(rider.lng);

      // Ignore missing or invalid coordinates so one bad rider cannot crash the map.
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        markers.current.get(rider.id)?.remove();
        markers.current.delete(rider.id);
        return;
      }

      if (rider.status === "Offline") {
        markers.current.get(rider.id)?.remove();
        markers.current.delete(rider.id);
        return;
      }
      let marker = markers.current.get(rider.id);
      if (!marker) {
        const element = document.createElement("div");
        element.className = "map-rider-marker";
        element.textContent = rider.name.charAt(0);
        marker = new mapboxgl.Marker({ element })
          .setLngLat([lng, lat])
          .setPopup(new mapboxgl.Popup({ offset: 16 }).setText(rider.name + " · " + rider.status))
          .addTo(map.current);
        markers.current.set(rider.id, marker);
      } else {
        marker.setLngLat([lng, lat]);
        marker.getElement().className = "map-rider-marker " + (rider.status === "Delivering" ? "busy" : "available");
      }
    });
  }, [riders, mapLoaded]);

  return (
    <div className="mapbox-wrapper">
      <div ref={container} className="mapbox-canvas" />
      {message && <div className="mapbox-message">{message}</div>}
      <div className="map-legend mapbox-legend">
        <span><i className="legend-dot available-dot" />Available rider</span>
        <span><i className="legend-dot busy-dot" />Delivering</span>
        <span><i className="legend-dot restaurant-dot" />Restaurant</span>
      </div>
    </div>
  );
}
