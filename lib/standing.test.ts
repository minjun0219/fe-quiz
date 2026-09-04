import { describe, expect, it } from "vitest";
import { computeStanding, describeStanding, rankEntries } from "./standing";

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
    // 70점인 나와 70점인 남이 같은 집계를 받으므로 같은 순위가 나와야 한다.
    const agg = { players: 5, better: 2, average: 70, best: 100 };
    expect(computeStanding(agg).rank).toBe(3);
    // 동점자 하나가 더 늘어도(players 6) 내 순위는 그대로 — better만이 순위를 정한다.
    expect(computeStanding({ ...agg, players: 6 }).rank).toBe(3);
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

describe("rankEntries", () => {
  const rows = [
    { id: "a", nickname: "느긋한 물범", score: 90 },
    { id: "b", nickname: "성실한 두더지", score: 80 },
    { id: "c", nickname: null, score: 70 },
    { id: "me", nickname: "조용한 수달", score: 70 },
    { id: "d", nickname: "바쁜 다람쥐", score: 40 },
  ];

  it("동점은 같은 순위, 그 다음은 자리 수만큼 건너뛴다", () => {
    const ranked = rankEntries(rows, "me");
    expect(ranked.map((e) => e.rank)).toEqual([1, 2, 3, 3, 5]);
  });

  it("집계가 말하는 내 순위와 목록의 내 순위가 일치해야 한다", () => {
    // 같은 데이터로 두 경로를 돌렸을 때 어긋나면 화면에서 바로 티가 난다.
    const agg = computeStanding({
      players: rows.length,
      better: rows.filter((r) => r.score > 70).length,
      average: 70,
      best: 90,
    });
    const mine = rankEntries(rows, "me").find((e) => e.is_me);
    expect(mine?.rank).toBe(agg.rank);
  });

  it("내 줄만 is_me", () => {
    const ranked = rankEntries(rows, "me");
    expect(ranked.filter((e) => e.is_me).map((e) => e.id)).toEqual(["me"]);
  });

  it("닉네임 없는 row는 null을 그대로 들고 온다 — 라벨은 UI가 붙인다", () => {
    expect(
      rankEntries(rows, "me").find((e) => e.id === "c")?.nickname,
    ).toBeNull();
  });

  it("빈 목록도 안전", () => {
    expect(rankEntries([], "me")).toEqual([]);
  });

  it("전원 동점이면 모두 1등", () => {
    const tied = [
      { id: "x", nickname: null, score: 50 },
      { id: "y", nickname: null, score: 50 },
      { id: "z", nickname: null, score: 50 },
    ];
    expect(rankEntries(tied, "x").map((e) => e.rank)).toEqual([1, 1, 1]);
  });
});
