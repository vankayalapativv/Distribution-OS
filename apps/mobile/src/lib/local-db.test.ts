import { describe, expect, it } from "vitest";
import { freshDb } from "./sync-core.test-support";
import { clearAllLocalData, withTransaction, type LocalDb } from "./local-db";

describe("clearAllLocalData", () => {
  it("deletes every row from every local table", () => {
    const db = freshDb();
    db.run("insert into sync_queue (client_uuid, entity_type, payload, status, attempts, next_attempt_at, created_at) values ('u','order','{}','pending',0,0,0)");
    db.run("insert into gps_pings (latitude, longitude, recorded_at, location_point_id, created_at) values (1,2,100,'p1',1)");
    clearAllLocalData(db);
    expect(db.all("select 1 from sync_queue")).toHaveLength(0);
    expect(db.all("select 1 from gps_pings")).toHaveLength(0);
  });

  it("skips a table that does not exist instead of aborting", () => {
    const db = freshDb();
    db.exec("drop table customers");
    expect(() => clearAllLocalData(db)).not.toThrow();
  });
});

describe("withTransaction", () => {
  it("commits a successful multi-statement write", () => {
    const db = freshDb();
    withTransaction(db, () => {
      db.run("insert into gps_pings (latitude, longitude, recorded_at, location_point_id, created_at) values (1,2,100,'p1',1)");
      db.run("insert into gps_pings (latitude, longitude, recorded_at, location_point_id, created_at) values (3,4,200,'p2',2)");
    });
    expect(db.all("select 1 from gps_pings")).toHaveLength(2);
  });

  it("rolls back and rethrows when the write throws midway", () => {
    const db = freshDb();
    expect(() =>
      withTransaction(db, () => {
        db.run("insert into gps_pings (latitude, longitude, recorded_at, location_point_id, created_at) values (1,2,100,'p1',1)");
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(db.all("select 1 from gps_pings")).toHaveLength(0);
  });

  it("surfaces the original error even if the rollback itself fails", () => {
    const fake: LocalDb = {
      exec: (sql) => { if (sql === "rollback") throw new Error("rollback failed"); },
      run: () => {},
      all: () => [],
      first: () => null,
    };
    expect(() => withTransaction(fake, () => { throw new Error("orig"); })).toThrow("orig");
  });
});
