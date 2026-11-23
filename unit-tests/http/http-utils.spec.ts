import { describe, expect, it } from 'vitest';
import { joinUrl } from '../../projects/http/src/lib/utils/http-utils';

describe('joinUrl', () => {
  it('joins URL path boundaries without duplicate slashes', () => {
    expect(joinUrl('https://api.example.com/', '/users')).toBe('https://api.example.com/users');
    expect(joinUrl('https://api.example.com', 'users')).toBe('https://api.example.com/users');
    expect(joinUrl('https://api.example.com///', '///users?q=a%20b')).toBe('https://api.example.com/users?q=a%20b');
  });
  it('keeps absolute endpoints unchanged and returns base for empty paths', () => {
    expect(joinUrl('https://api.example.com', 'https://other.test/x')).toBe('https://other.test/x');
    expect(joinUrl('https://api.example.com/', '')).toBe('https://api.example.com');
  });
  it('documents the empty-base relative-path convention', () => {
    expect(joinUrl('', 'users?q=1')).toBe('/users?q=1');
  });
});
