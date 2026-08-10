function clamp01(value) {
    return Math.max(0, Math.min(1, value));
}

export function getOceanDepthFactor(temperature, humidity) {
    const depth = clamp01((-0.15 - humidity) / 0.4);
    const shoreFade = clamp01((-0.25 - humidity) / 0.08);
    const coldEdgeFade = clamp01((temperature + 0.4) / 0.1);
    const warmEdgeFade = clamp01((0.2 - temperature) / 0.1);
    return depth * shoreFade * Math.min(coldEdgeFade, warmEdgeFade);
}
