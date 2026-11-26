/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  watchman: false,
  setupFiles: ['<rootDir>/jest.setup.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/supabase/', '/scripts/'],
};
