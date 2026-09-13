/**
 * Safe Mathematical and Logical Expression Engine for Calculated Columns.
 * Strictly avoids eval(), new Function(), or arbitrary JS execution.
 * Built using AST parsing and deterministic safe evaluation.
 */

export type TokenType =
  | 'NUMBER'
  | 'STRING'
  | 'IDENTIFIER'
  | 'OPERATOR'
  | 'LPAREN'
  | 'RPAREN'
  | 'COMMA'
  | 'EOF';

export interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

export interface ASTNode {
  type: 'Literal' | 'ColumnRef' | 'BinaryOp' | 'UnaryOp' | 'FunctionCall';
  value?: unknown;
  name?: string;
  operator?: string;
  left?: ASTNode;
  right?: ASTNode;
  argument?: ASTNode;
  args?: ASTNode[];
}

export class ExpressionEngine {
  /**
   * Tokenizes an expression string
   */
  public static tokenize(expr: string): Token[] {
    const tokens: Token[] = [];
    let i = 0;
    const len = expr.length;

    while (i < len) {
      const ch = expr[i];

      // Skip whitespace
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // Column reference in square brackets [Column Name]
      if (ch === '[') {
        const start = i;
        i++;
        let colName = '';
        while (i < len && expr[i] !== ']') {
          colName += expr[i];
          i++;
        }
        if (i < len && expr[i] === ']') {
          i++; // skip ']'
        }
        tokens.push({ type: 'IDENTIFIER', value: colName, pos: start });
        continue;
      }

      // String literal "..." or '...'
      if (ch === '"' || ch === "'") {
        const quote = ch;
        const start = i;
        i++;
        let str = '';
        while (i < len && expr[i] !== quote) {
          if (expr[i] === '\\' && i + 1 < len) {
            i++;
            str += expr[i];
          } else {
            str += expr[i];
          }
          i++;
        }
        if (i < len && expr[i] === quote) {
          i++;
        }
        tokens.push({ type: 'STRING', value: str, pos: start });
        continue;
      }

      // Number literal
      if (/[0-9]/.test(ch) || (ch === '.' && i + 1 < len && /[0-9]/.test(expr[i + 1]))) {
        const start = i;
        let numStr = '';
        while (i < len && (/[0-9]/.test(expr[i]) || expr[i] === '.')) {
          numStr += expr[i];
          i++;
        }
        tokens.push({ type: 'NUMBER', value: numStr, pos: start });
        continue;
      }

      // Multi-character operators
      const twoChar = expr.slice(i, i + 2);
      if (['==', '!=', '<=', '>=', '&&', '||', '<>'].includes(twoChar)) {
        let op = twoChar;
        if (op === '<>') op = '!=';
        tokens.push({ type: 'OPERATOR', value: op, pos: i });
        i += 2;
        continue;
      }

      // Single-character operators
      if (['+', '-', '*', '/', '%', '^', '<', '>', '=', '!'].includes(ch)) {
        let op = ch;
        if (op === '=') op = '==';
        tokens.push({ type: 'OPERATOR', value: op, pos: i });
        i++;
        continue;
      }

      // Parentheses & comma
      if (ch === '(') {
        tokens.push({ type: 'LPAREN', value: '(', pos: i });
        i++;
        continue;
      }
      if (ch === ')') {
        tokens.push({ type: 'RPAREN', value: ')', pos: i });
        i++;
        continue;
      }
      if (ch === ',') {
        tokens.push({ type: 'COMMA', value: ',', pos: i });
        i++;
        continue;
      }

      // Word Identifiers (Column names, keywords, functions)
      if (/[a-zA-Z_]/.test(ch)) {
        const start = i;
        let word = '';
        while (i < len && /[a-zA-Z0-9_]/.test(expr[i])) {
          word += expr[i];
          i++;
        }

        const upper = word.toUpperCase();
        if (upper === 'AND') {
          tokens.push({ type: 'OPERATOR', value: '&&', pos: start });
        } else if (upper === 'OR') {
          tokens.push({ type: 'OPERATOR', value: '||', pos: start });
        } else if (upper === 'NOT') {
          tokens.push({ type: 'OPERATOR', value: '!', pos: start });
        } else if (upper === 'TRUE') {
          tokens.push({ type: 'NUMBER', value: '1', pos: start });
        } else if (upper === 'FALSE') {
          tokens.push({ type: 'NUMBER', value: '0', pos: start });
        } else if (upper === 'NULL') {
          tokens.push({ type: 'STRING', value: '__NULL__', pos: start });
        } else {
          tokens.push({ type: 'IDENTIFIER', value: word, pos: start });
        }
        continue;
      }

      // Unknown character, skip
      i++;
    }

    tokens.push({ type: 'EOF', value: '', pos: len });
    return tokens;
  }

  /**
   * Parses token stream into an AST
   */
  public static parse(expr: string): ASTNode {
    const tokens = this.tokenize(expr);
    let idx = 0;

    function peek(): Token {
      return tokens[idx] || { type: 'EOF', value: '', pos: 0 };
    }

    function consume(type?: TokenType): Token {
      const tok = peek();
      if (type && tok.type !== type) {
        throw new Error(`Expected token ${type} at position ${tok.pos} but got ${tok.type} ('${tok.value}')`);
      }
      idx++;
      return tok;
    }

    // Grammar precedence:
    // expression -> logicalOr
    // logicalOr  -> logicalAnd ('||' logicalAnd)*
    // logicalAnd -> equality ('&&' equality)*
    // equality   -> relational (('==' | '!=') relational)*
    // relational -> additive (('<' | '<=' | '>' | '>=') additive)*
    // additive   -> multiplicative (('+' | '-') multiplicative)*
    // multiplicative -> power (('*' | '/' | '%') power)*
    // power      -> unary ('^' unary)*
    // unary      -> ('-' | '+' | '!') unary | primary
    // primary    -> NUMBER | STRING | IDENTIFIER ('(' args ')')? | '(' expression ')'

    function parseExpression(): ASTNode {
      return parseLogicalOr();
    }

    function parseLogicalOr(): ASTNode {
      let node = parseLogicalAnd();
      while (peek().type === 'OPERATOR' && peek().value === '||') {
        const op = consume().value;
        const right = parseLogicalAnd();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      }
      return node;
    }

    function parseLogicalAnd(): ASTNode {
      let node = parseEquality();
      while (peek().type === 'OPERATOR' && peek().value === '&&') {
        const op = consume().value;
        const right = parseEquality();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      }
      return node;
    }

    function parseEquality(): ASTNode {
      let node = parseRelational();
      while (peek().type === 'OPERATOR' && (peek().value === '==' || peek().value === '!=')) {
        const op = consume().value;
        const right = parseRelational();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      }
      return node;
    }

    function parseRelational(): ASTNode {
      let node = parseAdditive();
      while (peek().type === 'OPERATOR' && ['<', '<=', '>', '>='].includes(peek().value)) {
        const op = consume().value;
        const right = parseAdditive();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      }
      return node;
    }

    function parseAdditive(): ASTNode {
      let node = parseMultiplicative();
      while (peek().type === 'OPERATOR' && (peek().value === '+' || peek().value === '-')) {
        const op = consume().value;
        const right = parseMultiplicative();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      }
      return node;
    }

    function parseMultiplicative(): ASTNode {
      let node = parsePower();
      while (peek().type === 'OPERATOR' && ['*', '/', '%'].includes(peek().value)) {
        const op = consume().value;
        const right = parsePower();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      }
      return node;
    }

    function parsePower(): ASTNode {
      let node = parseUnary();
      while (peek().type === 'OPERATOR' && peek().value === '^') {
        const op = consume().value;
        const right = parseUnary();
        node = { type: 'BinaryOp', operator: op, left: node, right };
      }
      return node;
    }

    function parseUnary(): ASTNode {
      if (peek().type === 'OPERATOR' && ['-', '+', '!'].includes(peek().value)) {
        const op = consume().value;
        const arg = parseUnary();
        return { type: 'UnaryOp', operator: op, argument: arg };
      }
      return parsePrimary();
    }

    function parsePrimary(): ASTNode {
      const tok = peek();

      if (tok.type === 'NUMBER') {
        consume();
        return { type: 'Literal', value: parseFloat(tok.value) };
      }

      if (tok.type === 'STRING') {
        consume();
        if (tok.value === '__NULL__') {
          return { type: 'Literal', value: null };
        }
        return { type: 'Literal', value: tok.value };
      }

      if (tok.type === 'IDENTIFIER') {
        consume();
        // Check if function call
        if (peek().type === 'LPAREN') {
          consume('LPAREN');
          const args: ASTNode[] = [];
          if (peek().type !== 'RPAREN') {
            args.push(parseExpression());
            while (peek().type === 'COMMA') {
              consume('COMMA');
              args.push(parseExpression());
            }
          }
          consume('RPAREN');
          return { type: 'FunctionCall', name: tok.value.toUpperCase(), args };
        }
        // Column reference
        return { type: 'ColumnRef', name: tok.value };
      }

      if (tok.type === 'LPAREN') {
        consume('LPAREN');
        const expr = parseExpression();
        consume('RPAREN');
        return expr;
      }

      throw new Error(`Unexpected token at position ${tok.pos}: '${tok.value}'`);
    }

    const ast = parseExpression();
    if (peek().type !== 'EOF') {
      throw new Error(`Unexpected trailing content at position ${peek().pos}: '${peek().value}'`);
    }
    return ast;
  }

  /**
   * Evaluates an AST against a row object safely
   */
  public static evaluate(ast: ASTNode, row: Record<string, unknown>): unknown {
    switch (ast.type) {
      case 'Literal':
        return ast.value;

      case 'ColumnRef': {
        const colName = ast.name || '';
        // Look up column case-insensitively if exact not found
        if (colName in row) {
          return row[colName];
        }
        const lower = colName.toLowerCase();
        for (const [k, v] of Object.entries(row)) {
          if (k.toLowerCase() === lower) return v;
        }
        return null;
      }

      case 'UnaryOp': {
        const val = this.evaluate(ast.argument!, row);
        if (ast.operator === '-') {
          const num = Number(val);
          return isNaN(num) ? null : -num;
        }
        if (ast.operator === '+') {
          const num = Number(val);
          return isNaN(num) ? null : num;
        }
        if (ast.operator === '!') {
          return !val;
        }
        return null;
      }

      case 'BinaryOp': {
        const leftVal = this.evaluate(ast.left!, row);
        const rightVal = this.evaluate(ast.right!, row);

        const op = ast.operator;

        if (op === '&&') {
          return Boolean(leftVal && rightVal);
        }
        if (op === '||') {
          return Boolean(leftVal || rightVal);
        }

        // Comparison operators
        if (op === '==') {
          return leftVal == rightVal;
        }
        if (op === '!=') {
          return leftVal != rightVal;
        }

        // Numeric / string order comparisons
        if (['<', '<=', '>', '>='].includes(op || '')) {
          if (leftVal === null || leftVal === undefined || rightVal === null || rightVal === undefined) {
            return false;
          }
          const n1 = typeof leftVal === 'number' ? leftVal : Number(leftVal);
          const n2 = typeof rightVal === 'number' ? rightVal : Number(rightVal);
          if (!isNaN(n1) && !isNaN(n2)) {
            if (op === '<') return n1 < n2;
            if (op === '<=') return n1 <= n2;
            if (op === '>') return n1 > n2;
            if (op === '>=') return n1 >= n2;
          }
          // String fallback
          const s1 = String(leftVal);
          const s2 = String(rightVal);
          if (op === '<') return s1 < s2;
          if (op === '<=') return s1 <= s2;
          if (op === '>') return s1 > s2;
          if (op === '>=') return s1 >= s2;
        }

        // String concatenation with +
        if (op === '+' && (typeof leftVal === 'string' || typeof rightVal === 'string')) {
          const s1 = leftVal === null || leftVal === undefined ? '' : String(leftVal);
          const s2 = rightVal === null || rightVal === undefined ? '' : String(rightVal);
          return s1 + s2;
        }

        // Numeric arithmetic
        const num1 = leftVal === null || leftVal === undefined ? 0 : Number(leftVal);
        const num2 = rightVal === null || rightVal === undefined ? 0 : Number(rightVal);

        if (isNaN(num1) || isNaN(num2)) {
          return null;
        }

        switch (op) {
          case '+':
            return num1 + num2;
          case '-':
            return num1 - num2;
          case '*':
            return num1 * num2;
          case '/':
            // Division by zero safety: returns null rather than throwing
            if (num2 === 0) return null;
            return num1 / num2;
          case '%':
            if (num2 === 0) return null;
            return num1 % num2;
          case '^':
            return Math.pow(num1, num2);
        }

        return null;
      }

      case 'FunctionCall': {
        const fnName = ast.name || '';
        const evaluatedArgs = (ast.args || []).map(a => this.evaluate(a, row));

        switch (fnName) {
          case 'IF': {
            const cond = Boolean(evaluatedArgs[0]);
            return cond ? evaluatedArgs[1] : (evaluatedArgs[2] ?? null);
          }
          case 'ROUND': {
            const num = Number(evaluatedArgs[0]);
            if (isNaN(num)) return null;
            const decimals = evaluatedArgs[1] !== undefined ? Number(evaluatedArgs[1]) : 0;
            const factor = Math.pow(10, Math.max(0, isNaN(decimals) ? 0 : decimals));
            return Math.round(num * factor) / factor;
          }
          case 'ABS': {
            const num = Number(evaluatedArgs[0]);
            return isNaN(num) ? null : Math.abs(num);
          }
          case 'CEIL':
          case 'CEILING': {
            const num = Number(evaluatedArgs[0]);
            return isNaN(num) ? null : Math.ceil(num);
          }
          case 'FLOOR': {
            const num = Number(evaluatedArgs[0]);
            return isNaN(num) ? null : Math.floor(num);
          }
          case 'SQRT': {
            const num = Number(evaluatedArgs[0]);
            return isNaN(num) || num < 0 ? null : Math.sqrt(num);
          }
          case 'MIN': {
            const nums = evaluatedArgs.map(Number).filter(n => !isNaN(n));
            return nums.length > 0 ? Math.min(...nums) : null;
          }
          case 'MAX': {
            const nums = evaluatedArgs.map(Number).filter(n => !isNaN(n));
            return nums.length > 0 ? Math.max(...nums) : null;
          }
          case 'COALESCE': {
            for (const v of evaluatedArgs) {
              if (v !== null && v !== undefined && v !== '') return v;
            }
            return null;
          }
          case 'CONCAT': {
            return evaluatedArgs
              .map(v => (v === null || v === undefined ? '' : String(v)))
              .join('');
          }
          case 'UPPER': {
            const v = evaluatedArgs[0];
            return v === null || v === undefined ? null : String(v).toUpperCase();
          }
          case 'LOWER': {
            const v = evaluatedArgs[0];
            return v === null || v === undefined ? null : String(v).toLowerCase();
          }
          case 'TRIM': {
            const v = evaluatedArgs[0];
            return v === null || v === undefined ? null : String(v).trim();
          }
          case 'LENGTH':
          case 'LEN': {
            const v = evaluatedArgs[0];
            return v === null || v === undefined ? 0 : String(v).length;
          }
          default:
            throw new Error(`Unsupported function: '${fnName}'`);
        }
      }

      default:
        return null;
    }
  }

  /**
   * Validates expression and extracts referenced column names
   */
  public static validate(
    expr: string,
    availableColumns: string[]
  ): { valid: boolean; error?: string; referencedColumns: string[]; ast?: ASTNode } {
    if (!expr || !expr.trim()) {
      return { valid: false, error: 'Expression cannot be empty.', referencedColumns: [] };
    }

    try {
      const ast = this.parse(expr);
      const referencedCols: string[] = [];
      const lowerCols = new Set(availableColumns.map(c => c.toLowerCase()));

      function traverse(node: ASTNode) {
        if (node.type === 'ColumnRef' && node.name) {
          referencedCols.push(node.name);
          if (!lowerCols.has(node.name.toLowerCase())) {
            // Not a fatal syntax error if column might exist, but note it
          }
        }
        if (node.left) traverse(node.left);
        if (node.right) traverse(node.right);
        if (node.argument) traverse(node.argument);
        if (node.args) node.args.forEach(traverse);
      }

      traverse(ast);

      // Verify that all referenced columns exist
      const missing = referencedCols.filter(col => !lowerCols.has(col.toLowerCase()));
      if (missing.length > 0) {
        return {
          valid: false,
          error: `Unknown column(s): ${missing.map(m => `"${m}"`).join(', ')}`,
          referencedColumns: referencedCols,
          ast
        };
      }

      return { valid: true, referencedColumns: referencedCols, ast };
    } catch (err: any) {
      return { valid: false, error: err.message || 'Invalid formula expression syntax.', referencedColumns: [] };
    }
  }
}
