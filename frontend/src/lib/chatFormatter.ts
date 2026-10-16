/**
 * Client-side Minecraft & ANSI chat cleaner & renderer
 * Transforms any raw ANSI codes, section codes (§), and RGB escapes into in-game styled HTML.
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

const ANSI_COLORS: Record<string, string> = {
  '30': '#000000',
  '31': '#AA0000',
  '32': '#00AA00',
  '33': '#FFAA00',
  '34': '#0000AA',
  '35': '#AA00AA',
  '36': '#00AAAA',
  '37': '#AAAAAA',
  '90': '#555555',
  '91': '#FF5555',
  '92': '#55FF55',
  '93': '#FFFF55',
  '94': '#5555FF',
  '95': '#FF55FF',
  '96': '#55FFFF',
  '97': '#FFFFFF',
};

export function cleanMinecraftChatHtml(rawHtmlOrText: string): string {
  if (!rawHtmlOrText) return '';

  let text = rawHtmlOrText;

  // 1. Convert Minecraft 1.16+ hex colors: §x§r§r§g§g§b§b
  text = text.replace(/§x§([0-9a-fA-F])§([0-9a-fA-F])§([0-9a-fA-F])§([0-9a-fA-F])§([0-9a-fA-F])§([0-9a-fA-F])/gi,
    (_, r1, r2, g1, g2, b1, b2) => `</span><span style="color:#${r1}${r2}${g1}${g2}${b1}${b2}">`
  );

  // 2. Convert standard Minecraft section codes (§0 - §f)
  text = text.replace(/§([0-9a-fA-F])/g, (_, code) => {
    const c = MINECRAFT_COLORS[code.toLowerCase()] || '#FFFFFF';
    return `</span><span style="color:${c}">`;
  });

  // Minecraft text styles
  text = text.replace(/§l/gi, '<span style="font-weight:bold">');
  text = text.replace(/§o/gi, '<span style="font-style:italic">');
  text = text.replace(/§n/gi, '<span style="text-decoration:underline">');
  text = text.replace(/§m/gi, '<span style="text-decoration:line-through">');
  text = text.replace(/§[rk]/gi, '</span>');

  // 3. Convert 24-bit Truecolor ANSI: \x1b[38;2;R;G;Bm or [38;2;R;G;Bm or □[38;2;...
  text = text.replace(/(?:\x1b|\u001b|□)?\[38;2;(\d+);(\d+);(\d+)m/g, (_, r, g, b) => {
    return `</span><span style="color:rgb(${r},${g},${b})">`;
  });

  // 4. Convert standard ANSI colors: \x1b[30m - \x1b[37m, \x1b[90m - \x1b[97m
  text = text.replace(/(?:\x1b|\u001b|□)?\[(3[0-7]|9[0-7])m/g, (_, code) => {
    const c = ANSI_COLORS[code] || '#FFFFFF';
    return `</span><span style="color:${c}">`;
  });

  // 5. ANSI formatting & reset
  text = text.replace(/(?:\x1b|\u001b|□)?\[1m/g, '<span style="font-weight:bold">');
  text = text.replace(/(?:\x1b|\u001b|□)?\[3m/g, '<span style="font-style:italic">');
  text = text.replace(/(?:\x1b|\u001b|□)?\[4m/g, '<span style="text-decoration:underline">');
  text = text.replace(/(?:\x1b|\u001b|□)?\[0?m/g, '</span>');

  // 6. Strip any residual unparsed brackets like [0m, [38;2;...m, [97m
  text = text.replace(/(?:\x1b|\u001b|□)?\[\d+(?:;\d+)*m/g, '');
  text = text.replace(/[\x00-\x08\x0B-\x1F\x7F\uFFFD]/g, '');

  return text;
}
