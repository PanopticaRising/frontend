import winston from 'winston';
import AxiosRequest from '../Hooks/AxiosRequest';
import AxiosBatchTransport from './AxiosBatchTransport';
import BrowserConsoleLoggerTransport from './BrowserConsoleLoggerTransport';
import * as sourcemappedStacktrace from 'sourcemapped-stacktrace';
import urljoin from 'url-join';

let level = process.env.NODE_ENV === 'production' ? 'error' : 'debug';

const transports = {
    console: new BrowserConsoleLoggerTransport(
        {
            format: winston.format.simple(),
            level: level,
        },
    ),
    server: new AxiosBatchTransport({
        level: 'error',
        axios: AxiosRequest,
        loggingEndpoint: '/utility/client-logs',
        format: winston.format.simple(),
    }),
};

const logger = winston.createLogger({
    level: level,
    format: winston.format.simple(),
    defaultMeta: {},
    transports: Object.values(transports),
});

declare global {
    interface Window {
        logger: winston.Logger;
        setLogLevel(level: string): void;
    }
}


window.logger = logger;
window.setLogLevel = (level: string) => {
    transports.console.level = level;
};

Object.keys(logger.levels).forEach((level: string) => {
    const levelKey = level as keyof winston.Logger;
    const origLog = logger[levelKey] as any;
    (logger as any)[levelKey] = (...args: any[]) => {
        sourcemappedStacktrace.mapStackTrace(new Error('For get stack purposes only').stack, (result: Array<string>) => {
            const parsed = /\((.*):(\d+):(\d+)\)/.exec(result[1]);
            if (parsed !== null) {
                const [full, filePath, lineNumber, columnNumber] = parsed;
                const url = urljoin(window.origin, full.substring(1, full.length - 1));
                args.push({filePath, lineNumber, columnNumber}, url);
            } else {
                args.push(result[1]);
            }
            origLog(...args);
        });
    };
});
export default logger;
