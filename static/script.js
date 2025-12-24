// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', function() {
    let dateCount = 1;
    const maxDates = 5;

    // 날짜 추가 버튼
    const addDateBtn = document.getElementById('add-date-btn');
    if (addDateBtn) {
        addDateBtn.addEventListener('click', function() {
            if (dateCount >= maxDates) {
                alert(`최대 ${maxDates}개까지 날짜를 추가할 수 있습니다.`);
                return;
            }

            const dateInputs = document.querySelector('.date-inputs');
            const newDateItem = document.createElement('div');
            newDateItem.className = 'date-item';
            newDateItem.innerHTML = `
                <input type="date" class="date-picker" data-index="${dateCount}">
                <button class="remove-date" data-index="${dateCount}">삭제</button>
                <button class="save-date-btn" data-index="${dateCount}">저장</button>
            `;
            dateInputs.appendChild(newDateItem);
            dateCount++;

            // 삭제 버튼 이벤트
            newDateItem.querySelector('.remove-date').addEventListener('click', function() {
                newDateItem.remove();
                dateCount--;
            });

            // 저장 버튼 이벤트
            newDateItem.querySelector('.save-date-btn').addEventListener('click', function() {
                const date = newDateItem.querySelector('.date-picker').value;
                if (date) {
                    saveDate(date);
                } else {
                    alert('날짜를 선택해주세요.');
                }
            });
        });
    }

    // 첫 번째 날짜 입력의 삭제/저장 버튼 표시
    const firstDateItem = document.querySelector('.date-item');
    if (firstDateItem) {
        const firstDateInput = firstDateItem.querySelector('.date-picker');
        if (firstDateInput) {
            firstDateInput.addEventListener('change', function() {
                const removeBtn = firstDateItem.querySelector('.remove-date');
                const saveBtn = firstDateItem.querySelector('.save-date-btn');
                if (this.value) {
                    removeBtn.style.display = 'inline-block';
                    saveBtn.style.display = 'inline-block';
                } else {
                    removeBtn.style.display = 'none';
                    saveBtn.style.display = 'none';
                }
            });
        }
    }

    // 모니터링 시작/종료 버튼
    const monitorBtn = document.getElementById('monitor-btn');
    const stopMonitorBtn = document.getElementById('stop-monitor-btn');
    
    if (monitorBtn) {
        monitorBtn.addEventListener('click', startMonitoring);
    }
    
    if (stopMonitorBtn) {
        stopMonitorBtn.addEventListener('click', stopMonitoring);
    }

    // 저장된 날짜 불러오기 버튼
    const loadSavedDatesBtn = document.getElementById('load-saved-dates-btn');
    if (loadSavedDatesBtn) {
        loadSavedDatesBtn.addEventListener('click', loadSavedDates);
    }

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
});

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
        
        if (response.ok && data.success) {
            alert('날짜가 저장되었습니다.');
            loadSavedDates();
        } else {
            alert('오류: ' + (data.error || '날짜 저장에 실패했습니다.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('날짜 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 저장된 날짜 불러오기
async function loadSavedDates() {
    try {
        const response = await fetch('/api/monitoring-dates');
        const data = await response.json();
        
        if (response.ok && data.dates) {
            if (data.dates.length > 0) {
                displaySavedDates(data.dates);
                // 날짜 입력 필드에 자동으로 채우기
                fillDateInputs(data.dates);
                alert(`저장된 날짜 ${data.dates.length}개를 불러왔습니다.`);
            } else {
                alert('저장된 날짜가 없습니다.');
                const savedDatesSection = document.getElementById('saved-dates-section');
                if (savedDatesSection) {
                    savedDatesSection.style.display = 'none';
                }
            }
        } else {
            alert('저장된 날짜를 불러오는 중 오류가 발생했습니다.');
            console.error('API 응답 오류:', data);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('저장된 날짜를 불러오는 중 오류가 발생했습니다: ' + error.message);
    }
}

// 날짜 입력 필드에 저장된 날짜 채우기
function fillDateInputs(dates) {
    const dateInputsContainer = document.querySelector('.date-inputs');
    if (!dateInputsContainer) return;
    
    // 기존 입력 필드 초기화 (첫 번째는 유지)
    const existingInputs = document.querySelectorAll('.date-picker');
    const firstInput = existingInputs[0];
    
    // 첫 번째 입력 필드 제외한 나머지 제거
    existingInputs.forEach((input, index) => {
        if (index > 0) {
            const dateItem = input.closest('.date-item');
            if (dateItem) {
                dateItem.remove();
            }
        }
    });
    
    // 날짜 형식 변환 및 입력 필드에 채우기
    dates.forEach((date, index) => {
        // 날짜 형식 변환 (YYYY-MM-DD 형식으로)
        let formattedDate = date;
        if (date.length === 8 && date.indexOf('-') === -1) {
            // YYYYMMDD -> YYYY-MM-DD
            formattedDate = `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
        }
        
        if (index === 0) {
            // 첫 번째 입력 필드에 채우기
            if (firstInput) {
                firstInput.value = formattedDate;
                const dateItem = firstInput.closest('.date-item');
                if (dateItem) {
                    const removeBtn = dateItem.querySelector('.remove-date');
                    const saveBtn = dateItem.querySelector('.save-date-btn');
                    if (removeBtn) removeBtn.style.display = 'inline-block';
                    if (saveBtn) saveBtn.style.display = 'inline-block';
                }
            }
        } else {
            // 추가 입력 필드 생성
            const newDateItem = document.createElement('div');
            newDateItem.className = 'date-item';
            newDateItem.innerHTML = `
                <input type="date" class="date-picker" data-index="${index}" value="${formattedDate}">
                <button class="remove-date" data-index="${index}">삭제</button>
                <button class="save-date-btn" data-index="${index}">저장</button>
            `;
            dateInputsContainer.appendChild(newDateItem);
            
            // 삭제 버튼 이벤트
            const removeBtn = newDateItem.querySelector('.remove-date');
            if (removeBtn) {
                removeBtn.addEventListener('click', function() {
                    newDateItem.remove();
                });
            }
            
            // 저장 버튼 이벤트
            const saveBtn = newDateItem.querySelector('.save-date-btn');
            if (saveBtn) {
                saveBtn.addEventListener('click', function() {
                    const dateValue = newDateItem.querySelector('.date-picker').value;
                    if (dateValue) {
                        saveDate(dateValue);
                    } else {
                        alert('날짜를 선택해주세요.');
                    }
                });
            }
        }
    });
}

// 저장된 날짜 표시
function displaySavedDates(dates) {
    const savedDatesSection = document.getElementById('saved-dates-section');
    const savedDatesList = document.getElementById('saved-dates-list');
    
    if (!dates || dates.length === 0) {
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
            deleteDate(date);
        });
        
        savedDatesList.appendChild(dateItem);
    });
}

// 날짜 삭제
async function deleteDate(date) {
    try {
        const response = await fetch('/api/monitoring-dates', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ date: date })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            alert('날짜가 삭제되었습니다.');
            loadSavedDates();
        } else {
            alert('오류: ' + (data.error || '날짜 삭제에 실패했습니다.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('날짜 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 모니터링 전역 변수
let monitoringInterval = null;
let monitoringDates = [];

// 모니터링 시작

async function startMonitoring() {
    // 이미 모니터링이 실행 중이면 중지
    if (monitoringInterval) {
        alert('이미 모니터링이 실행 중입니다. 종료 후 다시 시작해주세요.');
        return;
    }
    
    const dateInputs = document.querySelectorAll('.date-picker');
    const dates = Array.from(dateInputs)
        .map(input => input.value)
        .filter(date => date !== '');
    
    // 저장된 날짜가 없으면 저장된 날짜 목록 사용
    if (dates.length === 0) {
        try {
            const response = await fetch('/api/monitoring-dates');
            const data = await response.json();
            
            if (response.ok && data.dates && data.dates.length > 0) {
                dates.push(...data.dates);
            } else {
                alert('모니터링할 날짜를 선택하거나 저장된 날짜를 불러와주세요.');
                return;
            }
        } catch (error) {
            console.error('Error:', error);
            alert('저장된 날짜를 불러오는 중 오류가 발생했습니다.');
            return;
        }
    }
    
    if (dates.length === 0) {
        alert('모니터링할 날짜를 선택해주세요.');
        return;
    }
    
    // 주기 입력값 가져오기
    const intervalInput = document.getElementById('monitoring-interval');
    const intervalMinutes = parseInt(intervalInput.value) || 30;
    
    if (intervalMinutes < 1) {
        alert('모니터링 주기는 1분 이상이어야 합니다.');
        return;
    }
    
    // 모니터링 날짜 저장
    monitoringDates = dates;
    
    // 버튼 상태 변경
    const monitorBtn = document.getElementById('monitor-btn');
    const stopMonitorBtn = document.getElementById('stop-monitor-btn');
    if (monitorBtn) monitorBtn.style.display = 'none';
    if (stopMonitorBtn) stopMonitorBtn.style.display = 'inline-block';
    
    // 즉시 한 번 실행
    await executeMonitoring(dates);
    
    // 주기적으로 실행
    const intervalMs = intervalMinutes * 60 * 1000;
    monitoringInterval = setInterval(async () => {
        await executeMonitoring(monitoringDates);
    }, intervalMs);
    
    console.log(`모니터링이 시작되었습니다. 주기: ${intervalMinutes}분`);
}

// 모니터링 실행 함수
async function executeMonitoring(dates) {
    const loading = document.getElementById('loading');
    const resultsSection = document.getElementById('results-section');
    const resultsContainer = document.getElementById('results-container');
    
    loading.style.display = 'block';
    
    try {
        const response = await fetch('/api/monitor', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ dates: dates })
        });
        
        const data = await response.json();
        
        loading.style.display = 'none';
        
        if (response.ok && data.results) {
            displayResults(data.results);
            resultsSection.style.display = 'block';
        } else {
            console.error('모니터링 오류: ' + (data.error || '모니터링에 실패했습니다.'));
        }
    } catch (error) {
        loading.style.display = 'none';
        console.error('Error:', error);
        console.error('모니터링 중 오류가 발생했습니다: ' + error.message);
    }
}

// 모니터링 종료
function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        monitoringDates = [];
        
        // 버튼 상태 변경
        const monitorBtn = document.getElementById('monitor-btn');
        const stopMonitorBtn = document.getElementById('stop-monitor-btn');
        if (monitorBtn) monitorBtn.style.display = 'inline-block';
        if (stopMonitorBtn) stopMonitorBtn.style.display = 'none';
        
        const loading = document.getElementById('loading');
        loading.style.display = 'none';
        
        console.log('모니터링이 종료되었습니다.');
        alert('모니터링이 종료되었습니다.');
    }
}

// 결과 표시
function displayResults(results) {
    const resultsContainer = document.getElementById('results-container');
    resultsContainer.innerHTML = '';
    
    // 날짜별로 그룹화
    const groupedByDate = {};
    results.forEach(result => {
        const date = result.date;
        if (!groupedByDate[date]) {
            groupedByDate[date] = [];
        }
        groupedByDate[date].push(result);
    });
    
    // 날짜별로 표시
    Object.keys(groupedByDate).sort().forEach(date => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';
        
        // 날짜 형식 변환 (YYYYMMDD -> YYYY-MM-DD)
        const formattedDate = date.length === 8 
            ? `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`
            : date;
        
        // 모니터링 링크 생성
        const dateForUrl = date.length === 8 ? date : date.replace(/-/g, '');
        const monitoringUrl = `https://life.gangnam.go.kr/fmcs/54?facilities_type=T&base_date=${dateForUrl}&rent_type=1001&center=GNCC02&part=17&place=2#proc_list_tab`;
        
        dateGroup.innerHTML = `
            <h3>
                ${formattedDate}
                <a href="${monitoringUrl}" target="_blank" class="monitoring-link">모니터링 사이트 바로가기</a>
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
                            <td>${result.selected || '-'}</td>
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
}

// SMTP 이메일 테스트
async function testEmailSMTP() {
    const resultDiv = document.getElementById('email-result');
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<p>SMTP 이메일 발송 중...</p>';
    
    try {
        const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                subject: '예약현황 모니터링 테스트 이메일 (SMTP)',
                body: '이것은 SMTP를 통한 테스트 이메일입니다.\n\n발송 시간: ' + new Date().toLocaleString('ko-KR')
            })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            resultDiv.innerHTML = `
                <div style="color: green;">
                    <h3>✅ 이메일 발송 성공</h3>
                    <p>${data.message}</p>
                    <pre style="background: white; padding: 10px; border-radius: 5px; overflow-x: auto;">${JSON.stringify(data.details, null, 2)}</pre>
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

// 수신자 추가
async function addReceiver() {
    const input = document.getElementById('receiver-email-input');
    const email = input.value.trim();
    
    if (!email) {
        alert('이메일 주소를 입력해주세요.');
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
            alert('수신자가 추가되었습니다.');
            input.value = '';
            loadReceivers();
        } else {
            alert('오류: ' + (data.error || '수신자 추가에 실패했습니다.'));
        }
    } catch (error) {
        console.error('Error:', error);
        alert('수신자 추가 중 오류가 발생했습니다: ' + error.message);
    }
}

// 수신자 목록 불러오기
async function loadReceivers() {
    try {
        const response = await fetch('/api/email-receivers');
        const data = await response.json();
        
        if (response.ok && data.receivers) {
            displayReceivers(data.receivers || []);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

// 수신자 표시
function displayReceivers(receivers) {
    const savedReceiversSection = document.getElementById('saved-receivers-section');
    const savedReceiversList = document.getElementById('saved-receivers-list');
    
    if (!receivers || receivers.length === 0) {
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

// 수신자 삭제
async function deleteReceiver(email) {
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
