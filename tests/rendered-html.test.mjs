import assert from "node:assert/strict";
import test from "node:test";
const { default: worker } = await import("../dist/server/index.js");
for (const route of ["/", "/demo", "/workspace"])
  test(`built Worker renders ${route} with real product content`, async () => {
    const r = await worker.fetch(
      new Request("http://localhost" + route, {
        headers: { accept: "text/html" },
      }),
      {
        ASSETS: {
          fetch: async () => new Response("Not found", { status: 404 }),
        },
      },
      { waitUntil() {}, passThroughOnException() {} },
    );
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(html, /SkillForge/);
    assert.match(html, /React Code Reviewer/);
    assert.match(html, /Build better skills/);
    assert.doesNotMatch(html, /Starter Project/);
    if (route === "/demo") assert.match(html, /Demo Data/);
  });
test("built Worker returns 404 for an unknown route", async () => {
  const r = await worker.fetch(
    new Request("http://localhost/not-a-skillforge-route", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(r.status, 404);
});
