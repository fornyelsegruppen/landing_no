import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { getCaseWorkspaceCopy } from "@/lib/admin-v2/case-workspace-i18n";
import { AdminLeadPhotoGallery } from "./admin-lead-photo-gallery";

describe("AdminLeadPhotoGallery", () => {
  it("renders case-bound admin routes without exposing Blob URLs", () => {
    const html = renderToStaticMarkup(
      createElement(AdminLeadPhotoGallery, {
        copy: getCaseWorkspaceCopy("lt").photos,
        leadId: 12,
        photoCount: 2,
      }),
    );

    expect(html).toContain("Kliento nuotraukos");
    expect(html).toContain("/api/admin/leads/12/photo?index=0");
    expect(html).toContain("/api/admin/leads/12/photo?index=1");
    expect(html).not.toContain("blob.vercel-storage.com");
  });

  it("caps the visible gallery at the intake limit", () => {
    const html = renderToStaticMarkup(
      createElement(AdminLeadPhotoGallery, {
        copy: getCaseWorkspaceCopy("nb").photos,
        leadId: 7,
        photoCount: 99,
      }),
    );

    expect((html.match(/<img/g) || []).length).toBe(15);
    expect(html).not.toContain("index=15");
  });

  it("shows a localized empty state when no photos were submitted", () => {
    const html = renderToStaticMarkup(
      createElement(AdminLeadPhotoGallery, {
        copy: getCaseWorkspaceCopy("en").photos,
        leadId: 7,
        photoCount: 0,
      }),
    );

    expect(html).toContain("No customer photos were attached.");
    expect(html).not.toContain("<img");
  });
});
