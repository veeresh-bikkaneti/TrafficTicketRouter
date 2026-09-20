// Minimal YAML-subset parser for TicketRouter data files. Zero dependencies.
// Supports exactly what data/states/*.yaml uses:
//   - `#` full-line comments and trailing ` #` comments (not inside quotes)
//   - nested mappings via 2-space indentation
//   - sequences with `- ` items (scalars or inline `- key: value` maps)
//   - plain, single-quoted, and double-quoted scalars
//   - null via empty value, `null`, or `~`; booleans true/false; integers
// Anything fancier (anchors, flow syntax, block scalars) is a parse error —
// keep data files simple. validate.mjs uses this same parser.

function stripComment(line) {
  let inS = false, inD = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === "'" && !inD) inS = !inS;
    else if (c === '"' && !inS) inD = !inD;
    else if (c === '#' && !inS && !inD && (i === 0 || line[i - 1] === ' ' || line[i - 1] === '\t')) {
      return line.slice(0, i);
    }
  }
  return line;
}

function parseScalar(raw) {
  const s = raw.trim();
  if (s === '' || s === 'null' || s === '~') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (/^-?\d+$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    const inner = s.slice(1, -1);
    return s[0] === '"' ? inner.replace(/\\"/g, '"').replace(/\\\\/g, '\\') : inner;
  }
  if (/[{}\[\]&*!|>@`]/.test(s[0])) throw new Error(`unsupported YAML syntax near: ${s}`);
  return s;
}

export function parseYAML(text) {
  const rawLines = text.split('\n');
  const lines = [];
  for (const raw of rawLines) {
    const noComment = stripComment(raw);
    if (noComment.trim() === '') continue;
    const lead = noComment.match(/^\s*/)[0];
    if (lead.includes('\t')) throw new Error(`tab indentation is not allowed near: ${noComment.trim()}`);
    const indent = lead.length;
    if (indent % 2 !== 0) throw new Error(`odd indentation (${indent}) near: ${noComment.trim()}`);
    lines.push({ indent, text: noComment.trim() });
  }
  let pos = 0;

  function peek() { return lines[pos]; }

  function parseBlock(minIndent) {
    const first = peek();
    if (!first || first.indent < minIndent) return undefined;
    if (first.text.startsWith('- ') || first.text === '-') {
      return parseSeq(minIndent);
    }
    return parseMap(minIndent);
  }

  function parseMap(indent) {
    const obj = {};
    while (peek() && peek().indent === indent && !peek().text.startsWith('- ')) {
      const line = lines[pos++].text;
      const m = line.match(/^([^:]+):(.*)$/);
      if (!m) throw new Error(`expected key: value near: ${line}`);
      const key = m[1].trim();
      const rest = m[2].trim();
      if (key === '') throw new Error(`empty key near: ${line}`);
      if (key in obj) throw new Error(`duplicate key "${key}" near: ${line}`);
      if (rest !== '') {
        obj[key] = parseScalar(rest);
      } else {
        const child = peek();
        if (child && child.indent > indent) {
          obj[key] = parseBlock(child.indent);
        } else {
          obj[key] = null;
        }
      }
    }
    return obj;
  }

  function parseSeq(indent) {
    const arr = [];
    while (peek() && peek().indent === indent && (peek().text.startsWith('- ') || peek().text === '-')) {
      const line = lines[pos++].text;
      const rest = line === '-' ? '' : line.slice(2).trim();
      if (rest === '') {
        const child = peek();
        arr.push(child && child.indent > indent ? parseBlock(child.indent) : null);
      } else if (rest.length > 1 && /^(['"])/.test(rest) && rest.endsWith(rest[0])) {
        // fully quoted scalar, even if it contains ": " inside
        arr.push(parseScalar(rest));
      } else if (/^[^:]+:(\s|$)/.test(rest)) {
        // inline map entry: "- key: value" possibly followed by more indented keys
        const m = rest.match(/^([^:]+):(.*)$/);
        const firstKey = m[1].trim();
        const obj = { [firstKey]: parseScalar(m[2].trim()) };
        const child = peek();
        if (child && child.indent > indent) {
          const more = parseMap(child.indent);
          for (const k of Object.keys(more)) {
            if (k in obj) throw new Error(`duplicate key "${k}" near: ${line}`);
          }
          Object.assign(obj, more);
        }
        arr.push(obj);
      } else {
        arr.push(parseScalar(rest));
      }
    }
    return arr;
  }

  const result = parseBlock(0);
  if (pos < lines.length) throw new Error(`unexpected content near: ${lines[pos].text}`);
  return result === undefined ? null : result;
}
