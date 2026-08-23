export type GeoPoint = {
  latitude: number;
  longitude: number;
};

export type RoofPlaneInput = {
  id: string;
  polygon: GeoPoint[];
  angleMinDegrees: number;
  angleMaxDegrees: number;
};

export type MeasurementConfidence = "high" | "medium" | "low";

export type MeasurementInput = {
  addressResolved: boolean;
  buildingResolved: boolean;
  imageryLicensed: boolean;
  roofPlanes: RoofPlaneInput[];
  confidence: MeasurementConfidence;
};

export type MeasuredRoofPlane = {
  id: string;
  horizontalAreaTenths: number;
  angleMinDegrees: number;
  angleMaxDegrees: number;
  factorMin: number;
  factorMax: number;
  actualAreaMinTenths: number;
  actualAreaMaxTenths: number;
};

export type MeasurementResult = {
  planes: MeasuredRoofPlane[];
  horizontalAreaTenths: number;
  actualAreaMinTenths: number;
  actualAreaMaxTenths: number;
};
