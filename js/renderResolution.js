export const MAX_RENDER_PIXELS = 3_700_000;

export function calculateRenderPixelRatio(width, height, devicePixelRatio, renderScale) {
    const desiredRatio = Math.min(devicePixelRatio * renderScale, 2);
    const pixelBudgetRatio = Math.sqrt(MAX_RENDER_PIXELS / (width * height));
    return Math.min(desiredRatio, pixelBudgetRatio);
}
