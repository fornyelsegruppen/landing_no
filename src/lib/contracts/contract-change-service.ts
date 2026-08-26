export const contractChangeServiceKeys = [
  "takvask",
  "takvask_impregnering",
  "impregnering",
  "takmaling",
  "nytt_tak",
] as const;

export type ContractChangeServiceKey = (typeof contractChangeServiceKeys)[number];

export function suggestContractChangeService(
  text: string | null | undefined,
  currentService?: string | null,
): ContractChangeServiceKey | undefined {
  const normalized = (text || "").toLocaleLowerCase("nb-NO");
  if (/nytt\s+tak|takbytte|bytte\s+tak/.test(normalized)) return "nytt_tak";
  if (/takmaling|male\s+tak|maling\s+av\s+tak/.test(normalized)) return "takmaling";
  if (/impregner/.test(normalized) && /takvask|vaske|vask/.test(normalized)) return "takvask_impregnering";
  if (/impregner/.test(normalized)) return "impregnering";
  if (/takvask|vaske\s+tak|takrens/.test(normalized)) return "takvask";

  return contractChangeServiceKeys.includes(currentService as ContractChangeServiceKey)
    ? currentService as ContractChangeServiceKey
    : undefined;
}
