import { strict as assert } from "node:assert";
import { test } from "node:test";
import { MAX_PHOTO_BYTES, containedPhotoBounds, markerPosition, validatePhotoFile } from "../lib/photo-input";

test("local photo input accepts common camera formats and rejects empty, oversized and active content", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp"]) assert.equal(validatePhotoFile({type, size: MAX_PHOTO_BYTES}), null);
  assert.equal(validatePhotoFile({type: "image/svg+xml", size: 100}), "type");
  assert.equal(validatePhotoFile({type: "image/jpeg", size: 0}), "size");
  assert.equal(validatePhotoFile({type: "image/jpeg", size: MAX_PHOTO_BYTES + 1}), "size");
});

test("manual markers keep their relative position and stay inside the photo surface", () => {
  assert.deepEqual(markerPosition(150, 150, {left: 50, top: 50, width: 200, height: 200}), {x: .5, y: .5});
  assert.deepEqual(markerPosition(-10, 999, {left: 0, top: 0, width: 200, height: 200}), {x: .06, y: .88});
  assert.equal(markerPosition(0, 0, {left: 0, top: 0, width: 0, height: 100}), null);
  assert.deepEqual(containedPhotoBounds(100, 200, 400, 400), {left:100,top:0,width:200,height:400});
  assert.deepEqual(containedPhotoBounds(200, 100, 400, 400), {left:0,top:100,width:400,height:200});
  assert.equal(containedPhotoBounds(0, 100, 400, 400), null);
});
