// Minimal JSONLogic-like evaluator (supports: if, var, and, or, >, <, >=, <=, ==, !=)
export function evaluateLogic(expr, data = {}) {
  if (expr == null || typeof expr !== 'object') return expr;

  const op = Object.keys(expr)[0];
  const val = expr[op];

  const evalAny = v => (typeof v === 'object' ? evaluateLogic(v, data) : v);

  switch (op) {
    case 'var': {
      // { "var": "gpa" } or { "var": ["gpa", 0] }
      if (Array.isArray(val)) return data[val[0]] ?? val[1];
      return data[val];
    }
    case 'if': {
      // { "if": [cond, then, else] } or nested cascades
      for (let i = 0; i < val.length - 1; i += 2) {
        if (evaluateLogic(val[i], data)) return evaluateLogic(val[i + 1], data);
      }
      return evaluateLogic(val[val.length - 1], data);
    }
    case 'and': return val.every(v => !!evaluateLogic(v, data));
    case 'or':  return val.some(v => !!evaluateLogic(v, data));
    case '>':   return evalAny(val[0]) >  evalAny(val[1]);
    case '<':   return evalAny(val[0]) <  evalAny(val[1]);
    case '>=':  return evalAny(val[0]) >= evalAny(val[1]);
    case '<=':  return evalAny(val[0]) <= evalAny(val[1]);
    case '==':  return evalAny(val[0]) == evalAny(val[1]); // loose by design here
    case '!=':  return evalAny(val[0]) != evalAny(val[1]);
    default:    return expr; // unhandled ops fall through
  }
}
