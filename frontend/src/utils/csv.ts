export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }

  // Get all unique keys from all objects
  const allKeys = Array.from(
    new Set(data.flatMap(obj => Object.keys(obj)))
  );

  // Create CSV header
  const header = allKeys.join(',');

  // Create CSV rows
  const rows = data.map(obj => {
    return allKeys.map(key => {
      const value = obj[key];

      // Handle null/undefined
      if (value === null || value === undefined) {
        return '';
      }

      // Handle nested objects
      if (typeof value === 'object' && !Array.isArray(value)) {
        return JSON.stringify(value).replace(/"/g, '""');
      }

      // Handle arrays
      if (Array.isArray(value)) {
        return JSON.stringify(value).replace(/"/g, '""');
      }

      // Handle strings with commas or quotes
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }

      return stringValue;
    }).join(',');
  });

  // Combine header and rows
  const csv = [header, ...rows].join('\n');

  // Create blob and download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function flattenForExport(data: any[]): any[] {
  return data.map(item => {
    const flattened: any = {};

    Object.keys(item).forEach(key => {
      const value = item[key];

      // Skip certain fields
      if (key === 'passwordHash' || key === 'refreshToken') {
        return;
      }

      // Flatten nested objects (e.g., owner, organization)
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        if (value.name) {
          flattened[`${key}_name`] = value.name;
        } else if (value.firstName && value.lastName) {
          flattened[`${key}_name`] = `${value.firstName} ${value.lastName}`;
        } else if (value.email) {
          flattened[`${key}_email`] = value.email;
        }
      }
      // Handle arrays (e.g., emails, phones)
      else if (Array.isArray(value)) {
        if (value.length > 0 && value[0].email) {
          flattened[`${key}`] = value.map(e => e.email).join('; ');
        } else if (value.length > 0 && value[0].phone) {
          flattened[`${key}`] = value.map(p => `${p.phone} (${p.type})`).join('; ');
        } else {
          flattened[key] = value.length;
        }
      }
      // Handle dates
      else if (value instanceof Date) {
        flattened[key] = value.toISOString();
      }
      // Handle primitives
      else {
        flattened[key] = value;
      }
    });

    return flattened;
  });
}
