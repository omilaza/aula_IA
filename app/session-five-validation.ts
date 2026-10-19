export function hasWrittenContent(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function missingWrittenFields(fields: ReadonlyArray<readonly [string, string]>) {
  return fields
    .filter(([, value]) => !hasWrittenContent(value))
    .map(([label]) => label);
}
