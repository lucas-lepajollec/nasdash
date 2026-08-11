// src/lib/logger.ts

const COLORS = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  underscore: "\x1b[4m",
  blink: "\x1b[5m",
  reverse: "\x1b[7m",
  hidden: "\x1b[8m",

  fg: {
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
    gray: "\x1b[90m",
  },
  bg: {
    black: "\x1b[40m",
    red: "\x1b[41m",
    green: "\x1b[42m",
    yellow: "\x1b[43m",
    blue: "\x1b[44m",
    magenta: "\x1b[45m",
    cyan: "\x1b[46m",
    white: "\x1b[47m",
  }
};

const getTimestamp = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
};

const formatMessage = (level: string, color: string, ...args: unknown[]) => {
  const timestamp = `${COLORS.dim}[${getTimestamp()}]${COLORS.reset}`;
  const prefix = `${color}${COLORS.bright}[NASDASH] [${level}]${COLORS.reset}`;
  
  // Format objects using util.inspect if running in Node
  const formattedArgs = args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2);
      } catch {
        return String(arg);
      }
    }
    return String(arg);
  });

  return `${timestamp} ${prefix} ${formattedArgs.join(' ')}`;
};

class Logger {
  private originalConsole = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };

  private isInitialized = false;

  public init() {
    if (typeof window !== 'undefined' || this.isInitialized) return;
    this.isInitialized = true;

    // Override console methods
    console.log = (...args) => {
      // Ignore next.js dev server spam if we want, or keep it
      if (typeof args[0] === 'string' && args[0].includes('Fast Refresh')) return;
      this.originalConsole.log(formatMessage('INFO', COLORS.fg.cyan, ...args));
    };

    console.info = (...args) => {
      this.originalConsole.info(formatMessage('INFO', COLORS.fg.blue, ...args));
    };

    console.warn = (...args) => {
      this.originalConsole.warn(formatMessage('WARN', COLORS.fg.yellow, ...args));
    };

    console.error = (...args) => {
      this.originalConsole.error(formatMessage('ERROR', COLORS.fg.red, ...args));
    };

    console.debug = (...args) => {
      this.originalConsole.debug(formatMessage('DEBUG', COLORS.fg.magenta, ...args));
    };

    const runtimeProcess = typeof process !== 'undefined' ? process : null;
    const stdout = runtimeProcess
      ? Reflect.get(runtimeProcess, 'stdout') as NodeJS.WriteStream | undefined
      : null;
    const stderr = runtimeProcess
      ? Reflect.get(runtimeProcess, 'stderr') as NodeJS.WriteStream | undefined
      : null;

    if (stdout && stdout.write && stderr && stderr.write) {
      type WriteCallback = (error?: Error | null) => void;
      type WriteFunction = (
        chunk: string | Uint8Array,
        encoding?: BufferEncoding | WriteCallback,
        callback?: WriteCallback,
      ) => boolean;

      // Hook into process.stdout.write to catch Next.js native logs
      const originalStdoutWrite = stdout.write.bind(stdout) as WriteFunction;
      const originalStderrWrite = stderr.write.bind(stderr) as WriteFunction;

      stdout.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding | WriteCallback, callback?: WriteCallback) => {
        let textChunk = chunk;
        if (Buffer.isBuffer(chunk)) {
          textChunk = chunk.toString('utf8');
        }

        if (typeof textChunk === 'string' && !textChunk.includes('[NASDASH]') && textChunk.trim().length > 0) {
          // Ignore terminal clear sequences
          if (textChunk === '\x1b[2J\x1b[3J\x1b[H' || textChunk === '\x1bc') {
            return originalStdoutWrite(chunk, encoding, callback);
          }

          const trimmed = textChunk.trim();
          
          if (trimmed.startsWith('GET ') || trimmed.startsWith('POST ') || trimmed.startsWith('PUT ') || trimmed.startsWith('DELETE ') || trimmed.startsWith('PATCH ')) {
            return originalStdoutWrite(formatMessage('HTTP', COLORS.fg.cyan, trimmed) + '\n', encoding, callback);
          }
          if (trimmed.includes('⚠') || trimmed.includes('Warning')) {
            return originalStdoutWrite(formatMessage('WARN', COLORS.fg.yellow, trimmed) + '\n', encoding, callback);
          }
          if (trimmed.includes('Ready in') || trimmed.includes('Next.js') || trimmed.includes('Compiled') || trimmed.includes('Fast Refresh')) {
            return originalStdoutWrite(formatMessage('SYSTEM', COLORS.fg.green, trimmed) + '\n', encoding, callback);
          }
          
          // Catch anything else that is readable text (like "🚀 Démarrage...")
          if (trimmed.length > 2) {
            return originalStdoutWrite(formatMessage('INFO', COLORS.fg.blue, trimmed) + '\n', encoding, callback);
          }
        }
        return originalStdoutWrite(chunk, encoding, callback);
      }) as typeof stdout.write;

      stderr.write = ((chunk: string | Uint8Array, encoding?: BufferEncoding | WriteCallback, callback?: WriteCallback) => {
        let textChunk = chunk;
        if (Buffer.isBuffer(chunk)) {
          textChunk = chunk.toString('utf8');
        }

        if (typeof textChunk === 'string' && !textChunk.includes('[NASDASH]') && textChunk.trim().length > 0) {
          const trimmed = textChunk.trim();
          return originalStderrWrite(formatMessage('ERROR', COLORS.fg.red, trimmed) + '\n', encoding, callback);
        }
        return originalStderrWrite(chunk, encoding, callback);
      }) as typeof stderr.write;
    }

    setTimeout(() => {
      this.printBanner();
    }, 1500);
  }

  private printBanner() {
    const banner = `
${COLORS.fg.cyan}${COLORS.bright}
  _   _               _____            _     
 | \\ | |             |  __ \\          | |    
 |  \\| | __ _ ___    | |  | | __ _ ___| |__  
 | . \` |/ _\` / __|   | |  | |/ _\` / __| '_ \\ 
 | |\\  | (_| \\__ \\   | |__| | (_| \\__ \\ | | |
 |_| \\_|\\__,_|___/   |_____/ \\__,_|___/_| |_|
                                             
${COLORS.reset}${COLORS.dim} ─────────────────────────────────────────────
 ${COLORS.fg.green}🚀 NasDash System Initialized
 ${COLORS.fg.yellow}⚡ Optimized Performance Mode Active
 ${COLORS.fg.blue}🛡️  Secure Environment
${COLORS.reset}${COLORS.dim} ─────────────────────────────────────────────${COLORS.reset}
`;
    this.originalConsole.log(banner);
  }
}

export const logger = new Logger();
