export function createMapReviewLinks(input: {
  address: string;
  latitude?: number;
  longitude?: number;
  sourceUrl?: string;
}) {
  const norgeskart = new URL("https://norgeskart.no/");
  norgeskart.searchParams.set("sok", input.address);

  const googleMaps = new URL("https://www.google.com/maps/@");
  googleMaps.searchParams.set("api", "1");
  googleMaps.searchParams.set("map_action", "map");
  if (Number.isFinite(input.latitude) && Number.isFinite(input.longitude)) {
    googleMaps.searchParams.set(
      "center",
      `${input.latitude},${input.longitude}`,
    );
    googleMaps.searchParams.set("zoom", "20");
    googleMaps.searchParams.set("basemap", "satellite");
  } else {
    googleMaps.pathname = "/maps/search/";
    googleMaps.searchParams.set("query", input.address);
  }

  return {
    googleMaps: googleMaps.toString(),
    norgeskart: norgeskart.toString(),
    source: input.sourceUrl,
  };
}
