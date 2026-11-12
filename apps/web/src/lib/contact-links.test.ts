import { describe, expect, it } from 'vitest';
import {
  directionsLink,
  isDirectionsApp,
  mailLink,
  phoneLabel,
  telLink,
  viberLink,
} from './contact-links';

const pin = { lng: 120.5887, lat: 15.145 };

describe('contact links', () => {
  it('builds call, Viber and email links', () => {
    expect(telLink('+639171234567')).toBe('tel:+639171234567');
    expect(viberLink('+639171234567')).toBe('viber://chat?number=%2B639171234567');
    expect(mailLink('hello@clinic.test')).toBe('mailto:hello@clinic.test');
  });

  it('opens directions to the pin, latitude first', () => {
    expect(directionsLink('google_maps', pin)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=15.145%2C120.5887',
    );
    expect(directionsLink('waze', pin)).toBe(
      'https://waze.com/ul?ll=15.145%2C120.5887&navigate=yes',
    );
  });

  it('recognizes only the known directions apps', () => {
    expect(isDirectionsApp('waze')).toBe(true);
    expect(isDirectionsApp('apple_maps')).toBe(false);
    expect(isDirectionsApp(null)).toBe(false);
  });
});

describe('phoneLabel', () => {
  it.each([
    ['+639171234567', '0917 123 4567'],
    ['+63458881234', '(045) 888 1234'],
    ['+63288881234', '(02) 8888 1234'],
    ['+15551234567', '+15551234567'],
  ])('%s → %s', (e164, label) => {
    expect(phoneLabel(e164)).toBe(label);
  });
});
