/* eslint-disable sonarjs/no-hardcoded-ip -- "1.1.2.1" is an OTA build label (x.y.z.n), not an IP address */
import { describe, expect, it } from "vitest";
import { readUpdateReleaseInfo } from "./update-release-info";

describe("readUpdateReleaseInfo", () => {
  it("reads otaBuild + releaseNotes from a manifest's expoClient.extra", () => {
    const manifest = {
      extra: { expoClient: { extra: { otaBuild: "1.1.2.1", releaseNotes: ["A", "B"] } } },
    };
    expect(readUpdateReleaseInfo(manifest)).toEqual({ version: "1.1.2.1", notes: ["A", "B"] });
  });

  it("returns null version + empty notes when the manifest omits them", () => {
    expect(readUpdateReleaseInfo({ extra: { expoClient: { extra: {} } } })).toEqual({
      version: null,
      notes: [],
    });
    expect(readUpdateReleaseInfo(undefined)).toEqual({ version: null, notes: [] });
    expect(readUpdateReleaseInfo({})).toEqual({ version: null, notes: [] });
  });

  it("ignores a non-array releaseNotes and non-string entries", () => {
    const manifest = {
      extra: { expoClient: { extra: { otaBuild: 5, releaseNotes: ["ok", 3, null, "yes"] } } },
    };
    // otaBuild must be a string to count; bad note entries are dropped.
    expect(readUpdateReleaseInfo(manifest)).toEqual({ version: null, notes: ["ok", "yes"] });
  });
});
