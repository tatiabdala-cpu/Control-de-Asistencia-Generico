// Browser polyfill/mock for Node.js 'stream' module to prevent bundler and console warnings
export class Readable {
  _read() {}
  push() {}
  pipe(dest: any) {
    return dest;
  }
  on() {
    return this;
  }
  once() {
    return this;
  }
  emit() {
    return true;
  }
}

export class Writable {
  _write() {}
  write() {
    return true;
  }
  end() {
    return this;
  }
}

export class Transform extends Readable {}
export class Duplex extends Readable {}
export class Stream extends Readable {}

export default {
  Readable,
  Writable,
  Transform,
  Duplex,
  Stream,
};
