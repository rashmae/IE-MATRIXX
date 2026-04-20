/**
 * CTU Academic Grading Scale Utility
 * Based on the official Cebu Technological University grading scale.
 */

export const CTU_GRADING_SCALE = [
  { grade: 99, gwa: 1.1 }, { grade: 98, gwa: 1.2 }, { grade: 97, gwa: 1.3 },
  { grade: 96, gwa: 1.4 }, { grade: 95, gwa: 1.5 }, { grade: 94, gwa: 1.6 },
  { grade: 93, gwa: 1.6 }, { grade: 92, gwa: 1.7 }, { grade: 91, gwa: 1.7 },
  { grade: 90, gwa: 1.8 }, { grade: 89, gwa: 1.8 }, { grade: 88, gwa: 1.9 },
  { grade: 87, gwa: 1.9 }, { grade: 86, gwa: 2.0 }, { grade: 85, gwa: 2.0 },
  { grade: 84, gwa: 2.1 }, { grade: 83, gwa: 2.1 }, { grade: 82, gwa: 2.2 },
  { grade: 81, gwa: 2.2 }, { grade: 80, gwa: 2.3 }, { grade: 79, gwa: 2.3 },
  { grade: 78, gwa: 2.4 }, { grade: 77, gwa: 2.4 }, { grade: 76, gwa: 2.5 },
  { grade: 75, gwa: 2.5 }, { grade: 74, gwa: 2.6 }, { grade: 73, gwa: 2.6 },
  { grade: 72, gwa: 2.7 }, { grade: 71, gwa: 2.7 }, { grade: 70, gwa: 2.8 },
  { grade: 69, gwa: 2.8 }, { grade: 68, gwa: 2.9 }, { grade: 67, gwa: 2.9 },
  { grade: 66, gwa: 3.0 }, { grade: 65, gwa: 3.0 },
];

/**
 * Returns the GWA equivalent for a percentage grade.
 */
export function getGWAEquivalent(percentageGrade: number): number {
  if (percentageGrade < 65) return 5.0;
  
  // Find the closest grade in the scale
  const match = CTU_GRADING_SCALE.find(item => item.grade === Math.round(percentageGrade));
  if (match) return match.gwa;
  
  // Fallback for values between defined steps
  if (percentageGrade >= 99) return 1.0;
  
  return 3.0; // Default pass
}

/**
 * Returns a standing label for a GWA.
 */
export function getGWALabel(gwa: number): string {
  if (gwa === 0) return "Not Evaluated";
  if (gwa <= 1.5) return "Excellent";
  if (gwa <= 2.0) return "Very Good";
  if (gwa <= 2.5) return "Good";
  if (gwa <= 3.0) return "Satisfactory";
  return "Failed";
}

/**
 * Returns a Tailwind color class based on GWA standing.
 */
export function getGWAColor(gwa: number): string {
  if (gwa === 0) return "text-gray-400";
  if (gwa <= 1.5) return "text-ctu-gold";
  if (gwa <= 2.0) return "text-green-500";
  if (gwa <= 2.5) return "text-blue-500";
  if (gwa <= 3.0) return "text-amber-500";
  return "text-red-500";
}

/**
 * Returns a hexadecimal color string based on GWA standing (for charts).
 */
export function getGWAHexColor(gwa: number): string {
  if (gwa === 0) return "#9ca3af";
  if (gwa <= 1.5) return "#925dfc"; // CTU Gold/Purple
  if (gwa <= 2.0) return "#22c55e"; // Green
  if (gwa <= 2.5) return "#3b82f6"; // Blue
  if (gwa <= 3.0) return "#f59e0b"; // Amber
  return "#ef4444"; // Red
}

/**
 * Latin Honor Thresholds
 */
export const LATIN_HONORS = [
  { label: "Summa Cum Laude", min: 1.0, max: 1.20 },
  { label: "Magna Cum Laude", min: 1.21, max: 1.45 },
  { label: "Cum Laude", min: 1.46, max: 1.75 },
];
