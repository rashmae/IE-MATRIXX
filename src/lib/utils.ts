import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Anonymizes names for confidentiality by masking surnames and components.
 * e.g., 'Juan Dela Cruz' -> 'Jxxxx Dxxxx Cxxxx'
 * e.g., 'Teves' -> 'Txxxx'
 */
export function anonymizeName(name: string | null | undefined): string {
  if (!name) return 'Anonymous';
  const lowerName = name.toLowerCase();
  if (lowerName === 'anonymous' || lowerName === 'anonymous student' || lowerName === 'member') {
    return name;
  }
  
  // Handle "Surname, First Name" format
  if (name.includes(',')) {
    const parts = name.split(',');
    const surname = parts[0].trim();
    const firstName = parts.slice(1).join(',').trim();
    
    const maskedSurname = surname.split(/\s+/)
      .map(word => word ? word[0].toUpperCase() + 'xxxx' : '')
      .join(' ');
      
    return firstName ? `${maskedSurname}, ${firstName}` : maskedSurname;
  }
  
  const words = name.trim().split(/\s+/);
  if (words.length === 0) return 'Anonymous';
  
  if (words.length === 1) {
    const word = words[0];
    return word[0].toUpperCase() + 'xxxx';
  }

  // Fallback for "First Last" format - keep first word, mask others
  return words
    .map((word, index) => {
      if (index === 0) return word; // Keep first name
      return word[0].toUpperCase() + 'xxxx'; // Mask surnames/middle names
    })
    .join(' ');
}
