export const getGeolocationUnsupportedMessage = (isNativeRuntime: boolean): string => {
  return isNativeRuntime
    ? 'Location is not available on this device.'
    : 'Geolocation is not supported by your browser.';
};

export const getLocationPermissionDeniedMessage = (isNativeRuntime: boolean): string => {
  return isNativeRuntime
    ? 'Location permission denied. Enable it in your app or device settings.'
    : 'Location permission denied. Enable it in your browser settings.';
};
