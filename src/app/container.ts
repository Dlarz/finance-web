import { getDb } from '../data/db';
import { systemClock } from '../domain/dates';

/** The app's single database and clock (the equivalent of the Android AppContainer). */
export const db = getDb();
export const clock = systemClock;

declare const __APP_VERSION__: string;
declare const __BUILD_DATE__: string;

export const APP_VERSION: string = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev';
export const BUILD_DATE: string = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : '';
