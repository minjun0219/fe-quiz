// Vitest shim: lib/* 모듈들은 `server-only`를 import해서 클라이언트 번들로
// 유출되는 걸 빌드 단계에서 차단하지만, Vitest(Node) 컨텍스트에선 그 가드가
// throw로 떨어진다. 같은 보호는 Next.js bundler가 책임지니 단위 테스트
// 환경에선 no-op으로 대체.
export {};
