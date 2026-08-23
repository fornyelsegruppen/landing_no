export type MediaClassification =
  "public-content" | "customer" | "measurement" | "contract" | "work";

export function mediaIsPrivate(classification: MediaClassification) {
  return classification !== "public-content";
}

export type PrivateMediaViewer = {
  role: "admin" | "worker" | null;
  userId?: string | number;
  assignedWorkerId?: string | number;
  validCustomerGrant?: boolean;
};

export function canViewPrivateMedia(viewer: PrivateMediaViewer) {
  if (viewer.role === "admin") return true;
  if (
    viewer.role === "worker" &&
    viewer.userId !== undefined &&
    String(viewer.userId) === String(viewer.assignedWorkerId)
  ) {
    return true;
  }
  return viewer.validCustomerGrant === true;
}
