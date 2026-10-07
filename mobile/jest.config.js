module.exports = {
  preset: 'jest-expo',
  setupFiles: ['@react-native-async-storage/async-storage/jest/async-storage-mock'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
