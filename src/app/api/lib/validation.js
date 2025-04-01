export function validateQueryParams(params, schema) {
  const errors = [];

  for (const [key, rules] of Object.entries(schema)) {
    const value = params.get(key);

    if (rules.required && !value) {
      errors.push(`${key} is required`);
      continue;
    }

    if (value) {
      if (rules.type === "integer") {
        const num = parseInt(value);
        if (isNaN(num)) {
          errors.push(`${key} must be a number`);
        } else if (rules.min !== undefined && num < rules.min) {
          errors.push(`${key} must be at least ${rules.min}`);
        } else if (rules.max !== undefined && num > rules.max) {
          errors.push(`${key} must be at most ${rules.max}`);
        }
      }

      if (rules.type === "enum" && !rules.values.includes(value)) {
        errors.push(`${key} must be one of: ${rules.values.join(", ")}`);
      }
    }
  }

  return errors;
}
