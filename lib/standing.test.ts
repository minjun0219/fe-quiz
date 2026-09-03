import { describe, expect, it } from "vitest";
import { computeStanding, describeStanding } from "./standing";

describe("computeStanding", () => {
  it("나보다 높은 점수 수 + 1이 순위", () => {
    const s = computeStanding({
      players: 12,
      better: 2,
      average: 63,
      best: 90,
    });
    expect(s.rank).toBe(3);
    expect(s.top_percent).toBe(25);
    expect(s.alone).toBe(false);
  });

  it("동점자는 같은 순위 — 나보다 '높은' 점수만 세기 때문", () => {
    // 70점이 셋, 그 위에 두 명. 셋 다 3등이어야 한다.
    const agg = { players: 5, better: 2, average: 70, best: 100 };
    expect(computeStanding(agg).rank).toBe(3);
    expect(computeStanding(agg).rank).toBe(computeStanding(agg).rank);
  });

  it("1등은 상위 0%가 아니라 1%로 바닥을 둔다", () => {
    const s = computeStanding({
      players: 200,
      better: 0,
      average: 50,
      best: 100,
    });
    expect(s.rank).toBe(1);
    expect(s.top_percent).toBe(1);
  });

  it("꼴등은 상위 100%", () => {
    const s = computeStanding({
      players: 4,
      better: 3,
      average: 50,
      best: 100,
    });
    expect(s.rank).toBe(4);
    expect(s.top_percent).toBe(100);
  });

  it("혼자면 alone — 순위를 말할 대상이 없다", () => {
    const s = computeStanding({ players: 1, better: 0, average: 70, best: 70 });
    expect(s.alone).toBe(true);
    expect(s.rank).toBe(1);
    expect(describeStanding(s)).toBe("이 라운드 첫 주자예요");
  });

  it("players가 0으로 들어와도 1로 접어 0 나눗셈을 막는다", () => {
    // 이론상 없어야 하지만(내 row가 항상 하나는 있다) NaN%가 화면에 새는
    // 것보다 낫다.
    const s = computeStanding({ players: 0, better: 0, average: 0, best: 0 });
    expect(s.players).toBe(1);
    expect(s.alone).toBe(true);
    expect(Number.isFinite(s.top_percent)).toBe(true);
  });

  it("describeStanding은 공유 문구로 쓸 한 줄", () => {
    const s = computeStanding({
      players: 12,
      better: 2,
      average: 63,
      best: 90,
    });
    expect(describeStanding(s)).toBe("12명 중 3등 · 상위 25%");
  });
});
