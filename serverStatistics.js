const fs = require('fs');
const path = require('path');

const HOUR_RETENTION_DAYS = 90;
const DAY_RETENTION_DAYS = 390;
const DEFAULT_TIME_ZONE = 'Europe/Berlin';
const EMPTY_BUCKET = Object.freeze({
    gamePageRequests: 0,
    totalRequests: 0,
    status2xx: 0,
    status3xx: 0,
    status4xx: 0,
    status5xx: 0
});

function createStatisticsStore({ directory, timeZone = DEFAULT_TIME_ZONE, now = () => new Date(), flushDelayMs = 1000 } = {}) {
    if (!directory) throw new Error('Statistics directory is required');

    const filePath = path.join(directory, 'statistics.json');
    const data = readStatistics(filePath, timeZone);
    let flushTimer = null;
    let cleanupTimer = null;

    function recordResponse({ statusCode, gamePage = false, at = now() }) {
        const date = at instanceof Date ? at : new Date(at);
        const hour = getHourKey(date, timeZone);
        const day = hour.slice(0, 10);

        incrementBucket(data.hours, hour, statusCode, gamePage);
        incrementBucket(data.days, day, statusCode, gamePage);
        prune(data, date, timeZone);
        scheduleFlush();
    }

    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            try {
                flush();
            } catch (error) {
                console.error(`Statistics could not be written: ${error.message}`);
            }
        }, flushDelayMs);
        flushTimer.unref?.();
    }

    function flush() {
        if (flushTimer) {
            clearTimeout(flushTimer);
            flushTimer = null;
        }
        fs.mkdirSync(directory, { recursive: true });
        const temporaryPath = `${filePath}.tmp`;
        fs.writeFileSync(temporaryPath, JSON.stringify(data));
        fs.renameSync(temporaryPath, filePath);
    }

    function close() {
        if (cleanupTimer) {
            clearInterval(cleanupTimer);
            cleanupTimer = null;
        }
        flush();
    }

    function snapshot(at = now()) {
        const date = at instanceof Date ? at : new Date(at);
        const hourKeys = recentKeys(date, 24, 60 * 60 * 1000, value => getHourKey(value, timeZone));
        const dayKeys = recentKeys(date, 30, 24 * 60 * 60 * 1000, value => getDayKey(value, timeZone));
        const today = getDayKey(date, timeZone);

        return {
            generatedAt: date.toISOString(),
            timeZone,
            totals: {
                todayGamePageRequests: bucketFor(data.days, today).gamePageRequests,
                last7DaysGamePageRequests: sumBuckets(data.days, dayKeys.slice(-7), 'gamePageRequests'),
                last30DaysGamePageRequests: sumBuckets(data.days, dayKeys, 'gamePageRequests'),
                last30DaysErrors: sumBuckets(data.days, dayKeys, 'status4xx') + sumBuckets(data.days, dayKeys, 'status5xx')
            },
            hours: hourKeys.map(key => ({ start: key, ...bucketFor(data.hours, key) })),
            days: dayKeys.map(key => ({ date: key, ...bucketFor(data.days, key) }))
        };
    }

    function runCleanup() {
        if (prune(data, now(), timeZone)) scheduleFlush();
    }

    runCleanup();
    cleanupTimer = setInterval(runCleanup, 24 * 60 * 60 * 1000);
    cleanupTimer.unref?.();

    return { recordResponse, snapshot, flush, close, filePath };
}

function readStatistics(filePath, timeZone) {
    try {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed?.version === 1 && parsed.timeZone === timeZone) {
            return {
                version: 1,
                timeZone,
                hours: normalizeBuckets(parsed.hours),
                days: normalizeBuckets(parsed.days)
            };
        }
    } catch (error) {
        if (error.code !== 'ENOENT') console.error(`Statistics could not be read: ${error.message}`);
    }
    return { version: 1, timeZone, hours: {}, days: {} };
}

function normalizeBuckets(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).map(([key, bucket]) => [key, {
        gamePageRequests: safeCount(bucket?.gamePageRequests),
        totalRequests: safeCount(bucket?.totalRequests),
        status2xx: safeCount(bucket?.status2xx),
        status3xx: safeCount(bucket?.status3xx),
        status4xx: safeCount(bucket?.status4xx),
        status5xx: safeCount(bucket?.status5xx)
    }]));
}

function safeCount(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function incrementBucket(collection, key, statusCode, gamePage) {
    const bucket = collection[key] || { ...EMPTY_BUCKET };
    bucket.totalRequests += 1;
    if (gamePage) bucket.gamePageRequests += 1;
    if (statusCode >= 200 && statusCode < 300) bucket.status2xx += 1;
    else if (statusCode >= 300 && statusCode < 400) bucket.status3xx += 1;
    else if (statusCode >= 400 && statusCode < 500) bucket.status4xx += 1;
    else if (statusCode >= 500 && statusCode < 600) bucket.status5xx += 1;
    collection[key] = bucket;
}

function bucketFor(collection, key) {
    return collection[key] || EMPTY_BUCKET;
}

function sumBuckets(collection, keys, field) {
    return keys.reduce((sum, key) => sum + bucketFor(collection, key)[field], 0);
}

function prune(data, at, timeZone) {
    let changed = false;
    const firstHour = getHourKey(new Date(at.getTime() - HOUR_RETENTION_DAYS * 24 * 60 * 60 * 1000), timeZone);
    const firstDay = getDayKey(new Date(at.getTime() - DAY_RETENTION_DAYS * 24 * 60 * 60 * 1000), timeZone);
    for (const key of Object.keys(data.hours)) {
        if (key < firstHour) {
            delete data.hours[key];
            changed = true;
        }
    }
    for (const key of Object.keys(data.days)) {
        if (key < firstDay) {
            delete data.days[key];
            changed = true;
        }
    }
    return changed;
}

function recentKeys(at, count, stepMs, format) {
    const keys = [];
    for (let offset = count - 1; offset >= 0; offset -= 1) {
        const key = format(new Date(at.getTime() - offset * stepMs));
        if (keys.at(-1) !== key) keys.push(key);
    }
    return keys;
}

function getDayKey(date, timeZone) {
    return getDateParts(date, timeZone).slice(0, 3).join('-');
}

function getHourKey(date, timeZone) {
    const [year, month, day, hour] = getDateParts(date, timeZone);
    return `${year}-${month}-${day}T${hour}`;
}

function getDateParts(date, timeZone) {
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const part = type => parts.find(candidate => candidate.type === type)?.value;
    return [part('year'), part('month'), part('day'), part('hour')];
}

module.exports = { createStatisticsStore };
