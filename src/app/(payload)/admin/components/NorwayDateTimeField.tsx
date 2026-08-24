"use client";

import { useMemo, useState } from "react";
import type { DateFieldClientComponent } from "payload";
import { FieldLabel, useField } from "@payloadcms/ui";
import {
  formatNorwayDateTimeInput,
  norwayLocalDateTimeToIso,
} from "@/lib/norway-time";

export const NorwayDateTimeField: DateFieldClientComponent = ({
  field,
  path,
  readOnly,
}) => {
  const { value, setValue } = useField<string | null>({ path });
  const [error, setError] = useState("");
  const displayedValue = useMemo(
    () => (value ? formatNorwayDateTimeInput(value) : ""),
    [value],
  );

  return (
    <div className="field-type date-time-field">
      <FieldLabel
        label={field?.label || "Planlagt tidspunkt (norsk tid)"}
        path={path}
        required={field?.required}
      />
      <p style={{ margin: "0 0 0.75rem", fontSize: 13, opacity: 0.7 }}>
        Tidspunktet tolkes og lagres i Europe/Oslo, uavhengig av hvor
        administratoren befinner seg.
      </p>
      <input
        disabled={readOnly}
        onChange={(event) => {
          const next = event.target.value;
          if (!next) {
            setError("");
            setValue(null);
            return;
          }
          try {
            setValue(norwayLocalDateTimeToIso(next));
            setError("");
          } catch (cause) {
            setError(
              cause instanceof Error ? cause.message : "Ugyldig tidspunkt",
            );
          }
        }}
        type="datetime-local"
        value={displayedValue}
      />
      {error ? (
        <p style={{ color: "var(--theme-error-500)", marginTop: 8 }}>{error}</p>
      ) : null}
    </div>
  );
};

export default NorwayDateTimeField;
