import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    // We are switching to Photon (which is an OSM-based open geocoder) 
    // because Nominatim has very strict rate limits that caused an IP block.
    // Photon doesn't require an API key and is much more lenient for development.
    const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=5`);

    if (!res.ok) {
      return NextResponse.json({ error: `Photon API error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    
    // Map Photon GeoJSON to Nominatim format so the frontend doesn't need to change
    const mapped = (data.features || []).map((f: any) => {
      const p = f.properties;
      // Filter out duplicate names in the display string
      const nameParts = Array.from(new Set([p.name, p.street, p.city, p.state, p.country].filter(Boolean)));
      return {
        place_id: p.osm_id || Math.random().toString(),
        display_name: nameParts.join(", "),
        lat: f.geometry.coordinates[1].toString(),
        lon: f.geometry.coordinates[0].toString()
      };
    });

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("Geocoding proxy error:", error);
    return NextResponse.json({ error: 'Failed to fetch from Geocoding API' }, { status: 500 });
  }
}
