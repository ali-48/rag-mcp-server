// Configuration globale pour les tests Jest
import { TextDecoder, TextEncoder } from 'util';

// Polyfill pour TextEncoder/TextDecoder (nécessaire pour certains tests)
global.TextEncoder = TextEncoder;
(global as any).TextDecoder = TextDecoder;

// Configuration des timeouts
jest.setTimeout(10000); // 10 secondes max par test

// Mock console pour des logs plus propres pendant les tests
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeAll(() => {
  // Optionnel: réduire le bruit des logs pendant les tests
  if (process.env.CI === 'true') {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }
});

afterAll(() => {
  // Restaurer les consoles originales
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// Helper pour attendre les promesses
export const flushPromises = () => new Promise(setImmediate);
