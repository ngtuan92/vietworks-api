// Shared test helpers for VietWorks Jest tests.
// Pattern: ESM modules + jest.unstable_mockModule.
import { jest } from '@jest/globals';

/** Build a fake Express response object with chainable status/json/end. */
export const mockResponse = () => {
  const res = {};
  res.statusCode = 200;
  res.status = jest.fn(function (code) { res.statusCode = code; return res; });
  res.json = jest.fn(function (body) { res.body = body; return res; });
  res.send = jest.fn(function (body) { res.body = body; return res; });
  res.cookie = jest.fn(function () { return res; });
  res.clearCookie = jest.fn(function () { return res; });
  return res;
};

/** Build a fake Express request with sane defaults. */
export const mockRequest = (overrides = {}) => {
  const req = {
    body: {},
    query: {},
    params: {},
    headers: {},
    user: null,
    file: null,
    files: [],
    ip: '127.0.0.1',
    ...overrides
  };
  return req;
};

/**
 * Mongoose-style chainable helper.
 * Use `chain(data)` to produce a value that supports any chaining.
 * `mkChainable(data)` produces a Proxy so ANY method call returns chainable
 * until `.lean() / .exec() / .then(cb)` which return the underlying data.
 */
export const chain = (data = null) => {
  const isPromiseLike = data && typeof data.then === 'function';
  const terminal = (isPromiseLike ? () => Promise.resolve(data) : () => data);
  const c = {
    populate: () => c, select: () => c, sort: () => c,
    skip: () => c, limit: () => c, lean: terminal, exec: terminal,
    then: (cb) => Promise.resolve(data).then(cb),
    catch: (cb) => Promise.resolve(data).catch(cb),
    save: terminal, deleteOne: terminal, deleteMany: terminal,
    find: () => c
  };
  for (const k of Object.keys(c)) c[k] = c[k] || (() => c);
  return c;
};

/**
 * Make ANY model mock chainable.
 * Use `mockJob.find.mockReturnValue(mkChainable([{...}]))` or
 * use `chain([...])` directly for the leaf value.
 * `mkChainable` is for when the controller calls unknown extra methods.
 * Note: jest mock methods like mockResolvedValueOnce/mockReturnValueOnce
 * work because each property is itself an actual jest.fn() preserved.
 */
export const mkChainable = (data = null, _seen = new Set()) => {
  // The proxy intercepts .lean/.exec/.then/.catch for data resolution.
  // For ANY OTHER property access, return a chainable that resolves to same data.
  // For special jest-mock methods (mockResolvedValue, etc.) that the user
  // might want to apply, we expose real jest.fn() members.
  const isReserved = (p) => ['then', 'catch', 'lean', 'exec', 'toArray', 'value'].includes(p);
  const self = {};
  return new Proxy(self, {
    get(_, prop) {
      if (prop === 'then') return (cb) => Promise.resolve(data).then(cb);
      if (prop === 'catch') return (cb) => Promise.resolve(data).catch(cb);
      if (prop === 'lean' || prop === 'exec' || prop === 'toArray' || prop === 'value') {
        return () => (data && typeof data.then === 'function' ? Promise.resolve(data) : data);
      }
      // For method names like populate/sort/skip/limit, return chainable function
      return jest.fn(() => mkChainable(data));
    },
    apply(target, _, args) {
      if (data && typeof data.then === 'function') return Promise.resolve(data);
      return data;
    }
  });
};

/** Strict chainable: each method is its own jest.fn that the user can re-mock. */
export const chainableModel = (defaultReturn = null) => {
  const m = {};
  // Create a stable jest.fn for each known method,
  // plus a Proxy for any unknown method that wraps default return value.
  const knownMethods = ['find', 'findOne', 'findById', 'findByIdAndUpdate',
    'findOneAndUpdate', 'findByIdAndDelete', 'create', 'countDocuments',
    'findByIdAndDelete', 'updateMany', 'aggregate', 'save', 'deleteOne', 'deleteMany',
    'exists', 'insertMany', 'updateOne'];
  for (const k of knownMethods) m[k] = jest.fn(() => mkChainable(defaultReturn));
  return new Proxy(m, {
    get(target, prop) {
      if (typeof prop === 'string' && (prop === 'then' || prop === 'catch')) {
        return target[prop] || ((cb) => Promise.resolve(defaultReturn).then(cb));
      }
      if (typeof prop === 'string' && (prop === 'lean' || prop === 'exec' || prop === 'toArray' || prop === 'value')) {
        return () => (defaultReturn && typeof defaultReturn.then === 'function' ? Promise.resolve(defaultReturn) : defaultReturn);
      }
      if (prop in target) return target[prop];
      // Default: return a new chainable that resolves to defaultReturn
      return jest.fn(() => mkChainable(defaultReturn));
    }
  });
};

/** Back-compat alias for buildQueryChain. */
export const buildQueryChain = (returnValue = null) => chain(returnValue);

/** Make a Mongoose document-like save() instance. */
export const docWithSave = (data = {}) => ({
  ...data,
  _id: data._id || 'doc_id',
  save: jest.fn().mockResolvedValue(data),
  toObject: function () { return { ...data }; }
});

/** Wait one tick (helps with promises queued via .then). */
export const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

/** Format YYYY-MM-DD date label for report rows. */
export const today = () => new Date().toISOString().slice(0, 10);

/**
 * Create a complete controller-mock that auto-resolves to a value.
 * All methods return either data (terminal) or chainable (continuation).
 * `mockController(data)` returns a function that mimics a model.
 */
export const mockController = (data = null) => mkChainable(data);
