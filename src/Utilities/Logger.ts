import winston from 'winston';
import { getUserIdNoRedirect } from '../Enums/UserRole';
import AxiosRequest from '../Hooks/AxiosRequest';
import AxiosBatchTransport from './AxiosBatchTransport';
import BrowserConsoleLoggerTransport from './BrowserConsoleLoggerTransport';
import { version } from '../../package.json';
import localPreferences from '../Utilities/LocalPreferences';

const { loggingPreferences } = localPreferences;

let level = loggingPreferences.loggingLevel;

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
    })
};

const logger = winston.createLogger({
    level: level,
    format: winston.format.simple(),
    defaultMeta: {
        meta: {
            get userId() { return getUserIdNoRedirect(); },
            get location() { return window.location.href; },
            version: version
        }
    },
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
    const availableLoggingLevels = Object.keys(logger.levels);
    if(availableLoggingLevels.indexOf(level) < 0) {
        // Since you are changing the logger this log should not go through the logger
        // We do not want this sent to the server and furthermore we want to make sure it gets output to the console
        // This is a developer only feature and should be interfaced with through the console
        console.error(`Client Logger: Unexpected logging level ${level}, valid values are [${availableLoggingLevels}]`);
        return;
    }
    transports.console.level = level;
    loggingPreferences.loggingLevel = level;
};


// const logger = console;
export default logger;
