/**
 * Report form validation utilities
 */

export interface ReportFormData {
  status: string;
  streetName?: string;
  lat?: number;
  lon?: number;
  tripRouteId?: string;
}

export function validateReportForm(data: ReportFormData): string[] {
  const errors: string[] = [];

  if (
    !["optimal", "medium", "sufficient", "requires_maintenance"].includes(
      data.status,
    )
  ) {
    errors.push("Invalid status value");
  }

  if (!data.tripRouteId) {
    if (!data.streetName || data.streetName.trim().length === 0) {
      errors.push("Street name is required for standalone reports");
    }
    if (data.lat === undefined || data.lon === undefined) {
      errors.push("Location is required for standalone reports");
    }
  }

  return errors;
}
