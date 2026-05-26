<!-- AUTO-GENERATED — do not edit. Run `pnpm questions:index`. -->

# Question Index (auto)

## javascript (22)

- `js-001` [medium] — tags: event-loop, async, microtask
  > 다음 코드의 출력 순서는?
- `js-002` [medium] — tags: closure, scope
  > 다음 코드의 출력은?
- `js-003` [medium] — tags: hoisting, tdz, var, let
  > 다음 코드를 실행하면 어떤 일이 벌어질까요?
- `js-004` [medium] — tags: this, arrow-function, scope
  > 다음 코드의 출력은?
- `js-005` [hard] — tags: promise, async, await, event-loop, microtask
  > 다음 코드의 출력 순서는?
- `js-006` [easy] — tags: debounce, throttle, performance
  > 사용자가 검색창에 타이핑하는 동안에는 API를 부르지 않다가, 입력이 멈춘 뒤 300ms가 지나면 한 번만 부르고 싶어요. 어떤 패턴이 적합할…
- `js-007` [easy] — tags: event-delegation, bubbling, browser
  > `<ul>` 안에 `<li>`가 1000개 있고, 각각을 클릭했을 때 동작이 필요해요. 가장 효율적인 패턴은?
- `js-008` [medium] — tags: prototype, inheritance, hasOwnProperty
  > 다음 코드의 출력은?
- `js-009` [easy] — tags: array, immutability, map, filter, forEach
  > 다음 코드 실행 후 `nums`의 값은?
- `js-010` [medium] — tags: spread, shallow-copy, immutability
  > 다음 코드의 출력은?
- `js-011` [easy] — tags: optional-chaining, nullish-coalescing, es2020
  > 다음 코드를 실행했을 때 콘솔 출력은?
- `js-012` [easy] — tags: number, ieee754, precision
  > 자바스크립트에서 `0.1 + 0.2 === 0.3` 평가 결과와 그 이유로 알맞은 것은?
- `js-013` [medium] — tags: clone, spread, structured-clone
  > 다음 코드 실행 후 `a.profile.city`와 `b.profile.city`의 값은?
- `js-014` [medium] — tags: equality, coercion, nan
  > 다음 비교 표현식 중 `true`로 평가되는 것을 모두 고른 묶음은?
- `js-015` [hard] — tags: generator, iterator, control-flow
  > 다음 코드의 출력 순서는?
- `js-016` [easy] — tags: map, object, collections
  > 다음 코드의 출력은?
- `js-017` [medium] — tags: promise, async, error-handling
  > `Promise.all` / `Promise.allSettled` / `Promise.race`의 동작 차이로 가장 정확한 설명은?
- `js-018` [medium] — tags: closure, memoization, cache
  > 다음 `memoize`로 감싼 함수가 5번 호출됐을 때 `calls`의 최종 값은?
- `js-019` [hard] — tags: async-iterator, generator, for-await
  > 다음 코드의 출력 순서는?
- `js-020` [hard] — tags: functional, currying, closure
  > 다음 `curry` 구현으로 감싼 `add3`을 호출했을 때, 각 `console.log` 라인의 **출력값**을 위에서부터 차례대로 나열한 …
- `js-021` [medium] — tags: event, target, currentTarget, bubbling
  > 아래 코드에서 사용자가 `#save` 버튼을 클릭했을 때, `event.target.id`와 `event.currentTarget.id`로 찍…
- `js-022` [medium] — tags: module, commonjs, esm, tree-shaking
  > `CommonJS`와 `ES Module`의 차이를 설명한 내용으로 가장 적절한 것은?

## react (22)

- `react-001` [medium] — tags: hooks, useState, closure, batching
  > 버튼을 한 번 클릭했을 때, 클릭 직후 화면에 표시되는 숫자와 console에 찍히는 값은?
- `react-002` [medium] — tags: useEffect, cleanup, hooks
  > 다음 useEffect의 cleanup 함수는 언제 실행될까요?
- `react-003` [medium] — tags: useEffect, useLayoutEffect, hooks, rendering
  > 컴포넌트가 마운트되자마자 DOM의 크기를 측정해서, 그 값으로 위치를 보정해야 해요. 사용자 눈에 깜빡임(jank)이 보이지 않아야 한다면 어…
- `react-004` [medium] — tags: memoization, memo, useMemo, useCallback
  > React.memo, useMemo, useCallback에 대한 설명 중 **틀린** 것은?
- `react-005` [easy] — tags: strict-mode, useEffect, dev-mode
  > 개발 환경에서 `<StrictMode>`로 감싼 컴포넌트의 useEffect가 **두 번** 실행되는 이유는?
- `react-006` [medium] — tags: context, useMemo, rerender
  > 아래 코드에서 `count`가 바뀔 때마다 모든 `UserContext` consumer가 리렌더돼요. 가장 적절한 해결책은?
- `react-007` [medium] — tags: key, list, reconciliation
  > 아래 코드에서 `items` 배열 **앞쪽에** 새 항목을 `unshift`하면 어떤 일이 벌어질까요?
- `react-008` [easy] — tags: form, controlled, uncontrolled, ref
  > React form input에서 controlled와 uncontrolled를 구분하는 핵심 차이는?
- `react-009` [medium] — tags: error-boundary, error-handling
  > Error Boundary가 **잡지 못하는** 에러는?
- `react-010` [medium] — tags: render-phase, commit-phase, lifecycle
  > React의 Render Phase와 Commit Phase에 대한 설명 중 **옳은** 것은?
- `react-011` [easy] — tags: hooks, useReducer, state-management
  > `useState` 대신 `useReducer`를 쓰는 게 가장 자연스러운 상황은?
- `react-012` [medium] — tags: hooks, rules-of-hooks, lint
  > React Hook 규칙에 따라 다음 코드에서 **규칙을 위반**하는 항목을 모두 고르면?
- `react-013` [medium] — tags: code-splitting, suspense, lazy
  > `React.lazy`로 불러오는 컴포넌트를 `<Suspense>` 없이 렌더하면 어떻게 될까요?
- `react-014` [medium] — tags: refs, forwardRef, dom
  > 부모에서 자식 함수형 컴포넌트의 `<input>` DOM에 ref를 직접 연결하려고 해요. 다음 중 React 18 기준 올바른 패턴은?
- `react-015` [hard] — tags: concurrent, useTransition, useDeferredValue
  > `useTransition`과 `useDeferredValue`의 차이로 가장 정확한 설명은?
- `react-016` [easy] — tags: fragment, jsx, dom
  > 다음 컴포넌트에서 `<>...</>` (Fragment)를 쓰는 이유로 가장 적절한 것은?
- `react-017` [easy] — tags: hooks, custom-hook, naming, lint
  > 커스텀 훅 이름을 `use`로 시작해야 하는 이유로 가장 적절한 것은?
- `react-018` [easy] — tags: hooks, useId, a11y, ssr
  > `useId()` 훅의 주요 용도로 가장 적절한 것은?
- `react-019` [medium] — tags: portal, modal, dom, context
  > 모달을 `createPortal`로 `document.body` 아래에 마운트하는 이유로 가장 정확한 것은?
- `react-020` [medium] — tags: refs, forwardRef, useImperativeHandle, encapsulation
  > 다음 코드에서 `useImperativeHandle`을 `forwardRef`와 함께 쓰는 이유로 가장 정확한 것은?
- `react-021` [medium] — tags: useRef, render, state, timer
  > React 컴포넌트 안에서 타이머 ID처럼 렌더 사이에 유지돼야 하지만 값 변경만으로 리렌더링할 필요는 없는 값을 저장하려고 해요. 가장 적절…
- `react-022` [medium] — tags: tanstack-query, cache, staleTime, gcTime
  > TanStack Query에서 `staleTime`과 `gcTime`의 차이를 설명한 내용으로 맞는 것은?

## css (21)

- `css-001` [easy] — tags: flexbox, layout, justify-content
  > flex 컨테이너에서 자식 아이템을 main axis 양 끝에 붙이고, 사이사이는 균등 간격으로 배치하려면?
- `css-002` [easy] — tags: box-model, box-sizing
  > 아래 박스의 실제 콘텐츠 영역 너비는?
- `css-003` [medium] — tags: position, sticky, scroll
  > `position: sticky`의 동작으로 가장 정확한 설명은?
- `css-004` [hard] — tags: stacking-context, z-index, position
  > 다음 중 새로운 stacking context를 **만들지 않는** 것은?
- `css-005` [medium] — tags: specificity, selector, cascade
  > 아래 HTML/CSS에서 `<p>`의 텍스트 색은?
- `css-006` [easy] — tags: units, em, rem, font-size
  > CSS 단위 `em`, `rem`, `px`에 대한 설명 중 **옳은** 것은?
- `css-007` [easy] — tags: grid, layout, repeat
  > 아래 grid 컨테이너에 자식 요소 7개를 넣으면 어떻게 배치될까요?
- `css-008` [medium] — tags: pseudo-element, before, after, content
  > 아래 CSS만 작성했는데 화면에 빨간 점이 안 보여요. 가장 큰 이유는 뭘까요?
- `css-009` [easy] — tags: transition, animation, hover
  > 버튼에 hover하면 색이 부드럽게 변하다가, 마우스를 떼면 다시 부드럽게 원래 색으로 돌아오게 만들고 싶어요. 가장 적절한 도구는 뭘까요?
- `css-010` [hard] — tags: bfc, margin-collapse, layout, flow-root
  > 부모 div 안의 첫 자식 div에 `margin-top: 40px`을 줬는데, 그 마진이 부모 안에 머물지 않고 **부모 바깥으로 빠져나가*…
- `css-011` [easy] — tags: aspect-ratio, layout, modern-css
  > `<img>`나 `<div>`에 가로:세로 16:9 비율을 유지시키려면 가장 간결한 방법은 뭘까요?
- `css-012` [easy] — tags: selectors, has, modern-css
  > "체크된 input을 가진 label"의 배경색만 바꾸려고 해요. 가장 알맞은 셀렉터는 뭘까요?
- `css-013` [medium] — tags: custom-properties, variables, cascade
  > 다음 CSS와 HTML에서 `.btn`의 최종 `color`는?
- `css-014` [medium] — tags: flexbox, flex-shorthand, layout
  > `flex: 1` 단축 표기는 어떤 longhand 값으로 풀릴까요?
- `css-015` [hard] — tags: viewport-units, mobile, dvh
  > 모바일 Safari에서 `height: 100vh`가 풀스크린이 안 되고 일부가 가려 보이는 이유와, 가장 적절한 대체 단위는?
- `css-016` [medium] — tags: flexbox, grid, gap, layout
  > flex / grid 컨테이너에서 자식 사이 간격을 줄 때 `gap`을 쓰는 게 옛날의 `margin` 트릭보다 좋은 이유로 가장 적절한 것은?
- `css-017` [medium] — tags: selectors, specificity, is, where
  > 다음 두 셀렉터의 specificity 차이로 가장 정확한 것은?
- `css-018` [medium] — tags: logical-properties, i18n, rtl
  > `margin-inline: 16px`이 `margin-left: 16px; margin-right: 16px`와 차이가 있는 부분으로 가장 …
- `css-019` [hard] — tags: container-queries, responsive, modern-css
  > 다음 `@container` 쿼리가 `@media (min-width: 400px)`와 다른 점으로 가장 정확한 것은?
- `css-020` [hard] — tags: cascade, layer, specificity
  > 다음 CSS에서 `<a>`의 최종 `color`는?
- `css-021` [easy] — tags: reset-css, normalize-css, browser-defaults
  > Reset CSS와 Normalize CSS의 차이로 가장 알맞은 것은?

## typescript (20)

- `ts-001` [medium] — tags: types, any, unknown, narrowing
  > `any`와 `unknown`의 차이는?
- `ts-002` [medium] — tags: types, discriminated-union, narrowing
  > `area(shape)` 호출이 컴파일을 통과하고 모든 케이스에서 올바른 결과를 내려면, 어느 구현이 적절할까요?
- `ts-003` [easy] — tags: types, as-const, literal-types, readonly
  > `a`와 `b`의 추론 타입은?
- `ts-004` [easy] — tags: types, keyof, indexed-access
  > `K`로 추론되는 타입은?
- `ts-005` [medium] — tags: types, utility-types, pick, omit
  > `Pick<User, 'id' | 'name'>`로 만들어지는 타입은?
- `ts-006` [hard] — tags: types, conditional-types, infer, return-type
  > `R`의 타입은?
- `ts-007` [medium] — tags: types, satisfies, literal-types, contextual-typing, ts49
  > 세 변수의 동작 차이로 옳은 것은?
- `ts-008` [medium] — tags: types, readonly, ReadonlyArray, mutation
  > `readonly number[]` 타입에서 **컴파일 에러**가 나는 사용을 모두 골라 주세요.
- `ts-009` [easy] — tags: types, interface, type-alias
  > TypeScript의 `type`과 `interface`에 대한 설명 중 가장 정확한 것은?
- `ts-010` [easy] — tags: types, optional, undefined
  > 다음 코드에서 컴파일 에러가 나는 줄은? (`exactOptionalPropertyTypes`는 꺼진 상태, strict이고 추가 옵션은 기본…
- `ts-011` [easy] — tags: utility-types, record, mapping
  > 아래 `Palette` 타입을 만족하는 값으로 `???` 자리에 들어갈 수 있는 것은?
- `ts-012` [medium] — tags: narrowing, typeof, control-flow
  > 다음 함수의 마지막 `return v.toFixed(2)` 위치에서 TS가 `v`를 추론한 타입은?
- `ts-013` [medium] — tags: generics, inference
  > 다음 코드에서 (1), (2), (3)의 추론 타입으로 가장 정확한 것은?
- `ts-014` [medium] — tags: generics, constraints, keyof
  > 다음 코드에서 (1)과 (2)의 결과로 가장 정확한 것은?
- `ts-015` [medium] — tags: never, exhaustiveness, discriminated-union
  > 아래 `default` 분기에서 `const _exhaustive: never = shape`를 둘 이유로 가장 정확한 것은?
- `ts-016` [medium] — tags: tuple, array, indexed-access
  > 다음 코드의 타입 검사를 다루는 설명으로 가장 정확한 것은? (`noUncheckedIndexedAccess`가 OFF인 기본 상태)
- `ts-017` [medium] — tags: mapped-type, readonly, utility-types
  > 다음 코드의 (1) 위치에서 발생하는 결과로 가장 정확한 것은?
- `ts-018` [medium] — tags: template-literal-type, capitalize
  > 다음 코드에서 타입 `H`로 추론되는 값은?
- `ts-019` [medium] — tags: overload, signature
  > 다음 함수 오버로드 선언에서 (1), (2), (3) 호출의 결과로 가장 정확한 것은?
- `ts-020` [medium] — tags: type-guard, as, narrowing
  > 아래 (A)와 (B) 방식의 차이로 가장 정확한 설명은?

## html (20)

- `html-001` [easy] — tags: semantics, a11y, button, forms
  > 같은 클릭 처리를 한다고 가정할 때, `<div onclick>` 대신 `<button>`을 써야 하는 이유로 **맞는 것**을 모두 골라 보…
- `html-002` [medium] — tags: scripts, defer, async, performance
  > `defer`와 `async` 외부 스크립트의 동작 차이로 **옳은 설명**은?
- `html-003` [easy] — tags: semantics, landmarks, a11y
  > 페이지의 **주요 콘텐츠 영역**(보통 페이지당 하나)을 감싸는 가장 적절한 시맨틱 태그는?
- `html-004` [medium] — tags: forms, button, submit, gotcha
  > 사용자가 "취소" 버튼을 클릭하면 어떻게 동작할까요?
- `html-005` [medium] — tags: images, picture, srcset, responsive
  > 뷰포트 너비가 800px일 때, 브라우저가 로드하는 이미지는?
- `html-006` [medium] — tags: dialog, modal, a11y
  > `<dialog>` 요소의 `showModal()`과 `show()` 차이로 **틀린** 설명은?
- `html-007` [easy] — tags: a11y, forms, label, aria
  > 체크박스에 라벨을 **연결**한 사례로 옳지 않은 것은?
- `html-008` [medium] — tags: viewport, meta, responsive, mobile
  > 반응형 페이지의 `<head>`에 들어가야 할 viewport 메타 태그로 가장 적절한 것은?
- `html-009` [easy] — tags: a11y, alt, semantics
  > `<img alt>` 작성 원칙으로 **맞는 것**을 모두 골라 보세요.
- `html-010` [easy] — tags: details, summary, disclosure
  > 다음 마크업의 동작 설명으로 가장 정확한 것은?
- `html-011` [easy] — tags: input, mobile, ux
  > 모바일 브라우저에서 `<input type="email">` / `"tel"` / `"number"`를 일반 `"text"` 대신 쓰는 가장 …
- `html-012` [medium] — tags: script, module, defer
  > 다음 두 스크립트 태그의 동작으로 가장 정확한 것은?
- `html-013` [medium] — tags: a11y, aria, labels
  > `aria-label`과 `aria-labelledby` 사용 차이로 가장 정확한 것은?
- `html-014` [medium] — tags: a11y, table, semantics
  > 다음 표 마크업에서 `<caption>`과 `scope` 속성의 역할로 가장 정확한 것은?
- `html-015` [medium] — tags: form, autocomplete, datalist
  > `<datalist>`가 `<select>`와 다른 점으로 가장 정확한 것은?
- `html-016` [medium] — tags: forms, validation, a11y
  > 다음 마크업의 폼 검증 동작과 한계로 가장 정확한 것은?
- `html-017` [medium] — tags: meta, open-graph, seo
  > 페이지를 카카오톡·슬랙 같은 서비스에서 공유할 때 미리보기 카드가 잘 나오도록 Open Graph 메타 태그 중 **권장되는 것**을 모두 고…
- `html-018` [hard] — tags: a11y, modal, focus-management
  > HTML5의 `inert` 속성을 모달 외부 영역에 적용하는 이유로 가장 정확한 것은?
- `html-019` [hard] — tags: iframe, sandbox, security
  > 다음 두 iframe 설정의 의미와 두 번째 설정의 위험으로 가장 정확한 것은?
- `html-020` [hard] — tags: forms, autocomplete, inputmode
  > `autocomplete`와 `inputmode` 속성의 역할 차이로 가장 정확한 것은?

## browser (7)

- `browser-001` [easy] — tags: rendering, crp, dom, cssom
  > 브라우저의 Critical Rendering Path 순서로 가장 알맞은 것은?
- `browser-002` [medium] — tags: rendering, reflow, repaint, composite, css
  > 다음 중 레이아웃 재계산을 피하고 대체로 Composite 단계에서 처리되어 애니메이션에 유리한 CSS 속성 조합은?
- `browser-003` [medium] — tags: resource-hints, preconnect, preload, prefetch, html
  > `<link rel="preconnect">`, `<link rel="preload">`, `<link rel="prefetch">` 설명으로…
- `browser-004` [easy] — tags: font-loading, fout, foit, font-display
  > 웹 폰트 로딩에서 FOUT와 FOIT 설명으로 가장 알맞은 것은?
- `browser-005` [hard] — tags: event-loop, rendering, microtask, requestAnimationFrame
  > 브라우저 이벤트 루프에서 렌더링과 가장 가까운 설명은?
- `browser-006` [easy] — tags: cache, memory-cache, disk-cache, browser
  > 브라우저의 메모리 캐시와 디스크 캐시에 대한 설명으로 가장 적절한 것은?
- `browser-007` [easy] — tags: security, same-origin-policy, origin, browser
  > 브라우저의 동일 출처 정책(Same-Origin Policy)에서 '같은 출처(origin)'를 구성하는 요소로 가장 알맞은 것은 무엇인가요?

## performance (5)

- `perf-001` [easy] — tags: core-web-vitals, lcp, inp, cls
  > Core Web Vitals의 대표 지표 조합으로 가장 알맞은 것은?
- `perf-002` [medium] — tags: lcp, image-optimization, preload
  > LCP 개선에 가장 직접적으로 도움이 되는 선택은?
- `perf-003` [medium] — tags: cls, layout-shift, font-loading, image
  > CLS를 줄이는 데 도움이 되는 방법을 모두 고르면?
- `perf-004` [hard] — tags: inp, long-task, main-thread, responsiveness
  > INP가 나쁜 페이지에서 클릭 직후 300ms 이상의 긴 JavaScript 작업이 반복돼요. 가장 적절한 개선 방향은?
- `perf-005` [easy] — tags: transform, composite, animation, reflow
  > 버튼 hover 시 살짝 위로 이동하는 애니메이션을 만들 때 성능 관점에서 더 선호되는 방식은?

## nextjs (5)

- `next-001` [easy] — tags: ssr, ssg, rendering
  > Next.js에서 SSR과 SSG 선택 기준으로 가장 알맞은 것은?
- `next-002` [medium] — tags: app-router, fetch-cache, revalidate
  > Next.js App Router의 `fetch` 캐시 옵션 설명으로 맞는 것은?
- `next-003` [medium] — tags: server-actions, mutation, app-router
  > Next.js Server Actions에 대한 설명으로 가장 알맞은 것은?
- `next-004` [hard] — tags: streaming-ssr, suspense, app-router, rendering
  > App Router에서 Streaming SSR과 `Suspense`를 함께 쓰는 이유로 가장 알맞은 것은?
- `next-005` [easy] — tags: proxy, middleware, redirect, rewrite, auth
  > Next.js Proxy를 쓰기 좋은 경우는?
