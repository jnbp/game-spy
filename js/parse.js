// Parses the text of a location pack: one location per line.
// Format:  🛒 Supermarkt: Kassiererin, Kunde, Filialleiter   (emoji, name, colon, comma-separated roles)
// Empty lines and lines starting with # are ignored.
(function (global) {
  function parse(text) {
    const places = [];
    const problems = [];
    String(text || '').split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const colon = line.indexOf(':');
      const head = (colon === -1 ? line : line.slice(0, colon)).trim();
      const roles = colon === -1 ? [] : line.slice(colon + 1).split(',').map((r) => r.trim()).filter(Boolean);
      const space = head.indexOf(' ');
      const first = space === -1 ? head : head.slice(0, space);
      const hasEmoji = space !== -1 && (/\p{Extended_Pictographic}/u.test(first) || !/[\p{L}\p{N}]/u.test(first));
      const emoji = hasEmoji ? first : '';
      const name = (hasEmoji ? head.slice(space + 1) : head).trim();
      if (!name) { problems.push(`Line ${i + 1}: missing location name`); return; }
      if (colon === -1) problems.push(`Line ${i + 1}: "${name}" has no roles (missing colon)`);
      places.push({ name, emoji, roles });
    });
    return { places, problems };
  }
  global.SpyParse = parse;
})(typeof window !== 'undefined' ? window : globalThis);
