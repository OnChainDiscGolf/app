import { describe, expect, it } from 'vitest';
import {
  getGeolocationUnsupportedMessage,
  getLocationPermissionDeniedMessage,
} from './locationPermissionCopy';

describe('location permission copy', () => {
  it('uses browser settings wording for denied web geolocation permission', () => {
    expect(getLocationPermissionDeniedMessage(false)).toBe(
      'Location permission denied. Enable it in your browser settings.'
    );
  });

  it('uses app/device settings wording for denied native geolocation permission', () => {
    expect(getLocationPermissionDeniedMessage(true)).toBe(
      'Location permission denied. Enable it in your app or device settings.'
    );
  });

  it('keeps unsupported-geolocation copy context-aware', () => {
    expect(getGeolocationUnsupportedMessage(false)).toBe('Geolocation is not supported by your browser.');
    expect(getGeolocationUnsupportedMessage(true)).toBe('Location is not available on this device.');
  });
});
