// Supabase Edge Function: 예약가능 알림 이메일 발송
// Deno runtime 사용 - 네이버 SMTP 사용

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
}

serve(async (req) => {
  // CORS preflight 요청 처리 (OPTIONS 메서드)
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204  // No Content (표준 CORS 응답)
    })
  }

  try {
    console.log('Edge Function 호출됨:', {
      method: req.method,
      url: req.url
    })
    
    // 요청 본문 파싱
    const requestBody = await req.json()
    const { sender_email, sender_password, receiver_email, subject, body, date, available_times } = requestBody

    // 필수 파라미터 검증
    if (!sender_email || !sender_password || !receiver_email) {
      return new Response(
        JSON.stringify({ error: 'sender_email, sender_password, receiver_email는 필수입니다.' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 이메일 본문 생성 (date와 available_times가 있으면 사용)
    let emailBody = body
    let emailSubject = subject || '예약가능 알림'
    
    if (date && available_times && Array.isArray(available_times)) {
      // 날짜 포맷팅 (YYYYMMDD -> YYYY-MM-DD)
      const formattedDate = date.length === 8 && /^\d+$/.test(date)
        ? `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`
        : date
      
      // 모니터링 링크 생성
      const monitoringUrl = `https://life.gangnam.go.kr/fmcs/54?facilities_type=T&base_date=${date}&rent_type=1001&center=GNCC02&part=17&place=2#proc_list_tab`
      
      emailBody = `예약가능한 시간이 발견되었습니다!\n\n`
      emailBody += `📅 날짜: ${formattedDate}\n`
      emailBody += `⏰ 예약가능한 시간:\n`
      available_times.forEach((time: string) => {
        emailBody += `  - ${time}\n`
      })
      emailBody += `🔗 모니터링 바로가기: ${monitoringUrl}\n`
      emailBody += `\n모니터링 시간: ${new Date().toISOString()}\n`
      
      emailSubject = `예약가능 알림 - ${formattedDate}`
    } else {
      emailBody = emailBody || '테스트 이메일입니다.'
      emailSubject = emailSubject || '테스트 이메일'
    }

    // 네이버 SMTP를 사용하여 이메일 발송
    const naverEmail = sender_email.includes('@') ? sender_email : `${sender_email}@naver.com`
    const naverPassword = sender_password
    
    console.log(`네이버 SMTP 설정: 이메일=${naverEmail}, 비밀번호 길이=${naverPassword.length}`)
    console.log(`이메일 발송 시도: ${receiver_email}, 제목: ${emailSubject}`)
    
    try {
      const emailSent = await sendEmailViaNaverSMTP(
        naverEmail,
        naverPassword,
        receiver_email,
        emailSubject,
        emailBody
      )
      
      if (emailSent) {
        console.log(`✓ 이메일 발송 성공: ${receiver_email}`)
        return new Response(
          JSON.stringify({
            success: true,
            message: '이메일이 성공적으로 발송되었습니다.',
            details: {
              from: naverEmail,
              to: receiver_email,
              subject: emailSubject,
              date: date || 'N/A',
              available_times: available_times || [],
              timestamp: new Date().toISOString()
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        )
      } else {
        console.log(`✗ 이메일 발송 실패: ${receiver_email}`)
        return new Response(
          JSON.stringify({
            success: false,
            error: '이메일 발송에 실패했습니다 (SMTP 오류)',
            details: {
              from: naverEmail,
              to: receiver_email,
              subject: emailSubject
            }
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500 
          }
        )
      }
    } catch (emailError: any) {
      const errorMessage = emailError?.message || '알 수 없는 오류'
      console.error(`이메일 발송 오류 (${receiver_email}):`, {
        message: errorMessage,
        stack: emailError?.stack,
        name: emailError?.name
      })
      
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage,
          details: {
            from: naverEmail,
            to: receiver_email,
            subject: emailSubject
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

  } catch (error: any) {
    // 상세 오류 로깅
    console.error('Edge Function 오류 발생:', {
      message: error?.message || '알 수 없는 오류',
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause
    })
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || '알 수 없는 오류',
        details: process.env.DENO_ENV === 'development' ? {
          stack: error?.stack,
          name: error?.name
        } : undefined
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

// 네이버 SMTP를 사용한 이메일 발송 함수
// Deno에서 직접 SMTP 프로토콜 구현
async function sendEmailViaNaverSMTP(
  senderEmail: string,
  senderPassword: string,
  receiverEmail: string,
  subject: string,
  body: string
): Promise<boolean> {
  try {
    // SMTP 서버 설정
    const smtpServer = "smtp.naver.com"
    const smtpPort = 465  // SSL/TLS 포트 (465는 직접 TLS 연결)
    
    // 이메일 메시지 구성 (Python MIMEMultipart 스타일)
    const message = createEmailMessage(
      senderEmail,
      receiverEmail,
      subject,
      body
    )
    
    // SMTP 연결 (465 포트는 직접 TLS 연결)
    console.log(`SMTP 서버 연결 시도: ${smtpServer}:${smtpPort} (SSL/TLS)`)
    let tlsConn: Deno.TlsConn
    try {
      // 465 포트는 Deno.connectTls를 사용하여 직접 TLS 연결
      tlsConn = await Deno.connectTls({ hostname: smtpServer, port: smtpPort })
      console.log('SMTP 서버 TLS 연결 성공')
    } catch (connectError: any) {
      throw new Error(`SMTP 서버 연결 실패: ${connectError?.message || '알 수 없는 오류'}`)
    }
    
    const tlsEncoder = new TextEncoder()
    const tlsDecoder = new TextDecoder()
    
    // SMTP 프로토콜 처리 (TLS 연결 후)
    let response = await readSMTPResponse(tlsConn, tlsDecoder)
    console.log('SMTP 초기 응답:', response)
    if (!response || !response.startsWith('220')) {
      tlsConn.close()
      throw new Error(`SMTP 연결 실패: ${response || '(응답 없음)'}`)
    }
    
    // EHLO 명령 (호스트명 사용)
    const hostname = 'localhost' // SMTP EHLO에서 사용할 호스트명
    await writeSMTPCommand(tlsConn, tlsEncoder, `EHLO ${hostname}`)
    
    // 응답 읽기 전에 짧은 대기 (서버가 응답할 시간 제공)
    await new Promise(resolve => setTimeout(resolve, 200))
    
    response = await readSMTPResponse(tlsConn, tlsDecoder)
    console.log('EHLO 응답:', response)
    
    if (!response || response.trim() === '') {
      tlsConn.close()
      throw new Error('EHLO 실패: 응답이 없습니다')
    }
    
    if (!response.startsWith('250')) {
      tlsConn.close()
      throw new Error(`EHLO 실패: ${response}`)
    }
    
    // AUTH LOGIN
    await writeSMTPCommand(tlsConn, tlsEncoder, 'AUTH LOGIN')
    response = await readSMTPResponse(tlsConn, tlsDecoder)
    if (!response.startsWith('334')) {
      tlsConn.close()
      throw new Error(`AUTH LOGIN 실패: ${response}`)
    }
    
    // 사용자명 전송 (base64 인코딩)
    // 네이버 SMTP는 아이디만 사용 (일부 경우 전체 이메일 주소도 가능하지만, 먼저 아이디만 시도)
    const username = senderEmail.split('@')[0] // beeper9@naver.com -> beeper9
    // Deno에서 base64 인코딩 (내장 함수 사용)
    const usernameB64 = btoa(username)
    console.log(`=== SMTP 인증 시작 ===`)
    console.log(`사용자명 인증 시도: ${username} (base64: ${usernameB64})`)
    console.log(`전체 이메일 주소: ${senderEmail}`)
    console.log(`비밀번호 길이: ${senderPassword.length}`)
    console.log(`비밀번호 첫 2자: ${senderPassword.substring(0, 2)}***`)
    console.log(`⚠️ 네이버 SMTP 인증 실패 시 확인사항:`)
    console.log(`   1. 네이버 메일 → 환경설정 → POP3/IMAP 설정 → "외부 메일 프로그램 사용" 활성화`)
    console.log(`   2. 네이버 계정 비밀번호가 정확한지 확인`)
    console.log(`   3. 2단계 인증 활성화 시 앱 비밀번호 사용 필요`)
    await writeSMTPCommand(tlsConn, tlsEncoder, usernameB64)
    response = await readSMTPResponse(tlsConn, tlsDecoder)
    console.log(`사용자명 인증 응답: ${response}`)
    if (!response.startsWith('334')) {
      tlsConn.close()
      const errorMsg = `사용자명 인증 실패: ${response}`
      console.error(`❌ ${errorMsg}`)
      console.error(`사용자명: ${username}, 전체 이메일: ${senderEmail}`)
      throw new Error(errorMsg)
    }
    console.log(`✓ 사용자명 인증 성공`)
    
    // 비밀번호 전송 (base64 인코딩)
    const passwordB64 = btoa(senderPassword)
    console.log(`비밀번호 인증 시도: ${senderPassword.substring(0, 2)}*** (base64: ${passwordB64.substring(0, 10)}...)`)
    await writeSMTPCommand(tlsConn, tlsEncoder, passwordB64)
    response = await readSMTPResponse(tlsConn, tlsDecoder)
    console.log(`비밀번호 인증 응답: ${response}`)
    if (!response.startsWith('235')) {
      tlsConn.close()
      const errorMsg = `비밀번호 인증 실패: ${response}`
      console.error(`❌ ${errorMsg}`)
      console.error(`사용자명: ${username}, 전체 이메일: ${senderEmail}`)
      console.error(`비밀번호 길이: ${senderPassword.length}, 첫 2자: ${senderPassword.substring(0, 2)}`)
      console.error(`🔴 네이버 SMTP 인증 실패 원인 가능성:`)
      console.error(`   1. 네이버 메일 외부 프로그램 사용 설정이 꺼져 있음`)
      console.error(`   2. 비밀번호가 잘못됨 (현재: ${senderPassword.substring(0, 2)}***)`)
      console.error(`   3. 2단계 인증 활성화되어 앱 비밀번호 필요`)
      throw new Error(errorMsg)
    }
    console.log(`✓ 비밀번호 인증 성공`)
    
    // MAIL FROM
    await writeSMTPCommand(tlsConn, tlsEncoder, `MAIL FROM:<${senderEmail}>`)
    response = await readSMTPResponse(tlsConn, tlsDecoder)
    if (!response.startsWith('250')) {
      tlsConn.close()
      throw new Error(`MAIL FROM 실패: ${response}`)
    }
    
    // RCPT TO
    await writeSMTPCommand(tlsConn, tlsEncoder, `RCPT TO:<${receiverEmail}>`)
    response = await readSMTPResponse(tlsConn, tlsDecoder)
    if (!response.startsWith('250')) {
      tlsConn.close()
      throw new Error(`RCPT TO 실패: ${response}`)
    }
    
    // DATA
    await writeSMTPCommand(tlsConn, tlsEncoder, 'DATA')
    response = await readSMTPResponse(tlsConn, tlsDecoder)
    if (!response.startsWith('354')) {
      tlsConn.close()
      throw new Error(`DATA 실패: ${response}`)
    }
    
    // 메시지 본문 전송 (Python의 server.sendmail과 유사)
    // 메시지를 줄 단위로 전송
    const messageLines = message.split('\r\n')
    for (const line of messageLines) {
      await writeSMTPCommand(tlsConn, tlsEncoder, line)
    }
    
    // 종료 마커 전송 (점 하나만, Python의 sendmail과 동일)
    await writeSMTPCommand(tlsConn, tlsEncoder, '.')
    response = await readSMTPResponse(tlsConn, tlsDecoder)
    if (!response.startsWith('250')) {
      tlsConn.close()
      throw new Error(`메시지 전송 실패: ${response}`)
    }
    
    // QUIT (Python의 with 문이 자동으로 처리하는 것과 유사)
    await writeSMTPCommand(tlsConn, tlsEncoder, 'QUIT')
    response = await readSMTPResponse(tlsConn, tlsDecoder)
    tlsConn.close()
    
    console.log(`✓ 메일 발송 성공: ${receiverEmail}`)
    return true
  } catch (error: any) {
    const errorMessage = error?.message || '알 수 없는 SMTP 오류'
    console.error(`✗ 메일 발송 실패: ${errorMessage}`)
    console.error('SMTP 오류 상세:', {
      message: errorMessage,
      stack: error?.stack,
      name: error?.name,
      cause: error?.cause,
      senderEmail: senderEmail,
      receiverEmail: receiverEmail
    })
    return false
  }
}

// SMTP 명령 전송 헬퍼 함수
async function writeSMTPCommand(conn: Deno.Conn | Deno.TlsConn, encoder: TextEncoder, command: string): Promise<void> {
  const data = encoder.encode(command + '\r\n')
  await conn.write(data)
}

// SMTP 응답 읽기 헬퍼 함수 (여러 줄 응답 처리)
async function readSMTPResponse(conn: Deno.Conn | Deno.TlsConn, decoder: TextDecoder): Promise<string> {
  let fullResponse = ''
  const buffer = new Uint8Array(4096)
  let timeoutCount = 0
  const maxTimeout = 50 // 최대 5초 대기 (50 * 100ms)
  let hasData = false
  
  while (timeoutCount < maxTimeout) {
    const n = await conn.read(buffer)
    
    if (n === null || n === 0) {
      // 데이터가 없으면 잠시 대기 후 다시 시도
      await new Promise(resolve => setTimeout(resolve, 100))
      timeoutCount++
      
      // 이미 응답이 있고 완료 조건을 만족하면 종료
      if (hasData && fullResponse.trim().length > 0) {
        const lines = fullResponse.split('\r\n').filter(line => line.trim().length > 0)
        if (lines.length > 0) {
          const lastLine = lines[lines.length - 1].trim()
          // SMTP 응답 코드가 있으면 완료 (250, 220, 334, 235, 354 등)
          if (lastLine.match(/^\d{3}(\s|$)/)) {
            break
          }
        }
      }
      continue
    }
    
    hasData = true
    const chunk = decoder.decode(buffer.subarray(0, n))
    fullResponse += chunk
    
    // SMTP 응답은 마지막 줄이 숫자로 시작하고 공백이 있으면 완료
    const lines = fullResponse.split('\r\n').filter(line => line.trim().length > 0)
    if (lines.length > 0) {
      const lastLine = lines[lines.length - 1].trim()
      
      // SMTP 응답 코드 확인 (250, 220, 334, 235, 354 등)
      // 마지막 줄이 숫자 3자리로 시작하면 응답 완료
      if (lastLine.match(/^\d{3}(\s|$)/)) {
        break
      }
    }
    
    // 짧은 대기 후 다음 데이터 읽기
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  
  const trimmedResponse = fullResponse.trim()
  if (trimmedResponse === '') {
    throw new Error('SMTP 응답 읽기 타임아웃: 응답이 없습니다')
  }
  
  return trimmedResponse
}

// 이메일 메시지 생성 함수 (RFC 5322 형식, Python MIMEMultipart 스타일)
function createEmailMessage(
  from: string,
  to: string,
  subject: string,
  body: string
): string {
  // Base64 인코딩 헬퍼 함수 (Deno에서 안전하게 사용)
  function toBase64(str: string): string {
    const bytes = new TextEncoder().encode(str)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }
  
  // 제목 인코딩 (한글 지원) - UTF-8 Base64 인코딩
  const encodedSubject = `=?UTF-8?B?${toBase64(subject)}?=`
  
  // 본문을 텍스트 형식으로 (HTML이 아닌 경우)
  const textBody = body.replace(/\n/g, '\r\n')
  
  // 간단한 텍스트 이메일 형식 (MIMEText 스타일)
  return [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodedSubject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    textBody
  ].join('\r\n')
}
