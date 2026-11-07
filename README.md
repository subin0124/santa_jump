# santa_jump

## Google 로그인

Google Identity Services의 웹 OAuth 클라이언트 ID를 사용합니다. Google Cloud Console에서 해당 OAuth 클라이언트의 승인된 JavaScript 원본에 게임을 제공하는 주소를 등록하세요. 예를 들어 로컬 테스트는 `http://localhost:8000`을 등록하고 그 주소로 게임을 제공해야 합니다. `file://`로 직접 열면 Google 로그인이 동작하지 않습니다.

로그인은 브라우저에서 Google 프로필 이름과 사진을 표시하는 용도입니다. ID 토큰은 서버로 전송하거나 검증하지 않으므로, 이 기능을 서버 인증이나 보호된 데이터 접근에 사용하지 마세요. 현재 게임 점수와 로그인 상태도 서버에 저장되지 않습니다.