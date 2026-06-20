// Tiện ích test dùng chung — KHÔNG đụng DB thật, chỉ giả lập req/res.

// Giả lập đối tượng res của Express: bắt lại statusCode + body
export function mockRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };
}

// Chờ cho khối setImmediate/async (vd trong webhook) chạy xong
export const tick = () => new Promise((r) => setTimeout(r, 15));

// Giả lập chuỗi query Mongoose: find(...).sort(...).skip(...).limit(...) -> Promise<rows>
export function chainResolving(rows) {
  return {
    sort() { return this; },
    skip() { return this; },
    limit() { return Promise.resolve(rows); },
    then(resolve) { return Promise.resolve(rows).then(resolve); } // phòng khi await trực tiếp
  };
}
