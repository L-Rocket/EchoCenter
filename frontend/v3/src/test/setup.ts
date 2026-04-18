import '@testing-library/jest-dom'

const createStorageMock = (): Storage => {
  let store: Record<string, string> = {}

  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
  } as Storage
}

const localStorageLike = globalThis.localStorage as Partial<Storage> | undefined

if (
  !localStorageLike ||
  typeof localStorageLike.getItem !== 'function' ||
  typeof localStorageLike.setItem !== 'function' ||
  typeof localStorageLike.removeItem !== 'function' ||
  typeof localStorageLike.clear !== 'function'
) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: createStorageMock(),
    configurable: true,
  })
}
