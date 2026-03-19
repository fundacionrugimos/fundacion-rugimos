"use client"

import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

type Props = {
  lat: number | null
  lng: number | null
  setLat: (lat: number) => void
  setLng: (lng: number) => void
}

const icon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})

function SelectorDeUbicacion({
  lat,
  lng,
  setLat,
  setLng,
}: Props) {
  useMapEvents({
    click(e) {
      setLat(e.latlng.lat)
      setLng(e.latlng.lng)
    },
  })

  if (lat == null || lng == null) return null

  return (
    <Marker
      position={[lat, lng]}
      draggable={true}
      icon={icon}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target
          const pos = marker.getLatLng()
          setLat(pos.lat)
          setLng(pos.lng)
        },
      }}
    />
  )
}

export default function MapaSolicitud({ lat, lng, setLat, setLng }: Props) {
  const center: [number, number] =
    lat != null && lng != null ? [lat, lng] : [-17.7833, -63.1821]

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom={true}
      style={{ height: "320px", width: "100%", borderRadius: "16px" }}
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <SelectorDeUbicacion lat={lat} lng={lng} setLat={setLat} setLng={setLng} />
    </MapContainer>
  )
}