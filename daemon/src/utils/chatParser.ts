/**
 * Minecraft chat color and formatting code parser
 */

export const MINECRAFT_COLORS: Record<string, string> = {
  '0': '#000000', // Black
  '1': '#0000AA', // Dark Blue
  '2': '#00AA00', // Dark Green
  '3': '#00AAAA', // Dark Aqua
  '4': '#AA0000', // Dark Red
  '5': '#AA00AA', // Dark Purple
  '6': '#FFAA00', // Gold
  '7': '#AAAAAA', // Gray
  '8': '#555555', // Dark Gray
  '9': '#5555FF', // Blue
  'a': '#55FF55', // Green
  'b': '#55FFFF', // Aqua
  'c': '#FF5555', // Red
  'd': '#FF55FF', // Light Purple
  'e': '#FFFF55', // Yellow
  'f': '#FFFFFF', // White
};

export function stripMinecraftCodes(str: string): string {
  if (!str) return '';
  return str.replace(/§[0-9a-fk-or]/gi, '');
}

/**
 * Converts Minecraft string with section symbols (§) into HTML spans with CSS colors
 */
export function minecraftToHtml(str: string): string {
  if (!str) return '';
  
  let result = '';
  let currentColor = '#FFFFFF';
  let isBold = false;
  let isItalic = false;
  let isUnderline = false;
  let isStrikethrough = false;
  
  const tokens = str.split(/(§[0-9a-fk-or])/gi);
  
  for (const token of tokens) {
    if (!token) continue;
    
    if (token.startsWith('§')) {
      const code = token.charAt(1).toLowerCase();
      if (MINECRAFT_COLORS[code]) {
        currentColor = MINECRAFT_COLORS[code];
        isBold = false;
        isItalic = false;
        isUnderline = false;
        isStrikethrough = false;
      } else if (code === 'l') {
        isBold = true;
      } else if (code === 'o') {
        isItalic = true;
      } else if (code === 'n') {
        isUnderline = true;
      } else if (code === 'm') {
        isStrikethrough = true;
      } else if (code === 'r') {
        currentColor = '#FFFFFF';
        isBold = false;
        isItalic = false;
        isUnderline = false;
        isStrikethrough = false;
      }
      continue;
    }
    
    // Regular text segment
    const styles: string[] = [`color: ${currentColor}`];
    if (isBold) styles.push('font-weight: bold');
    if (isItalic) styles.push('font-style: italic');
    if (isUnderline && isStrikethrough) {
      styles.push('text-decoration: underline line-through');
    } else if (isUnderline) {
      styles.push('text-decoration: underline');
    } else if (isStrikethrough) {
      styles.push('text-decoration: line-through');
    }
    
    // Escape HTML characters
    const escaped = token
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
      
    result += `<span style="${styles.join('; ')}">${escaped}</span>`;
  }
  
  return result;
}
