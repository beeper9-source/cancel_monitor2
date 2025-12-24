from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from datetime import datetime
import time
import os
import json
import logging
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

app = Flask(__name__)
CORS(app)

# JSON 파일 경로 설정
DATA_DIR = 'data'
JSON_FILE = os.path.join(DATA_DIR, 'reservations.json')
DATES_FILE = os.path.join(DATA_DIR, 'monitoring_dates.json')
RECEIVERS_FILE = os.path.join(DATA_DIR, 'email_receivers.json')

# data 디렉토리 생성
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 이메일 설정
SUPABASE_URL = os.getenv('SUPABASE_URL', 'https://nqwjvrznwzmfytjlpfsk.supabase.co')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xd2p2cnpud3ptZnl0amxwZnNrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzNzA4NTEsImV4cCI6MjA3Mzk0Njg1MX0.R3Y2Xb9PmLr3sCLSdJov4Mgk1eAmhaCIPXEKq6u8NQI')
SENDER_EMAIL = os.getenv('SENDER_EMAIL', 'beeper9@naver.com')
SENDER_PASSWORD = os.getenv('SENDER_PASSWORD', 'QCJ4HC81QPW7')
RECEIVER_EMAIL = os.getenv('RECEIVER_EMAIL', 'ku9.kim@samsung.com')

def get_chrome_driver():
    """Chrome 드라이버 설정"""
    chrome_options = Options()
    chrome_options.add_argument('--headless')  # 백그라운드 실행
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--disable-gpu')
    chrome_options.add_argument('--window-size=1920,1080')
    chrome_options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
    
    # 크롬 드라이버 경로 설정
    chromedriver_path = r'C:\chromedriver\chromedriver.exe'
    
    # 파일이 없으면 chromedriver.exe만 시도
    if not os.path.exists(chromedriver_path):
        chromedriver_path = r'C:\chromedriver.exe'
    
    service = Service(chromedriver_path)
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver

def filter_by_time(results, allowed_times=['19:00', '20:00']):
    """모니터링 시간 필터링 (19:00, 20:00만 허용)"""
    filtered_results = []
    for result in results:
        time_slot = result.get('time', '')
        # 시간 형식 정규화 및 확인
        if time_slot:
            # 시간 형식 정규화 (HH:MM)
            time_match = re.search(r'(\d{1,2}):?(\d{2})?', time_slot)
            if time_match:
                hour = time_match.group(1).zfill(2)
                minute = time_match.group(2) if time_match.group(2) else "00"
                normalized_time = f"{hour}:{minute}"
                
                # 허용된 시간인지 확인
                if normalized_time in allowed_times:
                    result['time'] = normalized_time
                    filtered_results.append(result)
            else:
                # 시간 형식이 없으면 원본 시간으로 확인
                if any(allowed_time in time_slot for allowed_time in allowed_times):
                    filtered_results.append(result)
    return filtered_results

def scrape_reservations(base_date):
    """특정 날짜의 예약현황을 스크래핑"""
    url = f"https://life.gangnam.go.kr/fmcs/54?facilities_type=T&base_date={base_date}&rent_type=1001&center=GNCC02&part=17&place=2#proc_list_tab"
    
    driver = None
    try:
        driver = get_chrome_driver()
        logger.info(f"페이지 접속: {url}")
        driver.get(url)
        
        # 페이지 로딩 대기 (동적 콘텐츠 로딩 시간 확보)
        time.sleep(5)
        
        # iframe이 있는지 확인
        try:
            iframes = driver.find_elements(By.TAG_NAME, "iframe")
            if iframes:
                logger.info(f"iframe 발견: {len(iframes)}개")
                driver.switch_to.frame(iframes[0])
                time.sleep(2)
        except:
            pass
        
        # 예약 목록이 로드될 때까지 대기
        wait = WebDriverWait(driver, 15)
        
        results = []
        
        # regist_list 클래스 찾기
        try:
            # regist_list 요소 찾기
            regist_list_element = None
            regist_list_selectors = [
                ".regist_list",
                "table.regist_list",
                ".regist_list table"
            ]
            
            for selector in regist_list_selectors:
                try:
                    elements = driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        regist_list_element = elements[0]
                        logger.info(f"regist_list 요소 발견: {selector}")
                        break
                except:
                    continue
            
            if not regist_list_element:
                # regist_list를 직접 찾기
                try:
                    regist_list_element = driver.find_element(By.CLASS_NAME, "regist_list")
                    logger.info("regist_list 클래스 직접 발견")
                except:
                    pass
            
            if regist_list_element:
                # regist_list 내부의 테이블 찾기
                table = None
                try:
                    table = regist_list_element.find_element(By.TAG_NAME, "table")
                except:
                    # regist_list 자체가 테이블일 수 있음
                    if regist_list_element.tag_name == "table":
                        table = regist_list_element
                
                if table:
                    # 테이블 행 찾기
                    rows = table.find_elements(By.TAG_NAME, "tr")
                    logger.info(f"regist_list 테이블 행 수: {len(rows)}")
                    
                    # 헤더 행 확인 (첫 번째 행이 헤더일 수 있음)
                    header_row = None
                    if len(rows) > 0:
                        first_row_cells = rows[0].find_elements(By.TAG_NAME, "th")
                        if len(first_row_cells) > 0:
                            header_row = rows[0]
                            logger.info("헤더 행 발견")
                    
                    # 데이터 행 처리 (헤더 제외)
                    start_idx = 1 if header_row else 0
                    
                    for idx, row in enumerate(rows[start_idx:], start_idx + 1):
                        try:
                            cells = row.find_elements(By.TAG_NAME, "td")
                            
                            if len(cells) < 4:  # 최소 4개 셀 필요 (선택, 시간, 요금, 예약팀, 예약자)
                                continue
                            
                            # 체크박스 확인 (첫 번째 셀 또는 행 전체에서)
                            checkbox = None
                            checkbox_found = False
                            is_selected = False
                            
                            try:
                                # 첫 번째 셀에서 체크박스 찾기
                                checkbox = cells[0].find_element(By.CSS_SELECTOR, "input[type='checkbox']")
                                checkbox_found = True
                                # 체크박스가 비활성화되어 있으면 예약됨
                                is_selected = checkbox.get_attribute("disabled") is not None or not checkbox.is_enabled()
                                logger.debug(f"행 {idx}: 체크박스 발견, disabled={checkbox.get_attribute('disabled')}, enabled={checkbox.is_enabled()}")
                            except:
                                # 행 전체에서 체크박스 찾기
                                try:
                                    checkbox = row.find_element(By.CSS_SELECTOR, "input[type='checkbox']")
                                    checkbox_found = True
                                    is_selected = checkbox.get_attribute("disabled") is not None or not checkbox.is_enabled()
                                except:
                                    pass
                            
                            # 체크박스가 없으면 텍스트로 판단
                            if not checkbox_found:
                                row_text = row.text
                                is_selected = (
                                    "예약됨" in row_text or 
                                    "예약완료" in row_text or
                                    "불가" in row_text or
                                    "불가능" in row_text
                                )
                            
                            # 셀 내용 추출 (일반적인 구조: 선택(체크박스), 시간, 요금, 예약팀, 예약자)
                            # 체크박스가 첫 번째 셀에 있으면 인덱스 조정
                            cell_start_idx = 0
                            if checkbox_found and checkbox and cells[0].find_elements(By.CSS_SELECTOR, "input[type='checkbox']"):
                                cell_start_idx = 1  # 체크박스 셀 건너뛰기
                            
                            # 시간 (보통 두 번째 또는 세 번째 셀)
                            time_slot = ""
                            if len(cells) > cell_start_idx:
                                time_slot = cells[cell_start_idx].text.strip()
                            
                            # 요금 (시간 다음 셀)
                            fee = ""
                            if len(cells) > cell_start_idx + 1:
                                fee = cells[cell_start_idx + 1].text.strip()
                            
                            # 예약팀
                            team = ""
                            if len(cells) > cell_start_idx + 2:
                                team = cells[cell_start_idx + 2].text.strip()
                            
                            # 예약자
                            reservator = ""
                            if len(cells) > cell_start_idx + 3:
                                reservator = cells[cell_start_idx + 3].text.strip()
                            
                            # 데이터 정제: 요금에서 숫자 또는 "예약불가" 추출
                            if fee:
                                # "예약불가" 또는 "불가" 텍스트 확인
                                if "예약불가" in fee or "불가" in fee:
                                    fee = "예약불가"
                                else:
                                    # 숫자만 추출 (금액)
                                    fee_numbers = re.findall(r'\d+', fee)
                                    if fee_numbers:
                                        # 숫자들을 합쳐서 금액으로 표시
                                        fee = ''.join(fee_numbers)
                                    # 숫자가 없으면 원본 유지
                            
                            # 시간 정제: 시간 형식만 추출 (예: "09:00", "09시" 등)
                            if time_slot:
                                # 시간 형식 찾기 (HH:MM, HH시 MM분 등)
                                time_match = re.search(r'(\d{1,2}):?(\d{2})?', time_slot)
                                if time_match:
                                    hour = time_match.group(1)
                                    minute = time_match.group(2) if time_match.group(2) else "00"
                                    time_slot = f"{hour.zfill(2)}:{minute}"
                                else:
                                    # 시간 형식이 아니면 원본 유지 (이미 시간 형식일 수 있음)
                                    pass
                            
                            # 유효한 데이터만 추가
                            if time_slot or fee or team or reservator:
                                results.append({
                                    "date": base_date,
                                    "selected": "예약됨" if is_selected else "예약가능",
                                    "time": time_slot,
                                    "fee": fee,
                                    "team": team,
                                    "reservator": reservator
                                })
                                logger.debug(f"행 {idx} 파싱: 선택={is_selected}, 시간={time_slot}, 요금={fee}, 팀={team}, 예약자={reservator}")
                        except Exception as e:
                            logger.warning(f"행 {idx} 파싱 오류: {e}")
                            continue
                else:
                    logger.warning("regist_list 내부에 테이블을 찾을 수 없습니다.")
            else:
                logger.warning("regist_list 클래스를 찾을 수 없습니다.")
            
            # 테이블이 없으면 다른 구조 시도
            if not results:
                logger.info("테이블을 찾지 못함. 다른 구조 시도 중...")
                
                # 리스트 형태의 예약 정보 찾기
                list_selectors = [
                    ".regist_list",
                    ".regist_list .list-item",
                    ".reservation-list",
                    ".list-item",
                    "[class*='reservation']",
                    "[class*='item']",
                    "[class*='list']",
                    ".time-slot",
                    "[data-time]"
                ]
                
                for selector in list_selectors:
                    try:
                        items = driver.find_elements(By.CSS_SELECTOR, selector)
                        if items:
                            logger.info(f"리스트 아이템 발견: {selector}, {len(items)}개")
                            for item in items:
                                try:
                                    text = item.text
                                    if any(keyword in text for keyword in ["시", "분", "원", "팀", "예약"]):
                                        results.append({
                                            "date": base_date,
                                            "selected": "예약됨" if "예약" in text or "불가" in text else "예약가능",
                                            "time": text.split()[0] if text.split() else "",
                                            "fee": "",
                                            "team": "",
                                            "reservator": ""
                                        })
                                except:
                                    continue
                            if results:
                                break
                    except:
                        continue
            
            # 결과가 없으면 페이지 구조 분석
            if not results:
                logger.warning("데이터를 찾지 못했습니다. 페이지 구조 분석 중...")
                page_source = driver.page_source
                
                # 페이지 제목 확인
                try:
                    title = driver.title
                    logger.info(f"페이지 제목: {title}")
                except:
                    pass
                
                # 주요 요소 확인
                try:
                    body_text = driver.find_element(By.TAG_NAME, "body").text[:500]
                    logger.info(f"페이지 본문 일부: {body_text}")
                except:
                    pass
                
                # 기본 정보 반환
                results.append({
                    "date": base_date,
                    "selected": "데이터 없음",
                    "time": "",
                    "fee": "",
                    "team": "",
                    "reservator": "페이지 구조를 확인할 수 없습니다"
                })
            else:
                logger.info(f"스크래핑 성공: {len(results)}개 항목 발견")
        
        except Exception as e:
            logger.error(f"스크래핑 오류: {e}", exc_info=True)
            results.append({
                "date": base_date,
                "selected": "오류",
                "time": "",
                "fee": "",
                "team": "",
                "reservator": f"오류: {str(e)}"
            })
        
        # iframe에서 나오기
        try:
            driver.switch_to.default_content()
        except:
            pass
        
        # 시간 필터링 (19:00, 20:00만 허용)
        if results:
            original_count = len(results)
            results = filter_by_time(results)
            logger.info(f"시간 필터링: {original_count}개 → {len(results)}개 (19:00, 20:00만 표시)")
        
        return results
    
    except Exception as e:
        logger.error(f"드라이버 오류: {e}", exc_info=True)
        return [{
            "date": base_date,
            "selected": "오류",
            "time": "",
            "fee": "",
            "team": "",
            "reservator": f"드라이버 오류: {str(e)}"
        }]
    
    finally:
        if driver:
            try:
                driver.quit()
            except:
                pass

def load_json_data():
    """JSON 파일에서 데이터 로드"""
    if not os.path.exists(JSON_FILE):
        return []
    
    try:
        with open(JSON_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"JSON 파일 읽기 오류: {e}")
        return []

def save_json_data(data):
    """JSON 파일에 데이터 저장"""
    try:
        with open(JSON_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"JSON 파일 저장 오류: {e}")
        return False

def save_to_json(reservations):
    """JSON 파일에 예약 데이터 저장"""
    try:
        # 기존 데이터 로드
        all_data = load_json_data()
        
        # 기존 데이터에서 같은 날짜의 데이터 제거
        dates = list(set([r['date'] for r in reservations]))
        all_data = [r for r in all_data if r.get('date') not in dates]
        
        # 새 데이터 추가 (타임스탬프 포함)
        for reservation in reservations:
            reservation['created_at'] = datetime.now().isoformat()
            all_data.append(reservation)
        
        # 저장
        return save_json_data(all_data)
    except Exception as e:
        logger.error(f"JSON 저장 오류: {e}")
        return False

def get_from_json(dates):
    """JSON 파일에서 예약 데이터 조회"""
    try:
        all_data = load_json_data()
        results = [r for r in all_data if r.get('date') in dates]
        return results
    except Exception as e:
        logger.error(f"JSON 조회 오류: {e}")
        return []

def load_monitoring_dates():
    """저장된 모니터링 날짜 목록 로드"""
    if not os.path.exists(DATES_FILE):
        return []
    
    try:
        with open(DATES_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as e:
        logger.error(f"모니터링 날짜 파일 읽기 오류: {e}")
        return []

def save_monitoring_dates(dates):
    """모니터링 날짜 목록 저장"""
    try:
        with open(DATES_FILE, 'w', encoding='utf-8') as f:
            json.dump(dates, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"모니터링 날짜 파일 저장 오류: {e}")
        return False

def add_monitoring_date(date):
    """모니터링 날짜 추가"""
    dates = load_monitoring_dates()
    # 중복 제거 및 추가
    if date not in dates:
        dates.append(date)
        dates.sort()  # 날짜 순서대로 정렬
        return save_monitoring_dates(dates)
    return True

def delete_monitoring_date(date):
    """모니터링 날짜 삭제"""
    dates = load_monitoring_dates()
    if date in dates:
        dates.remove(date)
        return save_monitoring_dates(dates)
    return True

def load_email_receivers():
    """이메일 수신자 목록 로드"""
    if not os.path.exists(RECEIVERS_FILE):
        # 기본 수신자 설정
        default_receivers = [RECEIVER_EMAIL]
        save_email_receivers(default_receivers)
        return default_receivers
    
    try:
        with open(RECEIVERS_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return data if isinstance(data, list) else [RECEIVER_EMAIL]
    except Exception as e:
        logger.error(f"이메일 수신자 파일 읽기 오류: {e}")
        return [RECEIVER_EMAIL]

def save_email_receivers(receivers):
    """이메일 수신자 목록 저장"""
    try:
        with open(RECEIVERS_FILE, 'w', encoding='utf-8') as f:
            json.dump(receivers, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        logger.error(f"이메일 수신자 파일 저장 오류: {e}")
        return False

def add_email_receiver(email):
    """이메일 수신자 추가"""
    receivers = load_email_receivers()
    # 중복 제거 및 추가
    if email not in receivers:
        receivers.append(email)
        return save_email_receivers(receivers)
    return True

def delete_email_receiver(email):
    """이메일 수신자 삭제"""
    receivers = load_email_receivers()
    if email in receivers:
        receivers.remove(email)
        return save_email_receivers(receivers)
    return True

@app.route('/')
def index():
    """메인 페이지"""
    return render_template('index.html')

@app.route('/api/monitor', methods=['POST'])
def monitor():
    """예약현황 모니터링 요청"""
    data = request.json or {}
    dates = data.get('dates', [])
    
    # dates가 없으면 저장된 날짜 목록 사용
    if not dates:
        saved_dates = load_monitoring_dates()
        if saved_dates:
            dates = saved_dates
            logger.info(f"저장된 날짜 목록 사용: {dates}")
        else:
            return jsonify({'error': '날짜가 필요합니다. 저장된 날짜가 없습니다.'}), 400
    
    if len(dates) > 5:
        dates = dates[:5]  # 최대 5개까지만 사용
        logger.warning(f"날짜가 5개를 초과하여 처음 5개만 사용합니다.")
    
    all_results = []
    
    for date in dates:
        # 날짜 형식 변환 (YYYYMMDD)
        if isinstance(date, str):
            # YYYY-MM-DD 형식을 YYYYMMDD로 변환
            if '-' in date:
                date = date.replace('-', '')
        
        logger.info(f"스크래핑 시작: {date}")
        results = scrape_reservations(date)
        all_results.extend(results)
        
        # JSON 파일에 저장
        save_to_json(results)
        
        # 요청 간 딜레이
        time.sleep(2)
    
    # 예약가능한 항목이 있으면 이메일 발송
    available_reservations = check_available_reservations(all_results)
    if available_reservations:
        send_availability_email(available_reservations)
    
    return jsonify({'results': all_results})

def check_available_reservations(results):
    """예약가능한 항목 확인 및 날짜별 그룹화"""
    available_by_date = {}
    
    for result in results:
        if result.get('selected') == '예약가능':
            date = result.get('date', '')
            time_slot = result.get('time', '')
            
            if date and time_slot:
                if date not in available_by_date:
                    available_by_date[date] = []
                available_by_date[date].append(time_slot)
    
    return available_by_date

def send_availability_email(available_reservations):
    """예약가능한 항목이 있을 때 이메일 발송"""
    try:
        # 날짜별로 이메일 본문 생성
        email_body_parts = []
        email_body_parts.append("예약가능한 시간이 발견되었습니다!\n\n")
        
        all_dates = []
        all_times = []
        
        for date, times in available_reservations.items():
            # 날짜 포맷팅 (YYYYMMDD -> YYYY-MM-DD)
            formatted_date = format_date_for_email(date)
            # 모니터링 링크 생성
            monitoring_url = f"https://life.gangnam.go.kr/fmcs/54?facilities_type=T&base_date={date}&rent_type=1001&center=GNCC02&part=17&place=2#proc_list_tab"
            
            email_body_parts.append(f"📅 날짜: {formatted_date}\n")
            email_body_parts.append(f"⏰ 예약가능한 시간:\n")
            for time_slot in times:
                email_body_parts.append(f"  - {time_slot}\n")
            email_body_parts.append(f"🔗 모니터링 바로가기: {monitoring_url}\n")
            email_body_parts.append("\n")
            
            # 모든 날짜와 시간 수집
            all_dates.append(date)
            all_times.extend(times)
        
        email_body_parts.append(f"\n모니터링 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        
        email_body = ''.join(email_body_parts)
        email_subject = f"예약가능 알림 - {len(available_reservations)}개 날짜"
        
        # Edge Function을 통한 이메일 발송
        # 여러 날짜가 있으면 첫 번째 날짜를 대표로 사용하되, 모든 시간을 포함
        send_email_via_edge_function(
            date=all_dates[0] if all_dates else '',
            available_times=all_times,
            subject=email_subject,
            body=email_body
        )
        
        logger.info(f"예약가능 이메일 발송 완료: {len(available_reservations)}개 날짜, {len(all_times)}개 시간")
        
    except Exception as e:
        logger.error(f"예약가능 이메일 발송 오류: {e}")

def format_date_for_email(date_str):
    """날짜 포맷팅 (YYYYMMDD -> YYYY-MM-DD)"""
    if len(date_str) == 8 and date_str.isdigit():
        return f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
    return date_str

def send_email_via_edge_function(date, available_times, subject=None, body=None):
    """Edge Function을 통한 이메일 발송"""
    try:
        import requests
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        # Edge Function URL
        edge_function_url = f"{SUPABASE_URL}/functions/v1/send-reservation-email"
        
        # 이메일 본문 생성
        if not body:
            body = f"날짜: {date}\n예약가능한 시간: {', '.join(available_times)}"
        
        if not subject:
            subject = "예약가능 알림"
        
        # 수신자 목록 가져오기
        receivers = load_email_receivers()
        
        # 모든 수신자에게 이메일 발송
        success_count = 0
        for receiver_email in receivers:
            # Edge Function 호출
            response = requests.post(
                edge_function_url,
                json={
                    'sender_email': SENDER_EMAIL,
                    'sender_password': SENDER_PASSWORD,
                    'receiver_email': receiver_email,
                    'subject': subject,
                    'body': body,
                    'date': date,
                    'available_times': available_times
                },
                headers={
                    'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
                    'Content-Type': 'application/json'
                },
                verify=False
            )
            
            if response.status_code == 200:
                logger.info(f"Edge Function을 통한 이메일 발송 성공: {receiver_email}")
                success_count += 1
            else:
                logger.warning(f"Edge Function 이메일 발송 실패 ({receiver_email}): {response.status_code}")
                # Edge Function 실패 시 SMTP로 대체
                if send_email_smtp(SENDER_EMAIL, SENDER_PASSWORD, receiver_email, subject, body):
                    success_count += 1
        
        if success_count > 0:
            logger.info(f"총 {len(receivers)}명 중 {success_count}명에게 이메일 발송 완료")
            return True
        else:
            return False
            
    except Exception as e:
        logger.error(f"Edge Function 이메일 발송 오류: {e}")
        # Edge Function 실패 시 SMTP로 대체
        try:
            return send_email_smtp(SENDER_EMAIL, SENDER_PASSWORD, RECEIVER_EMAIL, subject or "예약가능 알림", body or "")
        except:
            return False

@app.route('/api/reservations', methods=['GET'])
def get_reservations():
    """저장된 예약 데이터 조회"""
    dates = request.args.getlist('dates')
    
    if not dates:
        return jsonify({'error': '날짜가 필요합니다.'}), 400
    
    results = get_from_json(dates)
    return jsonify({'results': results})

@app.route('/api/monitoring-dates', methods=['GET'])
def get_monitoring_dates():
    """저장된 모니터링 날짜 목록 조회"""
    dates = load_monitoring_dates()
    return jsonify({'dates': dates})

@app.route('/api/monitoring-dates', methods=['POST'])
def save_monitoring_date():
    """모니터링 날짜 저장"""
    data = request.json
    date = data.get('date')
    
    if not date:
        return jsonify({'error': '날짜가 필요합니다.'}), 400
    
    # 날짜 형식 정규화 (YYYY-MM-DD)
    if isinstance(date, str) and len(date) == 8 and '-' not in date:
        # YYYYMMDD -> YYYY-MM-DD
        date = f"{date[:4]}-{date[4:6]}-{date[6:8]}"
    
    if add_monitoring_date(date):
        return jsonify({'success': True, 'message': '날짜가 저장되었습니다.'})
    else:
        return jsonify({'error': '날짜 저장에 실패했습니다.'}), 500

@app.route('/api/monitoring-dates', methods=['DELETE'])
def remove_monitoring_date():
    """모니터링 날짜 삭제"""
    data = request.json
    date = data.get('date')
    
    if not date:
        return jsonify({'error': '날짜가 필요합니다.'}), 400
    
    # 날짜 형식 정규화
    if isinstance(date, str) and len(date) == 8 and '-' not in date:
        date = f"{date[:4]}-{date[4:6]}-{date[6:8]}"
    
    if delete_monitoring_date(date):
        return jsonify({'success': True, 'message': '날짜가 삭제되었습니다.'})
    else:
        return jsonify({'error': '날짜 삭제에 실패했습니다.'}), 500

@app.route('/api/email-receivers', methods=['GET'])
def get_email_receivers():
    """이메일 수신자 목록 조회"""
    receivers = load_email_receivers()
    return jsonify({'receivers': receivers})

@app.route('/api/email-receivers', methods=['POST'])
def add_email_receiver_api():
    """이메일 수신자 추가"""
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'error': '이메일 주소가 필요합니다.'}), 400
    
    # 이메일 형식 간단 검증
    if '@' not in email:
        return jsonify({'error': '올바른 이메일 주소 형식이 아닙니다.'}), 400
    
    if add_email_receiver(email):
        return jsonify({'success': True, 'message': '수신자가 추가되었습니다.'})
    else:
        return jsonify({'error': '수신자 추가에 실패했습니다.'}), 500

@app.route('/api/email-receivers', methods=['DELETE'])
def delete_email_receiver_api():
    """이메일 수신자 삭제"""
    data = request.json
    email = data.get('email')
    
    if not email:
        return jsonify({'error': '이메일 주소가 필요합니다.'}), 400
    
    if delete_email_receiver(email):
        return jsonify({'success': True, 'message': '수신자가 삭제되었습니다.'})
    else:
        return jsonify({'error': '수신자 삭제에 실패했습니다.'}), 500

def send_email_smtp(sender_email, sender_password, receiver_email, subject, body):
    """SMTP를 통한 이메일 발송"""
    try:
        # Naver SMTP 설정
        smtp_server = 'smtp.naver.com'
        smtp_port = 587
        
        logger.info(f"SMTP 서버 연결 시도: {smtp_server}:{smtp_port}")
        logger.info(f"발신자: {sender_email}, 수신자: {receiver_email}, 제목: {subject}")
        
        # 이메일 메시지 생성
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = receiver_email
        msg['Subject'] = subject
        
        # 본문 추가
        msg.attach(MIMEText(body, 'plain', 'utf-8'))
        
        logger.info("SMTP 서버 연결 중...")
        # SMTP 서버 연결 및 이메일 발송
        server = smtplib.SMTP(smtp_server, smtp_port)
        logger.info("SMTP 서버 연결 성공, TLS 시작...")
        server.starttls()  # TLS 암호화
        logger.info("TLS 연결 성공, 로그인 시도...")
        server.login(sender_email, sender_password)
        logger.info("SMTP 로그인 성공, 이메일 발송 중...")
        text = msg.as_string()
        server.sendmail(sender_email, receiver_email, text)
        server.quit()
        logger.info(f"이메일 발송 성공: {receiver_email}")
        return True
    except Exception as e:
        logger.error(f"이메일 발송 오류: {e}", exc_info=True)
        return False

@app.route('/api/send-email', methods=['POST'])
def send_email():
    """이메일 발송 테스트 (SMTP 직접 사용)"""
    try:
        data = request.json or {}
        
        # 기본값 사용 또는 요청 데이터 사용
        sender_email = data.get('sender_email', SENDER_EMAIL)
        sender_password = data.get('sender_password', SENDER_PASSWORD)
        receiver_email = data.get('receiver_email', RECEIVER_EMAIL)
        subject = data.get('subject', '예약현황 모니터링 테스트 이메일')
        body = data.get('body', '이것은 테스트 이메일입니다.')
        
        # SMTP를 통한 이메일 발송
        success = send_email_smtp(sender_email, sender_password, receiver_email, subject, body)
        
        if success:
            return jsonify({
                'success': True,
                'message': '이메일이 성공적으로 발송되었습니다.',
                'details': {
                    'from': sender_email,
                    'to': receiver_email,
                    'subject': subject
                }
            })
        else:
            return jsonify({
                'success': False,
                'error': '이메일 발송에 실패했습니다.'
            }), 500
            
    except Exception as e:
        logger.error(f"이메일 발송 API 오류: {e}")
        return jsonify({
            'success': False,
            'error': f'이메일 발송 중 오류가 발생했습니다: {str(e)}'
        }), 500

@app.route('/api/send-email-internal', methods=['POST'])
def send_email_internal():
    """Edge Function에서 호출하는 내부 이메일 발송 API"""
    try:
        logger.info("내부 이메일 발송 API 호출됨")
        data = request.json or {}
        
        sender_email = data.get('sender_email', SENDER_EMAIL)
        sender_password = data.get('sender_password', SENDER_PASSWORD)
        receiver_email = data.get('receiver_email')
        subject = data.get('subject', '예약현황 모니터링 알림')
        body = data.get('body', '')
        
        logger.info(f"요청 데이터: 발신자={sender_email}, 수신자={receiver_email}, 제목={subject}")
        
        if not receiver_email:
            logger.warning("수신자 이메일이 없습니다.")
            return jsonify({
                'success': False,
                'error': 'receiver_email가 필요합니다.'
            }), 400
        
        logger.info("SMTP 이메일 발송 함수 호출 시작")
        # SMTP를 통한 이메일 발송
        success = send_email_smtp(sender_email, sender_password, receiver_email, subject, body)
        logger.info(f"SMTP 이메일 발송 결과: {success}")
        
        if success:
            return jsonify({
                'success': True,
                'message': '이메일이 성공적으로 발송되었습니다.'
            })
        else:
            return jsonify({
                'success': False,
                'error': '이메일 발송에 실패했습니다.'
            }), 500
            
    except Exception as e:
        logger.error(f"내부 이메일 발송 API 오류: {e}")
        return jsonify({
            'success': False,
            'error': f'이메일 발송 중 오류가 발생했습니다: {str(e)}'
        }), 500

@app.route('/api/send-email-edge', methods=['POST'])
def send_email_edge():
    """Supabase Edge Function을 통한 이메일 발송 테스트"""
    try:
        import requests
        
        data = request.json or {}
        
        # 기본값 사용 또는 요청 데이터 사용
        sender_email = data.get('sender_email', SENDER_EMAIL)
        sender_password = data.get('sender_password', SENDER_PASSWORD)
        receiver_email = data.get('receiver_email', RECEIVER_EMAIL)
        subject = data.get('subject', '예약현황 모니터링 테스트 이메일')
        body = data.get('body', '이것은 테스트 이메일입니다.')
        
        # Edge Function URL
        edge_function_url = f"{SUPABASE_URL}/functions/v1/send-reservation-email"
        
        # Edge Function 호출 (SSL 검증 비활성화 - 개발 환경용)
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        
        response = requests.post(
            edge_function_url,
            json={
                'sender_email': sender_email,
                'sender_password': sender_password,
                'receiver_email': receiver_email,
                'subject': subject,
                'body': body
            },
            headers={
                'Authorization': f'Bearer {SUPABASE_ANON_KEY}',
                'Content-Type': 'application/json'
            },
            verify=False  # SSL 검증 비활성화 (개발 환경용)
        )
        
        if response.status_code == 200:
            return jsonify({
                'success': True,
                'message': 'Edge Function 호출 성공',
                'edge_function_response': response.json()
            })
        else:
            return jsonify({
                'success': False,
                'error': f'Edge Function 호출 실패: {response.status_code}',
                'details': response.text
            }), response.status_code
            
    except Exception as e:
        logger.error(f"Edge Function 호출 오류: {e}")
        return jsonify({
            'success': False,
            'error': f'Edge Function 호출 중 오류가 발생했습니다: {str(e)}'
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)

