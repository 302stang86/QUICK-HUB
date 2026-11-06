export const MIN_ZOOM=.75,MAX_ZOOM=1.25;
export function pinchZoom(startZoom,startDistance,currentDistance){
  if(!Number.isFinite(startZoom)||!Number.isFinite(startDistance)||!Number.isFinite(currentDistance)||startDistance<=0||currentDistance<=0)return Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,Number.isFinite(startZoom)?startZoom:1));
  return Math.max(MIN_ZOOM,Math.min(MAX_ZOOM,startZoom*currentDistance/startDistance));
}
