| 주제 | 읽을 범위 | 간략한 설명 |
|---|---|---|
| 새 토론방 구축 | L18–32 | 새 자료의 위치와 현재 동작·한계를 확인해 기존 토론을 보존한다. |
| 두 입력과 보존 | L33–48 | 새 자료의 위치와 현재 동작·한계를 확인해 기존 토론을 보존한다. |
| 검증과 한계 | L49–55 | 새 자료의 위치와 현재 동작·한계를 확인해 기존 토론을 보존한다. |

---
okf_version: 1
type: knowledge_reference
title: "토론방 구축과 사용"
project: debate-room
owner: debate-room
status: active
updated_at: "2026-10-11"
references: []
---

# 새 토론방 구축

Node.js 18 이상이 필요하다. 실행에 외부 패키지는 없다. DOM 회귀 시험 `test_motion.cjs`만 jsdom이 필요하며 미설치 시 실행 검증과 구별해 보고한다.

```sh
node /절대경로/debate-room/scripts/create.cjs /절대경로/새토론방
export DEBATE_DATA_DIR=/절대경로/새토론방/data
node /절대경로/새토론방/viewer/build.cjs
DEBATE_PORT=3318 node /절대경로/새토론방/viewer/server.cjs
```

빈 토론방에는 고유 room ID, 빈 참여자·토론·발화와 빈 참고 목록만 만든다. 기존 폴더는 거절한다. 생성된 `data/index.html`은 서버 없이 열 수 있고, 서버 모드는 `http://127.0.0.1:3318/`에서 파일을 수신한다. 포트가 사용 중이면 다른 포트를 선택한다. build/server/ingest를 실행할 때 모두 같은 `DEBATE_DATA_DIR`를 지정해야 한다.

참고 자료는 `data/references.json`에 `{title,take,limit,image?,path?}` 목록으로 작성한다. 다른 프로젝트의 원문·시안·이미지를 패키지에 자동 포함하지 않는다.

# 두 입력과 보존

사람은 ‘새 토론’에서 제목·목적을 만들거나 ‘대화 넣기’에 표지 있는 텍스트/JSON을 넣고 미리보기 뒤 추가한다. 텍스트는 출처를 transcript로 남기며 질문·답변 관계를 자동 추론하지 않는다. 새 참여자 선언만 있는 JSON도 추가할 수 있다. `[사용자]`라는 텍스트 이름도 `discussant`로 해석된다. 사용자 역할이 필요하면 처음부터 `role: user`의 참여자·발화를 JSON으로 넣는다.

참여자는 자기 공개 발화를 JSON으로 완성한 뒤 제출한다. 기본 제출 경로는 다음 명령의 검증과 원자적 입력이다. 직접 쓰기는 inbox의 `.tmp` 파일에 완성한 뒤 고유 `.json` 파일로 rename하는 대안이다.

```sh
node /절대경로/새토론방/viewer/ingest.cjs --check /절대경로/발화.json
node /절대경로/새토론방/viewer/ingest.cjs /절대경로/발화.json
```


브라우저에서 넣은 발언에 에이전트 파일로 답하려면 먼저 서버에 그 기록을 전달한다. 예를 들어 사용자가 새 토론에 질문을 추가했다면 ↓로 `질문기록.json`을 내보내고, 같은 DEBATE_DATA_DIR로 `node viewer/ingest.cjs /절대경로/질문기록.json`을 실행한다. 에이전트는 그 JSON에서 실제 `topicId`와 질문의 `id`를 읽고 자기 새 발화의 `replyTo: [질문의 id]`에 넣어 `답변.json`을 제출한다. 서버가 질문 ID를 모르는 동안에는 답변을 거절한다. 내보낸 ID를 추측하거나 새로 만들지 않는다.

브라우저 입력은 localStorage에 보관된다. ↓ 버튼으로 전체 JSON을 내려받아 다른 브라우저의 JSON 입력 또는 ingest로 다시 넣는다. 내보내기 전에는 서버에 브라우저 입력이 공유됐다고 가정하지 않는다.

# 검증과 한계

`node --test viewer/test_model.cjs`로 원문·중복·충돌·답변·작성 상태 조건을 검사한다. 실제 새 발화를 넣고 필터·답변 이동·전문 펼침·내보내기/재입력을 브라우저에서도 확인한다.

같은 토론 ID의 제목·목적·상태를 갱신하는 API는 없다. concluded 상태는 최초 선언으로만 넣을 수 있으며 나중 결론은 conclusion 발화로 남긴다. 텍스트의 CRLF 줄 끝은 LF로 정규화된다. Markdown 표시는 전문 문자열의 보존과 구별하며 내보낸 JSON에 전문이 남는다.

작성 중 표시는 실제 activities 신호가 있을 때만 나타나며 5분 이내에 만료된다. 서버 코드가 바뀌면 다음 정상 재시작에서 새 모델을 읽는다. 게시·동시 편집·사용자 인증·에이전트 실행은 제공하지 않는다.
