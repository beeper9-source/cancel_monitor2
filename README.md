# 일자별 예약현황 모니터링 시스템

강남구 생활체육시설 예약현황을 모니터링하는 웹 애플리케이션입니다.

## 기능

- 최대 5개까지 날짜 선택 가능
- Selenium을 사용한 자동 웹 스크래핑
- JSON 파일을 통한 데이터 저장 및 조회
- 실시간 예약현황 확인

## 설치 방법

1. Python 가상환경 생성 및 활성화
```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate
```

2. 필요한 패키지 설치
```bash
pip install -r requirements.txt
```

## 실행 방법

```bash
python app.py
```

브라우저에서 `http://localhost:5000`으로 접속하세요.

## 사용 방법

1. 날짜 선택: "날짜 추가" 버튼을 클릭하여 모니터링할 날짜를 선택합니다 (최대 5개)
2. 모니터링 시작: "모니터링 시작" 버튼을 클릭하면 선택한 날짜들의 예약현황을 수집합니다
3. 결과 확인: 수집된 데이터는 화면에 표시되며, `data/reservations.json` 파일에도 저장됩니다

## 데이터 저장

모니터링 결과는 `data/reservations.json` 파일에 자동으로 저장됩니다.
- 같은 날짜의 기존 데이터는 새 데이터로 덮어씌워집니다
- 각 항목에는 `created_at` 타임스탬프가 포함됩니다

## 이메일 발송 테스트 기능

이메일 발송 테스트 기능이 포함되어 있습니다:

1. **SMTP 이메일 발송**: Naver SMTP를 통한 직접 이메일 발송
2. **Edge Function 테스트**: Supabase Edge Function을 통한 이메일 발송 테스트

### 이메일 설정

기본 이메일 설정은 `app.py`에 하드코딩되어 있습니다:
- 발신자: beeper9@naver.com
- 수신자: ku9.kim@samsung.com
- Supabase URL: https://nqwjvrznwzmfytjlpfsk.supabase.co

환경 변수로 변경하려면 `.env` 파일을 생성하거나 환경 변수를 설정하세요.

### Supabase Edge Function 배포

Edge Function을 배포하려면:

```bash
# Supabase CLI 설치 후
supabase functions deploy send-email
```

또는 Supabase 대시보드에서 직접 배포할 수 있습니다.

## 주의사항

- Chrome 브라우저가 설치되어 있어야 합니다
- 웹 스크래핑은 대상 사이트의 구조 변경에 따라 수정이 필요할 수 있습니다
- 과도한 요청은 IP 차단을 유발할 수 있으니 주의하세요
- 이메일 발송 시 SMTP 인증 정보가 필요합니다

