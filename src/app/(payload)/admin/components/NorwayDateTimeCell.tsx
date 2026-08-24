import type { DefaultCellComponentProps } from "payload";
import { formatNorwayDateTime } from "@/lib/norway-time";

export const NorwayDateTimeCell = ({ cellData }: DefaultCellComponentProps) => {
  if (typeof cellData !== "string" || !cellData) return <span>—</span>;
  return <span>{formatNorwayDateTime(cellData, "nb-NO")}</span>;
};

export default NorwayDateTimeCell;
