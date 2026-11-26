/* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories must use require(). */
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// See tests/mocks/reanimated.js for why we don't use Reanimated's bundled mock.
jest.mock('react-native-reanimated', () => require('./tests/mocks/reanimated'));
