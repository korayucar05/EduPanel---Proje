export type ValidationIssue = { field: string; message: string };
export type ValidationResult = { valid: boolean; issues: ValidationIssue[] };
export type ValidationRule<T> = (value: T) => ValidationIssue | ValidationIssue[] | null | undefined;

export class Validator {
  static validate<T>(value: T, rules: ValidationRule<T>[]): ValidationResult {
    const issues = rules.flatMap((rule) => {
      const result = rule(value);
      return result == null ? [] : Array.isArray(result) ? result : [result];
    });
    return { valid: issues.length === 0, issues };
  }

  static required<T extends Record<string, unknown>>(field: keyof T, label = String(field)): ValidationRule<T> {
    return (value) => {
      const fieldValue = value[field];
      return fieldValue === undefined || fieldValue === null || String(fieldValue).trim() === ""
        ? { field: String(field), message: `${label} zorunludur.` }
        : null;
    };
  }
}
