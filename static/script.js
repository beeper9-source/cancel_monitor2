let selectedDates = [];

// 날짜 추가 버튼 클릭
document.getElementById('add-date-btn').addEventListener('click', function() {
    if (selectedDates.length >= 5) {
        alert('날짜는 최대 5개까지 선택할 수 있습니다.');
        return;
    }
    
    addDateInput();
});

// 모니터링 시작 버튼 클릭
document.getElementById('monitor-btn').addEventListener('click', function() {
    startMonitoring();
});

// 저장된 날짜 불러오기 버튼 클릭
document.getElementById('load-saved-dates-btn').addEventListener('click', function() {
    loadSavedDates();
});

// 날짜 입력 필드 추가
function addDateInput() {
    const dateInputs = document.querySelector('.date-inputs');
    const index = selectedDates.length;
    
    const dateItem = document.createElement('div');
    dateItem.className = 'date-item';
    dateItem.innerHTML = `
        <input type="date" class="date-picker" data-index="${index}">
        <button class="remove-date" data-index="${index}" style="display: none;">삭제</button>
        <button class="save-date-btn" data-index="${index}" style="display: none;">저장</button>
    `;
    
    dateInputs.appendChild(dateItem);
    
    // 삭제 버튼 이벤트
    const removeBtn = dateItem.querySelector('.remove-date');
    removeBtn.addEventListener('click', function() {
        removeDateInput(index);
    });
    
    // 저장 버튼 이벤트
    const saveBtn = dateItem.querySelector('.save-date-btn');
    saveBtn.addEventListener('click', function() {
        const datePicker = dateItem.querySelector('.date-picker');
        const date = datePicker.value;
        if (date) {
            saveDate(date);
        } else {
            alert('날짜를 선택해주세요.');
        }
    });
    
    // 날짜 변경 이벤트
    dateItem.querySelector('.date-picker').addEventListener('change', function() {
        updateSelectedDates();
        // 날짜가 입력되면 저장 버튼 표시
        if (this.value) {
            saveBtn.style.display = 'block';
        } else {
            saveBtn.style.display = 'none';
        }
    });
    
    selectedDates.push(null);
}

// 날짜 입력 필드 제거
function removeDateInput(index) {
    const dateItem = document.querySelector(`.date-item:has(.date-picker[data-index="${index}"])`);
    if (dateItem) {
        dateItem.remove();
        selectedDates.splice(index, 1);
        updateDateIndices();
        updateSelectedDates();
    }
}

// 날짜 인덱스 업데이트
function updateDateIndices() {
    const dateItems = document.querySelectorAll('.date-item');
    dateItems.forEach((item, newIndex) => {
        const picker = item.querySelector('.date-picker');
        const removeBtn = item.querySelector('.remove-date');
        picker.setAttribute('data-index', newIndex);
        removeBtn.setAttribute('data-index', newIndex);
    });
}

// 선택된 날짜 업데이트
function updateSelectedDates() {
    selectedDates = [];
    const datePickers = document.querySelectorAll('.date-picker');
    
    datePickers.forEach((picker) => {
        const date = picker.value;
        if (date) {
            selectedDates.push(date);
        }
    });
    
    // 삭제 버튼 표시/숨김
    const dateItems = document.querySelectorAll('.date-item');
    dateItems.forEach((item, index) => {
        const removeBtn = item.querySelector('.remove-date');
        const saveBtn = item.querySelector('.save-date-btn');
        if (dateItems.length > 1) {
            removeBtn.style.display = 'block';
        } else {
            removeBtn.style.display = 'none';
        }
        // 날짜가 입력되어 있으면 저장 버튼 표시
        const datePicker = item.querySelector('.date-picker');
        if (datePicker && datePicker.value) {
            saveBtn.style.display = 'block';
        }
    });
}

// 모니터링 시작
async function startMonitoring() {
    // 로딩 표시
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results-section').style.display = 'none';
    document.getElementById('monitor-btn').disabled = true;
    
    try {
        // 저장된 날짜 목록 불러오기
        const datesResponse = await fetch('/api/monitoring-dates');
        const datesData = await datesResponse.json();
        
        if (!datesResponse.ok) {
            throw new Error('저장된 날짜 목록을 불러올 수 없습니다.');
        }
        
        const savedDates = datesData.dates || [];
        
        if (savedDates.length === 0) {
            alert('저장된 날짜가 없습니다. 먼저 날짜를 저장해주세요.');
            document.getElementById('loading').style.display = 'none';
            document.getElementById('monitor-btn').disabled = false;
            return;
        }
        
        if (savedDates.length > 5) {
            alert(`저장된 날짜가 ${savedDates.length}개입니다. 최대 5개까지만 모니터링합니다.`);
            savedDates = savedDates.slice(0, 5);
        }
        
        // 날짜 형식 변환 (YYYY-MM-DD -> YYYYMMDD)
        const formattedDates = savedDates.map(date => {
            if (typeof date === 'string' && date.includes('-')) {
                return date.replace(/-/g, '');
            }
            return date;
        });
        
        console.log('모니터링 시작:', formattedDates);
        
        const response = await fetch('/api/monitor', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dates: formattedDates })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayResults(data.results);
        } else {
            alert('오류: ' + (data.error || '알 수 없는 오류가 발생했습니다.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('모니터링 중 오류가 발생했습니다: ' + error.message);
    } finally {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('monitor-btn').disabled = false;
    }
}

// 결과 표시
function displayResults(results) {
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '';
    
    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<div class="empty-message">결과가 없습니다.</div>';
        document.getElementById('results-section').style.display = 'block';
        return;
    }
    
    // 날짜별로 그룹화
    const groupedByDate = {};
    results.forEach(result => {
        const date = result.date;
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(result);
    });
    
    // 날짜별로 결과 표시
    Object.keys(groupedByDate).sort().forEach(date => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';
        
        // 날짜 포맷팅 (YYYYMMDD -> YYYY-MM-DD)
        const formattedDate = formatDate(date);
        
        // 모니터링 사이트 링크 생성
        const monitoringUrl = `https://life.gangnam.go.kr/fmcs/54?facilities_type=T&base_date=${date}&rent_type=1001&center=GNCC02&part=17&place=2#proc_list_tab`;
        
        dateGroup.innerHTML = `
            <h3>
                ${formattedDate} 
                <a href="${monitoringUrl}" target="_blank" class="monitoring-link" title="모니터링 사이트 열기">🔗</a>
            </h3>
            <table class="reservation-table">
                <thead>
                    <tr>
                        <th>선택</th>
                        <th>시간</th>
                        <th>요금</th>
                        <th>예약팀</th>
                        <th>예약자</th>
                    </tr>
                </thead>
                <tbody>
                    ${groupedByDate[date].map(result => `
                        <tr>
                            <td>
                                <span class="status-badge ${getStatusClass(result.selected)}">
                                    ${result.selected}
                                </span>
                            </td>
                            <td>${result.time || '-'}</td>
                            <td>${result.fee || '-'}</td>
                            <td>${result.team || '-'}</td>
                            <td>${result.reservator || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        resultsContainer.appendChild(dateGroup);
    });
    
    document.getElementById('results-section').style.display = 'block';
}

// 날짜 포맷팅 (YYYYMMDD -> YYYY-MM-DD)
function formatDate(dateStr) {
    if (dateStr.length === 8) {
        return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
    }
    return dateStr;
}

// 상태에 따른 CSS 클래스 반환
function getStatusClass(status) {
    if (status.includes('예약가능') || status.includes('가능')) {
        return 'status-available';
    } else if (status.includes('예약됨') || status.includes('예약')) {
        return 'status-reserved';
    } else if (status.includes('오류') || status.includes('없음')) {
        return 'status-error';
    }
    return 'status-available';
}

// 날짜 저장
async function saveDate(date) {
    try {
        const response = await fetch('/api/monitoring-dates', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date: date })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('날짜가 저장되었습니다.');
            loadSavedDates(); // 저장된 날짜 목록 새로고침
        } else {
            alert('오류: ' + (data.error || '날짜 저장에 실패했습니다.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('날짜 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 저장된 날짜 삭제
async function deleteSavedDate(date) {
    if (!confirm(`날짜 ${date}를 삭제하시겠습니까?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/monitoring-dates', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date: date })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('날짜가 삭제되었습니다.');
            loadSavedDates(); // 저장된 날짜 목록 새로고침
        } else {
            alert('오류: ' + (data.error || '날짜 삭제에 실패했습니다.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('날짜 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 저장된 날짜 목록 불러오기
async function loadSavedDates() {
    try {
        const response = await fetch('/api/monitoring-dates');
        const data = await response.json();
        
        if (response.ok) {
            displaySavedDates(data.dates || []);
        } else {
            console.error('저장된 날짜 불러오기 실패');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// 저장된 날짜 목록 표시
function displaySavedDates(dates) {
    const savedDatesSection = document.getElementById('saved-dates-section');
    const savedDatesList = document.getElementById('saved-dates-list');
    
    if (dates.length === 0) {
        savedDatesSection.style.display = 'none';
        return;
    }
    
    savedDatesSection.style.display = 'block';
    savedDatesList.innerHTML = '';
    
    dates.forEach(date => {
        const dateItem = document.createElement('div');
        dateItem.className = 'saved-date-item';
        dateItem.innerHTML = `
            <span>${date}</span>
            <button class="delete-saved-date" data-date="${date}">삭제</button>
        `;
        
        // 삭제 버튼 이벤트
        dateItem.querySelector('.delete-saved-date').addEventListener('click', function() {
            deleteSavedDate(date);
        });
        
        // 날짜 클릭 시 입력 필드에 추가
        dateItem.querySelector('span').style.cursor = 'pointer';
        dateItem.querySelector('span').addEventListener('click', function() {
            addDateFromSaved(date);
        });
        
        savedDatesList.appendChild(dateItem);
    });
}

// 저장된 날짜를 입력 필드에 추가
function addDateFromSaved(date) {
    if (selectedDates.length >= 5) {
        alert('날짜는 최대 5개까지 선택할 수 있습니다.');
        return;
    }
    
    // 빈 입력 필드 찾기 또는 새로 추가
    const datePickers = document.querySelectorAll('.date-picker');
    let added = false;
    
    for (let picker of datePickers) {
        if (!picker.value) {
            picker.value = date;
            updateSelectedDates();
            added = true;
            break;
        }
    }
    
    if (!added) {
        addDateInput();
        const newPickers = document.querySelectorAll('.date-picker');
        const lastPicker = newPickers[newPickers.length - 1];
        lastPicker.value = date;
        updateSelectedDates();
    }
}

// 초기 날짜 입력 필드에 이벤트 리스너 추가 및 저장된 날짜 불러오기
document.addEventListener('DOMContentLoaded', function() {
    const initialPicker = document.querySelector('.date-picker');
    if (initialPicker) {
        initialPicker.addEventListener('change', function() {
            updateSelectedDates();
            const saveBtn = document.querySelector('.save-date-btn');
            if (saveBtn && this.value) {
                saveBtn.style.display = 'block';
            }
        });
    }
    selectedDates.push(null);
    
    // 페이지 로드 시 저장된 날짜 불러오기
    loadSavedDates();
    
    // 이메일 테스트 버튼 이벤트
    const smtpBtn = document.getElementById('test-email-smtp-btn');
    const edgeBtn = document.getElementById('test-email-edge-btn');
    
    if (smtpBtn) {
        smtpBtn.addEventListener('click', testEmailSMTP);
    }
    
    if (edgeBtn) {
        edgeBtn.addEventListener('click', testEmailEdge);
    }
    
    // 수신자 관리 버튼 이벤트
    const addReceiverBtn = document.getElementById('add-receiver-btn');
    const receiverInput = document.getElementById('receiver-email-input');
    
    if (addReceiverBtn) {
        addReceiverBtn.addEventListener('click', addReceiver);
    }
    
    if (receiverInput) {
        receiverInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addReceiver();
            }
        });
    }
    
    // 페이지 로드 시 수신자 목록 불러오기
    loadReceivers();
    
    // 자동 모니터링 스케줄 관리 버튼 이벤트
    const saveScheduleBtn = document.getElementById('save-schedule-btn');
    const loadScheduleBtn = document.getElementById('load-schedule-btn');
    
    if (saveScheduleBtn) {
        saveScheduleBtn.addEventListener('click', saveSchedule);
    }
    
    if (loadScheduleBtn) {
        loadScheduleBtn.addEventListener('click', loadSchedule);
    }
    
    // 페이지 로드 시 스케줄 불러오기 및 상태 확인
    loadSchedule();
    checkScheduleStatus();
    
    // 주기적으로 스케줄 상태 확인 (30초마다)
    setInterval(checkScheduleStatus, 30000);
});

// 수신자 추가
async function addReceiver() {
    const input = document.getElementById('receiver-email-input');
    const email = input.value.trim();
    
    if (!email) {
        alert('이메일 주소를 입력해주세요.');
        return;
    }
    
    if (!email.includes('@')) {
        alert('올바른 이메일 주소 형식이 아닙니다.');
        return;
    }
    
    try {
        const response = await fetch('/api/email-receivers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            input.value = '';
            alert('수신자가 추가되었습니다.');
            loadReceivers();
        } else {
            alert('오류: ' + (data.error || '수신자 추가에 실패했습니다.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('수신자 추가 중 오류가 발생했습니다: ' + error.message);
    }
}

// 수신자 삭제
async function deleteReceiver(email) {
    if (!confirm(`수신자 ${email}를 삭제하시겠습니까?`)) {
        return;
    }
    
    try {
        const response = await fetch('/api/email-receivers', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: email })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert('수신자가 삭제되었습니다.');
            loadReceivers();
        } else {
            alert('오류: ' + (data.error || '수신자 삭제에 실패했습니다.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('수신자 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 수신자 목록 불러오기
async function loadReceivers() {
    try {
        const response = await fetch('/api/email-receivers');
        const data = await response.json();
        
        if (response.ok) {
            displayReceivers(data.receivers || []);
        } else {
            console.error('수신자 목록 불러오기 실패');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// 수신자 목록 표시
function displayReceivers(receivers) {
    const savedReceiversSection = document.getElementById('saved-receivers-section');
    const savedReceiversList = document.getElementById('saved-receivers-list');
    
    if (receivers.length === 0) {
        savedReceiversSection.style.display = 'none';
        return;
    }
    
    savedReceiversSection.style.display = 'block';
    savedReceiversList.innerHTML = '';
    
    receivers.forEach(email => {
        const receiverItem = document.createElement('div');
        receiverItem.className = 'saved-date-item';
        receiverItem.innerHTML = `
            <span>${email}</span>
            <button class="delete-saved-date" data-email="${email}">삭제</button>
        `;
        
        // 삭제 버튼 이벤트
        receiverItem.querySelector('.delete-saved-date').addEventListener('click', function() {
            deleteReceiver(email);
        });
        
        savedReceiversList.appendChild(receiverItem);
    });
}

// 스케줄 저장
async function saveSchedule() {
    const startTime = document.getElementById('start-time-input').value;
    const endTime = document.getElementById('end-time-input').value;
    const interval = parseInt(document.getElementById('interval-input').value);
    const enabled = document.getElementById('schedule-enabled').checked;
    
    if (!startTime || !endTime || !interval) {
        alert('시작시간, 종료시간, 주기를 모두 입력해주세요.');
        return;
    }
    
    if (interval < 1) {
        alert('주기는 1분 이상이어야 합니다.');
        return;
    }
    
    try {
        const response = await fetch('/api/monitoring-schedule', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                start_time: startTime,
                end_time: endTime,
                interval_minutes: interval,
                enabled: enabled
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert('스케줄이 저장되었습니다.');
            checkScheduleStatus();
        } else {
            alert('오류: ' + (data.error || '스케줄 저장에 실패했습니다.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('스케줄 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 스케줄 불러오기
async function loadSchedule() {
    try {
        const response = await fetch('/api/monitoring-schedule');
        const data = await response.json();
        
        if (response.ok && data.schedule) {
            const schedule = data.schedule;
            document.getElementById('start-time-input').value = schedule.start_time || '00:00';
            document.getElementById('end-time-input').value = schedule.end_time || '23:59';
            document.getElementById('interval-input').value = schedule.interval_minutes || 60;
            document.getElementById('schedule-enabled').checked = schedule.enabled !== false;
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// 스케줄 상태 확인
async function checkScheduleStatus() {
    try {
        const response = await fetch('/api/monitoring-schedule/status');
        const data = await response.json();
        
        const statusDiv = document.getElementById('schedule-status');
        if (statusDiv) {
            if (data.schedule && data.schedule.enabled) {
                statusDiv.style.display = 'block';
                if (data.is_running) {
                    statusDiv.innerHTML = `
                        <div class="status-running">
                            ✅ 자동 모니터링 실행 중<br>
                            시작시간: ${data.schedule.start_time} | 종료시간: ${data.schedule.end_time} | 주기: ${data.schedule.interval_minutes}분
                        </div>
                    `;
                } else {
                    statusDiv.innerHTML = `
                        <div class="status-stopped">
                            ⏸️ 자동 모니터링 대기 중<br>
                            시작시간: ${data.schedule.start_time} | 종료시간: ${data.schedule.end_time} | 주기: ${data.schedule.interval_minutes}분
                        </div>
                    `;
                }
            } else {
                statusDiv.style.display = 'none';
            }
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// SMTP 이메일 발송 테스트
async function testEmailSMTP() {
    const resultDiv = document.getElementById('email-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p>이메일 발송 중...</p>';
    
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subject: '예약현황 모니터링 테스트 이메일',
                body: '이것은 SMTP를 통한 테스트 이메일입니다.\n\n발송 시간: ' + new Date().toLocaleString('ko-KR')
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <div style="color: green;">
                    <h3>✅ 이메일 발송 성공</h3>
                    <p><strong>발신자:</strong> ${data.details.from}</p>
                    <p><strong>수신자:</strong> ${data.details.to}</p>
                    <p><strong>제목:</strong> ${data.details.subject}</p>
                    <p>${data.message}</p>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div style="color: red;">
                    <h3>❌ 이메일 발송 실패</h3>
                    <p>${data.error || '알 수 없는 오류가 발생했습니다.'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error:', error);
        resultDiv.innerHTML = `
            <div style="color: red;">
                <h3>❌ 오류 발생</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

// Edge Function 이메일 테스트
async function testEmailEdge() {
    const resultDiv = document.getElementById('email-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p>Edge Function 호출 중...</p>';
    
    try {
        const response = await fetch('/api/send-email-edge', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subject: '예약현황 모니터링 테스트 이메일 (Edge Function)',
                body: '이것은 Supabase Edge Function을 통한 테스트 이메일입니다.\n\n발송 시간: ' + new Date().toLocaleString('ko-KR')
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <div style="color: green;">
                    <h3>✅ Edge Function 호출 성공</h3>
                    <p>${data.message}</p>
                    <pre style="background: white; padding: 10px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(data.edge_function_response, null, 2)}</pre>
                </div>
            `;
        } else {
            resultDiv.innerHTML = `
                <div style="color: red;">
                    <h3>❌ Edge Function 호출 실패</h3>
                    <p>${data.error || '알 수 없는 오류가 발생했습니다.'}</p>
                    ${data.details ? `<pre style="background: white; padding: 10px; border-radius: 5px; overflow-x: auto;">${data.details}</pre>` : ''}
                </div>
            `;
        }
    } catch (error) {
        console.error('Error:', error);
        resultDiv.innerHTML = `
            <div style="color: red;">
                <h3>❌ 오류 발생</h3>
                <p>${error.message}</p>
            </div>
        `;
    }
}

