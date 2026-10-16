/**
 * Client-side Minecraft & ANSI chat cleaner & renderer
 * Transforms any raw ANSI codes, section codes (§), and RGB escapes into in-game styled HTML.
 */

export const MINECRAFT_COLORS: Record<string, string> = {
  '0': '#0f172a', // Black -> dark slate
  '1': '#1e3a8a', // Dark Blue
  '2': '#15803d', // Dark Green
  '3': '#0e7490', // Dark Aqua
  '4': '#b91c1c', // Dark Red
  '5': '#7e22ce', // Dark Purple
  '6': '#d97706', // Gold / Orange
  '7': '#64748b', // Gray
  '8': '#475569', // Dark Gray
  '9': '#2563eb', // Blue
  'a': '#16a34a', // Bright Green
  'b': '#0284c7', // Aqua
  'c': '#dc2626', // Red
  'd': '#c026d3', // Light Purple / Pink
  'e': '#ca8a04', // Yellow -> rich amber
  'f': '#1e293b', // White -> dark slate for light mode
};

function adjustHexForLightMode(hex: string): string {
  try {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    // If it's pure white or very light gray
    if (r > 210 && g > 210 && b > 210) {
      return '#0f172a';
    }
    // If it's overly bright neon on white, darken slightly for high contrast
    if (brightness > 200) {
      const factor = 0.75;
      const nr = Math.floor(r * factor).toString(16).padStart(2, '0');
      const ng = Math.floor(g * factor).toString(16).padStart(2, '0');
      const nb = Math.floor(b * factor).toString(16).padStart(2, '0');
      return `#${nr}${ng}${nb}`;
    }
  } catch (e) {}
  return `#${hex}`;
}

const ANSI_COLORS: Record<string, string> = {
  '30': '#0f172a',
  '31': '#dc2626',
  '32': '#16a34a',
  '33': '#d97706',
  '34': '#2563eb',
  '35': '#7e22ce',
  '36': '#0284c7',
  '37': '#64748b',
  '90': '#475569',
  '91': '#ef4444',
  '92': '#22c55e',
  '93': '#eab308',
  '94': '#3b82f6',
  '95': '#d946ef',
  '96': '#06b6d4',
  '97': '#1e293b',
};

export function cleanMinecraftChatHtml(rawHtmlOrText: string): string {
  if (!rawHtmlOrText) return '';

  let text = rawHtmlOrText;

  // 1. Convert modern hex color codes: §#RRGGBB or &#RRGGBB
  text = text.replace(/(?:§|&)#([0-9a-fA-F]{6})/gi, (_, hex) => {
    const c = adjustHexForLightMode(hex);
    return `</span><span style="color:${c};font-weight:600">`;
  });

  // 2. Convert bracketed hex tags like [#3C8AFFLOL] or [#FFE81ET1]
  text = text.replace(/\[#([0-9a-fA-F]{6})([^\]]*)\]/gi, (_, hex, content) => {
    const c = adjustHexForLightMode(hex);
    return `<span style="color:${c};font-weight:700">[${content}]</span>`;
  });

  // 3. Convert Minecraft 1.16+ hex colors: §x§r§r§g§g§b§b
  text = text.replace(/§x§([0-9a-fA-F])§([0-9a-fA-F])§([0-9a-fA-F])§([0-9a-fA-F])§([0-9a-fA-F])§([0-9a-fA-F])/gi,
    (_, r1, r2, g1, g2, b1, b2) => {
      const hex = `${r1}${r2}${g1}${g2}${b1}${b2}`;
      const c = adjustHexForLightMode(hex);
      return `</span><span style="color:${c}">`;
    }
  );

  // 4. Convert standard Minecraft section codes (§0 - §f)
  text = text.replace(/§([0-9a-fA-F])/g, (_, code) => {
    const c = MINECRAFT_COLORS[code.toLowerCase()] || '#1e293b';
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
