const fs = require('fs');
const path = './server/api/connectionRoutes.ts';

let code = fs.readFileSync(path, 'utf8');

const oldFunc = `function validateConnectionInput(body: any): { isValid: boolean; error?: string; params?: DatabaseConnectionParams } {
  const { type, host, port, database, username, password, ssl } = body;

  if (!host || typeof host !== 'string' || !host.trim()) {
    return { isValid: false, error: 'Database host is required.' };
  }
  if (!database || typeof database !== 'string' || !database.trim()) {
    return { isValid: false, error: 'Database name is required.' };
  }
  if (!username || typeof username !== 'string' || !username.trim()) {
    return { isValid: false, error: 'Database username is required.' };
  }

  const cleanHost = host.trim();
  const cleanDb = database.trim();
  const cleanUser = username.trim();

  if (cleanHost.length > 255) {
    return { isValid: false, error: 'Host name exceeds 255 characters.' };
  }
  if (cleanDb.length > 128) {
    return { isValid: false, error: 'Database name exceeds 128 characters.' };
  }
  if (cleanUser.length > 128) {
    return { isValid: false, error: 'Username exceeds 128 characters.' };
  }

  const parsedPort = Number(port);
  const cleanPort = isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535 ? 5432 : parsedPort;

  return {
    isValid: true,
    params: {
      type: type || 'postgresql',
      host: cleanHost,
      port: cleanPort,
      database: cleanDb,
      username: cleanUser,
      password: password !== undefined ? String(password) : '',
      ssl: Boolean(ssl)
    }
  };
}`;

const newFunc = `function validateConnectionInput(body: any): { isValid: boolean; error?: string; params?: DatabaseConnectionParams } {
  const { type, host, port, database, username, password, ssl, filePath } = body;
  const resolvedType = type || 'postgresql';

  if (resolvedType === 'sqlite') {
    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) {
      return { isValid: false, error: 'SQLite connection requires a filePath.' };
    }
    return {
      isValid: true,
      params: {
        type: resolvedType,
        filePath: filePath.trim()
      }
    };
  }

  if (!host || typeof host !== 'string' || !host.trim()) {
    return { isValid: false, error: 'Database host is required.' };
  }
  if (!database || typeof database !== 'string' || !database.trim()) {
    return { isValid: false, error: 'Database name is required.' };
  }
  if (!username || typeof username !== 'string' || !username.trim()) {
    return { isValid: false, error: 'Database username is required.' };
  }

  const cleanHost = host.trim();
  const cleanDb = database.trim();
  const cleanUser = username.trim();

  if (cleanHost.length > 255) {
    return { isValid: false, error: 'Host name exceeds 255 characters.' };
  }
  if (cleanDb.length > 128) {
    return { isValid: false, error: 'Database name exceeds 128 characters.' };
  }
  if (cleanUser.length > 128) {
    return { isValid: false, error: 'Username exceeds 128 characters.' };
  }

  const parsedPort = Number(port);
  const cleanPort = isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535 ? 5432 : parsedPort;

  return {
    isValid: true,
    params: {
      type: resolvedType,
      host: cleanHost,
      port: cleanPort,
      database: cleanDb,
      username: cleanUser,
      password: password !== undefined ? String(password) : '',
      ssl: Boolean(ssl)
    }
  };
}`;

code = code.replace(oldFunc, newFunc);
fs.writeFileSync(path, code);
console.log('Fixed validateConnectionInput');
